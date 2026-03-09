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

      <div class="data-toolbar__group data-toolbar__group--toggle">
        <label>Cell options</label>
        <label class="data-toolbar__toggle">
          <input type="checkbox" :checked="!dataCellsTruncated" @change="onShowFullTextChange" />
          <span>Show full text</span>
        </label>
      </div>

    </header>

    <div class="data-grid-shell" ref="dataGridShellRef">
      <hot-table
        :key="dataCellsTruncated ? 'data-grid-truncated' : 'data-grid-full'"
        ref="hotTableRef"
        :data="tableRows"
        :columns="columns"
        :colHeaders="columnHeaders"
        :rowHeaders="false"
        :autoWrapRow="false"
        :autoWrapCol="false"
        :copyPaste="true"
        :fillHandle="true"
        :manual-column-resize="true"
        :manual-row-resize="true"
        :auto-row-size="tableAutoRowSize"
        :row-heights="tableRowHeights"
        :stretchH="'none'"
        :width="'100%'"
        :height="gridHeight"
        :themeName="'ht-theme-main'"
        :licenseKey="'non-commercial-and-evaluation'"
        :afterChange="onAfterChange"
        :afterScrollVertically="onAfterScrollVertically"
        :afterOnCellMouseDown="onAfterOnCellMouseDown"
        :cells="cellMetaFactory"
      />
    </div>

    <div v-if="mappingEditorOpen" class="mapping-editor">
      <div class="mapping-editor__backdrop" @click="closeMappingEditor"></div>
      <section class="mapping-editor__panel" :style="mappingEditorPanelStyle">
        <header class="mapping-editor__header">
          <h3>{{ mappingEditorQuestionTitle }}</h3>
          <button type="button" class="mapping-editor__close" @click="closeMappingEditor">Close</button>
        </header>

        <div class="mapping-editor__selected">
          <button
            v-for="option in mappingEditorSelectedOptions"
            :key="option.id"
            class="mapping-chip mapping-chip--selected"
            :style="chipStyle(option.color)"
            type="button"
            @click="removeMappingOption(option.id)"
          >
            {{ option.title }}
            <span class="mapping-chip__remove">⊗</span>
          </button>
          <div v-if="mappingEditorSelectedOptions.length === 0" class="mapping-editor__hint mapping-editor__hint--empty">
            No options selected
          </div>
        </div>

        <div class="mapping-editor__search">
          <input
            ref="mappingEditorInputRef"
            v-model="mappingEditorInput"
            type="text"
            placeholder="Select an option or create one"
          />
        </div>

        <ul class="mapping-editor__list">
          <li v-if="canCreateMappingOption" class="mapping-editor__item">
            <button type="button" class="mapping-editor__pick" @click="createMappingOption">
              <span class="mapping-editor__create-label">Create:</span>
              <span class="mapping-chip" :style="chipStyle(mappingEditorCreateColor)">{{ mappingEditorInputTrimmed }}</span>
            </button>
          </li>
          <li v-for="option in mappingEditorAvailableOptions" :key="option.id" class="mapping-editor__item">
            <button type="button" class="mapping-editor__pick" @click="addMappingOption(option.id)">
              <span class="mapping-chip" :style="chipStyle(option.color)">{{ option.title }}</span>
            </button>
          </li>
        </ul>

      </section>
    </div>

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
import { HotTable } from "@handsontable/vue3";
import { registerAllModules } from "handsontable/registry";
import type { CellChange } from "handsontable/common";
import type { CellProperties, ColumnSettings, GridSettings } from "handsontable/settings";

import "handsontable/styles/handsontable.css";
import "handsontable/styles/ht-theme-main.css";

import { debounce } from "../helpers/utils";
import { defaultStore, type StatusFilter } from "../stores/default";
import type { MappingOption, RecordItem, RecordStatus } from "../helpers/api";

registerAllModules();

type GridRow = Record<string, string | number> & { __recordId: number };
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

type HotInstance = {
  render: () => void;
  loadData?: (data: GridRow[]) => void;
  updateSettings?: (settings: Partial<GridSettings>) => void;
  rootElement?: HTMLElement;
  getCell?: (row: number, col: number, topmost?: boolean) => HTMLTableCellElement | null;
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
  dataCellsTruncated,
  statusFilter,
  searchFilter,
  mappingQuestions,
  cellStates,
} = storeToRefs(store);

