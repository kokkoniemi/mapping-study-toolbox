import { randomUUID } from "node:crypto";

import { CrossrefClient } from "./crossref";
import { enrichRecordWithCrossref } from "./enrichCrossref";
import { enrichRecordWithOpenAlex } from "./enrichOpenalex";
import type {
  EnrichRecordResult,
  EnrichmentJobOptions,
  EnrichmentJobResult,
  EnrichmentJobSnapshot,
  InternalJob,
  JobContext,
  ResultStatus,
} from "./enrichmentTypes";
import { JufoClient, type JufoLookupResult } from "./jufo";
import { OpenAlexClient } from "./openalex";

const jobs = new Map<string, InternalJob>();
const queue: InternalJob[] = [];
let queueActive = false;
const MAX_STORED_JOBS = 100;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const openAlexDefaultMaxCitationsRaw = Number.parseInt(process.env.OPENALEX_MAX_CITATIONS ?? "", 10);
const OPENALEX_DEFAULT_MAX_CITATIONS =
  process.env.OPENALEX_MAX_CITATIONS === undefined || !Number.isFinite(openAlexDefaultMaxCitationsRaw)
    ? 5000
    : clamp(openAlexDefaultMaxCitationsRaw, 0, 50_000);

const normalizeJobOptions = (options: EnrichmentJobOptions = {}): Required<EnrichmentJobOptions> => {
  const provider = options.provider ?? "all";
  const maxCitationsRaw = options.maxCitations;
  const parsedMaxCitations = Number(maxCitationsRaw);
  const maxCitations =
    maxCitationsRaw === null || maxCitationsRaw === undefined
      ? OPENALEX_DEFAULT_MAX_CITATIONS
      : Number.isFinite(parsedMaxCitations)
        ? clamp(parsedMaxCitations, 0, 50_000)
        : OPENALEX_DEFAULT_MAX_CITATIONS;

  return {
    provider: provider === "openalex" || provider === "all" ? provider : "crossref",
    maxCitations,
    forceRefresh: Boolean(options.forceRefresh),
  };
};

const syncRequestMetrics = (context: JobContext) => {
  context.metrics.crossref.requests = context.crossrefClient.requestCount;
  context.metrics.openalex.requests = context.openAlexClient.requestCount;
  context.metrics.jufo.requests = context.jufoClient.requestCount;
};

const mergeResults = (results: EnrichmentJobResult[]): EnrichmentJobResult => {
  const [first] = results;
  if (!first) {
    return {
      recordId: 0,
      status: "failed",
      doi: null,
      message: "No enrichment providers executed",
    };
  }

  const status: ResultStatus =
    results.some((item) => item.status === "enriched")
      ? "enriched"
      : results.some((item) => item.status === "failed")
        ? "failed"
        : "skipped";

  const doi = results.map((item) => item.doi).find((item) => Boolean(item)) ?? null;
  const message = results
    .map((item) => item.message?.trim())
    .filter((item): item is string => Boolean(item))
    .filter((item, index, all) => all.indexOf(item) === index)
    .join("; ");

  return {
    recordId: first.recordId,
    status,
    doi,
    ...(message ? { message } : {}),
  };
};

const enrichRecord = async (
  recordId: number,
  context: JobContext,
  options: Required<EnrichmentJobOptions>,
): Promise<EnrichRecordResult> => {
  const providerResults: EnrichRecordResult[] = [];

  if (options.provider === "crossref" || options.provider === "all") {
    context.metrics.crossref.records += 1;
    providerResults.push(await enrichRecordWithCrossref(recordId, context, options));
    syncRequestMetrics(context);
  }

  if (options.provider === "openalex" || options.provider === "all") {
    context.metrics.openalex.records += 1;
    providerResults.push(await enrichRecordWithOpenAlex(recordId, context, options));
    syncRequestMetrics(context);
  }

  const mergedResult = mergeResults(providerResults.map((item) => item.result));
  const lastUpdatedRecord = [...providerResults]
    .reverse()
    .find((item) => item.updatedRecord !== undefined)
    ?.updatedRecord;

  return {
    result: mergedResult,
    ...(lastUpdatedRecord ? { updatedRecord: lastUpdatedRecord } : {}),
  };
};

