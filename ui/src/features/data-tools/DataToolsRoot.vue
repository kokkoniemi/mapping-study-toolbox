<template>
  <section class="data-tab">
    <section class="data-tools" :class="{ 'data-tools--workspace': !showDataGrid }">
      <div class="data-tools__tabs">
        <button
          type="button"
          class="data-tools__tab"
          :class="{ 'data-tools__tab--active': toolsTab === 'enrichment' }"
          @click="toolsTab = 'enrichment'"
        >
          Enrichment
        </button>
        <button
          type="button"
          class="data-tools__tab"
          :class="{ 'data-tools__tab--active': toolsTab === 'export' }"
          @click="onExportTabOpen"
        >
          Export
        </button>
        <button
          type="button"
          class="data-tools__tab"
          :class="{ 'data-tools__tab--active': toolsTab === 'forums' }"
          @click="onForumsTabOpen"
        >
          Forums
        </button>
        <button
          type="button"
          class="data-tools__tab"
          :class="{ 'data-tools__tab--active': toolsTab === 'imports' }"
          @click="onImportsTabOpen"
        >
          Import
        </button>
      </div>

      <EnrichmentPanel
        v-if="toolsTab === 'enrichment'"
        :enrichmentProvider="enrichmentProvider"
        :enrichmentMode="enrichmentMode"
        :enrichmentForceRefresh="enrichmentForceRefresh"
        :enrichmentRunning="enrichmentRunning"
        :dataItemsLength="dataItems.length"
        :selectedRecordCount="selectedRecordCount"
        @provider-change="onProviderChange"
        @mode-change="onModeChange"
        @force-refresh-change="onForceRefreshChange"
        @select-loaded="selectAllLoadedRecords"
        @clear-selection="clearSelectedRecords"
        @enrich-selected="enrichSelectedRecords"
      />

      <ExportPanel
        v-else-if="toolsTab === 'export'"
        :exportScope="exportScope"
        :exportFormat="exportFormat"
        :exportRunning="exportRunning"
        :selectAllMatchingRunning="selectAllMatchingRunning"
        :exportFieldOptions="exportFieldOptions"
        :exportSelectedFields="exportSelectedFields"
        :dataItemsLength="dataItems.length"
        :dataTotal="dataTotal"
        :dataLoading="dataLoading"
        :selectAllProgressText="selectAllProgressText"
        :selectedRecordCount="selectedRecordCount"
        :canExportRecords="canExportRecords"
        :exportError="exportError"
        :exportMessage="exportMessage"
        @scope-change="onExportScopeChange"
        @format-change="onExportFormatChange"
        @select-all-fields="selectAllExportFields"
        @clear-fields="clearExportFields"
        @toggle-field="onExportFieldToggle"
        @select-loaded="selectAllLoadedRecords"
        @select-all-matching="selectAllMatchingFilters"
        @clear-selection="clearSelectedRecords"
        @export="exportRecordsFile"
      />

      <ForumsPanel
        v-else-if="toolsTab === 'forums'"
        :forumSearchInput="forumSearchInput"
        :forumLoading="forumLoading"
        :forumGroupsTotal="forumGroupsTotal"
        :forumError="forumError"
        :forumGroups="forumGroups"
        :selectedForumGroup="selectedForumGroup"
        :selectedTargetForumId="selectedTargetForumId"
        :selectedSourceForumIds="selectedSourceForumIds"
        :forumHasMore="forumHasMore"
        :canPreviewForumMerge="canPreviewForumMerge"
        :canApplyForumMerge="canApplyForumMerge"
        :forumMergeLoading="forumMergeLoading"
        :forumMergeError="forumMergeError"
        :forumMergePreview="forumMergePreview"
        @forum-search-input="onForumSearchInput"
        @reload="reloadForumDuplicates"
        @load-more="loadMoreForumDuplicates"
        @select-group="selectForumGroup"
        @set-target="setTargetForum"
        @source-change="onSourceForumChange"
        @preview-merge="previewForumMerge"
        @apply-merge="applyForumMerge"
      />

      <ImportPanel
        v-else
        :importViewMode="importViewMode"
        :importWizardStep="importWizardStep"
        :importHistoryTotal="importHistoryTotal"
        :importHistoryLoading="importHistoryLoading"
        :importError="importError"
        :importMessage="importMessage"
        :importHistory="importHistory"
        :importDeleteLoadingId="importDeleteLoadingId"
        :importSourceOptions="importSourceOptions"
        :importFile="importFile"
        :importSource="importSource"
        :importDatabaseName="importDatabaseName"
        :requiresCustomDatabaseName="requiresCustomDatabaseName"
        :importPreview="importPreview"
        :importPreviewReady="importPreviewReady"
        :importPreviewLoading="importPreviewLoading"
        :importApplyLoading="importApplyLoading"
        :showImportCsvMapping="showImportCsvMapping"
        :importCsvFieldOptions="importCsvFieldOptions"
        :importCsvColumns="importCsvColumns"
        :importCsvMapping="importCsvMapping"
        :lastImportResult="lastImportResult"
        :canPromptImportEnrichment="canPromptImportEnrichment"
        :importedCreatedCount="importedCreatedCount"
        :canPreviewImport="canPreviewImport"
        :canCreateImport="canCreateImport"
        @reload-history="reloadImportHistory"
        @start-new-import="startNewImport"
        @remove-import="removeImport"
        @import-file-change="onImportFileChange"
        @source-change="onImportSourceChange"
        @database-name-input="onImportDatabaseNameInput"
        @csv-mapping-change="onImportCsvMappingChange"
        @clear-selection="clearImportSelection"
        @back-to-history="backToImportHistory"
        @preview-and-continue="previewImportAndContinue"
        @preview-file="previewImportFile"
        @set-step="setImportWizardStep"
        @create-import-file="createImportFile"
        @start-enrichment-for-imported="startEnrichmentForImportedRecords"
        @decline-import-enrichment="declineImportEnrichment"
      />
    </section>

    <RecordsGridWorkspace
      ref="dataGridRef"
      :showDataGrid="showDataGrid"
      :toolsTab="toolsTab"
      :selectedRecordCount="selectedRecordCount"
      :enrichmentRunning="enrichmentRunning"
      :enrichmentStopping="enrichmentStopping"
      :enrichmentMessage="enrichmentMessage"
      :enrichmentError="enrichmentError"
      :enrichmentProgressPercent="enrichmentProgressPercent"
      :enrichmentProcessed="enrichmentProcessed"
      :enrichmentTotal="enrichmentTotal"
      :enrichmentMetrics="enrichmentMetrics"
      :statusFilter="statusFilter"
      :statusOptions="statusOptions"
      :importFilterValue="importFilterValue"
      :importFilterOptions="importFilterOptions"
      :searchInput="searchInput"
      :dataCellsTruncated="dataCellsTruncated"
      :tableKey="tableKey"
      :tableRows="tableRows"
      :columns="columns"
      :columnHeaders="columnHeaders"
      :tableAutoRowSize="tableAutoRowSize"
      :tableRowHeights="tableRowHeights"
      :gridHeight="gridHeight"
      :cellMetaFactory="cellMetaFactory"
      :mappingEditorOpen="mappingEditorOpen"
      :mappingEditorPanelStyle="mappingEditorPanelStyle"
      :mappingEditorQuestionTitle="mappingEditorQuestionTitle"
      :mappingEditorSelectedOptions="mappingEditorSelectedOptions"
      :mappingEditorInput="mappingEditorInput"
      :mappingEditorCreateColor="mappingEditorCreateColor"
      :mappingEditorAvailableOptions="mappingEditorAvailableOptions"
      :canCreateMappingOption="canCreateMappingOption"
      :loadedCount="loadedCount"
      :totalCountLabel="totalCountLabel"
      :dataLoading="dataLoading"
      :dataHasMore="dataHasMore"
      @stop-enrichment="stopEnrichment"
      @status-filter-change="onStatusFilterChange"
      @import-filter-change="onImportFilterChange"
      @search-input="onSearchInput"
      @show-full-text-change="onShowFullTextChange"
      @after-change="onAfterChange"
      @after-scroll-vertically="onAfterScrollVertically"
      @after-cell-mouse-down="onAfterOnCellMouseDown"
      @mapping-close="closeMappingEditor"
      @mapping-input-update="onMappingEditorInputUpdate"
      @mapping-remove-option="removeMappingOption"
      @mapping-create-option="createMappingOption"
      @mapping-add-option="addMappingOption"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { format as formatDate } from "date-fns";
