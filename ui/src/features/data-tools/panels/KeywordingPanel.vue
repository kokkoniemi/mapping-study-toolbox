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
            <span>
              existing {{ job.summary.existingSuggestionCount }},
              new {{ job.summary.newSuggestionCount }},
              skipped {{ job.summary.skippedRecords.length }}
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
  start: [];
  cancel: [jobId: string];
  download: [jobId: string];
}>();
</script>
