<template>
  <template v-if="showDataGrid">
    <EnrichmentStatus
      v-if="toolsTab === 'enrichment'"
      :selectedRecordCount="selectedRecordCount"
      :enrichmentRunning="enrichmentRunning"
      :enrichmentStopping="enrichmentStopping"
      :enrichmentMessage="enrichmentMessage"
      :enrichmentError="enrichmentError"
      :enrichmentProgressPercent="enrichmentProgressPercent"
      :enrichmentProcessed="enrichmentProcessed"
      :enrichmentTotal="enrichmentTotal"
      :enrichmentMetrics="enrichmentMetrics"
      @stop="emit('stop-enrichment')"
    />

    <DataToolbar
      :statusFilter="statusFilter"
      :statusOptions="statusOptions"
      :importFilter="importFilterValue"
      :importFilterOptions="importFilterOptions"
      :searchInput="searchInput"
      :showFullText="!dataCellsTruncated"
      :selectLoadedDisabled="selectLoadedDisabled"
      :selectAllMatchingDisabled="selectAllMatchingDisabled"
      :clearSelectionDisabled="clearSelectionDisabled"
      :selectAllMatchingRunning="selectAllMatchingRunning"
      :selectAllProgressText="selectAllProgressText"
      @status-filter-change="emit('status-filter-change', $event)"
      @import-filter-change="emit('import-filter-change', $event)"
      @search-input="emit('search-input', $event)"
      @show-full-text-change="emit('show-full-text-change', $event)"
      @select-loaded="emit('select-loaded')"
      @select-all-matching="emit('select-all-matching')"
      @clear-selection="emit('clear-selection')"
    />

    <DataGrid
      ref="gridRef"
      :tableKey="tableKey"
      :tableRows="tableRows"
      :columns="columns"
      :columnHeaders="columnHeaders"
      :tableAutoRowSize="tableAutoRowSize"
      :tableRowHeights="tableRowHeights"
      :gridHeight="gridHeight"
      :cellMetaFactory="cellMetaFactory"
      @after-change="onAfterChange"
      @after-scroll-vertically="emit('after-scroll-vertically')"
      @after-cell-mouse-down="onAfterCellMouseDown"
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
      @close="emit('mapping-close')"
      @update:inputValue="emit('mapping-input-update', $event)"
      @remove-option="emit('mapping-remove-option', $event)"
      @create-option="emit('mapping-create-option')"
      @add-option="emit('mapping-add-option', $event)"
    />

    <footer class="data-footer">
      <span class="data-footer__loaded">Loaded {{ loadedCount }} / {{ totalCountLabel }}</span>
      <span v-if="dataLoading">Loading more records...</span>
      <span v-else-if="!dataHasMore">All records loaded</span>
      <span v-else>Scroll to load more</span>
    </footer>
  </template>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { StatusFilter } from "@shared/contracts";
import type { CellChange } from "handsontable/common";
import type { ColumnSettings, GridSettings } from "handsontable/settings";
import DataGrid from "../../components/data/DataGrid.vue";
import DataToolbar from "../../components/data/DataToolbar.vue";
import EnrichmentStatus from "../../components/data/EnrichmentStatus.vue";
import MappingEditor from "../../components/data/MappingEditor.vue";
import type { DataGridExpose } from "../../composables/useDataGrid";
import type { EnrichmentJob, MappingOption } from "../../helpers/api";

const gridRef = ref<DataGridExpose | null>(null);

type EnrichmentMetrics = EnrichmentJob["metrics"];

defineProps<{
  showDataGrid: boolean;
  toolsTab: string;
  selectedRecordCount: number;
  enrichmentRunning: boolean;
  enrichmentStopping: boolean;
  enrichmentMessage: string;
  enrichmentError: string;
  enrichmentProgressPercent: number;
  enrichmentProcessed: number;
  enrichmentTotal: number;
  enrichmentMetrics: EnrichmentMetrics;
  statusFilter: StatusFilter;
  statusOptions: Array<{ label: string; value: StatusFilter }>;
  importFilterValue: string;
  importFilterOptions: Array<{ label: string; value: string }>;
  searchInput: string;
  dataCellsTruncated: boolean;
  selectLoadedDisabled: boolean;
  selectAllMatchingDisabled: boolean;
  clearSelectionDisabled: boolean;
  selectAllMatchingRunning: boolean;
  selectAllProgressText: string;
  tableKey: string;
  tableRows: Array<Record<string, unknown>>;
  columns: ColumnSettings[];
  columnHeaders: string[];
  tableAutoRowSize: boolean;
  tableRowHeights: GridSettings["rowHeights"];
  gridHeight: number;
  cellMetaFactory: GridSettings["cells"];
  mappingEditorOpen: boolean;
  mappingEditorPanelStyle: Record<string, string>;
  mappingEditorQuestionTitle: string;
  mappingEditorSelectedOptions: MappingOption[];
  mappingEditorInput: string;
  mappingEditorCreateColor: string;
  mappingEditorAvailableOptions: MappingOption[];
  canCreateMappingOption: boolean;
  loadedCount: number;
  totalCountLabel: string;
  dataLoading: boolean;
  dataHasMore: boolean;
}>();

const emit = defineEmits<{
  "stop-enrichment": [];
  "status-filter-change": [value: StatusFilter];
  "import-filter-change": [value: string];
  "search-input": [value: string];
  "show-full-text-change": [value: boolean];
  "select-loaded": [];
  "select-all-matching": [];
  "clear-selection": [];
  "after-change": [changes: CellChange[] | null, source: string | undefined];
  "after-scroll-vertically": [];
  "after-cell-mouse-down": [event: Event, coords: { row: number; col: number }];
  "mapping-close": [];
  "mapping-input-update": [value: string];
  "mapping-remove-option": [mappingOptionId: number];
  "mapping-create-option": [];
  "mapping-add-option": [mappingOptionId: number];
}>();

const onAfterChange = (changes: CellChange[] | null, source: string | undefined) => {
  emit("after-change", changes, source);
};

const onAfterCellMouseDown = (event: Event, coords: { row: number; col: number }) => {
  emit("after-cell-mouse-down", event, coords);
};

defineExpose({
  getHotInstance: () => gridRef.value?.getHotInstance() ?? null,
  getShellElement: () => gridRef.value?.getShellElement() ?? null,
});
</script>
