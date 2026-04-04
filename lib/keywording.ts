import fs from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import db from "../models";
import type {
  KeywordingJobModel,
  MappingOptionModel,
  MappingQuestionModel,
  RecordDocumentModel,
  RecordModel,
} from "../models/types";
import type {
  CreateKeywordingJobPayload,
  KeywordingActionType,
  KeywordingAnalysisMode,
  KeywordingJobSnapshot,
  KeywordingJobSummary,
  KeywordingJobsIndexResponse,
} from "../shared/contracts";
import { badRequest, notFound } from "./http";
import { getActiveExtractedDocumentForRecord } from "./recordDocuments";
import { toAbsoluteStoragePath } from "./storagePaths";
import { requestWorkerKeywording } from "./workerClient";

const queue: number[] = [];
let queueActive = false;

type QuestionWithOptions = MappingQuestionModel & {
  MappingOptions?: MappingOptionModel[];
};

const ACTION_COUNTS: Record<KeywordingActionType, number> = {
  reuse_existing: 0,
  create_new: 0,
  split_existing: 0,
  merge_existing: 0,
  abstain: 0,
};

const createEmptySummary = (): KeywordingJobSummary => ({
  existingSuggestionCount: 0,
  newSuggestionCount: 0,
  lowConfidenceCount: 0,
  clusterDecisionCount: 0,
  manualReviewCount: 0,
  qualityFailedRecordCount: 0,
  outlierTopicCount: 0,
  actionCounts: { ...ACTION_COUNTS },
  skippedRecords: [],
  failedRecords: [],
});

const toIso = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : String(value);
};

const normalizeSummary = (summary: KeywordingJobSummary | null | undefined): KeywordingJobSummary => ({
  ...createEmptySummary(),
  ...(summary ?? {}),
  actionCounts: {
    ...ACTION_COUNTS,
    ...(summary?.actionCounts ?? {}),
  },
  skippedRecords: Array.isArray(summary?.skippedRecords) ? summary.skippedRecords : [],
  failedRecords: Array.isArray(summary?.failedRecords) ? summary.failedRecords : [],
});

const buildJobSnapshot = (job: KeywordingJobModel): KeywordingJobSnapshot => ({
  id: job.id,
  jobId: job.jobId,
  status: job.status,
  cancelRequested: Boolean(job.cancelRequested),
  total: job.total,
  processed: job.processed,
  recordIds: Array.isArray(job.recordIds) ? job.recordIds : [],
  mappingQuestionIds: Array.isArray(job.mappingQuestionIds) ? job.mappingQuestionIds : [],
  analysisMode: job.analysisMode ?? "standard",
  reuseEmbeddingCache: Boolean(job.reuseEmbeddingCache),
  embeddingModel: job.embeddingModel,
  representationModel: job.representationModel,
  bertopicVersion: job.bertopicVersion,
  topicReductionApplied: Boolean(job.topicReductionApplied),
  topicCountBeforeReduction: job.topicCountBeforeReduction ?? null,
  topicCountAfterReduction: job.topicCountAfterReduction ?? null,
  downgradedTopicCount: job.downgradedTopicCount ?? 0,
  topicArtifactPath: job.topicArtifactPath,
  cacheSummary: job.cacheSummary ?? { hits: 0, misses: 0, writes: 0 },
  reportPath: job.reportPath,
  reportReady: Boolean(job.reportPath) && job.status === "completed",
  createdAt: toIso(job.createdAt) ?? new Date(0).toISOString(),
  startedAt: toIso(job.startedAt),
  finishedAt: toIso(job.finishedAt),
  latestError: job.latestError,
  summary: normalizeSummary(job.summary),
});

const questionOptions = (question: MappingQuestionModel) =>
  Array.isArray((question as QuestionWithOptions).MappingOptions)
    ? (question as QuestionWithOptions).MappingOptions ?? []
    : [];

const unique = <T>(items: T[]) => [...new Set(items)];

