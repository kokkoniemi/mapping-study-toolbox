<template>
  <div class="data-tools__panel data-tools__panel--imports data-tools__panel--workspace">
    <div v-if="importViewMode === 'history'" class="import-tools__history-head import-tools__history-head--top">
      <h4>Import history</h4>
      <span class="import-tools__history-count">{{ importHistoryTotal }} total</span>
      <button type="button" :disabled="importHistoryLoading" @click="emit('reload-history')">
        {{ importHistoryLoading ? "Loading..." : "Reload" }}
      </button>
      <button type="button" class="data-tools__primary" @click="emit('start-new-import')">New import</button>
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
            @click="emit('remove-import', entry.id)"
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
              'import-wizard__step-item--active': importWizardStep === 1,
              'import-wizard__step-item--done': importWizardStep > 1,
            }"
          >
            1. Select file
          </li>
          <li
            class="import-wizard__step-item"
            :class="{
              'import-wizard__step-item--active': importWizardStep === 2,
              'import-wizard__step-item--done': importWizardStep > 2,
            }"
          >
            2. Review preview
          </li>
          <li
            class="import-wizard__step-item"
            :class="{
              'import-wizard__step-item--active': importWizardStep === 3,
              'import-wizard__step-item--done': importWizardStep > 3,
            }"
          >
            3. Import
          </li>
          <li
            class="import-wizard__step-item"
            :class="{ 'import-wizard__step-item--active': importWizardStep === 4 }"
          >
            4. Complete
          </li>
        </ol>
      </aside>

      <div class="import-wizard__panel">
        <div class="import-wizard__body">
          <section v-if="importWizardStep === 1" class="import-wizard__card">
            <h4>Step 1: Choose file and source</h4>
            <div class="import-tools__top">
              <label class="import-tools__label import-tools__label--file">
                <span>File</span>
                <input
                  type="file"
                  accept=".csv,.bib,.bibtex,.txt,text/csv,text/plain,application/x-bibtex"
                  @change="emit('import-file-change', $event)"
                />
              </label>

              <label class="import-tools__label">
                <span>Source</span>
                <select :value="importSource" :disabled="importPreviewLoading || importApplyLoading" @change="emit('source-change', $event)">
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
                  @input="emit('database-name-input', $event)"
                />
              </label>
            </div>
          </section>

          <section v-else-if="importWizardStep === 2" class="import-wizard__card">
            <h4>Step 2: Review preview</h4>
            <p v-if="importPreview && !importPreviewReady" class="import-tools__warning">
              Preview is outdated. Run Preview again before continuing.
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
                    @change="emit('csv-mapping-change', field.key, $event)"
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

          <section v-else-if="importWizardStep === 3" class="import-wizard__card">
            <h4>Step 3: Import</h4>
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
          </section>

          <section v-else class="import-wizard__card">
            <h4>Step 4: Complete</h4>
            <p class="import-tools__message">
              Import #{{ lastImportResult?.importId }} complete.
            </p>
            <p v-if="canPromptImportEnrichment" class="import-tools__empty">
              Enrich {{ importedCreatedCount }} imported record{{ importedCreatedCount === 1 ? "" : "s" }} now?
            </p>
            <p v-else class="import-tools__empty">
              No new records were created in this import.
            </p>
          </section>
        </div>

        <footer class="import-wizard__footer">
          <div class="import-wizard__footer-meta">
            Step {{ importWizardStep }} of 4
          </div>
          <div class="import-wizard__footer-actions">
            <button type="button" :disabled="!importFile && !importPreview" @click="emit('clear-selection')">Reset</button>

            <template v-if="importWizardStep === 1">
              <button type="button" @click="emit('back-to-history')">Cancel</button>
              <button type="button" class="data-tools__primary" :disabled="!canPreviewImport" @click="emit('preview-and-continue')">
                {{ importPreviewLoading ? "Previewing..." : "Next" }}
              </button>
            </template>

            <template v-else-if="importWizardStep === 2">
              <button type="button" :disabled="importPreviewLoading || importApplyLoading" @click="emit('set-step', 1)">Back</button>
              <button type="button" :disabled="!canPreviewImport" @click="emit('preview-file')">
                {{ importPreviewLoading ? "Previewing..." : "Refresh Preview" }}
              </button>
              <button
                type="button"
                class="data-tools__primary"
                :disabled="!importPreviewReady || !importPreview"
                @click="emit('set-step', 3)"
              >
                Next
              </button>
            </template>

            <template v-else-if="importWizardStep === 3">
              <button type="button" :disabled="importApplyLoading" @click="emit('set-step', 2)">Back</button>
              <button type="button" @click="emit('back-to-history')">Cancel</button>
              <button type="button" class="data-tools__primary" :disabled="!canCreateImport" @click="emit('create-import-file')">
                {{ importApplyLoading ? "Importing..." : "Import" }}
              </button>
            </template>

            <template v-else>
              <button type="button" @click="emit('start-new-import')">Import Another</button>
              <button v-if="!canPromptImportEnrichment" type="button" @click="emit('back-to-history')">Close</button>
              <button
                v-if="canPromptImportEnrichment"
                type="button"
                class="data-tools__primary"
                @click="emit('start-enrichment-for-imported')"
              >
                Enrich Imported
              </button>
              <button v-if="canPromptImportEnrichment" type="button" @click="emit('decline-import-enrichment')">Not Now</button>
            </template>
          </div>
        </footer>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { format as formatDate } from "date-fns";
import type {
  CsvImportFieldKey,
  CsvImportMapping,
  ImportPreviewResponse,
  ImportSource,
  ImportSummary,
} from "@shared/contracts";
import type { ImportViewMode, ImportWizardStep } from "../../../stores/dataTools";

defineProps<{
  importViewMode: ImportViewMode;
  importWizardStep: ImportWizardStep;
  importHistoryTotal: number;
  importHistoryLoading: boolean;
  importError: string;
  importMessage: string;
  importHistory: ImportSummary[];
  importDeleteLoadingId: number | null;
  importSourceOptions: Array<{ value: ImportSource; label: string }>;
  importFile: File | null;
  importSource: ImportSource;
  importDatabaseName: string;
  requiresCustomDatabaseName: boolean;
  importPreview: ImportPreviewResponse | null;
  importPreviewReady: boolean;
  importPreviewLoading: boolean;
  importApplyLoading: boolean;
  showImportCsvMapping: boolean;
  importCsvFieldOptions: Array<{ key: CsvImportFieldKey; label: string }>;
  importCsvColumns: string[];
  importCsvMapping: CsvImportMapping;
  lastImportResult: { importId: number; createdRecordIds: number[] } | null;
  canPromptImportEnrichment: boolean;
  importedCreatedCount: number;
  canPreviewImport: boolean;
  canCreateImport: boolean;
}>();

const emit = defineEmits<{
  "reload-history": [];
  "start-new-import": [];
  "remove-import": [importId: number];
  "import-file-change": [event: Event];
  "source-change": [event: Event];
  "database-name-input": [event: Event];
  "csv-mapping-change": [field: CsvImportFieldKey, event: Event];
  "clear-selection": [];
  "back-to-history": [];
  "preview-and-continue": [];
  "preview-file": [];
  "set-step": [step: ImportWizardStep];
  "create-import-file": [];
  "start-enrichment-for-imported": [];
  "decline-import-enrichment": [];
}>();

const formatTimestamp = (value: string) => {
  try {
    return formatDate(new Date(value), "dd.MM.yyyy HH:mm");
  } catch {
    return value;
  }
};

const formatImportQuery = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
};
</script>
