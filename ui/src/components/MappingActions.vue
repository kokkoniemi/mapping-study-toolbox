<template>
    <div class="mapping-actions">
        <div v-for="(question, i)  in mappingQuestions" class="mapping-question" :key="question.id">
            <div class="mapping-question__title" @click="(e) => setQuestionPopupActive(e, question.id)">
                <div class="mapping-question__popup" v-if="activeQuestionPopup === question.id">
                    <div class="mapping-question__popup--backdrop" @click="setQuestionPopupInactive"></div>
                    <div class="mapping-question__popup--content">
                        <div v-if="activeQuestionConfirm" class="mapping-question__popup--confirm">
                            <h3>Are you sure?</h3>
                            <button @click="() => deleteQuestion(question.id)" class="button--danger">Delete</button>
                            <button @click="activeQuestionConfirm = false">Cancel</button>
                        </div>
                        <label>Title</label>
                        <input type="text" :value="question.title" @input="(e) => setQuestionTitle(e, question)" />

                        <label>Type</label>
                        <select @change="() => null">
                            <option v-for="(o) in typeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                        </select>
                        <!-- <v-select @input="() => null" :options="typeOptions" :value="typeOptions[0].label"
                            :clearable="false" :searchable="false" disabled></v-select> -->

                        <label>Position</label>
                        <div class="mapping-question__popup--position">
                            <div class="question-position--up" @click="() => decreaseQuestionPosition(question, i)">
                                <span class="icon">–</span>
                            </div>
                            <div class="question-position">{{ question.position }}</div>
                            <div class="question-position--down" @click="() => increaseQuestionPosition(question, i)">
                                <span class="icon">+</span>
                            </div>
                        </div>
                        <button @click="activeQuestionConfirm = true">Delete question</button>
                    </div>
                </div>
                <span class="icon">{{ getIcon(question.type) }}</span>
                {{ question.title }}
            </div>
            <div :class="{ 'mapping-question__tags--active': activeOptionPopup === question.id }"
                class="mapping-question__value mapping-question__tags" @click="(e) => setOptionPopupActive(e, question.id)">
                <div class="mapping-question__tags--popup" v-if="activeOptionPopup === question.id">
                    <div @click="setOptionPopupInactive" class="mapping-question__popup--backdrop"></div>
                    <div class="mapping-question__tags--popup-content">
                        <ul class="mapping-question__tags--list">
                            <li @click="() => createOption(question, nextOptionColor)"
                                class="mapping-question__tags--list-item" v-if="optionInput.length">
                                <div class="mapping-question__tags--create">Create:</div>
                                <span class="mapping-question__tags--tag" :style="tagStyle(nextOptionColor)">{{
                                    optionInput }}</span>
                            </li>
                            <li v-for="option in (question.MappingOptions || []).filter(filterOptionList)" :key="option.id"
                                class="mapping-question__tags--list-item"
                                @click="() => addRecordMappingOption({ mappingQuestionId: question.id, mappingOptionId: option.id })">
                                <span class="mapping-question__tags--tag" :style="tagStyle(option.color)">{{
                                    option.title }}</span>
                            </li>
                        </ul>
                        <div class="hint">Select an option or create one</div>
                    </div>
                </div>
                <!-- per record options -->
                <div class="mapping-question__tags">
                    <span v-for="option in currentMappingOptions.filter(o => o.mappingQuestionId === question.id)"
                        :key="option.id" class="mapping-question__tags--tag" :style="tagStyle(option.color)"
                        @click="() => removeRecordMappingOption(option.id)">
                        {{ option.title }}
                        <span class="icon" v-if="activeOptionPopup === question.id">⊗</span>
                    </span>
                </div>
                <input v-if="activeOptionPopup === question.id" type="text" :ref="setNewOptionRef" v-model="optionInput" />
            </div>
        </div>
        <div class="mapping-question mapping-question--new">
            <div class="mapping-question__title" @click="newMappingQuestion">
                <span class="icon">+</span> New mapping question
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import type { ComponentPublicInstance } from "vue";
import { storeToRefs } from "pinia";

import { getRandomMappingOptionColor, normalizeMappingColor } from "../constants/mapping";
import { debounce } from "../helpers/utils";
import { defaultStore } from "../stores/default";
import type { MappingOption, MappingQuestion } from "../helpers/api";

type TypeOption = {
  label: string;
  value: string;
};

const typeOptions: TypeOption[] = [{ label: "Multi-select", value: "multiSelect" }];

