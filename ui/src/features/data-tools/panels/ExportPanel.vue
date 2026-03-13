<template>
  <div class="data-tools__panel data-tools__panel--export">
    <section class="export-tools__section export-tools__section--setup">
      <h4 class="export-tools__section-title">Setup</h4>
      <div class="export-tools__setup-grid">
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
      </div>
    </section>

    <section class="export-tools__section export-tools__section--fields">
      <div class="export-tools__fields">
        <div class="export-tools__fields-header">
          <h4 class="export-tools__section-title">Fields</h4>
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
      <footer class="export-tools__footer">
        <button
          type="button"
          class="data-tools__primary"
          :disabled="!canExportRecords || selectAllMatchingRunning"
          @click="emit('export')"
        >
          {{ exportRunning ? "Exporting..." : "Export" }}
        </button>
      </footer>
    </section>

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
  export: [];
}>();
</script>
