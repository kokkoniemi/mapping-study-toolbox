import db from "../models";
import type { CrossrefAuthorDetail, CrossrefReferenceItem } from "../models/types";
import {
  extractAbstractFromWork,
  extractDoiFromRecordUrls,
  extractDoiFromText,
  extractWorkYear,
  type CrossrefWork,
} from "./crossref";
import { decodeHtmlEntities, normalizeDoiValue, toPlainObject } from "./enrichmentCommon";
import { buildFieldProvenance, mergeProvenance } from "./enrichmentProvenance";
import { enrichForumWithJufo, toForumSnapshot, updateForumFromWork } from "./enrichJufo";
import type { EnrichRecordResult, EnrichmentJobOptions, JobContext } from "./enrichmentTypes";
import type { EnrichmentMode, EnrichmentProvenanceMap } from "../shared/contracts";

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

const getEffectiveMode = (options: Required<EnrichmentJobOptions>): EnrichmentMode =>
  options.forceRefresh ? "full" : options.mode;

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

  const normalized = decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
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

  const workYear = extractWorkYear(work);
  const metadata = {
    articleTitle: pickFirstNonEmpty(work.title ?? []),
    journalTitle: pickFirstNonEmpty([
      ...(work["container-title"] ?? []),
      ...(work["short-container-title"] ?? []),
    ]),
    year: workYear ? String(workYear) : null,
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

const getMissingCrossrefTargets = (record: {
  doi?: string | null;
  url?: string | null;
  abstract?: string | null;
  year?: number | null;
  forumId?: number | null;
  authorDetails?: unknown[] | null;
  referenceItems?: unknown[] | null;
  Forum?: {
    name?: string | null;
    publisher?: string | null;
    issn?: string | null;
  } | null;
}): string[] => {
  const missing: string[] = [];

  if (!sanitizeDoi(record.doi)) {
    missing.push("doi");
  }
  if (!record.url || record.url.trim().length === 0) {
    missing.push("url");
  }
  if (!record.abstract || record.abstract.trim().length === 0) {
    missing.push("abstract");
  }
  if (!record.year) {
    missing.push("year");
  }
  if (!Array.isArray(record.authorDetails) || record.authorDetails.length === 0) {
    missing.push("authorDetails");
  }
  if (!Array.isArray(record.referenceItems) || record.referenceItems.length === 0) {
    missing.push("referenceItems");
  }
  if (!record.forumId) {
    missing.push("forumId");
  }

  const forum = record.Forum;
  if (!forum?.name || !forum.publisher || !forum.issn) {
    missing.push("forumDetails");
  }

  return missing;
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

  const mode = getEffectiveMode(options);
  const missingTargets = getMissingCrossrefTargets(record as typeof record & { Forum?: Record<string, unknown> | null });
  if (mode === "missing" && missingTargets.length === 0) {
    const refreshed = await db.Record.findByPk(record.id, { include: ["Forum", "MappingOptions"] });
    return {
      result: {
        recordId,
        status: "skipped",
        doi: sanitizeDoi(record.doi),
        message: "Crossref missing-only mode: no missing targets",
      },
      ...(refreshed ? { updatedRecord: toPlainObject(refreshed) } : {}),
    };
  }

  const doiFromUrls = extractDoiFromRecordUrls(record.url, record.alternateUrls);
  const doiFromRecord = sanitizeDoi(record.doi);
  const doiCandidate = doiFromUrls ?? doiFromRecord;
  let work: CrossrefWork | null = null;
  let doiUsed: string | null = doiCandidate;
  let resolvedBy: "doi" | "search" | null = null;

  if (doiCandidate) {
    work = await context.crossrefClient.fetchWorkByDoi(doiCandidate);
    if (work) {
      resolvedBy = "doi";
    }
  }

  if (!work && record.title?.trim()) {
    work = await context.crossrefClient.searchWorkByTitleAndAuthor(
      record.title,
      record.author,
      typeof record.year === "number" ? record.year : null,
    );
    doiUsed = sanitizeDoi(work?.DOI) ?? doiUsed;
    if (work) {
      resolvedBy = "search";
    }
  }

  if (!work) {
    await record.update({
      crossrefEnrichedAt: new Date(),
      crossrefLastError: "Crossref metadata not found for this record",
    });
    const fallbackForum = toForumSnapshot((record as unknown as { Forum?: unknown }).Forum);
    let jufoMessage: string | null = null;
    try {
      jufoMessage = (await enrichForumWithJufo(fallbackForum, context, options)).message;
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
  const crossrefAbstract = extractAbstractFromWork(work);
  const authorDetails = normalizeAuthorDetails(work.author);
  const displayAuthor = formatAuthorDisplay(authorDetails);
  const normalizedReferenceItems = normalizeReferenceItems(work.reference);
  const referenceItems = await enrichReferenceTitlesByDoi(normalizedReferenceItems, context);
  const workYear = extractWorkYear(work);
  const source = normalizedDoi ?? work.URL?.trim() ?? null;
  const matchScore = resolvedBy === "doi"
    ? 98
    : workYear && record.year && Math.abs(workYear - record.year) <= 1
      ? 90
      : 84;
  const reason =
    resolvedBy === "doi"
      ? "Crossref metadata resolved by DOI"
      : "Crossref metadata resolved by title/author search";
  const forum = await updateForumFromWork(
    record as typeof record & { Forum?: Record<string, unknown> | null },
    work,
    {
      mode,
      confidenceScore: matchScore,
      reason,
      source,
    },
  );
  const provenanceUpdates: EnrichmentProvenanceMap = {};

  const updatePayload: Record<string, unknown> = {
    crossrefEnrichedAt: new Date(),
    crossrefLastError: null,
  };

  if ((mode === "full" || missingTargets.includes("doi")) && normalizedDoi) {
    updatePayload.doi = normalizedDoi;
    provenanceUpdates.doi = buildFieldProvenance({
      provider: "crossref",
      confidenceScore: matchScore,
      reason,
      source,
      mode,
    });
  }

  if (mode === "full" || missingTargets.includes("url")) {
    const resolvedUrl = work.URL?.trim() || (normalizedDoi ? `https://doi.org/${normalizedDoi}` : null);
    if (resolvedUrl) {
      updatePayload.url = resolvedUrl;
      provenanceUpdates.url = buildFieldProvenance({
        provider: "crossref",
        confidenceScore: Math.max(72, matchScore - 5),
        reason: work.URL?.trim() ? "Crossref canonical URL" : "URL inferred from DOI",
        source: resolvedUrl,
        mode,
      });
    }
  }

  if ((mode === "full" || missingTargets.includes("abstract")) && crossrefAbstract) {
    updatePayload.abstract = crossrefAbstract;
    provenanceUpdates.abstract = buildFieldProvenance({
      provider: "crossref",
      confidenceScore: Math.max(78, matchScore - 3),
      reason: "Crossref abstract normalized from work metadata",
      source,
      mode,
    });
  }

  if ((mode === "full" || missingTargets.includes("year")) && workYear) {
    updatePayload.year = workYear;
    provenanceUpdates.year = buildFieldProvenance({
      provider: "crossref",
      confidenceScore: matchScore,
      reason,
      source,
      mode,
    });
  }

  if (mode === "full" || missingTargets.includes("authorDetails")) {
    updatePayload.authorDetails = authorDetails.length > 0 ? authorDetails : null;
    provenanceUpdates.authorDetails = buildFieldProvenance({
      provider: "crossref",
      confidenceScore: matchScore,
      reason,
      source,
      mode,
    });

    if (displayAuthor && displayAuthor.trim().length > 0) {
      updatePayload.author = displayAuthor;
      provenanceUpdates.author = buildFieldProvenance({
        provider: "crossref",
        confidenceScore: Math.max(70, matchScore - 8),
        reason: "Author display value normalized from Crossref author metadata",
        source,
        mode,
      });
    }
  }

  if (mode === "full" || missingTargets.includes("referenceItems")) {
    updatePayload.referenceItems = referenceItems.length > 0 ? referenceItems : null;
    provenanceUpdates.referenceItems = buildFieldProvenance({
      provider: "crossref",
      confidenceScore: Math.max(75, matchScore - 4),
      reason: "Crossref references normalized from work metadata",
      source,
      mode,
    });
  }

  if (forum && (mode === "full" || missingTargets.includes("forumId")) && record.forumId !== forum.id) {
    updatePayload.forumId = forum.id;
    provenanceUpdates.forumId = buildFieldProvenance({
      provider: "crossref",
      confidenceScore: Math.max(74, matchScore - 6),
      reason: "Forum resolved from Crossref container metadata",
      source: forum.name ?? source,
      mode,
    });
  }

  if (Object.keys(provenanceUpdates).length > 0) {
    updatePayload.enrichmentProvenance = mergeProvenance(
      (record.enrichmentProvenance as EnrichmentProvenanceMap | null | undefined) ?? null,
      provenanceUpdates,
    );
  }

  await record.update(updatePayload);

  let jufoResult: { message: string | null } = { message: null };
  try {
    jufoResult = await enrichForumWithJufo(forum, context, options);
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
