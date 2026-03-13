import type { Request, Response } from "express";
import { Op } from "sequelize";

import { badRequest, notFound, tooManyRequests } from "../lib/http";
import {
  cancelEnrichmentJob,
  createEnrichmentJob,
  getEnrichmentJob,
  getEnrichmentQueueStatus,
} from "../lib/recordEnrichment";
import {
  RECORD_STATUS_VALUES,
  type ExportFormat,
  type ExportScope,
  type EnrichmentMode,
  type EnrichmentJobOptions,
  type EnrichmentProvider,
  type OpenAlexTopicPatchItem,
  type PatchRecordPayload,
  type RecordStatus,
} from "../shared/contracts";
import {
  assertAllowedKeys,
  parseIntegerArray,
  parseInteger,
  parseObject,
  parseOptionalNullableString,
  parseString,
  parseStringArray,
} from "../lib/validation";
import db from "../models";

const VALID_STATUSES: readonly RecordStatus[] = RECORD_STATUS_VALUES;
const VALID_STATUSES_TEXT = ["null", "uncertain", "excluded", "included"] as const;
const VALID_ENRICHMENT_MODES = ["missing", "full"] as const;
const VALID_EXPORT_FORMATS = ["csv", "bibtex"] as const;
const VALID_EXPORT_SCOPES = ["selected", "all_filtered"] as const;
const RECORD_LIST_DEFAULT_MAX = Number.parseInt(process.env.RECORD_LIST_LIMIT_MAX ?? "", 10) || 250;
const ENRICHMENT_MAX_RECORDS_PER_JOB = Number.parseInt(process.env.ENRICHMENT_MAX_RECORDS_PER_JOB ?? "", 10) || 500;
const LIST_RECORD_ATTRIBUTES = [
  "id",
  "title",
  "url",
  "author",
  "year",
  "status",
  "abstract",
  "databases",
  "alternateUrls",
  "enrichmentProvenance",
  "forumId",
  "doi",
  "citationCount",
  "resolvedBy",
  "resolvedByUserId",
  "comment",
  "crossrefEnrichedAt",
  "crossrefLastError",
  "openAlexId",
  "openAlexEnrichedAt",
  "openAlexLastError",
  "openAlexTopicItems",
  "createdAt",
  "updatedAt",
] as const;

const TOPIC_PATCH_ALLOWED_KEYS = [
  "id",
  "displayName",
  "score",
  "subfield",
  "field",
  "domain",
] as const;

const CSV_EXPORT_FIELD_LABELS: Record<string, string> = {
  id: "ID",
  title: "Title",
  author: "Author",
  year: "Year",
  status: "Status",
  abstract: "Abstract",
  comment: "Comment",
  doi: "DOI",
  url: "URL",
  alternateUrls: "Alternate URLs",
  databases: "Databases",
  forumName: "Forum Name",
  forumIssn: "Forum ISSN",
  forumPublisher: "Forum Publisher",
  forumJufoLevel: "Forum Jufo Level",
  citationCount: "Citation Count",
  referenceCount: "Reference Count",
  topicNames: "Topic Names",
  createdAt: "Created At",
  updatedAt: "Updated At",
};

const BIBTEX_EXPORT_FIELDS = [
  "title",
  "author",
  "year",
  "journal",
  "publisher",
  "issn",
  "doi",
  "url",
  "abstract",
  "keywords",
  "note",
] as const;

const CSV_EXPORT_BASE_FIELDS = Object.keys(CSV_EXPORT_FIELD_LABELS);
const CSV_EXPORT_BASE_FIELD_SET = new Set<string>(CSV_EXPORT_BASE_FIELDS);
const BIBTEX_EXPORT_FIELD_SET = new Set<string>(BIBTEX_EXPORT_FIELDS);

const MAPPING_EXPORT_FIELD_PREFIX = "mappingQuestion:";
const EXPORT_RECORD_INCLUDE = [
  {
    association: "Forum",
    attributes: ["id", "name", "issn", "publisher", "jufoLevel"],
  },
  {
    association: "MappingOptions",
    attributes: ["id", "title", "mappingQuestionId"],
    through: { attributes: [] as string[] },
  },
];

