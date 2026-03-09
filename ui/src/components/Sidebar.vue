<template>
    <section id="sidebar">
        <h4>Show by status:</h4>

        <select :value="statusFilter" @change="onStatusChange" class="status-filter">
            <option v-for="(status) in statusOptions" :value="status.value">{{ status.label }}</option>
        </select>

        <h4>Search</h4>
        <input
            @input="onSearchInput"
            type="text"
            :value="searchFilter"
            placeholder="(e.g., by title or comment)"
            class="search-filter" />

        <h4>Records {{ recordRange }} of {{ itemCount }}:</h4>
        <ul class="item-list">
            <li v-for="item in pageItems" :key="item.id" @click="onSelectItem(item)" class="item" :class="[
                item.status !== null && `item--${item.status}`,
                !!currentItem && item.id === currentItem.id && 'item--current'
            ]">
                <small>
                    id:
                    <b>{{ item.id }}</b>
                </small>&nbsp;
                <span class="item-title">{{ truncate(item.title) }}</span>
            </li>
        </ul>
        <div class="sidebar-footer">
            <ul class="pagination">
                <li @click="movePage(1)" class="pagination-item" :class="[page <= 1 && 'pagination-item--disabled']">‹‹ First
                </li>
                <li @click="movePage(page - 1)" class="pagination-item" :class="[page <= 1 && 'pagination-item--disabled']">‹
                    Prev</li>
                <li @click="movePage(page + 1)" class="pagination-item"
                    :class="[page >= maxPages && 'pagination-item--disabled']">Next ›</li>
                <li @click="movePage(maxPages)" class="pagination-item"
                    :class="[page >= maxPages && 'pagination-item--disabled']">Last ››</li>
            </ul>
            <div class="pagination-controls">
                <div class="page-length-inline">
                    <label>Per page:</label>
                    <select :value="pageLength" @change="onPageLengthChange" class="page-length-filter">
                        <option v-for="option in pageLengthOptions" :key="option" :value="option">{{ option }}</option>
                    </select>
                </div>
                <div class="jump">
                    <label>Go to:</label>
                    <input @input="onPageInput" type="number" min="1" :max="maxPages" :value="page"/>
                </div>
            </div>
        </div>
    </section>
</template>
<script setup lang="ts">
import { computed, onMounted } from "vue";
import { storeToRefs } from "pinia";

import { type RecordItem } from "../helpers/api";
import { defaultStore, type StatusFilter } from "../stores/default";

const store = defaultStore();
const { page, pageLength, pageItems, itemCount, statusFilter, searchFilter, currentItem } =
  storeToRefs(store);
const pageLengthOptions = [20, 25, 30] as const;

const statusOptions: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "" },
  { label: "Unset", value: "null" },
  { label: "Uncertain", value: "uncertain" },
  { label: "Excluded", value: "excluded" },
  { label: "Included", value: "included" },
];

const recordRange = computed(() => {
  const first = itemCount.value <= 0 ? 0 : (page.value - 1) * pageLength.value + 1;
  const last = itemCount.value < pageLength.value ? itemCount.value : page.value * pageLength.value;
  return `${first} – ${last}`;
});

const maxPages = computed(() => Math.max(1, Math.ceil(itemCount.value / pageLength.value)));

onMounted(() => {
  void store.fetchPageItems();
});

const onStatusChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const value = target.value as StatusFilter;
  void store.setStatusFilter(value);
  target.blur();
};

const onSearchInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value;
  void store.setSearchFilter(value);
};

const truncate = (value: string) => (value.length > 20 ? `${value.substring(0, 20)}...` : value);

const movePage = (to: number) => {
  if (to > 0) {
    void store.setPage(to);
  }
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
  void store.setPageLength(value);
  target.blur();
};

const onSelectItem = (item: RecordItem) => {
  store.setCurrentItem(item);
};
</script>
<style scoped lang="scss">
#sidebar {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    border: 1px solid #eaeaea;
    padding: 5px;
    align-self: stretch;
    position: sticky;
    top: var(--layout-gutter, 12px);
    background: #fff;
    z-index: 3;
    overflow: hidden;
}

h4 {
    margin: 0;
    background: #f7f7f7;
    padding: 3px 5px;
    color: #5b5858;
    text-transform: uppercase;
    font-size: 12px;
    font-weight: 400;
}

.status-filter {
    width: 100%;
    margin-top: 5px;
    margin-bottom: 5px;
}

.search-filter {
    width: 100%;
    box-sizing: border-box;
    margin-top: 5px;
    margin-bottom: 5px;
}

.page-length-filter {
    width: auto;
    margin-top: 0;
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
        border-bottom: 1px solid rgba(0, 0, 0, 0.15);
        padding: 5px;
        font-size: 12px;
        position: relative;
        cursor: pointer;
        opacity: 0.8;
        white-space: nowrap;
        overflow: hidden;
        height: 18px;

        &:hover {
            opacity: 1;
        }

        &--uncertain {
            background: #ffffb4;
        }

        &--excluded {
            background: #ffb4b4;
        }

        &--included {
            background: #c4ffb4;
        }

        &--current {
            opacity: 1;

            &::after {
                background: #3750dc;
                position: absolute;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                right: 0;
                top: 0;
                bottom: 0;
                width: 20px;
                content: ">";
            }
        }

        small {
            color: #000000aa;
        }
    }
}

.sidebar-footer {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid #eaeaea;
}

.pagination-controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-top: 5px;
}

.page-length-inline {
    display: flex;
    align-items: center;
    gap: 5px;

    label {
        font-size: 12px;
        white-space: nowrap;
    }
}

.pagination {
    list-style: none;
    padding: 0;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin-bottom: 0;
    font-size: 12px;

    .pagination-item {
        color: #3750dc;
        font-weight: 600;
        padding: 5px;
        cursor: pointer;
        white-space: nowrap;

        &:hover {
            color: #233496;
        }

        &--disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    }
}

@media (max-width: 768px) {
    #sidebar {
        position: static;
        height: auto;
        overflow: visible;
    }

    .item-list {
        overflow: visible;
    }

    .pagination-controls {
        flex-wrap: wrap;
    }

    .jump {
        margin-top: 0;
    }
}
</style>
  
