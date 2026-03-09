<template>
    <section id="classifier" v-if="currentItem" ref="classifierRef">
        <div class="classifier-layout">
            <div class="classifier-main">
                <h4 class="statusbar">
                    id: {{ currentItem.id }} | created: {{ createdFormatted }} |&nbsp;
                    modified: {{ modifiedFormatted }} | status: {{ currentItem.status }} |&nbsp;
                    db: {{ currentItem.databases.join(", ") }}
                </h4>

                <h1>{{ currentItem.title }}</h1>
                <p class="author">
                    <small>{{ currentItem.author }}</small>
                </p>
                <p class="forum">
                    <a :href="currentItem.url">In publisher database</a> |&nbsp;
                    <span v-if="currentItem.Forum">{{ currentItem.Forum.name }}, jufo-level: {{
                        currentItem.Forum.jufoLevel }}</span>
                </p>
                <div class="abstract-wrapper" :settings="{}" :style="{ paddingBottom: abstractPaddingBottom }">
                    <div class="text-content" :class="[
                        isLongContent && !showFullContent && 'text-content--collapsed',
                    ]">
                        <p class="abstract">
                            <small>
                                <b>Abstract:</b>
                            </small>
                            <br />
                            <span v-if="currentItem.abstract" class="abstract__text">{{ sanitizeAbstract(currentItem.abstract) }}</span>
                            <span v-else>No abstract available.</span>
                        </p>
                        <div v-if="isLongContent" :class="[
                            'content-toggle-row',
                            !showFullContent && 'content-toggle-row--collapsed',
                        ]">
                            <button class="content-toggle" @click="toggleContentVisibility">
                                {{ showFullContent ? "Show less" : "Show more" }}
                            </button>
                        </div>
                    </div>
                </div>

                <section class="literature-lists">
                    <div class="literature-list">
                        <div class="literature-list__header">
                            <h4>References ({{ referenceDisplayItems.length }})</h4>
                            <button class="literature-list__toggle" @click="toggleReferencesVisibility">
                                {{ showReferences ? "See less" : "See more" }}
                            </button>
                        </div>
                        <ul v-if="showReferences" class="literature-list__items">
                            <li v-for="(item, index) in referenceDisplayItems" :key="`ref-${item.key}-${index}`">
                                <span v-if="item.title">{{ item.title }}</span>
                                <span v-else class="literature-list__muted">Untitled reference</span>
                                <template v-if="item.year"> ({{ item.year }})</template>
                                <template v-if="item.forum"> - {{ item.forum }}</template>
                                <template v-if="item.doi">
                                    - <a :href="`https://doi.org/${item.doi}`" target="_blank" rel="noopener noreferrer">doi:{{ item.doi }}</a>
                                </template>
                                <template v-if="item.url && !item.doi">
                                    - <a :href="item.url" target="_blank" rel="noopener noreferrer">link</a>
                                </template>
                            </li>
                            <li v-if="referenceDisplayItems.length === 0" class="literature-list__muted">No references available.</li>
                        </ul>
                    </div>

                    <div class="literature-list">
                        <div class="literature-list__header">
                            <h4>Citations ({{ citationDisplayItems.length }})</h4>
                            <button class="literature-list__toggle" @click="toggleCitationsVisibility">
                                {{ showCitations ? "See less" : "See more" }}
                            </button>
                        </div>
                        <ul v-if="showCitations" class="literature-list__items">
                            <li v-for="(item, index) in citationDisplayItems" :key="`cit-${item.key}-${index}`">
                                <span v-if="item.title">{{ item.title }}</span>
                                <span v-else class="literature-list__muted">Untitled citation</span>
                                <template v-if="item.year"> ({{ item.year }})</template>
                                <template v-if="item.forum"> - {{ item.forum }}</template>
                                <template v-if="item.doi">
                                    - <a :href="`https://doi.org/${item.doi}`" target="_blank" rel="noopener noreferrer">doi:{{ item.doi }}</a>
                                </template>
                                <template v-if="item.url && !item.doi">
                                    - <a :href="item.url" target="_blank" rel="noopener noreferrer">link</a>
                                </template>
                            </li>
                            <li v-if="citationDisplayItems.length === 0" class="literature-list__muted">No citations available.</li>
                        </ul>
                    </div>
                </section>

                <section class="bottom-bar">
                    <div class="bottom-bar__center">
                        <div class="bottom-bar__actions">
                            <h4 class="notebook-title notebook-title--inline">Notebook</h4>
                            <textarea :value="currentItem.comment" @input="setComment" @focus="setMoveLock"
                                @blur="unsetMoveLock" class="comment comment--bottom" type="text" rows="3"
                                placeholder="Write your comments here..."></textarea>

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
            </div>

            <aside class="notebook-panel">
                <h4 class="notebook-title">Notebook</h4>
                <textarea :value="currentItem.comment" @input="setComment" @focus="setMoveLock" @blur="unsetMoveLock"
                    class="comment comment--notebook" type="text" rows="16" placeholder="Write your comments here..."></textarea>
            </aside>
        </div>
    </section>
</template>


