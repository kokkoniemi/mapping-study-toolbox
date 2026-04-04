import type {
  CreateMappingQuestionPayload as SharedCreateMappingQuestionPayload,
  CreateKeywordingJobPayload,
  AssessmentCompareResponse as SharedAssessmentCompareResponse,
  AssessmentResolvePayload as SharedAssessmentResolvePayload,
  AssessmentSelection as SharedAssessmentSelection,
  AssessmentSelectionBatchResponse as SharedAssessmentSelectionBatchResponse,
  AssessmentSelectionResponse as SharedAssessmentSelectionResponse,
  AssessmentSnapshot as SharedAssessmentSnapshot,
  AssessmentSnapshotImportResponse as SharedAssessmentSnapshotImportResponse,
  AssessmentSnapshotAutoImportSummary as SharedAssessmentSnapshotAutoImportSummary,
  AssessmentSnapshotPendingResponse as SharedAssessmentSnapshotPendingResponse,
  AssessmentSnapshotSavePayload as SharedAssessmentSnapshotSavePayload,
  AssessmentSnapshotSaveResponse as SharedAssessmentSnapshotSaveResponse,
  CreateEnrichmentJobPayload,
  CreateUserProfilePayload as SharedCreateUserProfilePayload,
  UpdateUserProfilePayload as SharedUpdateUserProfilePayload,
  UpdateMappingQuestionPayload as SharedUpdateMappingQuestionPayload,
  UpsertAssessmentSelectionPayload as SharedUpsertAssessmentSelectionPayload,
  EnrichmentMode,
  EnrichmentJobSnapshot,
  EnrichmentProvenanceMap,
  ExportRequestPayload as SharedExportRequestPayload,
  ForumDuplicatesIndexResponse as SharedForumDuplicatesIndexResponse,
  ImportCreateResponse as SharedImportCreateResponse,
  ImportPreviewPayload as SharedImportPreviewPayload,
  ImportPreviewRecord as SharedImportPreviewRecord,
  ImportPreviewResponse as SharedImportPreviewResponse,
  ImportsIndexResponse as SharedImportsIndexResponse,
  KeywordingJobSnapshot as SharedKeywordingJobSnapshot,
  KeywordingJobsIndexResponse as SharedKeywordingJobsIndexResponse,
  RecordDocumentExtractResponse as SharedRecordDocumentExtractResponse,
  RecordDocumentsIndexResponse as SharedRecordDocumentsIndexResponse,
  RecordDocumentSummary as SharedRecordDocumentSummary,
  DeleteImportResponse as SharedDeleteImportResponse,
  ForumMergePayload as SharedForumMergePayload,
  ForumMergeResponse as SharedForumMergeResponse,
  MappingOptionsIndexResponse as SharedMappingOptionsIndexResponse,
  MappingQuestionsIndexResponse as SharedMappingQuestionsIndexResponse,
  PatchRecordPayload,
  RecordStatus,
  RecordsIndexResponse as SharedRecordsIndexResponse,
  UserProfile as SharedUserProfile,
  UserProfilesIndexResponse as SharedUserProfilesIndexResponse,
} from "@shared/contracts";

export type { CreateEnrichmentJobPayload, EnrichmentMode, PatchRecordPayload, RecordStatus };

const normalizeApiRoot = (value: string) => value.endsWith("/") ? value : `${value}/`;
const toAbsoluteApiRoot = (value: string) => {
  const normalized = normalizeApiRoot(value);
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(normalized)) {
    return normalized;
  }

  const origin = typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "http://localhost";
  return new URL(normalized, origin).toString();
};

const resolveApiRoot = () => {
  const configured = import.meta.env.VITE_API_ROOT;
  if (typeof configured === "string" && configured.trim().length > 0) {
    return toAbsoluteApiRoot(configured.trim());
  }
  return import.meta.env.DEV
    ? toAbsoluteApiRoot("http://localhost:3000/api/")
    : toAbsoluteApiRoot("/api/");
};

