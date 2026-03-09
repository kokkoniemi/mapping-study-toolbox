<template>
  <section class="data-tab">
    <header class="data-toolbar">
      <div class="data-toolbar__group">
        <label>Status</label>
        <select :value="statusFilter" @change="onStatusFilterChange">
          <option v-for="option in statusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </div>

      <div class="data-toolbar__group data-toolbar__group--search">
        <label>Search</label>
        <input
          :value="searchInput"
          @input="onSearchInput"
          placeholder="Search title, abstract, comment..."
          type="text"
        />
      </div>

      <div class="data-toolbar__meta">
        Loaded {{ loadedCount }} / {{ totalCountLabel }}
      </div>
    </header>

    <div class="data-grid-shell" ref="dataGridShellRef">
      <hot-table
        ref="hotTableRef"
        :data="tableRows"
        :columns="columns"
        :colHeaders="columnHeaders"
        :rowHeaders="false"
        :autoWrapRow="false"
        :autoWrapCol="false"
        :copyPaste="true"
        :fillHandle="true"
        :manualColumnResize="true"
        :stretchH="'none'"
        :width="'100%'"
        :height="gridHeight"
        :licenseKey="'non-commercial-and-evaluation'"
        :afterChange="onAfterChange"
        :afterScrollVertically="onAfterScrollVertically"
        :cells="cellMetaFactory"
        :className="'ht-theme-main'"
      />
    </div>

    <footer class="data-footer">
      <span v-if="dataLoading">Loading more records...</span>
      <span v-else-if="!dataHasMore">All records loaded</span>
      <span v-else>Scroll to load more</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { format as formatDate } from "date-fns";
import { HotTable } from "@handsontable/vue3";
import { registerAllModules } from "handsontable/registry";
import type { CellChange } from "handsontable/common";
import type { CellProperties, ColumnSettings, GridSettings } from "handsontable/settings";

import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-main.min.css";

import { debounce } from "../helpers/utils";
import { defaultStore, type StatusFilter } from "../stores/default";
import type { RecordItem, RecordStatus } from "../helpers/api";

registerAllModules();

type GridRow = Record<string, string | number> & { __recordId: number };

type HotInstance = {
  render: () => void;
  rootElement?: HTMLElement;
};

const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "" },
  { label: "Unset", value: "null" },
  { label: "Uncertain", value: "uncertain" },
  { label: "Excluded", value: "excluded" },
  { label: "Included", value: "included" },
];

const editableSources = new Set<string>([
  "edit",
  "CopyPaste.paste",
  "Autofill.fill",
  "UndoRedo.undo",
  "UndoRedo.redo",
]);

const store = defaultStore();
const {
  dataItems,
  dataTotal,
  dataHasMore,
  dataLoading,
  statusFilter,
  searchFilter,
  mappingQuestions,
  cellStates,
} = storeToRefs(store);

const hotTableRef = ref<{ hotInstance?: HotInstance } | null>(null);
const dataGridShellRef = ref<HTMLElement | null>(null);
const searchInput = ref(searchFilter.value);
const gridHeight = ref(520);

let gridResizeObserver: ResizeObserver | null = null;

const loadedCount = computed(() => dataItems.value.length);

const totalCountLabel = computed(() => {
  if (dataLoading.value && dataTotal.value <= 0) {
    return "...";
  }
  return String(dataTotal.value);
});

const formatTimestamp = (value: string) => formatDate(new Date(value), "dd.MM.yyyy HH:mm:ss");

const stringListToCell = (items: string[] | null | undefined) => (Array.isArray(items) ? items.join(", ") : "");

const recordMappingCellValue = (record: RecordItem, questionId: number) =>
  record.MappingOptions.filter((option) => option.mappingQuestionId === questionId)
    .map((option) => option.title)
    .join(", ");

