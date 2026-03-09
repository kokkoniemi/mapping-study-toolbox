<template>
  <section class="data-tab">
    <DataToolbar
      :statusFilter="statusFilter"
      :statusOptions="statusOptions"
      :searchInput="searchInput"
      :showFullText="!dataCellsTruncated"
      :enrichmentProvider="enrichmentProvider"
      :enrichmentForceRefresh="enrichmentForceRefresh"
      :enrichmentRunning="enrichmentRunning"
      :selectedRecordCount="selectedRecordCount"
      :hasDataItems="dataItems.length > 0"
      @status-filter-change="onStatusFilterChange"
      @search-input="onSearchInput"
      @show-full-text-change="onShowFullTextChange"
      @provider-change="onProviderChange"
      @force-refresh-change="onForceRefreshChange"
      @select-loaded="selectAllLoadedRecords"
      @clear="clearSelectedRecords"
      @enrich-selected="enrichSelectedRecords"
    />

    <EnrichmentStatus
      :selectedRecordCount="selectedRecordCount"
      :enrichmentRunning="enrichmentRunning"
      :enrichmentStopping="enrichmentStopping"
      :enrichmentMessage="enrichmentMessage"
      :enrichmentError="enrichmentError"
      :enrichmentProgressPercent="enrichmentProgressPercent"
      :enrichmentProcessed="enrichmentProcessed"
      :enrichmentTotal="enrichmentTotal"
      :enrichmentMetrics="enrichmentMetrics"
      @stop="stopEnrichment"
    />

    <DataGrid
      ref="dataGridRef"
      :tableKey="tableKey"
      :tableRows="tableRows"
      :columns="columns"
      :columnHeaders="columnHeaders"
      :tableAutoRowSize="tableAutoRowSize"
      :tableRowHeights="tableRowHeights"
      :gridHeight="gridHeight"
      :cellMetaFactory="cellMetaFactory"
      @after-change="onAfterChange"
      @after-scroll-vertically="onAfterScrollVertically"
      @after-cell-mouse-down="onAfterOnCellMouseDown"
    />

    <MappingEditor
      :open="mappingEditorOpen"
      :panelStyle="mappingEditorPanelStyle"
      :questionTitle="mappingEditorQuestionTitle"
      :selectedOptions="mappingEditorSelectedOptions"
      :inputValue="mappingEditorInput"
      :createColor="mappingEditorCreateColor"
      :availableOptions="mappingEditorAvailableOptions"
      :canCreateMappingOption="canCreateMappingOption"
      @close="closeMappingEditor"
      @update:inputValue="onMappingEditorInputUpdate"
      @remove-option="removeMappingOption"
      @create-option="createMappingOption"
      @add-option="addMappingOption"
    />

    <footer class="data-footer">
      <span class="data-footer__loaded">Loaded {{ loadedCount }} / {{ totalCountLabel }}</span>
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
import type { EnrichmentProvider, StatusFilter } from "@shared/contracts";
import type { CellChange } from "handsontable/common";
import type { CellProperties, ColumnSettings, GridSettings } from "handsontable/settings";

import DataGrid from "./data/DataGrid.vue";
import DataToolbar from "./data/DataToolbar.vue";
import EnrichmentStatus from "./data/EnrichmentStatus.vue";
import MappingEditor from "./data/MappingEditor.vue";
import { DEFAULT_MAPPING_OPTION_COLOR, getRandomMappingOptionColor, normalizeMappingColor } from "../constants/mapping";
import { STATUS_FILTER_OPTIONS } from "../constants/status";
import { useDataGrid, type DataGridExpose } from "../composables/useDataGrid";
import { useEnrichmentJob } from "../composables/useEnrichmentJob";
import { debounce } from "../helpers/utils";
import { defaultStore } from "../stores/default";
import { type MappingOption, type RecordItem, type RecordStatus } from "../helpers/api";