const API_ROOT = resolveApiRoot();
const REQUEST_TIMEOUT_MS = 10000;
const PDF_EXTRACTION_REQUEST_TIMEOUT_MS = 300000;
const REQUEST_RETRY_COUNT = 3;
const REQUEST_RETRY_DELAY_MS = 300;

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Primitive = string | number | boolean;
export type QueryValue = Primitive | null | undefined | Primitive[];
export type QueryParams = Record<string, QueryValue>;
export type HttpResponse<T> = {
  data: T;
  status: number;
};

type RequestOptions<TBody> = {
  params?: QueryParams | undefined;
  data?: TBody | undefined;
  timeoutMs?: number | undefined;
};

type RequestConfig = Pick<RequestOptions<never>, "params" | "timeoutMs">;
export type FileDownloadResponse = {
  blob: Blob;
  filename: string;
  contentType: string;
  status: number;
};

export class HttpError<T = unknown> extends Error {
  response: {
    status: number;
    data: T;
  };

  constructor(message: string, status: number, data: T) {
    super(message);
    this.name = "HttpError";
    this.response = { status, data };
  }
}

export const buildUrl = (path: string, params?: QueryParams): string => {
  const url = new URL(path, API_ROOT);

  if (!params) {
    return url.toString();
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, String(item)));
      return;
    }

    url.searchParams.append(key, String(value));
  });

  return url.toString();
};

const parseResponse = async <TResponse>(response: Response): Promise<TResponse> => {
  if (response.status === 204) {
    return undefined as TResponse;
  }

  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return (await response.text()) as TResponse;
  }

  const body = await response.text();
  if (!body) {
    return undefined as TResponse;
  }

  return JSON.parse(body) as TResponse;
};

const request = async <TResponse = unknown, TBody = unknown>(
  method: HttpMethod,
  path: string,
  { params, data, timeoutMs }: RequestOptions<TBody> = {},
): Promise<HttpResponse<TResponse>> => {
  const maxAttempts = method === "GET" ? REQUEST_RETRY_COUNT : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs ?? REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(buildUrl(path, params), {
        method,
        headers: {
          Accept: "application/json",
          ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
        signal: controller.signal,
      });

      const payload = await parseResponse<TResponse>(response);

      if (!response.ok) {
        throw new HttpError(`HTTP ${response.status} for ${method} ${path}`, response.status, payload);
      }

      return { data: payload, status: response.status };
    } catch (error) {
      lastError = error;

      const isRetryable =
        method === "GET"
        && attempt < maxAttempts
        && !(error instanceof HttpError);

      if (!isRetryable) {
        console.error(error);
        throw error;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, REQUEST_RETRY_DELAY_MS * attempt);
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
};

const parseFilenameFromDisposition = (disposition: string | null, fallback: string) => {
  if (!disposition) {
    return fallback;
  }

  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // Ignore malformed value and continue to quoted fallback.
    }
  }

  const quotedMatch = disposition.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1];
  }

  return fallback;
};

const requestFile = async <TBody = unknown>(
  method: HttpMethod,
  path: string,
  data?: TBody,
): Promise<FileDownloadResponse> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: {
        Accept: "*/*",
        ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
      signal: controller.signal,
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      let payload: unknown;
      if (contentType.includes("application/json")) {
        const text = await response.text();
        payload = text.length > 0 ? JSON.parse(text) : undefined;
      } else {
        payload = await response.text();
      }
      throw new HttpError(`HTTP ${response.status} for ${method} ${path}`, response.status, payload);
    }

    const blob = await response.blob();
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const fallbackName = "records-export";
    const filename = parseFilenameFromDisposition(response.headers.get("content-disposition"), fallbackName);

    return {
      blob,
      filename,
      contentType,
      status: response.status,
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const requestForm = async <TResponse = unknown>(
  method: Exclude<HttpMethod, "GET">,
  path: string,
  data: FormData,
): Promise<HttpResponse<TResponse>> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(path), {
      method,
      headers: {
        Accept: "application/json",
      },
      body: data,
      signal: controller.signal,
    });

    const payload = await parseResponse<TResponse>(response);
    if (!response.ok) {
      throw new HttpError(`HTTP ${response.status} for ${method} ${path}`, response.status, payload);
    }

    return { data: payload, status: response.status };
  } finally {
    clearTimeout(timeoutId);
  }
};

