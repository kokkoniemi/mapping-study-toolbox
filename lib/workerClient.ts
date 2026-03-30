import type { KeywordingActionType } from "../shared/contracts";
import { ApiError } from "./http";

const WORKER_ROOT = (() => {
  const configured = process.env.KEYWORDING_WORKER_URL?.trim();
  if (configured && configured.length > 0) {
    return configured.endsWith("/") ? configured : `${configured}/`;
  }
  return "http://localhost:8001/";
})();

const WORKER_TIMEOUT_MS = Number.parseInt(process.env.KEYWORDING_WORKER_TIMEOUT_MS ?? "", 10) || 180_000;

type WorkerRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

const parseWorkerResponse = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await response.json() as T;
  }
  return await response.text() as T;
};

const workerRequest = async <T>(path: string, options: WorkerRequestOptions = {}): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WORKER_TIMEOUT_MS);

  try {
    const response = await fetch(new URL(path, WORKER_ROOT), {
      method: options.method ?? "POST",
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });

    const payload = await parseWorkerResponse<T | { detail?: string; message?: string }>(response);
    if (!response.ok) {
      const payloadMessage =
        payload && typeof payload === "object"
          ? ("detail" in payload && typeof payload.detail === "string"
            ? payload.detail
            : "message" in payload && typeof payload.message === "string"
              ? payload.message
              : undefined)
          : undefined;
      const message =
        typeof payload === "string"
          ? payload
          : payloadMessage || `Worker request failed with status ${response.status}`;
      throw new ApiError(502, "WORKER_ERROR", message, payload);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      502,
      "WORKER_UNAVAILABLE",
      error instanceof Error ? error.message : "Keywording worker is unavailable",
    );
  } finally {
    clearTimeout(timeoutId);
  }
};

export type WorkerChunk = {
  chunkKey: string;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  sectionName: string | null;
  headingPath: string[];
  text: string;
  charCount: number;
  tokenCount: number;
  embeddingReference: string | null;
  qualityScore: number | null;
  qualityFlags: string[];
};

export type WorkerExtractionResponse = {
  extractedCharacters: number;
  pageCount: number | null;
  sourceType: "unknown" | "text-pdf" | "scanned-pdf" | "mixed";
  extractorKind: string;
  extractorVersion: string;
  extractedTextPath: string;
  structuredDocumentPath: string;
  chunkManifestPath: string;
  qualityStatus: "passed" | "needs_review" | "failed";
  qualityScore: number | null;
  printableTextRatio: number | null;
  weirdCharacterRatio: number | null;
  ocrUsed: boolean;
  ocrConfidence: number | null;
  warnings: string[];
  chunks: WorkerChunk[];
};

export type WorkerEvidenceItem = {
  chunkKey: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  sectionName: string | null;
  headingPath: string[];
  excerptText: string;
  rank: number;
  score: number | null;
};

export type WorkerKeywordingSuggestion = {
  recordId: number;
  mappingQuestionId: number;
  actionType: KeywordingActionType;
  existingOptionId: number | null;
  proposedOptionLabel: string | null;
  confidence: number;
  rationale: string;
  reviewerNote: string | null;
  evidence: WorkerEvidenceItem[];
};

export type WorkerKeywordingCluster = {
  mappingQuestionId: number;
  clusterKey: string;
  label: string | null;
  actionType: KeywordingActionType;
  confidence: number;
  rationale: string;
  existingOptionIds: number[];
  proposedOptionLabels: string[];
  supportingRecordIds: number[];
  supportingChunkKeys: string[];
  supportingEvidence: Array<Record<string, unknown>>;
};

export type WorkerKeywordingResponse = {
  reportPath: string;
  summary: {
    existingSuggestionCount: number;
    newSuggestionCount: number;
    lowConfidenceCount: number;
    clusterDecisionCount: number;
    manualReviewCount: number;
    qualityFailedRecordCount: number;
    actionCounts: Record<KeywordingActionType, number>;
    skippedRecords: Array<{ recordId: number; title: string | null; reason: string }>;
    failedRecords: Array<{ recordId: number; title: string | null; reason: string }>;
  };
  suggestions: WorkerKeywordingSuggestion[];
  clusters: WorkerKeywordingCluster[];
};

export const requestWorkerExtraction = (payload: {
  recordId: number;
  documentId: number;
  absolutePdfPath: string;
  appDataDir: string;
  relativePdfPath: string;
}) => workerRequest<WorkerExtractionResponse>("extract-document", { body: payload });

export const requestWorkerKeywording = (payload: {
  jobId: string;
  appDataDir: string;
  records: Array<Record<string, unknown>>;
  mappingQuestions: Array<Record<string, unknown>>;
}) => workerRequest<WorkerKeywordingResponse>("keywording-jobs/run", { body: payload });

export const getWorkerHealth = () =>
  workerRequest<{ status: string }>("health", { method: "GET" });