import type {
  CsvImportFieldKey,
  CsvImportMapping,
  EnrichmentMode,
  EnrichmentProvider,
  ExportFormat,
  ExportRequestPayload,
  ExportScope,
  ForumDuplicateGroup,
  ForumMergeResponse,
  ImportPreviewResponse,
  ImportSource,
  ImportSummary,
  StatusFilter,
} from "@shared/contracts";
import type { CellChange } from "handsontable/common";
import type { CellProperties, ColumnSettings, GridSettings } from "handsontable/settings";

import { DEFAULT_MAPPING_OPTION_COLOR, getRandomMappingOptionColor, normalizeMappingColor } from "../../constants/mapping";
import { STATUS_FILTER_OPTIONS } from "../../constants/status";
import { useDataGrid, type DataGridExpose } from "../../composables/useDataGrid";
import { useEnrichmentJob } from "../../composables/useEnrichmentJob";
import { decodeHtmlEntities, debounce } from "../../helpers/utils";
import { defaultStore } from "../../stores/default";
import { useDataToolsStore, type ImportWizardStep } from "../../stores/dataTools";
import EnrichmentPanel from "./panels/EnrichmentPanel.vue";
import ExportPanel from "./panels/ExportPanel.vue";
import ForumsPanel from "./panels/ForumsPanel.vue";
import ImportPanel from "./panels/ImportPanel.vue";
import { useRecordSelection } from "./composables/useRecordSelection";
import RecordsGridWorkspace from "./RecordsGridWorkspace.vue";
import "./styles.scss";
import {
  forums,
  imports as importApi,
  records,
  type MappingOption,
  type RecordItem,
  type RecordStatus,
} from "../../helpers/api";
import { getApiErrorMessage } from "../../helpers/errors";

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
type ConfidenceChip = {
  label: string;
  score: number;
  level: "high" | "medium" | "low";
  tooltip: string;
};
type ExportFieldOption = {
  key: string;
  label: string;
};

const statusOptions = STATUS_FILTER_OPTIONS;
const exportCsvBaseFieldOptions: ExportFieldOption[] = [
  { key: "id", label: "ID" },
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "year", label: "Year" },
  { key: "status", label: "Status" },
  { key: "abstract", label: "Abstract" },
  { key: "comment", label: "Comment" },
  { key: "doi", label: "DOI" },
  { key: "url", label: "URL" },
  { key: "alternateUrls", label: "Alternate URLs" },
  { key: "databases", label: "Databases" },
  { key: "forumName", label: "Forum Name" },
  { key: "forumIssn", label: "Forum ISSN" },
  { key: "forumPublisher", label: "Forum Publisher" },
  { key: "forumJufoLevel", label: "Forum Jufo Level" },
  { key: "citationCount", label: "Citation Count" },
  { key: "referenceCount", label: "Reference Count" },
  { key: "topicNames", label: "Topic Names" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedAt", label: "Updated At" },
];
const exportBibtexFieldOptions: ExportFieldOption[] = [
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "year", label: "Year" },
  { key: "journal", label: "Journal" },
  { key: "publisher", label: "Publisher" },
  { key: "issn", label: "ISSN" },
  { key: "doi", label: "DOI" },
  { key: "url", label: "URL" },
  { key: "abstract", label: "Abstract" },
  { key: "keywords", label: "Keywords" },
  { key: "note", label: "Note" },
];
const editableSources = new Set<string>([
  "edit",
  "CopyPaste.paste",
  "Autofill.fill",
  "UndoRedo.undo",
  "UndoRedo.redo",
]);

