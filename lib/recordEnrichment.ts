import { randomUUID } from "node:crypto";

import db from "../models";
import type { CrossrefAuthorDetail, CrossrefReferenceItem } from "../models/types";
import { CrossrefClient, extractDoiFromRecordUrls, extractDoiFromText, type CrossrefWork } from "./crossref";

type JobStatus = "queued" | "running" | "completed" | "failed";
type ResultStatus = "enriched" | "skipped" | "failed";

export type EnrichmentJobResult = {
  recordId: number;
  status: ResultStatus;
  doi: string | null;
  message?: string;
};

export type EnrichmentJobSnapshot = {
  jobId: string;
  status: JobStatus;
  total: number;
  processed: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  results: EnrichmentJobResult[];
  updatedRecords: Array<Record<string, unknown>>;
};

type InternalJob = EnrichmentJobSnapshot & {
  recordIds: number[];
  latestError?: string;
};

const crossrefClient = new CrossrefClient();
const jobs = new Map<string, InternalJob>();
const queue: InternalJob[] = [];
let queueActive = false;
const MAX_STORED_JOBS = 100;

const normalizeName = (value: string | null | undefined) =>
  value
    ?.toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim() ?? "";

const uniqueNames = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeName(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(value);
  }

  return result;
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

const normalizeReferenceItems = (references: CrossrefWork["reference"]): CrossrefReferenceItem[] => {
  if (!Array.isArray(references)) {
    return [];
  }

  return references.map((reference) => ({
    doi: reference.DOI?.trim() || null,
    key: reference.key?.trim() || null,
    unstructured: reference.unstructured?.trim() || null,
    articleTitle: reference["article-title"]?.trim() || null,
    journalTitle: reference["journal-title"]?.trim() || null,
    author: reference.author?.trim() || null,
    year: reference.year?.trim() || null,
    volume: reference.volume?.trim() || null,
    firstPage: reference["first-page"]?.trim() || null,
  }));
};

const pickForumName = (work: CrossrefWork) => {
  const fromContainer = (work["container-title"] ?? []).find((item) => item?.trim().length > 0)?.trim();
  if (fromContainer) {
    return fromContainer;
  }

  const fromShort = (work["short-container-title"] ?? []).find((item) => item?.trim().length > 0)?.trim();
  return fromShort || null;
};

const sanitizeDoi = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const extracted = extractDoiFromText(value);
  if (extracted) {
    return extracted;
  }

  const fallback = value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  return fallback.length > 0 ? fallback : null;
};

const updateForumFromWork = async (
  record: { forumId?: number | null; Forum?: Record<string, unknown> | null },
  work: CrossrefWork,
) => {
  const forumName = pickForumName(work);
  const publisher = work.publisher?.trim() || null;

  if (!forumName && !publisher) {
    return record.forumId ?? null;
  }

  const currentForum = record.Forum as
    | (Record<string, unknown> & {
        id: number;
        name?: string | null;
        alternateNames?: string[] | null;
        publisher?: string | null;
        update?: (values: Record<string, unknown>) => Promise<unknown>;
      })
    | null
    | undefined;

  if (currentForum?.id) {
    const updatePayload: Record<string, unknown> = {};
    const currentName = typeof currentForum.name === "string" ? currentForum.name : null;

    if (!currentName && forumName) {
      updatePayload.name = forumName;
    } else if (currentName && forumName && normalizeName(currentName) !== normalizeName(forumName)) {
      const alternates = Array.isArray(currentForum.alternateNames) ? currentForum.alternateNames : [];
      updatePayload.alternateNames = uniqueNames([...alternates, forumName]);
    }

    if (publisher && currentForum.publisher !== publisher) {
      updatePayload.publisher = publisher;
    }

    if (Object.keys(updatePayload).length > 0 && currentForum.update) {
      await currentForum.update(updatePayload);
    }
    return currentForum.id;
  }

  const existingForum =
    forumName
      ? await db.Forum.findOne({
          where: { name: forumName },
        })
      : null;

  if (existingForum) {
    if (publisher && existingForum.publisher !== publisher) {
      await existingForum.update({ publisher });
    }
    return existingForum.id;
  }

  if (!forumName) {
    return null;
  }

  const created = await db.Forum.create({
    name: forumName,
    publisher,
  });
  return created.id;
};