const loadQuestionSet = async (mappingQuestionIds?: number[]) => {
  const where = mappingQuestionIds && mappingQuestionIds.length > 0 ? { id: mappingQuestionIds } : undefined;
  const questions = await db.MappingQuestion.findAll({
    ...(where ? { where } : {}),
    include: db.MappingOption,
    order: [
      ["position", "ASC"],
      [db.MappingOption, "position", "ASC"],
    ],
  });

  if (questions.length === 0) {
    throw badRequest("at least one mapping question is required");
  }

  return questions;
};

const ensureRecordsExist = async (recordIds: number[]) => {
  const records = await db.Record.findAll({ where: { id: recordIds } });
  if (records.length !== recordIds.length) {
    const foundIds = new Set(records.map((record) => record.id));
    const missing = recordIds.filter((recordId) => !foundIds.has(recordId));
    throw notFound("Some selected records were not found", { missingRecordIds: missing });
  }
  return records;
};

const hasEligibleExtractedDocument = async (recordIds: number[]) => {
  for (const recordId of recordIds) {
    const document = await getActiveExtractedDocumentForRecord(recordId);
    if (document?.extractedTextPath && document.qualityStatus !== "failed") {
      return true;
    }
  }
  return false;
};

const loadRecordDocuments = async (recordIds: number[]) => {
  const documents = await db.RecordDocument.findAll({
    where: {
      recordId: recordIds,
      isActive: true,
      uploadStatus: "uploaded",
    },
  });
  return new Map<number, RecordDocumentModel>(documents.map((document) => [document.recordId, document]));
};

const loadChunkLookups = async (documents: RecordDocumentModel[]) => {
  const chunks = await db.DocumentChunk.findAll({
    where: {
      recordDocumentId: documents.map((document) => document.id),
    },
  });

  const byDocumentId = new Map<number, Map<string, number>>();
  for (const chunk of chunks) {
    const current = byDocumentId.get(chunk.recordDocumentId) ?? new Map<string, number>();
    current.set(chunk.chunkKey, chunk.id);
    byDocumentId.set(chunk.recordDocumentId, current);
  }

  return byDocumentId;
};

const serializeQuestions = (questions: MappingQuestionModel[]) =>
  questions.map((question) => ({
    id: question.id,
    title: question.title,
    type: question.type,
    position: question.position,
    description: question.description,
    decisionGuidance: question.decisionGuidance,
    positiveExamples: Array.isArray(question.positiveExamples) ? question.positiveExamples : [],
    negativeExamples: Array.isArray(question.negativeExamples) ? question.negativeExamples : [],
    evidenceInstructions: question.evidenceInstructions,
    allowNewOption: Boolean(question.allowNewOption),
    options: questionOptions(question).map((option) => ({
      id: option.id,
      title: option.title,
      position: option.position,
      color: option.color,
    })),
  }));

const serializeRecords = (records: RecordModel[], documentsByRecordId: Map<number, RecordDocumentModel>) =>
  records.map((record) => {
    const document = documentsByRecordId.get(record.id);
    return {
      id: record.id,
      title: record.title,
      abstract: record.abstract,
      year: record.year,
      doi: record.doi,
      document: document
        ? {
          id: document.id,
          extractedTextPath: document.extractedTextPath,
          structuredDocumentPath: document.structuredDocumentPath,
          chunkManifestPath: document.chunkManifestPath,
          qualityStatus: document.qualityStatus,
          sourceType: document.sourceType,
          checksum: document.checksum,
          embeddingStatus: document.embeddingStatus,
          embeddingModel: document.embeddingModel,
          embeddingTask: document.embeddingTask,
        }
        : null,
    };
  });

