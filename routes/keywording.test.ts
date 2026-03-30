import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/http";

const keywordingMock = vi.hoisted(() => ({
  createKeywordingJob: vi.fn(),
  listKeywordingJobs: vi.fn(),
  getKeywordingJob: vi.fn(),
  cancelKeywordingJob: vi.fn(),
  getKeywordingReport: vi.fn(),
}));

vi.mock("../lib/keywording", () => keywordingMock);

import { cancel, create, get, listing, report } from "./keywording";

const mockResponse = () => {
  const res = {
    send: vi.fn(),
    status: vi.fn(),
    setHeader: vi.fn(),
  } as unknown as Response;

  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
};

describe("routes/keywording", () => {
  beforeEach(() => {
    keywordingMock.createKeywordingJob.mockReset();
    keywordingMock.listKeywordingJobs.mockReset();
    keywordingMock.getKeywordingJob.mockReset();
    keywordingMock.cancelKeywordingJob.mockReset();
    keywordingMock.getKeywordingReport.mockReset();
  });

  it("listing returns count + jobs", async () => {
    keywordingMock.listKeywordingJobs.mockResolvedValue({ count: 1, jobs: [{ jobId: "kw-1" }] });
    const res = mockResponse();

    await listing({} as Request, res);

    expect(res.send).toHaveBeenCalledWith({ count: 1, jobs: [{ jobId: "kw-1" }] });
  });

  it("create validates body and returns accepted snapshot", async () => {
    keywordingMock.createKeywordingJob.mockResolvedValue({ jobId: "kw-1", status: "queued" });
    const req = {
      body: {
        recordIds: [1, 2],
        mappingQuestionIds: [5],
      },
    } as unknown as Request;
    const res = mockResponse();

    await create(req, res);

    expect(keywordingMock.createKeywordingJob).toHaveBeenCalledWith({
      recordIds: [1, 2],
      mappingQuestionIds: [5],
    });
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it("create rejects missing recordIds", async () => {
    const req = { body: { mappingQuestionIds: [5] } } as unknown as Request;
    const res = mockResponse();

    await expect(create(req, res)).rejects.toBeInstanceOf(ApiError);
  });

  it("get/cancel/report forward the job id", async () => {
    keywordingMock.getKeywordingJob.mockResolvedValue({ jobId: "kw-2" });
    keywordingMock.cancelKeywordingJob.mockResolvedValue({ jobId: "kw-2", status: "cancelled" });
    keywordingMock.getKeywordingReport.mockResolvedValue({
      fileName: "report.zip",
      contentType: "application/zip",
      content: Buffer.from("zip"),
    });

    const req = { params: { jobId: "kw-2" } } as unknown as Request;

    const getRes = mockResponse();
    await get(req, getRes);
    expect(getRes.send).toHaveBeenCalledWith({ jobId: "kw-2" });

    const cancelRes = mockResponse();
    await cancel(req, cancelRes);
    expect(cancelRes.send).toHaveBeenCalledWith({ jobId: "kw-2", status: "cancelled" });

    const reportRes = mockResponse();
    await report(req, reportRes);
    expect(reportRes.setHeader).toHaveBeenCalledWith("Content-Type", "application/zip");
    expect(reportRes.send).toHaveBeenCalledWith(Buffer.from("zip"));
  });
});