export const http = {
  get: <TResponse>(path: string, { params, timeoutMs }: RequestConfig = {}) =>
    request<TResponse>("GET", path, { params, timeoutMs }),
  post: <TResponse, TBody = unknown>(
    path: string,
    data: TBody,
    { params, timeoutMs }: RequestConfig = {},
  ) => request<TResponse, TBody>("POST", path, { params, data, timeoutMs }),
  put: <TResponse, TBody = unknown>(
    path: string,
    data: TBody,
    { params, timeoutMs }: RequestConfig = {},
  ) => request<TResponse, TBody>("PUT", path, { params, data, timeoutMs }),
  patch: <TResponse, TBody = unknown>(
    path: string,
    data: TBody,
    { params, timeoutMs }: RequestConfig = {},
  ) => request<TResponse, TBody>("PATCH", path, { params, data, timeoutMs }),
  delete: <TResponse>(path: string, { params, timeoutMs }: RequestConfig = {}) =>
    request<TResponse>("DELETE", path, { params, timeoutMs }),
};

export interface MappingOption {
  id: number;
  title: string;
  position: number;
  color: string | null;
  mappingQuestionId: number;
  [key: string]: unknown;
}

export interface MappingQuestion {
  id: number;
  title: string;
  type: string;
  position: number;
  description: string | null;
  decisionGuidance: string | null;
  positiveExamples: string[];
  negativeExamples: string[];
  evidenceInstructions: string | null;
  allowNewOption: boolean;
  MappingOptions?: MappingOption[];
  [key: string]: unknown;
}

export interface Forum {
  id: number;
  name: string;
  jufoLevel: number | null;
  jufoId?: number | null;
  issn?: string | null;
  jufoFetchedAt?: string | null;
  jufoLastError?: string | null;
  publisher?: string | null;
  enrichmentProvenance?: EnrichmentProvenanceMap | null;
  [key: string]: unknown;
}

export interface CrossrefAuthorDetail {
  given: string | null;
  family: string | null;
  name: string | null;
  sequence: string | null;
  orcid: string | null;
  affiliations: string[];
}

export interface CrossrefReferenceItem {
  doi: string | null;
  key: string | null;
  unstructured: string | null;
  articleTitle: string | null;
  journalTitle: string | null;
  author: string | null;
  year: string | null;
  volume: string | null;
  firstPage: string | null;
}

export interface OpenAlexReferenceItem {
  openAlexId: string | null;
  doi: string | null;
  title: string | null;
  year: number | null;
  url: string | null;
  forum: string | null;
  citedByCount: number | null;
}

export interface OpenAlexTopicItem {
  id: string | null;
  displayName: string | null;
  score: number | null;
  subfield: string | null;
  field: string | null;
  domain: string | null;
}

export interface RecordItem {
  id: number;
  title: string;
  author: string;
  year: number | null;
  url: string;
  databases: string[];
  alternateUrls: string[];
  enrichmentProvenance?: EnrichmentProvenanceMap | null;
  doi?: string | null;
  authorDetails?: CrossrefAuthorDetail[] | null;
  referenceItems?: CrossrefReferenceItem[] | null;
  crossrefEnrichedAt?: string | null;
  crossrefLastError?: string | null;
  openAlexId?: string | null;
  citationCount?: number | null;
  referenceCount?: number | null;
  topicCount?: number | null;
  openAlexReferenceItems?: OpenAlexReferenceItem[] | null;
  openAlexCitationItems?: OpenAlexReferenceItem[] | null;
  openAlexTopicItems?: OpenAlexTopicItem[] | null;
  openAlexAuthorAffiliations?: string[] | null;
  openAlexEnrichedAt?: string | null;
  openAlexLastError?: string | null;
  abstract: string | null;
  createdAt: string;
  updatedAt: string;
  status: RecordStatus;
  comment: string | null;
  resolvedBy?: string | null;
  resolvedByUserId?: number | null;
  Forum?: Forum | null;
  MappingOptions: MappingOption[];
  [key: string]: unknown;
}