const store = defaultStore();
const dataToolsStore = useDataToolsStore();
const {
  dataItems,
  dataTotal,
  dataHasMore,
  dataLoading,
  dataCellsTruncated,
  statusFilter,
  searchFilter,
  dataImportFilterId,
  mappingQuestions,
  cellStates,
} = storeToRefs(store);
const {
  toolsTab,
  selectedRecordIds,
  exportScope,
  exportFormat,
  exportSelectedCsvFields,
  exportSelectedBibtexFields,
  exportCsvFieldsTouched,
  exportBibtexFieldsTouched,
  importViewMode,
  importWizardStep,
} = storeToRefs(dataToolsStore);

const dataGridRef = ref<DataGridExpose | null>(null);
const searchInput = ref(searchFilter.value);
const isUnmounted = ref(false);
const showDataGrid = computed(() => toolsTab.value === "enrichment" || toolsTab.value === "export");
const exportRunning = ref(false);
const exportError = ref("");
const exportMessage = ref("");
const selectAllMatchingRunning = ref(false);
const selectAllProgressLoaded = ref(0);
const selectAllProgressTotal = ref(0);
const importSourceOptions: Array<{ value: ImportSource; label: string }> = [
  { value: "auto", label: "Auto detect" },
  { value: "scopus", label: "Scopus" },
  { value: "acm", label: "ACM Digital Library" },
  { value: "google-scholar", label: "Google Scholar" },
  { value: "other-csv", label: "Other CSV" },
  { value: "other-bibtex", label: "Other BibTeX" },
];
const importCsvFieldOptions: Array<{ key: CsvImportFieldKey; label: string }> = [
  { key: "title", label: "Title" },
  { key: "author", label: "Authors" },
  { key: "year", label: "Year" },
  { key: "doi", label: "DOI" },
  { key: "url", label: "URL" },
  { key: "abstract", label: "Abstract" },
  { key: "forumName", label: "Forum name" },
  { key: "publisher", label: "Publisher" },
  { key: "issn", label: "ISSN" },
];

const forumGroups = ref<ForumDuplicateGroup[]>([]);
const forumGroupsTotal = ref(0);
const forumLimit = ref(50);
const forumLoading = ref(false);
const forumError = ref("");
const forumSearchInput = ref("");
const selectedForumGroupKey = ref<string | null>(null);
const selectedTargetForumId = ref<number | null>(null);
const selectedSourceForumIds = ref<number[]>([]);
const forumMergePreview = ref<ForumMergeResponse | null>(null);
const forumMergeLoading = ref(false);
const forumMergeError = ref("");
const importFile = ref<File | null>(null);
const importSource = ref<ImportSource>("auto");
const importDatabaseName = ref("");
const importSourceUserSelected = ref(false);
const importPreview = ref<ImportPreviewResponse | null>(null);
const importCsvMapping = ref<CsvImportMapping>({});
const importPreviewReady = ref(false);
const importPreviewLoading = ref(false);
const importApplyLoading = ref(false);
const importError = ref("");
const importMessage = ref("");
const importHistory = ref<ImportSummary[]>([]);
const importHistoryTotal = ref(0);
const importHistoryLoading = ref(false);
const importDeleteLoadingId = ref<number | null>(null);
const lastImportResult = ref<{ importId: number; createdRecordIds: number[] } | null>(null);

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
  enrichmentMode,
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

const {
  loadedCount,
  selectedRecordCount,
  selectedRecordIdSet,
  toggleRecordSelection,
  clearSelectedRecords,
  selectAllLoadedRecords,
  syncSelectionToLoadedRecords: syncSelectionToLoadedRecordsBase,
} = useRecordSelection({
  dataItems,
  selectedRecordIds,
});

const syncSelectionToLoadedRecords = () => {
  if (dataImportFilterId.value !== null) {
    return;
  }
  syncSelectionToLoadedRecordsBase();
};

