export const RECORD_STATUS_VALUES = [null, "uncertain", "excluded", "included"] as const;
export type RecordStatus = (typeof RECORD_STATUS_VALUES)[number];

export type StatusFilter = "" | "null" | Exclude<RecordStatus, null>;

export const STATUS_FILTER_OPTIONS: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "" },
  { label: "Unset", value: "null" },
  { label: "Uncertain", value: "uncertain" },
  { label: "Excluded", value: "excluded" },
  { label: "Included", value: "included" },
];

export type EnrichmentProvider = "crossref" | "openalex" | "all";
export type EnrichmentMode = "missing" | "full";
export type EnrichmentJobStatus = "queued" | "running" | "cancelling" | "completed" | "failed" | "cancelled";
export type EnrichmentResultStatus = "enriched" | "skipped" | "failed";
export type EnrichmentConfidenceLevel = "low" | "medium" | "high";

export type EnrichmentFieldProvenance = {
  provider: "crossref" | "openalex" | "jufo";
  confidenceLevel: EnrichmentConfidenceLevel;
  confidenceScore: number;
  reason: string;
  source: string | null;
  enrichedAt: string;
  mode: EnrichmentMode;
};

export type EnrichmentProvenanceMap = Partial<Record<string, EnrichmentFieldProvenance>>;

export type EnrichmentJobMetrics = {
  crossref: {
    records: number;
    requests: number;
  };
  openalex: {
    records: number;
    requests: number;
  };
  jufo: {
    records: number;
    requests: number;
  };
};

export type EnrichmentJobResult = {
  recordId: number;
  status: EnrichmentResultStatus;
  doi: string | null;
  message?: string;
};

export type EnrichmentResultCounts = {
  enriched: number;
  skipped: number;
  failed: number;
};

export type EnrichmentJobSnapshot<TRecord = Record<string, unknown>> = {
  jobId: string;
  status: EnrichmentJobStatus;
  cancelRequested: boolean;
  cancelRequestedAt: string | null;
  total: number;
  processed: number;
  resultCursor: number;
  updatedCursor: number;
  resultCounts: EnrichmentResultCounts;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  results: EnrichmentJobResult[];
  updatedRecords: TRecord[];
  metrics: EnrichmentJobMetrics;
};

export type RecordsIndexResponse<TRecord> = {
  count: number;
  records: TRecord[];
};

export type MappingQuestionsIndexResponse<TQuestion> = {
  count: number;
  questions: TQuestion[];
};

export type MappingOptionsIndexResponse<TOption> = {
  count: number;
  options: TOption[];
};

export type PatchRecordPayload = Partial<{
  title: string;
  author: string;
  url: string;
  year: number | null;
  status: RecordStatus;
  comment: string | null;
  abstract: string | null;
  databases: string[];
  alternateUrls: string[];
  editedBy: string;
}>;

export type CreateEnrichmentJobPayload = {
  recordIds: number[];
  provider?: EnrichmentProvider;
  mode?: EnrichmentMode;
  maxCitations?: number | null;
  forceRefresh?: boolean;
};

export type EnrichmentJobOptions = Omit<CreateEnrichmentJobPayload, "recordIds">;

export type ForumDuplicateItem = {
  id: number;
  name: string | null;
  alternateNames: string[] | null;
  issn: string | null;
  publisher: string | null;
  jufoLevel: number | null;
  recordCount: number;
};

export type ForumDuplicateGroup = {
  key: string;
  normalizedName: string | null;
  issn: string | null;
  count: number;
  forums: ForumDuplicateItem[];
};

export type ForumDuplicatesIndexResponse = {
  count: number;
  groups: ForumDuplicateGroup[];
};

export type ForumMergePayload = {
  targetForumId: number;
  sourceForumIds: number[];
  dryRun?: boolean;
};

export type ForumMergeResponse = {
  dryRun: boolean;
  targetForumId: number;
  sourceForumIds: number[];
  movedRecordCount: number;
  updatedRecordIds: number[];
  mergedAliases: string[];
};
