<template>
  <section class="literature-lists">
    <div class="literature-list">
      <div class="literature-list__header">
        <h4>References ({{ referenceItems.length }})</h4>
        <button type="button" class="literature-list__toggle" @click="onToggleClick('toggle-references', $event)">
          {{ showReferences ? "Hide" : "Show" }}
        </button>
      </div>
      <ul v-if="showReferences" class="literature-list__items">
        <li v-for="item in referenceItems" :key="item.key" class="literature-list__item">
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
        <li v-if="referenceItems.length === 0" class="literature-list__muted">
          No references available.
        </li>
      </ul>
    </div>

    <div class="literature-list">
      <div class="literature-list__header">
        <h4>Citations ({{ citationItems.length }})</h4>
        <button type="button" class="literature-list__toggle" @click="onToggleClick('toggle-citations', $event)">
          {{ showCitations ? "Hide" : "Show" }}
        </button>
      </div>
      <ul v-if="showCitations" class="literature-list__items">
        <li v-for="item in citationItems" :key="item.key" class="literature-list__item">
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
        <li v-if="citationItems.length === 0" class="literature-list__muted">
          No citations available.
        </li>
      </ul>
    </div>

    <div class="literature-list">
      <div class="literature-list__header">
        <h4>Topics ({{ topicItems.length }})</h4>
        <button type="button" class="literature-list__toggle" @click="onToggleClick('toggle-topics', $event)">
          {{ showTopics ? "Hide" : "Show" }}
        </button>
      </div>
      <ul v-if="showTopics" class="literature-list__items">
        <li v-for="item in topicItems" :key="item.key" class="literature-list__item">
          <span>{{ item.displayName }}</span>
          <template v-if="item.score !== null"> (score: {{ item.score.toFixed(2) }})</template>
          <template v-if="item.field"> - {{ item.field }}</template>
          <template v-if="item.subfield"> / {{ item.subfield }}</template>
        </li>
        <li v-if="topicItems.length === 0" class="literature-list__muted">
          No topics available.
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
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

defineProps<{
  showReferences: boolean;
  showCitations: boolean;
  showTopics: boolean;
  referenceItems: LiteratureDisplayItem[];
  citationItems: LiteratureDisplayItem[];
  topicItems: TopicDisplayItem[];
}>();

const emit = defineEmits<{
  "toggle-references": [];
  "toggle-citations": [];
  "toggle-topics": [];
}>();

const onToggleClick = (
  eventName: "toggle-references" | "toggle-citations" | "toggle-topics",
  event: MouseEvent,
) => {
  switch (eventName) {
    case "toggle-references":
      emit("toggle-references");
      break;
    case "toggle-citations":
      emit("toggle-citations");
      break;
    case "toggle-topics":
      emit("toggle-topics");
      break;
  }
  (event.currentTarget as HTMLButtonElement | null)?.blur();
};
</script>
