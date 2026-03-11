import { Op, type Transaction } from "sequelize";

import { normalizeDoiValue, parseAuthorFamilyFromText } from "./enrichmentCommon";
import { badRequest, notFound } from "./http";
import db from "../models";
import type {
  CreateImportPayload,
  DeleteImportResponse,
  ImportCreateResponse,
  ImportDetectedSource,
  ImportDuplicateReason,
  ImportFormat,
  ImportPreviewPayload,
  ImportPreviewRecord,
  ImportPreviewResponse,
  ImportsIndexResponse,
  ImportSummary,
} from "../shared/contracts";

const MAX_IMPORT_CONTENT_BYTES = Number.parseInt(process.env.IMPORT_MAX_CONTENT_BYTES ?? "", 10) || 8_000_000;
const MAX_IMPORT_PREVIEW_ROWS = Number.parseInt(process.env.IMPORT_PREVIEW_MAX_ROWS ?? "", 10) || 200;
const DEFAULT_IMPORT_PAGE_SIZE = 25;
const IMPORT_PAGE_SIZE_MAX = 200;

type ParsedInputRecord = {
  rowNumber: number;
  title: string | null;
  author: string | null;
  year: number | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  forumName: string | null;
  publisher: string | null;
  issn: string | null;
  databases: string[];
  alternateUrls: string[];
};

type DuplicateDetectionIndex = {
  doiToRecordId: Map<string, number>;
  urlToRecordId: Map<string, number>;
  titleAuthorToRecords: Map<string, Array<{ id: number; year: number | null }>>;
};

type AnalyzedCandidate = {
  parsed: ParsedInputRecord;
  preview: ImportPreviewRecord;
};

type AnalyzeImportResult = {
  detectedFormat: ImportFormat;
  detectedSource: ImportDetectedSource;
  warnings: string[];
  total: number;
  parsed: number;
  newRecords: number;
  duplicates: number;
  invalid: number;
  records: ImportPreviewRecord[];
  candidates: AnalyzedCandidate[];
};

const SOURCE_DATABASE_LABELS: Record<ImportDetectedSource, string> = {
  scopus: "SCOPUS",
  acm: "ACM_DL",
  "google-scholar": "GOOGLE_SCHOLAR",
  "other-bibtex": "BIBTEX",
};

const toStringOrNull = (value: string | null | undefined) => {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
};

const toNumberYear = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }
  const match = value.match(/\b(18|19|20)\d{2}\b/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[0], 10);
  if (!Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
};

const normalizeTitle = (value: string | null | undefined) =>
  value
    ?.toLocaleLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim() ?? "";

const extractDoiFromText = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  const match = value.match(/\b10\.\d{4,9}\/[^\s"<>]+/i);
  return normalizeDoiValue(match?.[0] ?? null);
};

const normalizeUrl = (value: string | null | undefined) => {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  const doi = normalizeDoiValue(raw) ?? extractDoiFromText(raw);
  if (doi) {
    return `doi:${doi.toLocaleLowerCase()}`;
  }

  try {
    const parsed = new URL(raw);
    parsed.hash = "";
    const canonical = parsed.toString().replace(/\/$/, "");
    return canonical.toLocaleLowerCase();
  } catch {
    return raw.toLocaleLowerCase().replace(/\/$/, "");
  }
};

const uniqueStrings = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = toStringOrNull(value);
    if (!normalized) {
      continue;
    }
    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }

  return result;
};

