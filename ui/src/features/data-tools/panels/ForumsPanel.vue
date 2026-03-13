<template>
  <div class="data-tools__panel data-tools__panel--forums data-tools__panel--workspace">
    <div class="forum-tools__top">
      <label class="forum-tools__label">
        <span>Search duplicates</span>
        <input
          :value="forumSearchInput"
          type="text"
          placeholder="Search by forum name or ISSN"
          @input="emit('forum-search-input', $event)"
        />
      </label>
      <button type="button" :disabled="forumLoading" @click="emit('reload')">
        {{ forumLoading ? "Loading..." : "Reload" }}
      </button>
      <span class="forum-tools__count">{{ forumGroupsTotal }} groups</span>
    </div>

    <p v-if="forumError" class="forum-tools__error">{{ forumError }}</p>

    <div class="forum-tools__content">
      <ul class="forum-tools__groups">
        <li v-for="group in forumGroups" :key="group.key" class="forum-tools__group">
          <button
            type="button"
            class="forum-tools__group-button"
            :class="{ 'forum-tools__group-button--active': selectedForumGroup?.key === group.key }"
            @click="emit('select-group', group.key)"
          >
            <span class="forum-tools__group-title">
              {{ decodeHtmlEntities(group.normalizedName || group.issn || group.key) }}
            </span>
            <span class="forum-tools__group-meta">
              {{ group.count }} forums, {{ sumRecordCounts(group.forums) }} records
            </span>
          </button>
        </li>
        <li v-if="forumGroups.length === 0 && !forumLoading" class="forum-tools__empty">No duplicate groups</li>
      </ul>
      <button
        v-if="forumHasMore"
        type="button"
        class="forum-tools__load-more"
        :disabled="forumLoading"
        @click="emit('load-more')"
      >
        {{ forumLoading ? "Loading..." : "Load more groups" }}
      </button>

      <div class="forum-tools__merge">
        <template v-if="selectedForumGroup">
          <h4>Merge {{ selectedForumGroup.count }} forums</h4>
          <p class="forum-tools__hint">Choose one target forum and one or more source forums to merge.</p>

          <ul class="forum-tools__forums">
            <li v-for="forum in selectedForumGroup.forums" :key="forum.id" class="forum-tools__forum">
              <label class="forum-tools__target">
                <input
                  type="radio"
                  name="forum-target"
                  :checked="selectedTargetForumId === forum.id"
                  @change="emit('set-target', forum.id)"
                />
                <span>Target</span>
              </label>
              <label class="forum-tools__source">
                <input
                  type="checkbox"
                  :checked="selectedSourceForumIds.includes(forum.id)"
                  :disabled="selectedTargetForumId === forum.id"
                  @change="emit('source-change', forum.id, $event)"
                />
                <span>Source</span>
              </label>
              <div class="forum-tools__forum-meta">
                <strong>{{ forum.name ? decodeHtmlEntities(forum.name) : "(Unnamed forum)" }}</strong>
                <span>id {{ forum.id }}</span>
                <span v-if="forum.issn">ISSN {{ forum.issn }}</span>
                <span>{{ forum.recordCount }} records</span>
              </div>
            </li>
          </ul>

          <div class="forum-tools__merge-actions">
            <button type="button" :disabled="!canPreviewForumMerge || forumMergeLoading" @click="emit('preview-merge')">
              Preview merge
            </button>
            <button
              type="button"
              class="data-tools__primary"
              :disabled="!canApplyForumMerge || forumMergeLoading"
              @click="emit('apply-merge')"
            >
              {{ forumMergeLoading ? "Applying..." : "Apply merge" }}
            </button>
          </div>

          <p v-if="forumMergeError" class="forum-tools__error">{{ forumMergeError }}</p>
          <p v-if="forumMergePreview" class="forum-tools__preview">
            Preview: move {{ forumMergePreview.movedRecordCount }} records and merge
            {{ forumMergePreview.mergedAliases.length }} aliases.
          </p>
        </template>
        <p v-else class="forum-tools__empty">Select a duplicate group to merge forums.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ForumDuplicateGroup, ForumDuplicateItem, ForumMergeResponse } from "@shared/contracts";

import { decodeHtmlEntities } from "../../../helpers/utils";

defineProps<{
  forumSearchInput: string;
  forumLoading: boolean;
  forumGroupsTotal: number;
  forumError: string;
  forumGroups: ForumDuplicateGroup[];
  selectedForumGroup: ForumDuplicateGroup | null;
  selectedTargetForumId: number | null;
  selectedSourceForumIds: number[];
  forumHasMore: boolean;
  canPreviewForumMerge: boolean;
  canApplyForumMerge: boolean;
  forumMergeLoading: boolean;
  forumMergeError: string;
  forumMergePreview: ForumMergeResponse | null;
}>();

const emit = defineEmits<{
  "forum-search-input": [event: Event];
  reload: [];
  "load-more": [];
  "select-group": [groupKey: string];
  "set-target": [forumId: number];
  "source-change": [forumId: number, event: Event];
  "preview-merge": [];
  "apply-merge": [];
}>();

const sumRecordCounts = (forumsList: ForumDuplicateItem[]) =>
  forumsList.reduce((total, forum) => total + forum.recordCount, 0);
</script>