const activeOptionPopup = ref<number | null>(null);
const activeQuestionPopup = ref<number | null>(null);
const activeQuestionConfirm = ref(false);
const optionInput = ref("");
const nextOptionColor = ref("");
const newOption = ref<HTMLInputElement | null>(null);

const store = defaultStore();
const { mappingQuestions, currentItem } = storeToRefs(store);
const currentMappingOptions = computed(() => currentItem.value?.MappingOptions ?? []);

const getIcon = (type: string) => (type === "multiSelect" ? "☰" : "");

const setNewOptionRef = (element: Element | ComponentPublicInstance | null) => {
  newOption.value = element as HTMLInputElement | null;
};

const isBackdropTarget = (target: EventTarget | null) => {
  return (target as HTMLElement | null)?.className === "mapping-question__popup--backdrop";
};

const setOptionPopupActive = async (event: MouseEvent, id: number) => {
  if (isBackdropTarget(event.target)) {
    return;
  }

  activeOptionPopup.value = id;
  store.setMoveLock();
  await nextTick();
  newOption.value?.focus();
};

const setOptionPopupInactive = () => {
  activeOptionPopup.value = null;
  store.unsetMoveLock();
};

const setQuestionPopupActive = (event: MouseEvent, id: number) => {
  if (isBackdropTarget(event.target)) {
    return;
  }

  activeQuestionPopup.value = id;
  store.setMoveLock();
};

const setQuestionPopupInactive = () => {
  activeQuestionPopup.value = null;
  activeQuestionConfirm.value = false;
  store.unsetMoveLock();
};

const newMappingQuestion = async () => {
  await store.createMappingQuestion();
  activeQuestionPopup.value = mappingQuestions.value[mappingQuestions.value.length - 1]?.id ?? null;
};

const deleteQuestion = async (id: number) => {
  await store.deleteMappingQuestion(id);
  activeQuestionConfirm.value = false;
  activeQuestionPopup.value = null;
};

const setQuestionTitle = debounce(async (event: Event, question: MappingQuestion) => {
  const title = (event.target as HTMLInputElement).value;
  const { id, type, position } = question;
  await store.updateMappingQuestion({
    id,
    title,
    type,
    position,
  });
}, 1000);

const increaseQuestionPosition = async (question: MappingQuestion, index: number) => {
  const lastQuestion = mappingQuestions.value[mappingQuestions.value.length - 1];
  if (!lastQuestion || lastQuestion.id === question.id) {
    return;
  }

  const { id, type, title, position } = question;
  await store.updateMappingQuestion({
    id,
    type,
    title,
    position: position + 1,
  });

  const next = mappingQuestions.value[index + 1];
  if (!next) {
    return;
  }

  await store.updateMappingQuestion({
    id: next.id,
    type: next.type,
    title: next.title,
    position: next.position - 1,
  });

  await store.fetchMappingQuestions();
};

const decreaseQuestionPosition = async (question: MappingQuestion, index: number) => {
  const firstQuestion = mappingQuestions.value[0];
  if (!firstQuestion || firstQuestion.id === question.id) {
    return;
  }

  const { id, type, title, position } = question;
  await store.updateMappingQuestion({
    id,
    type,
    title,
    position: position - 1,
  });

  const previous = mappingQuestions.value[index - 1];
  if (!previous) {
    return;
  }

  await store.updateMappingQuestion({
    id: previous.id,
    type: previous.type,
    title: previous.title,
    position: previous.position + 1,
  });

  await store.fetchMappingQuestions();
};

const createOption = async (question: MappingQuestion, color: string) => {
  await store.createMappingOption({
    id: question.id,
    title: optionInput.value,
    position: question.MappingOptions?.length ?? 0,
    color,
  });

  nextOptionColor.value = getOptionColor();
  optionInput.value = "";
};

const getOptionColor = () => {
  return getRandomMappingOptionColor();
};

const tagStyle = (color: string | null | undefined) => ({
  backgroundColor: normalizeMappingColor(color),
});

const filterOptionList = (option: MappingOption) => {
  const selected = currentMappingOptions.value;
  return (
    selected.findIndex((item) => item.id === option.id) === -1 &&
    option.title.toLowerCase().includes(optionInput.value.toLowerCase())
  );
};

const addRecordMappingOption = async (payload: {
  mappingQuestionId: number;
  mappingOptionId: number;
}) => {
  await store.addRecordMappingOption(payload);
};

const removeRecordMappingOption = async (optionId: number) => {
  await store.removeRecordMappingOption(optionId);
};

