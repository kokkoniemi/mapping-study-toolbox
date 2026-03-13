<template>
  <section class="sidebar-record-list">
    <h4>Records {{ recordRange }} of {{ itemCount }}:</h4>
    <ul class="item-list">
      <li
        v-for="item in pageItems"
        :key="item.id"
        class="item"
        :class="[
          item.status !== null && `item--${item.status}`,
          currentItemId !== null && item.id === currentItemId && 'item--current',
        ]"
        @click="emit('select-item', item)"
      >
        <small>
          id:
          <b>{{ item.id }}</b>
        </small>
        &nbsp;
        <span class="item-title">{{ truncate(item.title) }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { RecordItem } from "../../../helpers/api";

defineProps<{
  pageItems: RecordItem[];
  currentItemId: number | null;
  recordRange: string;
  itemCount: number;
}>();

const emit = defineEmits<{
  "select-item": [item: RecordItem];
}>();

const truncate = (value: string) => (value.length > 20 ? `${value.substring(0, 20)}...` : value);
</script>