const toPlainRecord = (record: unknown): Record<string, unknown> => {
  const asRecord = record as { toJSON?: () => unknown; get?: (opts?: unknown) => unknown };
  if (typeof asRecord.toJSON === "function") {
    return asRecord.toJSON() as Record<string, unknown>;
  }
  if (typeof asRecord.get === "function") {
    return asRecord.get({ plain: true }) as Record<string, unknown>;
  }
  return record as Record<string, unknown>;
};

const enrichRecord = async (recordId: number): Promise<{
  result: EnrichmentJobResult;
  updatedRecord?: Record<string, unknown>;
}> => {
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

  const doiFromUrls = extractDoiFromRecordUrls(record.url, record.alternateUrls);
  const doiFromRecord = sanitizeDoi(record.doi);
  const doiCandidate = doiFromUrls ?? doiFromRecord;
  let work: CrossrefWork | null = null;
  let doiUsed: string | null = doiCandidate;

  if (doiCandidate) {
    work = await crossrefClient.fetchWorkByDoi(doiCandidate);
  }

  if (!work && record.title?.trim()) {
    work = await crossrefClient.searchWorkByTitleAndAuthor(record.title, record.author);
    doiUsed = sanitizeDoi(work?.DOI) ?? doiUsed;
  }

  if (!work) {
    await record.update({
      crossrefEnrichedAt: new Date(),
      crossrefLastError: "Crossref metadata not found for this record",
    });
    const refreshed = await db.Record.findByPk(record.id, { include: ["Forum", "MappingOptions"] });

    return {
      result: {
        recordId,
        status: "failed",
        doi: doiUsed,
        message: "Crossref metadata not found",
      },
      ...(refreshed ? { updatedRecord: toPlainRecord(refreshed) } : {}),
    };
  }

  const normalizedDoi = sanitizeDoi(work.DOI) ?? doiUsed;
  const authorDetails = normalizeAuthorDetails(work.author);
  const displayAuthor = formatAuthorDisplay(authorDetails);
  const referenceItems = normalizeReferenceItems(work.reference);
  const forumId = await updateForumFromWork(record as typeof record & { Forum?: Record<string, unknown> | null }, work);

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

  if (forumId !== null && forumId !== undefined && record.forumId !== forumId) {
    updatePayload.forumId = forumId;
  }

  await record.update(updatePayload);
  const refreshed = await db.Record.findByPk(record.id, { include: ["Forum", "MappingOptions"] });

  return {
    result: {
      recordId,
      status: "enriched",
      doi: normalizedDoi,
    },
    ...(refreshed ? { updatedRecord: toPlainRecord(refreshed) } : {}),
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

      job.status = "running";
      job.startedAt = new Date().toISOString();

      try {
        for (const recordId of job.recordIds) {
          const { result, updatedRecord } = await enrichRecord(recordId);
          job.results.push(result);
          job.processed += 1;
          if (updatedRecord) {
            job.updatedRecords.push(updatedRecord);
          }
        }
        job.status = "completed";
      } catch (error) {
        job.latestError = error instanceof Error ? error.message : "Unexpected enrichment error";
        job.status = "failed";
      } finally {
        job.finishedAt = new Date().toISOString();
      }
    }
  } finally {
    queueActive = false;
  }
};

export const createEnrichmentJob = (recordIds: number[]): EnrichmentJobSnapshot => {
  const dedupedRecordIds = [...new Set(recordIds)];
  const now = new Date().toISOString();

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
    recordIds: dedupedRecordIds,
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
