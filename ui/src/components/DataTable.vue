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

      <div v-if="toolsTab === 'enrichment'" class="data-tools__panel">
        <div class="data-tools__group">
          <label class="data-tools__label">
            <span>Service</span>
            <span class="data-tools__info" tabindex="0" role="img" aria-label="Service info">
              i
              <span class="data-tools__popover">
                Crossref enriches DOI, references, forum details and authors. OpenAlex enriches citations, topics, and affiliations.
              </span>
            </span>
          </label>
          <select :value="enrichmentProvider" :disabled="enrichmentRunning" @change="onProviderChange">
            <option value="crossref">Crossref</option>
            <option value="openalex">OpenAlex</option>
            <option value="all">Crossref + OpenAlex</option>
          </select>
        </div>

        <div class="data-tools__group">
          <label class="data-tools__label">
            <span>Mode</span>
            <span class="data-tools__info" tabindex="0" role="img" aria-label="Mode info">
              i
              <span class="data-tools__popover">
                Missing only updates empty fields. Full refresh re-fetches and can overwrite existing enrichment values.
              </span>
            </span>
          </label>
          <select :value="enrichmentMode" :disabled="enrichmentRunning" @change="onModeChange">
            <option value="missing">Missing only</option>
            <option value="full">Full</option>
          </select>
        </div>

        <div class="data-tools__group">
          <label class="data-tools__label">
            <span>Refresh</span>
            <span class="data-tools__info" tabindex="0" role="img" aria-label="Refresh info">
              i
              <span class="data-tools__popover">
                Force refresh bypasses freshness windows and executes as full provider fetch.
              </span>
            </span>
          </label>
          <label class="data-tools__toggle">
            <input
              :checked="enrichmentForceRefresh"
              type="checkbox"
              :disabled="enrichmentRunning"
              @change="onForceRefreshChange"
            />
            <span>Force refresh</span>
          </label>
        </div>

        <div class="data-tools__actions">
          <button type="button" @click="selectAllLoadedRecords" :disabled="!dataItems.length || enrichmentRunning">
            Select loaded
          </button>
          <button type="button" @click="clearSelectedRecords" :disabled="selectedRecordCount === 0 || enrichmentRunning">
            Clear
          </button>
          <button
            type="button"
            class="data-tools__primary"
            @click="enrichSelectedRecords"
            :disabled="selectedRecordCount === 0 || enrichmentRunning"
          >
            Enrich selected
          </button>
        </div>
      </div>

      <div v-else-if="toolsTab === 'forums'" class="data-tools__panel data-tools__panel--forums data-tools__panel--workspace">
        <div class="forum-tools__top">
          <label class="forum-tools__label">
            <span>Search duplicates</span>
            <input
              :value="forumSearchInput"
              type="text"
              placeholder="Search by forum name or ISSN"
              @input="onForumSearchInput"
            />
          </label>
          <button type="button" :disabled="forumLoading" @click="reloadForumDuplicates">
            {{ forumLoading ? "Loading..." : "Reload" }}
          </button>
          <span class="forum-tools__count">{{ forumGroupsTotal }} groups</span>
        </div>

        <p v-if="forumError" class="forum-tools__error">{{ forumError }}</p>

        <div class="forum-tools__content">
          <ul class="forum-tools__groups">
            <li v-for="group in forumGroups" :key="group.key" class="forum-tools__group">
              <button
                type="button"
                class="forum-tools__group-button"
                :class="{ 'forum-tools__group-button--active': selectedForumGroup?.key === group.key }"
                @click="selectForumGroup(group.key)"
              >
                <span class="forum-tools__group-title">
                  {{ decodeHtmlEntities(group.normalizedName || group.issn || group.key) }}
                </span>
                <span class="forum-tools__group-meta">
                  {{ group.count }} forums, {{ sumRecordCounts(group.forums) }} records
                </span>
              </button>
            </li>
            <li v-if="forumGroups.length === 0 && !forumLoading" class="forum-tools__empty">No duplicate groups</li>
          </ul>
          <button
            v-if="forumHasMore"
            type="button"
            class="forum-tools__load-more"
            :disabled="forumLoading"
            @click="loadMoreForumDuplicates"
          >
            {{ forumLoading ? "Loading..." : "Load more groups" }}
          </button>

          <div class="forum-tools__merge">
            <template v-if="selectedForumGroup">
              <h4>Merge {{ selectedForumGroup.count }} forums</h4>
              <p class="forum-tools__hint">Choose one target forum and one or more source forums to merge.</p>

              <ul class="forum-tools__forums">
                <li v-for="forum in selectedForumGroup.forums" :key="forum.id" class="forum-tools__forum">
                  <label class="forum-tools__target">
                    <input
                      type="radio"
                      name="forum-target"
                      :checked="selectedTargetForumId === forum.id"
                      @change="setTargetForum(forum.id)"
                    />
                    <span>Target</span>
                  </label>
                  <label class="forum-tools__source">
                    <input
                      type="checkbox"
                      :checked="selectedSourceForumIds.includes(forum.id)"
                      :disabled="selectedTargetForumId === forum.id"
                      @change="onSourceForumChange(forum.id, $event)"
                    />
                    <span>Source</span>
                  </label>
                  <div class="forum-tools__forum-meta">
                    <strong>{{ forum.name ? decodeHtmlEntities(forum.name) : "(Unnamed forum)" }}</strong>
                    <span>id {{ forum.id }}</span>
                    <span v-if="forum.issn">ISSN {{ forum.issn }}</span>
                    <span>{{ forum.recordCount }} records</span>
                  </div>
                </li>
              </ul>

              <div class="forum-tools__merge-actions">
                <button type="button" :disabled="!canPreviewForumMerge || forumMergeLoading" @click="previewForumMerge">
                  Preview merge
                </button>
                <button
                  type="button"
                  class="data-tools__primary"
                  :disabled="!canApplyForumMerge || forumMergeLoading"
                  @click="applyForumMerge"
                >
                  {{ forumMergeLoading ? "Applying..." : "Apply merge" }}
                </button>
              </div>

              <p v-if="forumMergeError" class="forum-tools__error">{{ forumMergeError }}</p>
              <p v-if="forumMergePreview" class="forum-tools__preview">
                Preview: move {{ forumMergePreview.movedRecordCount }} records and merge {{ forumMergePreview.mergedAliases.length }} aliases.
              </p>
            </template>
            <p v-else class="forum-tools__empty">Select a duplicate group to merge forums.</p>
          </div>
        </div>
      </div>

      <div v-else class="data-tools__panel data-tools__panel--imports data-tools__panel--workspace">
        <div v-if="importViewMode === 'history'" class="import-tools__history-head import-tools__history-head--top">
          <h4>Import history</h4>
          <span class="import-tools__history-count">{{ importHistoryTotal }} total</span>
          <button type="button" :disabled="importHistoryLoading" @click="reloadImportHistory">
            {{ importHistoryLoading ? "Loading..." : "Reload" }}
          </button>
          <button type="button" class="data-tools__primary" @click="startNewImport">New import</button>
        </div>

        <p v-if="importError" class="import-tools__error">{{ importError }}</p>
        <p v-if="importMessage" class="import-tools__message">{{ importMessage }}</p>

        <section v-if="importViewMode === 'history'" class="import-tools__history import-tools__history--workspace">
          <ul class="import-tools__history-list import-tools__history-list--workspace">
            <li v-for="entry in importHistory" :key="entry.id" class="import-tools__history-item">
              <div class="import-tools__history-meta">
                <strong>#{{ entry.id }} {{ entry.fileName || "(no file name)" }}</strong>
                <span>{{ entry.source || "-" }} / {{ entry.format || "-" }}</span>
                <span>
                  Imported {{ entry.imported ?? 0 }} / {{ entry.total ?? 0 }}
                  (duplicates {{ entry.dublicates ?? 0 }})
                </span>
                <span>{{ entry.recordCount }} linked records</span>
                <details class="import-tools__history-details">
                  <summary>Details</summary>
                  <div class="import-tools__history-details-body">
                    <span>Database: {{ entry.database || "-" }}</span>
                    <span>Created: {{ formatTimestamp(entry.createdAt) }}</span>
                    <span>Updated: {{ formatTimestamp(entry.updatedAt) }}</span>
                    <span v-if="entry.namesakes?.length">Namesakes: {{ entry.namesakes.join(", ") }}</span>
                    <pre v-if="entry.query">{{ formatImportQuery(entry.query) }}</pre>
                  </div>
                </details>
              </div>
              <button
                type="button"
                class="import-tools__danger"
                :disabled="importDeleteLoadingId === entry.id"
                @click="removeImport(entry.id)"
              >
                {{ importDeleteLoadingId === entry.id ? "Deleting..." : "Delete import + records" }}
              </button>
            </li>
            <li v-if="!importHistoryLoading && importHistory.length === 0" class="import-tools__empty">
              No imports yet.
            </li>
          </ul>
        </section>

        <div v-else class="import-wizard">
          <aside class="import-wizard__steps">
            <h4>Import Wizard</h4>
            <ol class="import-wizard__step-list">
              <li
                class="import-wizard__step-item"
                :class="{
                  'import-wizard__step-item--active': importWizardCurrentStep === 1,
                  'import-wizard__step-item--done': !!importFile,
                }"
              >
                1. Select file
              </li>
              <li
                class="import-wizard__step-item"
                :class="{
                  'import-wizard__step-item--active': importWizardCurrentStep === 2,
                  'import-wizard__step-item--done': !!importPreview,
                }"
              >
                2. Preview and map fields
              </li>
              <li
                class="import-wizard__step-item"
                :class="{
                  'import-wizard__step-item--active': importWizardCurrentStep === 3,
                  'import-wizard__step-item--done': importPreviewReady,
                }"
              >
                3. Import
              </li>
            </ol>
            <button type="button" @click="backToImportHistory">Back to history</button>
            <button type="button" :disabled="!importFile && !importPreview" @click="clearImportSelection">Reset wizard</button>
          </aside>

          <div class="import-wizard__body">
            <section class="import-wizard__card">
              <h4>Step 1: Choose file and source</h4>
              <div class="import-tools__top">
                <label class="import-tools__label import-tools__label--file">
                  <span>File</span>
                  <input
                    type="file"
                    accept=".csv,.bib,.bibtex,.txt,text/csv,text/plain,application/x-bibtex"
                    @change="onImportFileChange"
                  />
                </label>

                <label class="import-tools__label">
                  <span>Source</span>
                  <select :value="importSource" :disabled="importPreviewLoading || importApplyLoading" @change="onImportSourceChange">
                    <option v-for="option in importSourceOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </label>

                <label v-if="requiresCustomDatabaseName" class="import-tools__label">
                  <span>Database name</span>
                  <input
                    :value="importDatabaseName"
                    type="text"
                    placeholder="e.g. IEEE_XPLORE"
                    :disabled="importPreviewLoading || importApplyLoading"
                    @input="onImportDatabaseNameInput"
                  />
                </label>

                <div class="import-tools__actions import-tools__actions--inline">
                  <button type="button" :disabled="!canPreviewImport" @click="previewImportFile">
                    {{ importPreviewLoading ? "Previewing..." : "Run preview" }}
                  </button>
                </div>
              </div>
            </section>

            <section class="import-wizard__card">
              <h4>Step 2: Review preview</h4>
              <p v-if="importPreview && !importPreviewReady" class="import-tools__warning">
                Preview is outdated. Run Preview again before importing.
              </p>

              <section v-if="showImportCsvMapping" class="import-tools__mapping">
                <h4>Column mapping</h4>
                <p class="import-tools__mapping-hint">
                  Confirm or adjust guessed mappings. Empty means “not mapped”.
                </p>
                <div class="import-tools__mapping-grid">
                  <label
                    v-for="field in importCsvFieldOptions"
                    :key="field.key"
                    class="import-tools__mapping-field"
                  >
                    <span>{{ field.label }}</span>
                    <select
                      :value="importCsvMapping[field.key] ?? ''"
                      :disabled="importPreviewLoading || importApplyLoading"
                      @change="onImportCsvMappingChange(field.key, $event)"
                    >
                      <option value="">(Not mapped)</option>
                      <option v-for="column in importCsvColumns" :key="`${field.key}-${column}`" :value="column">
                        {{ column }}
                      </option>
                    </select>
                  </label>
                </div>
              </section>

              <div v-if="importPreview" class="import-tools__summary">
                <span>{{ importPreview.detectedSource }} / {{ importPreview.detectedFormat }}</span>
                <span>Database {{ importPreview.databaseLabel }}</span>
                <span>Total {{ importPreview.total }}</span>
                <span>New {{ importPreview.newRecords }}</span>
                <span>Duplicates {{ importPreview.duplicates }}</span>
                <span>Invalid {{ importPreview.invalid }}</span>
              </div>

              <ul v-if="importPreview?.warnings?.length" class="import-tools__warnings">
                <li v-for="warning in importPreview.warnings" :key="warning">{{ warning }}</li>
              </ul>

              <div v-if="importPreview" class="import-tools__table-wrap">
                <table class="import-tools__table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Status</th>
                      <th>Title</th>
                      <th>Author</th>
                      <th>Year</th>
                      <th>DOI</th>
                      <th>Duplicate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in importPreview.records" :key="`${row.rowNumber}-${row.title ?? ''}`">
                      <td>{{ row.rowNumber }}</td>
                      <td>
                        <span class="import-tools__status" :class="`import-tools__status--${row.status}`">
                          {{ row.status }}
                        </span>
                      </td>
                      <td>{{ row.title || "-" }}</td>
                      <td>{{ row.author || "-" }}</td>
                      <td>{{ row.year ?? "-" }}</td>
                      <td>{{ row.doi || "-" }}</td>
                      <td>
                        <span v-if="row.duplicateReason">
                          {{ row.duplicateReason }}
                          <template v-if="row.duplicateRecordId">(#{{ row.duplicateRecordId }})</template>
                        </span>
                        <span v-else>-</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p v-else class="import-tools__empty">Choose a file and run Preview to continue.</p>
            </section>

            <section class="import-wizard__card">
              <h4>Step 3: Import</h4>
              <div class="import-tools__actions import-tools__actions--end">
                <button type="button" class="data-tools__primary" :disabled="!canCreateImport" @click="createImportFile">
                  {{ importApplyLoading ? "Importing..." : "Import records" }}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>

    <template v-if="showDataGrid">
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

      <DataToolbar
        :statusFilter="statusFilter"
        :statusOptions="statusOptions"
        :searchInput="searchInput"
        :showFullText="!dataCellsTruncated"
        @status-filter-change="onStatusFilterChange"
        @search-input="onSearchInput"
        @show-full-text-change="onShowFullTextChange"
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
    </template>
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
  ForumDuplicateGroup,
  ForumDuplicateItem,
  ForumMergeResponse,
  ImportPreviewResponse,
  ImportSource,
  ImportSummary,
  StatusFilter,
} from "@shared/contracts";
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
import { decodeHtmlEntities, debounce } from "../helpers/utils";
import { defaultStore } from "../stores/default";
import { forums, imports as importApi, type MappingOption, type RecordItem, type RecordStatus } from "../helpers/api";
import { getApiErrorMessage } from "../helpers/errors";

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
type DataToolsTab = "enrichment" | "forums" | "imports";
type ImportViewMode = "history" | "wizard";
type ConfidenceChip = {
  label: string;
  score: number;
  level: "high" | "medium" | "low";
  tooltip: string;
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
const toolsTab = ref<DataToolsTab>("enrichment");
const showDataGrid = computed(() => toolsTab.value === "enrichment");
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
const importViewMode = ref<ImportViewMode>("history");

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

const loadedCount = computed(() => dataItems.value.length);
const selectedRecordCount = computed(() => selectedRecordIds.value.length);
const selectedRecordIdSet = computed(() => new Set(selectedRecordIds.value));
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
const importWizardCurrentStep = computed(() => {
  if (!importFile.value) {
    return 1;
  }
  if (!importPreview.value || !importPreviewReady.value) {
    return 2;
  }
  return 3;
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
const formatImportQuery = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
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

const sumRecordCounts = (forumsList: ForumDuplicateItem[]) =>
  forumsList.reduce((sum, forum) => sum + forum.recordCount, 0);

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
};

const resetImportDraftKeepMessage = () => {
  importFile.value = null;
  importSource.value = "auto";
  importDatabaseName.value = "";
  importSourceUserSelected.value = false;
  importPreview.value = null;
  importCsvMapping.value = {};
  importPreviewReady.value = false;
};

const startNewImport = () => {
  clearImportSelection();
  importViewMode.value = "wizard";
};

const backToImportHistory = () => {
  importViewMode.value = "history";
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
    return;
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
  } catch (error) {
    importError.value = getApiErrorMessage(error);
  } finally {
    importPreviewLoading.value = false;
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

    importPreview.value = response.data.summary;
    importCsvMapping.value = response.data.summary.appliedCsvMapping
      ? { ...response.data.summary.appliedCsvMapping }
      : {};
    importPreviewReady.value = true;
    importMessage.value = `Import #${response.data.import.id} created. Imported ${response.data.createdRecordIds.length} records.`;
    await Promise.all([loadImportHistory(), store.loadInitialData(), store.fetchPageItems()]);
    importViewMode.value = "history";
    resetImportDraftKeepMessage();
  } catch (error) {
    importError.value = getApiErrorMessage(error);
  } finally {
    importApplyLoading.value = false;
  }
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

.data-tools {
  border: 1px solid #eaeaea;
  border-radius: 0;
  overflow: visible;
  background: #fff;
  margin-top: 0;
  margin-bottom: 8px;

  &__tabs {
    display: flex;
    gap: 0;
    padding: 8px 10px 0;
    background: #fff;
    border-bottom: 1px solid #eaeaea;
  }

  &__tab {
    height: auto;
    margin: 0 5px 0 0;
    padding: 5px 10px;
    border: 0 solid transparent;
    border-width: 1px 1px 0 1px;
    border-radius: 0;
    background: #fff;
    color: #8a8a8a;
    font-size: 12px;
    font-weight: 500;
    transform: translateY(1px);
    transition: background-color 0.2s ease-in, border-color 0.2s ease-in, color 0.2s ease-in;
    position: relative;

    &:hover:not(&--active) {
      background: #f7f7f7;
      border-color: #eaeaea;
    }

    &--active {
      background: #ffffff;
      color: #2c3e50;
      font-weight: 700;
      border-color: #eaeaea;
      box-shadow: none;

      &::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        bottom: -1px;
        height: 2px;
        background: #fff;
      }
    }
  }

  &__panel {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px;
    padding: 12px;
  }

  &--workspace {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    margin-bottom: 0;
  }

  &__panel--workspace {
    flex: 1;
    min-height: 0;
    align-items: stretch;
    overflow: hidden;
    border-top: 0;
  }

  &__panel--forums,
  &__panel--imports {
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: 10px;
  }

  &__group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 150px;
  }

  &__label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #5b5858;
    text-transform: uppercase;
    line-height: 1.2;
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    font-size: 12px;
    color: #5b5858;

    input {
      margin: 0;
    }
  }

  &__info {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
    border: 1px solid #bdbdbd;
    border-radius: 50%;
    font-size: 10px;
    font-weight: 600;
    color: #7a7a7a;
    cursor: help;
    position: relative;
    background: #fff;
  }

  &__popover {
    display: none;
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    width: 260px;
    padding: 8px 10px;
    border: 1px solid #d8d8d8;
    border-radius: 4px;
    background: #fff;
    color: #444;
    font-size: 11px;
    font-weight: 400;
    line-height: 1.35;
    text-transform: none;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
    z-index: 300;
    pointer-events: none;
  }

  &__info:hover &__popover,
  &__info:focus &__popover,
  &__info:focus-visible &__popover {
    display: block;
  }

  &__actions {
    margin-left: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  &__primary {
    border-color: #3c67d8 !important;
    color: #2d4fc9 !important;
    font-weight: 600;
  }

  select,
  input[type="text"] {
    height: 30px;
    box-sizing: border-box;
  }

  button {
    height: 30px;
    padding: 0 10px;
    border: 1px solid #dedede;
    background: #ffffff;
    color: #5b5858;
    font-size: 12px;

    &:hover:not(:disabled) {
      background: #f6f6f6;
    }

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
  }
}

