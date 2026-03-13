<template>
  <section class="record-identity">
    <h1 class="record-title">{{ title }}</h1>
    <p class="author">
      <small>
        {{ authorDisplay }}
        <template v-if="year !== null && year !== undefined">
          ({{ year }})
        </template>
      </small>
    </p>
    <p v-if="affiliationsDisplay.length > 0" class="affiliations">
      <small>Affiliations: {{ affiliationsDisplay }}</small>
    </p>
    <p class="forum">
      <template v-if="url">
        <a :href="url">In publisher database</a>
      </template>
      <span v-else>Publisher database unavailable</span>
      |&nbsp;
      <span v-if="forumName">{{ forumName }}, jufo-level: {{ jufoLevel }}</span>
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
  </section>
</template>

<script setup lang="ts">
type EnrichmentBadge = {
  label: string;
  level: "low" | "medium" | "high";
  score: number;
  tooltip: string;
};

defineProps<{
  title: string;
  authorDisplay: string;
  year: number | null | undefined;
  affiliationsDisplay: string;
  url: string | null;
  forumName: string;
  jufoLevel: number | null;
  enrichmentBadges: EnrichmentBadge[];
}>();
</script>