const syncChunkEmbeddingMetadataFromManifest = async (document: RecordDocumentModel) => {
  if (!document.chunkManifestPath) {
    return;
  }

  const manifestPath = toAbsoluteStoragePath(document.chunkManifestPath);
  if (!fs.existsSync(manifestPath)) {
    return;
  }

  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Array<Record<string, unknown>>;
  if (!Array.isArray(raw) || raw.length === 0) {
    return;
  }

  const chunkRows = await db.DocumentChunk.findAll({
    where: { recordDocumentId: document.id },
  });
  const chunkByKey = new Map(chunkRows.map((chunk) => [chunk.chunkKey, chunk]));

  let readyCount = 0;
  let embeddingModel: string | null = null;
  let embeddingTask: string | null = null;
  let embeddingGeneratedAt: Date | null = null;

  for (const item of raw) {
    const chunkKey = typeof item.chunkKey === "string" ? item.chunkKey : null;
    if (!chunkKey) {
      continue;
    }
    const chunk = chunkByKey.get(chunkKey);
    if (!chunk) {
      continue;
    }

    const generatedAt =
      typeof item.embeddingGeneratedAt === "string" && item.embeddingGeneratedAt.length > 0
        ? new Date(item.embeddingGeneratedAt)
        : null;

    chunk.embeddingReference = typeof item.embeddingReference === "string" ? item.embeddingReference : null;
    chunk.embeddingModel = typeof item.embeddingModel === "string" ? item.embeddingModel : null;
    chunk.embeddingTask = typeof item.embeddingTask === "string" ? item.embeddingTask : null;
    chunk.embeddingVersion = typeof item.embeddingVersion === "string" ? item.embeddingVersion : null;
    chunk.embeddingChecksum = typeof item.embeddingChecksum === "string" ? item.embeddingChecksum : null;
    chunk.embeddingGeneratedAt = generatedAt;
    await chunk.save();

    if (chunk.embeddingReference) {
      readyCount += 1;
      embeddingModel = embeddingModel ?? chunk.embeddingModel;
      embeddingTask = embeddingTask ?? chunk.embeddingTask;
      embeddingGeneratedAt = embeddingGeneratedAt ?? chunk.embeddingGeneratedAt;
    }
  }

  if (chunkRows.length > 0 && readyCount === chunkRows.length) {
    document.embeddingStatus = "ready";
  } else if (readyCount > 0) {
    document.embeddingStatus = "pending";
  } else {
    document.embeddingStatus = "not_ready";
  }
  document.embeddingModel = embeddingModel;
  document.embeddingTask = embeddingTask;
  document.embeddingGeneratedAt = embeddingGeneratedAt;
  await document.save();
};

