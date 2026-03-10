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
                    <small>
                        {{ authorDisplay }}
                        <template v-if="currentItem.year !== null && currentItem.year !== undefined">
                            ({{ currentItem.year }})
                        </template>
                    </small>
                </p>
                <p v-if="affiliationsDisplay.length > 0" class="affiliations">
                    <small>Affiliations: {{ affiliationsDisplay }}</small>
                </p>
                <p class="forum">
                    <a :href="currentItem.url">In publisher database</a> |&nbsp;
                    <span v-if="currentItem.Forum">{{ decodeHtmlEntities(currentItem.Forum.name ?? "") }}, jufo-level: {{
                        currentItem.Forum.jufoLevel }}</span>
                </p>
                <div v-if="enrichmentBadges.length > 0" class="enrichment-meta">
                    <span class="enrichment-meta__label">Confidence:</span>
                    <span
                        v-for="badge in enrichmentBadges"
                        :key="badge.label"
                        :class="['enrichment-meta__badge', `enrichment-meta__badge--${badge.level}`]"
                        :title="badge.tooltip"
                    >
                        {{ badge.label }} {{ badge.score }}
                    </span>
                </div>
                <div class="abstract-wrapper" :settings="{}">
                    <div class="text-content">
                        <p class="abstract">
                            <small>
                                <b>Abstract:</b>
                            </small>
                            <br />
                            <span v-if="currentItem.abstract" class="abstract__text">{{ sanitizeAbstract(currentItem.abstract) }}</span>
                            <span v-else>No abstract available.</span>
                        </p>
                    </div>
                </div>

                <section class="literature-lists">
                    <div class="literature-list">
                        <div class="literature-list__header">
                            <h4>References ({{ referenceDisplayItems.length }})</h4>
                            <button type="button" class="literature-list__toggle" @click="toggleReferencesVisibility">
                                {{ showReferences ? "Hide" : "Show" }}
                            </button>
                        </div>
                        <ul v-if="showReferences" class="literature-list__items">
                            <li v-for="item in referenceDisplayItems" :key="item.key" class="literature-list__item">
                                <span v-if="item.title">{{ item.title }}</span>
                                <span v-else class="literature-list__muted">Untitled reference</span>
                                <template v-if="item.year"> ({{ item.year }})</template>
                                <template v-if="item.forum"> - {{ item.forum }}</template>
                                <template v-if="item.doi">
                                    - <a :href="`https://doi.org/${item.doi}`" target="_blank" rel="noopener noreferrer">doi:{{ item.doi }}</a>
                                </template>
                                <template v-else-if="item.url">
                                    - <a :href="item.url" target="_blank" rel="noopener noreferrer">open</a>
                                </template>
                            </li>
                            <li v-if="referenceDisplayItems.length === 0" class="literature-list__muted">
                                No references available.
                            </li>
                        </ul>
                    </div>

                    <div class="literature-list">
                        <div class="literature-list__header">
                            <h4>Citations ({{ citationDisplayItems.length }})</h4>
                            <button type="button" class="literature-list__toggle" @click="toggleCitationsVisibility">
                                {{ showCitations ? "Hide" : "Show" }}
                            </button>
                        </div>
                        <ul v-if="showCitations" class="literature-list__items">
                            <li v-for="item in citationDisplayItems" :key="item.key" class="literature-list__item">
                                <span v-if="item.title">{{ item.title }}</span>
                                <span v-else class="literature-list__muted">Untitled citation</span>
                                <template v-if="item.year"> ({{ item.year }})</template>
                                <template v-if="item.forum"> - {{ item.forum }}</template>
                                <template v-if="item.doi">
                                    - <a :href="`https://doi.org/${item.doi}`" target="_blank" rel="noopener noreferrer">doi:{{ item.doi }}</a>
                                </template>
                                <template v-else-if="item.url">
                                    - <a :href="item.url" target="_blank" rel="noopener noreferrer">open</a>
                                </template>
                            </li>
                            <li v-if="citationDisplayItems.length === 0" class="literature-list__muted">
                                No citations available.
                            </li>
                        </ul>
                    </div>

                    <div class="literature-list">
                        <div class="literature-list__header">
                            <h4>Topics ({{ topicDisplayItems.length }})</h4>
                            <button type="button" class="literature-list__toggle" @click="toggleTopicsVisibility">
                                {{ showTopics ? "Hide" : "Show" }}
                            </button>
                        </div>
                        <ul v-if="showTopics" class="literature-list__items">
                            <li v-for="item in topicDisplayItems" :key="item.key" class="literature-list__item">
                                <span>{{ item.displayName }}</span>
                                <template v-if="item.score !== null"> (score: {{ item.score.toFixed(2) }})</template>
                                <template v-if="item.field"> - {{ item.field }}</template>
                                <template v-if="item.subfield"> / {{ item.subfield }}</template>
                            </li>
                            <li v-if="topicDisplayItems.length === 0" class="literature-list__muted">
                                No topics available.
                            </li>
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
import type { EnrichmentFieldProvenance } from "@shared/contracts";

