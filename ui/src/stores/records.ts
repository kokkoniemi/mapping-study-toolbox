import { defineStore } from "pinia";
import type { PatchRecordPayload, RecordStatus } from "@shared/contracts";

import {
  assessments,
  mappingQuestions,
  records,
  type QueryParams,
  type RecordItem,
} from "../helpers/api";
import { getApiErrorMessage } from "../helpers/errors";
import { useFiltersStore } from "./filters";
import { useMappingStore } from "./mapping";
import { useSnapshotsStore } from "./snapshots";
import { useUiStore } from "./ui";
import { useUserProfilesStore } from "./userProfiles";
import type {
  CellState,
  RecordArrayField,
  RecordsState,
} from "./types";
import { statusToFilter } from "./types";

const buildCellKey = (recordId: number, field: string) => `${recordId}:${field}`;

const normalizeRecordItem = (record: RecordItem): RecordItem => ({
  ...record,
  databases: Array.isArray(record.databases) ? record.databases : [],
  alternateUrls: Array.isArray(record.alternateUrls) ? record.alternateUrls : [],
  MappingOptions: Array.isArray(record.MappingOptions) ? record.MappingOptions : [],
});

const canEditResolvedValues = () => {
  const userProfilesStore = useUserProfilesStore();
  return userProfilesStore.canEditResolved;
};

