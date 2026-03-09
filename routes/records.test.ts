import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/http";

const dbMock = vi.hoisted(() => ({
  Sequelize: {
    Op: {
      or: Symbol("or"),
      substring: Symbol("substring"),
    },
  },
  Record: {
    count: vi.fn(),
    findAll: vi.fn(),
    findByPk: vi.fn(),
  },
  MappingOption: {
    findByPk: vi.fn(),
  },
  RecordMappingOption: {
    create: vi.fn(),
    destroy: vi.fn(),
  },
}));

vi.mock("../models", () => ({ default: dbMock }));

const enrichmentMock = vi.hoisted(() => ({
  createEnrichmentJob: vi.fn(),
  getEnrichmentJob: vi.fn(),
  cancelEnrichmentJob: vi.fn(),
}));

vi.mock("../lib/recordEnrichment", () => enrichmentMock);

import {
  cancelEnrichment,
  createEnrichment,
  createOption,
  getEnrichment,
  listing,
  removeOption,
  update,
} from "./records";
import { patch } from "./records";

const mockResponse = () => {
  const res = {
    send: vi.fn(),
    status: vi.fn(),
  } as unknown as Response;

  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
};

describe("routes/records", () => {
  beforeEach(() => {
    dbMock.Record.count.mockReset();
    dbMock.Record.findAll.mockReset();
    dbMock.Record.findByPk.mockReset();
    dbMock.MappingOption.findByPk.mockReset();
    dbMock.RecordMappingOption.create.mockReset();
    dbMock.RecordMappingOption.destroy.mockReset();
    enrichmentMock.createEnrichmentJob.mockReset();
    enrichmentMock.getEnrichmentJob.mockReset();
    enrichmentMock.cancelEnrichmentJob.mockReset();
  });

  it("listing returns count + records with applied filters", async () => {
    dbMock.Record.count.mockResolvedValue(2);
    dbMock.Record.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const req = {
      query: { offset: "5", limit: "10", status: "null", search: "programming" },
    } as unknown as Request;
    const res = mockResponse();

    await listing(req, res);

    expect(dbMock.Record.count).toHaveBeenCalledTimes(1);
    const where = dbMock.Record.count.mock.calls[0]?.[0]?.where as Record<PropertyKey, unknown>;
    expect(where.status).toBeNull();
    const symbolKeys = Object.getOwnPropertySymbols(where);
    expect(symbolKeys.length).toBe(1);
    expect((where[symbolKeys[0] as symbol] as unknown[]).length).toBe(4);

    expect(dbMock.Record.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 5, limit: 10, include: ["Forum", "MappingOptions"] }),
    );
    expect(res.send).toHaveBeenCalledWith({ count: 2, records: [{ id: 1 }, { id: 2 }] });
  });

  it("update rejects invalid status", async () => {
    const req = {
      params: { id: "1" },
      body: { status: "bad-status" },
    } as unknown as Request;
    const res = mockResponse();

    await expect(update(req, res)).rejects.toBeInstanceOf(ApiError);
    expect(dbMock.Record.findByPk).not.toHaveBeenCalled();
  });

  it("update writes allowed fields and returns updated record", async () => {
    const record = { update: vi.fn().mockResolvedValue(undefined), id: 1 };
    dbMock.Record.findByPk.mockResolvedValue(record);

    const req = {
      params: { id: "1" },
      body: { status: "included", comment: "ok", editedBy: "mk" },
    } as unknown as Request;
    const res = mockResponse();

    await update(req, res);

    expect(dbMock.Record.findByPk).toHaveBeenCalledWith(1, { include: ["Forum", "MappingOptions"] });
    expect(record.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "included", comment: "ok", editedBy: "mk" }),
    );
    expect(res.send).toHaveBeenCalledWith(record);
  });

  it("createOption links option to record and returns option", async () => {
    dbMock.RecordMappingOption.create.mockResolvedValue({});
    dbMock.MappingOption.findByPk.mockResolvedValue({ id: 55, title: "Tag" });

    const req = {
      params: { recordId: "42" },
      body: { mappingOptionId: "55", mappingQuestionId: "9" },
    } as unknown as Request;
    const res = mockResponse();

    await createOption(req, res);

    expect(dbMock.RecordMappingOption.create).toHaveBeenCalledWith({
      recordId: 42,
      mappingQuestionId: 9,
      mappingOptionId: 55,
    });
    expect(dbMock.MappingOption.findByPk).toHaveBeenCalledWith(55);
    expect(res.send).toHaveBeenCalledWith({ id: 55, title: "Tag" });
  });

  it("removeOption deletes relation and returns success message", async () => {
    dbMock.RecordMappingOption.destroy.mockResolvedValue(1);

    const req = {
      params: { mappingOptionId: "12", recordId: "3" },
    } as unknown as Request;
    const res = mockResponse();

    await removeOption(req, res);

    expect(dbMock.RecordMappingOption.destroy).toHaveBeenCalledWith({
      where: { mappingOptionId: 12, recordId: 3 },
    });
    expect(res.send).toHaveBeenCalledWith("12 deleted successfully");
  });

  it("patch updates partial record fields including arrays", async () => {
    const record = { update: vi.fn().mockResolvedValue(undefined), id: 1 };
    dbMock.Record.findByPk.mockResolvedValue(record);

    const req = {
      params: { id: "1" },
      body: {
        title: "Updated title",
        status: "uncertain",
        databases: ["scopus", "wos"],
        alternateUrls: ["https://example.com/a"],
      },
    } as unknown as Request;
    const res = mockResponse();

    await patch(req, res);

    expect(dbMock.Record.findByPk).toHaveBeenCalledWith(1, { include: ["Forum", "MappingOptions"] });
    expect(record.update).toHaveBeenCalledWith({
      title: "Updated title",
      status: "uncertain",
      databases: ["scopus", "wos"],
      alternateUrls: ["https://example.com/a"],
    });
    expect(res.send).toHaveBeenCalledWith(record);
  });

  it("patch rejects unsupported keys", async () => {
    const req = {
      params: { id: "1" },
      body: { invalidField: "x" },
    } as unknown as Request;
    const res = mockResponse();

    await expect(patch(req, res)).rejects.toBeInstanceOf(ApiError);
    expect(dbMock.Record.findByPk).not.toHaveBeenCalled();
  });

  it("patch rejects removed description field", async () => {
    const req = {
      params: { id: "1" },
      body: { description: "legacy value" },
    } as unknown as Request;
    const res = mockResponse();

    await expect(patch(req, res)).rejects.toBeInstanceOf(ApiError);
    expect(dbMock.Record.findByPk).not.toHaveBeenCalled();
  });

  it("patch returns not found when record does not exist", async () => {
    dbMock.Record.findByPk.mockResolvedValue(null);

    const req = {
      params: { id: "999" },
      body: { title: "A" },
    } as unknown as Request;
    const res = mockResponse();

    await expect(patch(req, res)).rejects.toBeInstanceOf(ApiError);
  });

  it("createEnrichment accepts record id list and returns created job", async () => {
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

    const req = {
      body: { recordIds: [1, 2], provider: "openalex", maxCitations: 20, forceRefresh: true },
    } as unknown as Request;
    const res = mockResponse();

    await createEnrichment(req, res);

    expect(enrichmentMock.createEnrichmentJob).toHaveBeenCalledWith([1, 2], {
      provider: "openalex",
      maxCitations: 20,
      forceRefresh: true,
    });
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        status: "queued",
      }),
    );
  });

  it("createEnrichment rejects empty record id list", async () => {
    const req = {
      body: { recordIds: [] },
    } as unknown as Request;
    const res = mockResponse();

    await expect(createEnrichment(req, res)).rejects.toBeInstanceOf(ApiError);
    expect(enrichmentMock.createEnrichmentJob).not.toHaveBeenCalled();
  });

  it("createEnrichment rejects unsupported provider", async () => {
    const req = {
      body: { recordIds: [1], provider: "bad-provider" },
    } as unknown as Request;
    const res = mockResponse();

    await expect(createEnrichment(req, res)).rejects.toBeInstanceOf(ApiError);
    expect(enrichmentMock.createEnrichmentJob).not.toHaveBeenCalled();
  });

  it("getEnrichment returns existing job", async () => {
    enrichmentMock.getEnrichmentJob.mockReturnValue({
      jobId: "job-2",
      status: "completed",
      total: 1,
      processed: 1,
      createdAt: "2026-03-09T00:00:00.000Z",
      startedAt: "2026-03-09T00:00:01.000Z",
      finishedAt: "2026-03-09T00:00:02.000Z",
      results: [{ recordId: 1, status: "enriched", doi: "10.1/abc" }],
      updatedRecords: [{ id: 1 }],
    });

    const req = {
      params: { jobId: "job-2" },
    } as unknown as Request;
    const res = mockResponse();

    await getEnrichment(req, res);

    expect(enrichmentMock.getEnrichmentJob).toHaveBeenCalledWith("job-2");
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-2",
      }),
    );
  });

  it("getEnrichment returns NOT_FOUND when job is missing", async () => {
    enrichmentMock.getEnrichmentJob.mockReturnValue(null);
    const req = {
      params: { jobId: "missing" },
    } as unknown as Request;
    const res = mockResponse();

    await expect(getEnrichment(req, res)).rejects.toBeInstanceOf(ApiError);
  });

  it("cancelEnrichment cancels running job", async () => {
    enrichmentMock.cancelEnrichmentJob.mockReturnValue({
      jobId: "job-3",
      status: "cancelled",
      total: 10,
      processed: 4,
      createdAt: "2026-03-09T00:00:00.000Z",
      startedAt: "2026-03-09T00:00:01.000Z",
      finishedAt: "2026-03-09T00:00:02.000Z",
      results: [],
      updatedRecords: [],
    });
    const req = {
      params: { jobId: "job-3" },
    } as unknown as Request;
    const res = mockResponse();

    await cancelEnrichment(req, res);

    expect(enrichmentMock.cancelEnrichmentJob).toHaveBeenCalledWith("job-3");
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-3",
        status: "cancelled",
      }),
    );
  });
});