import MappingActions from "./MappingActions.vue";
import { decodeHtmlEntities, debounce, keyCodes } from "../helpers/utils";
import { defaultStore } from "../stores/default";

type LiteratureDisplayItem = {
  key: string;
  title: string | null;
  year: string | number | null;
  forum: string | null;
  doi: string | null;
  url: string | null;
};

type TopicDisplayItem = {
  key: string;
  displayName: string;
  score: number | null;
  field: string | null;
  subfield: string | null;
};

type EnrichmentBadge = {
  label: string;
  level: "low" | "medium" | "high";
  score: number;
  tooltip: string;
};

const store = defaultStore();
const { pageItems, pageLength, page, statusFilter, tab, moveLock, currentItem } =
  storeToRefs(store);
const classifierRef = ref<HTMLElement | null>(null);
let sidebarHeightObserver: ResizeObserver | null = null;

const showReferences = ref(false);
const showCitations = ref(false);
const showTopics = ref(false);
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

const toggleReferencesVisibility = () => {
  showReferences.value = !showReferences.value;
};

const toggleCitationsVisibility = () => {
  showCitations.value = !showCitations.value;
};

const toggleTopicsVisibility = () => {
  showTopics.value = !showTopics.value;
};

const referenceDisplayItems = computed<LiteratureDisplayItem[]>(() => {
  const crossrefReferences = currentItem.value?.referenceItems ?? [];
  return crossrefReferences.map((item) => ({
    key: item.key ?? `${item.doi ?? item.articleTitle ?? item.unstructured ?? "ref"}`,
    title: item.articleTitle ? decodeHtmlEntities(item.articleTitle) : (item.unstructured ? decodeHtmlEntities(item.unstructured) : null),
    year: item.year ?? null,
    forum: item.journalTitle ? decodeHtmlEntities(item.journalTitle) : null,
    doi: normalizeDoi(item.doi),
    url: null,
  }));
});

const citationDisplayItems = computed<LiteratureDisplayItem[]>(() => {
  const citations = currentItem.value?.openAlexCitationItems ?? [];
  return citations.map((item) => ({
    key: item.openAlexId ?? `${item.doi ?? item.title ?? "citation"}`,
    title: item.title ? decodeHtmlEntities(item.title) : null,
    year: item.year ?? null,
    forum: item.forum ? decodeHtmlEntities(item.forum) : null,
    doi: normalizeDoi(item.doi) ?? extractDoiFromUrl(item.url),
    url: item.url ?? null,
  }));
});

const authorDisplay = computed(() => {
  const details = currentItem.value?.authorDetails ?? [];
  if (Array.isArray(details) && details.length > 0) {
    const names = details
      .map((author) => {
        const family = author.family?.trim() ?? "";
        const given = author.given?.trim() ?? "";
        const name = author.name?.trim() ?? "";
        if (family && given) {
          return `${family}, ${given}`;
        }
        if (name) {
          return name;
        }
        return [given, family].filter(Boolean).join(" ").trim();
      })
      .filter((item) => item.length > 0)
      .map((item) => decodeHtmlEntities(item));

    if (names.length > 0) {
      return names.join("; ");
    }
  }

  return decodeHtmlEntities(currentItem.value?.author ?? "");
});

const affiliationsDisplay = computed(() => {
  const values: string[] = [];
  const seen = new Set<string>();

  const pushUnique = (value: string | null | undefined) => {
    const normalized = value?.trim();
    if (!normalized) {
      return;
    }
    const decoded = decodeHtmlEntities(normalized);
    const key = decoded.toLocaleLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    values.push(decoded);
  };

  for (const author of currentItem.value?.authorDetails ?? []) {
    for (const affiliation of author.affiliations ?? []) {
      pushUnique(affiliation);
    }
  }

  for (const affiliation of currentItem.value?.openAlexAuthorAffiliations ?? []) {
    pushUnique(affiliation);
  }

  return values.join("; ");
});

