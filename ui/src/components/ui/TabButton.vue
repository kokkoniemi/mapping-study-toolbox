<template>
  <button
    type="button"
    class="ui-tab-button"
    :class="{ 'ui-tab-button--active': active }"
    @click="emit('click')"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  active: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

