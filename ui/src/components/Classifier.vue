<template>
    <section id="classifier" v-if="currentItem">
        <h4 class="statusbar">
            id: {{ currentItem.id }} | created: {{ createdFormatted }} |&nbsp;
            modified: {{ modifiedFormatted }} | status: {{ currentItem.status }} |&nbsp;
            db: {{ currentItem.databases.join(", ") }}
        </h4>

        <h1>{{ currentItem.title }}</h1>
        <p class="author">
            <small>{{ currentItem.author }}</small>
        </p>
        <p class="publication">
            <a :href="currentItem.url">In publisher database</a> |&nbsp;
            <span v-if="currentItem.Publication">{{ currentItem.Publication.name }}, jufo-level: {{
                currentItem.Publication.jufoLevel }}</span>
        </p>
        <p v-if="!currentItem.abstract">
            <small>
                <b>Short description:</b>
            </small>
            <br />
            {{ currentItem.description }}
        </p>

        <div class="abstract-wrapper" :settings="{}" :style="{ paddingBottom: abstractPaddingBottom }">
            <p v-if="currentItem.abstract" class="abstract">
                <small>
                    <b>Abstract:</b>
                </small>
                <br />
                <span v-html="nltobr(sanitizeAbstract(currentItem.abstract))"></span>
            </p>
        </div>

        <section class="bottom-bar">
            <div class="bottom-bar__center">
                <div class="bottom-bar__actions">
                    <textarea :value="currentItem.comment" @input="setComment" @focus="setMoveLock" @blur="unsetMoveLock"
                        class="comment" type="text" rows="3" placeholder="Write your comments here..."></textarea>

                    <div class="inclusion-actions" v-if="tab === 'inc-exc'">
                        <button @click="setExcluded" :class="[currentItem.status === 'excluded' && 'action--selected']"
                            class="action action--exclude">Exclude</button>
                        <button @click="setUncertain" :class="[currentItem.status === 'uncertain' && 'action--selected']"
                            class="action action--uncertain">Uncertain</button>
                        <button @click="setIncluded" :class="[currentItem.status === 'included' && 'action--selected']"
                            class="action action--include">Include</button>
                    </div>

                    <mapping-actions v-if="tab === 'map'"></mapping-actions>
                </div>
            </div>
        </section>
    </section>
</template>


<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { storeToRefs } from "pinia";
import { format as formatDate } from "date-fns";

import MappingActions from "./MappingActions.vue";
import { debounce, keyCodes } from "../helpers/utils";
import { defaultStore } from "../stores/default";

const store = defaultStore();
const { pageItems, pageLength, page, statusFilter, tab, moveLock, mappingQuestions, currentItem } =
  storeToRefs(store);

const abstractPaddingBottom = computed(() =>
  tab.value === "map" ? `${mappingQuestions.value.length * 35}px` : 0,
);

const createdFormatted = computed(() => {
  const createdAt = currentItem.value?.createdAt;
  if (!createdAt) {
    return null;
  }
  return formatDate(new Date(createdAt), "dd.MM.yyyy HH:mm:ss ");
});

const modifiedFormatted = computed(() => {
  const updatedAt = currentItem.value?.updatedAt;
  if (!updatedAt) {
    return null;
  }
  return formatDate(new Date(updatedAt), "dd.MM.yyyy HH:mm:ss ");
});

const nextFlag = computed(() => {
  const status = currentItem.value?.status;
  if (status === undefined) {
    return false;
  }
  return (status === null && statusFilter.value === "null") || status === statusFilter.value;
});

const setNextItem = (skip = false) => {
  if (skip || !currentItem.value) {
    return;
  }

  const index = pageItems.value.findIndex((item) => item.id === currentItem.value?.id);
  if (index < 0) {
    return;
  }

  if (index >= pageLength.value - 1) {
    void store.setPage(page.value + 1);
  } else {
    store.setCurrentItem(pageItems.value[index + 1] ?? null);
  }
};

const setPrevItem = async () => {
  if (!currentItem.value) {
    return;
  }

  const index = pageItems.value.findIndex((item) => item.id === currentItem.value?.id);
  if (index <= 0 && page.value > 1) {
    await store.setPage(page.value - 1);
    store.setCurrentItem(pageItems.value[pageItems.value.length - 1] ?? null);
  } else if (index > 0) {
    store.setCurrentItem(pageItems.value[index - 1] ?? null);
  }
};

const debouncedSetComment = debounce(async (id: number, value: string) => {
  await store.setItemComment(id, value);
}, 1000);

const setComment = (event: Event) => {
  const id = currentItem.value?.id;
  if (id === undefined) {
    return;
  }

  const value = (event.target as HTMLTextAreaElement).value;
  debouncedSetComment(id, value);
};

const setExcluded = async () => {
  await store.setItemStatus("excluded");
  setNextItem(nextFlag.value);
};

const setUncertain = async () => {
  await store.setItemStatus("uncertain");
  setNextItem(nextFlag.value);
};

const setIncluded = async () => {
  await store.setItemStatus("included");
  setNextItem(nextFlag.value);
};

