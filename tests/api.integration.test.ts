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
  },
}));

vi.mock("../models", () => ({
  default: dbMock,
}));

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
