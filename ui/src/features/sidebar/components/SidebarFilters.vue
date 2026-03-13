<template>
  <section class="sidebar-filters">
    <h4>Show by status:</h4>

    <select :value="statusFilter" class="status-filter" @change="emitStatusChange">
      <option v-for="status in statusOptions" :key="status.value" :value="status.value">
        {{ status.label }}
      </option>
    </select>

    <h4>Search</h4>
    <input
      type="text"
      :value="searchFilter"
      placeholder="(e.g., by title or comment)"
      class="search-filter"
      @input="emitSearchInput"
    />
  </section>
</template>

<script setup lang="ts">
import type { StatusFilter } from "@shared/contracts";

defineProps<{
  statusFilter: StatusFilter;
  statusOptions: Array<{ label: string; value: StatusFilter }>;
  searchFilter: string;
}>();

const emit = defineEmits<{
  "status-change": [event: Event];
  "search-input": [event: Event];
}>();

const emitStatusChange = (event: Event) => emit("status-change", event);
const emitSearchInput = (event: Event) => emit("search-input", event);
</script>