<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { format as formatDate } from "date-fns";

import MappingActions from "./MappingActions.vue";
import { debounce, keyCodes } from "../helpers/utils";
import { defaultStore } from "../stores/default";

type LiteratureDisplayItem = {
  key: string;
  title: string | null;
  year: string | number | null;
  forum: string | null;
  doi: string | null;
  url: string | null;
};

const store = defaultStore();
const { pageItems, pageLength, page, statusFilter, tab, moveLock, mappingQuestions, currentItem } =
  storeToRefs(store);
const classifierRef = ref<HTMLElement | null>(null);
let sidebarHeightObserver: ResizeObserver | null = null;

const abstractPaddingBottom = computed(() =>
  tab.value === "map" ? `${mappingQuestions.value.length * 35}px` : 0,
);
const COLLAPSED_CONTENT_MAX_CHARS = 1400;
const COLLAPSED_CONTENT_MAX_LINES = 18;

const showFullContent = ref(false);
const showReferences = ref(false);
const showCitations = ref(false);
const DOI_URL_PATTERN = /^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i;

const normalizeDoi = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(DOI_URL_PATTERN, "$1")
    .trim();

  return normalized.length ? normalized : null;
};

const extractDoiFromUrl = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const match = value.trim().match(DOI_URL_PATTERN);
  if (!match || !match[1]) {
    return null;
  }
  try {
    return normalizeDoi(decodeURIComponent(match[1]));
  } catch {
    return normalizeDoi(match[1]);
  }
};

const normalizedCenterText = computed(() => {
  const raw = currentItem.value?.abstract ?? "";
  return raw.replace("Abstract:\n", "").replace("Abstract\n", "");
});

const isLongContent = computed(() => {
  const text = normalizedCenterText.value;
  if (!text) {
    return false;
  }

  const lineCount = text.split(/\r\n|\r|\n/).length;
  return text.length > COLLAPSED_CONTENT_MAX_CHARS || lineCount > COLLAPSED_CONTENT_MAX_LINES;
});

const toggleContentVisibility = () => {
  showFullContent.value = !showFullContent.value;

  const activeElement = document.activeElement as HTMLElement | null;
  if (activeElement?.classList.contains("content-toggle")) {
    activeElement.blur();
  }
};

const referenceDisplayItems = computed<LiteratureDisplayItem[]>(() => {
  const crossrefReferences = currentItem.value?.referenceItems ?? [];
  return crossrefReferences.map((item) => ({
    key: item.key ?? `${item.doi ?? item.articleTitle ?? item.unstructured ?? "ref"}`,
    title: item.articleTitle ?? item.unstructured ?? null,
    year: item.year ?? null,
    forum: item.journalTitle ?? null,
    doi: normalizeDoi(item.doi),
    url: null,
  }));
});

const citationDisplayItems = computed<LiteratureDisplayItem[]>(() => {
  const citations = currentItem.value?.openAlexCitationItems ?? [];
  return citations.map((item) => ({
    key: item.openAlexId ?? `${item.doi ?? item.title ?? "citation"}`,
    title: item.title ?? null,
    year: item.year ?? null,
    forum: item.forum ?? null,
    doi: normalizeDoi(item.doi) ?? extractDoiFromUrl(item.url),
    url: item.url ?? null,
  }));
});

const blurToggleIfNeeded = () => {
  const activeElement = document.activeElement as HTMLElement | null;
  if (activeElement?.classList.contains("literature-list__toggle")) {
    activeElement.blur();
  }
};

const toggleReferencesVisibility = () => {
  showReferences.value = !showReferences.value;
  blurToggleIfNeeded();
};

const toggleCitationsVisibility = () => {
  showCitations.value = !showCitations.value;
  blurToggleIfNeeded();
};

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

const sanitizeAbstract = (value: string) =>
  value.replace("Abstract:\n", "").replace("Abstract\n", "").split("\n•\n").join("");

const isInteractiveTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element) {
    return false;
  }

  return (
    element.tagName === "INPUT"
    || element.tagName === "TEXTAREA"
    || element.tagName === "SELECT"
    || element.tagName === "BUTTON"
    || element.isContentEditable
  );
};

watch(
  () => currentItem.value?.id,
  () => {
    showFullContent.value = false;
    showReferences.value = false;
    showCitations.value = false;
  },
);

const moveTo = (event: KeyboardEvent) => {
  if (isInteractiveTarget(event.target)) {
    return;
  }

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

const updateSidebarHeightVariable = () => {
  const classifierElement = classifierRef.value;
  const sidebarElement = document.getElementById("sidebar");
  if (!classifierElement || !sidebarElement) {
    return;
  }

  const sidebarHeight = Math.ceil(sidebarElement.getBoundingClientRect().height);
  classifierElement.style.setProperty("--sidebar-height", `${sidebarHeight}px`);
};

onMounted(() => {
  window.addEventListener("keydown", moveTo);
  window.addEventListener("resize", updateSidebarHeightVariable);

  const sidebarElement = document.getElementById("sidebar");
  if (sidebarElement) {
    sidebarHeightObserver = new ResizeObserver(() => {
      updateSidebarHeightVariable();
    });
    sidebarHeightObserver.observe(sidebarElement);
  }

  void nextTick(updateSidebarHeightVariable);
});

onUnmounted(() => {
  window.removeEventListener("keydown", moveTo);
  window.removeEventListener("resize", updateSidebarHeightVariable);
  sidebarHeightObserver?.disconnect();
  sidebarHeightObserver = null;
});
</script>
<style scoped lang="scss">
#classifier {
    flex: 1;
    min-width: 0;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.classifier-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--layout-gutter, 12px);
    flex: 1;
    width: 100%;
    min-width: 0;
    min-height: 100%;
}