const parseBooleanQuery = (value: unknown, key: string): boolean => {
  const raw = parseString(value, key, { optional: true, trim: true });
  if (raw === undefined || raw.length === 0) {
    return false;
  }
  if (raw === "1" || raw.toLocaleLowerCase() === "true") {
    return true;
  }
  if (raw === "0" || raw.toLocaleLowerCase() === "false") {
    return false;
  }
  throw badRequest(`${key} must be one of: 1, 0, true, false`);
};

const parseStatusQuery = (value: unknown): RecordStatus | undefined => {
  const status = parseString(value, "status", { optional: true, trim: true });
  if (status === undefined || status.length === 0) {
    return undefined;
  }

  if (status === "null") {
    return null;
  }

  if (VALID_STATUSES.includes(status as RecordStatus)) {
    return status as RecordStatus;
  }

  throw badRequest(`status must be one of: ${VALID_STATUSES_TEXT.join(", ")}`);
};

const parseImportIdQuery = (value: unknown): number | undefined => {
  const importId = parseString(value, "importId", { optional: true, trim: true });
  if (importId === undefined || importId.length === 0) {
    return undefined;
  }

  return parseInteger(importId, "importId", { min: 1 });
};

const parseSearch = (value: unknown, key = "search"): string | undefined =>
  parseString(value, key, {
    optional: true,
    trim: true,
    maxLength: 500,
  });

const parseImportIdFilter = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return parseInteger(value, "filters.importId", { min: 1 });
};

const buildRecordWhere = ({
  status,
  importId,
  search,
}: {
  status?: RecordStatus;
  importId?: number;
  search?: string;
}) => {
  const where: Record<PropertyKey, unknown> = {};

  if (status !== undefined) {
    where.status = status;
  }

  if (importId !== undefined) {
    where.importId = importId;
  }

  if (search !== undefined && search.length > 0) {
    where[Op.or] = [
      { comment: { [Op.substring]: search } },
      { title: { [Op.substring]: search } },
      { author: { [Op.substring]: search } },
      { databases: { [Op.substring]: search } },
    ];
  }

  return where;
};

const parseExportFormat = (value: unknown): ExportFormat => {
  const format = parseString(value, "format", { trim: true, allowEmpty: false });
  if (format === undefined || !VALID_EXPORT_FORMATS.includes(format as ExportFormat)) {
    throw badRequest(`format must be one of: ${VALID_EXPORT_FORMATS.join(", ")}`);
  }
  return format as ExportFormat;
};

const parseExportScope = (value: unknown): ExportScope => {
  const scope = parseString(value, "scope", { trim: true, allowEmpty: false });
  if (scope === undefined || !VALID_EXPORT_SCOPES.includes(scope as ExportScope)) {
    throw badRequest(`scope must be one of: ${VALID_EXPORT_SCOPES.join(", ")}`);
  }
  return scope as ExportScope;
};

const parseExportFields = (value: unknown): string[] => {
  const fields = parseStringArray(value, "fields", {
    trim: true,
    allowEmptyItems: false,
    maxItemLength: 120,
    maxItems: 500,
  });

  if (!fields || fields.length === 0) {
    throw badRequest("fields must contain at least one field");
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const field of fields) {
    if (seen.has(field)) {
      continue;
    }
    seen.add(field);
    deduped.push(field);
  }

  return deduped;
};

const parseExportFilters = (value: unknown) => {
  const filters = parseObject(value, "filters");
  assertAllowedKeys(filters, ["status", "search", "importId"], "filters");

  const status = parseStatusQuery(filters.status);
  const search = parseSearch(filters.search, "filters.search");
  const importId = parseImportIdFilter(filters.importId);

  return { status, search, importId };
};

const parseExportMappingQuestionIds = (fields: string[]) => {
  const ids: number[] = [];
  for (const field of fields) {
    if (!field.startsWith(MAPPING_EXPORT_FIELD_PREFIX)) {
      continue;
    }

    const idText = field.slice(MAPPING_EXPORT_FIELD_PREFIX.length);
    const id = Number.parseInt(idText, 10);
    if (!Number.isInteger(id) || id <= 0) {
      throw badRequest(`Invalid mapping export field: ${field}`);
    }
    ids.push(id);
  }

  return [...new Set(ids)];
};

const csvEscape = (value: string) => {
  const escaped = value.replaceAll("\"", "\"\"");
  return `"${escaped}"`;
};

const toCsv = (rows: string[][]) =>
  rows
    .map((row) => row.map((value) => csvEscape(value)).join(","))
    .join("\n");

