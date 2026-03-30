import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import db from "../models";
import type {
  KeywordingEvidenceSpanModel,
  KeywordingJobModel,
  KeywordingSuggestionModel,
  MappingOptionModel,
  MappingQuestionModel,
  RecordModel,
} from "../models/types";
import type {
  CreateKeywordingJobPayload,
  KeywordingEvidenceSpan,
  KeywordingJobSnapshot,
  KeywordingJobSummary,
  KeywordingJobsIndexResponse,
  KeywordingRecordIssue,
  KeywordingSuggestion,
} from "../shared/contracts";
import { badRequest, notFound } from "./http";
import { getActiveExtractedDocumentForRecord, readExtractedDocumentText } from "./recordDocuments";
import { getKeywordingReportStorageDir, toAbsoluteStoragePath, toRelativeStoragePath } from "./storagePaths";
import { buildZip } from "./zip";

const queue: number[] = [];
let queueActive = false;

const LOW_CONFIDENCE_THRESHOLD = 60;
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into", "is", "it", "its", "of", "on",
  "or", "our", "that", "the", "their", "this", "to", "using", "use", "with", "we", "within", "through",
  "study", "paper", "approach", "based", "results", "analysis", "system", "systems", "method", "methods",
]);

type QuestionWithOptions = MappingQuestionModel & {
  MappingOptions?: MappingOptionModel[];
};

const createEmptySummary = (): KeywordingJobSummary => ({
  existingSuggestionCount: 0,
  newSuggestionCount: 0,
  lowConfidenceCount: 0,
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
  reportPath: job.reportPath,
  reportReady: Boolean(job.reportPath) && job.status === "completed",
  createdAt: toIso(job.createdAt) ?? new Date(0).toISOString(),
  startedAt: toIso(job.startedAt),
  finishedAt: toIso(job.finishedAt),
  latestError: job.latestError,
  summary: normalizeSummary(job.summary),
});

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

const unique = <T>(items: T[]) => [...new Set(items)];

const splitSentences = (value: string) =>
  value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const titleCase = (value: string) => value.replace(/\b\w/g, (char) => char.toUpperCase());

const questionOptions = (question: MappingQuestionModel) =>
  Array.isArray((question as QuestionWithOptions).MappingOptions)
    ? (question as QuestionWithOptions).MappingOptions ?? []
    : [];

const scoreOption = (option: MappingOptionModel, corpusLower: string, corpusTokens: Set<string>) => {
  const optionTitle = option.title?.trim() ?? "";
  const optionTokens = unique(tokenize(optionTitle));
  if (optionTokens.length === 0) {
    return { score: 0, matchedTokens: [] as string[] };
  }

  const matchedTokens = optionTokens.filter((token) => corpusTokens.has(token));
  const titleMatch = optionTitle.length > 0 && corpusLower.includes(optionTitle.toLowerCase());
  const overlapScore = Math.round((matchedTokens.length / optionTokens.length) * 70);
  const score = Math.max(0, Math.min(99, overlapScore + (titleMatch ? 25 : 0)));
  return { score, matchedTokens };
};

const findBestSentence = (sentences: string[], tokens: string[], fallback: string) => {
  if (sentences.length === 0) {
    return fallback;
  }

  const ranked = sentences
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      const matches = tokens.filter((token) => lower.includes(token)).length;
      return { sentence, matches };
    })
    .sort((left, right) => right.matches - left.matches || left.sentence.length - right.sentence.length);

  return ranked[0]?.sentence ?? fallback;
};

const buildProposedLabel = (
  title: string | null,
  corpusTokens: string[],
  existingOptions: MappingOptionModel[],
) => {
  const excludedTokens = new Set(existingOptions.flatMap((option) => tokenize(option.title ?? "")));
  const preferredTokens = [...tokenize(title ?? ""), ...corpusTokens].filter((token) => !excludedTokens.has(token));
  const labelTokens = unique(preferredTokens).slice(0, 3);
  if (labelTokens.length === 0) {
    return "Emerging Topic";
  }
  return titleCase(labelTokens.join(" "));
};

