import { randomUUID } from "node:crypto";

import db from "../models";
import type { CrossrefAuthorDetail, CrossrefReferenceItem } from "../models/types";
import {
  CrossrefClient,
  extractDoiFromRecordUrls,
  extractDoiFromText,
  extractIssnFromWork,
  normalizeIssn,
  type CrossrefWork,
} from "./crossref";
import { JufoClient, type JufoLookupResult } from "./jufo";

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
const jufoClient = new JufoClient();
const jobs = new Map<string, InternalJob>();
const queue: InternalJob[] = [];
let queueActive = false;
const MAX_STORED_JOBS = 100;
const JUFO_REFRESH_MS = Number.parseInt(process.env.JUFO_REFRESH_MS ?? String(1000 * 60 * 60 * 24 * 30), 10);

type ForumSnapshot = {
  id: number;
  name: string | null;
  issn: string | null;
  jufoLevel: number | null;
  jufoFetchedAt: Date | null;
  jufoLastError: string | null;
  update: (values: Record<string, unknown>) => Promise<unknown>;
};

type JobContext = {
  jufoByIssn: Map<string, JufoLookupResult | null>;
  jufoProcessedForumIds: Set<number>;
};

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

const toForumSnapshot = (
  value: unknown,
): ForumSnapshot | null => {
  const forum = value as
    | {
        id?: unknown;
        name?: unknown;
        issn?: unknown;
        jufoLevel?: unknown;
        jufoFetchedAt?: unknown;
        jufoLastError?: unknown;
        update?: unknown;
      }
    | null
    | undefined;

  if (!forum || typeof forum !== "object") {
    return null;
  }

  const id = typeof forum.id === "number" ? forum.id : Number.NaN;
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const updateFn = forum.update;
  if (typeof updateFn !== "function") {
    return null;
  }

  const fetchedAt =
    forum.jufoFetchedAt instanceof Date
      ? forum.jufoFetchedAt
      : typeof forum.jufoFetchedAt === "string"
        ? new Date(forum.jufoFetchedAt)
        : null;

  const boundUpdate = (values: Record<string, unknown>) =>
    (updateFn as (this: unknown, values: Record<string, unknown>) => Promise<unknown>).call(
      forum,
      values,
    );

  return {
    id,
    name: typeof forum.name === "string" ? forum.name : null,
    issn: normalizeIssn(typeof forum.issn === "string" ? forum.issn : null),
    jufoLevel: typeof forum.jufoLevel === "number" ? forum.jufoLevel : null,
    jufoFetchedAt: fetchedAt && !Number.isNaN(fetchedAt.getTime()) ? fetchedAt : null,
    jufoLastError: typeof forum.jufoLastError === "string" ? forum.jufoLastError : null,
    update: boundUpdate,
  };
};

const shouldRefreshJufo = (fetchedAt: Date | null) => {
  if (!fetchedAt) {
    return true;
  }

  const age = Date.now() - fetchedAt.getTime();
  return age > JUFO_REFRESH_MS;
};