const joinArrayField = (value: unknown) => {
  if (!Array.isArray(value)) {
    return "";
  }
  return value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0)
    .join("; ");
};

const getTopicNames = (record: Record<string, unknown>) => {
  const topicItems = Array.isArray(record.openAlexTopicItems) ? record.openAlexTopicItems : [];
  if (topicItems.length === 0) {
    return "";
  }

  return topicItems
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }
      const displayName = (item as Record<string, unknown>).displayName;
      return typeof displayName === "string" ? displayName.trim() : "";
    })
    .filter((item) => item.length > 0)
    .join("; ");
};

const getReferenceCount = (record: Record<string, unknown>) => {
  if (typeof record.referenceCount === "number") {
    return String(record.referenceCount);
  }
  if (Array.isArray(record.referenceItems)) {
    return String(record.referenceItems.length);
  }
  return "";
};

const getCitationCount = (record: Record<string, unknown>) => {
  if (typeof record.citationCount === "number") {
    return String(record.citationCount);
  }
  if (Array.isArray(record.openAlexCitationItems)) {
    return String(record.openAlexCitationItems.length);
  }
  return "";
};

const getForum = (record: Record<string, unknown>) => {
  const forum = record.Forum;
  if (!forum || typeof forum !== "object") {
    return null;
  }
  return forum as Record<string, unknown>;
};

const getMappingValue = (record: Record<string, unknown>, questionId: number) => {
  const options = Array.isArray(record.MappingOptions) ? record.MappingOptions : [];
  return options
    .filter((option) => option && typeof option === "object")
    .filter((option) => (option as Record<string, unknown>).mappingQuestionId === questionId)
    .map((option) => (option as Record<string, unknown>).title)
    .filter((title): title is string => typeof title === "string" && title.trim().length > 0)
    .join("; ");
};

const getCsvFieldValue = (record: Record<string, unknown>, field: string) => {
  if (field.startsWith(MAPPING_EXPORT_FIELD_PREFIX)) {
    const questionId = Number.parseInt(field.slice(MAPPING_EXPORT_FIELD_PREFIX.length), 10);
    if (!Number.isInteger(questionId) || questionId <= 0) {
      return "";
    }
    return getMappingValue(record, questionId);
  }

  const forum = getForum(record);
  switch (field) {
    case "id":
      return record.id === undefined ? "" : String(record.id);
    case "title":
    case "author":
    case "abstract":
    case "comment":
    case "doi":
    case "url":
    case "createdAt":
    case "updatedAt":
      return record[field] === undefined || record[field] === null ? "" : String(record[field]);
    case "year":
      return typeof record.year === "number" ? String(record.year) : "";
    case "status":
      return record.status === null ? "null" : (record.status ? String(record.status) : "");
    case "alternateUrls":
    case "databases":
      return joinArrayField(record[field]);
    case "forumName":
      return forum && typeof forum.name === "string" ? forum.name : "";
    case "forumIssn":
      return forum && typeof forum.issn === "string" ? forum.issn : "";
    case "forumPublisher":
      return forum && typeof forum.publisher === "string" ? forum.publisher : "";
    case "forumJufoLevel":
      return forum && typeof forum.jufoLevel === "number" ? String(forum.jufoLevel) : "";
    case "citationCount":
      return getCitationCount(record);
    case "referenceCount":
      return getReferenceCount(record);
    case "topicNames":
      return getTopicNames(record);
    default:
      return "";
  }
};

const bibtexEscape = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("\n", " ");

const makeCitationKey = (record: Record<string, unknown>) => {
  const rawAuthor = typeof record.author === "string" ? record.author : "record";
  const firstAuthor = rawAuthor.split(/[;,]/)[0]?.trim() || "record";
  const surname = firstAuthor.split(/\s+/).slice(-1)[0] || "record";
  const normalizedSurname = surname.replace(/[^A-Za-z0-9]/g, "").toLowerCase() || "record";
  const year = typeof record.year === "number" ? String(record.year) : "nd";
  const id = record.id === undefined ? "" : String(record.id);
  return `${normalizedSurname}${year}${id.length > 0 ? `_${id}` : ""}`;
};