const getSuggestionConfidence = (score: number, isExisting: boolean) =>
  Math.max(isExisting ? 55 : 40, Math.min(95, score));

const addIssue = (target: KeywordingRecordIssue[], issue: KeywordingRecordIssue) => {
  target.push(issue);
  return target;
};

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
    if (document?.extractedTextPath) {
      return true;
    }
  }
  return false;
};

const persistSuggestion = async ({
  job,
  record,
  question,
  decisionType,
  existingOptionId,
  proposedOptionLabel,
  confidence,
  rationale,
  excerptText,
  score,
}: {
  job: KeywordingJobModel;
  record: RecordModel;
  question: MappingQuestionModel;
  decisionType: "existing-option" | "new-option";
  existingOptionId: number | null;
  proposedOptionLabel: string | null;
  confidence: number;
  rationale: string;
  excerptText: string;
  score: number;
}) => {
  const suggestion = await db.KeywordingSuggestion.create({
    keywordingJobId: job.id,
    recordId: record.id,
    mappingQuestionId: question.id,
    decisionType,
    existingOptionId,
    proposedOptionLabel,
    confidence,
    rationale,
  });

  await db.KeywordingEvidenceSpan.create({
    keywordingSuggestionId: suggestion.id,
    pageStart: 1,
    pageEnd: 1,
    sectionName: "Document",
    excerptText,
    rank: 1,
    score,
  });

  return suggestion;
};

const loadSuggestionsForJob = async (keywordingJobId: number) => {
  const suggestions = await db.KeywordingSuggestion.findAll({
    where: { keywordingJobId },
    order: [["recordId", "ASC"], ["mappingQuestionId", "ASC"], ["id", "ASC"]],
  });
  if (suggestions.length === 0) {
    return { suggestions, evidenceBySuggestionId: new Map<number, KeywordingEvidenceSpanModel[]>() };
  }
  const evidence = await db.KeywordingEvidenceSpan.findAll({
    where: {
      keywordingSuggestionId: suggestions.map((suggestion) => suggestion.id),
    },
    order: [["keywordingSuggestionId", "ASC"], ["rank", "ASC"], ["id", "ASC"]],
  });

  const evidenceBySuggestionId = new Map<number, KeywordingEvidenceSpanModel[]>();
  for (const item of evidence) {
    const current = evidenceBySuggestionId.get(item.keywordingSuggestionId) ?? [];
    current.push(item);
    evidenceBySuggestionId.set(item.keywordingSuggestionId, current);
  }

  return { suggestions, evidenceBySuggestionId };
};

const evidenceToContract = (evidence: KeywordingEvidenceSpanModel): KeywordingEvidenceSpan => ({
  id: evidence.id,
  keywordingSuggestionId: evidence.keywordingSuggestionId,
  pageStart: evidence.pageStart,
  pageEnd: evidence.pageEnd,
  sectionName: evidence.sectionName,
  excerptText: evidence.excerptText,
  rank: evidence.rank,
  score: evidence.score,
  createdAt: toIso(evidence.createdAt) ?? new Date(0).toISOString(),
  updatedAt: toIso(evidence.updatedAt) ?? new Date(0).toISOString(),
});

