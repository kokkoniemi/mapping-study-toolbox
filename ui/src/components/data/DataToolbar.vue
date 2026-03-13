<template>
  <header class="data-toolbar">
    <div class="data-toolbar__group data-toolbar__group--status">
      <label>Status</label>
      <select :value="statusFilter" @change="emitStatusFilterChange">
        <option v-for="option in statusOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="data-toolbar__group data-toolbar__group--import">
      <label>Import</label>
      <select class="data-toolbar__select data-toolbar__select--import" :value="importFilter" @change="emitImportFilterChange">
        <option value="">All imports</option>
        <option v-for="option in importFilterOptions" :key="option.value" :value="option.value">
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
        <span>Full Text</span>
      </label>
    </div>

    <div class="data-toolbar__group data-toolbar__group--selection">
      <label>Selection</label>
      <div class="data-toolbar__selection-actions">
        <button
          type="button"
          :disabled="selectLoadedDisabled"
          title="Select all currently loaded records"
          @click="emit('select-loaded')"
        >
          Loaded
        </button>
        <button
          type="button"
          :disabled="selectAllMatchingDisabled"
          title="Select all records matching current filters"
          @click="emit('select-all-matching')"
        >
          {{ selectAllMatchingRunning ? `Selecting ${selectAllProgressText}` : "Filtered" }}
        </button>
        <button
          type="button"
          :disabled="clearSelectionDisabled"
          title="Clear current record selection"
          @click="emit('clear-selection')"
        >
          Clear
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import type { StatusFilter } from "@shared/contracts";

type StatusOption = { label: string; value: StatusFilter };
type ImportFilterOption = { label: string; value: string };

defineProps<{
  statusFilter: StatusFilter;
  statusOptions: StatusOption[];
  importFilter: string;
  importFilterOptions: ImportFilterOption[];
  searchInput: string;
  showFullText: boolean;
  selectLoadedDisabled: boolean;
  selectAllMatchingDisabled: boolean;
  clearSelectionDisabled: boolean;
  selectAllMatchingRunning: boolean;
  selectAllProgressText: string;
}>();

const emit = defineEmits<{
  "status-filter-change": [value: StatusFilter];
  "import-filter-change": [value: string];
  "search-input": [value: string];
  "show-full-text-change": [value: boolean];
  "select-loaded": [];
  "select-all-matching": [];
  "clear-selection": [];
}>();

const emitStatusFilterChange = (event: Event) => {
  emit("status-filter-change", (event.target as HTMLSelectElement).value as StatusFilter);
};

const emitImportFilterChange = (event: Event) => {
  emit("import-filter-change", (event.target as HTMLSelectElement).value);
};

const emitSearchInput = (event: Event) => {
  emit("search-input", (event.target as HTMLInputElement).value);
};

const emitShowFullTextChange = (event: Event) => {
  emit("show-full-text-change", (event.target as HTMLInputElement).checked);
};
</script>

<style scoped lang="scss">
.data-toolbar {
  position: relative;
  z-index: 200;
  overflow: visible;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: flex-end;
  border: 1px solid #e7e7e9;
  padding: 8px 10px;
  background: #f7f7f9;
  margin-bottom: 0;
  width: 100%;
  box-sizing: border-box;

  select,
  input[type="text"] {
    border-color: #d1d1d5;
    background: #fff;
  }

  button {
    border-color: #d1d1d5;
    background: #fff;
    color: #4f5d6d;
  }

  button:hover:not(:disabled) {
    border-color: #c4c4c9;
    background: #f2f3f6;
  }

  &__group {
    display: flex;
    flex-direction: column;
    gap: 4px;

    &--status {
      flex: 0 1 130px;
      min-width: 115px;
      max-width: 130px;
    }

    &--search {
      flex: 1 1 280px;
      min-width: min(220px, 100%);
    }

    &--import {
      flex: 0 1 230px;
      min-width: 160px;
      max-width: 180px;
    }

    &--toggle {
      min-width: 110px;
      flex: 0 0 auto;
      border-left: 1px solid #d1d1d5;
      padding-left: 8px;
      margin-left: 0;
    }

    &--selection {
      flex: 0 0 auto;
      min-width: 0;
      border-left: 1px solid #d1d1d5;
      padding-left: 8px;
      margin-left: 0;
    }
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: var(--ui-control-height);
    box-sizing: border-box;
    font-size: 12px;
    color: #4f5d6d;
    text-transform: none;
    cursor: pointer;
    margin: 0;
    padding: 0;

    input {
      margin: 0;
    }
  }

  &__group > label {
    font-size: 11px;
    color: #68696c;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    margin: 0;
    line-height: 1.2;
  }

  &__selection-actions {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    width: max-content;
    gap: 4px;

    button {
      padding-inline: 8px;
    }
  }

  &__select--import {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (max-width: 1024px) {
  .data-toolbar__group--search,
  .data-toolbar__group--toggle,
  .data-toolbar__group--selection {
    min-width: 100%;
    margin-left: 0;
    padding-left: 0;
    border-left: 0;
  }
}
</style>