onMounted(async () => {
  await store.fetchMappingQuestions();
  nextOptionColor.value = getOptionColor();
});
</script>
<style lang="scss" scoped>
.mapping-actions {
    display: flex;
    flex-direction: column;
    padding: 10px;

    .mapping-question {
        display: flex;
        flex-direction: row;
        min-height: 33px;

        &:last-of-type {
            .mapping-question__title {
                border-width: 0;
            }
        }

        &__title,
        &__value {
            transition: background-color 0.2s ease-in;
            display: flex;
            align-items: center;
            position: relative;

            &:hover {
                cursor: pointer;
                background-color: #eaeaea;
            }
        }

        &__title {
            padding: 5px;
            font-size: 12px;
            border: 0px solid #eaeaea;
            border-width: 0 1px 1px 0;
            width: 250px;

            .icon {
                padding: 0 5px;
                font-size: 18px;
                color: #949ea7;
            }
        }

        &__value {
            padding: 5px;
            border: 0px solid #eaeaea;
            border-width: 0 0 1px 0;
            flex: 1;
        }

        &__tags {
            &--tag {
                cursor: pointer;
                font-size: 10px;
                padding: 5px;
                border-radius: 3px;
                background-color: rgb(235, 213, 213);
                margin-right: 5px;
                position: relative;
                z-index: 2;
                font-weight: 600;
                color: rgba(0, 0, 0, 0.65);

                .icon {
                    font-size: 14px;
                    height: 18px;
                    width: 18px;
                    position: absolute;
                    right: -4px;
                    top: -5px;
                    color: rgb(235, 213, 213);
                    background: #820b0b;
                    border-radius: 50%;
                    display: none;
                }

                &:hover .icon {
                    display: inline-flex;
                    justify-content: center;
                    align-items: center;
                }
            }

            &--create {
                margin-right: 5px;
                font-size: 12px;
            }

            &--active {
                position: relative;

                * {
                    z-index: 2;
                }

                input {
                    flex: 1;
                    min-width: 140px;
                    margin-left: 6px;
                }
            }

            &--popup-content {
                position: absolute;
                cursor: default;
                top: 0;
                left: 0;
                right: 0;
                transform: translateY(calc(-100% + 35px));
                background-color: #fff;
                border: 1px solid var(--ui-border-default);
                padding: 10px 5px 35px;
                z-index: 1;
                box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);

                .hint {
                    font-size: 12px;
                    color: #c0c0c0;
                    border-bottom: 1px solid #eaeaea;
                    margin: 15px 5px 0;
                }
            }

            &--list {
                list-style: none;
                margin: 0;
                padding: 0;
                max-height: 300px;
                overflow-y: scroll;
                overflow-x: hidden;
            }

            &--list-item {
                cursor: pointer;
                height: 32px;
                display: flex;
                align-items: center;
                padding: 0 5px;
                margin: 0 -5px;
                transition: background-color 0.2s ease-in;

                &:hover {
                    background-color: #eaeaea;
                }
            }
        }

        &__popup {
            &--backdrop {
                position: fixed;
                cursor: default;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1;
                background-color: rgba(0, 0, 0, 0.2);
            }

            &--content {
                position: absolute;
                top: 0;
                background-color: #fff;
                min-width: 300px;
                border: 1px solid var(--ui-border-default);
                padding: 0px 10px 10px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                z-index: 2;
                box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
                transform: translateY(-100%);

                button {
                    margin-top: 16px;
                }

                select {
                    width: 100%;
                }
            }

            &--confirm {
                text-align: center;
                padding: 10px;
                background-color: #fff;
                position: absolute;
                cursor: default;
                top: 0;
                left: 0;
                bottom: 0;
                right: 0;
                display: flex;
                flex-direction: column;
                align-items: stretch;
                justify-content: center;
                z-index: 2;
            }

            &--position {
                display: flex;
                flex-direction: row;

                .question-position {
                    display: flex;
                    height: 24px;
                    align-items: center;
                    padding: 0 10px;

                    &--up,
                    &--down {
                        color: #2c3e50;
                        cursor: pointer;
                        background: #eaeaea;
                        height: 24px;
                        width: 24px;

                        .icon {
                            color: #2c3e50;
                            padding: inherit;
                            font-size: 24px;
                        }
                    }
                }
            }

            label {
                display: block;
                font-size: 12px;
                clear: both;
                padding: 5px 0;
                margin-top: 10px;
            }

            input {
                width: 100%;
            }
        }

        &--new {
            color: #949ea7;
            font-weight: 600;

            .mapping-question__title,
            .mapping-question__title .icon {
                transition: color 0.2s ease-in;
            }

            .mapping-question__title {

                &:hover,
                &:hover .icon {
                    color: #2c3e50;
                }
            }
        }
    }
}
</style>
