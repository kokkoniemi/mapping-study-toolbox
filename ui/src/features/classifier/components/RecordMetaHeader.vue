<template>
  <h4 class="statusbar">
    <span class="statusbar__meta">
      id: {{ recordId }} | created: {{ createdFormatted }} |
      modified: {{ modifiedFormatted }} | status: {{ statusText }}
    </span>
    <span class="statusbar__sep" aria-hidden="true">|</span>
    <span class="statusbar__db" :title="databaseList">db: {{ databaseList }}</span>
  </h4>
</template>

<script setup lang="ts">
defineProps<{
  recordId: number;
  createdFormatted: string | null;
  modifiedFormatted: string | null;
  statusText: string | null;
  databaseList: string;
}>();
</script>

