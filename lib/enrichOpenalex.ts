import db from "../models";
import { extractDoiFromRecordUrls, extractDoiFromText } from "./crossref";
import { normalizeDoiValue, toPlainObject } from "./enrichmentCommon";
import { buildFieldProvenance, mergeProvenance } from "./enrichmentProvenance";
import type { EnrichRecordResult, EnrichmentJobOptions, JobContext } from "./enrichmentTypes";
import type { OpenAlexResolvedWork } from "./openalex";
import type { EnrichmentMode, EnrichmentProvenanceMap } from "../shared/contracts";

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

const resolveOpenAlexWork = async (
  context: JobContext,
  record: {
    title?: string | null;
    author?: string | null;
    year?: number | null;
    doi?: string | null;
    url?: string | null;
    alternateUrls?: string[] | null;
  },
) => {
  const doiFromUrls = extractDoiFromRecordUrls(record.url, record.alternateUrls);
  const doiFromRecord = sanitizeDoi(record.doi);
  const doiCandidate = doiFromUrls ?? doiFromRecord;

  let openAlexWork: OpenAlexResolvedWork | null = null;
  let doiUsed: string | null = doiCandidate;
  let resolvedBy: "doi" | "search" | null = null;

  if (doiCandidate) {
    openAlexWork = await context.openAlexClient.fetchWorkByDoi(doiCandidate);
    if (openAlexWork) {
      resolvedBy = "doi";
    }
  }

  if (!openAlexWork && record.title?.trim()) {
    openAlexWork = await context.openAlexClient.searchWorkByTitleAndAuthor(
      record.title,
      record.author,
      record.year,
    );
    doiUsed = sanitizeDoi(openAlexWork?.doi) ?? doiUsed;
    if (openAlexWork) {
      resolvedBy = "search";
    }
  }

  return { openAlexWork, doiUsed, resolvedBy };
};

const getMissingOpenAlexTargets = (record: {
  doi?: string | null;
  openAlexId?: string | null;
  citationCount?: number | null;
  openAlexCitationItems?: unknown[] | null;
  openAlexTopicItems?: unknown[] | null;
  openAlexAuthorAffiliations?: unknown[] | null;
}): string[] => {
  const missing: string[] = [];
  if (!sanitizeDoi(record.doi)) {
    missing.push("doi");
  }
  if (!record.openAlexId) {
    missing.push("openAlexId");
  }
  if (record.citationCount === null || record.citationCount === undefined) {
    missing.push("citationCount");
  }
  if (!Array.isArray(record.openAlexCitationItems) || record.openAlexCitationItems.length === 0) {
    missing.push("openAlexCitationItems");
  }
  if (!Array.isArray(record.openAlexTopicItems) || record.openAlexTopicItems.length === 0) {
    missing.push("openAlexTopicItems");
  }
  if (!Array.isArray(record.openAlexAuthorAffiliations) || record.openAlexAuthorAffiliations.length === 0) {
    missing.push("openAlexAuthorAffiliations");
  }
  return missing;
};

