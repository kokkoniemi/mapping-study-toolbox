import { defineStore } from "pinia";
import type { PatchRecordPayload, RecordStatus, StatusFilter } from "@shared/contracts";

import {
  mappingQuestions,
  records,
  type MappingQuestion,
  type QueryParams,
  type RecordItem,
} from "../helpers/api";
import { getApiErrorMessage } from "../helpers/errors";

export type TabMode = "inc-exc" | "map" | "data";
export type RecordArrayField = "databases" | "alternateUrls";
export type PageLength = 20 | 25 | 30;

type MappingQuestionUpdate = {
  id: number;
  title?: string;
  type?: string;
  position?: number;
};

type MappingOptionCreate = {
  id: number;
  title: string;
  position: number;
  color: string;
};

type RecordOptionLink = {
  mappingQuestionId: number;
  mappingOptionId: number;
};

type CellState = {
  draft?: unknown;
  saving: boolean;
  error: string | null;
};

type CellStates = Record<string, CellState>;

interface DefaultState {
  tab: TabMode;
  dataCellsTruncated: boolean;
  page: number;
  pageLength: PageLength;
  pageItems: RecordItem[];
  dataItems: RecordItem[];
  dataOffset: number;
  dataLimit: number;
  dataTotal: number;
  dataHasMore: boolean;
  dataLoading: boolean;
  itemCount: number;
  currentItemId: number | null;
  statusFilter: StatusFilter;
  searchFilter: string;
  nick: string | null;
  loading: boolean;
  mappingQuestions: MappingQuestion[];
  moveLock: boolean;
  detailLoadingIds: number[];
  cellStates: CellStates;
}

const statusToFilter = (status: RecordStatus): StatusFilter => {
  if (status === null) {
    return "null";
  }
  return status;
};

const buildCellKey = (recordId: number, field: string) => `${recordId}:${field}`;

const normalizeRecordItem = (record: RecordItem): RecordItem => ({
  ...record,
  databases: Array.isArray(record.databases) ? record.databases : [],
  alternateUrls: Array.isArray(record.alternateUrls) ? record.alternateUrls : [],
  MappingOptions: Array.isArray(record.MappingOptions) ? record.MappingOptions : [],
});

const pageLengthOptions: PageLength[] = [20, 25, 30];