const getBibtexFieldValue = (record: Record<string, unknown>, field: string) => {
  const forum = getForum(record);
  switch (field) {
    case "title":
    case "author":
    case "doi":
    case "url":
    case "abstract":
      return typeof record[field] === "string" ? record[field] : "";
    case "year":
      return typeof record.year === "number" ? String(record.year) : "";
    case "journal":
      return forum && typeof forum.name === "string" ? forum.name : "";
    case "publisher":
      return forum && typeof forum.publisher === "string" ? forum.publisher : "";
    case "issn":
      return forum && typeof forum.issn === "string" ? forum.issn : "";
    case "keywords":
      return getTopicNames(record);
    case "note":
      return typeof record.comment === "string" ? record.comment : "";
    default:
      return "";
  }
};

const toBibtex = (records: Array<Record<string, unknown>>, fields: string[]) =>
  records
    .map((record) => {
      const citationKey = makeCitationKey(record);
      const lines = [`@article{${citationKey},`];

      for (const field of fields) {
        const value = getBibtexFieldValue(record, field);
        if (value.length === 0) {
          continue;
        }
        lines.push(`  ${field} = {${bibtexEscape(value)}},`);
      }

      lines.push("}");
      return lines.join("\n");
    })
    .join("\n\n");

const makeExportFileName = (extension: "csv" | "bib") => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `records-export-${stamp}.${extension}`;
};

const toPlainObject = <T extends Record<string, unknown>>(value: unknown): T => {
  if (value && typeof value === "object") {
    const maybeGet = (value as { get?: unknown }).get;
    if (typeof maybeGet === "function") {
      return maybeGet.call(value, { plain: true }) as T;
    }
  }
  return value as T;
};

const parseMappingQuestionFieldId = (field: string): number | null => {
  if (!field.startsWith(MAPPING_EXPORT_FIELD_PREFIX)) {
    return null;
  }
  const id = Number.parseInt(field.slice(MAPPING_EXPORT_FIELD_PREFIX.length), 10);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
};

const getCsvFieldLabel = (
  field: string,
  mappingQuestionTitles: Map<number, string>,
) => {
  const mappingQuestionId = parseMappingQuestionFieldId(field);
  if (mappingQuestionId !== null) {
    return mappingQuestionTitles.get(mappingQuestionId) ?? `Mapping Question ${mappingQuestionId}`;
  }
  return CSV_EXPORT_FIELD_LABELS[field] ?? field;
};

const validateExportFields = async (
  format: ExportFormat,
  fields: string[],
) => {
  const mappingQuestionTitles = new Map<number, string>();
  const mappingQuestionIds = parseExportMappingQuestionIds(fields);

  if (format === "bibtex") {
    if (mappingQuestionIds.length > 0) {
      throw badRequest("BibTeX export does not support mapping question fields");
    }

    for (const field of fields) {
      if (!BIBTEX_EXPORT_FIELD_SET.has(field)) {
        throw badRequest(`Unsupported BibTeX export field: ${field}`);
      }
    }

    return mappingQuestionTitles;
  }

  for (const field of fields) {
    if (field.startsWith(MAPPING_EXPORT_FIELD_PREFIX)) {
      continue;
    }
    if (!CSV_EXPORT_BASE_FIELD_SET.has(field)) {
      throw badRequest(`Unsupported CSV export field: ${field}`);
    }
  }

  if (mappingQuestionIds.length === 0) {
    return mappingQuestionTitles;
  }

  const mappingQuestions = await db.MappingQuestion.findAll({
    where: { id: mappingQuestionIds },
    attributes: ["id", "title"],
  });

  for (const question of mappingQuestions) {
    const plain = toPlainObject<Record<string, unknown>>(question);
    const idValue = plain.id;
    const id = typeof idValue === "number" ? idValue : Number.parseInt(String(idValue), 10);
    if (!Number.isInteger(id) || id <= 0) {
      continue;
    }
    const title =
      typeof plain.title === "string" && plain.title.trim().length > 0
        ? plain.title.trim()
        : `Mapping Question ${id}`;
    mappingQuestionTitles.set(id, title);
  }

  const missing = mappingQuestionIds.filter((id) => !mappingQuestionTitles.has(id));
  if (missing.length > 0) {
    throw badRequest("Unknown mapping export fields", { missingMappingQuestionIds: missing });
  }

  return mappingQuestionTitles;
};