.forum-tools {
  &__top {
    width: 100%;
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }

  &__label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: min(320px, 100%);
    flex: 1;
    font-size: 12px;
    color: #5b5858;
    text-transform: uppercase;
  }

  &__count {
    font-size: 12px;
    color: #6a6a6a;
    white-space: nowrap;
  }

  &__error {
    margin: 0;
    color: #8f2a2a;
    font-size: 12px;
  }

  &__content {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
    gap: 10px;
    flex: 1;
    min-height: 0;
  }

  &__groups {
    list-style: none;
    margin: 0;
    padding: 0;
    min-height: 0;
    overflow: auto;
    border: 1px solid #ededed;
    background: #fafafa;
  }

  &__group + &__group {
    border-top: 1px solid #ebebeb;
  }

  &__group-button {
    width: 100%;
    height: auto !important;
    text-align: left;
    padding: 8px;
    border: 0 !important;
    background: transparent !important;
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: #4a4a4a !important;

    &--active {
      background: #eef3ff !important;
    }
  }

  &__group-title {
    font-size: 12px;
    font-weight: 600;
  }

  &__group-meta {
    font-size: 11px;
    color: #767676;
  }

  &__load-more {
    margin-top: 8px;
  }

  &__merge {
    border: 1px solid #ededed;
    background: #fff;
    padding: 8px;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;

    h4 {
      margin: 0 0 4px;
      font-size: 14px;
      color: #425a6a;
    }
  }

  &__hint {
    margin: 0 0 8px;
    font-size: 12px;
    color: #737373;
  }

  &__forums {
    list-style: none;
    margin: 0;
    padding: 0;
    min-height: 0;
    flex: 1;
    overflow: auto;
  }

  &__forum {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    padding: 6px 0;
    border-top: 1px solid #f0f0f0;
  }

  &__forum:first-child {
    border-top: 0;
  }

  &__target,
  &__source {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #5b5858;
  }

  &__forum-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: 12px;
    min-width: 0;

    strong {
      font-weight: 600;
      color: #374a58;
    }
  }

  &__merge-actions {
    margin-top: 8px;
    display: flex;
    gap: 6px;
  }

  &__preview {
    margin: 8px 0 0;
    font-size: 12px;
    color: #4f5d69;
  }

  &__empty {
    margin: 0;
    padding: 8px;
    font-size: 12px;
    color: #8b8b8b;
  }
}