const suggestionToContract = (
  suggestion: KeywordingSuggestionModel,
  evidenceBySuggestionId: Map<number, KeywordingEvidenceSpanModel[]>,
): KeywordingSuggestion => ({
  id: suggestion.id,
  keywordingJobId: suggestion.keywordingJobId,
  recordId: suggestion.recordId,
  mappingQuestionId: suggestion.mappingQuestionId,
  decisionType: suggestion.decisionType,
  existingOptionId: suggestion.existingOptionId,
  proposedOptionLabel: suggestion.proposedOptionLabel,
  confidence: suggestion.confidence,
  rationale: suggestion.rationale,
  createdAt: toIso(suggestion.createdAt) ?? new Date(0).toISOString(),
  updatedAt: toIso(suggestion.updatedAt) ?? new Date(0).toISOString(),
  evidenceSpans: (evidenceBySuggestionId.get(suggestion.id) ?? []).map(evidenceToContract),
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildHtmlReport = ({
  title,
  summary,
  records,
  proposedOptions,
}: {
  title: string;
  summary: KeywordingJobSummary;
  records: Array<{
    id: number;
    title: string | null;
    suggestions: KeywordingSuggestion[];
  }>;
  proposedOptions: Array<{ questionTitle: string; label: string; count: number }>;
}) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; color: #1f2937; }
    h1, h2 { margin-bottom: 0.5rem; }
    .meta, .issue-list { margin-bottom: 1rem; }
    .record { border-top: 1px solid #d1d5db; padding: 1rem 0; }
    .suggestion { margin: 0.75rem 0; padding: 0.75rem; background: #f8fafc; border-radius: 0.5rem; }
    .excerpt { color: #374151; font-style: italic; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #d1d5db; padding: 0.5rem; text-align: left; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <div>Existing suggestions: ${summary.existingSuggestionCount}</div>
    <div>New proposals: ${summary.newSuggestionCount}</div>
    <div>Low confidence cases: ${summary.lowConfidenceCount}</div>
    <div>Skipped records: ${summary.skippedRecords.length}</div>
    <div>Failed records: ${summary.failedRecords.length}</div>
  </div>
  <h2>Proposed New Options</h2>
  <table>
    <thead><tr><th>Mapping question</th><th>Label</th><th>Supporting records</th></tr></thead>
    <tbody>
      ${proposedOptions.map((item) => `<tr><td>${escapeHtml(item.questionTitle)}</td><td>${escapeHtml(item.label)}</td><td>${item.count}</td></tr>`).join("")}
    </tbody>
  </table>
  <h2>Records</h2>
  ${records.map((record) => `
    <section class="record">
      <h3>#${record.id} ${escapeHtml(record.title ?? "(untitled)")}</h3>
      ${record.suggestions.map((suggestion) => `
        <div class="suggestion">
          <div><strong>${escapeHtml(suggestion.decisionType === "existing-option" ? "Existing option" : "New proposal")}</strong></div>
          <div>Confidence: ${suggestion.confidence}</div>
          <div>${escapeHtml(suggestion.rationale)}</div>
          <div class="excerpt">${escapeHtml(suggestion.evidenceSpans[0]?.excerptText ?? "")}</div>
        </div>
      `).join("")}
    </section>
  `).join("")}
  <h2>Skipped Records</h2>
  <ul class="issue-list">
    ${summary.skippedRecords.map((item) => `<li>#${item.recordId} ${escapeHtml(item.title ?? "(untitled)")}: ${escapeHtml(item.reason)}</li>`).join("")}
  </ul>
  <h2>Failed Records</h2>
  <ul class="issue-list">
    ${summary.failedRecords.map((item) => `<li>#${item.recordId} ${escapeHtml(item.title ?? "(untitled)")}: ${escapeHtml(item.reason)}</li>`).join("")}
  </ul>
</body>
</html>
`;

const buildReportFiles = async (job: KeywordingJobModel, questions: MappingQuestionModel[], records: RecordModel[]) => {
  const summary = normalizeSummary(job.summary);
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  const optionMap = new Map(
    questions.flatMap((question) =>
      questionOptions(question).map((option) => [option.id, option] as const),
    ),
  );
  const { suggestions, evidenceBySuggestionId } = await loadSuggestionsForJob(job.id);
  const suggestionContracts = suggestions.map((suggestion) => suggestionToContract(suggestion, evidenceBySuggestionId));
  const suggestionGroups = new Map<number, KeywordingSuggestion[]>();

  for (const suggestion of suggestionContracts) {
    const current = suggestionGroups.get(suggestion.recordId) ?? [];
    current.push(suggestion);
    suggestionGroups.set(suggestion.recordId, current);
  }

  const proposedAggregates = new Map<string, { questionTitle: string; label: string; count: number }>();
  for (const suggestion of suggestionContracts.filter((item) => item.decisionType === "new-option")) {
    const label = suggestion.proposedOptionLabel ?? "Untitled proposal";
    const questionTitle = questionMap.get(suggestion.mappingQuestionId)?.title ?? `Question ${suggestion.mappingQuestionId}`;
    const key = `${suggestion.mappingQuestionId}:${label.toLowerCase()}`;
    const current = proposedAggregates.get(key) ?? { questionTitle, label, count: 0 };
    current.count += 1;
    proposedAggregates.set(key, current);
  }

  const reportJson = {
    generatedAt: new Date().toISOString(),
    job: buildJobSnapshot(job),
    mappingQuestions: questions.map((question) => ({
      id: question.id,
      title: question.title,
      type: question.type,
      options: questionOptions(question).map((option) => ({
        id: option.id,
        title: option.title,
        position: option.position,
      })),
    })),
    records: records.map((record) => ({
      id: record.id,
      title: record.title,
      suggestions: (suggestionGroups.get(record.id) ?? []).map((suggestion) => ({
        ...suggestion,
        existingOptionTitle: suggestion.existingOptionId
          ? optionMap.get(suggestion.existingOptionId)?.title ?? null
          : null,
        mappingQuestionTitle: questionMap.get(suggestion.mappingQuestionId)?.title ?? null,
      })),
    })),
    proposedOptions: [...proposedAggregates.values()],
    lowConfidenceCases: suggestionContracts.filter((item) => item.confidence < LOW_CONFIDENCE_THRESHOLD),
  };

  const html = buildHtmlReport({
    title: `Keywording audit report ${job.jobId}`,
    summary,
    records: records.map((record) => ({
      id: record.id,
      title: record.title,
      suggestions: suggestionGroups.get(record.id) ?? [],
    })),
    proposedOptions: [...proposedAggregates.values()],
  });

  const reportDir = path.join(getKeywordingReportStorageDir(), job.jobId);
  fs.mkdirSync(reportDir, { recursive: true });
  const jsonPath = path.join(reportDir, "report.json");
  const htmlPath = path.join(reportDir, "report.html");
  const zipPath = path.join(reportDir, "keywording-report.zip");

  fs.writeFileSync(jsonPath, `${JSON.stringify(reportJson, null, 2)}\n`, "utf8");
  fs.writeFileSync(htmlPath, html, "utf8");
  fs.writeFileSync(zipPath, buildZip([
    { name: "report.json", content: fs.readFileSync(jsonPath) },
    { name: "report.html", content: fs.readFileSync(htmlPath) },
  ]));

  return toRelativeStoragePath(zipPath);
};

const processSingleRecord = async ({
  job,
  record,
  questions,
  summary,
}: {
  job: KeywordingJobModel;
  record: RecordModel;
  questions: MappingQuestionModel[];
  summary: KeywordingJobSummary;
}) => {
  const document = await getActiveExtractedDocumentForRecord(record.id);
  if (!document?.extractedTextPath) {
    addIssue(summary.skippedRecords, {
      recordId: record.id,
      title: record.title,
      reason: "No active extracted PDF available",
    });
    return;
  }

  const extractedText = readExtractedDocumentText(document.extractedTextPath);
  const corpus = [record.title ?? "", record.abstract ?? "", extractedText].join("\n");
  const corpusLower = corpus.toLowerCase();
  const corpusTokenList = tokenize(corpus);
  const corpusTokens = new Set(corpusTokenList);
  const sentences = splitSentences(extractedText);
  const fallbackSentence = sentences[0] ?? (record.abstract?.trim() || record.title?.trim() || "No excerpt available");

  for (const question of questions) {
    const options = questionOptions(question);
    const rankedOptions = options
      .map((option) => ({ option, ...scoreOption(option, corpusLower, corpusTokens) }))
      .sort((left, right) => right.score - left.score || left.option.id - right.option.id);

    const [best] = rankedOptions;
    if (best && best.score >= 55) {
      const confidence = getSuggestionConfidence(best.score, true);
      if (confidence < LOW_CONFIDENCE_THRESHOLD) {
        summary.lowConfidenceCount += 1;
      }
      summary.existingSuggestionCount += 1;
      await persistSuggestion({
        job,
        record,
        question,
        decisionType: "existing-option",
        existingOptionId: best.option.id,
        proposedOptionLabel: null,
        confidence,
        rationale: `Matched existing option "${best.option.title}" from overlapping evidence terms: ${best.matchedTokens.join(", ") || "topic wording"}.`,
        excerptText: findBestSentence(sentences, best.matchedTokens, fallbackSentence),
        score: best.score,
      });
      continue;
    }

    const proposedLabel = buildProposedLabel(record.title, corpusTokenList, options);
    const evidenceTokens = tokenize(proposedLabel);
    const confidence = getSuggestionConfidence(Math.max(best?.score ?? 35, 45), false);
    if (confidence < LOW_CONFIDENCE_THRESHOLD) {
      summary.lowConfidenceCount += 1;
    }
    summary.newSuggestionCount += 1;
    await persistSuggestion({
      job,
      record,
      question,
      decisionType: "new-option",
      existingOptionId: null,
      proposedOptionLabel: proposedLabel,
      confidence,
      rationale: `No existing option matched strongly enough; proposed "${proposedLabel}" from repeated topic terms in the extracted evidence.`,
      excerptText: findBestSentence(sentences, evidenceTokens, fallbackSentence),
      score: best?.score ?? 45,
    });
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

      const summary = normalizeSummary(job.summary);
      const records = await ensureRecordsExist(Array.isArray(job.recordIds) ? job.recordIds : []);
      const questions = await loadQuestionSet(Array.isArray(job.mappingQuestionIds) ? job.mappingQuestionIds : []);

      job.status = "running";
      job.startedAt = new Date();
      job.latestError = null;
      await job.save();

      try {
        await db.KeywordingSuggestion.destroy({ where: { keywordingJobId: job.id } });

        for (const record of records) {
          const refreshedJob = await db.KeywordingJob.findByPk(job.id);
          if (!refreshedJob) {
            break;
          }
          if (refreshedJob.cancelRequested) {
            job.status = "cancelled";
            refreshedJob.status = "cancelled";
            refreshedJob.finishedAt = new Date();
            refreshedJob.summary = summary;
            await refreshedJob.save();
            break;
          }

          try {
            await processSingleRecord({ job, record, questions, summary });
          } catch (error) {
            addIssue(summary.failedRecords, {
              recordId: record.id,
              title: record.title,
              reason: error instanceof Error ? error.message : String(error),
            });
          }

          job.processed += 1;
          job.summary = summary;
          await job.save();
        }

        if (job.status !== "cancelled") {
          job.summary = summary;
          job.reportPath = await buildReportFiles(job, questions, records);
          job.status = "completed";
          job.finishedAt = new Date();
          await job.save();
        }
      } catch (error) {
        job.status = "failed";
        job.latestError = error instanceof Error ? error.message : String(error);
        job.finishedAt = new Date();
        job.summary = summary;
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

  const job = await db.KeywordingJob.create({
    jobId: randomUUID(),
    status: "queued",
    cancelRequested: false,
    recordIds,
    mappingQuestionIds: questions.map((question) => question.id),
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
  await db.KeywordingJob.destroy({ where: {} });
};