const hotTableRef = ref<{ hotInstance?: HotInstance } | null>(null);
const dataGridShellRef = ref<HTMLElement | null>(null);
const searchInput = ref(searchFilter.value);
const gridHeight = ref(520);
const defaultRowHeight = 62;
const tableAutoRowSize = computed(() => !dataCellsTruncated.value);
const tableRowHeights = computed<GridSettings["rowHeights"] | undefined>(() =>
  dataCellsTruncated.value ? defaultRowHeight : undefined,
);
const mappingEditorInputRef = ref<HTMLInputElement | null>(null);
const mappingEditor = ref<MappingEditorState | null>(null);
const mappingEditorAnchor = ref<AnchorRect | null>(null);
const mappingEditorInput = ref("");
const mappingEditorCreateColor = ref("#d8d8d8");
const viewportSize = ref({
  width: typeof window === "undefined" ? 1920 : window.innerWidth,
  height: typeof window === "undefined" ? 1080 : window.innerHeight,
});

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
      forum: record.Forum
        ? `${record.Forum.name ?? "-"} | jufo: ${record.Forum.jufoLevel ?? "-"}`
        : "-",
      url: record.url,
      databases: stringListToCell(record.databases),
      alternateUrls: stringListToCell(record.alternateUrls),
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
  {
    header: "forum",
    settings: { data: "forum", readOnly: true, renderer: truncatedTextRenderer, width: 240 },
  },
  { header: "url", settings: { data: "url", type: "text", renderer: truncatedTextRenderer, width: 260 } },
  { header: "databases", settings: { data: "databases", type: "text", renderer: truncatedTextRenderer, width: 220 } },
  {
    header: "alternateUrls",
    settings: { data: "alternateUrls", type: "text", renderer: truncatedTextRenderer, width: 240 },
  },
  { header: "created", settings: { data: "createdAt", readOnly: true, width: 170 } },
  { header: "updated", settings: { data: "updatedAt", readOnly: true, width: 170 } },
];

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

const sanitizeColor = (color: string | null | undefined) => {
  if (!color) {
    return "#d8d8d8";
  }

  const trimmed = color.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : "#d8d8d8";
};

const chipStyle = (color: string | null | undefined) => ({
  backgroundColor: sanitizeColor(color),
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const textIndicatorThreshold = 90;

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
    (question?.MappingOptions ?? []).map((item) => [item.title.toLocaleLowerCase(), sanitizeColor(item.color)]),
  );

  const titles = parseListCellValue(value === null || value === undefined ? "" : String(value));
  if (titles.length === 0) {
    td.innerHTML = '<span class="mapping-cell-placeholder">Double-click to edit</span>';
    return td;
  }

  const chipsClass = shouldTruncate ? "mapping-cell-chips mapping-cell-chips--truncated" : "mapping-cell-chips";
  td.innerHTML = `<div class="${chipsClass}">${titles
    .map((title) => {
      const color = colorByTitle.get(title.toLocaleLowerCase()) ?? "#d8d8d8";
      return `<span class="mapping-cell-chip" style="background-color:${color}">${escapeHtml(title)}</span>`;
    })
    .join("")}</div>`;
  return td;
}

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
  const instance = hotTableRef.value?.hotInstance;
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

const openMappingEditor = async (recordId: number, questionId: number, anchor: AnchorRect | null) => {
  mappingEditor.value = { recordId, questionId };
  mappingEditorAnchor.value = anchor;
  mappingEditorInput.value = "";
  mappingEditorCreateColor.value = randomColor();
  await nextTick();
  mappingEditorInputRef.value?.focus();
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
  mappingEditorCreateColor.value = randomColor();
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
    return;
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

const onAfterOnCellMouseDown: GridSettings["afterOnCellMouseDown"] = (event, coords) => {
  const mouseEvent = event as MouseEvent;
  if (mouseEvent.detail < 2 || coords.row < 0 || coords.col < 0) {
    return;
  }

  const row = dataItems.value[coords.row];
  const column = orderedColumns.value[coords.col];
  if (!row || !column) {
    return;
  }

  const questionId = parseMappingQuestionId(column.settings.data);
  if (!questionId) {
    return;
  }

  mouseEvent.preventDefault();
  const anchor = getCellAnchorRectByCoords(coords.row, coords.col) ?? getCellAnchorRectFromEvent(mouseEvent);
  void openMappingEditor(row.id, questionId, anchor);
};

const onWindowKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && mappingEditorOpen.value) {
    closeMappingEditor();
  }
};

const debouncedSearch = debounce((value: string) => {
  void store.setSearchFilter(value);
}, 350);

const onSearchInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  searchInput.value = value;
  closeMappingEditor();
  debouncedSearch(value);
};

const onStatusFilterChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value as StatusFilter;
  closeMappingEditor();
  void store.setStatusFilter(value);
};

