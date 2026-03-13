<template>
  <section id="classifier" v-if="currentItem" ref="classifierRef">
    <div class="classifier-layout">
      <div class="classifier-main" ref="classifierMainRef">
        <RecordMetaHeader
          :recordId="currentItem.id"
          :createdFormatted="createdFormatted"
          :modifiedFormatted="modifiedFormatted"
          :statusText="currentItem.status"
          :databaseList="databaseList"
        />

        <RecordIdentityBlock
          :title="currentItem.title"
          :authorDisplay="authorDisplay"
          :year="currentItem.year"
          :affiliations="affiliations"
          :url="currentItem.url"
          :forumName="forumName"
          :jufoLevel="currentItem.Forum?.jufoLevel ?? null"
          :enrichmentBadges="enrichmentBadges"
        />

        <div class="abstract-wrapper" :settings="{}">
          <div class="text-content">
            <AbstractSection :abstractText="abstractText" />
          </div>
          <LiteratureLists
            :showReferences="showReferences"
            :showCitations="showCitations"
            :showTopics="showTopics"
            :referenceItems="referenceDisplayItems"
            :citationItems="citationDisplayItems"
            :topicItems="topicDisplayItems"
            @toggle-references="toggleReferencesVisibility"
            @toggle-citations="toggleCitationsVisibility"
            @toggle-topics="toggleTopicsVisibility"
          />
        </div>

        <BottomActionBar
          :tab="tab"
          :comment="currentItem.comment"
          :status="currentItem.status"
          @comment-input="onCommentInput"
          @focus-comment="onCommentFocus"
          @blur-comment="onCommentBlur"
          @exclude="setExcluded"
          @uncertain="setUncertain"
          @include="setIncluded"
        >
          <MappingActions v-if="tab === 'map'" />
        </BottomActionBar>
      </div>

      <NotebookPanel
        :comment="currentItem.comment"
        @comment-input="onCommentInput"
        @focus-comment="onCommentFocus"
        @blur-comment="onCommentBlur"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { storeToRefs } from "pinia";

import MappingActions from "../../components/MappingActions.vue";
import { defaultStore } from "../../stores/default";
import AbstractSection from "./components/AbstractSection.vue";
import BottomActionBar from "./components/BottomActionBar.vue";
import LiteratureLists from "./components/LiteratureLists.vue";
import NotebookPanel from "./components/NotebookPanel.vue";
import RecordIdentityBlock from "./components/RecordIdentityBlock.vue";
import RecordMetaHeader from "./components/RecordMetaHeader.vue";
import { useClassifierLayout } from "./composables/useClassifierLayout";
import { useCommentEditing } from "./composables/useCommentEditing";
import { useLiteratureDisplay } from "./composables/useLiteratureDisplay";
import "./styles.scss";

const store = defaultStore();
const { pageItems, pageLength, page, tab, moveLock, currentItem } = storeToRefs(store);
const classifierRef = ref<HTMLElement | null>(null);
const classifierMainRef = ref<HTMLElement | null>(null);

const {
  showReferences,
  showCitations,
  showTopics,
  referenceDisplayItems,
  citationDisplayItems,
  authorDisplay,
  affiliations,
  topicDisplayItems,
  enrichmentBadges,
  createdFormatted,
  modifiedFormatted,
  databaseList,
  forumName,
  abstractText,
  toggleReferencesVisibility,
  toggleCitationsVisibility,
  toggleTopicsVisibility,
  resetVisibility,
} = useLiteratureDisplay(currentItem);

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

const setExcluded = async () => {
  await store.setItemStatus("excluded");
};

const setUncertain = async () => {
  await store.setItemStatus("uncertain");
};

const setIncluded = async () => {
  await store.setItemStatus("included");
};

const { onCommentInput, onCommentFocus, onCommentBlur } = useCommentEditing({
  currentItem,
  setItemComment: (id, value) => store.setItemComment(id, value),
  setMoveLock: () => store.setMoveLock(),
  unsetMoveLock: () => store.unsetMoveLock(),
});

const currentItemId = computed(() => currentItem.value?.id ?? null);

useClassifierLayout({
  classifierRef,
  classifierMainRef,
  moveLock,
  currentItemId,
  resetVisibility,
  onMovePrev: setPrevItem,
  onMoveNext: () => setNextItem(),
});
</script>
