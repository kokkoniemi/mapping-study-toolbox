import { afterEach, describe, expect, it, vi } from "vitest";

const keywordingPayload = {
  jobId: "job-1",
  appDataDir: "/tmp/app-data",
  analysisMode: "advanced" as const,
  reuseEmbeddingCache: true,
  records: [],
  mappingQuestions: [],
};

describe("lib/workerClient", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the advanced keywording timeout for advanced jobs", async () => {
    vi.stubEnv("KEYWORDING_WORKER_TIMEOUT_MS", "180000");
    vi.stubEnv("KEYWORDING_ADVANCED_WORKER_TIMEOUT_MS", "900000");

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const { requestWorkerKeywording } = await import("../lib/workerClient");
    await requestWorkerKeywording(keywordingPayload);

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 900_000);
  });

  it("surfaces a clear timeout error for advanced keywording jobs", async () => {
    vi.useFakeTimers();
    vi.stubEnv("KEYWORDING_ADVANCED_WORKER_TIMEOUT_MS", "600000");

    const fetchMock = vi.fn((_input: URL | RequestInfo, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" }));
        });
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { requestWorkerKeywording } = await import("../lib/workerClient");
    const promise = requestWorkerKeywording(keywordingPayload);
    const assertion = expect(promise).rejects.toMatchObject({
      code: "WORKER_TIMEOUT",
      message: "Advanced keywording timed out waiting for the worker after 10 minutes. Increase KEYWORDING_ADVANCED_WORKER_TIMEOUT_MS or KEYWORDING_WORKER_TIMEOUT_MS and try again.",
      status: 504,
    });
    await vi.advanceTimersByTimeAsync(600_000);

    await assertion;
  });
});