type GridRow = Record<string, string | number | boolean> & { __recordId: number };
type MappingEditorState = {
  recordId: number;
  questionId: number;
};
type AnchorRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

const statusOptions = STATUS_FILTER_OPTIONS;
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
  dataCellsTruncated,
  statusFilter,
  searchFilter,
  mappingQuestions,
  cellStates,
} = storeToRefs(store);

const dataGridRef = ref<DataGridExpose | null>(null);
const searchInput = ref(searchFilter.value);
const selectedRecordIds = ref<number[]>([]);
const isUnmounted = ref(false);

const {
  enrichmentRunning,
  enrichmentStopping,
  enrichmentMessage,
  enrichmentError,
  enrichmentProcessed,
  enrichmentTotal,
  enrichmentMetrics,
  enrichmentProgressPercent,
  enrichmentProvider,
  enrichmentForceRefresh,
  enrichSelectedRecords,
  stopEnrichment,
} = useEnrichmentJob({ store, selectedRecordIds, isUnmounted });

const defaultRowHeight = 62;
const tableAutoRowSize = computed(() => !dataCellsTruncated.value);
const tableRowHeights = computed<GridSettings["rowHeights"] | undefined>(() =>
  dataCellsTruncated.value ? defaultRowHeight : undefined,
);
const tableKey = computed(() => (dataCellsTruncated.value ? "data-grid-truncated" : "data-grid-full"));
const mappingEditor = ref<MappingEditorState | null>(null);
const mappingEditorAnchor = ref<AnchorRect | null>(null);
const mappingEditorInput = ref("");
const mappingEditorCreateColor = ref(DEFAULT_MAPPING_OPTION_COLOR);
const viewportSize = ref({
  width: typeof window === "undefined" ? 1920 : window.innerWidth,
  height: typeof window === "undefined" ? 1080 : window.innerHeight,
});

const loadedCount = computed(() => dataItems.value.length);
const selectedRecordCount = computed(() => selectedRecordIds.value.length);
const selectedRecordIdSet = computed(() => new Set(selectedRecordIds.value));
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
      __selected: selectedRecordIdSet.value.has(record.id),
      id: record.id,
      title: record.title,
      abstract: record.abstract ?? "",
      status: record.status ?? "null",
      comment: record.comment ?? "",
      author: record.author,
      forum: record.Forum
        ? `${record.Forum.name ?? "-"} | issn: ${record.Forum.issn ?? "-"} | publisher: ${record.Forum.publisher ?? "-"} | jufo: ${record.Forum.jufoLevel ?? "-"}`
        : "-",
      url: record.url,
      databases: stringListToCell(record.databases),
      alternateUrls: stringListToCell(record.alternateUrls),
      doi: record.doi ?? "",
      references: String(record.referenceItems?.length ?? 0),
      citations: String(record.openAlexCitationItems?.length ?? record.citationCount ?? 0),
      topics: stringListToCell(record.openAlexTopicItems?.map((topic) => topic.displayName ?? "") ?? []),
      createdAt: formatTimestamp(record.createdAt),
      updatedAt: formatTimestamp(record.updatedAt),
    };

    for (const question of mappingQuestions.value) {
      row[`mapping_${question.id}`] = recordMappingCellValue(record, question.id);
    }

    return row;
  }),
);