export type EnrichmentJob = EnrichmentJobSnapshot<RecordItem>;
type RecordsIndexResponse = SharedRecordsIndexResponse<RecordItem>;
type MappingQuestionsIndexResponse = SharedMappingQuestionsIndexResponse<MappingQuestion>;
type MappingOptionsIndexResponse = SharedMappingOptionsIndexResponse<MappingOption>;
type ForumDuplicatesIndexResponse = SharedForumDuplicatesIndexResponse;
type ForumMergePayload = SharedForumMergePayload;
type ForumMergeResponse = SharedForumMergeResponse;
export type ImportPreviewRecord = SharedImportPreviewRecord;
export type ImportPreviewPayload = SharedImportPreviewPayload;
export type ImportPreviewResponse = SharedImportPreviewResponse;
export type ImportCreateResponse = SharedImportCreateResponse;
export type ImportsIndexResponse = SharedImportsIndexResponse;
export type DeleteImportResponse = SharedDeleteImportResponse;
export type RecordDocumentSummary = SharedRecordDocumentSummary;
export type RecordDocumentsIndexResponse = SharedRecordDocumentsIndexResponse;
export type RecordDocumentExtractResponse = SharedRecordDocumentExtractResponse;
export type KeywordingJob = SharedKeywordingJobSnapshot;
export type KeywordingJobsIndexResponse = SharedKeywordingJobsIndexResponse;
export type ExportRequestPayload = SharedExportRequestPayload;
export type UserProfile = SharedUserProfile;
export type UserProfilesIndexResponse = SharedUserProfilesIndexResponse;
export type CreateUserProfilePayload = SharedCreateUserProfilePayload;
export type UpdateUserProfilePayload = SharedUpdateUserProfilePayload;
export type AssessmentSelection = SharedAssessmentSelection;
export type AssessmentSelectionResponse = SharedAssessmentSelectionResponse;
export type AssessmentSelectionBatchResponse = SharedAssessmentSelectionBatchResponse;
export type UpsertAssessmentSelectionPayload = SharedUpsertAssessmentSelectionPayload;
export type AssessmentCompareResponse = SharedAssessmentCompareResponse;
export type AssessmentResolvePayload = SharedAssessmentResolvePayload;
export type AssessmentSnapshot = SharedAssessmentSnapshot;
export type AssessmentSnapshotImportResponse = SharedAssessmentSnapshotImportResponse;
export type AssessmentSnapshotAutoImportSummary = SharedAssessmentSnapshotAutoImportSummary;
export type AssessmentSnapshotPendingResponse = SharedAssessmentSnapshotPendingResponse;
export type AssessmentSnapshotSavePayload = SharedAssessmentSnapshotSavePayload;
export type AssessmentSnapshotSaveResponse = SharedAssessmentSnapshotSaveResponse;

type UpdateRecordPayload = Record<string, unknown>;
type SaveMappingOptionPayload = {
  mappingOptionId: number;
  mappingQuestionId: number;
};

type SaveQuestionPayload = {
  title: SharedCreateMappingQuestionPayload["title"];
  type: SharedCreateMappingQuestionPayload["type"];
  position: SharedCreateMappingQuestionPayload["position"];
  description: SharedCreateMappingQuestionPayload["description"];
  decisionGuidance: SharedCreateMappingQuestionPayload["decisionGuidance"];
  positiveExamples: SharedCreateMappingQuestionPayload["positiveExamples"];
  negativeExamples: SharedCreateMappingQuestionPayload["negativeExamples"];
  evidenceInstructions: SharedCreateMappingQuestionPayload["evidenceInstructions"];
  allowNewOption: SharedCreateMappingQuestionPayload["allowNewOption"];
};

type UpdateQuestionPayload = SharedUpdateMappingQuestionPayload;
type SaveQuestionOptionPayload = {
  title: string;
  position: number;
  color?: string | null;
};

type UpdateQuestionOptionPayload = Partial<SaveQuestionOptionPayload>;

