import { defineStore } from "pinia";

import {
  HttpError,
  mappingQuestions,
  records,
  type MappingQuestion,
  type PatchRecordPayload,
  type QueryParams,
  type RecordItem,
  type RecordStatus,
} from "../helpers/api";

export type TabMode = "inc-exc" | "map" | "data";
export type StatusFilter = "" | "null" | "uncertain" | "excluded" | "included";
export type RecordArrayField = "databases" | "alternateUrls";

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
  page: number;
  pageLength: number;
  pageItems: RecordItem[];
  itemCount: number;
  currentItemId: number | null;
  statusFilter: StatusFilter;
  searchFilter: string;
  nick: string | null;
  loading: boolean;
  mappingQuestions: MappingQuestion[];
  moveLock: boolean;
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

const getErrorMessage = (error: unknown) => {
  if (error instanceof HttpError) {
    const data = error.response.data as { error?: { message?: string } } | undefined;
    return data?.error?.message ?? `Request failed (${error.response.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Request failed";
};

export const defaultStore = defineStore("default", {
  persist: true,
  state: (): DefaultState => ({
    tab: "inc-exc",
    page: 1,
    pageLength: 25,
    pageItems: [],
    itemCount: 0,
    currentItemId: null,
    statusFilter: "",
    searchFilter: "",
    nick: null,
    loading: false,
    mappingQuestions: [],
    moveLock: false,
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
      const index = this.pageItems.findIndex((item) => item.id === recordId);
      if (index < 0) {
        return;
      }

      const updated = normalizeRecordItem(nextRecord);
      const nextItems = [...this.pageItems];
      nextItems[index] = updated;
      this.pageItems = nextItems;

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

    setCurrentItem(payload: RecordItem | null | undefined) {
      this.currentItemId = payload?.id ?? null;
    },

    async setStatusFilter(payload: StatusFilter) {
      this.statusFilter = payload;
      this.page = 1;
      await this.fetchPageItems();
    },

    async setSearchFilter(payload: string) {
      this.searchFilter = payload;
      this.page = 1;
      await this.fetchPageItems({ search: payload });
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
      const index = this.pageItems.findIndex((item) => item.id === id);
      if (index < 0) {
        return;
      }

      const newItems = [...this.pageItems];
      const current = newItems[index];
      if (!current) {
        return;
      }

      current.comment = payload;
      this.pageItems = newItems;

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
        const message = getErrorMessage(error);
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

        const index = this.pageItems.findIndex((item) => item.id === recordId);
        if (index >= 0) {
          const current = this.pageItems[index];
          if (current) {
            const exists = current.MappingOptions.some((item) => item.id === option.data.id);
            if (!exists) {
              const nextItems = [...this.pageItems];
              nextItems[index] = {
                ...current,
                MappingOptions: [...current.MappingOptions, option.data],
              };
              this.pageItems = nextItems;
            }
          }
        }
      } catch (error) {
        this.setCellError(recordId, field, getErrorMessage(error));
        throw error;
      } finally {
        this.setCellSaving(recordId, field, false);
      }
    },

    async unlinkRecordMappingOption(recordId: number, mappingOptionId: number) {
      const record = this.pageItems.find((item) => item.id === recordId);
      if (!record) {
        return;
      }

      const option = record.MappingOptions.find((item) => item.id === mappingOptionId);
      const field = `mapping:${option?.mappingQuestionId ?? "unknown"}`;
      this.setCellSaving(recordId, field, true);
      this.setCellError(recordId, field, null);

      try {
        await records.mappingOptions.delete(recordId, mappingOptionId);
        const index = this.pageItems.findIndex((item) => item.id === recordId);
        if (index < 0) {
          return;
        }

        const current = this.pageItems[index];
        if (!current) {
          return;
        }

        const nextItems = [...this.pageItems];
        nextItems[index] = {
          ...current,
          MappingOptions: current.MappingOptions.filter((item) => item.id !== mappingOptionId),
        };
        this.pageItems = nextItems;
      } catch (error) {
        this.setCellError(recordId, field, getErrorMessage(error));
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