const tableRows = computed<GridRow[]>(() =>
  dataItems.value.map((record) => {
    const row: GridRow = {
      __recordId: record.id,
      id: record.id,
      title: record.title,
      abstract: record.abstract ?? "",
      status: record.status ?? "null",
      comment: record.comment ?? "",
      author: record.author,
      publication: record.Publication
        ? `${record.Publication.name ?? "-"} | jufo: ${record.Publication.jufoLevel ?? "-"}`
        : "-",
      url: record.url,
      databases: stringListToCell(record.databases),
      alternateUrls: stringListToCell(record.alternateUrls),
      description: record.description ?? "",
      createdAt: formatTimestamp(record.createdAt),
      updatedAt: formatTimestamp(record.updatedAt),
    };

    for (const question of mappingQuestions.value) {
      row[`mapping_${question.id}`] = recordMappingCellValue(record, question.id);
    }

    return row;
  }),
);

const priorityColumns: Array<{ header: string; settings: ColumnSettings }> = [
  { header: "id", settings: { data: "id", readOnly: true, width: 70 } },
  { header: "title", settings: { data: "title", type: "text", width: 320 } },
  { header: "abstract", settings: { data: "abstract", type: "text", width: 420 } },
  {
    header: "status",
    settings: {
      data: "status",
      type: "dropdown",
      source: ["null", "uncertain", "excluded", "included"],
      strict: true,
      allowInvalid: false,
      width: 120,
    },
  },
  { header: "comment", settings: { data: "comment", type: "text", width: 280 } },
];

const trailingColumns: Array<{ header: string; settings: ColumnSettings }> = [
  { header: "author", settings: { data: "author", type: "text", width: 220 } },
  { header: "publication", settings: { data: "publication", readOnly: true, width: 240 } },
  { header: "url", settings: { data: "url", type: "text", width: 260 } },
  { header: "databases", settings: { data: "databases", type: "text", width: 220 } },
  { header: "alternateUrls", settings: { data: "alternateUrls", type: "text", width: 240 } },
  { header: "description", settings: { data: "description", type: "text", width: 260 } },
  { header: "created", settings: { data: "createdAt", readOnly: true, width: 170 } },
  { header: "updated", settings: { data: "updatedAt", readOnly: true, width: 170 } },
];

const mappingColumns = computed<Array<{ header: string; settings: ColumnSettings }>>(() =>
  mappingQuestions.value.map((question) => ({
    header: question.title || `Question ${question.id}`,
    settings: {
      data: `mapping_${question.id}`,
      type: "text",
      width: 220,
    },
  })),
);

const orderedColumns = computed(() => [
  ...priorityColumns,
  ...mappingColumns.value,
  ...trailingColumns,
]);

const columns = computed<ColumnSettings[]>(() => orderedColumns.value.map((column) => column.settings));

const columnHeaders = computed<string[]>(() => orderedColumns.value.map((column) => column.header));

const parseListCellValue = (value: string) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const token of value.split(/[,\n;]+/)) {
    const next = token.trim();
    if (next.length === 0) {
      continue;
    }
    const key = next.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(next);
  }

  return result;
};

const randomColor = () => {
  const colors = [
    "#e6b0b0",
    "#e6cab0",
    "#e1e6b0",
    "#b0e6bf",
    "#9cdacd",
    "#96c9e1",
    "#a7adc6",
    "#b4a9ed",
    "#e2a9ed",
    "#e89dba",
    "#c69696",
  ];
  return colors[Math.floor(Math.random() * colors.length)] ?? "#d8d8d8";
};

const getRecordById = (recordId: number) =>
  dataItems.value.find((record) => record.id === recordId) ?? null;