const snapshot = (job: InternalJob): EnrichmentJobSnapshot => ({
  jobId: job.jobId,
  status: job.status,
  total: job.total,
  processed: job.processed,
  createdAt: job.createdAt,
  startedAt: job.startedAt,
  finishedAt: job.finishedAt,
  results: [...job.results],
  updatedRecords: [...job.updatedRecords],
  metrics: {
    crossref: { ...job.metrics.crossref },
    openalex: { ...job.metrics.openalex },
    jufo: { ...job.metrics.jufo },
  },
});

const pruneJobs = () => {
  if (jobs.size <= MAX_STORED_JOBS) {
    return;
  }

  const sorted = [...jobs.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const overflow = sorted.length - MAX_STORED_JOBS;
  for (let index = 0; index < overflow; index += 1) {
    const candidate = sorted[index];
    if (!candidate) {
      continue;
    }
    jobs.delete(candidate.jobId);
  }
};

const runQueuedJobs = async () => {
  if (queueActive) {
    return;
  }

  queueActive = true;
  try {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) {
        continue;
      }

      if (job.cancelRequested || job.status === "cancelled") {
        job.status = "cancelled";
        job.latestError = "Cancelled by user";
        job.finishedAt = new Date().toISOString();
        continue;
      }

      job.status = "running";
      job.startedAt = new Date().toISOString();
      const crossrefClient = new CrossrefClient();
      const openAlexClient = new OpenAlexClient();
      const jufoClient = new JufoClient();
      const context: JobContext = {
        jufoByIssn: new Map<string, JufoLookupResult | null>(),
        jufoProcessedForumIds: new Set<number>(),
        crossrefClient,
        openAlexClient,
        jufoClient,
        metrics: job.metrics,
        referenceMetadataByDoi: new Map(),
      };

      try {
        for (const recordId of job.recordIds) {
          if (job.cancelRequested) {
            job.status = "cancelled";
            job.latestError = "Cancelled by user";
            break;
          }

          try {
            const { result, updatedRecord } = await enrichRecord(recordId, context, job.options);
            job.results.push(result);
            if (updatedRecord) {
              job.updatedRecords.push(updatedRecord);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unexpected enrichment error";
            job.results.push({
              recordId,
              status: "failed",
              doi: null,
              message,
            });
            job.latestError = message;
          } finally {
            job.processed += 1;
            syncRequestMetrics(context);
          }
        }
        if (job.status === "running") {
          job.status = "completed";
        }
      } catch (error) {
        job.latestError = error instanceof Error ? error.message : "Unexpected enrichment error";
        job.status = "failed";
      } finally {
        syncRequestMetrics(context);
        job.finishedAt = new Date().toISOString();
      }
    }
  } finally {
    queueActive = false;
  }
};

export const createEnrichmentJob = (
  recordIds: number[],
  options: EnrichmentJobOptions = {},
): EnrichmentJobSnapshot => {
  const dedupedRecordIds = [...new Set(recordIds)];
  const now = new Date().toISOString();
  const normalizedOptions = normalizeJobOptions(options);

  const job: InternalJob = {
    jobId: randomUUID(),
    status: "queued",
    total: dedupedRecordIds.length,
    processed: 0,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    results: [],
    updatedRecords: [],
    metrics: {
      crossref: { records: 0, requests: 0 },
      openalex: { records: 0, requests: 0 },
      jufo: { records: 0, requests: 0 },
    },
    recordIds: dedupedRecordIds,
    options: normalizedOptions,
    cancelRequested: false,
  };

  jobs.set(job.jobId, job);
  queue.push(job);
  pruneJobs();
  void runQueuedJobs();
  return snapshot(job);
};

export const getEnrichmentJob = (jobId: string): EnrichmentJobSnapshot | null => {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }
  return snapshot(job);
};

export const cancelEnrichmentJob = (jobId: string): EnrichmentJobSnapshot | null => {
  const job = jobs.get(jobId);
  if (!job) {
    return null;
  }

  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    return snapshot(job);
  }

  job.cancelRequested = true;
  job.latestError = "Cancelled by user";

  if (job.status === "queued") {
    job.status = "cancelled";
    job.finishedAt = new Date().toISOString();
  }

  return snapshot(job);
};
