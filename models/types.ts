import type { Model, ModelStatic, Sequelize } from "sequelize";
import type * as SequelizeModule from "sequelize";
import type {
  KeywordingActionType,
  KeywordingAnalysisMode,
  EnrichmentProvenanceMap,
  KeywordingCacheSummary,
  KeywordingJobSummary,
  KeywordingJobStatus,
  KeywordingSuggestionDecisionType,
  RecordDocumentEmbeddingStatus,
  RecordDocumentExtractionStatus,
  RecordDocumentQualityStatus,
  RecordDocumentSourceType,
  RecordDocumentUploadStatus,
  RecordStatus,
} from "../shared/contracts";

export type DataTypesInstance = typeof import("sequelize").DataTypes;

type BaseModel<TAttributes extends object, TCreationAttributes extends object> =
  Model<TAttributes, TCreationAttributes> & TAttributes;

export type AssociableModel<TModel extends Model = Model> = ModelStatic<TModel> & {
  associate?: (models: DbModels) => void;
};

export interface ForumAttributes {
  id: number;
  name: string | null;
  alternateNames: string[] | null;
  enrichmentProvenance: EnrichmentProvenanceMap | null;
  jufoLevel: number | null;
  jufoId: number | null;
  jufoFetchedAt: Date | null;
  jufoLastError: string | null;
  database: string | null;
  publisher: string | null;
  issn: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type ForumCreationAttributes = Partial<ForumAttributes>;
export type ForumModel = BaseModel<ForumAttributes, ForumCreationAttributes>;
export type ForumModelStatic = AssociableModel<ForumModel>;

export interface MappingQuestionAttributes {
  id: number;
  title: string | null;
  type: string;
  position: number;
  description: string | null;
  decisionGuidance: string | null;
  positiveExamples: string[] | null;
  negativeExamples: string[] | null;
  evidenceInstructions: string | null;
  allowNewOption: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type MappingQuestionCreationAttributes = Partial<MappingQuestionAttributes>;
export type MappingQuestionModel = BaseModel<
  MappingQuestionAttributes,
  MappingQuestionCreationAttributes
>;
export type MappingQuestionModelStatic = AssociableModel<MappingQuestionModel>;

export interface MappingOptionAttributes {
  id: number;
  title: string | null;
  position: number | null;
  color: string | null;
  mappingQuestionId: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type MappingOptionCreationAttributes = Partial<MappingOptionAttributes>;
export type MappingOptionModel = BaseModel<MappingOptionAttributes, MappingOptionCreationAttributes>;
export type MappingOptionModelStatic = AssociableModel<MappingOptionModel>;

export interface RecordMappingOptionAttributes {
  id: number;
  recordId: number;
  mappingQuestionId: number;
  mappingOptionId: number;
  createdAt: Date;
  updatedAt: Date;
}

export type RecordMappingOptionCreationAttributes = Partial<RecordMappingOptionAttributes>;
export type RecordMappingOptionModel = BaseModel<
  RecordMappingOptionAttributes,
  RecordMappingOptionCreationAttributes
>;
export type RecordMappingOptionModelStatic = AssociableModel<RecordMappingOptionModel>;

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

export interface RecordAttributes {
  id: number;
  title: string | null;
  url: string | null;
  author: string | null;
  year: number | null;
  status: RecordStatus;
  abstract: string | null;
  databases: string[] | null;
  alternateUrls: string[] | null;
  enrichmentProvenance: EnrichmentProvenanceMap | null;
  doi: string | null;
  authorDetails: CrossrefAuthorDetail[] | null;
  referenceItems: CrossrefReferenceItem[] | null;
  crossrefEnrichedAt: Date | null;
  crossrefLastError: string | null;
  openAlexId: string | null;
  citationCount: number | null;
  openAlexReferenceItems: OpenAlexReferenceItem[] | null;
  openAlexCitationItems: OpenAlexReferenceItem[] | null;
  openAlexTopicItems: OpenAlexTopicItem[] | null;
  openAlexAuthorAffiliations: string[] | null;
  openAlexEnrichedAt: Date | null;
  openAlexLastError: string | null;
  forumId: number | null;
  importId: number | null;
  resolvedBy: string | null;
  resolvedByUserId: number | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type RecordCreationAttributes = Partial<RecordAttributes>;
export type RecordModel = BaseModel<RecordAttributes, RecordCreationAttributes>;
export type RecordModelStatic = AssociableModel<RecordModel> & {
  getAllByUrls: (searchUrls: string[]) => Promise<RecordModel[]>;
};

export interface RecordDocumentAttributes {
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
  extractionWarnings: string[] | null;
  embeddingStatus: RecordDocumentEmbeddingStatus;
  embeddingModel: string | null;
  embeddingTask: string | null;
  embeddingGeneratedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type RecordDocumentCreationAttributes = Partial<RecordDocumentAttributes>;
export type RecordDocumentModel = BaseModel<RecordDocumentAttributes, RecordDocumentCreationAttributes>;
export type RecordDocumentModelStatic = AssociableModel<RecordDocumentModel>;

export interface DocumentChunkAttributes {
  id: number;
  recordDocumentId: number;
  chunkKey: string;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  sectionName: string | null;
  headingPath: string[] | null;
  text: string;
  charCount: number;
  tokenCount: number;
  embeddingReference: string | null;
  embeddingModel: string | null;
  embeddingTask: string | null;
  embeddingVersion: string | null;
  embeddingChecksum: string | null;
  embeddingGeneratedAt: Date | null;
  qualityScore: number | null;
  qualityFlags: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export type DocumentChunkCreationAttributes = Partial<DocumentChunkAttributes>;
export type DocumentChunkModel = BaseModel<DocumentChunkAttributes, DocumentChunkCreationAttributes>;
export type DocumentChunkModelStatic = AssociableModel<DocumentChunkModel>;

export interface ImportAttributes {
  id: number;
  database: string | null;
  source: string | null;
  format: string | null;
  fileName: string | null;
  total: number | null;
  imported: number | null;
  dublicates: number | null;
  namesakes: string[] | null;
  query: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type ImportCreationAttributes = Partial<ImportAttributes>;
export type ImportModel = BaseModel<ImportAttributes, ImportCreationAttributes>;
export type ImportModelStatic = AssociableModel<ImportModel>;

export interface UserProfileAttributes {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserProfileCreationAttributes = Partial<UserProfileAttributes>;
export type UserProfileModel = BaseModel<UserProfileAttributes, UserProfileCreationAttributes>;
export type UserProfileModelStatic = AssociableModel<UserProfileModel>;

export interface RecordAssessmentAttributes {
  id: number;
  recordId: number;
  userId: number;
  status: RecordStatus;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type RecordAssessmentCreationAttributes = Partial<RecordAssessmentAttributes>;
export type RecordAssessmentModel = BaseModel<
  RecordAssessmentAttributes,
  RecordAssessmentCreationAttributes
>;
export type RecordAssessmentModelStatic = AssociableModel<RecordAssessmentModel>;

export interface RecordAssessmentOptionAttributes {
  id: number;
  recordAssessmentId: number;
  mappingOptionId: number;
  createdAt: Date;
  updatedAt: Date;
}

export type RecordAssessmentOptionCreationAttributes = Partial<RecordAssessmentOptionAttributes>;
export type RecordAssessmentOptionModel = BaseModel<
  RecordAssessmentOptionAttributes,
  RecordAssessmentOptionCreationAttributes
>;
export type RecordAssessmentOptionModelStatic = AssociableModel<RecordAssessmentOptionModel>;

export interface KeywordingJobAttributes {
  id: number;
  jobId: string;
  status: KeywordingJobStatus;
  cancelRequested: boolean;
  recordIds: number[];
  mappingQuestionIds: number[];
  analysisMode: KeywordingAnalysisMode;
  reuseEmbeddingCache: boolean;
  embeddingModel: string | null;
  bertopicVersion: string | null;
  cacheSummary: KeywordingCacheSummary | null;
  topicArtifactPath: string | null;
  total: number;
  processed: number;
  summary: KeywordingJobSummary | null;
  reportPath: string | null;
  latestError: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type KeywordingJobCreationAttributes = Partial<KeywordingJobAttributes>;
export type KeywordingJobModel = BaseModel<KeywordingJobAttributes, KeywordingJobCreationAttributes>;
export type KeywordingJobModelStatic = AssociableModel<KeywordingJobModel>;

export interface KeywordingSuggestionAttributes {
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
  createdAt: Date;
  updatedAt: Date;
}

export type KeywordingSuggestionCreationAttributes = Partial<KeywordingSuggestionAttributes>;
export type KeywordingSuggestionModel = BaseModel<
  KeywordingSuggestionAttributes,
  KeywordingSuggestionCreationAttributes
>;
export type KeywordingSuggestionModelStatic = AssociableModel<KeywordingSuggestionModel>;

export interface KeywordingEvidenceSpanAttributes {
  id: number;
  keywordingSuggestionId: number;
  recordDocumentId: number | null;
  documentChunkId: number | null;
  chunkKey: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  sectionName: string | null;
  headingPath: string[] | null;
  excerptText: string;
  rank: number;
  score: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type KeywordingEvidenceSpanCreationAttributes = Partial<KeywordingEvidenceSpanAttributes>;
export type KeywordingEvidenceSpanModel = BaseModel<
  KeywordingEvidenceSpanAttributes,
  KeywordingEvidenceSpanCreationAttributes
>;
export type KeywordingEvidenceSpanModelStatic = AssociableModel<KeywordingEvidenceSpanModel>;

export interface KeywordingClusterAttributes {
  id: number;
  keywordingJobId: number;
  mappingQuestionId: number;
  clusterKey: string;
  label: string | null;
  actionType: KeywordingActionType;
  topicId: number | null;
  parentTopicId: number | null;
  isOutlier: boolean;
  topTerms: string[] | null;
  representativeChunkKeys: string[] | null;
  representationSource: string | null;
  topicSize: number | null;
  confidence: number;
  rationale: string;
  existingOptionIds: number[] | null;
  proposedOptionLabels: string[] | null;
  supportingRecordIds: number[] | null;
  supportingChunkKeys: string[] | null;
  supportingEvidence: Array<Record<string, unknown>> | null;
  createdAt: Date;
  updatedAt: Date;
}

export type KeywordingClusterCreationAttributes = Partial<KeywordingClusterAttributes>;
export type KeywordingClusterModel = BaseModel<KeywordingClusterAttributes, KeywordingClusterCreationAttributes>;
export type KeywordingClusterModelStatic = AssociableModel<KeywordingClusterModel>;

export interface DbModels {
  Record: RecordModelStatic;
  RecordDocument: RecordDocumentModelStatic;
  DocumentChunk: DocumentChunkModelStatic;
  Forum: ForumModelStatic;
  MappingQuestion: MappingQuestionModelStatic;
  MappingOption: MappingOptionModelStatic;
  RecordMappingOption: RecordMappingOptionModelStatic;
  Import: ImportModelStatic;
  UserProfile: UserProfileModelStatic;
  RecordAssessment: RecordAssessmentModelStatic;
  RecordAssessmentOption: RecordAssessmentOptionModelStatic;
  KeywordingJob: KeywordingJobModelStatic;
  KeywordingSuggestion: KeywordingSuggestionModelStatic;
  KeywordingEvidenceSpan: KeywordingEvidenceSpanModelStatic;
  KeywordingCluster: KeywordingClusterModelStatic;
  sequelize: Sequelize;
  Sequelize: typeof SequelizeModule;
}

export type ModelFactory<TModel extends AssociableModel = AssociableModel> = (
  sequelize: Sequelize,
  dataTypes: DataTypesInstance,
) => TModel;