const parseStatusBody = (value: unknown): RecordStatus | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw badRequest("status must be a string or null");
  }

  if (VALID_STATUSES.includes(value as RecordStatus)) {
    return value as RecordStatus;
  }

  throw badRequest(`status must be one of: ${VALID_STATUSES_TEXT.join(", ")}`);
};

const parseStatusRequired = (value: unknown): RecordStatus => {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw badRequest("status must be a string or null");
  }

  if (VALID_STATUSES.includes(value as RecordStatus)) {
    return value as RecordStatus;
  }

  throw badRequest(`status must be one of: ${VALID_STATUSES_TEXT.join(", ")}`);
};

const parseTopicScore = (value: unknown, fieldName: string): number | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw badRequest(`${fieldName} must be a number or null`);
  }
  if (value < 0 || value > 1) {
    throw badRequest(`${fieldName} must be between 0 and 1`);
  }
  return value;
};

const parseOpenAlexTopicItems = (value: unknown): OpenAlexTopicPatchItem[] | null => {
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw badRequest("openAlexTopicItems must be an array or null");
  }
  if (value.length > 200) {
    throw badRequest("openAlexTopicItems must have at most 200 items");
  }

  const topics: OpenAlexTopicPatchItem[] = [];
  const seen = new Set<string>();

  for (const [index, item] of value.entries()) {
    const topic = parseObject(item, `openAlexTopicItems[${index}]`);
    assertAllowedKeys(topic, TOPIC_PATCH_ALLOWED_KEYS, `openAlexTopicItems[${index}]`);

    const displayName = parseString(topic.displayName, `openAlexTopicItems[${index}].displayName`, {
      trim: true,
      allowEmpty: false,
      maxLength: 500,
    });
    if (displayName === undefined) {
      throw badRequest(`openAlexTopicItems[${index}].displayName is required`);
    }
    const key = displayName.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const id = parseString(topic.id, `openAlexTopicItems[${index}].id`, {
      optional: true,
      trim: true,
      allowEmpty: false,
      maxLength: 300,
    });
    const score = parseTopicScore(topic.score, `openAlexTopicItems[${index}].score`);
    const subfield = parseString(topic.subfield, `openAlexTopicItems[${index}].subfield`, {
      optional: true,
      trim: true,
      allowEmpty: false,
      maxLength: 300,
    });
    const field = parseString(topic.field, `openAlexTopicItems[${index}].field`, {
      optional: true,
      trim: true,
      allowEmpty: false,
      maxLength: 300,
    });
    const domain = parseString(topic.domain, `openAlexTopicItems[${index}].domain`, {
      optional: true,
      trim: true,
      allowEmpty: false,
      maxLength: 300,
    });

    topics.push({
      displayName,
      id: id ?? null,
      score,
      subfield: subfield ?? null,
      field: field ?? null,
      domain: domain ?? null,
    });
  }

  return topics;
};

export const listing = async (req: Request, res: Response) => {
  const offset = parseInteger(req.query.offset, "offset", { defaultValue: 0, min: 0 });
  const limit = parseInteger(req.query.limit, "limit", {
    defaultValue: 25,
    min: 1,
    max: RECORD_LIST_DEFAULT_MAX,
  });
  const status = parseStatusQuery(req.query.status);
  const importId = parseImportIdQuery(req.query.importId);
  const withDetails = parseBooleanQuery(req.query.withDetails, "withDetails");
  const search = parseString(req.query.search, "search", {
    optional: true,
    trim: true,
    maxLength: 500,
  });

  const where: Record<PropertyKey, unknown> = {};

  if (status !== undefined) {
    where.status = status;
  }

  if (importId !== undefined) {
    where.importId = importId;
  }

  if (search !== undefined && search.length > 0) {
    where[Op.or] = [
      { comment: { [Op.substring]: search } },
      { title: { [Op.substring]: search } },
      { author: { [Op.substring]: search } },
      { databases: { [Op.substring]: search } },
    ];
  }

  const [count, records] = await Promise.all([
    db.Record.count({ where }),
    db.Record.findAll({
      offset,
      limit,
      where,
      attributes: withDetails
        ? undefined
        : [
          ...LIST_RECORD_ATTRIBUTES,
          [
            db.Sequelize.fn(
              "COALESCE",
              db.Sequelize.fn("json_array_length", db.Sequelize.col("referenceItems")),
              0,
            ),
            "referenceCount",
          ],
          [
            db.Sequelize.fn(
              "COALESCE",
              db.Sequelize.fn("json_array_length", db.Sequelize.col("openAlexTopicItems")),
              0,
            ),
            "topicCount",
          ],
        ],
      include: [
        {
          association: "Forum",
          attributes: withDetails
            ? undefined
            : [
              "id",
              "name",
              "jufoLevel",
              "issn",
              "publisher",
              "jufoFetchedAt",
              "jufoLastError",
              "enrichmentProvenance",
            ],
        },
        {
          association: "MappingOptions",
          attributes: withDetails
            ? undefined
            : ["id", "title", "color", "mappingQuestionId"],
          through: { attributes: [] },
        },
      ],
    }),
  ]);

  return res.send({ count, records });
};

