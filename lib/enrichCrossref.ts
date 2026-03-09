import db from "../models";
import type { CrossrefAuthorDetail, CrossrefReferenceItem } from "../models/types";
import { extractDoiFromRecordUrls, extractDoiFromText, type CrossrefWork } from "./crossref";
import { normalizeDoiValue, toDateOrNull, toPlainObject } from "./enrichmentCommon";
import { enrichForumWithJufo, toForumSnapshot, updateForumFromWork } from "./enrichJufo";
import type { EnrichRecordResult, EnrichmentJobOptions, JobContext } from "./enrichmentTypes";

const CROSSREF_REFRESH_MS = Number.parseInt(
  process.env.CROSSREF_REFRESH_MS ?? String(1000 * 60 * 60 * 24 * 30),
  10,
);
const crossrefReferenceTitleLookupLimitRaw = Number.parseInt(
  process.env.CROSSREF_REFERENCE_TITLE_LOOKUP_MAX ?? "12",
  10,
);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const CROSSREF_REFERENCE_TITLE_LOOKUP_MAX = Number.isFinite(crossrefReferenceTitleLookupLimitRaw)
  ? clamp(crossrefReferenceTitleLookupLimitRaw, 0, 100)
  : 12;

const sanitizeDoi = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const extracted = extractDoiFromText(value);
  if (extracted) {
    return extracted;
  }

  return normalizeDoiValue(value);
};

const shouldRefreshCrossref = (enrichedAt: unknown, forceRefresh: boolean) => {
  if (forceRefresh) {
    return true;
  }

  const enrichedDate = toDateOrNull(enrichedAt);
  if (!enrichedDate) {
    return true;
  }

  const age = Date.now() - enrichedDate.getTime();
  return age > CROSSREF_REFRESH_MS;
};

const normalizeAuthorDetails = (authors: CrossrefWork["author"]): CrossrefAuthorDetail[] => {
  if (!Array.isArray(authors)) {
    return [];
  }

  return authors.map((author) => ({
    given: author.given?.trim() || null,
    family: author.family?.trim() || null,
    name: author.name?.trim() || null,
    sequence: author.sequence?.trim() || null,
    orcid: author.ORCID?.replace(/^https?:\/\/orcid\.org\//i, "").trim() || null,
    affiliations: (author.affiliation ?? [])
      .map((item) => item.name?.trim() || "")
      .filter((item) => item.length > 0),
  }));
};

const formatAuthorDisplay = (authors: CrossrefAuthorDetail[]) => {
  if (authors.length === 0) {
    return null;
  }

  return authors
    .map((author) => {
      if (author.family && author.given) {
        return `${author.family}, ${author.given}`;
      }
      if (author.name) {
        return author.name;
      }
      return [author.given, author.family].filter(Boolean).join(" ").trim();
    })
    .filter((item) => item.length > 0)
    .join("; ");
};

const normalizeReferenceText = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
};

const extractYearFromReferenceText = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const match = value.match(/\b(19|20)\d{2}\b/);
  return match?.[0] ?? null;
};

const buildFallbackReferenceTitle = (reference: {
  author: string | null;
  year: string | null;
  journalTitle: string | null;
  volume: string | null;
  firstPage: string | null;
}) => {
  const details: string[] = [];
  if (reference.journalTitle) {
    details.push(reference.journalTitle);
  }
  if (reference.volume) {
    details.push(`vol. ${reference.volume}`);
  }
  if (reference.firstPage) {
    details.push(`p. ${reference.firstPage}`);
  }
  if (reference.year) {
    details.push(`(${reference.year})`);
  }

  if (reference.author && details.length > 0) {
    return `${reference.author} - ${details.join(", ")}`;
  }
  if (reference.author) {
    return reference.author;
  }
  if (details.length > 0) {
    return details.join(", ");
  }

  return null;
};