const detectImportFormat = (fileName: string, content: string): ImportFormat => {
  const normalizedFileName = fileName.toLocaleLowerCase();
  if (normalizedFileName.endsWith(".csv")) {
    return "csv";
  }
  if (
    normalizedFileName.endsWith(".bib")
    || normalizedFileName.endsWith(".bibtex")
    || normalizedFileName.endsWith(".txt")
  ) {
    return "bibtex";
  }

  if (/@\w+\s*[{(]/.test(content)) {
    return "bibtex";
  }

  if (content.includes(",")) {
    return "csv";
  }

  throw badRequest("Unable to detect import format from file content");
};

const normalizeHeader = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");

const detectImportSource = (
  explicitSource: string | undefined,
  format: ImportFormat,
  fileName: string,
  headers: string[],
): ImportDetectedSource => {
  if (explicitSource && explicitSource !== "auto") {
    if (explicitSource === "scopus" || explicitSource === "acm" || explicitSource === "google-scholar") {
      return explicitSource;
    }
    return "other-bibtex";
  }

  const lowerFileName = fileName.toLocaleLowerCase();
  if (lowerFileName.includes("scopus")) {
    return "scopus";
  }
  if (lowerFileName.includes("acm")) {
    return "acm";
  }
  if (lowerFileName.includes("scholar")) {
    return "google-scholar";
  }

  const normalizedHeaders = headers.map(normalizeHeader);
  if (normalizedHeaders.includes("eid") || normalizedHeaders.includes("sourcetitle")) {
    return "scopus";
  }
  if (normalizedHeaders.includes("citedby") || normalizedHeaders.includes("publicationyear")) {
    return "google-scholar";
  }

  if (format === "bibtex") {
    return "other-bibtex";
  }

  return "scopus";
};

const parseCsvRows = (content: string) => {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index] ?? "";
    const next = content[index + 1] ?? "";

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(field);
      field = "";
      if (row.some((item) => item.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((item) => item.trim().length > 0)) {
    rows.push(row);
  }

  return rows;
};

const parseCsvInput = (content: string, databaseLabel: string): { headers: string[]; rows: ParsedInputRecord[] } => {
  const csvRows = parseCsvRows(content);
  if (csvRows.length < 2) {
    throw badRequest("CSV file must contain a header row and at least one data row");
  }

  const headers = csvRows[0] ?? [];
  const normalizedHeaders = headers.map(normalizeHeader);
  const indexOf = (...candidates: string[]) =>
    normalizedHeaders.findIndex((header) => candidates.includes(header));

  const titleIndex = indexOf("title", "documenttitle", "articletitle");
  const authorIndex = indexOf("authors", "author", "authorfullnames", "authorsfullnames");
  const yearIndex = indexOf("year", "publicationyear", "pubyear", "coverdate");
  const doiIndex = indexOf("doi");
  const urlIndex = indexOf("url", "link", "documenturl", "sourceurl", "articledoi", "doiurl");
  const abstractIndex = indexOf("abstract", "description", "summary");
  const forumIndex = indexOf("sourcetitle", "journal", "publicationtitle", "forum", "venue", "booktitle");
  const publisherIndex = indexOf("publisher");
  const issnIndex = indexOf("issn", "eissn", "printissn");

  if (titleIndex < 0 && doiIndex < 0 && urlIndex < 0) {
    throw badRequest("CSV file does not contain supported title/DOI/URL columns");
  }

  const records = csvRows.slice(1).map((fields, position) => {
    const read = (idx: number) => (idx >= 0 ? toStringOrNull(fields[idx]) : null);
    const title = read(titleIndex);
    const author = read(authorIndex);
    const year = toNumberYear(read(yearIndex));
    const doiRaw = read(doiIndex);
    const doi = normalizeDoiValue(doiRaw) ?? extractDoiFromText(read(urlIndex));
    const url = read(urlIndex);

    return {
      rowNumber: position + 2,
      title,
      author,
      year,
      doi,
      url,
      abstract: read(abstractIndex),
      forumName: read(forumIndex),
      publisher: read(publisherIndex),
      issn: read(issnIndex),
      databases: uniqueStrings([databaseLabel]),
      alternateUrls: uniqueStrings([]),
    } satisfies ParsedInputRecord;
  });

  return { headers, rows: records };
};

const cleanBibtexValue = (value: string) =>
  value
    .trim()
    .replace(/^[{"]+/, "")
    .replace(/[}"]+$/, "")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const parseBibtexFields = (input: string) => {
  const fields = new Map<string, string>();
  let cursor = 0;

  const skipWhitespace = () => {
    while (cursor < input.length && /[\s,]/.test(input[cursor] ?? "")) {
      cursor += 1;
    }
  };

  while (cursor < input.length) {
    skipWhitespace();
    if (cursor >= input.length) {
      break;
    }

    const nameStart = cursor;
    while (cursor < input.length && /[a-zA-Z0-9_-]/.test(input[cursor] ?? "")) {
      cursor += 1;
    }
    const fieldName = input.slice(nameStart, cursor).toLocaleLowerCase();
    skipWhitespace();
    if (!fieldName || input[cursor] !== "=") {
      break;
    }
    cursor += 1;
    skipWhitespace();

    let value = "";
    const current = input[cursor] ?? "";
    if (current === "{") {
      let depth = 1;
      cursor += 1;
      while (cursor < input.length && depth > 0) {
        const token = input[cursor] ?? "";
        if (token === "{") {
          depth += 1;
        } else if (token === "}") {
          depth -= 1;
          if (depth === 0) {
            cursor += 1;
            break;
          }
        }
        if (depth > 0) {
          value += token;
        }
        cursor += 1;
      }
    } else if (current === "\"") {
      cursor += 1;
      while (cursor < input.length) {
        const token = input[cursor] ?? "";
        if (token === "\"" && input[cursor - 1] !== "\\") {
          cursor += 1;
          break;
        }
        value += token;
        cursor += 1;
      }
    } else {
      const start = cursor;
      while (cursor < input.length && input[cursor] !== ",") {
        cursor += 1;
      }
      value = input.slice(start, cursor);
    }

    fields.set(fieldName, cleanBibtexValue(value));
    while (cursor < input.length && input[cursor] !== ",") {
      cursor += 1;
    }
    if (input[cursor] === ",") {
      cursor += 1;
    }
  }

  return fields;
};

const parseBibtexInput = (content: string, databaseLabel: string): ParsedInputRecord[] => {
  const records: ParsedInputRecord[] = [];
  const entryRegex = /@([a-zA-Z]+)\s*[{(]([\s\S]*?)[})]\s*(?=@|$)/g;

  let match: RegExpExecArray | null = entryRegex.exec(content);
  while (match) {
    const body = match[2] ?? "";
    const firstComma = body.indexOf(",");
    const fieldsSegment = firstComma >= 0 ? body.slice(firstComma + 1) : body;
    const fields = parseBibtexFields(fieldsSegment);

    const title = toStringOrNull(fields.get("title"));
    const author = toStringOrNull(fields.get("author"));
    const year = toNumberYear(fields.get("year") ?? fields.get("date") ?? null);
    const doi = normalizeDoiValue(fields.get("doi") ?? null) ?? extractDoiFromText(fields.get("url") ?? null);
    const url = toStringOrNull(fields.get("url") ?? fields.get("howpublished") ?? null);

    records.push({
      rowNumber: records.length + 1,
      title,
      author,
      year,
      doi,
      url,
      abstract: toStringOrNull(fields.get("abstract") ?? fields.get("annotation") ?? null),
      forumName: toStringOrNull(fields.get("journal") ?? fields.get("booktitle") ?? null),
      publisher: toStringOrNull(fields.get("publisher") ?? null),
      issn: toStringOrNull(fields.get("issn") ?? null),
      databases: uniqueStrings([databaseLabel]),
      alternateUrls: uniqueStrings([]),
    });

    match = entryRegex.exec(content);
  }

  if (records.length === 0) {
    throw badRequest("No BibTeX entries found in file");
  }

  return records;
};

const buildDuplicateDetectionIndex = async (): Promise<DuplicateDetectionIndex> => {
  const records = (await db.Record.findAll({
    attributes: ["id", "doi", "url", "alternateUrls", "title", "author", "year"],
    raw: true,
  })) as Array<{
    id: number;
    doi: string | null;
    url: string | null;
    alternateUrls: string[] | null;
    title: string | null;
    author: string | null;
    year: number | null;
  }>;

  const doiToRecordId = new Map<string, number>();
  const urlToRecordId = new Map<string, number>();
  const titleAuthorToRecords = new Map<string, Array<{ id: number; year: number | null }>>();

  for (const record of records) {
    const doi = normalizeDoiValue(record.doi);
    if (doi) {
      doiToRecordId.set(doi.toLocaleLowerCase(), record.id);
    }

    for (const url of [record.url, ...(record.alternateUrls ?? [])]) {
      const normalized = normalizeUrl(url);
      if (normalized) {
        urlToRecordId.set(normalized, record.id);
      }
    }

    const titleKey = normalizeTitle(record.title);
    const authorFamily = parseAuthorFamilyFromText(record.author);
    if (!titleKey || !authorFamily) {
      continue;
    }
    const key = `${titleKey}|${authorFamily}`;
    const bucket = titleAuthorToRecords.get(key) ?? [];
    bucket.push({ id: record.id, year: record.year ?? null });
    titleAuthorToRecords.set(key, bucket);
  }

  return { doiToRecordId, urlToRecordId, titleAuthorToRecords };
};

const detectDuplicate = (
  record: ParsedInputRecord,
  index: DuplicateDetectionIndex,
  seenDoi: Set<string>,
  seenUrls: Set<string>,
  seenTitleAuthor: Set<string>,
): { reason: ImportDuplicateReason; duplicateRecordId: number | null } | null => {
  const doi = normalizeDoiValue(record.doi);
  if (doi) {
    const key = doi.toLocaleLowerCase();
    const matchRecordId = index.doiToRecordId.get(key);
    if (matchRecordId) {
      return { reason: "doi", duplicateRecordId: matchRecordId };
    }
    if (seenDoi.has(key)) {
      return { reason: "batch", duplicateRecordId: null };
    }
    seenDoi.add(key);
  }

  const normalizedUrls = uniqueStrings([record.url, ...record.alternateUrls]).map((value) => normalizeUrl(value));
  for (const urlKey of normalizedUrls) {
    if (!urlKey) {
      continue;
    }
    const matchRecordId = index.urlToRecordId.get(urlKey);
    if (matchRecordId) {
      return { reason: "url", duplicateRecordId: matchRecordId };
    }
    if (seenUrls.has(urlKey)) {
      return { reason: "batch", duplicateRecordId: null };
    }
    seenUrls.add(urlKey);
  }

  const titleKey = normalizeTitle(record.title);
  const authorFamily = parseAuthorFamilyFromText(record.author);
  if (titleKey && authorFamily) {
    const key = `${titleKey}|${authorFamily}`;
    const matches = index.titleAuthorToRecords.get(key) ?? [];
    const yearMatch = matches.find((item) => item.year === null || record.year === null || item.year === record.year);
    if (yearMatch) {
      return { reason: "title-author-year", duplicateRecordId: yearMatch.id };
    }
    if (seenTitleAuthor.has(key)) {
      return { reason: "batch", duplicateRecordId: null };
    }
    seenTitleAuthor.add(key);
  }

  return null;
};

const analyzeImportPayload = async (payload: ImportPreviewPayload): Promise<AnalyzeImportResult> => {
  const fileName = payload.fileName.trim();
  const content = payload.content;
  const source = payload.source;

  if (!fileName) {
    throw badRequest("fileName must not be empty");
  }
  if (typeof content !== "string" || content.trim().length === 0) {
    throw badRequest("content must not be empty");
  }
  if (Buffer.byteLength(content, "utf-8") > MAX_IMPORT_CONTENT_BYTES) {
    throw badRequest(`content exceeds maximum size (${MAX_IMPORT_CONTENT_BYTES} bytes)`);
  }

  const detectedFormat = detectImportFormat(fileName, content);
  const parsedCsv = detectedFormat === "csv" ? parseCsvInput(content, "CSV_IMPORT") : null;
  const detectedSource = detectImportSource(source, detectedFormat, fileName, parsedCsv?.headers ?? []);
  const databaseLabel = SOURCE_DATABASE_LABELS[detectedSource];
  const parsedRows =
    detectedFormat === "csv"
      ? parseCsvInput(content, databaseLabel).rows
      : parseBibtexInput(content, databaseLabel).map((item) => ({
        ...item,
        databases: uniqueStrings([databaseLabel, ...item.databases]),
      }));

  const duplicateIndex = await buildDuplicateDetectionIndex();
  const seenDoi = new Set<string>();
  const seenUrls = new Set<string>();
  const seenTitleAuthor = new Set<string>();

  let parsed = 0;
  let duplicates = 0;
  let invalid = 0;
  let newRecords = 0;
  const warnings: string[] = [];
  const candidates: AnalyzedCandidate[] = [];

  for (const row of parsedRows) {
    const errors: string[] = [];
    const title = toStringOrNull(row.title);
    const author = toStringOrNull(row.author);
    const doi = normalizeDoiValue(row.doi);
    const url = toStringOrNull(row.url);

    if (!title && !doi && !url) {
      errors.push("Missing title, DOI and URL");
    }

    const duplicate = errors.length > 0 ? null : detectDuplicate(row, duplicateIndex, seenDoi, seenUrls, seenTitleAuthor);
    const status = errors.length > 0 ? "invalid" : duplicate ? "duplicate" : "new";

    if (status === "invalid") {
      invalid += 1;
    } else if (status === "duplicate") {
      parsed += 1;
      duplicates += 1;
    } else {
      parsed += 1;
      newRecords += 1;
    }

    const preview: ImportPreviewRecord = {
      rowNumber: row.rowNumber,
      status,
      duplicateReason: duplicate?.reason ?? null,
      duplicateRecordId: duplicate?.duplicateRecordId ?? null,
      errors,
      title,
      author,
      year: row.year ?? null,
      doi,
      url,
      abstract: toStringOrNull(row.abstract),
      forumName: toStringOrNull(row.forumName),
      publisher: toStringOrNull(row.publisher),
      issn: toStringOrNull(row.issn),
      databases: uniqueStrings(row.databases),
      alternateUrls: uniqueStrings(row.alternateUrls),
    };

    candidates.push({ parsed: row, preview });
  }

  if (candidates.length > MAX_IMPORT_PREVIEW_ROWS) {
    warnings.push(`Showing first ${MAX_IMPORT_PREVIEW_ROWS} preview rows out of ${candidates.length}`);
  }

  return {
    detectedFormat,
    detectedSource,
    warnings,
    total: candidates.length,
    parsed,
    newRecords,
    duplicates,
    invalid,
    records: candidates.slice(0, MAX_IMPORT_PREVIEW_ROWS).map((item) => item.preview),
    candidates,
  };
};

type ForumLite = {
  id: number;
  name: string | null;
  issn: string | null;
};

const normalizeIssn = (value: string | null | undefined) =>
  value?.toLocaleUpperCase().replace(/[^0-9X]/g, "").trim() ?? "";

const resolveForumId = async (
  forumName: string | null,
  publisher: string | null,
  issn: string | null,
  detectedSource: ImportDetectedSource,
  forumsByName: Map<string, number>,
  forumsByIssn: Map<string, number>,
  transaction: Transaction,
) => {
  const normalizedName = normalizeTitle(forumName);
  const normalizedIssn = normalizeIssn(issn);
  if (!normalizedName && !normalizedIssn && !publisher) {
    return null;
  }

  if (normalizedIssn && forumsByIssn.has(normalizedIssn)) {
    return forumsByIssn.get(normalizedIssn) ?? null;
  }
  if (normalizedName && forumsByName.has(normalizedName)) {
    return forumsByName.get(normalizedName) ?? null;
  }

  const created = await db.Forum.create(
    {
      name: forumName ?? "(Unnamed forum)",
      publisher,
      issn: issn ?? null,
      database: SOURCE_DATABASE_LABELS[detectedSource],
    },
    { transaction },
  );

  const createdId = Number(created.id);
  if (normalizedName) {
    forumsByName.set(normalizedName, createdId);
  }
  if (normalizedIssn) {
    forumsByIssn.set(normalizedIssn, createdId);
  }
  return createdId;
};

const buildImportSummary = (
  importModel: {
    id: number;
    database: string | null;
    source: string | null;
    format: string | null;
    fileName: string | null;
    total: number | null;
    imported: number | null;
    dublicates: number | null;
    namesakes: string[] | null;
    query: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  recordCount: number,
): ImportSummary => ({
  id: importModel.id,
  database: importModel.database,
  source: (importModel.source as ImportDetectedSource | null) ?? null,
  format: (importModel.format as ImportFormat | null) ?? null,
  fileName: importModel.fileName,
  total: importModel.total,
  imported: importModel.imported,
  dublicates: importModel.dublicates,
  namesakes: importModel.namesakes,
  query: importModel.query,
  createdAt: importModel.createdAt.toISOString(),
  updatedAt: importModel.updatedAt.toISOString(),
  recordCount,
});

export const previewImportData = async (payload: ImportPreviewPayload): Promise<ImportPreviewResponse> => {
  const analyzed = await analyzeImportPayload(payload);
  return {
    detectedFormat: analyzed.detectedFormat,
    detectedSource: analyzed.detectedSource,
    total: analyzed.total,
    parsed: analyzed.parsed,
    newRecords: analyzed.newRecords,
    duplicates: analyzed.duplicates,
    invalid: analyzed.invalid,
    records: analyzed.records,
    warnings: analyzed.warnings,
  };
};

export const createImportData = async (payload: CreateImportPayload): Promise<ImportCreateResponse> => {
  const analyzed = await analyzeImportPayload(payload);
  const namesakes = uniqueStrings(
    analyzed.candidates
      .filter((item) => item.preview.duplicateReason === "title-author-year")
      .map((item) => item.preview.title),
  );

  const createdRecordIds: number[] = [];

  const createdImport = await db.sequelize.transaction(async (transaction) => {
    const importModel = await db.Import.create(
      {
        database: SOURCE_DATABASE_LABELS[analyzed.detectedSource],
        source: analyzed.detectedSource,
        format: analyzed.detectedFormat,
        fileName: payload.fileName,
        total: analyzed.total,
        imported: analyzed.newRecords,
        dublicates: analyzed.duplicates,
        namesakes: namesakes.length > 0 ? namesakes : null,
        query: JSON.stringify({
          source: analyzed.detectedSource,
          format: analyzed.detectedFormat,
          fileName: payload.fileName,
        }),
      },
      { transaction },
    );

    const forums = (await db.Forum.findAll({
      attributes: ["id", "name", "issn"],
      where: {
        deletedAt: {
          [Op.is]: null,
        },
      },
      transaction,
      raw: true,
    })) as ForumLite[];
    const forumsByName = new Map<string, number>();
    const forumsByIssn = new Map<string, number>();
    for (const forum of forums) {
      const nameKey = normalizeTitle(forum.name);
      const issnKey = normalizeIssn(forum.issn);
      if (nameKey) {
        forumsByName.set(nameKey, forum.id);
      }
      if (issnKey) {
        forumsByIssn.set(issnKey, forum.id);
      }
    }

    for (const candidate of analyzed.candidates) {
      if (candidate.preview.status !== "new") {
        continue;
      }

      const forumId = await resolveForumId(
        candidate.preview.forumName,
        candidate.preview.publisher,
        candidate.preview.issn,
        analyzed.detectedSource,
        forumsByName,
        forumsByIssn,
        transaction,
      );

      const created = await db.Record.create(
        {
          title: candidate.preview.title ?? "(Untitled imported record)",
          author: candidate.preview.author ?? "",
          year: candidate.preview.year ?? null,
          url: candidate.preview.url ?? "",
          status: null,
          abstract: candidate.preview.abstract,
          databases: uniqueStrings([SOURCE_DATABASE_LABELS[analyzed.detectedSource], ...candidate.preview.databases]),
          alternateUrls: candidate.preview.alternateUrls,
          forumId,
          doi: candidate.preview.doi,
          editedBy: "import",
          comment: null,
          importId: importModel.id,
        },
        { transaction },
      );
      createdRecordIds.push(Number(created.id));
    }

    return importModel as {
      id: number;
      database: string | null;
      source: string | null;
      format: string | null;
      fileName: string | null;
      total: number | null;
      imported: number | null;
      dublicates: number | null;
      namesakes: string[] | null;
      query: string | null;
      createdAt: Date;
      updatedAt: Date;
    };
  });

  return {
    import: buildImportSummary(createdImport, createdRecordIds.length),
    summary: {
      detectedFormat: analyzed.detectedFormat,
      detectedSource: analyzed.detectedSource,
      total: analyzed.total,
      parsed: analyzed.parsed,
      newRecords: analyzed.newRecords,
      duplicates: analyzed.duplicates,
      invalid: analyzed.invalid,
      records: analyzed.records,
      warnings: analyzed.warnings,
    },
    createdRecordIds,
  };
};

export const listImports = async (offset = 0, limit = DEFAULT_IMPORT_PAGE_SIZE): Promise<ImportsIndexResponse> => {
  const effectiveOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;
  const effectiveLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, IMPORT_PAGE_SIZE_MAX) : DEFAULT_IMPORT_PAGE_SIZE;

  const [count, imports] = await Promise.all([
    db.Import.count(),
    db.Import.findAll({
      offset: effectiveOffset,
      limit: effectiveLimit,
      order: [["createdAt", "DESC"]],
    }),
  ]);

  const importIds = imports.map((item) => Number(item.id));
  const counts = (await db.Record.findAll({
    attributes: ["importId", [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "recordCount"]],
    where: {
      importId: {
        [Op.in]: importIds.length > 0 ? importIds : [0],
      },
    },
    group: ["importId"],
    raw: true,
  })) as unknown as Array<{ importId: number; recordCount: string | number }>;

  const recordCountByImportId = new Map<number, number>();
  for (const item of counts) {
    recordCountByImportId.set(Number(item.importId), Number(item.recordCount) || 0);
  }

  const summaries = imports.map((item) =>
    buildImportSummary(
      item as unknown as {
        id: number;
        database: string | null;
        source: string | null;
        format: string | null;
        fileName: string | null;
        total: number | null;
        imported: number | null;
        dublicates: number | null;
        namesakes: string[] | null;
        query: string | null;
        createdAt: Date;
        updatedAt: Date;
      },
      recordCountByImportId.get(Number(item.id)) ?? 0,
    ));

  return { count, imports: summaries };
};

export const deleteImportWithRecords = async (importId: number): Promise<DeleteImportResponse> => {
  const importModel = await db.Import.findByPk(importId);
  if (!importModel) {
    throw notFound(`Import ${importId} not found`);
  }

  const deletedRecords = await db.Record.destroy({
    where: { importId },
  });

  await importModel.destroy();

  return {
    importId,
    deletedImport: true,
    deletedRecords,
  };
};
