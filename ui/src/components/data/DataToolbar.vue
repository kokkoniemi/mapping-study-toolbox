<template>
  <header class="data-toolbar">
    <div class="data-toolbar__group">
      <label>Status</label>
      <select :value="statusFilter" @change="emitStatusFilterChange">
        <option v-for="option in statusOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="data-toolbar__group data-toolbar__group--search">
      <label>Search</label>
      <input
        :value="searchInput"
        @input="emitSearchInput"
        placeholder="Search title, abstract, comment..."
        type="text"
      />
    </div>

    <div class="data-toolbar__group data-toolbar__group--toggle">
      <label>Cell options</label>
      <label class="data-toolbar__toggle">
        <input type="checkbox" :checked="showFullText" @change="emitShowFullTextChange" />
        <span>Show full text</span>
      </label>
    </div>

    <div class="data-toolbar__group data-toolbar__group--enrichment">
      <label class="data-toolbar__label">
        <span>Service</span>
        <span class="data-toolbar__info" tabindex="0" role="img" aria-label="Service info">
          i
          <span class="data-toolbar__info-popover">
            Crossref enriches DOI, references, forum details and authors. OpenAlex enriches citations, topics, and affiliations.
          </span>
        </span>
      </label>
      <select :value="enrichmentProvider" :disabled="enrichmentRunning" @change="emitProviderChange">
        <option value="crossref">Crossref</option>
        <option value="openalex">OpenAlex</option>
        <option value="all">Crossref + OpenAlex</option>
      </select>
    </div>

    <div class="data-toolbar__group data-toolbar__group--refresh">
      <label class="data-toolbar__label">
        <span>Refresh</span>
        <span class="data-toolbar__info" tabindex="0" role="img" aria-label="Refresh info">
          i
          <span class="data-toolbar__info-popover">
            Force refresh bypasses freshness windows and re-fetches metadata from Crossref and OpenAlex.
          </span>
        </span>
      </label>
      <label class="data-toolbar__toggle">
        <input :checked="enrichmentForceRefresh" type="checkbox" :disabled="enrichmentRunning" @change="emitForceRefreshChange" />
        <span>Force refresh</span>
      </label>
    </div>

    <div class="data-toolbar__actions">
      <button type="button" @click="$emit('select-loaded')" :disabled="!hasDataItems || enrichmentRunning">
        Select loaded
      </button>
      <button type="button" @click="$emit('clear')" :disabled="selectedRecordCount === 0 || enrichmentRunning">
        Clear
      </button>
      <button
        type="button"
        class="data-toolbar__primary"
        @click="$emit('enrich-selected')"
        :disabled="selectedRecordCount === 0 || enrichmentRunning"
      >
        Enrich selected
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import type { EnrichmentProvider, StatusFilter } from "@shared/contracts";

type StatusOption = { label: string; value: StatusFilter };

defineProps<{
  statusFilter: StatusFilter;
  statusOptions: StatusOption[];
  searchInput: string;
  showFullText: boolean;
  enrichmentProvider: EnrichmentProvider;
  enrichmentForceRefresh: boolean;
  enrichmentRunning: boolean;
  selectedRecordCount: number;
  hasDataItems: boolean;
}>();

const emit = defineEmits<{
  "status-filter-change": [value: StatusFilter];
  "search-input": [value: string];
  "show-full-text-change": [value: boolean];
  "provider-change": [value: EnrichmentProvider];
  "force-refresh-change": [value: boolean];
  "select-loaded": [];
  "clear": [];
  "enrich-selected": [];
}>();

const emitStatusFilterChange = (event: Event) => {
  emit("status-filter-change", (event.target as HTMLSelectElement).value as StatusFilter);
};

const emitSearchInput = (event: Event) => {
  emit("search-input", (event.target as HTMLInputElement).value);
};

const emitShowFullTextChange = (event: Event) => {
  emit("show-full-text-change", (event.target as HTMLInputElement).checked);
};

const emitProviderChange = (event: Event) => {
  emit("provider-change", (event.target as HTMLSelectElement).value as EnrichmentProvider);
};

const emitForceRefreshChange = (event: Event) => {
  emit("force-refresh-change", (event.target as HTMLInputElement).checked);
};
</script>

<style scoped lang="scss">
.data-toolbar {
  position: relative;
  z-index: 200;
  overflow: visible;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
  border: 1px solid #eaeaea;
  padding: 10px;
  background: #fff;
  margin-bottom: 8px;
  width: 100%;
  box-sizing: border-box;

  &__group {
    display: flex;
    flex-direction: column;
    gap: 4px;

    &--search {
      min-width: min(320px, 100%);
      flex: 1;
    }

    &--toggle {
      min-width: 150px;
      border-left: 1px solid #dddddd;
      padding-left: 10px;
      margin-left: 2px;
    }

    &--enrichment,
    &--refresh {
      min-width: 140px;
      border-left: 1px solid #dddddd;
      padding-left: 10px;
      margin-left: 2px;
    }
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    box-sizing: border-box;
    font-size: 12px;
    color: #5b5858;
    text-transform: none;
    cursor: pointer;
    margin: 0;
    padding: 0;

    input {
      margin: 0;
    }
  }

  &__group > label {
    font-size: 12px;
    color: #5b5858;
    text-transform: uppercase;
    margin: 0;
    line-height: 1.2;
  }

  &__label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
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
    text-transform: none;
    color: #7a7a7a;
    cursor: help;
    position: relative;
    background: #fff;
    z-index: 201;
  }

  &__info-popover {
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
    z-index: 10000;
    pointer-events: none;
  }

  &__info:hover &__info-popover,
  &__info:focus &__info-popover,
  &__info:focus-visible &__info-popover {
    display: block;
  }

  select,
  input[type="text"] {
    height: 30px;
    box-sizing: border-box;
  }

  &__actions {
    margin-left: auto;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
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

  &__primary {
    border-color: #3c67d8 !important;
    color: #2d4fc9 !important;
    font-weight: 600;
  }
}

@media (max-width: 1024px) {
  .data-toolbar__group--search,
  .data-toolbar__group--toggle,
  .data-toolbar__group--enrichment,
  .data-toolbar__group--refresh {
    min-width: 100%;
    margin-left: 0;
    padding-left: 0;
    border-left: 0;
  }

  .data-toolbar__actions {
    min-width: 100%;
    margin-left: 0;
    justify-content: flex-start;
  }
}
</style>