const exportMappingFieldOptions = computed<ExportFieldOption[]>(() =>
  mappingQuestions.value.map((question) => ({
    key: `mappingQuestion:${question.id}`,
    label: question.title?.trim().length ? question.title : `Mapping Question ${question.id}`,
  })),
);
const exportCsvFieldOptions = computed<ExportFieldOption[]>(() => [
  ...exportCsvBaseFieldOptions,
  ...exportMappingFieldOptions.value,
]);
const exportFieldOptions = computed<ExportFieldOption[]>(() =>
  exportFormat.value === "csv" ? exportCsvFieldOptions.value : exportBibtexFieldOptions,
);
const exportSelectedFields = computed<string[]>(() =>
  exportFormat.value === "csv" ? exportSelectedCsvFields.value : exportSelectedBibtexFields.value,
);
const exportSelectedFieldSet = computed(() => new Set(exportSelectedFields.value));
const canExportRecords = computed(
  () =>
    !exportRunning.value
    && exportSelectedFields.value.length > 0
    && (exportScope.value !== "selected" || selectedRecordCount.value > 0),
);
const selectAllProgressText = computed(() => {
  const totalLabel = selectAllProgressTotal.value > 0 ? String(selectAllProgressTotal.value) : "...";
  return `Loading ${selectAllProgressLoaded.value} / ${totalLabel}`;
});
const selectedForumGroup = computed(
  () => forumGroups.value.find((group) => group.key === selectedForumGroupKey.value) ?? null,
);
const canPreviewForumMerge = computed(
  () => selectedTargetForumId.value !== null && selectedSourceForumIds.value.length > 0,
);
const canApplyForumMerge = computed(
  () =>
    canPreviewForumMerge.value
    && forumMergePreview.value !== null
    && forumMergePreview.value.targetForumId === selectedTargetForumId.value
    && JSON.stringify([...forumMergePreview.value.sourceForumIds].sort((a, b) => a - b))
      === JSON.stringify([...selectedSourceForumIds.value].sort((a, b) => a - b)),
);
const forumHasMore = computed(
  () => forumGroups.value.length < forumGroupsTotal.value,
);
const canPreviewImport = computed(
  () =>
    importFile.value !== null
    && (!selectedSourceRequiresDatabaseName.value || importDatabaseNameTrimmed.value.length > 0)
    && !importPreviewLoading.value
    && !importApplyLoading.value,
);
const canCreateImport = computed(
  () =>
    importFile.value !== null
    && (!requiresCustomDatabaseName.value || importDatabaseNameTrimmed.value.length > 0)
    && importPreview.value !== null
    && importPreviewReady.value
    && !importPreviewLoading.value
    && !importApplyLoading.value,
);
const importDatabaseNameTrimmed = computed(() => importDatabaseName.value.trim());
const selectedSourceRequiresDatabaseName = computed(
  () => importSource.value === "other-csv" || importSource.value === "other-bibtex",
);
const requiresCustomDatabaseName = computed(
  () =>
    selectedSourceRequiresDatabaseName.value
    || importPreview.value?.detectedSource === "other-csv"
    || importPreview.value?.detectedSource === "other-bibtex",
);
const importCsvColumns = computed(() => importPreview.value?.csvColumns ?? []);
const showImportCsvMapping = computed(
  () => importPreview.value?.detectedFormat === "csv" && importCsvColumns.value.length > 0,
);
const importedCreatedCount = computed(() => lastImportResult.value?.createdRecordIds.length ?? 0);
const canPromptImportEnrichment = computed(() => importedCreatedCount.value > 0);
const importFilterValue = computed(() =>
  dataImportFilterId.value === null ? "" : String(dataImportFilterId.value),
);
const importFilterOptions = computed<Array<{ label: string; value: string }>>(() => {
  const byId = new Map<number, string>();
  for (const entry of importHistory.value) {
    const fileName = entry.fileName?.trim() ? entry.fileName : "(no file name)";
    byId.set(entry.id, `#${entry.id} ${fileName}`);
  }

  if (dataImportFilterId.value !== null && !byId.has(dataImportFilterId.value)) {
    byId.set(dataImportFilterId.value, `#${dataImportFilterId.value}`);
  }

  return [...byId.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([id, label]) => ({ value: String(id), label }));
});
const totalCountLabel = computed(() => {
  if (dataLoading.value && dataTotal.value <= 0) {
    return "...";
  }
  return String(dataTotal.value);
});

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatDate(date, "dd.MM.yyyy HH:mm:ss");
};
const stringListToCell = (items: string[] | null | undefined) => (Array.isArray(items) ? items.join(", ") : "");
const confidenceLevel = (score: number): ConfidenceChip["level"] => {
  if (score >= 90) {
    return "high";
  }
  if (score >= 70) {
    return "medium";
  }
  return "low";
};

const recordEnrichmentChips = (record: RecordItem) => {
  const recordMap = record.enrichmentProvenance ?? {};
  const forumMap = record.Forum?.enrichmentProvenance ?? {};
  const fields: Array<{ key: string; label: string }> = [
    { key: "doi", label: "DOI" },
    { key: "url", label: "URL" },
    { key: "forumId", label: "Forum" },
    { key: "jufoLevel", label: "Jufo" },
    { key: "referenceItems", label: "Refs" },
    { key: "openAlexCitationItems", label: "Citations" },
    { key: "openAlexTopicItems", label: "Topics" },
  ];

  const chips: ConfidenceChip[] = [];

  for (const field of fields) {
    const provenance = recordMap[field.key] ?? forumMap[field.key];
    if (!provenance) {
      continue;
    }

    chips.push({
      label: field.label,
      score: provenance.confidenceScore,
      level: confidenceLevel(provenance.confidenceScore),
      tooltip: `${field.label}: ${provenance.provider} ${provenance.confidenceLevel} ${provenance.confidenceScore} - ${provenance.reason} (${formatTimestamp(provenance.enrichedAt)})`,
    });
  }

  return chips;
};

const recordMappingCellValue = (record: RecordItem, questionId: number) =>
  record.MappingOptions.filter((option) => option.mappingQuestionId === questionId)
    .map((option) => option.title)
    .join(", ");

