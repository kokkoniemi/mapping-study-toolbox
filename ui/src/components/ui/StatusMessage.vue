<template>
  <p v-if="message" :class="['ui-status-message', `ui-status-message--${tone}`]">
    {{ message }}
  </p>
</template>

<script setup lang="ts">
defineProps<{
  message: string;
  tone: "error" | "success" | "neutral";
}>();
</script>

