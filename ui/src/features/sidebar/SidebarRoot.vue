<template>
  <section id="sidebar">
    <SidebarFilters
      :statusFilter="statusFilter"
      :statusOptions="statusOptions"
      :searchFilter="searchFilter"
      @status-change="onStatusChange"
      @search-input="onSearchInput"
    />

    <SidebarRecordList
      :pageItems="pageItems"
      :currentItemId="currentItemId"
      :recordRange="recordRange"
      :itemCount="itemCount"
      @select-item="onSelectItem"
    />

    <SidebarPagination
      :page="page"
      :maxPages="maxPages"
      :pageLength="pageLength"
      :pageLengthOptions="pageLengthOptions"
      @move-page="movePage"
      @page-input="onPageInput"
      @page-length-change="onPageLengthChange"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";
import type { StatusFilter } from "@shared/contracts";

import type { RecordItem } from "../../helpers/api";
import { STATUS_FILTER_OPTIONS } from "../../constants/status";
import { useFiltersStore } from "../../stores/filters";
import { useRecordsStore } from "../../stores/records";
import SidebarFilters from "./components/SidebarFilters.vue";
import SidebarPagination from "./components/SidebarPagination.vue";
import SidebarRecordList from "./components/SidebarRecordList.vue";

const filtersStore = useFiltersStore();
const recordsStore = useRecordsStore();
const { page, pageLength, statusFilter, searchFilter } = storeToRefs(filtersStore);
const { pageItems, itemCount, currentItemId } = storeToRefs(recordsStore);

const pageLengthOptions = [20, 25, 30] as const;
const statusOptions = STATUS_FILTER_OPTIONS;

const recordRange = computed(() => {
  const first = itemCount.value <= 0 ? 0 : (page.value - 1) * pageLength.value + 1;
  const last = itemCount.value < pageLength.value ? itemCount.value : page.value * pageLength.value;
  return `${first} – ${last}`;
});

const maxPages = computed(() => Math.max(1, Math.ceil(itemCount.value / pageLength.value)));

onMounted(() => {
  void recordsStore.fetchPageItems();
});

const onStatusChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const value = target.value as StatusFilter;
  filtersStore.setStatusFilter(value);
  void recordsStore.fetchPageItems();
  target.blur();
};

const onSearchInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  filtersStore.setSearchFilter(value);
  void recordsStore.fetchPageItems({ search: value });
};

const movePage = (to: number) => {
  if (to < 1 || to > maxPages.value) {
    return;
  }
  filtersStore.setPage(to);
  void recordsStore.fetchPageItems();
};

const onPageInput = (event: Event) => {
  const input = Number((event.target as HTMLInputElement).value || 1);
  movePage(input);
};

const onPageLengthChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const value = Number(target.value);
  if (!pageLengthOptions.includes(value as (typeof pageLengthOptions)[number])) {
    return;
  }
  filtersStore.setPageLength(value);
  filtersStore.setPage(1);
  void recordsStore.fetchPageItems();
  target.blur();
};

const onSelectItem = (item: RecordItem) => {
  recordsStore.setCurrentItem(item);
};
</script>

<style lang="scss">
#sidebar {
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--ui-border-subtle);
  padding: 5px;
  align-self: stretch;
  position: sticky;
  top: var(--layout-gutter, 12px);
  background: #fff;
  z-index: 3;
  overflow-x: hidden;
  overflow-y: auto;
}

#sidebar h4 {
  margin: 0;
  background: var(--ui-surface-subtle);
  padding: 3px 5px;
  color: var(--ui-text-secondary);
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 500;
}

.status-filter {
  width: 100%;
  margin: 6px 0;
}

.sidebar-filters {
  flex: 0 0 auto;
}

.sidebar-record-list {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.search-filter {
  width: 100%;
  margin: 6px 0;
}

.page-length-filter {
  width: auto;
  margin-top: 0;
  min-width: 76px;
}

.jump {
  display: flex;
  width: auto;
  margin-top: 5px;
  align-items: center;

  label {
    font-size: 12px;
    padding-right: 5px;
    padding-top: 0;
    white-space: nowrap;
  }

  input {
    width: 58px;
    max-width: none;
    margin-left: 2px;
  }
}

.item-list {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
  min-height: 0;
  overflow: auto;

  .item {
    border-bottom: 1px solid var(--ui-border-subtle);
    padding: 4px 6px;
    font-size: 12px;
    position: relative;
    cursor: pointer;
    opacity: 0.9;
    white-space: nowrap;
    overflow: hidden;
    height: 24px;
    display: flex;
    align-items: center;
    gap: 2px;
    color: var(--ui-text-secondary);

    &:hover {
      opacity: 1;
      background: var(--ui-surface-subtle);
    }

    &--uncertain {
      background: var(--ui-status-uncertain-bg);
      border-left: 2px solid var(--ui-status-uncertain-border);
    }

    &--excluded {
      background: var(--ui-status-excluded-bg);
      border-left: 2px solid var(--ui-status-excluded-border);
    }

    &--included {
      background: var(--ui-status-included-bg);
      border-left: 2px solid var(--ui-status-included-border);
    }

    &--current {
      background: #3f6acc;
      color: #fff;
      opacity: 1;
      border-left: none;

      b {
        color: inherit;
      }
    }
  }
}

.item-title {
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-footer {
  border-top: 1px solid var(--ui-border-subtle);
  padding-top: 6px;
  flex: 0 0 auto;
}

.pagination {
  list-style: none;
  display: flex;
  gap: 6px;
  padding: 0;
  margin: 0 0 6px;
}

.pagination-item {
  color: #4f66d1;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  font-weight: 600;

  &--disabled {
    opacity: 0.45;
    pointer-events: none;
  }
}

.pagination-controls {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
}

.page-length-inline {
  display: flex;
  align-items: center;
  gap: 6px;

  label {
    font-size: 12px;
  }
}

@media (max-width: 768px) {
  #sidebar {
    position: static;
    top: auto;
    height: auto;
    max-height: none;
  }
}
</style>