const parseMappingQuestionId = (prop: unknown) => {
  const value = String(prop);
  if (!value.startsWith("mapping_")) {
    return null;
  }

  const questionId = Number(value.replace("mapping_", ""));
  if (!Number.isInteger(questionId) || questionId <= 0) {
    return null;
  }

  return questionId;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const textIndicatorThreshold = 90;

function selectionRenderer(
  _instance: unknown,
  td: HTMLTableCellElement,
  _row: number,
  _col: number,
  _prop: string | number,
  value: unknown,
) {
  td.classList.remove("data-text-cell", "mapping-cell");
  td.classList.add("selection-cell");
  const checked = Boolean(value);
  td.innerHTML = `<div class="selection-cell__inner"><input class="selection-cell__checkbox" type="checkbox" tabindex="-1" aria-label="Select row" ${checked ? "checked" : ""} /></div>`;
  return td;
}

function truncatedTextRenderer(
  _instance: unknown,
  td: HTMLTableCellElement,
  _row: number,
  _col: number,
  _prop: string | number,
  value: unknown,
) {
  td.classList.remove("mapping-cell");
  td.classList.add("data-text-cell");
  const shouldTruncate = dataCellsTruncated.value;

  const rawText = value === null || value === undefined ? "" : String(value);
  const normalizedText = rawText.replace(/\s+/g, " ").trim();

  if (normalizedText.length === 0) {
    td.textContent = "";
    td.removeAttribute("title");
    return td;
  }

  const isLikelyTruncated = shouldTruncate
    && (rawText.includes("\n") || normalizedText.length > textIndicatorThreshold);
  td.title = normalizedText;

  const content = document.createElement("div");
  content.className = "data-text-cell__content";

  const text = document.createElement("span");
  text.className = shouldTruncate ? "data-text-cell__text data-text-cell__text--truncated" : "data-text-cell__text";
  text.textContent = normalizedText;
  content.appendChild(text);

  if (isLikelyTruncated) {
    const marker = document.createElement("span");
    marker.className = "data-text-cell__marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = "…";
    content.appendChild(marker);
  }

  td.textContent = "";
  td.appendChild(content);
  return td;
}

function mappingChipRenderer(
  _instance: unknown,
  td: HTMLTableCellElement,
  _row: number,
  _col: number,
  prop: string | number,
  value: unknown,
) {
  td.classList.remove("data-text-cell");
  td.classList.add("mapping-cell");
  const shouldTruncate = dataCellsTruncated.value;

  const questionId = parseMappingQuestionId(prop);
  const question = mappingQuestions.value.find((item) => item.id === questionId);
  const colorByTitle = new Map(
    (question?.MappingOptions ?? []).map((item) => [item.title.toLocaleLowerCase(), normalizeMappingColor(item.color)]),
  );

  const titles = parseListCellValue(value === null || value === undefined ? "" : String(value));
  if (titles.length === 0) {
    td.innerHTML = '<span class="mapping-cell-placeholder">Double-click to edit</span>';
    return td;
  }

  const chipsClass = shouldTruncate ? "mapping-cell-chips mapping-cell-chips--truncated" : "mapping-cell-chips";
  td.innerHTML = `<div class="${chipsClass}">${titles
    .map((title) => {
      const color = colorByTitle.get(title.toLocaleLowerCase()) ?? DEFAULT_MAPPING_OPTION_COLOR;
      return `<span class="mapping-cell-chip" style="background-color:${color}">${escapeHtml(title)}</span>`;
    })
    .join("")}</div>`;
  return td;
}

const priorityColumns: Array<{ header: string; settings: ColumnSettings }> = [
  { header: "", settings: { data: "__selected", readOnly: true, renderer: selectionRenderer, width: 42 } },
  { header: "id", settings: { data: "id", readOnly: true, width: 64 } },
  { header: "title", settings: { data: "title", type: "text", renderer: truncatedTextRenderer, width: 320 } },
  { header: "abstract", settings: { data: "abstract", type: "text", renderer: truncatedTextRenderer, width: 420 } },
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
  { header: "comment", settings: { data: "comment", type: "text", renderer: truncatedTextRenderer, width: 280 } },
];

const trailingColumns: Array<{ header: string; settings: ColumnSettings }> = [
  { header: "author", settings: { data: "author", type: "text", renderer: truncatedTextRenderer, width: 220 } },
  { header: "doi", settings: { data: "doi", type: "text", renderer: truncatedTextRenderer, width: 210 } },
  { header: "forum", settings: { data: "forum", readOnly: true, renderer: truncatedTextRenderer, width: 240 } },
  { header: "references", settings: { data: "references", readOnly: true, width: 100 } },
  { header: "citations", settings: { data: "citations", readOnly: true, width: 100 } },
  { header: "topics", settings: { data: "topics", readOnly: true, renderer: truncatedTextRenderer, width: 220 } },
  { header: "url", settings: { data: "url", type: "text", renderer: truncatedTextRenderer, width: 260 } },
  { header: "databases", settings: { data: "databases", type: "text", renderer: truncatedTextRenderer, width: 220 } },
  {
    header: "alternateUrls",
    settings: { data: "alternateUrls", type: "text", renderer: truncatedTextRenderer, width: 240 },
  },
  { header: "created", settings: { data: "createdAt", readOnly: true, width: 170 } },
  { header: "updated", settings: { data: "updatedAt", readOnly: true, width: 170 } },
];

const mappingColumns = computed<Array<{ header: string; settings: ColumnSettings }>>(() =>
  mappingQuestions.value.map((question) => ({
    header: question.title || `Question ${question.id}`,
    settings: {
      data: `mapping_${question.id}`,
      readOnly: true,
      renderer: mappingChipRenderer,
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

const getRecordById = (recordId: number) => dataItems.value.find((record) => record.id === recordId) ?? null;
const mappingEditorOpen = computed(() => mappingEditor.value !== null);
const mappingEditorRecord = computed(() => {
  if (!mappingEditor.value) {
    return null;
  }
  return getRecordById(mappingEditor.value.recordId);
});

const mappingEditorQuestion = computed(() => {
  if (!mappingEditor.value) {
    return null;
  }
  return mappingQuestions.value.find((item) => item.id === mappingEditor.value?.questionId) ?? null;
});

const mappingEditorQuestionTitle = computed(
  () =>
    mappingEditorQuestion.value?.title
    || (mappingEditorQuestion.value ? `Question ${mappingEditorQuestion.value.id}` : "Mapping options"),
);

const mappingEditorPanelStyle = computed(() => {
  const padding = 12;
  const width = Math.max(320, Math.min(640, viewportSize.value.width - padding * 2));
  const anchor = mappingEditorAnchor.value;

  if (!anchor) {
    const fallbackTop = Math.max(padding, Math.round(viewportSize.value.height * 0.12));
    const fallbackLeft = Math.max(padding, Math.round((viewportSize.value.width - width) / 2));
    const fallbackMaxHeight = Math.max(240, viewportSize.value.height - fallbackTop - padding);

    return {
      width: `${Math.round(width)}px`,
      left: `${Math.round(fallbackLeft)}px`,
      top: `${Math.round(fallbackTop)}px`,
      maxHeight: `${Math.round(fallbackMaxHeight)}px`,
    };
  }

  const availableBelow = viewportSize.value.height - anchor.bottom - padding;
  const availableAbove = anchor.top - padding;
  const placeBelow = availableBelow >= 260 || availableBelow >= availableAbove;
  const maxHeight = Math.max(240, Math.floor(placeBelow ? availableBelow : availableAbove));

  const preferredLeft = anchor.left;
  const maxLeft = Math.max(padding, viewportSize.value.width - width - padding);
  const left = Math.max(padding, Math.min(preferredLeft, maxLeft));
  const top = placeBelow ? anchor.bottom + 6 : anchor.top - maxHeight - 6;

  return {
    width: `${Math.round(width)}px`,
    left: `${Math.round(left)}px`,
    top: `${Math.round(Math.max(padding, top))}px`,
    maxHeight: `${Math.round(maxHeight)}px`,
  };
});

const mappingEditorSelectedOptions = computed<MappingOption[]>(() => {
  const record = mappingEditorRecord.value;
  const questionId = mappingEditor.value?.questionId;
  if (!record || !questionId) {
    return [];
  }
  return record.MappingOptions.filter((option) => option.mappingQuestionId === questionId);
});

const mappingEditorInputTrimmed = computed(() => mappingEditorInput.value.trim());

const mappingEditorAvailableOptions = computed(() => {
  const question = mappingEditorQuestion.value;
  if (!question) {
    return [];
  }

  const selected = new Set(mappingEditorSelectedOptions.value.map((item) => item.id));
  const search = mappingEditorInputTrimmed.value.toLocaleLowerCase();

  return (question.MappingOptions ?? []).filter((option) => {
    if (selected.has(option.id)) {
      return false;
    }

    if (search.length === 0) {
      return true;
    }

    return option.title.toLocaleLowerCase().includes(search);
  });
});

const canCreateMappingOption = computed(() => {
  const title = mappingEditorInputTrimmed.value;
  if (title.length === 0) {
    return false;
  }

  const questionOptions = mappingEditorQuestion.value?.MappingOptions ?? [];
  return !questionOptions.some((option) => option.title.toLocaleLowerCase() === title.toLocaleLowerCase());
});

const updateViewportSize = () => {
  viewportSize.value = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
};

const getCellAnchorRectFromEvent = (event: MouseEvent): AnchorRect | null => {
  const target = event.target as HTMLElement | null;
  const cell = target?.closest("td");
  if (!cell) {
    return null;
  }

  const rect = cell.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
};

const getCellAnchorRectByCoords = (row: number, col: number): AnchorRect | null => {
  const instance = dataGridRef.value?.getHotInstance();
  const cell = instance?.getCell?.(row, col, true) ?? instance?.getCell?.(row, col) ?? null;
  if (!cell) {
    return null;
  }

  const rect = cell.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
};

const closeMappingEditor = () => {
  mappingEditor.value = null;
  mappingEditorAnchor.value = null;
  mappingEditorInput.value = "";
};

const openMappingEditor = (recordId: number, questionId: number, anchor: AnchorRect | null) => {
  mappingEditor.value = { recordId, questionId };
  mappingEditorAnchor.value = anchor;
  mappingEditorInput.value = "";
  mappingEditorCreateColor.value = getRandomMappingOptionColor();
};

const onMappingEditorInputUpdate = (value: string) => {
  mappingEditorInput.value = value;
};

const addMappingOption = async (mappingOptionId: number) => {
  if (!mappingEditor.value) {
    return;
  }

  await store.linkRecordMappingOption(
    mappingEditor.value.recordId,
    mappingEditor.value.questionId,
    mappingOptionId,
  );
  mappingEditorInput.value = "";
};

const removeMappingOption = async (mappingOptionId: number) => {
  if (!mappingEditor.value) {
    return;
  }

  await store.unlinkRecordMappingOption(mappingEditor.value.recordId, mappingOptionId);
};

const createMappingOption = async () => {
  if (!mappingEditor.value || !canCreateMappingOption.value) {
    return;
  }

  await store.createMappingOptionAndLink(
    mappingEditor.value.recordId,
    mappingEditor.value.questionId,
    mappingEditorInputTrimmed.value,
    mappingEditorCreateColor.value,
  );
  mappingEditorInput.value = "";
  mappingEditorCreateColor.value = getRandomMappingOptionColor();
};

const toggleRecordSelection = (recordId: number) => {
  if (selectedRecordIdSet.value.has(recordId)) {
    selectedRecordIds.value = selectedRecordIds.value.filter((id) => id !== recordId);
    return;
  }
  selectedRecordIds.value = [...selectedRecordIds.value, recordId];
};

const clearSelectedRecords = () => {
  selectedRecordIds.value = [];
};

const selectAllLoadedRecords = () => {
  selectedRecordIds.value = dataItems.value.map((item) => item.id);
};

const syncSelectionToLoadedRecords = () => {
  const loadedIds = new Set(dataItems.value.map((item) => item.id));
  selectedRecordIds.value = selectedRecordIds.value.filter((id) => loadedIds.has(id));
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

  if (prop === "abstract" || prop === "comment") {
    await store.patchRecord(recordId, { [prop]: nextValue === "" ? null : nextValue });
  }
};

const onAfterChange = async (changes: CellChange[] | null, source?: string) => {
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

const {
  gridHeight,
  onAfterScrollVertically,
  ensureViewportFilled,
  syncGridData,
  mountGridSizing,
  unmountGridSizing,
} = useDataGrid({
  store,
  dataGridRef,
  dataLoading,
  dataHasMore,
  tableRows,
});

const onAfterOnCellMouseDown = (event: Event, coords: { row: number; col: number }) => {
  const mouseEvent = event as MouseEvent;
  if (coords.row < 0 || coords.col < 0) {
    return;
  }

  const row = dataItems.value[coords.row];
  const column = orderedColumns.value[coords.col];
  if (!row || !column) {
    return;
  }

  if (column.settings.data === "__selected") {
    mouseEvent.preventDefault();
    toggleRecordSelection(row.id);
    return;
  }

  if (mouseEvent.detail < 2) {
    return;
  }

  const questionId = parseMappingQuestionId(column.settings.data);
  if (!questionId) {
    return;
  }

  mouseEvent.preventDefault();
  const anchor = getCellAnchorRectByCoords(coords.row, coords.col) ?? getCellAnchorRectFromEvent(mouseEvent);
  openMappingEditor(row.id, questionId, anchor);
};

const onWindowKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && mappingEditorOpen.value) {
    closeMappingEditor();
  }
};

const debouncedSearch = debounce((value: string) => {
  void store.setSearchFilter(value);
}, 350);

const onSearchInput = (value: string) => {
  searchInput.value = value;
  closeMappingEditor();
  debouncedSearch(value);
};

const onStatusFilterChange = (value: StatusFilter) => {
  closeMappingEditor();
  void store.setStatusFilter(value);
};

const onShowFullTextChange = (showFullText: boolean) => {
  closeMappingEditor();
  store.setDataCellsTruncated(!showFullText);
};

const onProviderChange = (value: EnrichmentProvider) => {
  enrichmentProvider.value = value;
};

const onForceRefreshChange = (value: boolean) => {
  enrichmentForceRefresh.value = value;
};

watch(
  () => searchFilter.value,
  (value) => {
    searchInput.value = value;
  },
);

watch(
  () => dataItems.value.map((item) => item.id),
  () => {
    syncSelectionToLoadedRecords();
  },
);

watch(
  () => cellStates.value,
  () => {
    dataGridRef.value?.getHotInstance()?.render();
  },
  { deep: true },
);

watch(
  () => tableRows.value,
  async () => {
    await nextTick();
    syncGridData();
    void ensureViewportFilled();
  },
);

watch(
  () => [mappingEditorRecord.value, mappingEditorQuestion.value] as const,
  ([record, question]) => {
    if (mappingEditor.value && (!record || !question)) {
      closeMappingEditor();
    }
  },
);

onMounted(async () => {
  isUnmounted.value = false;
  searchInput.value = searchFilter.value;
  updateViewportSize();
  window.addEventListener("resize", updateViewportSize);
  window.addEventListener("keydown", onWindowKeyDown);

  await Promise.all([store.fetchMappingQuestions(), store.loadInitialData()]);

  await nextTick();
  mountGridSizing();
  dataGridRef.value?.getHotInstance()?.render();
  await ensureViewportFilled();
});

onUnmounted(() => {
  isUnmounted.value = true;
  window.removeEventListener("resize", updateViewportSize);
  window.removeEventListener("keydown", onWindowKeyDown);
  unmountGridSizing();
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

.data-footer {
  margin-top: 6px;
  font-size: 12px;
  color: #5b5858;
  display: flex;
  align-items: center;
  gap: 16px;

  &__loaded {
    white-space: nowrap;
  }
}
</style>