const updateForumFromWork = async (
  record: { forumId?: number | null; Forum?: Record<string, unknown> | null },
  work: CrossrefWork,
) => {
  const forumName = pickForumName(work);
  const publisher = work.publisher?.trim() || null;
  const issn = extractIssnFromWork(work);

  if (!forumName && !publisher && !issn) {
    return toForumSnapshot(record.Forum);
  }

  const currentForum = record.Forum as
    | (Record<string, unknown> & {
        id: number;
        name?: string | null;
        alternateNames?: string[] | null;
        publisher?: string | null;
        issn?: string | null;
        jufoLevel?: number | null;
        jufoFetchedAt?: Date | string | null;
        jufoLastError?: string | null;
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

    if (issn && normalizeIssn(currentForum.issn) !== issn) {
      updatePayload.issn = issn;
    }

    if (Object.keys(updatePayload).length > 0 && currentForum.update) {
      await currentForum.update(updatePayload);
    }
    const updateFn = currentForum.update;
    const boundUpdate =
      typeof updateFn === "function"
        ? (values: Record<string, unknown>) =>
            (updateFn as (this: unknown, values: Record<string, unknown>) => Promise<unknown>).call(
              currentForum,
              values,
            )
        : null;

    if (!boundUpdate) {
      return null;
    }

    return {
      id: currentForum.id,
      name: updatePayload.name as string | null | undefined ?? currentForum.name ?? null,
      issn: (updatePayload.issn as string | undefined) ?? normalizeIssn(currentForum.issn) ?? null,
      jufoLevel: currentForum.jufoLevel ?? null,
      jufoFetchedAt:
        currentForum.jufoFetchedAt instanceof Date
          ? currentForum.jufoFetchedAt
          : typeof currentForum.jufoFetchedAt === "string"
            ? new Date(currentForum.jufoFetchedAt)
            : null,
      jufoLastError: currentForum.jufoLastError ?? null,
      update: boundUpdate,
    } satisfies ForumSnapshot;
  }

  const existingForum =
    forumName
      ? await db.Forum.findOne({
          where: { name: forumName },
        })
      : null;

  if (existingForum) {
    const updatePayload: Record<string, unknown> = {};
    if (publisher && existingForum.publisher !== publisher) {
      updatePayload.publisher = publisher;
    }
    if (issn && normalizeIssn(existingForum.issn) !== issn) {
      updatePayload.issn = issn;
    }
    if (Object.keys(updatePayload).length > 0) {
      await existingForum.update(updatePayload);
    }
    return {
      id: existingForum.id,
      name: existingForum.name ?? null,
      issn: normalizeIssn((updatePayload.issn as string | undefined) ?? existingForum.issn) ?? null,
      jufoLevel: existingForum.jufoLevel ?? null,
      jufoFetchedAt: existingForum.jufoFetchedAt ?? null,
      jufoLastError: existingForum.jufoLastError ?? null,
      update: existingForum.update.bind(existingForum),
    };
  }

  if (!forumName) {
    return null;
  }

  const created = await db.Forum.create({
    name: forumName,
    publisher,
    issn,
  });
  return {
    id: created.id,
    name: created.name ?? null,
    issn: normalizeIssn(created.issn) ?? null,
    jufoLevel: created.jufoLevel ?? null,
    jufoFetchedAt: created.jufoFetchedAt ?? null,
    jufoLastError: created.jufoLastError ?? null,
    update: created.update.bind(created),
  };
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

const enrichForumWithJufo = async (
  forum: ForumSnapshot | null,
  context: JobContext,
): Promise<{ message: string | null }> => {
  if (!forum) {
    return { message: null };
  }

  if (context.jufoProcessedForumIds.has(forum.id)) {
    return { message: null };
  }

  context.jufoProcessedForumIds.add(forum.id);

  const issn = normalizeIssn(forum.issn);
  if (!issn) {
    await forum.update({
      jufoFetchedAt: new Date(),
      jufoLastError: "No ISSN available for JUFO lookup",
    });
    return { message: "No ISSN available for JUFO lookup" };
  }

  if (!shouldRefreshJufo(forum.jufoFetchedAt)) {
    return { message: null };
  }

  let lookup = context.jufoByIssn.get(issn);
  if (lookup === undefined) {
    lookup = await jufoClient.lookupByIssn(issn);
    context.jufoByIssn.set(issn, lookup ?? null);
  }

  if (!lookup) {
    await forum.update({
      jufoFetchedAt: new Date(),
      jufoLastError: `JUFO lookup not found for ISSN ${issn}`,
    });
    return { message: `JUFO lookup not found for ISSN ${issn}` };
  }

  const updatePayload: Record<string, unknown> = {
    jufoFetchedAt: new Date(),
    jufoLastError: null,
    jufoId: lookup.jufoId,
    ...(lookup.jufoLevel !== null ? { jufoLevel: lookup.jufoLevel } : {}),
    ...(lookup.issn ? { issn: normalizeIssn(lookup.issn) } : {}),
    ...(lookup.name && !forum.name ? { name: lookup.name } : {}),
  };

  await forum.update(updatePayload);
  return { message: null };
};

const enrichRecord = async (recordId: number, context: JobContext): Promise<{
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
      ...(refreshed ? { updatedRecord: toPlainRecord(refreshed) } : {}),
    };
  }

  const normalizedDoi = sanitizeDoi(work.DOI) ?? doiUsed;
  const authorDetails = normalizeAuthorDetails(work.author);
  const displayAuthor = formatAuthorDisplay(authorDetails);
  const referenceItems = normalizeReferenceItems(work.reference);
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
      const context: JobContext = {
        jufoByIssn: new Map<string, JufoLookupResult | null>(),
        jufoProcessedForumIds: new Set<number>(),
      };

      try {
        for (const recordId of job.recordIds) {
          try {
            const { result, updatedRecord } = await enrichRecord(recordId, context);
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
