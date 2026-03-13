import { computed, toRef } from "vue";
import { defineStore } from "pinia";
import type { EnrichmentMode, PatchRecordPayload, RecordStatus, StatusFilter } from "@shared/contracts";

import { useDataToolsStore } from "./dataTools";
import { useFiltersStore } from "./filters";
import { useMappingStore } from "./mapping";
import { useRecordsStore } from "./records";
import { useUiStore } from "./ui";
import type {
  MappingOptionCreate,
  MappingQuestionUpdate,
  PageLength,
  RecordArrayField,
  RecordOptionLink,
  TabMode,
} from "./types";

const pageLengthOptions: PageLength[] = [20, 25, 30];

export const defaultStore = defineStore("default", () => {
  const uiStore = useUiStore();
  const filtersStore = useFiltersStore();
  const recordsStore = useRecordsStore();
  const mappingStore = useMappingStore();
  const dataToolsStore = useDataToolsStore();

  const tab = toRef(uiStore, "tab");
  const nick = toRef(uiStore, "nick");
  const dataCellsTruncated = toRef(uiStore, "dataCellsTruncated");
  const moveLock = toRef(uiStore, "moveLock");
  const enrichmentMode = toRef(uiStore, "enrichmentMode");

  const page = toRef(filtersStore, "page");
  const pageLength = toRef(filtersStore, "pageLength");
  const statusFilter = toRef(filtersStore, "statusFilter");
  const searchFilter = toRef(filtersStore, "searchFilter");
  const dataImportFilterId = toRef(filtersStore, "dataImportFilterId");

  const pageItems = toRef(recordsStore, "pageItems");
  const dataItems = toRef(recordsStore, "dataItems");
  const dataOffset = toRef(recordsStore, "dataOffset");
  const dataLimit = toRef(recordsStore, "dataLimit");
  const dataTotal = toRef(recordsStore, "dataTotal");
  const dataHasMore = toRef(recordsStore, "dataHasMore");
  const dataLoading = toRef(recordsStore, "dataLoading");
  const itemCount = toRef(recordsStore, "itemCount");
  const currentItemId = toRef(recordsStore, "currentItemId");
  const loading = toRef(recordsStore, "loading");
  const detailLoadingIds = toRef(recordsStore, "detailLoadingIds");
  const cellStates = toRef(recordsStore, "cellStates");

  const mappingQuestions = toRef(mappingStore, "mappingQuestions");

  // Expose data tools state for compatibility with incremental component migration.
  const selectedRecordIds = toRef(dataToolsStore, "selectedRecordIds");
  const toolsTab = toRef(dataToolsStore, "toolsTab");

  const currentItem = computed(() => recordsStore.currentItem);

  const getCellState = (recordId: number, field: string) => recordsStore.getCellState(recordId, field);
  const upsertCellState = (recordId: number, field: string, patch: { saving?: boolean; error?: string | null; draft?: unknown }) =>
    recordsStore.upsertCellState(recordId, field, patch);
  const clearCellState = (recordId: number, field: string) => recordsStore.clearCellState(recordId, field);
  const setCellDraft = (recordId: number, field: string, draft: unknown) =>
    recordsStore.setCellDraft(recordId, field, draft);
  const clearCellDraft = (recordId: number, field: string) => recordsStore.clearCellDraft(recordId, field);
  const setCellSaving = (recordId: number, field: string, saving: boolean) =>
    recordsStore.setCellSaving(recordId, field, saving);
  const setCellError = (recordId: number, field: string, error: string | null) =>
    recordsStore.setCellError(recordId, field, error);
  const updateRecordInPage = (recordId: number, nextRecord: Parameters<typeof recordsStore.updateRecordInPage>[1]) =>
    recordsStore.updateRecordInPage(recordId, nextRecord);

  const setPage = async (payload: number) => {
    const maxPages = Math.max(1, Math.ceil(recordsStore.itemCount / filtersStore.pageLength));
    if (payload > maxPages || payload < 1) {
      return;
    }

    filtersStore.setPage(payload);
    await recordsStore.fetchPageItems();
    recordsStore.setCurrentItem(recordsStore.pageItems[0] ?? null);
  };

  const setPageLength = async (payload: number) => {
    if (!pageLengthOptions.includes(payload as PageLength) || payload === filtersStore.pageLength) {
      return;
    }

    filtersStore.setPageLength(payload);
    filtersStore.setPage(1);
    await recordsStore.fetchPageItems();
  };

  const setCurrentItem = (payload: Parameters<typeof recordsStore.setCurrentItem>[0]) =>
    recordsStore.setCurrentItem(payload);
  const hydrateRecordDetails = async (recordId: number) => recordsStore.hydrateRecordDetails(recordId);

  const setStatusFilter = async (payload: StatusFilter) => {
    filtersStore.setStatusFilter(payload);
    if (uiStore.tab === "data") {
      await recordsStore.loadInitialData();
      return;
    }
    await recordsStore.fetchPageItems();
  };

  const setSearchFilter = async (payload: string) => {
    filtersStore.setSearchFilter(payload);
    if (uiStore.tab === "data") {
      await recordsStore.loadInitialData();
      return;
    }
    await recordsStore.fetchPageItems({ search: payload });
  };

  const setDataImportFilter = async (payload: number | null) => {
    filtersStore.setDataImportFilter(payload);
    if (uiStore.tab === "data") {
      await recordsStore.loadInitialData();
    }
  };

  const resetDataFeed = () => recordsStore.resetDataFeed();
  const loadInitialData = async () => recordsStore.loadInitialData();
  const loadMoreData = async () => recordsStore.loadMoreData();
  const fetchPageItems = async (where = {}) => recordsStore.fetchPageItems(where);
  const setItemStatus = async (payload: RecordStatus) => recordsStore.setItemStatus(payload);
  const setItemComment = async (id: number, payload: string) => recordsStore.setItemComment(id, payload);
  const patchRecord = async (recordId: number, patch: PatchRecordPayload, editedBy?: string | null) =>
    recordsStore.patchRecord(recordId, patch, editedBy);
  const setRecordArrayField = async (recordId: number, field: RecordArrayField, values: string[]) =>
    recordsStore.setRecordArrayField(recordId, field, values);
  const linkRecordMappingOption = async (recordId: number, mappingQuestionId: number, mappingOptionId: number) =>
    recordsStore.linkRecordMappingOption(recordId, mappingQuestionId, mappingOptionId);
  const unlinkRecordMappingOption = async (recordId: number, mappingOptionId: number) =>
    recordsStore.unlinkRecordMappingOption(recordId, mappingOptionId);
  const createMappingOptionAndLink = async (
    recordId: number,
    mappingQuestionId: number,
    title: string,
    color: string,
  ) => recordsStore.createMappingOptionAndLink(recordId, mappingQuestionId, title, color);

  const updateNick = (payload: string | null) => uiStore.updateNick(payload);
  const updateTab = (payload: TabMode) => uiStore.updateTab(payload);
  const setDataCellsTruncated = (payload: boolean) => uiStore.setDataCellsTruncated(payload);
  const setMoveLock = () => uiStore.setMoveLock();
  const unsetMoveLock = () => uiStore.unsetMoveLock();
  const setEnrichmentMode = (payload: EnrichmentMode) => uiStore.setEnrichmentMode(payload);

  const fetchMappingQuestions = async () => mappingStore.fetchMappingQuestions();
  const createMappingQuestion = async () => mappingStore.createMappingQuestion();
  const deleteMappingQuestion = async (id: number) => mappingStore.deleteMappingQuestion(id);
  const updateMappingQuestion = async (data: MappingQuestionUpdate) => mappingStore.updateMappingQuestion(data);

  const createMappingOption = async (data: MappingOptionCreate) => {
    const recordId = recordsStore.currentItemId;
    if (!recordId) {
      return;
    }
    await recordsStore.createMappingOptionAndLink(recordId, data.id, data.title, data.color);
  };

  const addRecordMappingOption = async (data: RecordOptionLink) => {
    const recordId = recordsStore.currentItemId;
    if (!recordId) {
      return;
    }

    await recordsStore.linkRecordMappingOption(recordId, data.mappingQuestionId, data.mappingOptionId);
  };

  const removeRecordMappingOption = async (optionId: number) => {
    const recordId = recordsStore.currentItemId;
    if (!recordId) {
      return;
    }
    await recordsStore.unlinkRecordMappingOption(recordId, optionId);
  };

  return {
    tab,
    nick,
    dataCellsTruncated,
    moveLock,
    enrichmentMode,
    page,
    pageLength,
    statusFilter,
    searchFilter,
    dataImportFilterId,
    pageItems,
    dataItems,
    dataOffset,
    dataLimit,
    dataTotal,
    dataHasMore,
    dataLoading,
    itemCount,
    currentItemId,
    currentItem,
    loading,
    detailLoadingIds,
    cellStates,
    mappingQuestions,
    selectedRecordIds,
    toolsTab,
    getCellState,
    upsertCellState,
    clearCellState,
    setCellDraft,
    clearCellDraft,
    setCellSaving,
    setCellError,
    updateRecordInPage,
    setPage,
    setPageLength,
    setCurrentItem,
    hydrateRecordDetails,
    setStatusFilter,
    setSearchFilter,
    setDataImportFilter,
    resetDataFeed,
    loadInitialData,
    loadMoreData,
    fetchPageItems,
    setItemStatus,
    setItemComment,
    patchRecord,
    setRecordArrayField,
    linkRecordMappingOption,
    unlinkRecordMappingOption,
    createMappingOptionAndLink,
    updateNick,
    updateTab,
    setDataCellsTruncated,
    fetchMappingQuestions,
    createMappingQuestion,
    deleteMappingQuestion,
    updateMappingQuestion,
    createMappingOption,
    addRecordMappingOption,
    removeRecordMappingOption,
    setMoveLock,
    unsetMoveLock,
    setEnrichmentMode,
  };
});