export const defaultStore = defineStore("default", {
  persist: {
    pick: [
      "tab",
      "dataCellsTruncated",
      "pageLength",
      "statusFilter",
      "searchFilter",
      "nick",
    ],
  },
  state: (): DefaultState => ({
    tab: "inc-exc",
    dataCellsTruncated: true,
    page: 1,
    pageLength: 25,
    pageItems: [],
    dataItems: [],
    dataOffset: 0,
    dataLimit: 100,
    dataTotal: 0,
    dataHasMore: true,
    dataLoading: false,
    itemCount: 0,
    currentItemId: null,
    statusFilter: "",
    searchFilter: "",
    nick: null,
    loading: false,
    mappingQuestions: [],
    moveLock: false,
    detailLoadingIds: [],
    cellStates: {},
  }),
  getters: {
    currentItem: ({ currentItemId, pageItems }): RecordItem | null => {
      if (currentItemId === null) {
        return null;
      }
      return pageItems.find((item) => item.id === currentItemId) ?? null;
    },
  },
  actions: {
    getCellState(recordId: number, field: string): CellState {
      return this.cellStates[buildCellKey(recordId, field)] ?? { saving: false, error: null };
    },

    upsertCellState(recordId: number, field: string, patch: Partial<CellState>) {
      const key = buildCellKey(recordId, field);
      const current = this.cellStates[key] ?? { saving: false, error: null };
      this.cellStates = {
        ...this.cellStates,
        [key]: { ...current, ...patch },
      };
    },

    clearCellState(recordId: number, field: string) {
      const key = buildCellKey(recordId, field);
      if (!(key in this.cellStates)) {
        return;
      }
      const next = { ...this.cellStates };
      delete next[key];
      this.cellStates = next;
    },

    setCellDraft(recordId: number, field: string, draft: unknown) {
      this.upsertCellState(recordId, field, { draft, error: null });
    },

    clearCellDraft(recordId: number, field: string) {
      const key = buildCellKey(recordId, field);
      const current = this.cellStates[key];
      if (!current) {
        return;
      }
      this.cellStates = {
        ...this.cellStates,
        [key]: { ...current, draft: undefined },
      };
    },

    setCellSaving(recordId: number, field: string, saving: boolean) {
      this.upsertCellState(recordId, field, { saving });
    },

    setCellError(recordId: number, field: string, error: string | null) {
      this.upsertCellState(recordId, field, { error });
    },

    updateRecordInPage(recordId: number, nextRecord: RecordItem) {
      const updated = normalizeRecordItem(nextRecord);
      const pageIndex = this.pageItems.findIndex((item) => item.id === recordId);
      if (pageIndex >= 0) {
        const nextItems = [...this.pageItems];
        nextItems[pageIndex] = updated;
        this.pageItems = nextItems;
      }

      const dataIndex = this.dataItems.findIndex((item) => item.id === recordId);
      if (dataIndex >= 0) {
        const nextDataItems = [...this.dataItems];
        nextDataItems[dataIndex] = updated;
        this.dataItems = nextDataItems;
      }

      if (this.currentItemId === recordId) {
        this.currentItemId = updated.id;
      }
    },

    async setPage(payload: number) {
      const maxPages = Math.max(1, Math.ceil(this.itemCount / this.pageLength));
      if (payload > maxPages || payload < 1) {
        return;
      }

      this.page = payload;
      await this.fetchPageItems();
      this.setCurrentItem(this.pageItems[0] ?? null);
    },

    async setPageLength(payload: number) {
      if (!pageLengthOptions.includes(payload as PageLength) || payload === this.pageLength) {
        return;
      }

      this.pageLength = payload as PageLength;
      this.page = 1;
      await this.fetchPageItems();
    },

    setCurrentItem(payload: RecordItem | null | undefined) {
      this.currentItemId = payload?.id ?? null;
      if (payload?.id) {
        void this.hydrateRecordDetails(payload.id);
      }
    },

    async hydrateRecordDetails(recordId: number) {
      if (this.detailLoadingIds.includes(recordId)) {
        return;
      }

      const listItem = this.pageItems.find((item) => item.id === recordId);
      if (!listItem) {
        return;
      }

      const hasDetailedPayload =
        listItem.referenceItems !== undefined
        || listItem.openAlexCitationItems !== undefined
        || listItem.openAlexTopicItems !== undefined
        || listItem.authorDetails !== undefined;

      if (hasDetailedPayload) {
        return;
      }

      this.detailLoadingIds = [...this.detailLoadingIds, recordId];

      try {
        const detail = await records.get(recordId);
        this.updateRecordInPage(recordId, normalizeRecordItem(detail.data));
      } catch (error) {
        console.error(error);
      } finally {
        this.detailLoadingIds = this.detailLoadingIds.filter((id) => id !== recordId);
      }
    },

    async setStatusFilter(payload: StatusFilter) {
      this.statusFilter = payload;
      this.page = 1;
      if (this.tab === "data") {
        await this.loadInitialData();
        return;
      }
      await this.fetchPageItems();
    },

    async setSearchFilter(payload: string) {
      this.searchFilter = payload;
      this.page = 1;
      if (this.tab === "data") {
        await this.loadInitialData();
        return;
      }
      await this.fetchPageItems({ search: payload });
    },

    resetDataFeed() {
      this.dataItems = [];
      this.dataOffset = 0;
      this.dataTotal = 0;
      this.dataHasMore = true;
      this.dataLoading = false;
    },

    async loadInitialData() {
      this.resetDataFeed();
      await this.loadMoreData();
    },

    async loadMoreData() {
      if (this.dataLoading || !this.dataHasMore) {
        return;
      }

      this.dataLoading = true;
      try {
        const items = await records.index({
          offset: this.dataOffset,
          limit: this.dataLimit,
          ...(this.statusFilter !== "" ? { status: this.statusFilter } : {}),
          ...(this.searchFilter !== "" ? { search: this.searchFilter } : {}),
        });

        const normalized = items.data.records.map(normalizeRecordItem);
        const existingIds = new Set(this.dataItems.map((item) => item.id));
        const appended = normalized.filter((item) => !existingIds.has(item.id));

        this.dataItems = [...this.dataItems, ...appended];
        this.dataOffset += normalized.length;
        this.dataTotal = items.data.count;
        this.dataHasMore = this.dataOffset < this.dataTotal && normalized.length > 0;
      } finally {
        this.dataLoading = false;
      }
    },

    async fetchPageItems(where: QueryParams = {}) {
      const { page, pageLength, statusFilter, searchFilter, currentItem } = this;

      const items = await records.index({
        offset: (page - 1) * pageLength,
        limit: pageLength,
        ...where,
        ...(statusFilter !== "" ? { status: statusFilter } : {}),
        ...(searchFilter !== "" ? { search: searchFilter } : {}),
      });

      this.pageItems = items.data.records.map(normalizeRecordItem);
      this.itemCount = items.data.count;

      const currentId = currentItem?.id;
      if (currentId === undefined || !this.pageItems.some((item) => item.id === currentId)) {
        this.setCurrentItem(this.pageItems[0] ?? null);
      } else {
        void this.hydrateRecordDetails(currentId);
      }
    },

    async setItemStatus(payload: RecordStatus) {
      const { currentItem } = this;
      if (!currentItem) {
        return;
      }

      const item = await records.update(currentItem.id, { status: payload, editedBy: this.nick });
      const normalized = normalizeRecordItem(item.data);
      const index = this.pageItems.findIndex((entry) => entry.id === currentItem.id);
      if (index < 0) {
        return;
      }

      const updatedStatus = statusToFilter(normalized.status);
      let nextItem: RecordItem | null = null;

      if (this.statusFilter !== "" && this.statusFilter !== updatedStatus) {
        await this.fetchPageItems({ status: this.statusFilter });
        nextItem = this.pageItems[index] ?? this.pageItems[this.pageItems.length - 1] ?? null;
      } else {
        const newItems = [...this.pageItems];
        newItems[index] = normalized;
        this.pageItems = newItems;
        nextItem = normalized;
      }

      this.setCurrentItem(nextItem);
    },

    // id can differ from currentItemId because of debounce and must be given as parameter
    async setItemComment(id: number, payload: string) {
      const pageIndex = this.pageItems.findIndex((item) => item.id === id);
      const dataIndex = this.dataItems.findIndex((item) => item.id === id);
      if (pageIndex < 0 && dataIndex < 0) {
        return;
      }

      if (pageIndex >= 0) {
        const nextPageItems = [...this.pageItems];
        const current = nextPageItems[pageIndex];
        if (current) {
          current.comment = payload;
          this.pageItems = nextPageItems;
        }
      }

      if (dataIndex >= 0) {
        const nextDataItems = [...this.dataItems];
        const current = nextDataItems[dataIndex];
        if (current) {
          current.comment = payload;
          this.dataItems = nextDataItems;
        }
      }

      await records.update(id, { comment: payload || null, editedBy: this.nick });
    },

    async patchRecord(recordId: number, patch: PatchRecordPayload, editedBy?: string | null) {
      if (Object.keys(patch).length === 0) {
        return;
      }

      const fields = Object.keys(patch);
      for (const field of fields) {
        this.setCellSaving(recordId, field, true);
        this.setCellError(recordId, field, null);
      }

      const payload: PatchRecordPayload = { ...patch };
      const effectiveEditedBy = editedBy ?? this.nick;
      if (effectiveEditedBy && effectiveEditedBy.trim() !== "" && !("editedBy" in payload)) {
        payload.editedBy = effectiveEditedBy;
      }

      try {
        const response = await records.patch(recordId, payload);
        this.updateRecordInPage(recordId, response.data);

        for (const field of fields) {
          this.clearCellDraft(recordId, field);
          this.setCellSaving(recordId, field, false);
          this.setCellError(recordId, field, null);
        }
      } catch (error) {
        const message = getApiErrorMessage(error);
        for (const field of fields) {
          this.setCellSaving(recordId, field, false);
          this.setCellError(recordId, field, message);
        }
        throw error;
      }
    },

    async setRecordArrayField(recordId: number, field: RecordArrayField, values: string[]) {
      await this.patchRecord(recordId, { [field]: values }, this.nick);
    },

    async linkRecordMappingOption(recordId: number, mappingQuestionId: number, mappingOptionId: number) {
      const field = `mapping:${mappingQuestionId}`;
      this.setCellSaving(recordId, field, true);
      this.setCellError(recordId, field, null);

      try {
        const option = await records.mappingOptions.save(recordId, {
          mappingQuestionId,
          mappingOptionId,
        });

        const appendOption = (items: RecordItem[]) => {
          const index = items.findIndex((item) => item.id === recordId);
          if (index < 0) {
            return null;
          }
          const current = items[index];
          if (!current) {
            return null;
          }
          const exists = current.MappingOptions.some((item) => item.id === option.data.id);
          if (exists) {
            return null;
          }
          const nextItems = [...items];
          nextItems[index] = {
            ...current,
            MappingOptions: [...current.MappingOptions, option.data],
          };
          return nextItems;
        };

        const nextPageItems = appendOption(this.pageItems);
        if (nextPageItems) {
          this.pageItems = nextPageItems;
        }

        const nextDataItems = appendOption(this.dataItems);
        if (nextDataItems) {
          this.dataItems = nextDataItems;
        }
      } catch (error) {
        this.setCellError(recordId, field, getApiErrorMessage(error));
        throw error;
      } finally {
        this.setCellSaving(recordId, field, false);
      }
    },

    async unlinkRecordMappingOption(recordId: number, mappingOptionId: number) {
      const record =
        this.pageItems.find((item) => item.id === recordId)
        ?? this.dataItems.find((item) => item.id === recordId);
      if (!record) {
        return;
      }

      const option = record.MappingOptions.find((item) => item.id === mappingOptionId);
      const field = `mapping:${option?.mappingQuestionId ?? "unknown"}`;
      this.setCellSaving(recordId, field, true);
      this.setCellError(recordId, field, null);

      try {
        await records.mappingOptions.delete(recordId, mappingOptionId);
        const removeOption = (items: RecordItem[]) => {
          const index = items.findIndex((item) => item.id === recordId);
          if (index < 0) {
            return null;
          }

          const current = items[index];
          if (!current) {
            return null;
          }

          const nextItems = [...items];
          nextItems[index] = {
            ...current,
            MappingOptions: current.MappingOptions.filter((item) => item.id !== mappingOptionId),
          };
          return nextItems;
        };

        const nextPageItems = removeOption(this.pageItems);
        if (nextPageItems) {
          this.pageItems = nextPageItems;
        }

        const nextDataItems = removeOption(this.dataItems);
        if (nextDataItems) {
          this.dataItems = nextDataItems;
        }
      } catch (error) {
        this.setCellError(recordId, field, getApiErrorMessage(error));
        throw error;
      } finally {
        this.setCellSaving(recordId, field, false);
      }
    },

    async createMappingOptionAndLink(
      recordId: number,
      mappingQuestionId: number,
      title: string,
      color: string,
    ) {
      const question = this.mappingQuestions.find((item) => item.id === mappingQuestionId);
      if (!question) {
        return;
      }

      const option = await mappingQuestions.mappingOptions.save(mappingQuestionId, {
        title,
        position: question.MappingOptions?.length ?? 0,
        color,
      });

      await this.linkRecordMappingOption(recordId, mappingQuestionId, option.data.id);
      await this.fetchMappingQuestions();
    },

    updateNick(payload: string | null) {
      this.nick = payload;
    },

    updateTab(payload: TabMode) {
      this.tab = payload;
    },

    setDataCellsTruncated(payload: boolean) {
      this.dataCellsTruncated = payload;
    },

    async fetchMappingQuestions() {
      const items = await mappingQuestions.index();
      this.mappingQuestions = items.data.questions;
    },

    async createMappingQuestion() {
      const question = await mappingQuestions.save({
        title: "",
        type: "multiSelect",
        position: this.mappingQuestions.length,
      });
      this.mappingQuestions = [...this.mappingQuestions, { ...question.data, MappingOptions: [] }];
    },

    async deleteMappingQuestion(id: number) {
      await mappingQuestions.delete(id);
      this.mappingQuestions = this.mappingQuestions.filter((question) => question.id !== id);
    },

    async updateMappingQuestion(data: MappingQuestionUpdate) {
      const { id, ...rest } = data;
      const question = await mappingQuestions.update(id, rest);
      const index = this.mappingQuestions.findIndex((item) => item.id === id);
      if (index < 0) {
        return;
      }

      const newQuestions = [...this.mappingQuestions];
      newQuestions[index] = question.data;
      this.mappingQuestions = newQuestions;
    },

    async createMappingOption(data: MappingOptionCreate) {
      const { currentItemId } = this;
      if (!currentItemId) {
        return;
      }

      await this.createMappingOptionAndLink(currentItemId, data.id, data.title, data.color);
    },

    async addRecordMappingOption(data: RecordOptionLink) {
      const { currentItemId } = this;
      if (!currentItemId) {
        return;
      }

      await this.linkRecordMappingOption(currentItemId, data.mappingQuestionId, data.mappingOptionId);
    },

    async removeRecordMappingOption(optionId: number) {
      const { currentItemId } = this;
      if (!currentItemId) {
        return;
      }

      await this.unlinkRecordMappingOption(currentItemId, optionId);
    },

    setMoveLock() {
      this.moveLock = true;
    },

    unsetMoveLock() {
      this.moveLock = false;
    },
  },
});