const persistWorkerResults = async (
  job: KeywordingJobModel,
  documentsByRecordId: Map<number, RecordDocumentModel>,
  workerResponse: Awaited<ReturnType<typeof requestWorkerKeywording>>,
) => {
  const existingSuggestions = await db.KeywordingSuggestion.findAll({
    where: { keywordingJobId: job.id },
    attributes: ["id"],
  });
  const existingSuggestionIds = existingSuggestions.map((suggestion) => suggestion.id);
  if (existingSuggestionIds.length > 0) {
    await db.KeywordingEvidenceSpan.destroy({
      where: {
        keywordingSuggestionId: existingSuggestionIds,
      },
    });
  }
  await db.KeywordingSuggestion.destroy({ where: { keywordingJobId: job.id } });
  await db.KeywordingCluster.destroy({ where: { keywordingJobId: job.id } });

  const documents = [...documentsByRecordId.values()];
  const chunkLookupByDocumentId = await loadChunkLookups(documents);

  for (const suggestion of workerResponse.suggestions) {
    const persistedSuggestion = await db.KeywordingSuggestion.create({
      keywordingJobId: job.id,
      recordId: suggestion.recordId,
      mappingQuestionId: suggestion.mappingQuestionId,
      actionType: suggestion.actionType,
      decisionType: suggestion.actionType === "reuse_existing" ? "existing-option" : "new-option",
      existingOptionId: suggestion.existingOptionId,
      proposedOptionLabel: suggestion.proposedOptionLabel,
      confidence: suggestion.confidence,
      rationale: suggestion.rationale,
      reviewerNote: suggestion.reviewerNote,
    });

    const document = documentsByRecordId.get(suggestion.recordId);
    const chunkLookup = document ? (chunkLookupByDocumentId.get(document.id) ?? new Map<string, number>()) : new Map<string, number>();
    for (const evidence of suggestion.evidence) {
      await db.KeywordingEvidenceSpan.create({
        keywordingSuggestionId: persistedSuggestion.id,
        recordDocumentId: document?.id ?? null,
        documentChunkId: evidence.chunkKey ? (chunkLookup.get(evidence.chunkKey) ?? null) : null,
        chunkKey: evidence.chunkKey,
        pageStart: evidence.pageStart,
        pageEnd: evidence.pageEnd,
        sectionName: evidence.sectionName,
        headingPath: evidence.headingPath,
        excerptText: evidence.excerptText,
        rank: evidence.rank,
        score: evidence.score,
      });
    }
  }

  for (const cluster of workerResponse.clusters) {
    await db.KeywordingCluster.create({
      keywordingJobId: job.id,
      mappingQuestionId: cluster.mappingQuestionId,
      clusterKey: cluster.clusterKey,
      label: cluster.label,
      actionType: cluster.actionType,
      topicId: cluster.topicId,
      parentTopicId: cluster.parentTopicId,
      isOutlier: cluster.isOutlier,
      topTerms: cluster.topTerms,
      representativeChunkKeys: cluster.representativeChunkKeys,
      representationSource: cluster.representationSource,
      topicSize: cluster.topicSize,
      confidence: cluster.confidence,
      rationale: cluster.rationale,
      existingOptionIds: cluster.existingOptionIds,
      proposedOptionLabels: cluster.proposedOptionLabels,
      supportingRecordIds: cluster.supportingRecordIds,
      supportingChunkKeys: cluster.supportingChunkKeys,
      supportingEvidence: cluster.supportingEvidence,
    });
  }

  for (const document of documents) {
    await syncChunkEmbeddingMetadataFromManifest(document);
  }
};

