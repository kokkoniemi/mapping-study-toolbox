<template>
  <div class="sidebar-footer">
    <ul class="pagination">
      <li class="pagination-item" :class="[page <= 1 && 'pagination-item--disabled']" @click="emit('move-page', 1)">
        ‹‹ First
      </li>
      <li class="pagination-item" :class="[page <= 1 && 'pagination-item--disabled']" @click="emit('move-page', page - 1)">
        ‹ Prev
      </li>
      <li class="pagination-item" :class="[page >= maxPages && 'pagination-item--disabled']" @click="emit('move-page', page + 1)">
        Next ›
      </li>
      <li class="pagination-item" :class="[page >= maxPages && 'pagination-item--disabled']" @click="emit('move-page', maxPages)">
        Last ››
      </li>
    </ul>
    <div class="pagination-controls">
      <div class="page-length-inline">
        <label>Per page:</label>
        <select :value="pageLength" class="page-length-filter" @change="emit('page-length-change', $event)">
          <option v-for="option in pageLengthOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
      </div>
      <div class="jump">
        <label>Go to:</label>
        <input
          type="number"
          min="1"
          :max="maxPages"
          :value="page"
          @input="emit('page-input', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  page: number;
  maxPages: number;
  pageLength: number;
  pageLengthOptions: readonly number[];
}>();

const emit = defineEmits<{
  "move-page": [value: number];
  "page-input": [event: Event];
  "page-length-change": [event: Event];
}>();
</script>