export const exportRecords = async (req: Request, res: Response) => {
  const body = parseObject(req.body, "body");
  assertAllowedKeys(body, ["format", "scope", "fields", "recordIds", "filters"], "export body");

  const format = parseExportFormat(body.format);
  const scope = parseExportScope(body.scope);
  const fields = parseExportFields(body.fields);
  const mappingQuestionTitles = await validateExportFields(format, fields);

  let where: Record<PropertyKey, unknown>;
  if (scope === "selected") {
    const recordIds = parseIntegerArray(body.recordIds, "recordIds", {
      min: 1,
      minItems: 1,
      maxItems: 50000,
    });
    if (!recordIds || recordIds.length === 0) {
      throw badRequest("recordIds are required when scope is selected");
    }
    where = { id: [...new Set(recordIds)] };
  } else {
    const filters = parseExportFilters(body.filters);
    where = buildRecordWhere(filters);
  }

  const records = await db.Record.findAll({
    where,
    include: EXPORT_RECORD_INCLUDE,
    order: [["id", "ASC"]],
  });
  const plainRecords = records.map((record) => toPlainObject<Record<string, unknown>>(record));

  if (format === "csv") {
    const headerRow = fields.map((field) => getCsvFieldLabel(field, mappingQuestionTitles));
    const dataRows = plainRecords.map((record) => fields.map((field) => getCsvFieldValue(record, field)));
    const csv = toCsv([headerRow, ...dataRows]);
    const fileName = makeExportFileName("csv");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(csv);
  }

  const bibtex = toBibtex(plainRecords, fields);
  const fileName = makeExportFileName("bib");

  res.setHeader("Content-Type", "application/x-bibtex; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  return res.send(bibtex);
};

export const get = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.id, "id", { min: 1 });

  const record = await db.Record.findByPk(id, { include: ["Forum", "MappingOptions"] });
  if (!record) {
    throw notFound(`Record ${id} not found`);
  }

  return res.send(record);
};

// only enable updating review fields of the record
export const update = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.id, "id", { min: 1 });
  const body = parseObject(req.body, "body");

  assertAllowedKeys(
    body,
    ["status", "resolvedBy", "resolvedByUserId", "comment", "MappingOptions"],
    "record update body",
  );

  const status = parseStatusBody(body.status);
  const resolvedBy = parseOptionalNullableString(body.resolvedBy, "resolvedBy", {
    trim: true,
    maxLength: 120,
  });
  const resolvedByUserId = body.resolvedByUserId === undefined
    ? undefined
    : body.resolvedByUserId === null
      ? null
      : parseInteger(body.resolvedByUserId, "resolvedByUserId", { min: 1 });
  const comment = parseOptionalNullableString(body.comment, "comment", {
    trim: false,
    maxLength: 10000,
  });

  const record = await db.Record.findByPk(id, { include: ["Forum", "MappingOptions"] });
  if (!record) {
    throw notFound(`Record ${id} not found`);
  }

  await record.update({
    ...(status !== undefined ? { status } : {}),
    ...(comment !== undefined ? { comment } : {}),
    ...(body.MappingOptions !== undefined ? { MappingOptions: body.MappingOptions } : {}),
    ...(resolvedBy !== undefined ? { resolvedBy } : {}),
    ...(resolvedByUserId !== undefined ? { resolvedByUserId } : {}),
  });

  return res.send(record);
};

