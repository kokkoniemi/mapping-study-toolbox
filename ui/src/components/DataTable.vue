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
          placeholder="Search title, author, comment..."
          type="text"
        />
      </div>

      <div class="data-toolbar__group">
        <label>Page</label>
        <input :value="page" @input="onPageInput" :max="maxPages" min="1" type="number" />
      </div>

      <div class="data-toolbar__meta">
        Records {{ recordRange }} of {{ itemCount }}
      </div>
    </header>

    <div class="data-pagination">
      <button :disabled="page <= 1" @click="movePage(1)">First</button>
      <button :disabled="page <= 1" @click="movePage(page - 1)">Prev</button>
      <button :disabled="page >= maxPages" @click="movePage(page + 1)">Next</button>
      <button :disabled="page >= maxPages" @click="movePage(maxPages)">Last</button>
    </div>

    <hot-table
      ref="hotTableRef"
      :data="tableRows"
      :columns="columns"
      :colHeaders="columnHeaders"
      :rowHeaders="true"
      :autoWrapRow="true"
      :autoWrapCol="true"
      :copyPaste="true"
      :fillHandle="true"
      :manualColumnResize="true"
      :stretchH="'all'"
      :width="'100%'"
      :height="700"
      :licenseKey="'non-commercial-and-evaluation'"
      :afterChange="onAfterChange"
      :cells="cellMetaFactory"
      :className="'ht-theme-main'"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
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
const { page, pageLength, pageItems, itemCount, statusFilter, searchFilter, mappingQuestions, cellStates } =
  storeToRefs(store);

const hotTableRef = ref<{ hotInstance?: { render: () => void } } | null>(null);
const searchInput = ref(searchFilter.value);

const maxPages = computed(() => Math.max(1, Math.ceil(itemCount.value / pageLength.value)));

const recordRange = computed(() => {
  const first = itemCount.value <= 0 ? 0 : (page.value - 1) * pageLength.value + 1;
  const last = Math.min(itemCount.value, page.value * pageLength.value);
  return `${first} – ${last}`;
});

const formatTimestamp = (value: string) => formatDate(new Date(value), "dd.MM.yyyy HH:mm:ss");

const stringListToCell = (items: string[] | null | undefined) => (Array.isArray(items) ? items.join(", ") : "");

const recordMappingCellValue = (record: RecordItem, questionId: number) =>
  record.MappingOptions.filter((option) => option.mappingQuestionId === questionId)
    .map((option) => option.title)
    .join(", ");

const tableRows = computed<GridRow[]>(() =>
  pageItems.value.map((record) => {
    const row: GridRow = {
      __recordId: record.id,
      id: record.id,
      createdAt: formatTimestamp(record.createdAt),
      updatedAt: formatTimestamp(record.updatedAt),
      publication: record.Publication
        ? `${record.Publication.name ?? "—"} | jufo: ${record.Publication.jufoLevel ?? "—"}`
        : "—",
      title: record.title,
      author: record.author,
      url: record.url,
      status: record.status ?? "null",
      databases: stringListToCell(record.databases),
      alternateUrls: stringListToCell(record.alternateUrls),
      abstract: record.abstract ?? "",
      description: record.description ?? "",
      comment: record.comment ?? "",
    };

    for (const question of mappingQuestions.value) {
      row[`mapping_${question.id}`] = recordMappingCellValue(record, question.id);
    }

    return row;
  }),
);

const baseColumnHeaders = [
  "id",
  "created",
  "updated",
  "publication",
  "title",
  "author",
  "url",
  "status",
  "databases",
  "alternateUrls",
  "abstract",
  "description",
  "comment",
];

const baseColumns: ColumnSettings[] = [
  { data: "id", readOnly: true },
  { data: "createdAt", readOnly: true },
  { data: "updatedAt", readOnly: true },
  { data: "publication", readOnly: true },
  { data: "title", type: "text" },
  { data: "author", type: "text" },
  { data: "url", type: "text" },
  {
    data: "status",
    type: "dropdown",
    source: ["null", "uncertain", "excluded", "included"],
    strict: true,
    allowInvalid: false,
  },
  { data: "databases", type: "text" },
  { data: "alternateUrls", type: "text" },
  { data: "abstract", type: "text" },
  { data: "description", type: "text" },
  { data: "comment", type: "text" },
];

const mappingColumns = computed<ColumnSettings[]>(() =>
  mappingQuestions.value.map((question) => ({
    data: `mapping_${question.id}`,
    type: "text",
  })),
);

const columns = computed<ColumnSettings[]>(() => [...baseColumns, ...mappingColumns.value]);

const columnHeaders = computed<string[]>(() => [
  ...baseColumnHeaders,
  ...mappingQuestions.value.map((question) => question.title || `Question ${question.id}`),
]);

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
  pageItems.value.find((record) => record.id === recordId) ?? null;

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

const handleCellChange = async (
  recordId: number,
  prop: string,
  nextValue: string,
) => {
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

const onAfterChange: GridSettings["afterChange"] = async (
  changes: CellChange[] | null,
  source?: string,
) => {
  if (!changes || !source || !editableSources.has(source)) {
    return;
  }

  for (const [rowIndex, prop, oldValue, newValue] of changes) {
    if (oldValue === newValue) {
      continue;
    }

    const record = pageItems.value[rowIndex];
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

const cellMetaFactory: GridSettings["cells"] = (
  row: number,
  _col: number,
  prop: string | number,
): CellProperties => {
  const record = pageItems.value[row];
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

const movePage = (nextPage: number) => {
  void store.setPage(nextPage);
};

const onPageInput = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value || "1");
  movePage(value);
};

watch(
  () => cellStates.value,
  () => {
    hotTableRef.value?.hotInstance?.render();
  },
  { deep: true },
);

onMounted(async () => {
  searchInput.value = searchFilter.value;
  await Promise.all([store.fetchPageItems(), store.fetchMappingQuestions()]);
});
</script>

<style scoped lang="scss">
.data-tab {
  position: relative;
}

.data-toolbar {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  border: 1px solid #eaeaea;
  padding: 10px;
  background: #fff;
  margin-bottom: 8px;

  &__group {
    display: flex;
    flex-direction: column;
    gap: 4px;

    &--search {
      min-width: 320px;
      flex: 1;
    }
  }

  &__meta {
    margin-left: auto;
    font-size: 12px;
    color: #5b5858;
  }

  label {
    font-size: 12px;
    color: #5b5858;
    text-transform: uppercase;
  }
}

.data-pagination {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
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
</style>