.import-tools {
  &__top {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 8px;
  }

  &__label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 180px;
    font-size: 12px;
    color: #5b5858;
    text-transform: uppercase;

    &--file {
      min-width: 260px;
      flex: 1;
    }

    input[type="file"] {
      height: 30px;
      font-size: 12px;
    }
  }

  &__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-left: auto;

    &--inline {
      margin-left: 0;
    }

    &--end {
      width: 100%;
      justify-content: flex-end;
      margin-left: 0;
    }
  }

  &__error {
    margin: 0;
    font-size: 12px;
    color: #8f2a2a;
  }

  &__message {
    margin: 0;
    font-size: 12px;
    color: #395c3f;
  }

  &__warning {
    margin: 0;
    font-size: 12px;
    color: #8e6e21;
  }

  &__mapping {
    width: 100%;
    border: 1px solid #ededed;
    background: #fafafa;
    padding: 8px;

    h4 {
      margin: 0;
      font-size: 13px;
      color: #425a6a;
    }
  }

  &__mapping-hint {
    margin: 4px 0 0;
    font-size: 11px;
    color: #6f6f6f;
  }

  &__mapping-grid {
    margin-top: 8px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 8px;
  }

  &__mapping-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: #5b5858;
    text-transform: uppercase;
  }

  &__summary {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 12px;
    color: #5d5d5d;
  }

  &__warnings {
    width: 100%;
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    color: #8e6e21;
  }

  &__history {
    border: 1px solid #ededed;
    background: #fff;
    padding: 8px;
    min-height: 0;

    h4 {
      margin: 0 0 8px;
      font-size: 14px;
      color: #425a6a;
    }
  }

  &__table-wrap {
    max-height: min(45vh, 420px);
    overflow: auto;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;

    th,
    td {
      padding: 5px 6px;
      border-bottom: 1px solid #efefef;
      text-align: left;
      vertical-align: top;
    }

    th {
      color: #5f5f5f;
      text-transform: uppercase;
      font-size: 11px;
      position: sticky;
      top: 0;
      background: #fafafa;
      z-index: 1;
    }
  }

  &__status {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 11px;

    &--new {
      color: #2f6f3f;
    }

    &--duplicate {
      color: #8f6d2a;
    }

    &--invalid {
      color: #8f2a2a;
    }
  }

  &__history-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    h4 {
      margin: 0;
    }

    &--top {
      width: 100%;
      border: 1px solid #ededed;
      background: #fafafa;
      padding: 8px;
      box-sizing: border-box;
    }
  }

  &__history-count {
    margin-left: auto;
    font-size: 12px;
    color: #737373;
  }

  &__history-list {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    max-height: min(35vh, 320px);
    overflow: auto;
    scrollbar-gutter: stable;

    &--workspace {
      max-height: none;
      height: 100%;
      padding-right: 10px;
      box-sizing: border-box;
      margin-top: 0;
    }
  }

  &__history-item {
    border-top: 1px solid #f0f0f0;
    padding: 8px 0;
    padding-right: 4px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  &__history-item:first-child {
    border-top: 0;
    padding-top: 0;
  }

  &__history-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 12px;
    color: #5f5f5f;
  }

  &__history-details {
    margin-top: 4px;

    summary {
      cursor: pointer;
      color: #4f5d69;
      font-size: 12px;
      user-select: none;
    }
  }

  &__history-details-body {
    margin-top: 6px;
    display: grid;
    gap: 4px;
    font-size: 12px;
    color: #5f5f5f;

    pre {
      margin: 2px 0 0;
      padding: 6px;
      max-height: 160px;
      overflow: auto;
      border: 1px solid #e9e9e9;
      background: #fcfcfc;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-word;
    }
  }

  &__history--workspace {
    width: 100%;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  &__danger {
    border-color: #bf5d5d !important;
    color: #8f2a2a !important;
    white-space: nowrap;
  }

  &__empty {
    margin: 0;
    font-size: 12px;
    color: #8b8b8b;
  }
}

.import-wizard {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(200px, 240px) minmax(0, 1fr);
  gap: 10px;
  align-items: stretch;

  &__steps {
    border: 1px solid #ededed;
    background: #fafafa;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;

    h4 {
      margin: 0;
      font-size: 14px;
      color: #425a6a;
    }
  }

  &__step-list {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 12px;
    color: #666;
  }

  &__step-item {
    font-weight: 500;

    &--active {
      color: #2f4fc6;
      font-weight: 700;
    }

    &--done {
      color: #2f6f3f;
    }
  }

  &__body {
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-right: 2px;
  }

  &__card {
    border: 1px solid #ededed;
    background: #fff;
    padding: 10px;

    h4 {
      margin: 0 0 8px;
      font-size: 14px;
      color: #425a6a;
    }
  }
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

@media (max-width: 1200px) {
  .data-tools__actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-start;
  }

  .forum-tools__content {
    grid-template-columns: 1fr;
  }

  .forum-tools__merge {
    min-height: 0;
  }

  .import-tools__actions {
    margin-left: 0;
    width: 100%;
  }

  .import-wizard {
    grid-template-columns: 1fr;
  }
}
</style>
