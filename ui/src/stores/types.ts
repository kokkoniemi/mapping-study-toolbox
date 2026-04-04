import type { EnrichmentMode, RecordStatus, StatusFilter } from "@shared/contracts";
import type { RecordItem } from "../helpers/api";

export type TabMode = "inc-exc" | "map" | "data";
export type RecordArrayField = "databases" | "alternateUrls";
export type PageLength = 20 | 25 | 30;

export type MappingQuestionUpdate = {
  id: number;
  title?: string;
  type?: string;
  position?: number;
  description?: string | null;
  decisionGuidance?: string | null;
  positiveExamples?: string[];
  negativeExamples?: string[];
  evidenceInstructions?: string | null;
  allowNewOption?: boolean;
};

export type MappingOptionCreate = {
  id: number;
  title: string;
  position: number;
  color: string;
};

export type RecordOptionLink = {
  mappingQuestionId: number;
  mappingOptionId: number;
};

export type CellState = {
  draft?: unknown;
  saving: boolean;
  error: string | null;
};

export type CellStates = Record<string, CellState>;

export type FiltersState = {
  page: number;
  pageLength: PageLength;
  statusFilter: StatusFilter;
  searchFilter: string;
  dataImportFilterId: number | null;
};

export type UiState = {
  tab: TabMode;
  nick: string | null;
  dataCellsTruncated: boolean;
  moveLock: boolean;
  enrichmentMode: EnrichmentMode;
};

export type RecordsState = {
  pageItems: RecordItem[];
  dataItems: RecordItem[];
  dataOffset: number;
  dataLimit: number;
  dataTotal: number;
  dataHasMore: boolean;
  dataLoading: boolean;
  itemCount: number;
  currentItemId: number | null;
  loading: boolean;
  detailLoadingIds: number[];
  cellStates: CellStates;
};

export const statusToFilter = (status: RecordStatus): StatusFilter => {
  if (status === null) {
    return "null";
  }
  return status;
};