const normalizeReferenceItems = (references: CrossrefWork["reference"]): CrossrefReferenceItem[] => {
  if (!Array.isArray(references)) {
    return [];
  }

  return references.map((reference) => {
    const unstructured = normalizeReferenceText(reference.unstructured);
    const author = normalizeReferenceText(reference.author);
    const year = normalizeReferenceText(reference.year) ?? extractYearFromReferenceText(unstructured);
    const journalTitle = normalizeReferenceText(reference["journal-title"]);
    const volume = normalizeReferenceText(reference.volume);
    const firstPage = normalizeReferenceText(reference["first-page"]);
    const articleTitleFromCrossref = normalizeReferenceText(reference["article-title"]);
    const fallbackTitle = buildFallbackReferenceTitle({
      author,
      year,
      journalTitle,
      volume,
      firstPage,
    });
    const articleTitle = articleTitleFromCrossref ?? unstructured ?? fallbackTitle;

    return {
      doi: sanitizeDoi(normalizeReferenceText(reference.DOI)) ?? extractDoiFromText(unstructured),
      key: normalizeReferenceText(reference.key),
      unstructured,
      articleTitle,
      journalTitle,
      author,
      year,
      volume,
      firstPage,
    };
  });
};

const pickFirstNonEmpty = (values: Array<string | null | undefined>) =>
  values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;

const extractWorkYear = (work: CrossrefWork): string | null => {
  const workWithDates = work as CrossrefWork & {
    issued?: { "date-parts"?: Array<Array<number>> };
    "published-print"?: { "date-parts"?: Array<Array<number>> };
    "published-online"?: { "date-parts"?: Array<Array<number>> };
    created?: { "date-parts"?: Array<Array<number>> };
  };

  const candidates = [
    workWithDates.issued?.["date-parts"]?.[0]?.[0],
    workWithDates["published-print"]?.["date-parts"]?.[0]?.[0],
    workWithDates["published-online"]?.["date-parts"]?.[0]?.[0],
    workWithDates.created?.["date-parts"]?.[0]?.[0],
  ];

  const year = candidates.find((value) => Number.isInteger(value) && Number(value) > 0);
  return year ? String(year) : null;
};

const lookupReferenceMetadataByDoi = async (
  doi: string,
  context: JobContext,
) => {
  const normalizedDoi = sanitizeDoi(doi)?.toLocaleLowerCase();
  if (!normalizedDoi) {
    return null;
  }

  const cached = context.referenceMetadataByDoi.get(normalizedDoi);
  if (cached !== undefined) {
    return cached;
  }

  const work = await context.crossrefClient.fetchWorkByDoi(normalizedDoi);
  if (!work) {
    context.referenceMetadataByDoi.set(normalizedDoi, null);
    return null;
  }

  const metadata = {
    articleTitle: pickFirstNonEmpty(work.title ?? []),
    journalTitle: pickFirstNonEmpty([
      ...(work["container-title"] ?? []),
      ...(work["short-container-title"] ?? []),
    ]),
    year: extractWorkYear(work),
  };

  context.referenceMetadataByDoi.set(normalizedDoi, metadata);
  return metadata;
};

const enrichReferenceTitlesByDoi = async (
  referenceItems: CrossrefReferenceItem[],
  context: JobContext,
) => {
  if (CROSSREF_REFERENCE_TITLE_LOOKUP_MAX <= 0 || referenceItems.length === 0) {
    return referenceItems;
  }

  let lookupCount = 0;
  const enriched: CrossrefReferenceItem[] = [];

  for (const item of referenceItems) {
    if (item.articleTitle || !item.doi || lookupCount >= CROSSREF_REFERENCE_TITLE_LOOKUP_MAX) {
      enriched.push(item);
      continue;
    }

    lookupCount += 1;
    let metadata: Awaited<ReturnType<typeof lookupReferenceMetadataByDoi>> = null;
    try {
      metadata = await lookupReferenceMetadataByDoi(item.doi, context);
    } catch {
      metadata = null;
    }

    if (!metadata) {
      enriched.push(item);
      continue;
    }

    enriched.push({
      ...item,
      articleTitle: item.articleTitle ?? metadata.articleTitle,
      journalTitle: item.journalTitle ?? metadata.journalTitle,
      year: item.year ?? metadata.year,
    });
  }

  return enriched;
};