export const enrichRecordWithOpenAlex = async (
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
  const missingTargets = getMissingOpenAlexTargets(record);
  if (mode === "missing" && missingTargets.length === 0) {
    const refreshed = await db.Record.findByPk(record.id, { include: ["Forum", "MappingOptions"] });
    return {
      result: {
        recordId,
        status: "skipped",
        doi: sanitizeDoi(record.doi),
        message: "OpenAlex missing-only mode: no missing targets",
      },
      ...(refreshed ? { updatedRecord: toPlainObject(refreshed) } : {}),
    };
  }

  const { openAlexWork, doiUsed, resolvedBy } = await resolveOpenAlexWork(context, record);
  if (!openAlexWork || !openAlexWork.openAlexId) {
    await record.update({
      openAlexEnrichedAt: new Date(),
      openAlexLastError: "OpenAlex metadata not found for this record",
    });

    const refreshed = await db.Record.findByPk(record.id, { include: ["Forum", "MappingOptions"] });
    return {
      result: {
        recordId,
        status: "failed",
        doi: doiUsed,
        message: "OpenAlex metadata not found",
      },
      ...(refreshed ? { updatedRecord: toPlainObject(refreshed) } : {}),
    };
  }

  const needsCitationItems = mode === "full" || missingTargets.includes("openAlexCitationItems");
  const citationItems = needsCitationItems
    ? await context.openAlexClient.fetchCitationsForWork(openAlexWork.openAlexId, options.maxCitations)
    : [];
  const matchScore = resolvedBy === "doi"
    ? 96
    : record.year && openAlexWork.year && Math.abs(openAlexWork.year - record.year) <= 1
      ? 89
      : 82;
  const source = openAlexWork.openAlexId ?? openAlexWork.doi ?? null;
  const reason =
    resolvedBy === "doi"
      ? "OpenAlex work resolved by DOI"
      : "OpenAlex work resolved by title/author search";
  const provenanceUpdates: EnrichmentProvenanceMap = {};

  const updatePayload: Record<string, unknown> = {
    openAlexEnrichedAt: new Date(),
    openAlexLastError: null,
  };

  if (mode === "full" || missingTargets.includes("openAlexId")) {
    updatePayload.openAlexId = openAlexWork.openAlexId;
    provenanceUpdates.openAlexId = buildFieldProvenance({
      provider: "openalex",
      confidenceScore: matchScore,
      reason,
      source,
      mode,
    });
  }

  if (mode === "full" || missingTargets.includes("citationCount")) {
    updatePayload.citationCount = openAlexWork.citationCount;
    provenanceUpdates.citationCount = buildFieldProvenance({
      provider: "openalex",
      confidenceScore: matchScore,
      reason,
      source,
      mode,
    });
  }

  if (mode === "full" || missingTargets.includes("openAlexCitationItems")) {
    updatePayload.openAlexCitationItems = citationItems;
    provenanceUpdates.openAlexCitationItems = buildFieldProvenance({
      provider: "openalex",
      confidenceScore: matchScore,
      reason: "OpenAlex citations loaded from citing works",
      source,
      mode,
    });
  }

  if (mode === "full" || missingTargets.includes("openAlexTopicItems")) {
    updatePayload.openAlexTopicItems = openAlexWork.topics;
    provenanceUpdates.openAlexTopicItems = buildFieldProvenance({
      provider: "openalex",
      confidenceScore: matchScore,
      reason,
      source,
      mode,
    });
  }

  if (mode === "full" || missingTargets.includes("openAlexAuthorAffiliations")) {
    updatePayload.openAlexAuthorAffiliations = openAlexWork.authorAffiliations;
    provenanceUpdates.openAlexAuthorAffiliations = buildFieldProvenance({
      provider: "openalex",
      confidenceScore: matchScore,
      reason,
      source,
      mode,
    });
  }

  if ((!record.doi || mode === "full") && openAlexWork.doi) {
    updatePayload.doi = openAlexWork.doi;
    provenanceUpdates.doi = buildFieldProvenance({
      provider: "openalex",
      confidenceScore: matchScore,
      reason,
      source: openAlexWork.doi,
      mode,
    });
  }

  if ((!record.url || mode === "full") && (openAlexWork.url || openAlexWork.doi)) {
    updatePayload.url = openAlexWork.url ?? `https://doi.org/${openAlexWork.doi}`;
    provenanceUpdates.url = buildFieldProvenance({
      provider: "openalex",
      confidenceScore: Math.max(70, matchScore - 5),
      reason: openAlexWork.url ? "OpenAlex landing page URL" : "URL inferred from DOI",
      source: openAlexWork.url ?? openAlexWork.doi,
      mode,
    });
  }

  if ((!record.year || mode === "full") && typeof openAlexWork.year === "number") {
    updatePayload.year = openAlexWork.year;
    provenanceUpdates.year = buildFieldProvenance({
      provider: "openalex",
      confidenceScore: matchScore,
      reason,
      source,
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
  const refreshed = await db.Record.findByPk(record.id, { include: ["Forum", "MappingOptions"] });

  return {
    result: {
      recordId,
      status: "enriched",
      doi: openAlexWork.doi ?? doiUsed,
    },
    ...(refreshed ? { updatedRecord: toPlainObject(refreshed) } : {}),
  };
};
