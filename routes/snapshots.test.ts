import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  UserProfile: {
    findByPk: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
  Record: {
    findAll: vi.fn(),
  },
  MappingOption: {
    findAll: vi.fn(),
  },
  RecordAssessment: {
    findAll: vi.fn(),
    findOne: vi.fn(),
    findByPk: vi.fn(),
    findOrCreate: vi.fn(),
  },
  RecordAssessmentOption: {
    destroy: vi.fn(),
    bulkCreate: vi.fn(),
  },
}));

const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("../models", () => ({ default: dbMock }));
vi.mock("node:fs", () => ({ default: fsMock }));

import {
  exportUserSnapshot,
  importUserSnapshot,
  pendingSnapshotUploads,
  saveUserSnapshot,
  uploadSnapshotFiles,
} from "./snapshots";

const mockResponse = () => {
  const res = {
    send: vi.fn(),
    status: vi.fn(),
  } as unknown as Response;
  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
};

describe("routes/snapshots", () => {
  beforeEach(() => {
    dbMock.UserProfile.findByPk.mockReset();
    dbMock.UserProfile.findOne.mockReset();
    dbMock.UserProfile.create.mockReset();
    dbMock.Record.findAll.mockReset();
    dbMock.MappingOption.findAll.mockReset();
    dbMock.RecordAssessment.findAll.mockReset();
    dbMock.RecordAssessment.findOne.mockReset();
    dbMock.RecordAssessment.findByPk.mockReset();
    dbMock.RecordAssessment.findOrCreate.mockReset();
    dbMock.RecordAssessmentOption.destroy.mockReset();
    dbMock.RecordAssessmentOption.bulkCreate.mockReset();
    fsMock.existsSync.mockReset();
    fsMock.readdirSync.mockReset();
    fsMock.readFileSync.mockReset();
    fsMock.writeFileSync.mockReset();
    fsMock.mkdirSync.mockReset();
  });

  it("exportUserSnapshot returns deterministic snapshot body", async () => {
    dbMock.UserProfile.findByPk.mockResolvedValue({ id: 5, name: "Alice" });
    dbMock.RecordAssessment.findAll.mockResolvedValue([
      {
        recordId: 2,
        userId: 5,
        status: "included",
        comment: "ok",
        updatedAt: "2026-01-01T00:00:00.000Z",
        AssessmentMappingOptions: [{ id: 9 }, { id: 2 }],
      },
    ]);

    const req = {
      query: { userId: "5" },
    } as unknown as Request;
    const res = mockResponse();
    await exportUserSnapshot(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        user: { id: 5, name: "Alice" },
        assessments: [
          expect.objectContaining({
            recordId: 2,
            userId: 5,
            mappingOptionIds: [2, 9],
          }),
        ],
      }),
    );
  });

  it("importUserSnapshot creates assessments and mapping links", async () => {
    dbMock.UserProfile.findByPk.mockResolvedValue({ id: 3, name: "Bob", update: vi.fn() });
    dbMock.Record.findAll.mockResolvedValue([{ id: 10 }]);
    dbMock.MappingOption.findAll.mockResolvedValue([{ id: 2 }, { id: 4 }]);
    dbMock.RecordAssessment.findAll.mockResolvedValue([]);

    const assessment = { id: 90, update: vi.fn() };
    dbMock.RecordAssessment.findOrCreate.mockResolvedValue([assessment, true]);
    dbMock.RecordAssessment.findByPk.mockResolvedValue({
      id: 90,
      recordId: 10,
      userId: 3,
      status: "included",
      comment: "Keep",
      AssessmentMappingOptions: [],
    });

    const req = {
      body: {
        version: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        user: { id: 3, name: "Bob" },
        assessments: [
          {
            recordId: 10,
            userId: 3,
            status: "included",
            comment: "Keep",
            mappingOptionIds: [2, 4],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    } as unknown as Request;
    const res = mockResponse();

    await importUserSnapshot(req, res);

    expect(dbMock.RecordAssessmentOption.bulkCreate).toHaveBeenCalledWith([
      { recordAssessmentId: 90, mappingOptionId: 2 },
      { recordAssessmentId: 90, mappingOptionId: 4 },
    ]);
    expect(res.send).toHaveBeenCalledWith({
      total: 1,
      created: 1,
      updated: 0,
      skipped: 0,
      userId: 3,
    });
  });

  it("saveUserSnapshot writes deterministic file when content changed", async () => {
    dbMock.UserProfile.findByPk.mockResolvedValue({ id: 5, name: "Alice" });
    dbMock.RecordAssessment.findAll.mockResolvedValue([
      {
        recordId: 2,
        userId: 5,
        status: "included",
        comment: "ok",
        updatedAt: "2026-01-01T00:00:00.000Z",
        AssessmentMappingOptions: [{ id: 9 }, { id: 2 }],
      },
    ]);
    fsMock.existsSync.mockReturnValue(false);
    fsMock.readdirSync.mockReturnValue([]);

    const req = {
      body: { userId: 5 },
    } as unknown as Request;
    const res = mockResponse();
    await saveUserSnapshot(req, res);

    expect(fsMock.mkdirSync).toHaveBeenCalled();
    expect(fsMock.writeFileSync).toHaveBeenCalledTimes(1);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 5,
        path: "snapshots/user-5.json",
        changed: true,
      }),
    );
  });

  it("saveUserSnapshot skips write when file content has not changed", async () => {
    dbMock.UserProfile.findByPk.mockResolvedValue({ id: 5, name: "Alice" });
    dbMock.RecordAssessment.findAll.mockResolvedValue([]);
    fsMock.existsSync.mockReturnValue(true);
    fsMock.readdirSync.mockReturnValue([]);
    fsMock.readFileSync.mockReturnValue(
      "{\n  \"version\": 1,\n  \"user\": {\n    \"id\": 5,\n    \"name\": \"Alice\"\n  },\n  \"assessments\": []\n}\n",
    );

    const req = {
      body: { userId: 5 },
    } as unknown as Request;
    const res = mockResponse();
    await saveUserSnapshot(req, res);

    expect(fsMock.writeFileSync).not.toHaveBeenCalled();
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 5,
        path: "snapshots/user-5.json",
        changed: false,
      }),
    );
  });

  it("pendingSnapshotUploads reports pending snapshot imports", async () => {
    dbMock.UserProfile.findByPk.mockImplementation(async (id: number) => {
      if (id === 2) {
        return { id: 2, name: "Bob", update: vi.fn() };
      }
      return null;
    });
    dbMock.UserProfile.findOne.mockResolvedValue({ id: 2, name: "Bob", update: vi.fn() });
    dbMock.RecordAssessment.findAll.mockResolvedValue([]);
    dbMock.Record.findAll.mockResolvedValue([{ id: 10 }]);
    dbMock.MappingOption.findAll.mockResolvedValue([{ id: 2 }]);
    fsMock.readdirSync.mockReturnValue([{ isFile: () => true, name: "user-2.json" }]);
    fsMock.readFileSync.mockReturnValue(
      JSON.stringify({
        version: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        user: { id: 2, name: "Bob" },
        assessments: [
          {
            recordId: 10,
            userId: 2,
            status: "included",
            comment: "Keep",
            mappingOptionIds: [2],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    const req = {} as unknown as Request;
    const res = mockResponse();
    await pendingSnapshotUploads(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingSnapshots: 1,
        items: expect.arrayContaining([
          expect.objectContaining({
            userId: 2,
            total: 1,
            created: 1,
            updated: 0,
          }),
        ]),
      }),
    );
  });

  it("uploadSnapshotFiles imports all snapshot files", async () => {
    dbMock.UserProfile.findByPk.mockResolvedValue({ id: 2, name: "Bob", update: vi.fn() });
    dbMock.Record.findAll.mockResolvedValue([{ id: 10 }]);
    dbMock.MappingOption.findAll.mockResolvedValue([{ id: 2 }]);
    dbMock.RecordAssessment.findAll.mockResolvedValue([]);
    const assessment = { id: 90, update: vi.fn() };
    dbMock.RecordAssessment.findOrCreate.mockResolvedValue([assessment, true]);
    fsMock.readdirSync.mockReturnValue([{ isFile: () => true, name: "user-2.json" }]);
    fsMock.readFileSync.mockReturnValue(
      JSON.stringify({
        version: 1,
        exportedAt: "2026-01-01T00:00:00.000Z",
        user: { id: 2, name: "Bob" },
        assessments: [
          {
            recordId: 10,
            userId: 2,
            status: "included",
            comment: "Keep",
            mappingOptionIds: [2],
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    );

    const req = {} as unknown as Request;
    const res = mockResponse();
    await uploadSnapshotFiles(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        importedSnapshots: 1,
        created: 1,
        updated: 0,
        errors: [],
      }),
    );
  });
});