export const useRecordsStore = defineStore("records", {
  state: (): RecordsState => ({
    pageItems: [],
    dataItems: [],
    dataOffset: 0,
    dataLimit: 100,
    dataTotal: 0,
    dataHasMore: true,
    dataLoading: false,
    itemCount: 0,
    currentItemId: null,
    loading: false,
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
    setCurrentItem(payload: RecordItem | null | undefined) {
      this.currentItemId = payload?.id ?? null;
      if (payload?.id) {
        void this.hydrateRecordDetails(payload.id);
      }
    },
    async hydrateRecordDetails(recordId: number) {
      const userProfilesStore = useUserProfilesStore();
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
        || listItem.authorDetails !== undefined;

      if (hasDetailedPayload) {
        return;
      }

      this.detailLoadingIds = [...this.detailLoadingIds, recordId];
      try {
        const detail = await records.get(recordId);
        const normalized = normalizeRecordItem(detail.data);
        if (userProfilesStore.activeProfileId) {
          const selection = await assessments.get(recordId, userProfilesStore.activeProfileId);
          const mappingStore = useMappingStore();
          const allOptions = mappingStore.mappingQuestions.flatMap((question) => question.MappingOptions ?? []);
          const selectedIds = selection.data.assessment?.mappingOptionIds ?? [];
          const selectedOptions = selectedIds
            .map((id) => allOptions.find((item) => item.id === id) ?? normalized.MappingOptions.find((item) => item.id === id))
            .filter((item): item is NonNullable<typeof item> => Boolean(item));

          this.updateRecordInPage(recordId, {
            ...normalized,
            status: selection.data.assessment?.status ?? null,
            comment: selection.data.assessment?.comment ?? null,
            MappingOptions: selectedOptions,
          });
          return;
        }

        this.updateRecordInPage(recordId, normalized);
      } catch (error) {
        console.error(error);
      } finally {
        this.detailLoadingIds = this.detailLoadingIds.filter((id) => id !== recordId);
      }
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
      const filtersStore = useFiltersStore();
      const userProfilesStore = useUserProfilesStore();
      const activeProfileId = userProfilesStore.activeProfileId;
      if (this.dataLoading || !this.dataHasMore) {
        return;
      }

      this.dataLoading = true;
      try {
        const params = {
          offset: this.dataOffset,
          limit: this.dataLimit,
          ...(filtersStore.statusFilter !== "" ? { status: filtersStore.statusFilter } : {}),
          ...(filtersStore.searchFilter !== "" ? { search: filtersStore.searchFilter } : {}),
          ...(filtersStore.dataImportFilterId !== null ? { importId: filtersStore.dataImportFilterId } : {}),
        };

        const items = activeProfileId
          ? await assessments.recordsIndex(activeProfileId, params)
          : await records.index(params);

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
      const filtersStore = useFiltersStore();
      const userProfilesStore = useUserProfilesStore();
      const activeProfileId = userProfilesStore.activeProfileId;
      const { page, pageLength, statusFilter, searchFilter } = filtersStore;
      const currentItem = this.currentItem;

      const params = {
        offset: (page - 1) * pageLength,
        limit: pageLength,
        ...where,
        ...(statusFilter !== "" ? { status: statusFilter } : {}),
        ...(searchFilter !== "" ? { search: searchFilter } : {}),
      };
      const items = activeProfileId
        ? await assessments.recordsIndex(activeProfileId, params)
        : await records.index(params);

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
      const filtersStore = useFiltersStore();
      const userProfilesStore = useUserProfilesStore();
      const snapshotsStore = useSnapshotsStore();
      const currentItem = this.currentItem;
      if (!currentItem) {
        return;
      }
      if (!canEditResolvedValues()) {
        return;
      }
      const activeProfileId = userProfilesStore.activeProfileId;
      const normalized = activeProfileId
        ? normalizeRecordItem({
          ...currentItem,
          status: (await assessments.upsert(currentItem.id, {
            userId: activeProfileId,
            status: payload,
          })).data.assessment?.status ?? null,
        })
        : normalizeRecordItem((await records.update(currentItem.id, {
          status: payload,
          resolvedBy: useUiStore().nick,
          resolvedByUserId: null,
        })).data);
      if (activeProfileId) {
        snapshotsStore.scheduleAutoSave(activeProfileId);
      }
      const index = this.pageItems.findIndex((entry) => entry.id === currentItem.id);
      if (index < 0) {
        return;
      }

      const updatedStatus = statusToFilter(normalized.status);
      let nextItem: RecordItem | null = null;

      if (filtersStore.statusFilter !== "" && filtersStore.statusFilter !== updatedStatus) {
        await this.fetchPageItems({ status: filtersStore.statusFilter });
        nextItem = this.pageItems[index] ?? this.pageItems[this.pageItems.length - 1] ?? null;
      } else {
        const newItems = [...this.pageItems];
        newItems[index] = normalized;
        this.pageItems = newItems;
        nextItem = normalized;
      }

      this.setCurrentItem(nextItem);
    },
    async setItemComment(id: number, payload: string) {
      const userProfilesStore = useUserProfilesStore();
      const snapshotsStore = useSnapshotsStore();
      if (!canEditResolvedValues()) {
        return;
      }
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

      if (userProfilesStore.activeProfileId) {
        await assessments.upsert(id, {
          userId: userProfilesStore.activeProfileId,
          comment: payload || null,
        });
        snapshotsStore.scheduleAutoSave(userProfilesStore.activeProfileId);
      } else {
        await records.update(id, {
          comment: payload || null,
          resolvedBy: useUiStore().nick,
          resolvedByUserId: null,
        });
      }
    },
    async patchRecord(recordId: number, patch: PatchRecordPayload) {
      const userProfilesStore = useUserProfilesStore();
      const snapshotsStore = useSnapshotsStore();
      if (Object.keys(patch).length === 0) {
        return;
      }
      if (!canEditResolvedValues() && ("status" in patch || "comment" in patch)) {
        return;
      }

      const fields = Object.keys(patch);
      for (const field of fields) {
        this.setCellSaving(recordId, field, true);
        this.setCellError(recordId, field, null);
      }

      const payload: PatchRecordPayload = { ...patch };
      const assessmentPayload: {
        status?: RecordStatus;
        comment?: string | null;
      } = {};

      if (userProfilesStore.activeProfileId && "status" in payload) {
        assessmentPayload.status = payload.status;
        delete payload.status;
      }
      if (userProfilesStore.activeProfileId && "comment" in payload) {
        assessmentPayload.comment = payload.comment;
        delete payload.comment;
      }

      try {
      if (
          userProfilesStore.activeProfileId
          && (assessmentPayload.status !== undefined || assessmentPayload.comment !== undefined)
        ) {
          const assessmentResponse = await assessments.upsert(recordId, {
            userId: userProfilesStore.activeProfileId,
            ...assessmentPayload,
          });
          snapshotsStore.scheduleAutoSave(userProfilesStore.activeProfileId);
          const current =
            this.pageItems.find((item) => item.id === recordId)
            ?? this.dataItems.find((item) => item.id === recordId);
          if (current) {
            this.updateRecordInPage(recordId, {
              ...current,
              status: assessmentResponse.data.assessment?.status ?? null,
              comment: assessmentResponse.data.assessment?.comment ?? null,
            });
          }
        }

        if (Object.keys(payload).length > 0) {
          if (!("resolvedBy" in payload) && !("resolvedByUserId" in payload)) {
            const activeProfile = userProfilesStore.activeProfile;
            if (activeProfile) {
              payload.resolvedBy = activeProfile.name;
              payload.resolvedByUserId = activeProfile.id;
            } else {
              const nick = useUiStore().nick;
              if (nick && nick.trim().length > 0) {
                payload.resolvedBy = nick;
              }
              payload.resolvedByUserId = null;
            }
          }
          const response = await records.patch(recordId, payload);
          this.updateRecordInPage(recordId, response.data);
        }

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
      await this.patchRecord(recordId, { [field]: values });
    },
    async linkRecordMappingOption(recordId: number, mappingQuestionId: number, mappingOptionId: number) {
      const userProfilesStore = useUserProfilesStore();
      const snapshotsStore = useSnapshotsStore();
      if (!canEditResolvedValues()) {
        return;
      }
      const field = `mapping:${mappingQuestionId}`;
      this.setCellSaving(recordId, field, true);
      this.setCellError(recordId, field, null);

      try {
        if (!userProfilesStore.activeProfileId) {
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
            if (current.MappingOptions.some((item) => item.id === option.data.id)) {
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
          return;
        }

        const current =
          this.pageItems.find((item) => item.id === recordId)
          ?? this.dataItems.find((item) => item.id === recordId);
        if (!current) {
          return;
        }
        const mappingOptionIds = [...new Set([...current.MappingOptions.map((item) => item.id), mappingOptionId])];

        const selection = await assessments.upsert(recordId, {
          userId: userProfilesStore.activeProfileId,
          mappingOptionIds,
        });
        snapshotsStore.scheduleAutoSave(userProfilesStore.activeProfileId);

        const applySelection = (items: RecordItem[]) => {
          const index = items.findIndex((item) => item.id === recordId);
          if (index < 0) {
            return null;
          }
          const current = items[index];
          if (!current) {
            return null;
          }
          const mappingStore = useMappingStore();
          const allOptions = mappingStore.mappingQuestions.flatMap((question) => question.MappingOptions ?? []);
          const selectedIds = selection.data.assessment?.mappingOptionIds ?? [];
          const selectedOptions = selectedIds
            .map((id) => allOptions.find((item) => item.id === id) ?? current.MappingOptions.find((item) => item.id === id))
            .filter((item): item is NonNullable<typeof item> => Boolean(item));

          const nextItems = [...items];
          nextItems[index] = {
            ...current,
            MappingOptions: selectedOptions,
          };
          return nextItems;
        };

        const nextPageItems = applySelection(this.pageItems);
        if (nextPageItems) {
          this.pageItems = nextPageItems;
        }

        const nextDataItems = applySelection(this.dataItems);
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
      const userProfilesStore = useUserProfilesStore();
      const snapshotsStore = useSnapshotsStore();
      if (!canEditResolvedValues()) {
        return;
      }
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
        if (!userProfilesStore.activeProfileId) {
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
          return;
        }

        const nextIds = record.MappingOptions.filter((item) => item.id !== mappingOptionId).map((item) => item.id);
        const selection = await assessments.upsert(recordId, {
          userId: userProfilesStore.activeProfileId,
          mappingOptionIds: nextIds,
        });
        snapshotsStore.scheduleAutoSave(userProfilesStore.activeProfileId);
        const removeOption = (items: RecordItem[]) => {
          const index = items.findIndex((item) => item.id === recordId);
          if (index < 0) {
            return null;
          }

          const current = items[index];
          if (!current) {
            return null;
          }

          const mappingStore = useMappingStore();
          const allOptions = mappingStore.mappingQuestions.flatMap((question) => question.MappingOptions ?? []);
          const selectedIds = selection.data.assessment?.mappingOptionIds ?? [];
          const selectedOptions = selectedIds
            .map((id) => allOptions.find((item) => item.id === id) ?? current.MappingOptions.find((item) => item.id === id))
            .filter((item): item is NonNullable<typeof item> => Boolean(item));

          const nextItems = [...items];
          nextItems[index] = {
            ...current,
            MappingOptions: selectedOptions,
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
      if (!canEditResolvedValues()) {
        return;
      }
      const mappingStore = useMappingStore();
      const question = mappingStore.mappingQuestions.find((item) => item.id === mappingQuestionId);
      if (!question) {
        return;
      }

      const option = await mappingQuestions.mappingOptions.save(mappingQuestionId, {
        title,
        position: question.MappingOptions?.length ?? 0,
        color,
      });

      await this.linkRecordMappingOption(recordId, mappingQuestionId, option.data.id);
      await mappingStore.fetchMappingQuestions();
    },
  },
});
