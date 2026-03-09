import { computed, ref, type Ref } from "vue";
import type { EnrichmentProvider } from "@shared/contracts";

import { records, type EnrichmentJob, type RecordItem } from "../helpers/api";
import { getApiErrorMessage } from "../helpers/errors";
import { defaultStore } from "../stores/default";

type EnrichmentMetrics = EnrichmentJob["metrics"];

const createEmptyMetrics = (): EnrichmentMetrics => ({
  crossref: { records: 0, requests: 0 },
  openalex: { records: 0, requests: 0 },
  jufo: { records: 0, requests: 0 },
});

const wait = async (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

type UseEnrichmentJobParams = {
  store: ReturnType<typeof defaultStore>;
  selectedRecordIds: Ref<number[]>;
  isUnmounted: Ref<boolean>;
};

export const useEnrichmentJob = ({
  store,
  selectedRecordIds,
  isUnmounted,
}: UseEnrichmentJobParams) => {
  const enrichmentRunning = ref(false);
  const enrichmentStopping = ref(false);
  const activeEnrichmentJobId = ref<string | null>(null);
  const enrichmentMessage = ref("");
  const enrichmentError = ref("");
  const enrichmentProcessed = ref(0);
  const enrichmentTotal = ref(0);
  const enrichmentMetrics = ref<EnrichmentMetrics>(createEmptyMetrics());
  const enrichmentProvider = ref<EnrichmentProvider>("all");
  const enrichmentForceRefresh = ref(false);

  const enrichmentProgressPercent = computed(() => {
    if (enrichmentTotal.value <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round((enrichmentProcessed.value / enrichmentTotal.value) * 100)));
  });

  const updateStoreFromEnrichmentJob = (job: EnrichmentJob) => {
    for (const updatedRecord of job.updatedRecords as RecordItem[]) {
      store.updateRecordInPage(updatedRecord.id, updatedRecord);
    }
  };

  const summarizeJob = (job: EnrichmentJob) => {
    const enrichedCount = job.results.filter((result) => result.status === "enriched").length;
    const failedCount = job.results.filter((result) => result.status === "failed").length;
    const skippedCount = job.results.filter((result) => result.status === "skipped").length;
    const base = `Enriched ${enrichedCount}, failed ${failedCount}, skipped ${skippedCount}`;
    if (job.status === "cancelled") {
      return `Cancelled at ${job.processed} / ${job.total}. ${base}`;
    }
    return base;
  };

  const waitForJobCompletion = async (jobId: string) => {
    const pollIntervalMs = 1200;

    while (true) {
      if (isUnmounted.value) {
        return;
      }

      const response = await records.enrichment.getJob(jobId);
      const job = response.data;
      enrichmentProcessed.value = job.processed;
      enrichmentTotal.value = job.total;
      enrichmentMetrics.value = job.metrics ?? createEmptyMetrics();
      enrichmentMessage.value = `Enrichment ${job.processed} / ${job.total}`;

      if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
        updateStoreFromEnrichmentJob(job);
        enrichmentMessage.value = summarizeJob(job);
        return;
      }

      await wait(pollIntervalMs);
    }
  };

  const enrichSelectedRecords = async () => {
    if (selectedRecordIds.value.length === 0 || enrichmentRunning.value) {
      return;
    }

    const providerLabel =
      enrichmentProvider.value === "all"
        ? "Crossref + OpenAlex"
        : enrichmentProvider.value === "openalex"
          ? "OpenAlex"
          : "Crossref";

    enrichmentRunning.value = true;
    enrichmentStopping.value = false;
    activeEnrichmentJobId.value = null;
    enrichmentError.value = "";
    enrichmentMessage.value = `Starting ${providerLabel} enrichment...`;
    enrichmentProcessed.value = 0;
    enrichmentTotal.value = selectedRecordIds.value.length;
    enrichmentMetrics.value = createEmptyMetrics();

    try {
      const response = await records.enrichment.createJob({
        recordIds: selectedRecordIds.value,
        provider: enrichmentProvider.value,
        forceRefresh: enrichmentForceRefresh.value,
      });
      activeEnrichmentJobId.value = response.data.jobId;
      await waitForJobCompletion(response.data.jobId);
    } catch (error) {
      enrichmentError.value = getApiErrorMessage(error);
    } finally {
      enrichmentRunning.value = false;
      enrichmentStopping.value = false;
      activeEnrichmentJobId.value = null;
    }
  };

  const stopEnrichment = async () => {
    if (!enrichmentRunning.value || enrichmentStopping.value || !activeEnrichmentJobId.value) {
      return;
    }

    enrichmentStopping.value = true;
    try {
      await records.enrichment.cancelJob(activeEnrichmentJobId.value);
      enrichmentMessage.value = "Stopping enrichment...";
    } catch (error) {
      enrichmentError.value = getApiErrorMessage(error);
      enrichmentStopping.value = false;
    }
  };

  return {
    enrichmentRunning,
    enrichmentStopping,
    enrichmentMessage,
    enrichmentError,
    enrichmentProcessed,
    enrichmentTotal,
    enrichmentMetrics,
    enrichmentProvider,
    enrichmentForceRefresh,
    enrichmentProgressPercent,
    enrichSelectedRecords,
    stopEnrichment,
  };
};
