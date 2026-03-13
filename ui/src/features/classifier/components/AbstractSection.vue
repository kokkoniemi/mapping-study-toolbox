<template>
  <p class="abstract">
    <span class="abstract__label">Abstract</span>
    <span v-if="abstractText" class="abstract__text">{{ abstractText }}</span>
    <span v-else class="abstract__empty">No abstract available.</span>
  </p>
</template>

<script setup lang="ts">
defineProps<{
  abstractText: string;
}>();
</script>