const onShowFullTextChange = (event: Event) => {
  const showFullText = (event.target as HTMLInputElement).checked;
  closeMappingEditor();
  store.setDataCellsTruncated(!showFullText);
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

const syncHotTableData = () => {
  const instance = hotTableRef.value?.hotInstance;
  if (!instance) {
    return;
  }
  instance.loadData?.(tableRows.value);
  instance.render();
};

watch(
  () => tableRows.value,
  async () => {
    await nextTick();
    syncHotTableData();
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
  searchInput.value = searchFilter.value;
  updateViewportSize();
  window.addEventListener("resize", updateViewportSize);
  window.addEventListener("keydown", onWindowKeyDown);

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
  window.removeEventListener("resize", updateViewportSize);
  window.removeEventListener("keydown", onWindowKeyDown);
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

    &--toggle {
      min-width: 150px;
      border-left: 1px solid #dddddd;
      padding-left: 10px;
      margin-left: 2px;
    }
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    box-sizing: border-box;
    font-size: 12px;
    color: #5b5858;
    text-transform: none;
    cursor: pointer;
    margin: 0;
    padding: 0;

    input {
      margin: 0;
    }
  }

  &__group > label {
    font-size: 12px;
    color: #5b5858;
    text-transform: uppercase;
    margin: 0;
    line-height: 1.2;
  }

  select,
  input[type="text"] {
    height: 30px;
    box-sizing: border-box;
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
  display: flex;
  align-items: center;
  gap: 16px;

  &__loaded {
    white-space: nowrap;
  }
}

.mapping-editor {
  position: fixed;
  inset: 0;
  z-index: 2000;

  &__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.2);
  }

  &__panel {
    position: fixed;
    z-index: 2001;
    background: #fff;
    border: 1px solid #aeaeae;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
    padding: 10px 8px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 4px;
    min-height: 28px;

    h3 {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
      font-weight: 600;
      color: #2c3e50;
    }
  }

  &__selected {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 5px;
    max-height: 180px;
    overflow: auto;
    padding: 2px 4px;
    scrollbar-width: thin;
    scrollbar-color: #c4c4c4 #f4f4f4;

    &::-webkit-scrollbar {
      width: 10px;
    }

    &::-webkit-scrollbar-track {
      background: #f4f4f4;
    }

    &::-webkit-scrollbar-thumb {
      background: #c4c4c4;
      border-radius: 8px;
      border: 2px solid #f4f4f4;
    }
  }

  &__search {
    padding: 0 4px;

    input {
      width: 100%;
      box-sizing: border-box;
      border: 0;
      border-bottom: 1px solid #eaeaea;
      padding: 6px 4px 8px;
      font-size: 15px;
      background: transparent;
      color: #2c3e50;

      &:focus {
        outline: none;
      }
    }
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 320px;
    min-height: 120px;
    overflow-y: auto;
    overflow-x: hidden;
    border: 0;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: #c4c4c4 #f4f4f4;

    &::-webkit-scrollbar {
      width: 10px;
    }

    &::-webkit-scrollbar-track {
      background: #f4f4f4;
    }

    &::-webkit-scrollbar-thumb {
      background: #c4c4c4;
      border-radius: 8px;
      border: 2px solid #f4f4f4;
    }
  }

  &__item {
    height: 32px;
    display: flex;
    align-items: center;
    margin: 0 -3px;
    padding: 0 3px;
    transition: background-color 0.2s ease-in;

    &:hover {
      background-color: #eaeaea;
    }
  }

  &__pick {
    width: 100%;
    text-align: left;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
  }

  &__create-label {
    font-size: 12px;
    color: #5b5858;
    margin-right: 2px;
  }

  &__hint {
    font-size: 12px;
    color: #c0c0c0;
    margin: 0 4px;

    &--empty {
      font-style: italic;
    }
  }

  &__close {
    font-size: 12px;
    color: #5b5858;
    padding: 2px 8px;
    background: #fff;
    border: 1px solid #e0e0e0;

    &:hover {
      background: #f7f7f7;
    }
  }
}

.mapping-chip {
  font-size: 10px;
  border-radius: 3px;
  padding: 5px;
  color: rgba(0, 0, 0, 0.65);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
}

.mapping-chip__remove {
  font-size: 14px;
  display: none;
}

.mapping-chip--selected:hover .mapping-chip__remove {
  display: inline-flex;
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
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
}

:deep(.ht_master .wtHolder) {
  overscroll-behavior: contain;
}

:deep(td.data-text-cell) {
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

:deep(.data-text-cell__content) {
  position: relative;
}

:deep(.data-text-cell__text) {
  line-height: 1.35;
  white-space: normal;
  word-break: break-word;
  padding-right: 14px;
}

:deep(.data-text-cell__text--truncated) {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-height: calc(3 * 1.35em);
}

:deep(.data-text-cell__marker) {
  position: absolute;
  right: 0;
  bottom: 0;
  font-size: 12px;
  line-height: 1;
  font-weight: 700;
  color: #6e6e6e;
  padding-left: 8px;
  background: linear-gradient(to right, rgba(255, 255, 255, 0), #fff 45%);
}

:deep(td.mapping-cell) {
  padding-left: 2px !important;
  padding-right: 2px !important;
}

:deep(.mapping-cell-chips) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: flex-start;
  margin: 0;
}

:deep(.mapping-cell-chips--truncated) {
  max-height: calc(3 * 1.35em);
  overflow: hidden;
}

:deep(.mapping-cell-chip) {
  font-size: 10px;
  border-radius: 3px;
  padding: 3px 5px;
  line-height: 1.2;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.7);
}

:deep(.mapping-cell-placeholder) {
  font-size: 11px;
  color: #a0a0a0;
}

@media (max-width: 1024px) {
  .data-toolbar__group--search {
    min-width: 100%;
  }
}
</style>