const runQueuedJobs = async () => {
  if (queueActive) {
    return;
  }

  queueActive = true;
  try {
    while (queue.length > 0) {
      const nextId = queue.shift();
      if (!nextId) {
        continue;
      }

      const job = await db.KeywordingJob.findByPk(nextId);
      if (!job) {
        continue;
      }

      if (job.cancelRequested) {
        job.status = "cancelled";
        job.finishedAt = new Date();
        await job.save();
        continue;
      }

      const records = await ensureRecordsExist(Array.isArray(job.recordIds) ? job.recordIds : []);
      const questions = await loadQuestionSet(Array.isArray(job.mappingQuestionIds) ? job.mappingQuestionIds : []);
      const documentsByRecordId = await loadRecordDocuments(records.map((record) => record.id));

      job.status = "running";
      job.startedAt = new Date();
      job.latestError = null;
      job.summary = createEmptySummary();
      await job.save();

      try {
        const workerResponse = await requestWorkerKeywording({
          jobId: job.jobId,
          appDataDir: process.env.APP_DATA_DIR?.trim() || process.cwd(),
          analysisMode: job.analysisMode ?? "standard",
          reuseEmbeddingCache: Boolean(job.reuseEmbeddingCache),
          records: serializeRecords(records, documentsByRecordId),
          mappingQuestions: serializeQuestions(questions),
        });

        const refreshedJob = await db.KeywordingJob.findByPk(job.id);
        if (!refreshedJob) {
          continue;
        }
        if (refreshedJob.cancelRequested) {
          refreshedJob.status = "cancelled";
          refreshedJob.finishedAt = new Date();
          refreshedJob.summary = normalizeSummary(workerResponse.summary);
          refreshedJob.embeddingModel = workerResponse.embeddingModel;
          refreshedJob.representationModel = workerResponse.representationModel;
          refreshedJob.bertopicVersion = workerResponse.bertopicVersion;
          refreshedJob.topicReductionApplied = workerResponse.topicReductionApplied;
          refreshedJob.topicCountBeforeReduction = workerResponse.topicCountBeforeReduction;
          refreshedJob.topicCountAfterReduction = workerResponse.topicCountAfterReduction;
          refreshedJob.downgradedTopicCount = workerResponse.downgradedTopicCount;
          refreshedJob.topicArtifactPath = workerResponse.topicArtifactPath;
          refreshedJob.cacheSummary = workerResponse.cacheSummary;
          await refreshedJob.save();
          continue;
        }

        await persistWorkerResults(job, documentsByRecordId, workerResponse);
        job.processed = records.length;
        job.summary = normalizeSummary(workerResponse.summary);
        job.embeddingModel = workerResponse.embeddingModel;
        job.representationModel = workerResponse.representationModel;
        job.bertopicVersion = workerResponse.bertopicVersion;
        job.topicReductionApplied = workerResponse.topicReductionApplied;
        job.topicCountBeforeReduction = workerResponse.topicCountBeforeReduction;
        job.topicCountAfterReduction = workerResponse.topicCountAfterReduction;
        job.downgradedTopicCount = workerResponse.downgradedTopicCount;
        job.topicArtifactPath = workerResponse.topicArtifactPath;
        job.cacheSummary = workerResponse.cacheSummary;
        job.reportPath = workerResponse.reportPath;
        job.status = "completed";
        job.finishedAt = new Date();
        await job.save();
      } catch (error) {
        job.status = "failed";
        job.latestError = error instanceof Error ? error.message : String(error);
        job.finishedAt = new Date();
        await job.save();
      }
    }
  } finally {
    queueActive = false;
  }
};

export const createKeywordingJob = async (
  payload: CreateKeywordingJobPayload,
): Promise<KeywordingJobSnapshot> => {
  const recordIds = unique(payload.recordIds ?? []).filter((recordId) => Number.isInteger(recordId) && recordId > 0);
  if (recordIds.length === 0) {
    throw badRequest("recordIds must contain at least one record");
  }

  const records = await ensureRecordsExist(recordIds);
  const questions = await loadQuestionSet(payload.mappingQuestionIds);
  if (!(await hasEligibleExtractedDocument(recordIds))) {
    throw badRequest("At least one selected record must have an extracted PDF before keywording can start");
  }

  const analysisMode: KeywordingAnalysisMode = payload.analysisMode === "advanced" ? "advanced" : "standard";
  const reuseEmbeddingCache = payload.reuseEmbeddingCache !== false;

  const job = await db.KeywordingJob.create({
    jobId: randomUUID(),
    status: "queued",
    cancelRequested: false,
    recordIds,
    mappingQuestionIds: questions.map((question) => question.id),
    analysisMode,
    reuseEmbeddingCache,
    embeddingModel: null,
    representationModel: null,
    bertopicVersion: null,
    topicReductionApplied: false,
    topicCountBeforeReduction: null,
    topicCountAfterReduction: null,
    downgradedTopicCount: 0,
    cacheSummary: { hits: 0, misses: 0, writes: 0 },
    topicArtifactPath: null,
    total: records.length,
    processed: 0,
    summary: createEmptySummary(),
    reportPath: null,
    latestError: null,
    startedAt: null,
    finishedAt: null,
  });

  queue.push(job.id);
  void runQueuedJobs();

  return buildJobSnapshot(job);
};

export const listKeywordingJobs = async (): Promise<KeywordingJobsIndexResponse> => {
  const jobs = await db.KeywordingJob.findAll({
    order: [["createdAt", "DESC"], ["id", "DESC"]],
    limit: 50,
  });

  return {
    count: jobs.length,
    jobs: jobs.map(buildJobSnapshot),
  };
};

