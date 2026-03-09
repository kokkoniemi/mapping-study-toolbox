<template>
  <div
    v-if="selectedRecordCount > 0 || enrichmentRunning || enrichmentMessage || enrichmentError"
    class="data-enrichment-status"
  >
    <span class="data-enrichment-status__selection">Selected {{ selectedRecordCount }}</span>
    <div v-if="enrichmentRunning" class="data-enrichment-status__progress">
      <div class="data-enrichment-status__progress-track">
        <div class="data-enrichment-status__progress-fill" :style="{ width: `${enrichmentProgressPercent}%` }"></div>
      </div>
      <span class="data-enrichment-status__progress-text">{{ enrichmentProcessed }} / {{ enrichmentTotal }}</span>
    </div>
    <span v-if="enrichmentMessage" class="data-enrichment-status__text">{{ enrichmentMessage }}</span>
    <span v-if="enrichmentError" class="data-enrichment-status__text data-enrichment-status__text--error">
      {{ enrichmentError }}
    </span>
    <span class="data-enrichment-status__api">
      Crossref: {{ enrichmentMetrics.crossref.records }} rec / {{ enrichmentMetrics.crossref.requests }} req
    </span>
    <span class="data-enrichment-status__api">
      OpenAlex: {{ enrichmentMetrics.openalex.records }} rec / {{ enrichmentMetrics.openalex.requests }} req
    </span>
    <span class="data-enrichment-status__api">
      JUFO: {{ enrichmentMetrics.jufo.records }} rec / {{ enrichmentMetrics.jufo.requests }} req
    </span>
  </div>
</template>

<script setup lang="ts">
import type { EnrichmentJob } from "../../helpers/api";

defineProps<{
  selectedRecordCount: number;
  enrichmentRunning: boolean;
  enrichmentMessage: string;
  enrichmentError: string;
  enrichmentProgressPercent: number;
  enrichmentProcessed: number;
  enrichmentTotal: number;
  enrichmentMetrics: EnrichmentJob["metrics"];
}>();
</script>

<style scoped lang="scss">
.data-enrichment-status {
  margin-top: -2px;
  margin-bottom: 8px;
  padding: 6px 10px;
  border: 1px solid #eaeaea;
  background: #fff;
  font-size: 11px;
  color: #5f5f5f;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  &__selection {
    color: #6b6b6b;
    white-space: nowrap;
  }

  &__progress {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__progress-track {
    width: 170px;
    height: 8px;
    border-radius: 6px;
    background: #ececec;
    overflow: hidden;
  }

  &__progress-fill {
    height: 100%;
    background: #3d66d8;
    transition: width 0.2s ease;
  }

  &__progress-text {
    color: #5f5f5f;
    min-width: 56px;
    text-align: right;
    white-space: nowrap;
  }

  &__text {
    color: #5f5f5f;

    &--error {
      color: #8e2b2b;
    }
  }

  &__api {
    color: #636363;
    white-space: nowrap;
  }
}
</style>
