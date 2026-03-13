<template>
  <div class="data-tools__panel">
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
      <select :value="enrichmentProvider" :disabled="enrichmentRunning" @change="emit('provider-change', $event)">
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
      <select :value="enrichmentMode" :disabled="enrichmentRunning" @change="emit('mode-change', $event)">
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
          @change="emit('force-refresh-change', $event)"
        />
        <span>Force refresh</span>
      </label>
    </div>

    <div class="data-tools__actions">
      <button type="button" :disabled="!dataItemsLength || enrichmentRunning" @click="emit('select-loaded')">
        Select loaded
      </button>
      <button type="button" :disabled="selectedRecordCount === 0 || enrichmentRunning" @click="emit('clear-selection')">
        Clear
      </button>
      <button
        type="button"
        class="data-tools__primary"
        :disabled="selectedRecordCount === 0 || enrichmentRunning"
        @click="emit('enrich-selected')"
      >
        Enrich selected
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  enrichmentProvider: string;
  enrichmentMode: string;
  enrichmentForceRefresh: boolean;
  enrichmentRunning: boolean;
  dataItemsLength: number;
  selectedRecordCount: number;
}>();

const emit = defineEmits<{
  "provider-change": [event: Event];
  "mode-change": [event: Event];
  "force-refresh-change": [event: Event];
  "select-loaded": [];
  "clear-selection": [];
  "enrich-selected": [];
}>();
</script>