export const getKeywordingJob = async (jobId: string): Promise<KeywordingJobSnapshot> => {
  const job = await db.KeywordingJob.findOne({ where: { jobId } });
  if (!job) {
    throw notFound(`Keywording job ${jobId} not found`);
  }
  return buildJobSnapshot(job);
};

export const cancelKeywordingJob = async (jobId: string): Promise<KeywordingJobSnapshot> => {
  const job = await db.KeywordingJob.findOne({ where: { jobId } });
  if (!job) {
    throw notFound(`Keywording job ${jobId} not found`);
  }

  job.cancelRequested = true;
  if (job.status === "queued") {
    job.status = "cancelled";
    job.finishedAt = new Date();
  } else if (job.status === "running") {
    job.status = "cancelling";
  }
  await job.save();
  return buildJobSnapshot(job);
};

const removeStoragePath = (relativePath: string | null | undefined, options?: { removeParentDir?: boolean }) => {
  if (!relativePath) {
    return;
  }

  const absolutePath = toAbsoluteStoragePath(relativePath);
  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const stats = fs.statSync(absolutePath);
  if (stats.isDirectory()) {
    fs.rmSync(absolutePath, { recursive: true, force: true });
    return;
  }

  const parentDir = path.dirname(absolutePath);
  if (options?.removeParentDir && fs.existsSync(parentDir)) {
    fs.rmSync(parentDir, { recursive: true, force: true });
    return;
  }

  fs.rmSync(absolutePath, { force: true });

  if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
    fs.rmSync(parentDir, { recursive: true, force: true });
  }
};

export const deleteKeywordingJob = async (jobId: string): Promise<KeywordingJobSnapshot> => {
  const job = await db.KeywordingJob.findOne({ where: { jobId } });
  if (!job) {
    throw notFound(`Keywording job ${jobId} not found`);
  }
  if (job.status === "queued" || job.status === "running" || job.status === "cancelling") {
    throw badRequest(`Keywording job ${jobId} cannot be deleted while it is ${job.status}`);
  }

  const snapshot = buildJobSnapshot(job);
  const suggestions = await db.KeywordingSuggestion.findAll({
    where: { keywordingJobId: job.id },
    attributes: ["id"],
  });
  const suggestionIds = suggestions.map((suggestion) => suggestion.id);
  if (suggestionIds.length > 0) {
    await db.KeywordingEvidenceSpan.destroy({
      where: {
        keywordingSuggestionId: suggestionIds,
      },
    });
  }
  await db.KeywordingSuggestion.destroy({ where: { keywordingJobId: job.id } });
  await db.KeywordingCluster.destroy({ where: { keywordingJobId: job.id } });

  removeStoragePath(job.reportPath, { removeParentDir: true });
  removeStoragePath(job.topicArtifactPath);

  await job.destroy();
  return snapshot;
};

export const getKeywordingReport = async (jobId: string) => {
  const job = await db.KeywordingJob.findOne({ where: { jobId } });
  if (!job) {
    throw notFound(`Keywording job ${jobId} not found`);
  }
  if (!job.reportPath) {
    throw notFound(`Keywording report for job ${jobId} is not ready`);
  }

  const absolutePath = toAbsoluteStoragePath(job.reportPath);
  if (!fs.existsSync(absolutePath)) {
    throw notFound(`Keywording report for job ${jobId} is missing from storage`);
  }

  return {
    fileName: `keywording-report-${job.jobId}.zip`,
    contentType: "application/zip",
    content: fs.readFileSync(absolutePath),
  };
};

export const __resetKeywordingJobsForTests = async () => {
  queue.length = 0;
  queueActive = false;
  await db.KeywordingEvidenceSpan.destroy({ where: {} });
  await db.KeywordingSuggestion.destroy({ where: {} });
  await db.KeywordingCluster.destroy({ where: {} });
  await db.KeywordingJob.destroy({ where: {} });
};
