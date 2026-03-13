<template>
  <section class="bottom-bar">
    <div class="bottom-bar__center">
      <div class="bottom-bar__actions">
        <h4 class="notebook-title notebook-title--inline">Notebook</h4>
        <textarea
          :value="comment"
          class="comment comment--bottom"
          type="text"
          rows="3"
          placeholder="Write your comments here..."
          @input="emit('comment-input', $event)"
          @focus="emit('focus-comment')"
          @blur="emit('blur-comment')"
        />

        <div v-if="tab === 'inc-exc'" class="inclusion-actions">
          <button
            class="action action--exclude"
            :class="[status === 'excluded' && 'action--selected']"
            :aria-pressed="status === 'excluded'"
            @click="onDecisionClick('exclude', $event)"
          >
            Exclude
          </button>
          <button
            class="action action--uncertain"
            :class="[status === 'uncertain' && 'action--selected']"
            :aria-pressed="status === 'uncertain'"
            @click="onDecisionClick('uncertain', $event)"
          >
            Uncertain
          </button>
          <button
            class="action action--include"
            :class="[status === 'included' && 'action--selected']"
            :aria-pressed="status === 'included'"
            @click="onDecisionClick('include', $event)"
          >
            Include
          </button>
        </div>

        <slot />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { RecordStatus } from "../../../helpers/api";
import type { TabMode } from "../../../stores/types";

defineProps<{
  tab: TabMode;
  comment: string | null;
  status: RecordStatus;
}>();

const emit = defineEmits<{
  "comment-input": [event: Event];
  "focus-comment": [];
  "blur-comment": [];
  exclude: [];
  uncertain: [];
  include: [];
}>();

const onDecisionClick = (decision: "exclude" | "uncertain" | "include", event: MouseEvent) => {
  switch (decision) {
    case "exclude":
      emit("exclude");
      break;
    case "uncertain":
      emit("uncertain");
      break;
    case "include":
      emit("include");
      break;
  }
  (event.currentTarget as HTMLButtonElement | null)?.blur();
};
</script>
