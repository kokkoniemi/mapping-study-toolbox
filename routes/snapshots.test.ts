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
    findByPk: vi.fn(),
    findOrCreate: vi.fn(),
  },
  RecordAssessmentOption: {
    destroy: vi.fn(),
    bulkCreate: vi.fn(),
  },
}));

vi.mock("../models", () => ({ default: dbMock }));

import { exportUserSnapshot, importUserSnapshot } from "./snapshots";

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
    dbMock.RecordAssessment.findByPk.mockReset();
    dbMock.RecordAssessment.findOrCreate.mockReset();
    dbMock.RecordAssessmentOption.destroy.mockReset();
    dbMock.RecordAssessmentOption.bulkCreate.mockReset();
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
});
