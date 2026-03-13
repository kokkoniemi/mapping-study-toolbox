<template>
  <aside class="notebook-panel">
    <h4 class="notebook-title">Notebook</h4>
    <textarea
      :value="comment"
      class="comment comment--notebook"
      type="text"
      rows="16"
      placeholder="Write your comments here..."
      @input="emit('comment-input', $event)"
      @focus="emit('focus-comment')"
      @blur="emit('blur-comment')"
    />
  </aside>
</template>

<script setup lang="ts">
defineProps<{
  comment: string | null;
}>();

const emit = defineEmits<{
  "comment-input": [event: Event];
  "focus-comment": [];
  "blur-comment": [];
}>();
</script>