const syncMappingCell = async (recordId: number, questionId: number, rawValue: string) => {
  const desiredTitles = parseListCellValue(rawValue);
  const desiredLower = new Set(desiredTitles.map((item) => item.toLocaleLowerCase()));

  const currentRecord = getRecordById(recordId);
  if (!currentRecord) {
    return;
  }

  const linked = currentRecord.MappingOptions.filter((option) => option.mappingQuestionId === questionId);
  for (const option of linked) {
    if (!desiredLower.has(option.title.toLocaleLowerCase())) {
      await store.unlinkRecordMappingOption(recordId, option.id);
    }
  }

  for (const title of desiredTitles) {
    const question = mappingQuestions.value.find((item) => item.id === questionId);
    const existing =
      question?.MappingOptions?.find((option) => option.title.toLocaleLowerCase() === title.toLocaleLowerCase()) ??
      null;

    const latest = getRecordById(recordId);
    const latestLinked = latest?.MappingOptions.filter((option) => option.mappingQuestionId === questionId) ?? [];

    if (existing) {
      const alreadyLinked = latestLinked.some((option) => option.id === existing.id);
      if (!alreadyLinked) {
        await store.linkRecordMappingOption(recordId, questionId, existing.id);
      }
      continue;
    }

    await store.createMappingOptionAndLink(recordId, questionId, title, randomColor());
  }
};

const handleCellChange = async (recordId: number, prop: string, nextValue: string) => {
  if (prop === "title" || prop === "author" || prop === "url") {
    await store.patchRecord(recordId, { [prop]: nextValue });
    return;
  }

  if (prop === "status") {
    const normalizedStatus: RecordStatus =
      nextValue === "" || nextValue === "null" ? null : (nextValue as RecordStatus);
    await store.patchRecord(recordId, { status: normalizedStatus });
    return;
  }

  if (prop === "databases" || prop === "alternateUrls") {
    await store.setRecordArrayField(recordId, prop, parseListCellValue(nextValue));
    return;
  }

  if (prop === "abstract" || prop === "description" || prop === "comment") {
    await store.patchRecord(recordId, { [prop]: nextValue === "" ? null : nextValue });
    return;
  }

  if (prop.startsWith("mapping_")) {
    const questionId = Number(prop.replace("mapping_", ""));
    if (Number.isInteger(questionId) && questionId > 0) {
      await syncMappingCell(recordId, questionId, nextValue);
    }
  }
};

const onAfterChange: GridSettings["afterChange"] = async (changes: CellChange[] | null, source?: string) => {
  if (!changes || !source || !editableSources.has(source)) {
    return;
  }

  for (const [rowIndex, prop, oldValue, newValue] of changes) {
    if (oldValue === newValue) {
      continue;
    }

    const record = dataItems.value[rowIndex];
    if (!record) {
      continue;
    }

    const propName = String(prop);
    const nextText = newValue === null || newValue === undefined ? "" : String(newValue);
    try {
      await handleCellChange(record.id, propName, nextText);
    } catch {
      // Error state is managed by store cellStates.
    }
  }
};

const mapPropToCellStateField = (prop: string) => {
  if (prop.startsWith("mapping_")) {
    return prop.replace("mapping_", "mapping:");
  }
  return prop;
};

const cellMetaFactory: GridSettings["cells"] = (row: number, _col: number, prop: string | number): CellProperties => {
  const record = dataItems.value[row];
  if (!record) {
    return {} as CellProperties;
  }

  const field = mapPropToCellStateField(String(prop));
  const state = store.getCellState(record.id, field);
  const meta: Partial<CellProperties> = {};

  if (state.error) {
    meta.className = "cell-error";
    return meta as CellProperties;
  }

  if (state.saving) {
    meta.className = "cell-saving";
    return meta as CellProperties;
  }

  return meta as CellProperties;
};

const getTableScrollHolder = () => {
  const rootElement = hotTableRef.value?.hotInstance?.rootElement;
  if (!rootElement) {
    return null;
  }
  return rootElement.querySelector(".ht_master .wtHolder") as HTMLElement | null;
};

