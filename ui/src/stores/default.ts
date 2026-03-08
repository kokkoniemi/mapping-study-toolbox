import { defineStore } from "pinia";

import {
  mappingQuestions,
  records,
  type MappingQuestion,
  type QueryParams,
  type RecordItem,
  type RecordStatus,
} from "../helpers/api";

export type TabMode = "inc-exc" | "map";
export type StatusFilter = "" | "null" | "uncertain" | "excluded" | "included";

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
}

const statusToFilter = (status: RecordStatus): StatusFilter => {
  if (status === null) {
    return "null";
  }
  return status;
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
    async setPage(payload: number) {
      if (payload > Math.ceil(this.itemCount / this.pageLength)) {
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

      this.pageItems = items.data.records;
      this.itemCount = items.data.count;

      const currentId = currentItem?.id;
      if (currentId === undefined || !items.data.records.some((item) => item.id === currentId)) {
        this.setCurrentItem(items.data.records[0] ?? null);
      }
    },

    async setItemStatus(payload: RecordStatus) {
      const { currentItem } = this;
      if (!currentItem) {
        return;
      }

      const item = await records.update(currentItem.id, { status: payload, editedBy: this.nick });
      const index = this.pageItems.findIndex((entry) => entry.id === currentItem.id);
      if (index < 0) {
        return;
      }

      const updatedStatus = statusToFilter(item.data.status);
      let nextItem: RecordItem | null = null;

      if (this.statusFilter !== "" && this.statusFilter !== updatedStatus) {
        await this.fetchPageItems({ status: this.statusFilter });
        nextItem = this.pageItems[index] ?? this.pageItems[this.pageItems.length - 1] ?? null;
      } else {
        const newItems = [...this.pageItems];
        newItems[index] = item.data;
        this.pageItems = newItems;
        nextItem = item.data;
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
      const { currentItemId, currentItem } = this;
      if (!currentItemId || !currentItem) {
        return;
      }

      const { id, ...rest } = data;
      const option = await mappingQuestions.mappingOptions.save(id, rest);
      const recordOption = await records.mappingOptions.save(currentItemId, {
        mappingQuestionId: id,
        mappingOptionId: option.data.id,
      });

      await this.fetchMappingQuestions();

      const index = this.pageItems.findIndex((item) => item.id === currentItem.id);
      if (index < 0) {
        return;
      }

      const updatedItem: RecordItem = {
        ...currentItem,
        MappingOptions: [...currentItem.MappingOptions, recordOption.data],
      };
      const newItems = [...this.pageItems];
      newItems[index] = updatedItem;
      this.pageItems = newItems;
    },

    async addRecordMappingOption(data: RecordOptionLink) {
      const { currentItemId, currentItem } = this;
      if (!currentItemId || !currentItem) {
        return;
      }

      const option = await records.mappingOptions.save(currentItemId, data);
      const index = this.pageItems.findIndex((item) => item.id === currentItem.id);
      if (index < 0) {
        return;
      }

      const updatedItem: RecordItem = {
        ...currentItem,
        MappingOptions: [...currentItem.MappingOptions, option.data],
      };
      const newItems = [...this.pageItems];
      newItems[index] = updatedItem;
      this.pageItems = newItems;
    },

    async removeRecordMappingOption(optionId: number) {
      const { currentItemId, currentItem } = this;
      if (!currentItemId || !currentItem) {
        return;
      }

      await records.mappingOptions.delete(currentItemId, optionId);
      const index = this.pageItems.findIndex((item) => item.id === currentItem.id);
      if (index < 0) {
        return;
      }

      const updatedItem: RecordItem = {
        ...currentItem,
        MappingOptions: currentItem.MappingOptions.filter((option) => option.id !== optionId),
      };
      const newItems = [...this.pageItems];
      newItems[index] = updatedItem;
      this.pageItems = newItems;
    },

    setMoveLock() {
      this.moveLock = true;
    },

    unsetMoveLock() {
      this.moveLock = false;
    },
  },
});
