import type {
  EnrichmentResultCounts,
  EnrichmentJobMetrics as SharedEnrichmentJobMetrics,
  EnrichmentJobOptions as SharedEnrichmentJobOptions,
  EnrichmentJobResult as SharedEnrichmentJobResult,
  EnrichmentJobSnapshot as SharedEnrichmentJobSnapshot,
  EnrichmentJobStatus,
  EnrichmentResultStatus,
} from "../shared/contracts";
import type { CrossrefClient } from "./crossref";
import type { JufoClient, JufoLookupResult } from "./jufo";
import type { OpenAlexClient } from "./openalex";

export type JobStatus = EnrichmentJobStatus;
export type ResultStatus = EnrichmentResultStatus;

export type EnrichmentJobMetrics = SharedEnrichmentJobMetrics;
export type EnrichmentJobOptions = SharedEnrichmentJobOptions;
export type EnrichmentJobResult = SharedEnrichmentJobResult;
export type EnrichmentJobSnapshot = SharedEnrichmentJobSnapshot<Record<string, unknown>>;
export type JobResultCounts = EnrichmentResultCounts;

export type InternalJob = EnrichmentJobSnapshot & {
  recordIds: number[];
  options: Required<EnrichmentJobOptions>;
  latestError?: string;
};

export type ForumSnapshot = {
  id: number;
  name: string | null;
  issn: string | null;
  enrichmentProvenance: Record<string, unknown> | null;
  jufoLevel: number | null;
  jufoId?: number | null;
  jufoFetchedAt: Date | null;
  jufoLastError: string | null;
  update: (values: Record<string, unknown>) => Promise<unknown>;
};

export type JobContext = {
  jufoByIssn: Map<string, JufoLookupResult | null>;
  jufoProcessedForumIds: Set<number>;
  crossrefClient: CrossrefClient;
  openAlexClient: OpenAlexClient;
  jufoClient: JufoClient;
  metrics: EnrichmentJobMetrics;
  referenceMetadataByDoi: Map<string, {
    articleTitle: string | null;
    journalTitle: string | null;
    year: string | null;
  } | null>;
};

export type EnrichRecordResult = {
  result: EnrichmentJobResult;
  updatedRecord?: Record<string, unknown>;
};