export const patch = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.id, "id", { min: 1 });
  const body = parseObject(req.body, "body");

  assertAllowedKeys(
    body,
    [
      "title",
      "author",
      "url",
      "year",
      "status",
      "comment",
      "abstract",
      "databases",
      "alternateUrls",
      "openAlexTopicItems",
      "resolvedBy",
      "resolvedByUserId",
    ],
    "record patch body",
  );

  const updates: PatchRecordPayload = {};

  if ("title" in body) {
    updates.title = parseString(body.title, "title", { trim: true, allowEmpty: false, maxLength: 500 });
  }

  if ("author" in body) {
    updates.author = parseString(body.author, "author", {
      trim: true,
      allowEmpty: false,
      maxLength: 500,
    });
  }

  if ("url" in body) {
    updates.url = parseString(body.url, "url", { trim: true, allowEmpty: false, maxLength: 2000 });
  }

  if ("year" in body) {
    if (body.year === null) {
      updates.year = null;
    } else {
      updates.year = parseInteger(body.year, "year", { min: 1000, max: 3000 });
    }
  }

  if ("status" in body) {
    updates.status = parseStatusRequired(body.status);
  }

  if ("comment" in body) {
    const value = parseOptionalNullableString(body.comment, "comment", {
      trim: false,
      maxLength: 10000,
    });
    if (value === undefined) {
      throw badRequest("comment is required");
    }
    updates.comment = value;
  }

  if ("abstract" in body) {
    const value = parseOptionalNullableString(body.abstract, "abstract", {
      trim: false,
      maxLength: 20000,
    });
    if (value === undefined) {
      throw badRequest("abstract is required");
    }
    updates.abstract = value;
  }

  if ("databases" in body) {
    updates.databases = parseStringArray(body.databases, "databases", {
      trim: true,
      allowEmptyItems: false,
      maxItemLength: 500,
      maxItems: 200,
    });
  }

  if ("alternateUrls" in body) {
    updates.alternateUrls = parseStringArray(body.alternateUrls, "alternateUrls", {
      trim: true,
      allowEmptyItems: false,
      maxItemLength: 2000,
      maxItems: 200,
    });
  }

  if ("openAlexTopicItems" in body) {
    updates.openAlexTopicItems = parseOpenAlexTopicItems(body.openAlexTopicItems);
  }

  if ("resolvedBy" in body) {
    const value = parseOptionalNullableString(body.resolvedBy, "resolvedBy", {
      trim: true,
      maxLength: 120,
    });
    if (value === undefined) {
      throw badRequest("resolvedBy is required");
    }
    updates.resolvedBy = value;
  }

  if ("resolvedByUserId" in body) {
    if (body.resolvedByUserId === null) {
      updates.resolvedByUserId = null;
    } else {
      updates.resolvedByUserId = parseInteger(body.resolvedByUserId, "resolvedByUserId", {
        min: 1,
      });
    }
  }

  if (Object.keys(updates).length === 0) {
    throw badRequest("record patch body must contain at least one supported field");
  }

  const record = await db.Record.findByPk(id, { include: ["Forum", "MappingOptions"] });
  if (!record) {
    throw notFound(`Record ${id} not found`);
  }

  await record.update(updates);
  return res.send(record);
};

export const createOption = async (req: Request, res: Response) => {
  const recordId = parseInteger(req.params.recordId, "recordId", { min: 1 });
  const body = parseObject(req.body, "body");

  assertAllowedKeys(body, ["mappingOptionId", "mappingQuestionId"], "record mapping option body");

  const mappingOptionId = parseInteger(body.mappingOptionId, "mappingOptionId", { min: 1 });
  const mappingQuestionId = parseInteger(body.mappingQuestionId, "mappingQuestionId", { min: 1 });
  const [record, question, option] = await Promise.all([
    db.Record.findByPk(recordId),
    db.MappingQuestion.findByPk(mappingQuestionId),
    db.MappingOption.findByPk(mappingOptionId),
  ]);

  if (!record) {
    throw notFound(`Record ${recordId} not found`);
  }

  if (!question) {
    throw notFound(`MappingQuestion ${mappingQuestionId} not found`);
  }

  if (!option) {
    throw notFound(`MappingOption ${mappingOptionId} not found`);
  }

  if (option.mappingQuestionId !== mappingQuestionId) {
    throw badRequest(
      `MappingOption ${mappingOptionId} does not belong to MappingQuestion ${mappingQuestionId}`,
    );
  }

  const existing = await db.RecordMappingOption.findOne({
    where: { recordId, mappingOptionId },
  });

  if (!existing) {
    await db.RecordMappingOption.create({
      recordId,
      mappingQuestionId,
      mappingOptionId,
    });
  }

  return res.send(option);
};

