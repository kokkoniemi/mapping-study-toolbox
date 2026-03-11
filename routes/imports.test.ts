import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/http";

const pipelineMock = vi.hoisted(() => ({
  previewImportData: vi.fn(),
  createImportData: vi.fn(),
  listImports: vi.fn(),
  deleteImportWithRecords: vi.fn(),
}));

vi.mock("../lib/importPipeline", () => pipelineMock);

import { create, listing, preview, remove } from "./imports";

const mockResponse = () => {
  const res = {
    send: vi.fn(),
    status: vi.fn(),
  } as unknown as Response;

  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
};

describe("routes/imports", () => {
  beforeEach(() => {
    pipelineMock.previewImportData.mockReset();
    pipelineMock.createImportData.mockReset();
    pipelineMock.listImports.mockReset();
    pipelineMock.deleteImportWithRecords.mockReset();
  });

  it("preview validates and forwards payload", async () => {
    pipelineMock.previewImportData.mockResolvedValue({ total: 2 });

    const req = {
      body: { fileName: "items.csv", content: "title\nA", source: "scopus" },
    } as unknown as Request;
    const res = mockResponse();

    await preview(req, res);

    expect(pipelineMock.previewImportData).toHaveBeenCalledWith({
      fileName: "items.csv",
      content: "title\nA",
      source: "scopus",
      databaseName: undefined,
      csvMapping: undefined,
    });
    expect(res.send).toHaveBeenCalledWith({ total: 2 });
  });

  it("create returns 201 and result", async () => {
    pipelineMock.createImportData.mockResolvedValue({
      import: { id: 9 },
      summary: { total: 1 },
      createdRecordIds: [100],
    });

    const req = {
      body: { fileName: "items.bib", content: "@article{a,title={A}}" },
    } as unknown as Request;
    const res = mockResponse();

    await create(req, res);

    expect(pipelineMock.createImportData).toHaveBeenCalledWith({
      fileName: "items.bib",
      content: "@article{a,title={A}}",
      source: "auto",
      databaseName: undefined,
      csvMapping: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.send).toHaveBeenCalledWith({
      import: { id: 9 },
      summary: { total: 1 },
      createdRecordIds: [100],
    });
  });

  it("listing parses pagination", async () => {
    pipelineMock.listImports.mockResolvedValue({ count: 0, imports: [] });
    const req = {
      query: { offset: "5", limit: "30" },
    } as unknown as Request;
    const res = mockResponse();

    await listing(req, res);

    expect(pipelineMock.listImports).toHaveBeenCalledWith(5, 30);
    expect(res.send).toHaveBeenCalledWith({ count: 0, imports: [] });
  });

  it("remove parses id and deletes import", async () => {
    pipelineMock.deleteImportWithRecords.mockResolvedValue({ importId: 1, deletedImport: true, deletedRecords: 7 });
    const req = {
      params: { id: "1" },
    } as unknown as Request;
    const res = mockResponse();

    await remove(req, res);

    expect(pipelineMock.deleteImportWithRecords).toHaveBeenCalledWith(1);
    expect(res.send).toHaveBeenCalledWith({ importId: 1, deletedImport: true, deletedRecords: 7 });
  });

  it("preview rejects unsupported source", async () => {
    const req = {
      body: { fileName: "x.csv", content: "a,b", source: "bad-source" },
    } as unknown as Request;
    const res = mockResponse();

    await expect(preview(req, res)).rejects.toBeInstanceOf(ApiError);
    expect(pipelineMock.previewImportData).not.toHaveBeenCalled();
  });

  it("preview forwards csvMapping", async () => {
    pipelineMock.previewImportData.mockResolvedValue({ total: 1 });

    const req = {
      body: {
        fileName: "items.csv",
        content: "AA,ID\nAlice,10.1000/example",
        source: "auto",
        csvMapping: {
          author: "AA",
          doi: "ID",
          title: null,
        },
      },
    } as unknown as Request;
    const res = mockResponse();

    await preview(req, res);

    expect(pipelineMock.previewImportData).toHaveBeenCalledWith({
      fileName: "items.csv",
      content: "AA,ID\nAlice,10.1000/example",
      source: "auto",
      databaseName: undefined,
      csvMapping: {
        author: "AA",
        doi: "ID",
        title: null,
      },
    });
  });

  it("preview rejects other-csv source without databaseName", async () => {
    const req = {
      body: {
        fileName: "generic.csv",
        content: "AA,ID\nA,10.1000/x",
        source: "other-csv",
      },
    } as unknown as Request;
    const res = mockResponse();

    await expect(preview(req, res)).rejects.toBeInstanceOf(ApiError);
    expect(pipelineMock.previewImportData).not.toHaveBeenCalled();
  });

  it("preview accepts other-csv source with databaseName", async () => {
    pipelineMock.previewImportData.mockResolvedValue({ total: 1 });

    const req = {
      body: {
        fileName: "generic.csv",
        content: "AA,ID\nA,10.1000/x",
        source: "other-csv",
        databaseName: "IEEE_XPLORE",
      },
    } as unknown as Request;
    const res = mockResponse();

    await preview(req, res);

    expect(pipelineMock.previewImportData).toHaveBeenCalledWith({
      fileName: "generic.csv",
      content: "AA,ID\nA,10.1000/x",
      source: "other-csv",
      databaseName: "IEEE_XPLORE",
      csvMapping: undefined,
    });
  });

  it("preview rejects unsupported csvMapping keys", async () => {
    const req = {
      body: {
        fileName: "x.csv",
        content: "a,b",
        csvMapping: {
          unknownField: "a",
        },
      },
    } as unknown as Request;
    const res = mockResponse();

    await expect(preview(req, res)).rejects.toBeInstanceOf(ApiError);
    expect(pipelineMock.previewImportData).not.toHaveBeenCalled();
  });
});