export const enrichRecordWithCrossref = async (
  recordId: number,
  context: JobContext,
  options: Required<EnrichmentJobOptions>,
): Promise<EnrichRecordResult> => {
  const record = await db.Record.findByPk(recordId, { include: ["Forum", "MappingOptions"] });
  if (!record) {
    return {
      result: {
        recordId,
        status: "failed",
        doi: null,
        message: "Record not found",
      },
    };
  }

  if (!shouldRefreshCrossref(record.crossrefEnrichedAt, options.forceRefresh)) {
    const refreshed = await db.Record.findByPk(record.id, { include: ["Forum", "MappingOptions"] });
    return {
      result: {
        recordId,
        status: "skipped",
        doi: sanitizeDoi(record.doi),
        message: "Crossref enrichment is fresh",
      },
      ...(refreshed ? { updatedRecord: toPlainObject(refreshed) } : {}),
    };
  }

  const doiFromUrls = extractDoiFromRecordUrls(record.url, record.alternateUrls);
  const doiFromRecord = sanitizeDoi(record.doi);
  const doiCandidate = doiFromUrls ?? doiFromRecord;
  let work: CrossrefWork | null = null;
  let doiUsed: string | null = doiCandidate;

  if (doiCandidate) {
    work = await context.crossrefClient.fetchWorkByDoi(doiCandidate);
  }

  if (!work && record.title?.trim()) {
    work = await context.crossrefClient.searchWorkByTitleAndAuthor(record.title, record.author);
    doiUsed = sanitizeDoi(work?.DOI) ?? doiUsed;
  }

  if (!work) {
    await record.update({
      crossrefEnrichedAt: new Date(),
      crossrefLastError: "Crossref metadata not found for this record",
    });
    const fallbackForum = toForumSnapshot((record as unknown as { Forum?: unknown }).Forum);
    let jufoMessage: string | null = null;
    try {
      jufoMessage = (await enrichForumWithJufo(fallbackForum, context)).message;
    } catch (error) {
      jufoMessage = error instanceof Error ? error.message : "JUFO lookup failed";
      if (fallbackForum) {
        await fallbackForum.update({
          jufoFetchedAt: new Date(),
          jufoLastError: jufoMessage,
        });
      }
    }
    const refreshed = await db.Record.findByPk(record.id, { include: ["Forum", "MappingOptions"] });

    return {
      result: {
        recordId,
        status: "failed",
        doi: doiUsed,
        message: jufoMessage
          ? `Crossref metadata not found; ${jufoMessage}`
          : "Crossref metadata not found",
      },
      ...(refreshed ? { updatedRecord: toPlainObject(refreshed) } : {}),
    };
  }

  const normalizedDoi = sanitizeDoi(work.DOI) ?? doiUsed;
  const authorDetails = normalizeAuthorDetails(work.author);
  const displayAuthor = formatAuthorDisplay(authorDetails);
  const normalizedReferenceItems = normalizeReferenceItems(work.reference);
  const referenceItems = await enrichReferenceTitlesByDoi(normalizedReferenceItems, context);
  const forum = await updateForumFromWork(
    record as typeof record & { Forum?: Record<string, unknown> | null },
    work,
  );

  const updatePayload: Record<string, unknown> = {
    doi: normalizedDoi,
    authorDetails: authorDetails.length > 0 ? authorDetails : null,
    referenceItems: referenceItems.length > 0 ? referenceItems : null,
    crossrefEnrichedAt: new Date(),
    crossrefLastError: null,
  };

  if (displayAuthor && displayAuthor.trim().length > 0) {
    updatePayload.author = displayAuthor;
  }

  if (forum && record.forumId !== forum.id) {
    updatePayload.forumId = forum.id;
  }

  await record.update(updatePayload);

  let jufoResult: { message: string | null } = { message: null };
  try {
    jufoResult = await enrichForumWithJufo(forum, context);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "JUFO lookup failed";
    if (forum) {
      await forum.update({
        jufoFetchedAt: new Date(),
        jufoLastError: errorMessage,
      });
    }
    jufoResult = { message: errorMessage };
  }
  const refreshed = await db.Record.findByPk(record.id, { include: ["Forum", "MappingOptions"] });

  return {
    result: {
      recordId,
      status: "enriched",
      doi: normalizedDoi,
      ...(jufoResult.message ? { message: jufoResult.message } : {}),
    },
    ...(refreshed ? { updatedRecord: toPlainObject(refreshed) } : {}),
  };
};