const maybeLoadMoreFromScrollPosition = async () => {
  if (dataLoading.value || !dataHasMore.value) {
    return;
  }

  const holder = getTableScrollHolder();
  if (!holder) {
    return;
  }

  const remaining = holder.scrollHeight - holder.scrollTop - holder.clientHeight;
  if (remaining <= 140) {
    await store.loadMoreData();
  }
};

const ensureViewportFilled = async () => {
  let holder = getTableScrollHolder();
  if (!holder) {
    return;
  }

  while (dataHasMore.value && !dataLoading.value && holder.scrollHeight <= holder.clientHeight + 20) {
    await store.loadMoreData();
    await nextTick();
    hotTableRef.value?.hotInstance?.render();
    holder = getTableScrollHolder();
    if (!holder) {
      break;
    }
  }
};

const onAfterScrollVertically: GridSettings["afterScrollVertically"] = () => {
  void maybeLoadMoreFromScrollPosition();
};

const debouncedSearch = debounce((value: string) => {
  void store.setSearchFilter(value);
}, 350);

const onSearchInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  searchInput.value = value;
  debouncedSearch(value);
};

const onStatusFilterChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value as StatusFilter;
  void store.setStatusFilter(value);
};

const updateGridHeight = () => {
  const shell = dataGridShellRef.value;
  if (!shell) {
    return;
  }
  gridHeight.value = Math.max(260, Math.floor(shell.clientHeight));
};

watch(
  () => searchFilter.value,
  (value) => {
    searchInput.value = value;
  },
);

watch(
  () => cellStates.value,
  () => {
    hotTableRef.value?.hotInstance?.render();
  },
  { deep: true },
);

watch(
  () => dataItems.value.length,
  async () => {
    await nextTick();
    hotTableRef.value?.hotInstance?.render();
    void ensureViewportFilled();
  },
);

onMounted(async () => {
  searchInput.value = searchFilter.value;

  if (dataGridShellRef.value) {
    gridResizeObserver = new ResizeObserver(() => {
      updateGridHeight();
    });
    gridResizeObserver.observe(dataGridShellRef.value);
  }

  await Promise.all([store.fetchMappingQuestions(), store.loadInitialData()]);

  await nextTick();
  updateGridHeight();
  hotTableRef.value?.hotInstance?.render();
  await ensureViewportFilled();
});

onUnmounted(() => {
  gridResizeObserver?.disconnect();
  gridResizeObserver = null;
});
</script>

<style scoped lang="scss">
.data-tab {
  position: relative;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.data-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  border: 1px solid #eaeaea;
  padding: 10px;
  background: #fff;
  margin-bottom: 8px;
  width: 100%;
  box-sizing: border-box;

  &__group {
    display: flex;
    flex-direction: column;
    gap: 4px;

    &--search {
      min-width: min(320px, 100%);
      flex: 1;
    }
  }

  &__meta {
    margin-left: auto;
    font-size: 12px;
    color: #5b5858;
    white-space: nowrap;
  }

  label {
    font-size: 12px;
    color: #5b5858;
    text-transform: uppercase;
  }
}

.data-grid-shell {
  flex: 1;
  min-height: 0;
  width: 100%;
  min-width: 0;
  border: 1px solid #eaeaea;
  background: #fff;
  overflow: hidden;
}

.data-footer {
  margin-top: 6px;
  font-size: 12px;
  color: #5b5858;
}

:deep(.cell-saving) {
  background: #fff6d8 !important;
}

:deep(.cell-error) {
  background: #ffe4e4 !important;
  color: #7b0c27 !important;
}

:deep(.ht_master .handsontable td) {
  vertical-align: top;
}

:deep(.ht_master .wtHolder) {
  overscroll-behavior: contain;
}

@media (max-width: 1024px) {
  .data-toolbar__group--search {
    min-width: 100%;
  }

  .data-toolbar__meta {
    margin-left: 0;
    width: 100%;
  }
}
</style>