export const removeOption = async (req: Request, res: Response) => {
  const mappingOptionId = parseInteger(req.params.mappingOptionId, "mappingOptionId", { min: 1 });
  const recordId = parseInteger(req.params.recordId, "recordId", { min: 1 });

  await db.RecordMappingOption.destroy({
    where: { mappingOptionId, recordId },
  });

  return res.send(`${mappingOptionId} deleted successfully`);
};

export const createEnrichment = async (req: Request, res: Response) => {
  const queue = getEnrichmentQueueStatus();
  if (queue.queuedJobs >= queue.maxQueuedJobs) {
    throw tooManyRequests("Enrichment queue is full. Please wait for existing jobs to complete.", queue);
  }

  const body = parseObject(req.body, "body");
  assertAllowedKeys(
    body,
    ["recordIds", "provider", "mode", "maxCitations", "forceRefresh"],
    "enrichment job body",
  );

  const recordIds = parseIntegerArray(body.recordIds, "recordIds", {
    min: 1,
    minItems: 1,
    maxItems: ENRICHMENT_MAX_RECORDS_PER_JOB,
  });
  if (!recordIds) {
    throw badRequest("recordIds are required");
  }

  const provider = parseString(body.provider, "provider", {
    optional: true,
    trim: true,
    allowEmpty: false,
    maxLength: 20,
  });
  const validProviders: EnrichmentProvider[] = ["crossref", "openalex", "all"];
  if (provider !== undefined && !validProviders.includes(provider as EnrichmentProvider)) {
    throw badRequest("provider must be one of: crossref, openalex, all");
  }

  const mode = parseString(body.mode, "mode", {
    optional: true,
    trim: true,
    allowEmpty: false,
    maxLength: 20,
  });
  if (mode !== undefined && !VALID_ENRICHMENT_MODES.includes(mode as EnrichmentMode)) {
    throw badRequest("mode must be one of: missing, full");
  }

  const maxCitations = body.maxCitations === undefined
    ? undefined
    : parseInteger(body.maxCitations, "maxCitations", {
      min: 0,
      max: 50000,
    });

  const forceRefreshRaw = body.forceRefresh;
  if (forceRefreshRaw !== undefined && typeof forceRefreshRaw !== "boolean") {
    throw badRequest("forceRefresh must be a boolean");
  }
  const forceRefresh = forceRefreshRaw === true;

  const jobPayload: EnrichmentJobOptions = {
    ...(provider !== undefined ? { provider: provider as EnrichmentProvider } : {}),
    ...(mode !== undefined ? { mode: mode as EnrichmentMode } : {}),
    ...(maxCitations !== undefined ? { maxCitations } : {}),
    forceRefresh,
  };

  const job = createEnrichmentJob(recordIds, jobPayload);
  return res.status(202).send(job);
};

export const getEnrichment = async (req: Request, res: Response) => {
  const jobId = parseString(req.params.jobId, "jobId", {
    trim: true,
    allowEmpty: false,
    maxLength: 120,
  });
  if (!jobId) {
    throw badRequest("jobId is required");
  }

  const compact = parseBooleanQuery(req.query.compact, "compact");
  const resultCursor = parseInteger(req.query.resultCursor, "resultCursor", {
    defaultValue: 0,
    min: 0,
  });
  const updatedCursor = parseInteger(req.query.updatedCursor, "updatedCursor", {
    defaultValue: 0,
    min: 0,
  });

  const job = getEnrichmentJob(jobId, {
    compact,
    resultCursor,
    updatedCursor,
  });
  if (!job) {
    throw notFound(`Enrichment job ${jobId} not found`);
  }

  return res.send(job);
};

export const cancelEnrichment = async (req: Request, res: Response) => {
  const jobId = parseString(req.params.jobId, "jobId", {
    trim: true,
    allowEmpty: false,
    maxLength: 120,
  });
  if (!jobId) {
    throw badRequest("jobId is required");
  }

  const job = cancelEnrichmentJob(jobId);
  if (!job) {
    throw notFound(`Enrichment job ${jobId} not found`);
  }

  return res.send(job);
};
