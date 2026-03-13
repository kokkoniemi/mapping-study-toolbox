<template>
  <div class="data-grid-shell" ref="dataGridShellRef">
    <hot-table
      :key="tableKey"
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
</template>

<script setup lang="ts">
import { ref } from "vue";
import { HotTable } from "@handsontable/vue3";
import { registerAllModules } from "handsontable/registry";
import type Handsontable from "handsontable/base";
import type { CellChange } from "handsontable/common";
import type { ColumnSettings, GridSettings } from "handsontable/settings";

import "handsontable/styles/handsontable.css";
import "handsontable/styles/ht-theme-main.css";

registerAllModules();

type HotInstance = Pick<Handsontable, "render" | "loadData" | "updateSettings" | "rootElement" | "getCell">;

defineProps<{
  tableKey: string;
  tableRows: Array<Record<string, unknown>>;
  columns: ColumnSettings[];
  columnHeaders: string[];
  tableAutoRowSize: boolean;
  tableRowHeights: GridSettings["rowHeights"] | undefined;
  gridHeight: number;
  cellMetaFactory: GridSettings["cells"];
}>();

const emit = defineEmits<{
  "after-change": [changes: CellChange[] | null, source?: string];
  "after-scroll-vertically": [];
  "after-cell-mouse-down": [event: Event, coords: { row: number; col: number }];
}>();

const hotTableRef = ref<{ hotInstance?: HotInstance } | null>(null);
const dataGridShellRef = ref<HTMLElement | null>(null);

const onAfterChange: GridSettings["afterChange"] = (changes: CellChange[] | null, source?: string) => {
  emit("after-change", changes, source);
};

const onAfterScrollVertically: GridSettings["afterScrollVertically"] = () => {
  emit("after-scroll-vertically");
};

const onAfterOnCellMouseDown: GridSettings["afterOnCellMouseDown"] = (event, coords) => {
  emit("after-cell-mouse-down", event, { row: coords.row, col: coords.col });
};

const getHotInstance = () => hotTableRef.value?.hotInstance ?? null;
const getShellElement = () => dataGridShellRef.value;

defineExpose({
  getHotInstance,
  getShellElement,
});
</script>

<style scoped lang="scss">
.data-grid-shell {
  --ht-wrapper-border-radius: 0;
  flex: 1;
  min-height: 0;
  width: 100%;
  min-width: 0;
  border: 1px solid #e7e7e9;
  border-top: 0;
  background: #fff;
  overflow: hidden;
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

:deep(.handsontable.ht-wrapper),
:deep(.handsontable.ht-wrapper::before),
:deep(.handsontable .htCore),
:deep(.handsontable .ht_clone_top .htCore),
:deep(.handsontable .ht_clone_top_inline_start_corner .htCore) {
  border-radius: 0 !important;
}

:deep(.handsontable .ht_clone_top_inline_start_corner thead tr:first-child th:first-child),
:deep(.handsontable .ht_clone_top thead tr:first-child th:first-child),
:deep(.handsontable .ht_master thead tr:first-child th:first-child) {
  border-start-start-radius: 0 !important;
}

/* Prevent double-thick outer frame lines against the shell border. */
:deep(.handsontable .htCore thead tr:first-child th) {
  border-top-width: 0 !important;
}

:deep(.handsontable .htCore tr > th:first-child),
:deep(.handsontable .htCore tr > td:first-child) {
  border-left-width: 0 !important;
}

:deep(.handsontable .htCore tbody tr:last-child td) {
  border-bottom-width: 0 !important;
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

:deep(td.confidence-cell) {
  padding-left: 2px !important;
  padding-right: 2px !important;
}

:deep(td.selection-cell) {
  padding: 0 !important;
  cursor: pointer;
}

:deep(.selection-cell__inner) {
  width: 100%;
  height: 100%;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.selection-cell__checkbox) {
  cursor: pointer;
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

:deep(.confidence-cell-chips) {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: flex-start;
  margin: 0;
}

:deep(.confidence-cell-chips--truncated) {
  max-height: calc(3 * 1.35em);
  overflow: hidden;
}

:deep(.confidence-cell-chip) {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 600;
  border-radius: 3px;
  padding: 3px 5px;
  border: 1px solid #d8d8d8;
  background: #fafafa;
  color: #4e4e4e;
  line-height: 1.2;
}

:deep(.confidence-cell-chip--high) {
  border-color: #9fc7a0;
  background: #edf8ee;
  color: #2f6a32;
}

:deep(.confidence-cell-chip--medium) {
  border-color: #d4cd98;
  background: #fcf8e5;
  color: #6f6518;
}

:deep(.confidence-cell-chip--low) {
  border-color: #d7b0b0;
  background: #fff1f1;
  color: #7a3131;
}
</style>
