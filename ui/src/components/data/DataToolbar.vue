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

    <div class="data-toolbar__group">
      <label>Import</label>
      <select :value="importFilter" @change="emitImportFilterChange">
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
        <span>Show full text</span>
      </label>
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
}>();

const emit = defineEmits<{
  "status-filter-change": [value: StatusFilter];
  "import-filter-change": [value: string];
  "search-input": [value: string];
  "show-full-text-change": [value: boolean];
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
  gap: 12px;
  align-items: flex-end;
  border: 1px solid var(--ui-border-subtle);
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
      border-left: 1px solid var(--ui-border-subtle);
      padding-left: 10px;
      margin-left: 2px;
    }
  }

  &__toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: var(--ui-control-height);
    box-sizing: border-box;
    font-size: 12px;
    color: var(--ui-text-secondary);
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
    color: var(--ui-text-secondary);
    text-transform: uppercase;
    margin: 0;
    line-height: 1.2;
  }
}

@media (max-width: 1024px) {
  .data-toolbar__group--search,
  .data-toolbar__group--toggle {
    min-width: 100%;
    margin-left: 0;
    padding-left: 0;
    border-left: 0;
  }
}
</style>