const tableRows = computed<GridRow[]>(() =>
  dataItems.value.map((record) => {
    const hasTopicDetails = Array.isArray(record.openAlexTopicItems);
    const topicNames = hasTopicDetails
      ? (record.openAlexTopicItems ?? [])
        .map((topic) => topic.displayName ?? "")
        .filter((item) => item.length > 0)
      : [];
    const topicsCellValue = hasTopicDetails
      ? topicNames.join(", ")
      : String(record.topicCount ?? 0);

    const row: GridRow = {
      __recordId: record.id,
      __selected: selectedRecordIdSet.value.has(record.id),
      id: record.id,
      title: record.title,
      year: record.year ?? "",
      abstract: record.abstract ?? "",
      status: record.status ?? "null",
      comment: record.comment ?? "",
      enrichment: "",
      author: record.author,
      forum: record.Forum
        ? `${decodeHtmlEntities(record.Forum.name ?? "-")} | issn: ${record.Forum.issn ?? "-"} | publisher: ${decodeHtmlEntities(record.Forum.publisher ?? "-")} | jufo: ${record.Forum.jufoLevel ?? "-"}`
        : "-",
      url: record.url,
      databases: stringListToCell(record.databases),
      alternateUrls: stringListToCell(record.alternateUrls),
      doi: record.doi ?? "",
      references: String(record.referenceCount ?? record.referenceItems?.length ?? 0),
      citations: String(record.openAlexCitationItems?.length ?? record.citationCount ?? 0),
      topics: topicsCellValue,
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
  td.textContent = "";

  const wrapper = document.createElement("div");
  wrapper.className = "selection-cell__inner";

  const checkbox = document.createElement("input");
  checkbox.className = "selection-cell__checkbox";
  checkbox.type = "checkbox";
  checkbox.tabIndex = -1;
  checkbox.setAttribute("aria-label", "Select row");
  checkbox.checked = checked;

  wrapper.appendChild(checkbox);
  td.appendChild(wrapper);
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

function enrichmentRenderer(
  instance: unknown,
  td: HTMLTableCellElement,
  row: number,
) {
  void instance;
  td.classList.remove("data-text-cell", "mapping-cell");
  td.classList.add("confidence-cell");
  td.textContent = "";
  const shouldTruncate = dataCellsTruncated.value;

  const record = dataItems.value[row];
  const chips = record ? recordEnrichmentChips(record) : [];
  if (chips.length === 0) {
    const placeholder = document.createElement("span");
    placeholder.className = "mapping-cell-placeholder";
    placeholder.textContent = "-";
    td.appendChild(placeholder);
    return td;
  }

  const chipsContainer = document.createElement("div");
  chipsContainer.className = shouldTruncate
    ? "confidence-cell-chips confidence-cell-chips--truncated"
    : "confidence-cell-chips";

  for (const chip of chips) {
    const element = document.createElement("span");
    element.className = `confidence-cell-chip confidence-cell-chip--${chip.level}`;
    element.textContent = `${chip.label} ${chip.score}`;
    element.title = chip.tooltip;
    chipsContainer.appendChild(element);
  }

  td.title = chips.map((chip) => chip.tooltip).join("\n");
  td.appendChild(chipsContainer);
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
  td.textContent = "";
  const shouldTruncate = dataCellsTruncated.value;

  const questionId = parseMappingQuestionId(prop);
  const question = mappingQuestions.value.find((item) => item.id === questionId);
  const colorByTitle = new Map(
    (question?.MappingOptions ?? []).map((item) => [item.title.toLocaleLowerCase(), normalizeMappingColor(item.color)]),
  );

  const titles = parseListCellValue(value === null || value === undefined ? "" : String(value));
  if (titles.length === 0) {
    const placeholder = document.createElement("span");
    placeholder.className = "mapping-cell-placeholder";
    placeholder.textContent = "Double-click to edit";
    td.appendChild(placeholder);
    return td;
  }

  const chipsContainer = document.createElement("div");
  chipsContainer.className = shouldTruncate ? "mapping-cell-chips mapping-cell-chips--truncated" : "mapping-cell-chips";

  for (const title of titles) {
    const color = colorByTitle.get(title.toLocaleLowerCase()) ?? DEFAULT_MAPPING_OPTION_COLOR;
    const chip = document.createElement("span");
    chip.className = "mapping-cell-chip";
    chip.style.backgroundColor = color;
    chip.textContent = title;
    chipsContainer.appendChild(chip);
  }

  td.appendChild(chipsContainer);
  return td;
}

const leadingColumns: Array<{ header: string; settings: ColumnSettings }> = [
  { header: "", settings: { data: "__selected", readOnly: true, renderer: selectionRenderer, width: 42 } },
  { header: "id", settings: { data: "id", readOnly: true, width: 64 } },
  { header: "title", settings: { data: "title", type: "text", renderer: truncatedTextRenderer, width: 320 } },
  { header: "year", settings: { data: "year", type: "numeric", width: 86 } },
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
  { header: "forum", settings: { data: "forum", readOnly: true, renderer: truncatedTextRenderer, width: 240 } },
  { header: "references", settings: { data: "references", readOnly: true, width: 100 } },
  { header: "citations", settings: { data: "citations", readOnly: true, width: 100 } },
  { header: "topics", settings: { data: "topics", type: "text", renderer: truncatedTextRenderer, width: 260 } },
  { header: "doi", settings: { data: "doi", type: "text", renderer: truncatedTextRenderer, width: 210 } },
  { header: "url", settings: { data: "url", type: "text", renderer: truncatedTextRenderer, width: 260 } },
  {
    header: "alternateUrls",
    settings: { data: "alternateUrls", type: "text", renderer: truncatedTextRenderer, width: 240 },
  },
  { header: "databases", settings: { data: "databases", type: "text", renderer: truncatedTextRenderer, width: 220 } },
  {
    header: "enrichment confidence",
    settings: { data: "enrichment", readOnly: true, renderer: enrichmentRenderer, width: 300 },
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
  ...leadingColumns,
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

const setSelectedExportFields = (fields: string[]) => {
  if (exportFormat.value === "csv") {
    exportSelectedCsvFields.value = fields;
    exportCsvFieldsTouched.value = true;
    return;
  }
  exportSelectedBibtexFields.value = fields;
  exportBibtexFieldsTouched.value = true;
};

const selectAllExportFields = () => {
  setSelectedExportFields(exportFieldOptions.value.map((field) => field.key));
};

const clearExportFields = () => {
  setSelectedExportFields([]);
};

const onExportFieldToggle = (fieldKey: string, event: Event) => {
  const checked = (event.target as HTMLInputElement).checked;
  if (checked) {
    if (!exportSelectedFieldSet.value.has(fieldKey)) {
      setSelectedExportFields([...exportSelectedFields.value, fieldKey]);
    }
    return;
  }

  setSelectedExportFields(exportSelectedFields.value.filter((field) => field !== fieldKey));
};

const onExportScopeChange = (event: Event) => {
  exportScope.value = (event.target as HTMLSelectElement).value as ExportScope;
};

const onExportFormatChange = (event: Event) => {
  exportFormat.value = (event.target as HTMLSelectElement).value as ExportFormat;
};

const selectAllMatchingFilters = async () => {
  if (selectAllMatchingRunning.value || exportRunning.value || dataTotal.value <= 0) {
    return;
  }

  selectAllMatchingRunning.value = true;
  exportError.value = "";
  exportMessage.value = "";
  selectAllProgressLoaded.value = dataItems.value.length;
  selectAllProgressTotal.value = dataTotal.value;

  try {
    let iterationGuard = 0;
    while (dataHasMore.value && iterationGuard < 1000) {
      iterationGuard += 1;
      const loadedBefore = dataItems.value.length;
      await store.loadMoreData();
      selectAllProgressLoaded.value = dataItems.value.length;
      selectAllProgressTotal.value = dataTotal.value;
      if (dataItems.value.length === loadedBefore) {
        break;
      }
    }

    selectedRecordIds.value = dataItems.value.map((item) => item.id);
    exportMessage.value = `Selected ${selectedRecordIds.value.length} records matching current filters.`;
  } catch (error) {
    exportError.value = getApiErrorMessage(error);
  } finally {
    selectAllMatchingRunning.value = false;
  }
};

const buildExportFilters = (): NonNullable<ExportRequestPayload["filters"]> => {
  const filters: NonNullable<ExportRequestPayload["filters"]> = {};
  if (statusFilter.value !== "") {
    filters.status = statusFilter.value;
  }
  const trimmedSearch = searchFilter.value.trim();
  if (trimmedSearch.length > 0) {
    filters.search = trimmedSearch;
  }
  if (dataImportFilterId.value !== null) {
    filters.importId = dataImportFilterId.value;
  }
  return filters;
};

const triggerFileDownload = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
};

const exportRecordsFile = async () => {
  if (!canExportRecords.value || selectAllMatchingRunning.value) {
    return;
  }

  exportRunning.value = true;
  exportError.value = "";
  exportMessage.value = "";

  const payload: ExportRequestPayload = {
    format: exportFormat.value,
    scope: exportScope.value,
    fields: [...exportSelectedFields.value],
  };

  if (exportScope.value === "selected") {
    payload.recordIds = [...selectedRecordIds.value];
  } else {
    payload.filters = buildExportFilters();
  }

  try {
    const response = await records.exportFile(payload);
    triggerFileDownload(response.blob, response.filename);
    exportMessage.value = `Export complete (${response.filename}).`;
  } catch (error) {
    exportError.value = getApiErrorMessage(error);
  } finally {
    exportRunning.value = false;
  }
};

const handleCellChange = async (recordId: number, prop: string, nextValue: string) => {
  if (prop === "title" || prop === "author" || prop === "url") {
    await store.patchRecord(recordId, { [prop]: nextValue });
    return;
  }

  if (prop === "year") {
    const trimmed = nextValue.trim();
    if (trimmed.length === 0) {
      await store.patchRecord(recordId, { year: null });
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(parsed)) {
      throw new Error("Year must be a valid integer");
    }

    await store.patchRecord(recordId, { year: parsed });
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

  if (prop === "topics") {
    const topicNames = parseListCellValue(nextValue);
    const current = getRecordById(recordId);
    const currentByName = new Map(
      (current?.openAlexTopicItems ?? [])
        .filter((item): item is NonNullable<typeof item> => Boolean(item?.displayName))
        .map((item) => [String(item.displayName).toLocaleLowerCase(), item]),
    );

    await store.patchRecord(recordId, {
      openAlexTopicItems: topicNames.map((displayName) => {
        const existing = currentByName.get(displayName.toLocaleLowerCase());
        return {
          displayName,
          id: existing?.id ?? null,
          score: existing?.score ?? null,
          subfield: existing?.subfield ?? null,
          field: existing?.field ?? null,
          domain: existing?.domain ?? null,
        };
      }),
    });
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
const debouncedForumSearch = debounce(() => {
  void loadForumDuplicates(true);
}, 350);

const resetForumMergeSelection = () => {
  selectedForumGroupKey.value = null;
  selectedTargetForumId.value = null;
  selectedSourceForumIds.value = [];
  forumMergePreview.value = null;
  forumMergeError.value = "";
};

const loadForumDuplicates = async (reset: boolean) => {
  if (forumLoading.value) {
    return;
  }

  forumLoading.value = true;
  forumError.value = "";

  const nextOffset = reset ? 0 : forumGroups.value.length;
  try {
    const response = await forums.duplicates({
      offset: nextOffset,
      limit: forumLimit.value,
      ...(forumSearchInput.value.trim().length > 0 ? { search: forumSearchInput.value.trim() } : {}),
    });

    forumGroupsTotal.value = response.data.count;
    if (reset) {
      forumGroups.value = response.data.groups;
    } else {
      const existingKeys = new Set(forumGroups.value.map((group) => group.key));
      const appended = response.data.groups.filter((group) => !existingKeys.has(group.key));
      forumGroups.value = [...forumGroups.value, ...appended];
    }

    if (
      selectedForumGroupKey.value
      && !forumGroups.value.some((group) => group.key === selectedForumGroupKey.value)
    ) {
      resetForumMergeSelection();
    }
  } catch (error) {
    forumError.value = getApiErrorMessage(error);
  } finally {
    forumLoading.value = false;
  }
};

const onSearchInput = (value: string) => {
  searchInput.value = value;
  closeMappingEditor();
  debouncedSearch(value);
};

const onStatusFilterChange = (value: StatusFilter) => {
  closeMappingEditor();
  void store.setStatusFilter(value);
};

const parseImportFilterValue = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const applyImportFilter = async (importId: number | null, preserveSelection = false) => {
  if (!preserveSelection) {
    selectedRecordIds.value = [];
  }

  await store.setDataImportFilter(importId);
};

const onImportFilterChange = (value: string) => {
  closeMappingEditor();
  void applyImportFilter(parseImportFilterValue(value), false);
};

const onShowFullTextChange = (showFullText: boolean) => {
  closeMappingEditor();
  store.setDataCellsTruncated(!showFullText);
};

const onProviderChange = (event: Event) => {
  enrichmentProvider.value = (event.target as HTMLSelectElement).value as EnrichmentProvider;
};

const onModeChange = (event: Event) => {
  const nextMode = (event.target as HTMLSelectElement).value as EnrichmentMode;
  store.setEnrichmentMode(nextMode);
};

const onForceRefreshChange = (event: Event) => {
  enrichmentForceRefresh.value = (event.target as HTMLInputElement).checked;
};

const onExportTabOpen = () => {
  toolsTab.value = "export";
};

const onForumsTabOpen = () => {
  toolsTab.value = "forums";
  if (forumGroups.value.length === 0) {
    void loadForumDuplicates(true);
  }
};

const onForumSearchInput = (event: Event) => {
  forumSearchInput.value = (event.target as HTMLInputElement).value;
  debouncedForumSearch();
};

const reloadForumDuplicates = () => {
  resetForumMergeSelection();
  void loadForumDuplicates(true);
};

const loadMoreForumDuplicates = () => {
  void loadForumDuplicates(false);
};

const selectForumGroup = (groupKey: string) => {
  selectedForumGroupKey.value = groupKey;
  const group = forumGroups.value.find((item) => item.key === groupKey);
  if (!group || group.forums.length === 0) {
    selectedTargetForumId.value = null;
    selectedSourceForumIds.value = [];
    forumMergePreview.value = null;
    return;
  }

  const sorted = [...group.forums].sort((left, right) => right.recordCount - left.recordCount || left.id - right.id);
  const [target, ...sources] = sorted;
  selectedTargetForumId.value = target?.id ?? null;
  selectedSourceForumIds.value = sources.map((item) => item.id);
  forumMergePreview.value = null;
  forumMergeError.value = "";
};

const setTargetForum = (forumId: number) => {
  selectedTargetForumId.value = forumId;
  selectedSourceForumIds.value = selectedSourceForumIds.value.filter((id) => id !== forumId);
  forumMergePreview.value = null;
  forumMergeError.value = "";
};

const toggleSourceForum = (forumId: number, checked: boolean) => {
  if (selectedTargetForumId.value === forumId) {
    return;
  }

  if (checked) {
    if (!selectedSourceForumIds.value.includes(forumId)) {
      selectedSourceForumIds.value = [...selectedSourceForumIds.value, forumId];
    }
  } else {
    selectedSourceForumIds.value = selectedSourceForumIds.value.filter((id) => id !== forumId);
  }

  forumMergePreview.value = null;
  forumMergeError.value = "";
};

const onSourceForumChange = (forumId: number, event: Event) => {
  toggleSourceForum(forumId, (event.target as HTMLInputElement).checked);
};

const previewForumMerge = async () => {
  if (!canPreviewForumMerge.value || selectedTargetForumId.value === null) {
    return;
  }

  forumMergeLoading.value = true;
  forumMergeError.value = "";
  try {
    const response = await forums.merge({
      targetForumId: selectedTargetForumId.value,
      sourceForumIds: selectedSourceForumIds.value,
      dryRun: true,
    });
    forumMergePreview.value = response.data;
  } catch (error) {
    forumMergeError.value = getApiErrorMessage(error);
  } finally {
    forumMergeLoading.value = false;
  }
};

const applyForumMerge = async () => {
  if (!canApplyForumMerge.value || selectedTargetForumId.value === null) {
    return;
  }

  forumMergeLoading.value = true;
  forumMergeError.value = "";

  try {
    await forums.merge({
      targetForumId: selectedTargetForumId.value,
      sourceForumIds: selectedSourceForumIds.value,
      dryRun: false,
    });

    resetForumMergeSelection();
    await Promise.all([loadForumDuplicates(true), store.loadInitialData(), store.fetchPageItems()]);
  } catch (error) {
    forumMergeError.value = getApiErrorMessage(error);
  } finally {
    forumMergeLoading.value = false;
  }
};

const readFileAsText = async (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });

const markImportPreviewStale = (reason?: string) => {
  if (!importPreview.value) {
    importPreviewReady.value = false;
    return;
  }
  importPreviewReady.value = false;
  if (importWizardStep.value > 2) {
    importWizardStep.value = 2;
  }
  if (reason) {
    importMessage.value = reason;
  }
};

const clearImportSelection = () => {
  importFile.value = null;
  importSource.value = "auto";
  importDatabaseName.value = "";
  importSourceUserSelected.value = false;
  importPreview.value = null;
  importCsvMapping.value = {};
  importPreviewReady.value = false;
  importError.value = "";
  importMessage.value = "";
  importWizardStep.value = 1;
  lastImportResult.value = null;
};

const resetImportDraftKeepMessage = () => {
  importFile.value = null;
  importSource.value = "auto";
  importDatabaseName.value = "";
  importSourceUserSelected.value = false;
  importPreview.value = null;
  importCsvMapping.value = {};
  importPreviewReady.value = false;
  importWizardStep.value = 1;
};

const startNewImport = () => {
  clearImportSelection();
  importViewMode.value = "wizard";
};

const backToImportHistory = () => {
  importViewMode.value = "history";
};

const setImportWizardStep = (step: ImportWizardStep) => {
  importWizardStep.value = step;
};

const loadImportHistory = async () => {
  if (importHistoryLoading.value) {
    return;
  }

  importHistoryLoading.value = true;
  try {
    const response = await importApi.index({ offset: 0, limit: 50 });
    importHistory.value = response.data.imports;
    importHistoryTotal.value = response.data.count;
  } catch (error) {
    importError.value = getApiErrorMessage(error);
  } finally {
    importHistoryLoading.value = false;
  }
};

const reloadImportHistory = () => {
  void loadImportHistory();
};

const onImportFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  importFile.value = target.files?.[0] ?? null;
  importSource.value = "auto";
  importDatabaseName.value = "";
  importSourceUserSelected.value = false;
  importPreview.value = null;
  importCsvMapping.value = {};
  importPreviewReady.value = false;
  importError.value = "";
  importMessage.value = "";
  importWizardStep.value = 1;
  lastImportResult.value = null;
};

const onImportSourceChange = (event: Event) => {
  importSourceUserSelected.value = true;
  importSource.value = (event.target as HTMLSelectElement).value as ImportSource;
  markImportPreviewStale("Import settings changed. Run Preview before importing.");
};

const onImportDatabaseNameInput = (event: Event) => {
  importDatabaseName.value = (event.target as HTMLInputElement).value;
  markImportPreviewStale("Import settings changed. Run Preview before importing.");
};

const onImportCsvMappingChange = (field: CsvImportFieldKey, event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  importCsvMapping.value = {
    ...importCsvMapping.value,
    [field]: value.length > 0 ? value : null,
  };
  markImportPreviewStale("CSV mapping changed. Run Preview before importing.");
};

const buildImportPayload = (fileName: string, content: string) => {
  const payload: {
    fileName: string;
    source: ImportSource;
    databaseName?: string;
    content: string;
    csvMapping?: CsvImportMapping;
  } = {
    fileName,
    source: importSource.value,
    content,
  };
  if (importDatabaseNameTrimmed.value.length > 0) {
    payload.databaseName = importDatabaseNameTrimmed.value;
  }

  if (Object.keys(importCsvMapping.value).length > 0) {
    payload.csvMapping = importCsvMapping.value;
  }

  return payload;
};

const previewImportFile = async () => {
  if (!importFile.value) {
    return false;
  }

  importPreviewLoading.value = true;
  importPreviewReady.value = false;
  importError.value = "";
  importMessage.value = "";

  try {
    const content = await readFileAsText(importFile.value);
    const response = await importApi.preview(buildImportPayload(importFile.value.name, content));
    importPreview.value = response.data;
    importCsvMapping.value = response.data.appliedCsvMapping ? { ...response.data.appliedCsvMapping } : {};
    if (!importSourceUserSelected.value || importSource.value === "auto") {
      importSource.value = response.data.detectedSource;
    }
    importPreviewReady.value = true;
    return true;
  } catch (error) {
    importError.value = getApiErrorMessage(error);
    return false;
  } finally {
    importPreviewLoading.value = false;
  }
};

const previewImportAndContinue = async () => {
  const succeeded = await previewImportFile();
  if (succeeded) {
    importWizardStep.value = 2;
  }
};

const createImportFile = async () => {
  if (!importFile.value) {
    return;
  }

  if (!importPreview.value) {
    importError.value = "Preview is required before importing.";
    return;
  }

  if (!importPreviewReady.value) {
    importError.value = "Preview is outdated. Run Preview before importing.";
    return;
  }

  importApplyLoading.value = true;
  importError.value = "";
  importMessage.value = "";

  try {
    const content = await readFileAsText(importFile.value);
    const response = await importApi.create(buildImportPayload(importFile.value.name, content));

    const createdRecordIds = [...new Set(response.data.createdRecordIds)];
    lastImportResult.value = {
      importId: response.data.import.id,
      createdRecordIds,
    };
    importMessage.value = `Import #${response.data.import.id} created. Imported ${response.data.createdRecordIds.length} records.`;
    await Promise.all([loadImportHistory(), store.loadInitialData(), store.fetchPageItems()]);
    resetImportDraftKeepMessage();
    importWizardStep.value = 4;
  } catch (error) {
    importError.value = getApiErrorMessage(error);
  } finally {
    importApplyLoading.value = false;
  }
};

const startEnrichmentForImportedRecords = async () => {
  const result = lastImportResult.value;
  if (!result || result.createdRecordIds.length === 0) {
    return;
  }

  closeMappingEditor();
  toolsTab.value = "enrichment";
  store.statusFilter = "";
  store.searchFilter = "";
  searchInput.value = "";
  await applyImportFilter(result.importId, true);
  selectedRecordIds.value = [...result.createdRecordIds];
  importViewMode.value = "history";
  importMessage.value = `Import #${result.importId} ready for enrichment (${result.createdRecordIds.length} selected).`;
};

const declineImportEnrichment = () => {
  const result = lastImportResult.value;
  if (result) {
    importMessage.value = `Import #${result.importId} complete. Use the import filter in Enrichment when ready.`;
  }
  backToImportHistory();
};

const removeImport = async (importId: number) => {
  if (!window.confirm(`Delete import #${importId} and all records imported in it?`)) {
    return;
  }

  importDeleteLoadingId.value = importId;
  importError.value = "";
  importMessage.value = "";
  try {
    const response = await importApi.delete(importId);
    importMessage.value = `Import #${response.data.importId} deleted with ${response.data.deletedRecords} records.`;
    if (dataImportFilterId.value === importId) {
      await applyImportFilter(null, false);
    }
    await Promise.all([loadImportHistory(), store.loadInitialData(), store.fetchPageItems()]);
  } catch (error) {
    importError.value = getApiErrorMessage(error);
  } finally {
    importDeleteLoadingId.value = null;
  }
};

const onImportsTabOpen = () => {
  toolsTab.value = "imports";
  importViewMode.value = "history";
  if (importHistory.value.length === 0) {
    void loadImportHistory();
  }
};

watch(
  () => exportCsvFieldOptions.value.map((field) => field.key),
  (nextKeys) => {
    const available = new Set(nextKeys);
    if (!exportCsvFieldsTouched.value) {
      exportSelectedCsvFields.value = [...nextKeys];
      return;
    }
    exportSelectedCsvFields.value = exportSelectedCsvFields.value.filter((field) => available.has(field));
  },
  { immediate: true },
);

watch(
  () => exportBibtexFieldOptions.map((field) => field.key),
  (nextKeys) => {
    const available = new Set(nextKeys);
    if (!exportBibtexFieldsTouched.value) {
      exportSelectedBibtexFields.value = [...nextKeys];
      return;
    }
    exportSelectedBibtexFields.value = exportSelectedBibtexFields.value.filter((field) => available.has(field));
  },
  { immediate: true },
);

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

watch(
  () => toolsTab.value,
  (value) => {
    if (value !== "enrichment") {
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

  await Promise.all([store.fetchMappingQuestions(), store.loadInitialData(), loadImportHistory()]);

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
