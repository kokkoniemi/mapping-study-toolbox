<template>
  <div v-if="open" class="mapping-editor">
    <div class="mapping-editor__backdrop" @click="$emit('close')"></div>
    <section class="mapping-editor__panel" :style="panelStyle">
      <header class="mapping-editor__header">
        <h3>{{ questionTitle }}</h3>
        <button type="button" class="mapping-editor__close" @click="$emit('close')">Close</button>
      </header>

      <div class="mapping-editor__selected">
        <button
          v-for="option in selectedOptions"
          :key="option.id"
          class="mapping-chip mapping-chip--selected"
          :style="chipStyle(option.color)"
          type="button"
          @click="$emit('remove-option', option.id)"
        >
          {{ option.title }}
          <span class="mapping-chip__remove">⊗</span>
        </button>
        <div v-if="selectedOptions.length === 0" class="mapping-editor__hint mapping-editor__hint--empty">
          No options selected
        </div>
      </div>

      <div class="mapping-editor__search">
        <input
          ref="mappingEditorInputRef"
          :value="inputValue"
          type="text"
          placeholder="Select an option or create one"
          @input="onInput"
        />
      </div>

      <ul class="mapping-editor__list">
        <li v-if="canCreateMappingOption" class="mapping-editor__item">
          <button type="button" class="mapping-editor__pick" @click="$emit('create-option')">
            <span class="mapping-editor__create-label">Create:</span>
            <span class="mapping-chip" :style="chipStyle(createColor)">{{ inputValueTrimmed }}</span>
          </button>
        </li>
        <li v-for="option in availableOptions" :key="option.id" class="mapping-editor__item">
          <button type="button" class="mapping-editor__pick" @click="$emit('add-option', option.id)">
            <span class="mapping-chip" :style="chipStyle(option.color)">{{ option.title }}</span>
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

import { normalizeMappingColor } from "../../constants/mapping";
import type { MappingOption } from "../../helpers/api";

const props = defineProps<{
  open: boolean;
  panelStyle: Record<string, string>;
  questionTitle: string;
  selectedOptions: MappingOption[];
  inputValue: string;
  createColor: string | null | undefined;
  availableOptions: MappingOption[];
  canCreateMappingOption: boolean;
}>();

const emit = defineEmits<{
  close: [];
  "update:inputValue": [value: string];
  "remove-option": [optionId: number];
  "create-option": [];
  "add-option": [optionId: number];
}>();

const mappingEditorInputRef = ref<HTMLInputElement | null>(null);

const inputValueTrimmed = computed(() => props.inputValue.trim());

const chipStyle = (color: string | null | undefined) => ({
  backgroundColor: normalizeMappingColor(color),
});

const onInput = (event: Event) => {
  emit("update:inputValue", (event.target as HTMLInputElement).value);
};

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      return;
    }

    await nextTick();
    mappingEditorInputRef.value?.focus();
  },
);
</script>

<style scoped lang="scss">
.mapping-editor {
  position: fixed;
  inset: 0;
  z-index: 2000;

  &__backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.2);
  }

  &__panel {
    position: fixed;
    z-index: 2001;
    background: #fff;
    border: 1px solid #aeaeae;
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
    padding: 10px 8px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
  }

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 4px;
    min-height: 28px;

    h3 {
      margin: 0;
      font-size: 20px;
      line-height: 1.2;
      font-weight: 600;
      color: #2c3e50;
    }
  }

  &__selected {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 5px;
    max-height: 180px;
    overflow: auto;
    padding: 2px 4px;
    scrollbar-width: thin;
    scrollbar-color: #c4c4c4 #f4f4f4;

    &::-webkit-scrollbar {
      width: 10px;
    }

    &::-webkit-scrollbar-track {
      background: #f4f4f4;
    }

    &::-webkit-scrollbar-thumb {
      background: #c4c4c4;
      border-radius: 8px;
      border: 2px solid #f4f4f4;
    }
  }

  &__search {
    padding: 0 4px;

    input {
      width: 100%;
      box-sizing: border-box;
      border: 0;
      border-bottom: 1px solid #eaeaea;
      padding: 6px 4px 8px;
      font-size: 15px;
      background: transparent;
      color: #2c3e50;

      &:focus {
        outline: none;
      }
    }
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 320px;
    min-height: 120px;
    overflow-y: auto;
    overflow-x: hidden;
    border: 0;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: #c4c4c4 #f4f4f4;

    &::-webkit-scrollbar {
      width: 10px;
    }

    &::-webkit-scrollbar-track {
      background: #f4f4f4;
    }

    &::-webkit-scrollbar-thumb {
      background: #c4c4c4;
      border-radius: 8px;
      border: 2px solid #f4f4f4;
    }
  }

  &__item {
    height: 32px;
    display: flex;
    align-items: center;
    margin: 0 -3px;
    padding: 0 3px;
    transition: background-color 0.2s ease-in;

    &:hover {
      background-color: #eaeaea;
    }
  }

  &__pick {
    width: 100%;
    text-align: left;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: 0;
  }

  &__create-label {
    font-size: 12px;
    color: #5b5858;
    margin-right: 2px;
  }

  &__hint {
    font-size: 12px;
    color: #c0c0c0;
    margin: 0 4px;

    &--empty {
      font-style: italic;
    }
  }

  &__close {
    font-size: 12px;
    color: #5b5858;
    padding: 2px 8px;
    background: #fff;
    border: 1px solid #e0e0e0;

    &:hover {
      background: #f7f7f7;
    }
  }
}

.mapping-chip {
  font-size: 10px;
  border-radius: 3px;
  padding: 5px;
  color: rgba(0, 0, 0, 0.65);
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
}

.mapping-chip__remove {
  font-size: 14px;
  display: none;
}

.mapping-chip--selected:hover .mapping-chip__remove {
  display: inline-flex;
}
</style>
