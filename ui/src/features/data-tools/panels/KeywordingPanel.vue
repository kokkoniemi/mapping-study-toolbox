<template>
  <div class="data-tools__panel data-tools__panel--keywording data-tools__panel--workspace">
    <div class="keywording-tools__header">
      <div>
        <h4>Keywording audit</h4>
        <p>Run report-only keywording against already extracted PDFs and download the audit bundle.</p>
      </div>
      <div class="keywording-tools__meta">
        <span>{{ selectedRecordCount }} selected</span>
        <button type="button" :disabled="keywordingLoading" @click="emit('reload')">
          {{ keywordingLoading ? "Loading..." : "Reload jobs" }}
        </button>
      </div>
    </div>

    <p v-if="keywordingError" class="keywording-tools__error">{{ keywordingError }}</p>
    <p v-if="keywordingMessage" class="keywording-tools__message">{{ keywordingMessage }}</p>

    <section class="keywording-tools__setup">
      <h5>Run setup</h5>
      <p>{{ eligibleRecordCount }} / {{ selectedRecordCount }} selected record{{ selectedRecordCount === 1 ? "" : "s" }} have extracted PDFs ready.</p>
      <div class="keywording-tools__advanced">
        <label class="keywording-tools__field">
          <span>Analysis mode</span>
          <select :value="analysisMode" @change="onAnalysisModeChange">
            <option value="standard">Standard</option>
            <option value="advanced">Advanced (BERTopic + SPECTER2)</option>
          </select>
        </label>
        <label class="keywording-tools__checkbox">
          <input
            type="checkbox"
            :checked="reuseEmbeddingCache"
            @change="onReuseCacheChange"
          />
          <span>Reuse cached embeddings when possible</span>
        </label>
        <p class="keywording-tools__hint" v-if="analysisMode === 'advanced'">
          Advanced mode uses local SPECTER2 embeddings, BERTopic clustering, and GPT adjudication. Completed jobs will include cache and topic metadata.
        </p>
      </div>
      <div class="keywording-tools__questions">
        <label v-for="question in mappingQuestions" :key="question.id" class="keywording-tools__question">
          <input
            type="checkbox"
            :checked="selectedQuestionIds.includes(question.id)"
            @change="emit('toggle-question', question.id)"
          />
          <span>{{ question.title || `Question ${question.id}` }}</span>
        </label>
      </div>
      <button type="button" class="data-tools__primary" :disabled="!canStartKeywording || keywordingStarting" @click="emit('start')">
        {{ keywordingStarting ? "Starting..." : "Start keywording job" }}
      </button>
    </section>

    <section class="keywording-tools__jobs">
      <h5>Reports</h5>
      <ul class="keywording-tools__job-list">
        <li v-for="job in keywordingJobs" :key="job.jobId" class="keywording-tools__job">
          <div class="keywording-tools__job-meta">
            <strong>{{ job.jobId }}</strong>
            <span>{{ job.status }} / {{ job.processed }} of {{ job.total }}</span>
            <span>mode {{ job.analysisMode }}</span>
            <span>
              reuse {{ job.summary.actionCounts.reuse_existing }},
              create {{ job.summary.actionCounts.create_new }},
              split/merge {{ job.summary.actionCounts.split_existing + job.summary.actionCounts.merge_existing }},
              review {{ job.summary.manualReviewCount }}
            </span>
            <span v-if="job.analysisMode === 'advanced'">
              cache {{ job.cacheSummary.hits }} hit / {{ job.cacheSummary.misses }} miss / {{ job.cacheSummary.writes }} write,
              topics {{ job.topicCountBeforeReduction ?? 0 }} -> {{ job.topicCountAfterReduction ?? 0 }},
              outliers {{ job.summary.outlierTopicCount }},
              downgraded {{ job.downgradedTopicCount }},
              reduction {{ job.topicReductionApplied ? "on" : "off" }},
              representation {{ job.representationModel || "n/a" }}
            </span>
          </div>
          <div class="keywording-tools__job-actions">
            <button
              type="button"
              :disabled="!(job.status === 'queued' || job.status === 'running' || job.status === 'cancelling')"
              @click="emit('cancel', job.jobId)"
            >
              Cancel
            </button>
            <button type="button" :disabled="!job.reportReady" @click="emit('download', job.jobId)">
              Download report
            </button>
          </div>
        </li>
        <li v-if="keywordingJobs.length === 0" class="keywording-tools__empty">
          No keywording jobs yet.
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { KeywordingJob, MappingQuestion } from "../../../helpers/api";

defineProps<{
  selectedRecordCount: number;
  eligibleRecordCount: number;
  mappingQuestions: MappingQuestion[];
  selectedQuestionIds: number[];
  analysisMode: "standard" | "advanced";
  reuseEmbeddingCache: boolean;
  canStartKeywording: boolean;
  keywordingStarting: boolean;
  keywordingLoading: boolean;
  keywordingError: string;
  keywordingMessage: string;
  keywordingJobs: KeywordingJob[];
}>();

const emit = defineEmits<{
  reload: [];
  "toggle-question": [questionId: number];
  "update-analysis-mode": [analysisMode: "standard" | "advanced" | string];
  "update-reuse-cache": [reuseEmbeddingCache: boolean];
  start: [];
  cancel: [jobId: string];
  download: [jobId: string];
}>();

const onAnalysisModeChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement | null)?.value;
  emit("update-analysis-mode", value === "advanced" ? "advanced" : "standard");
};

const onReuseCacheChange = (event: Event) => {
  emit("update-reuse-cache", Boolean((event.target as HTMLInputElement | null)?.checked));
};
</script>