const nltobr = (value: string) => value.replace(/(?:\r\n|\r|\n)/g, "<br>");

const sanitizeAbstract = (value: string) =>
  value.replace("Abstract:\n", "").replace("Abstract\n", "").split("\n•\n").join("");

const moveTo = (event: KeyboardEvent) => {
  if (!moveLock.value) {
    switch (event.keyCode) {
      case keyCodes.ARROW_LEFT:
        void setPrevItem();
        break;
      case keyCodes.ARROW_RIGHT:
        setNextItem();
        break;
      default:
    }
  }
};

const setMoveLock = () => {
  store.setMoveLock();
};

const unsetMoveLock = () => {
  store.unsetMoveLock();
};

onMounted(() => {
  window.addEventListener("keydown", moveTo);
});

onUnmounted(() => {
  window.removeEventListener("keydown", moveTo);
});
</script>
<style scoped lang="scss">
#classifier {
    margin-left: 20px;
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
}

h1 {
    margin: 20px 0 10px;
}

.abstract {
    line-height: 32px;
    font-family: Georgia;
    font-size: 18px;
    margin: 0;
}

.abstract-wrapper {
    flex: 1;
    position: relative;
}

.inclusion-actions {
    margin-top: 5px;
    display: flex;
    padding: 5px;

    .action {
        flex: 1;
        height: 32px;
        font-size: 20px;
        background: #c0c0c0;
        border: 0;
        box-shadow: inset 0 0 1px rgba(0, 0, 0, 0.7), 0 2px 3px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        text-shadow: 1px 1px rgba(255, 255, 255, 0.7);
        font-family: Helvetica, Arial, sans-serif;
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;

        +.action {
            margin-left: 5px;
        }

        &--exclude {
            background: rgb(255, 180, 180);
            background: linear-gradient(180deg,
                    rgba(255, 180, 180, 1) 0%,
                    rgb(182, 143, 143) 100%);
            color: #592f2f;
        }

        &--uncertain {
            background: #ffffb4;
            background: linear-gradient(180deg, #ffffb4 0%, #baba72 100%);
            color: #464208;
        }

        &--include {
            background: #c4ffb4;
            background: linear-gradient(180deg, #c4ffb4 0%, #89b57d 100%);
            color: #1d4612;
        }

        &--selected,
        &:active,
        &:focus {
            text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.6);
            color: #fff;
            outline: none;
        }

        &--selected.action--exclude,
        &--exclude:active {
            background: linear-gradient(180deg,
                    rgb(143, 106, 106) 0%,
                    rgb(211, 151, 151) 100%);
            box-shadow: inset 0 0 1px #111111e9, inset 0px 2px 4px rgba(0, 0, 0, 0.4),
                inset 0 -2px 2px rgba(0, 0, 0, 0.2);
        }

        &--selected.action--include,
        &--include:active {
            background: linear-gradient(180deg, #719766 0%, #aadc9d 100%);
            box-shadow: inset 0 0 1px #111111e9, inset 0px 2px 4px rgba(0, 0, 0, 0.4),
                inset 0 -2px 2px rgba(0, 0, 0, 0.2);
        }

        &--selected.action--uncertain,
        &--uncertain:active {
            background: linear-gradient(180deg, #a6a656 0%, #d7d78e 100%);
            box-shadow: inset 0 0 1px #111111e9, inset 0px 2px 4px rgba(0, 0, 0, 0.4),
                inset 0 -2px 2px rgba(0, 0, 0, 0.2);
        }
    }
}

.comment {
    padding: 5px;
    border: none;
    border-bottom: 1px solid #eaeaea;
    // box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
    margin: 5px 0;
    transition: background-color 0.2s ease-in, box-shadow 0.2s ease-in;
    font-size: 14px;
    font-family: Georgia, "Times New Roman", Times, serif;
    resize: vertical;

    &:focus,
    &:hover {
        outline: none;
        box-shadow: none;
        background-color: #eaeaea;
    }
}

.publication {
    margin-top: 0;
    padding-bottom: 10px;
    border-bottom: 3px solid #eaeaea;
}

.author {
    margin-top: 0;
}

.bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    pointer-events: none;

    &__center {
        max-width: 1200px;
        margin: 0 auto;
        pointer-events: none;
    }

    &__actions {
        display: flex;
        flex-direction: column;
        margin-left: 230px;
        background: #fff;
        padding-bottom: 5px;
        position: relative;
        border-top: 3px solid #eaeaea;
        pointer-events: auto;

        &:after {
            content: "";
            width: 100%;
            height: 1px;
            background: #fff;
            position: absolute;
            top: -4px;
        }
    }
}

.color-uncertain {
    color: #cece13;
}

.color-excluded {
    color: #ffb4b4;
}

.color-included {
    color: #52df2c;
}

.statusbar {
    margin: 6px 0 0;
    background: #f7f7f7;
    padding: 3px 5px;
    color: #5b5858;
    text-transform: uppercase;
    font-size: 12px;
    font-weight: 400;
}
</style>
