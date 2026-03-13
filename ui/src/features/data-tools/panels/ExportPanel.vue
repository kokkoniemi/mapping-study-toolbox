<template>
  <div class="data-tools__panel data-tools__panel--export">
    <div class="data-tools__group">
      <label class="data-tools__label">
        <span>Scope</span>
      </label>
      <select :value="exportScope" :disabled="exportRunning || selectAllMatchingRunning" @change="emit('scope-change', $event)">
        <option value="all_filtered">Current filtered set</option>
        <option value="selected">Selected records</option>
      </select>
    </div>

    <div class="data-tools__group">
      <label class="data-tools__label">
        <span>Format</span>
      </label>
      <select :value="exportFormat" :disabled="exportRunning" @change="emit('format-change', $event)">
        <option value="csv">CSV</option>
        <option value="bibtex">BibTeX</option>
      </select>
    </div>

    <div class="export-tools__fields">
      <div class="export-tools__fields-header">
        <label class="data-tools__label">Fields</label>
        <div class="export-tools__field-actions">
          <button type="button" :disabled="exportRunning" @click="emit('select-all-fields')">All</button>
          <button type="button" :disabled="exportRunning" @click="emit('clear-fields')">None</button>
        </div>
      </div>
      <div class="export-tools__field-list">
        <label v-for="field in exportFieldOptions" :key="field.key" class="export-tools__field-item">
          <input
            type="checkbox"
            :checked="exportSelectedFields.includes(field.key)"
            :disabled="exportRunning"
            @change="emit('toggle-field', field.key, $event)"
          />
          <span>{{ field.label }}</span>
        </label>
      </div>
    </div>

    <div class="data-tools__actions export-tools__actions">
      <button type="button" :disabled="!dataItemsLength || exportRunning || selectAllMatchingRunning" @click="emit('select-loaded')">
        Select loaded
      </button>
      <button
        type="button"
        :disabled="!dataTotal || exportRunning || selectAllMatchingRunning || dataLoading"
        @click="emit('select-all-matching')"
      >
        {{ selectAllMatchingRunning ? selectAllProgressText : "Select all matching filters" }}
      </button>
      <button
        type="button"
        :disabled="selectedRecordCount === 0 || exportRunning || selectAllMatchingRunning"
        @click="emit('clear-selection')"
      >
        Clear selection
      </button>
      <button
        type="button"
        class="data-tools__primary"
        :disabled="!canExportRecords || selectAllMatchingRunning"
        @click="emit('export')"
      >
        {{ exportRunning ? "Exporting..." : "Export" }}
      </button>
    </div>

    <StatusMessage v-if="exportError" class="export-tools__error" tone="error" :message="exportError" />
    <StatusMessage v-else-if="exportMessage" class="export-tools__message" tone="success" :message="exportMessage" />
  </div>
</template>

<script setup lang="ts">
import StatusMessage from "../../../components/ui/StatusMessage.vue";

type ExportFieldOption = { key: string; label: string };

defineProps<{
  exportScope: string;
  exportFormat: string;
  exportRunning: boolean;
  selectAllMatchingRunning: boolean;
  exportFieldOptions: ExportFieldOption[];
  exportSelectedFields: string[];
  dataItemsLength: number;
  dataTotal: number;
  dataLoading: boolean;
  selectAllProgressText: string;
  selectedRecordCount: number;
  canExportRecords: boolean;
  exportError: string;
  exportMessage: string;
}>();

const emit = defineEmits<{
  "scope-change": [event: Event];
  "format-change": [event: Event];
  "select-all-fields": [];
  "clear-fields": [];
  "toggle-field": [fieldKey: string, event: Event];
  "select-loaded": [];
  "select-all-matching": [];
  "clear-selection": [];
  export: [];
}>();
</script>