export const records = {
  index: (params?: QueryParams) => http.get<RecordsIndexResponse>("records", { params }),
  get: (id: number, params?: QueryParams) => http.get<RecordItem>(`records/${id}`, { params }),
  update: (id: number, data: UpdateRecordPayload, params?: QueryParams) =>
    http.put<RecordItem, UpdateRecordPayload>(`records/${id}`, data, { params }),
  patch: (id: number, data: PatchRecordPayload, params?: QueryParams) =>
    http.patch<RecordItem, PatchRecordPayload>(`records/${id}`, data, { params }),
  exportFile: (data: ExportRequestPayload) => requestFile<ExportRequestPayload>("POST", "records/export", data),
  documents: {
    list: (recordId: number, params?: QueryParams) =>
      http.get<RecordDocumentsIndexResponse>(`records/${recordId}/documents`, { params }),
    get: (recordId: number, documentId: number, params?: QueryParams) =>
      http.get<RecordDocumentSummary>(`records/${recordId}/documents/${documentId}`, { params }),
    upload: (recordId: number, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return requestForm<RecordDocumentSummary>("POST", `records/${recordId}/documents`, formData);
    },
    remove: (recordId: number, documentId: number, params?: QueryParams) =>
      http.delete<RecordDocumentSummary>(`records/${recordId}/documents/${documentId}`, { params }),
    extract: (recordId: number, documentId: number, params?: QueryParams) =>
      http.post<RecordDocumentExtractResponse, Record<string, never>>(
        `records/${recordId}/documents/${documentId}/extract`,
        {},
        { params, timeoutMs: PDF_EXTRACTION_REQUEST_TIMEOUT_MS },
      ),
  },
  mappingOptions: {
    save: (id: number, data: SaveMappingOptionPayload, params?: QueryParams) =>
      http.post<MappingOption, SaveMappingOptionPayload>(`records/${id}/mapping-options`, data, {
        params,
      }),
    delete: (id: number, optionId: number, params?: QueryParams) =>
      http.delete<string>(`records/${id}/mapping-options/${optionId}`, { params }),
  },
  enrichment: {
    createJob: (data: CreateEnrichmentJobPayload, params?: QueryParams) =>
      http.post<EnrichmentJob, CreateEnrichmentJobPayload>("records/enrichment-jobs", data, { params }),
    getJob: (jobId: string, params?: QueryParams) =>
      http.get<EnrichmentJob>(`records/enrichment-jobs/${jobId}`, { params }),
    cancelJob: (jobId: string, params?: QueryParams) =>
      http.post<EnrichmentJob, Record<string, never>>(`records/enrichment-jobs/${jobId}/cancel`, {}, { params }),
  },
};

export const keywording = {
  index: (params?: QueryParams) =>
    http.get<KeywordingJobsIndexResponse>("keywording-jobs", { params }),
  create: (data: CreateKeywordingJobPayload, params?: QueryParams) =>
    http.post<KeywordingJob, CreateKeywordingJobPayload>("keywording-jobs", data, { params }),
  get: (jobId: string, params?: QueryParams) =>
    http.get<KeywordingJob>(`keywording-jobs/${jobId}`, { params }),
  cancel: (jobId: string, params?: QueryParams) =>
    http.post<KeywordingJob, Record<string, never>>(`keywording-jobs/${jobId}/cancel`, {}, { params }),
  remove: (jobId: string, params?: QueryParams) =>
    http.delete<KeywordingJob>(`keywording-jobs/${jobId}`, { params }),
  downloadReport: (jobId: string) =>
    requestFile("GET", `keywording-jobs/${jobId}/report`),
};

export const forums = {
  duplicates: (params?: QueryParams) =>
    http.get<ForumDuplicatesIndexResponse>("forums/duplicates", { params }),
  merge: (data: ForumMergePayload, params?: QueryParams) =>
    http.post<ForumMergeResponse, ForumMergePayload>("forums/merge", data, { params }),
};

export const imports = {
  index: (params?: QueryParams) =>
    http.get<ImportsIndexResponse>("imports", { params }),
  preview: (data: ImportPreviewPayload, params?: QueryParams) =>
    http.post<ImportPreviewResponse, ImportPreviewPayload>("imports/preview", data, { params }),
  create: (data: ImportPreviewPayload, params?: QueryParams) =>
    http.post<ImportCreateResponse, ImportPreviewPayload>("imports", data, { params }),
  delete: (id: number, params?: QueryParams) =>
    http.delete<DeleteImportResponse>(`imports/${id}`, { params }),
};

