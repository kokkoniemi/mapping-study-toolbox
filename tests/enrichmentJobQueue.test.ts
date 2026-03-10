import { beforeEach, describe, expect, it, vi } from "vitest";

const enrichCrossrefMock = vi.hoisted(() => vi.fn());
const enrichOpenAlexMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/crossref", () => ({
  CrossrefClient: class CrossrefClient {
    requestCount = 0;
  },
}));

vi.mock("../lib/openalex", () => ({
  OpenAlexClient: class OpenAlexClient {
    requestCount = 0;
  },
}));

vi.mock("../lib/jufo", () => ({
  JufoClient: class JufoClient {
    requestCount = 0;
  },
}));

vi.mock("../lib/enrichCrossref", () => ({
  enrichRecordWithCrossref: enrichCrossrefMock,
}));

vi.mock("../lib/enrichOpenalex", () => ({
  enrichRecordWithOpenAlex: enrichOpenAlexMock,
}));

import {
  __resetEnrichmentJobsForTests,
  cancelEnrichmentJob,
  createEnrichmentJob,
  getEnrichmentJob,
} from "../lib/enrichmentJobQueue";

const wait = async (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const waitForTerminalJob = async (jobId: string) => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const snapshot = getEnrichmentJob(jobId);
    if (!snapshot) {
      return null;
    }

    if (
      snapshot.status === "completed"
      || snapshot.status === "failed"
      || snapshot.status === "cancelled"
    ) {
      return snapshot;
    }

    await wait(10);
  }

  return getEnrichmentJob(jobId);
};

describe("lib/enrichmentJobQueue", () => {
  beforeEach(() => {
    __resetEnrichmentJobsForTests();
    enrichCrossrefMock.mockReset();
    enrichOpenAlexMock.mockReset();

    enrichCrossrefMock.mockImplementation(async (recordId: number, context: { crossrefClient: { requestCount: number } }) => {
      context.crossrefClient.requestCount += 1;
      return {
        result: {
          recordId,
          status: "enriched",
          doi: `10.1000/${recordId}`,
        },
        updatedRecord: { id: recordId },
      };
    });

    enrichOpenAlexMock.mockImplementation(async (recordId: number, context: { openAlexClient: { requestCount: number } }) => {
      context.openAlexClient.requestCount += 1;
      return {
        result: {
          recordId,
          status: "skipped",
          doi: `10.1000/${recordId}`,
          message: "OpenAlex skipped",
        },
      };
    });
  });

  it("processes enrichment jobs and supports compact delta polling", async () => {
    const created = createEnrichmentJob([1, 2], {
      provider: "all",
      forceRefresh: false,
      maxCitations: 200,
    });

    const terminal = await waitForTerminalJob(created.jobId);
    expect(terminal).toBeTruthy();
    expect(terminal?.status).toBe("completed");
    expect(terminal?.processed).toBe(2);
    expect(terminal?.resultCounts.enriched).toBe(2);
    expect(terminal?.resultCounts.failed).toBe(0);
    expect(terminal?.resultCursor).toBe(2);
    expect(terminal?.updatedCursor).toBe(2);

    const compact = getEnrichmentJob(created.jobId, {
      compact: true,
      resultCursor: 1,
      updatedCursor: 1,
    });
    expect(compact).toBeTruthy();
    expect(compact?.results.length).toBe(1);
    expect(compact?.updatedRecords.length).toBe(1);
  });

  it("supports cancellation while a job is running", async () => {
    enrichCrossrefMock.mockImplementation(async (recordId: number, context: { crossrefClient: { requestCount: number } }) => {
      context.crossrefClient.requestCount += 1;
      await wait(25);
      return {
        result: {
          recordId,
          status: "enriched",
          doi: `10.1000/${recordId}`,
        },
        updatedRecord: { id: recordId },
      };
    });

    const created = createEnrichmentJob([10, 11, 12], {
      provider: "crossref",
      forceRefresh: false,
      maxCitations: 100,
    });

    await wait(5);
    const cancellation = cancelEnrichmentJob(created.jobId);
    expect(cancellation).toBeTruthy();
    expect(cancellation?.cancelRequested).toBe(true);
    expect(cancellation?.cancelRequestedAt).toBeTruthy();
    expect(["cancelling", "cancelled"]).toContain(cancellation?.status);

    const terminal = await waitForTerminalJob(created.jobId);
    expect(terminal).toBeTruthy();
    expect(terminal?.status).toBe("cancelled");
    expect(terminal?.cancelRequested).toBe(true);
    expect(terminal?.processed).toBeLessThanOrEqual(3);
  });
});
