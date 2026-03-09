import db from "../models";
import { extractDoiFromRecordUrls, extractDoiFromText } from "./crossref";
import { normalizeDoiValue, toDateOrNull, toPlainObject } from "./enrichmentCommon";
import type { EnrichRecordResult, EnrichmentJobOptions, JobContext } from "./enrichmentTypes";
import type { OpenAlexResolvedWork } from "./openalex";

const OPENALEX_REFRESH_MS = Number.parseInt(
  process.env.OPENALEX_REFRESH_MS ?? String(1000 * 60 * 60 * 24 * 30),
  10,
);

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

const shouldRefreshOpenAlex = (enrichedAt: unknown, forceRefresh: boolean) => {
  if (forceRefresh) {
    return true;
  }

  const enrichedDate = toDateOrNull(enrichedAt);
  if (!enrichedDate) {
    return true;
  }

  const age = Date.now() - enrichedDate.getTime();
  return age > OPENALEX_REFRESH_MS;
};

const resolveOpenAlexWork = async (
  context: JobContext,
  record: {
    title?: string | null;
    author?: string | null;
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

  if (doiCandidate) {
    openAlexWork = await context.openAlexClient.fetchWorkByDoi(doiCandidate);
  }

  if (!openAlexWork && record.title?.trim()) {
    openAlexWork = await context.openAlexClient.searchWorkByTitleAndAuthor(record.title, record.author);
    doiUsed = sanitizeDoi(openAlexWork?.doi) ?? doiUsed;
  }

  return { openAlexWork, doiUsed };
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

  if (!shouldRefreshOpenAlex(record.openAlexEnrichedAt, options.forceRefresh)) {
    const refreshed = await db.Record.findByPk(record.id, { include: ["Forum", "MappingOptions"] });
    return {
      result: {
        recordId,
        status: "skipped",
        doi: sanitizeDoi(record.doi),
        message: "OpenAlex enrichment is fresh",
      },
      ...(refreshed ? { updatedRecord: toPlainObject(refreshed) } : {}),
    };
  }

  const { openAlexWork, doiUsed } = await resolveOpenAlexWork(context, record);
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

  const citationItems = await context.openAlexClient.fetchCitationsForWork(
    openAlexWork.openAlexId,
    options.maxCitations,
  );

  const updatePayload: Record<string, unknown> = {
    openAlexId: openAlexWork.openAlexId,
    citationCount: openAlexWork.citationCount,
    openAlexReferenceItems: null,
    openAlexCitationItems: citationItems,
    openAlexTopicItems: openAlexWork.topics,
    openAlexAuthorAffiliations: openAlexWork.authorAffiliations,
    openAlexEnrichedAt: new Date(),
    openAlexLastError: null,
  };

  if (!record.doi && openAlexWork.doi) {
    updatePayload.doi = openAlexWork.doi;
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
