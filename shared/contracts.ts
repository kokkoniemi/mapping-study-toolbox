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
export type RecordDocumentUploadStatus = "uploaded" | "deleted";
export type RecordDocumentExtractionStatus = "pending" | "queued" | "running" | "completed" | "failed" | "needs_review";
export type RecordDocumentSourceType = "unknown" | "text-pdf" | "scanned-pdf" | "mixed";
export type RecordDocumentQualityStatus = "pending" | "passed" | "needs_review" | "failed";
export type RecordDocumentEmbeddingStatus = "not_ready" | "pending" | "ready" | "stale";
export type KeywordingJobStatus = "queued" | "running" | "cancelling" | "completed" | "failed" | "cancelled";
export type KeywordingSuggestionDecisionType = "existing-option" | "new-option";
export type KeywordingAnalysisMode = "standard" | "advanced";
export type KeywordingActionType =
  | "reuse_existing"
  | "create_new"
  | "split_existing"
  | "merge_existing"
  | "abstain";

export type MappingQuestionGuidanceFields = {
  description: string | null;
  decisionGuidance: string | null;
  positiveExamples: string[];
  negativeExamples: string[];
  evidenceInstructions: string | null;
  allowNewOption: boolean;
};

export type RecordDocumentSummary = {
  id: number;
  recordId: number;
  originalFileName: string;
  storedPath: string;
  mimeType: string;
  checksum: string;
  fileSize: number;
  uploadStatus: RecordDocumentUploadStatus;
  extractionStatus: RecordDocumentExtractionStatus;
  sourceType: RecordDocumentSourceType;
  pageCount: number | null;
  extractorKind: string | null;
  extractorVersion: string | null;
  extractedTextPath: string | null;
  structuredDocumentPath: string | null;
  chunkManifestPath: string | null;
  extractionError: string | null;
  qualityStatus: RecordDocumentQualityStatus;
  qualityScore: number | null;
  printableTextRatio: number | null;
  weirdCharacterRatio: number | null;
  ocrUsed: boolean;
  ocrConfidence: number | null;
  extractionWarnings: string[];
  embeddingStatus: RecordDocumentEmbeddingStatus;
  embeddingModel: string | null;
  embeddingTask: string | null;
  embeddingGeneratedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecordDocumentsIndexResponse = {
  count: number;
  documents: RecordDocumentSummary[];
};

export type RecordDocumentExtractResponse = {
  document: RecordDocumentSummary;
  extractedCharacters: number;
  chunkCount: number;
};

export type KeywordingEvidenceSpan = {
  id: number;
  keywordingSuggestionId: number;
  recordDocumentId: number | null;
  documentChunkId: number | null;
  chunkKey: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  sectionName: string | null;
  headingPath: string[];
  excerptText: string;
  rank: number;
  score: number | null;
  createdAt: string;
  updatedAt: string;
};

export type KeywordingSuggestion = {
  id: number;
  keywordingJobId: number;
  recordId: number;
  mappingQuestionId: number;
  actionType: KeywordingActionType;
  decisionType: KeywordingSuggestionDecisionType;
  existingOptionId: number | null;
  proposedOptionLabel: string | null;
  confidence: number;
  rationale: string;
  reviewerNote: string | null;
  createdAt: string;
  updatedAt: string;
  evidenceSpans: KeywordingEvidenceSpan[];
};

export type KeywordingRecordIssue = {
  recordId: number;
  title: string | null;
  reason: string;
};

export type KeywordingJobSummary = {
  existingSuggestionCount: number;
  newSuggestionCount: number;
  lowConfidenceCount: number;
  clusterDecisionCount: number;
  manualReviewCount: number;
  qualityFailedRecordCount: number;
  outlierTopicCount: number;
  actionCounts: Record<KeywordingActionType, number>;
  skippedRecords: KeywordingRecordIssue[];
  failedRecords: KeywordingRecordIssue[];
};

export type KeywordingCacheSummary = {
  hits: number;
  misses: number;
  writes: number;
};

export type KeywordingJobSnapshot = {
  id: number;
  jobId: string;
  status: KeywordingJobStatus;
  cancelRequested: boolean;
  total: number;
  processed: number;
  recordIds: number[];
  mappingQuestionIds: number[];
  analysisMode: KeywordingAnalysisMode;
  reuseEmbeddingCache: boolean;
  embeddingModel: string | null;
  bertopicVersion: string | null;
  topicArtifactPath: string | null;
  cacheSummary: KeywordingCacheSummary;
  reportPath: string | null;
  reportReady: boolean;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  latestError: string | null;
  summary: KeywordingJobSummary;
};

export type KeywordingJobsIndexResponse = {
  count: number;
  jobs: KeywordingJobSnapshot[];
};

export type CreateKeywordingJobPayload = {
  recordIds: number[];
  mappingQuestionIds?: number[];
  analysisMode?: KeywordingAnalysisMode;
  reuseEmbeddingCache?: boolean;
};

export type CreateMappingQuestionPayload = {
  title: string;
  type: string;
  position: number;
} & MappingQuestionGuidanceFields;

export type UpdateMappingQuestionPayload = Partial<CreateMappingQuestionPayload>;

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

export type OpenAlexTopicPatchItem = {
  id: string | null;
  displayName: string;
  score: number | null;
  subfield: string | null;
  field: string | null;
  domain: string | null;
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
  openAlexTopicItems: OpenAlexTopicPatchItem[] | null;
  resolvedBy: string | null;
  resolvedByUserId: number | null;
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

export const IMPORT_SOURCE_VALUES = ["auto", "scopus", "acm", "google-scholar", "other-csv", "other-bibtex"] as const;
export type ImportSource = (typeof IMPORT_SOURCE_VALUES)[number];
export type ImportDetectedSource = Exclude<ImportSource, "auto">;
export type ImportFormat = "csv" | "bibtex";
export type ImportRowStatus = "new" | "duplicate" | "invalid";
export type ImportDuplicateReason = "doi" | "url" | "title-author-year" | "batch";
export const CSV_IMPORT_FIELD_KEYS = [
  "title",
  "author",
  "year",
  "doi",
  "url",
  "abstract",
  "forumName",
  "publisher",
  "issn",
  "alternateUrls",
] as const;
export type CsvImportFieldKey = (typeof CSV_IMPORT_FIELD_KEYS)[number];
export type CsvImportMapping = Partial<Record<CsvImportFieldKey, string | null>>;

export type ImportPreviewRecord = {
  rowNumber: number;
  status: ImportRowStatus;
  duplicateReason: ImportDuplicateReason | null;
  duplicateRecordId: number | null;
  errors: string[];
  title: string | null;
  author: string | null;
  year: number | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  forumName: string | null;
  publisher: string | null;
  issn: string | null;
  databases: string[];
  alternateUrls: string[];
};

export type ImportPreviewPayload = {
  fileName: string;
  source?: ImportSource;
  databaseName?: string | null;
  content: string;
  csvMapping?: CsvImportMapping;
};

export type ImportPreviewResponse = {
  detectedFormat: ImportFormat;
  detectedSource: ImportDetectedSource;
  databaseLabel: string;
  csvColumns: string[] | null;
  suggestedCsvMapping: CsvImportMapping | null;
  appliedCsvMapping: CsvImportMapping | null;
  total: number;
  parsed: number;
  newRecords: number;
  duplicates: number;
  invalid: number;
  records: ImportPreviewRecord[];
  warnings: string[];
};

export type CreateImportPayload = ImportPreviewPayload;

export type ImportSummary = {
  id: number;
  database: string | null;
  source: ImportDetectedSource | null;
  format: ImportFormat | null;
  fileName: string | null;
  total: number | null;
  imported: number | null;
  dublicates: number | null;
  namesakes: string[] | null;
  query: string | null;
  createdAt: string;
  updatedAt: string;
  recordCount: number;
};

export type ImportCreateResponse = {
  import: ImportSummary;
  summary: ImportPreviewResponse;
  createdRecordIds: number[];
};

export type ImportsIndexResponse = {
  count: number;
  imports: ImportSummary[];
};

export type DeleteImportResponse = {
  importId: number;
  deletedImport: boolean;
  deletedRecords: number;
};

export type UserProfile = {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserProfilesIndexResponse = {
  count: number;
  users: UserProfile[];
};

export type CreateUserProfilePayload = {
  name: string;
};

export type UpdateUserProfilePayload = Partial<{
  name: string;
  isActive: boolean;
}>;

export type AssessmentSelection = {
  recordId: number;
  userId: number;
  status: RecordStatus;
  comment: string | null;
  mappingOptionIds: number[];
  updatedAt: string;
};

export type AssessmentSelectionResponse = {
  assessment: AssessmentSelection | null;
};

export type AssessmentSelectionBatchResponse = {
  count: number;
  assessments: AssessmentSelection[];
};

export type UpsertAssessmentSelectionPayload = {
  userId: number;
  status?: RecordStatus;
  comment?: string | null;
  mappingOptionIds?: number[];
};

export type AssessmentSnapshot = {
  version: 1;
  exportedAt: string;
  user: {
    id: number;
    name: string;
  };
  assessments: AssessmentSelection[];
};

export type AssessmentSnapshotImportResponse = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  userId: number;
};

export type AssessmentSnapshotSavePayload = {
  userId: number;
};

export type AssessmentSnapshotAutoImportItem = {
  file: string;
  userId: number;
  userName?: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
};

export type AssessmentSnapshotAutoImportSummary = {
  scannedFiles: number;
  importedSnapshots: number;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  imports: AssessmentSnapshotAutoImportItem[];
};

export type AssessmentSnapshotSaveResponse = {
  userId: number;
  path: string;
  changed: boolean;
  savedAt: string;
  importSync?: AssessmentSnapshotAutoImportSummary;
};

export type AssessmentSnapshotPendingResponse = {
  scannedFiles: number;
  pendingSnapshots: number;
  errors: string[];
  items: AssessmentSnapshotAutoImportItem[];
};

export type PairwiseAgreement = {
  userIdA: number;
  userIdB: number;
  metricType: "status" | "mapping_question" | "mapping_all" | "status_mapping_all";
  metricKey: string;
  metricLabel: string;
  mappingQuestionId: number | null;
  sharedCount: number;
  agreementPercent: number;
  kappa: number;
  kappaCi95Lower: number | null;
  kappaCi95Upper: number | null;
};

export type AssessmentDisagreementItem = {
  recordId: number;
  values: Array<{
    userId: number;
    status: RecordStatus;
    comment: string | null;
    mappingOptionIds: number[];
  }>;
  statusDisagreement: boolean;
  mappingDisagreement: boolean;
};

export type AssessmentCompareResponse = {
  users: UserProfile[];
  pairwise: PairwiseAgreement[];
  disagreements: AssessmentDisagreementItem[];
};

export type AssessmentResolvePayload = Partial<{
  status: RecordStatus;
  comment: string | null;
  mappingOptionIds: number[];
}>;

export type ExportFormat = "csv" | "bibtex";
export type ExportScope = "selected" | "all_filtered";

export type ExportFilters = {
  status?: StatusFilter;
  search?: string;
  importId?: number;
};

export type ExportRequestPayload = {
  format: ExportFormat;
  scope: ExportScope;
  fields: string[];
  recordIds?: number[];
  filters?: ExportFilters;
};
