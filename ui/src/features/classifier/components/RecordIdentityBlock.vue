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
    <p v-if="affiliations.length > 0" class="affiliations">
      <small>
        Affiliations: {{ visibleAffiliationsText }}<span v-if="hasHiddenAffiliations">...</span>
        <button
          v-if="canToggleAffiliations"
          type="button"
          class="affiliations__toggle"
          @click="toggleAffiliations"
        >
          {{ showAllAffiliations ? "Hide" : "Show all" }}
        </button>
      </small>
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
import { computed, ref, watch } from "vue";

type EnrichmentBadge = {
  label: string;
  level: "low" | "medium" | "high";
  score: number;
  tooltip: string;
};

const MAX_COLLAPSED_AFFILIATIONS = 3;

const props = defineProps<{
  title: string;
  authorDisplay: string;
  year: number | null | undefined;
  affiliations: string[];
  url: string | null;
  forumName: string;
  jufoLevel: number | null;
  enrichmentBadges: EnrichmentBadge[];
}>();

const showAllAffiliations = ref(false);

const canToggleAffiliations = computed(() => props.affiliations.length > MAX_COLLAPSED_AFFILIATIONS);
const hasHiddenAffiliations = computed(() => canToggleAffiliations.value && !showAllAffiliations.value);
const visibleAffiliations = computed(() =>
  hasHiddenAffiliations.value ? props.affiliations.slice(0, MAX_COLLAPSED_AFFILIATIONS) : props.affiliations,
);
const visibleAffiliationsText = computed(() => visibleAffiliations.value.join("; "));

const toggleAffiliations = () => {
  showAllAffiliations.value = !showAllAffiliations.value;
};

watch(
  () => props.affiliations,
  () => {
    showAllAffiliations.value = false;
  },
);
</script>
