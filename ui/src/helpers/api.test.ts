import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildUrl, http, HttpError } from "./api";

describe("buildUrl", () => {
  it("builds URL and ignores null/undefined params", () => {
    const url = new URL(
      buildUrl("records", {
        offset: 10,
        limit: 25,
        status: "included",
        ignoredNull: null,
        ignoredUndefined: undefined,
      }),
    );

    expect(url.pathname).toBe("/api/records");
    expect(url.searchParams.get("offset")).toBe("10");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("status")).toBe("included");
    expect(url.searchParams.has("ignoredNull")).toBe(false);
    expect(url.searchParams.has("ignoredUndefined")).toBe(false);
  });

  it("appends array params as repeated query keys", () => {
    const url = new URL(buildUrl("records", { status: ["included", "excluded"] }));
    expect(url.searchParams.getAll("status")).toEqual(["included", "excluded"]);
  });
});

describe("http", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends GET requests with query params", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ count: 1, records: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const response = await http.get<{ count: number; records: unknown[] }>("records", {
      params: { limit: 5 },
    });

    expect(response.status).toBe(200);
    expect(response.data.count).toBe(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/records");
    expect(url).toContain("limit=5");
    expect(init.method).toBe("GET");
  });

  it("sends JSON body for POST requests", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 1 }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );

    await http.post<{ id: number }, { title: string }>("mapping-questions", {
      title: "Question",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(init.method).toBe("POST");
    expect(headers.Accept).toBe("application/json");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ title: "Question" }));
  });

  it("sends JSON body for PATCH requests", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 1, title: "Updated" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    await http.patch<{ id: number; title: string }, { title: string }>("records/1", {
      title: "Updated",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ title: "Updated" }));
  });

  it("retries transient GET network failures", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("socket reset"))
      .mockResolvedValue(
        new Response(JSON.stringify({ count: 1, records: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    const responsePromise = http.get<{ count: number; records: unknown[] }>("records");
    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.data.count).toBe(1);
    vi.useRealTimers();
  });

  it("throws HttpError for non-2xx responses", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ error: "invalid" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    let caught: unknown;
    try {
      await http.get("records");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(HttpError);
    expect(caught).toMatchObject({
      response: { status: 400, data: { error: "invalid" } },
    });
  });
});
