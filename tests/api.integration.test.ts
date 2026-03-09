import { spawnSync } from "node:child_process";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  Record: {
    count: vi.fn(),
    findAll: vi.fn(),
    findByPk: vi.fn(),
  },
  MappingOption: {
    count: vi.fn(),
    create: vi.fn(),
    findAll: vi.fn(),
    findByPk: vi.fn(),
  },
  MappingQuestion: {
    count: vi.fn(),
    create: vi.fn(),
    findAll: vi.fn(),
    findByPk: vi.fn(),
  },
  RecordMappingOption: {
    create: vi.fn(),
    destroy: vi.fn(),
    findOne: vi.fn(),
  },
}));

const enrichmentMock = vi.hoisted(() => ({
  createEnrichmentJob: vi.fn(),
  getEnrichmentJob: vi.fn(),
  cancelEnrichmentJob: vi.fn(),
}));

vi.mock("../models", () => ({
  default: dbMock,
}));
vi.mock("../lib/recordEnrichment", () => enrichmentMock);

import { createApp } from "../server";

const canListenToSocket = (() => {
  const result = spawnSync(process.execPath, [
    "-e",
    "require('node:net').createServer().listen(0,'127.0.0.1',function(){this.close(()=>process.exit(0))}).on('error',()=>process.exit(1))",
  ]);
  return result.status === 0;
})();

const describeWhenSocketAllowed = canListenToSocket ? describe : describe.skip;

describeWhenSocketAllowed("API integration", () => {
  beforeEach(() => {
    dbMock.Record.count.mockReset();
    dbMock.Record.findAll.mockReset();
    dbMock.Record.findByPk.mockReset();

    dbMock.MappingOption.count.mockReset();
    dbMock.MappingOption.create.mockReset();
    dbMock.MappingOption.findAll.mockReset();
    dbMock.MappingOption.findByPk.mockReset();

    dbMock.MappingQuestion.count.mockReset();
    dbMock.MappingQuestion.create.mockReset();
    dbMock.MappingQuestion.findAll.mockReset();
    dbMock.MappingQuestion.findByPk.mockReset();

    dbMock.RecordMappingOption.create.mockReset();
    dbMock.RecordMappingOption.destroy.mockReset();
    dbMock.RecordMappingOption.findOne.mockReset();
    enrichmentMock.createEnrichmentJob.mockReset();
    enrichmentMock.getEnrichmentJob.mockReset();
    enrichmentMock.cancelEnrichmentJob.mockReset();
  });

  it("GET /api/health returns ok", async () => {
    const app = createApp();

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("GET /api/records returns contract shape", async () => {
    dbMock.Record.count.mockResolvedValue(2);
    dbMock.Record.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const app = createApp();
    const response = await request(app).get("/api/records").query({ offset: 0, limit: 25 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ count: 2, records: [{ id: 1 }, { id: 2 }] });
  });

  it("GET /api/records with invalid limit returns standardized validation error", async () => {
    const app = createApp();

    const response = await request(app).get("/api/records").query({ limit: -5 });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
  });

  it("PUT /api/records/:id with invalid status returns standardized validation error", async () => {
    const app = createApp();

    const response = await request(app).put("/api/records/1").send({ status: "bad" });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
  });

  it("PATCH /api/records/:id updates record fields", async () => {
    const record = {
      id: 1,
      status: "uncertain",
      title: "Updated",
      update: vi.fn().mockResolvedValue(undefined),
    };
    dbMock.Record.findByPk.mockResolvedValue(record);

    const app = createApp();
    const response = await request(app).patch("/api/records/1").send({
      title: "Updated",
      status: "uncertain",
      databases: ["scopus"],
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 1,
      title: "Updated",
      status: "uncertain",
    });
    expect(record.update).toHaveBeenCalledWith({
      title: "Updated",
      status: "uncertain",
      databases: ["scopus"],
    });
  });

  it("PATCH /api/records/:id with invalid alternateUrls returns standardized validation error", async () => {
    const app = createApp();

    const response = await request(app).patch("/api/records/1").send({
      alternateUrls: "https://example.com",
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
      },
    });
  });

  it("GET /api/records/:id missing record returns NOT_FOUND", async () => {
    dbMock.Record.findByPk.mockResolvedValue(null);

    const app = createApp();
    const response = await request(app).get("/api/records/999");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        code: "NOT_FOUND",
      },
    });
  });

  it("POST /api/records/enrichment-jobs creates enrichment job", async () => {
    enrichmentMock.createEnrichmentJob.mockReturnValue({
      jobId: "job-1",
      status: "queued",
      total: 2,
      processed: 0,
      createdAt: "2026-03-09T00:00:00.000Z",
      startedAt: null,
      finishedAt: null,
      results: [],
      updatedRecords: [],
    });

    const app = createApp();
    const response = await request(app).post("/api/records/enrichment-jobs").send({ recordIds: [1, 2] });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      jobId: "job-1",
      status: "queued",
      total: 2,
      processed: 0,
    });
  });

  it("GET /api/records/enrichment-jobs/:id returns created job", async () => {
    enrichmentMock.getEnrichmentJob.mockReturnValue({
      jobId: "job-2",
      status: "completed",
      total: 1,
      processed: 1,
      createdAt: "2026-03-09T00:00:00.000Z",
      startedAt: "2026-03-09T00:00:01.000Z",
      finishedAt: "2026-03-09T00:00:02.000Z",
      results: [{ recordId: 1, status: "enriched", doi: "10.1016/x" }],
      updatedRecords: [{ id: 1 }],
    });

    const app = createApp();
    const response = await request(app).get("/api/records/enrichment-jobs/job-2");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jobId: "job-2",
      status: "completed",
      processed: 1,
    });
  });

  it("POST /api/records/enrichment-jobs/:id/cancel cancels job", async () => {
    enrichmentMock.cancelEnrichmentJob.mockReturnValue({
      jobId: "job-3",
      status: "cancelled",
      total: 5,
      processed: 2,
      createdAt: "2026-03-09T00:00:00.000Z",
      startedAt: "2026-03-09T00:00:01.000Z",
      finishedAt: "2026-03-09T00:00:02.000Z",
      results: [],
      updatedRecords: [],
    });

    const app = createApp();
    const response = await request(app).post("/api/records/enrichment-jobs/job-3/cancel").send({});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      jobId: "job-3",
      status: "cancelled",
    });
  });

  it("GET unknown route returns standardized NOT_FOUND error", async () => {
    const app = createApp();

    const response = await request(app).get("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    });
  });

  it("unhandled server errors are wrapped into INTERNAL_ERROR", async () => {
    dbMock.MappingQuestion.count.mockRejectedValue(new Error("db down"));

    const app = createApp();
    const response = await request(app).get("/api/mapping-questions");

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    });
  });
});