export const mappingQuestions = {
  index: (params?: QueryParams) =>
    http.get<MappingQuestionsIndexResponse>("mapping-questions", { params }),
  save: (data: SaveQuestionPayload, params?: QueryParams) =>
    http.post<MappingQuestion, SaveQuestionPayload>("mapping-questions", data, { params }),
  update: (id: number, data: UpdateQuestionPayload, params?: QueryParams) =>
    http.put<MappingQuestion, UpdateQuestionPayload>(`mapping-questions/${id}`, data, {
      params,
    }),
  delete: (id: number, params?: QueryParams) =>
    http.delete<MappingQuestion>(`mapping-questions/${id}`, { params }),
  mappingOptions: {
    index: (id: number, params?: QueryParams) =>
      http.get<MappingOptionsIndexResponse>(`mapping-questions/${id}/mapping-options`, {
        params,
      }),
    save: (id: number, data: SaveQuestionOptionPayload, params?: QueryParams) =>
      http.post<MappingOption, SaveQuestionOptionPayload>(
        `mapping-questions/${id}/mapping-options`,
        data,
        { params },
      ),
    update: (id: number, optionId: number, data: UpdateQuestionOptionPayload, params?: QueryParams) =>
      http.put<MappingOption, UpdateQuestionOptionPayload>(
        `mapping-questions/${id}/mapping-options/${optionId}`,
        data,
        { params },
      ),
    delete: (id: number, optionId: number, params?: QueryParams) =>
      http.delete<MappingOption>(`mapping-questions/${id}/mapping-options/${optionId}`, {
        params,
      }),
  },
};

export const userProfiles = {
  index: (params?: QueryParams) => http.get<UserProfilesIndexResponse>("users", { params }),
  create: (data: CreateUserProfilePayload, params?: QueryParams) =>
    http.post<UserProfile, CreateUserProfilePayload>("users", data, { params }),
  update: (id: number, data: UpdateUserProfilePayload, params?: QueryParams) =>
    http.patch<UserProfile, UpdateUserProfilePayload>(`users/${id}`, data, { params }),
};

export const assessments = {
  recordsIndex: (userId: number, params?: QueryParams) =>
    http.get<RecordsIndexResponse>("assessments/records", {
      params: { ...(params ?? {}), userId },
    }),
  index: (userId: number, recordIds: number[], params?: QueryParams) =>
    http.get<AssessmentSelectionBatchResponse>("assessments", {
      params: { ...(params ?? {}), userId, recordIds },
    }),
  get: (recordId: number, userId: number, params?: QueryParams) =>
    http.get<AssessmentSelectionResponse>(`assessments/${recordId}`, {
      params: { ...(params ?? {}), userId },
    }),
  upsert: (recordId: number, data: UpsertAssessmentSelectionPayload, params?: QueryParams) =>
    http.put<AssessmentSelectionResponse, UpsertAssessmentSelectionPayload>(`assessments/${recordId}`, data, { params }),
  compare: (userIds: number[], params?: QueryParams) =>
    http.post<AssessmentCompareResponse, { userIds: number[] }>("assessments/compare", { userIds }, { params }),
  resolve: (recordId: number, data: AssessmentResolvePayload, params?: QueryParams) =>
    http.put<RecordItem, AssessmentResolvePayload>(`assessments/${recordId}/resolve`, data, { params }),
};

export const snapshots = {
  exportUser: (userId: number, params?: QueryParams) =>
    http.get<AssessmentSnapshot>("snapshots/export", {
      params: { ...(params ?? {}), userId },
    }),
  importSnapshot: (snapshot: AssessmentSnapshot, params?: QueryParams) =>
    http.post<AssessmentSnapshotImportResponse, AssessmentSnapshot>("snapshots/import", snapshot, { params }),
  pendingUploads: (params?: QueryParams) =>
    http.get<AssessmentSnapshotPendingResponse>("snapshots/pending", { params }),
  uploadSnapshots: (params?: QueryParams) =>
    http.post<AssessmentSnapshotAutoImportSummary>("snapshots/upload", undefined, { params }),
  saveUser: (data: AssessmentSnapshotSavePayload, params?: QueryParams) =>
    http.post<AssessmentSnapshotSaveResponse, AssessmentSnapshotSavePayload>("snapshots/save", data, { params }),
};