const topicDisplayItems = computed<TopicDisplayItem[]>(() => {
  const topics = currentItem.value?.openAlexTopicItems ?? [];
  return topics
    .filter((item) => item.displayName && item.displayName.trim().length > 0)
    .map((item) => ({
      key: item.id ?? `${item.displayName ?? "topic"}_${item.field ?? ""}_${item.subfield ?? ""}`,
      displayName: item.displayName ?? "",
      score: typeof item.score === "number" ? item.score : null,
      field: item.field ?? null,
      subfield: item.subfield ?? null,
    }));
});

const enrichmentBadgeFromProvenance = (
  label: string,
  item: EnrichmentFieldProvenance | undefined,
): EnrichmentBadge | null => {
  if (!item) {
    return null;
  }

  const source = item.source ? `Source: ${item.source}` : "Source: n/a";
  const tooltip = `${item.provider.toUpperCase()} ${item.confidenceLevel} ${item.confidenceScore} - ${item.reason} (${item.enrichedAt})\n${source}`;
  return {
    label,
    level: item.confidenceLevel,
    score: item.confidenceScore,
    tooltip,
  };
};

const enrichmentBadges = computed<EnrichmentBadge[]>(() => {
  const recordProvenance = currentItem.value?.enrichmentProvenance ?? {};
  const forumProvenance = currentItem.value?.Forum?.enrichmentProvenance ?? {};

  const badges = [
    enrichmentBadgeFromProvenance("DOI", recordProvenance.doi),
    enrichmentBadgeFromProvenance("URL", recordProvenance.url),
    enrichmentBadgeFromProvenance("Forum", recordProvenance.forumId ?? forumProvenance.name),
    enrichmentBadgeFromProvenance("Jufo", forumProvenance.jufoLevel),
    enrichmentBadgeFromProvenance("Refs", recordProvenance.referenceItems),
    enrichmentBadgeFromProvenance("Citations", recordProvenance.openAlexCitationItems),
    enrichmentBadgeFromProvenance("Topics", recordProvenance.openAlexTopicItems),
  ];

  return badges.filter((item): item is EnrichmentBadge => item !== null);
});

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
    showReferences.value = false;
    showCitations.value = false;
    showTopics.value = false;
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
    flex: 1 1 auto;
    min-height: 140px;
    overflow-y: auto;
    overflow-x: hidden;
    border-bottom: 1px solid #eaeaea;
    padding-bottom: 4px;
}

.text-content {
    position: relative;
}

.literature-lists {
    flex: 0 0 auto;
    margin-top: 8px;
    padding-top: 8px;
}

.literature-list {
    min-height: 0;

    + .literature-list {
        margin-top: 8px;
    }

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    h4 {
        margin: 0;
        font-size: 14px;
        color: #3b4c5d;
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
        padding-right: 6px;
        line-height: 1.35;
        font-size: 12px;
        color: #3a3a3a;
        max-height: clamp(140px, 28vh, 320px);
        overflow-y: auto;
        overscroll-behavior: contain;
        border: 1px solid #eaeaea;
        background: #fff;
    }

    &__item {
        margin-bottom: 2px;
    }

    &__muted {
        color: #8a8a8a;
        font-style: italic;
    }
}

.enrichment-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0 0 8px;

    &__label {
        font-size: 12px;
        font-weight: 600;
        color: #586572;
        align-self: center;
        margin-right: 2px;
    }

    &__badge {
        display: inline-flex;
        align-items: center;
        font-size: 11px;
        font-weight: 600;
        border-radius: 3px;
        padding: 2px 6px;
        border: 1px solid #d8d8d8;
        background: #fafafa;
        color: #4e4e4e;

        &--high {
            border-color: #9fc7a0;
            background: #edf8ee;
            color: #2f6a32;
        }

        &--medium {
            border-color: #d4cd98;
            background: #fcf8e5;
            color: #6f6518;
        }

        &--low {
            border-color: #d7b0b0;
            background: #fff1f1;
            color: #7a3131;
        }
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

.affiliations {
    margin: 0 0 6px;
    line-height: 1.2;

    small {
        font-size: 12px;
        color: #4a5865;
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
        align-items: stretch;
    }

    .notebook-panel {
        display: flex;
        flex-direction: column;
        position: relative;
        top: 0;
        align-self: stretch;
        box-sizing: border-box;
        border: 1px solid #eaeaea;
        background: #fff;
        margin-top: 0;
        padding: 5px;
        min-height: var(--sidebar-height, auto);
        height: var(--sidebar-height, auto);
        max-height: var(--sidebar-height, auto);
        overflow: hidden;
    }

    .comment--notebook {
        min-height: 0;
        max-height: 100%;
        height: 100%;
        flex: 1;
        resize: none;
        overflow: auto;
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