.classifier-main {
    min-width: 0;
    height: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
}

.notebook-panel {
    display: none;
}

.notebook-title {
    margin: 0 0 5px;
    background: #f7f7f7;
    padding: 3px 5px;
    color: #5b5858;
    text-transform: uppercase;
    font-size: 12px;
    font-weight: 400;
}

.notebook-title--inline {
    display: block;
}

h1 {
    margin: 10px 0 6px;
    line-height: 1.15;
}

.abstract {
    line-height: 32px;
    font-family: Georgia;
    font-size: 18px;
    margin: 0;
}

.abstract__text {
    white-space: pre-line;
}

.abstract-wrapper {
    flex: 1;
    position: relative;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: auto;
}

.text-content {
    min-height: 0;
    position: relative;
}

.text-content--collapsed {
    overflow: hidden;
    max-height: clamp(220px, 36vh, 420px);
    padding-bottom: 56px;
}

.content-toggle-row {
    display: flex;
    align-items: center;
    margin-top: 6px;
}

.content-toggle-row--collapsed {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    align-items: flex-end;
    min-height: 56px;
    margin-top: 0;
    padding: 24px 0 6px;
    background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.96) 55%,
        #ffffff 100%
    );
    z-index: 2;
}

.content-toggle {
    align-self: flex-start;
    padding: 2px 6px;
    border: 0;
    background: #fff;
    border-radius: 3px;
    color: #3750dc;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;

    &:hover {
        color: #233496;
        background: #f7f7f7;
    }
}

.literature-lists {
    border-top: 1px solid #eaeaea;
    margin-top: 8px;
    padding-top: 8px;
}

.literature-list {
    +.literature-list {
        margin-top: 8px;
    }

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;

        h4 {
            margin: 0;
            font-size: 14px;
            color: #3b4c5d;
        }
    }

    &__toggle {
        padding: 2px 6px;
        border: 0;
        background: #fff;
        border-radius: 3px;
        color: #3750dc;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.02em;

        &:hover {
            color: #233496;
            background: #f7f7f7;
        }
    }

    &__items {
        margin: 6px 0 0;
        padding-left: 18px;
        line-height: 1.35;
        font-size: 12px;
        color: #3a3a3a;
        max-height: 220px;
        overflow: auto;
    }

    &__muted {
        color: #8a8a8a;
        font-style: italic;
    }
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
    width: 100%;
    box-sizing: border-box;

    &:focus,
    &:hover {
        outline: none;
        box-shadow: none;
        background-color: #eaeaea;
    }
}

.comment--notebook {
    min-height: 280px;
    margin: 0;
    padding: 5px;
}

.forum {
    margin: 0 0 8px;
    padding-bottom: 6px;
    border-bottom: 2px solid #eaeaea;
    line-height: 1.2;
}

.author {
    margin: 0 0 4px;
    line-height: 1.2;

    small {
        font-size: 12px;
    }
}

.bottom-bar {
    position: sticky;
    bottom: 0;
    margin-top: auto;
    padding-top: 12px;
    z-index: 5;
    pointer-events: auto;

    &__center {
        max-width: none;
        margin: 0;
        pointer-events: auto;
    }

    &__actions {
        display: flex;
        flex-direction: column;
        margin-left: 0;
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

.comment--bottom {
    display: block;
}

@media (max-width: 1024px) {
    .bottom-bar__actions {
        border-top-width: 2px;
    }
}

@media (min-width: 1280px) {
    .classifier-layout {
        grid-template-columns: minmax(0, 1fr) clamp(320px, 25vw, 460px);
        align-items: start;
    }

    .notebook-panel {
        display: flex;
        flex-direction: column;
        position: sticky;
        top: var(--layout-gutter, 12px);
        align-self: start;
        box-sizing: border-box;
        border: 1px solid #eaeaea;
        background: #fff;
        margin-top: 0;
        padding: 5px;
        height: var(--sidebar-height, auto);
        max-height: var(--sidebar-height, none);
        overflow: hidden;
    }

    .comment--notebook {
        min-height: 0;
        max-height: none;
        height: 100%;
        flex: 1;
    }

    .comment--bottom {
        display: none;
    }

    .notebook-title--inline {
        display: none;
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
    margin: 0 0 6px;
    background: #f7f7f7;
    padding: 3px 5px;
    color: #5b5858;
    text-transform: uppercase;
    font-size: 12px;
    font-weight: 400;
}
</style>
