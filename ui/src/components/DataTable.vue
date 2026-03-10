<template>
  <section class="data-tab">
    <DataToolbar
      :statusFilter="statusFilter"
      :statusOptions="statusOptions"
      :searchInput="searchInput"
      :showFullText="!dataCellsTruncated"
      @status-filter-change="onStatusFilterChange"
      @search-input="onSearchInput"
      @show-full-text-change="onShowFullTextChange"
    />

    <section class="data-tools">
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

      <div v-else class="data-tools__panel data-tools__panel--forums">
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
                  {{ group.normalizedName || group.issn || group.key }}
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
                    <strong>{{ forum.name || "(Unnamed forum)" }}</strong>
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
    </section>

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
import type {
  EnrichmentMode,
  EnrichmentProvider,
  ForumDuplicateGroup,
  ForumDuplicateItem,
  ForumMergeResponse,
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
import { debounce } from "../helpers/utils";
import { defaultStore } from "../stores/default";
import { forums, type MappingOption, type RecordItem, type RecordStatus } from "../helpers/api";
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
type DataToolsTab = "enrichment" | "forums";

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
const formatConfidenceBadge = (score: number) => {
  if (score >= 90) {
    return `H${score}`;
  }
  if (score >= 70) {
    return `M${score}`;
  }
  return `L${score}`;
};

const recordEnrichmentDisplay = (record: RecordItem) => {
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

  const summary: string[] = [];
  const details: string[] = [];

  for (const field of fields) {
    const provenance = recordMap[field.key] ?? forumMap[field.key];
    if (!provenance) {
      continue;
    }

    summary.push(`${field.label} ${formatConfidenceBadge(provenance.confidenceScore)}`);
    details.push(
      `${field.label}: ${provenance.provider} ${provenance.confidenceLevel} ${provenance.confidenceScore} - ${provenance.reason} (${formatTimestamp(provenance.enrichedAt)})`,
    );
  }

  return {
    summary: summary.join(" | "),
    details: details.join("\n"),
  };
};

const sumRecordCounts = (forumsList: ForumDuplicateItem[]) =>
  forumsList.reduce((sum, forum) => sum + forum.recordCount, 0);

const recordMappingCellValue = (record: RecordItem, questionId: number) =>
  record.MappingOptions.filter((option) => option.mappingQuestionId === questionId)
    .map((option) => option.title)
    .join(", ");

const tableRows = computed<GridRow[]>(() =>
  dataItems.value.map((record) => {
    const topicNames = record.openAlexTopicItems?.map((topic) => topic.displayName ?? "").filter((item) => item.length > 0) ?? [];
    const topicsCellValue = topicNames.length > 0
      ? topicNames.join(", ")
      : String(record.topicCount ?? 0);
    const enrichment = recordEnrichmentDisplay(record);

    const row: GridRow = {
      __recordId: record.id,
      __selected: selectedRecordIdSet.value.has(record.id),
      id: record.id,
      title: record.title,
      year: record.year ?? "",
      abstract: record.abstract ?? "",
      status: record.status ?? "null",
      comment: record.comment ?? "",
      enrichment: enrichment.summary || "-",
      enrichmentDetails: enrichment.details,
      author: record.author,
      forum: record.Forum
        ? `${record.Forum.name ?? "-"} | issn: ${record.Forum.issn ?? "-"} | publisher: ${record.Forum.publisher ?? "-"} | jufo: ${record.Forum.jufoLevel ?? "-"}`
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
  _instance: unknown,
  td: HTMLTableCellElement,
  row: number,
  _col: number,
  _prop: string | number,
  value: unknown,
) {
  const record = dataItems.value[row];
  const display = record ? recordEnrichmentDisplay(record) : { summary: "", details: "" };
  const summary = String(value ?? display.summary ?? "").trim();
  const details = display.details.trim();
  td.title = details.length > 0 ? details : summary;
  return truncatedTextRenderer(_instance, td, row, _col, _prop, summary);
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

const priorityColumns: Array<{ header: string; settings: ColumnSettings }> = [
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
  { header: "enrichment", settings: { data: "enrichment", readOnly: true, renderer: enrichmentRenderer, width: 260 } },
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

.data-tools {
  border: 1px solid #eaeaea;
  background: #fff;
  margin-top: -2px;
  margin-bottom: 8px;

  &__tabs {
    display: flex;
    gap: 4px;
    padding: 8px 10px 0;
  }

  &__tab {
    height: 28px;
    padding: 0 10px;
    border: 1px solid #d7d7d7;
    border-bottom: 0;
    background: #f8f8f8;
    color: #5b5858;
    font-size: 12px;
    font-weight: 600;

    &--active {
      background: #fff;
      color: #2f4fc6;
    }
  }

  &__panel {
    border-top: 1px solid #eaeaea;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 10px;
    padding: 10px;
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
    min-height: 0;
  }

  &__groups {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 240px;
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
    min-height: 240px;

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
    max-height: 180px;
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
}
</style>
