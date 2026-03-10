import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/http";

const dbMock = vi.hoisted(() => ({
  Forum: {
    findAll: vi.fn(),
    destroy: vi.fn(),
  },
  Record: {
    findAll: vi.fn(),
    update: vi.fn(),
  },
  Sequelize: {
    fn: vi.fn((name: string, ...args: unknown[]) => ({ fn: name, args })),
    col: vi.fn((name: string) => ({ col: name })),
  },
  sequelize: {
    transaction: vi.fn(async (handler: (transaction: Record<string, unknown>) => Promise<void>) =>
      handler({ tx: true })),
  },
}));

vi.mock("../models", () => ({ default: dbMock }));

import { listDuplicates, mergeForums } from "./forums";

const mockResponse = () => {
  const res = {
    send: vi.fn(),
    status: vi.fn(),
  } as unknown as Response;

  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
};

describe("routes/forums", () => {
  beforeEach(() => {
    dbMock.Forum.findAll.mockReset();
    dbMock.Forum.destroy.mockReset();
    dbMock.Record.findAll.mockReset();
    dbMock.Record.update.mockReset();
    dbMock.sequelize.transaction.mockClear();
  });

  it("listDuplicates returns grouped duplicates by normalized name/issn", async () => {
    dbMock.Forum.findAll.mockResolvedValue([
      {
        id: 1,
        name: "Computers in Human Behavior",
        alternateNames: ["Comp. in Human Behavior"],
        issn: "0747-5632",
        publisher: "Elsevier",
        jufoLevel: 3,
      },
      {
        id: 2,
        name: "computers in  human behavior",
        alternateNames: [],
        issn: "0747-5632",
        publisher: "Elsevier",
        jufoLevel: 3,
      },
      {
        id: 3,
        name: "Other Forum",
        alternateNames: [],
        issn: "1234-5678",
        publisher: null,
        jufoLevel: null,
      },
    ]);
    dbMock.Record.findAll.mockResolvedValue([
      { forumId: 1, recordCount: 12 },
      { forumId: 2, recordCount: 9 },
      { forumId: 3, recordCount: 1 },
    ]);

    const req = {
      query: { offset: "0", limit: "25" },
    } as unknown as Request;
    const res = mockResponse();

    await listDuplicates(req, res);

    expect(dbMock.Forum.findAll).toHaveBeenCalledTimes(1);
    const payload = (res.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      count: number;
      groups: Array<{ forums: Array<{ id: number; recordCount: number }> }>;
    };
    expect(payload.count).toBeGreaterThan(0);
    expect(payload.groups.some((group) => group.forums.some((forum) => forum.id === 1))).toBe(true);
    expect(payload.groups.some((group) => group.forums.some((forum) => forum.id === 2))).toBe(true);
  });

  it("mergeForums supports dryRun mode", async () => {
    const targetUpdate = vi.fn();
    dbMock.Forum.findAll.mockResolvedValue([
      {
        id: 10,
        name: "Target",
        alternateNames: ["Target Alias"],
        issn: null,
        publisher: null,
        jufoLevel: null,
        jufoId: null,
        enrichmentProvenance: null,
        update: targetUpdate,
      },
      {
        id: 11,
        name: "Source A",
        alternateNames: ["A"],
        issn: "1111-1111",
        publisher: "P1",
        jufoLevel: 2,
        jufoId: 22,
        enrichmentProvenance: { name: { provider: "crossref" } },
      },
    ]);
    dbMock.Record.findAll.mockResolvedValue([{ id: 101 }, { id: 102 }]);

    const req = {
      body: {
        targetForumId: 10,
        sourceForumIds: [11],
        dryRun: true,
      },
    } as unknown as Request;
    const res = mockResponse();

    await mergeForums(req, res);

    expect(targetUpdate).not.toHaveBeenCalled();
    expect(dbMock.Record.update).not.toHaveBeenCalled();
    expect(dbMock.Forum.destroy).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
        targetForumId: 10,
        sourceForumIds: [11],
        movedRecordCount: 2,
      }),
    );
  });

  it("mergeForums applies updates transactionally when dryRun=false", async () => {
    const targetUpdate = vi.fn().mockResolvedValue(undefined);
    dbMock.Forum.findAll.mockResolvedValue([
      {
        id: 10,
        name: "Target",
        alternateNames: [],
        issn: null,
        publisher: null,
        jufoLevel: null,
        jufoId: null,
        enrichmentProvenance: null,
        update: targetUpdate,
      },
      {
        id: 11,
        name: "Source A",
        alternateNames: ["Alias A"],
        issn: "1111-1111",
        publisher: "P1",
        jufoLevel: 2,
        jufoId: 22,
        enrichmentProvenance: null,
      },
    ]);
    dbMock.Record.findAll.mockResolvedValue([{ id: 401 }]);
    dbMock.Record.update.mockResolvedValue([1]);
    dbMock.Forum.destroy.mockResolvedValue(1);

    const req = {
      body: {
        targetForumId: 10,
        sourceForumIds: [11],
        dryRun: false,
      },
    } as unknown as Request;
    const res = mockResponse();

    await mergeForums(req, res);

    expect(dbMock.sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(dbMock.Record.update).toHaveBeenCalledTimes(1);
    expect(dbMock.Forum.destroy).toHaveBeenCalledTimes(1);
    expect(targetUpdate).toHaveBeenCalledTimes(1);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: false,
        movedRecordCount: 1,
        updatedRecordIds: [401],
      }),
    );
  });

  it("mergeForums rejects source containing target id", async () => {
    const req = {
      body: {
        targetForumId: 10,
        sourceForumIds: [10, 11],
      },
    } as unknown as Request;
    const res = mockResponse();

    await expect(mergeForums(req, res)).rejects.toBeInstanceOf(ApiError);
  });
});
