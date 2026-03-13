import { computed, type Ref } from "vue";

import type { RecordItem } from "../../../helpers/api";

type RecordSelectionOptions = {
  dataItems: Ref<RecordItem[]>;
  selectedRecordIds: Ref<number[]>;
};

export const useRecordSelection = ({ dataItems, selectedRecordIds }: RecordSelectionOptions) => {
  const loadedCount = computed(() => dataItems.value.length);
  const selectedRecordCount = computed(() => selectedRecordIds.value.length);
  const selectedRecordIdSet = computed(() => new Set(selectedRecordIds.value));

  const toggleRecordSelection = (recordId: number) => {
    if (selectedRecordIds.value.includes(recordId)) {
      selectedRecordIds.value = selectedRecordIds.value.filter((id) => id !== recordId);
      return;
    }
    selectedRecordIds.value = [...selectedRecordIds.value, recordId];
  };

  const clearSelectedRecords = () => {
    selectedRecordIds.value = [];
  };

  const selectAllLoadedRecords = () => {
    selectedRecordIds.value = dataItems.value.map((record) => record.id);
  };

  const syncSelectionToLoadedRecords = () => {
    if (selectedRecordIds.value.length === 0) {
      return;
    }
    const loadedIds = new Set(dataItems.value.map((item) => item.id));
    selectedRecordIds.value = selectedRecordIds.value.filter((id) => loadedIds.has(id));
  };

  return {
    loadedCount,
    selectedRecordCount,
    selectedRecordIdSet,
    toggleRecordSelection,
    clearSelectedRecords,
    selectAllLoadedRecords,
    syncSelectionToLoadedRecords,
  };
};
