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
        <ul class="pagination">
            <li @click="movePage(1)" class="pagination-item" :class="[page <= 1 && 'pagination-item--disabled']">‹‹ First
            </li>
            <li @click="movePage(page - 1)" class="pagination-item" :class="[page <= 1 && 'pagination-item--disabled']">‹
                Prev</li>
            <li @click="movePage(page + 1)" class="pagination-item"
                :class="[page >= itemCount / pageLength && 'pagination-item--disabled']">Next ›</li>
            <li @click="movePage(Math.ceil(itemCount / pageLength))" class="pagination-item"
                :class="[page >= itemCount / pageLength && 'pagination-item--disabled']">Last ››</li>
        </ul>
        <div class="jump">
            <label>Move to page:</label>
            <input @input="onPageInput" type="number" min="1" :max="maxPages" :value="page"/>
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

const maxPages = computed(() => Math.ceil(itemCount.value / pageLength.value));

onMounted(() => {
  void store.fetchPageItems();
});

const onStatusChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value as StatusFilter;
  void store.setStatusFilter(value);
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

const onSelectItem = (item: RecordItem) => {
  store.setCurrentItem(item);
};
</script>
<style scoped lang="scss">
#sidebar {
    width: 200px;
    border: 1px solid #eaeaea;
    padding: 5px;
    margin-right: 10px;
    position: absolute;
    top: 0;
    left: 0;
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
    width: 192px;
    margin-top: 5px;
    margin-bottom: 5px;
}

.jump {
    display: flex;
    width: 100%;

    label {
        font-size: 12px;
        padding-right: 5px;
        padding-top: 3px;
        flex: 1
    }

    input {
        max-width: 50%;
    }
}

.item-list {
    list-style: none;
    padding: 0;

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
</style>
  
