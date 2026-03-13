import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  UserProfile: {
    findByPk: vi.fn(),
    findAll: vi.fn(),
  },
  Record: {
    findByPk: vi.fn(),
    findAll: vi.fn(),
  },
  MappingOption: {
    findAll: vi.fn(),
  },
  MappingQuestion: {
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
  RecordMappingOption: {
    destroy: vi.fn(),
    bulkCreate: vi.fn(),
  },
}));

vi.mock("../models", () => ({ default: dbMock }));

import { compare, upsert } from "./assessments";

const mockResponse = () => {
  const res = {
    send: vi.fn(),
    status: vi.fn(),
  } as unknown as Response;
  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
};

describe("routes/assessments", () => {
  beforeEach(() => {
    dbMock.UserProfile.findByPk.mockReset();
    dbMock.UserProfile.findAll.mockReset();
    dbMock.Record.findByPk.mockReset();
    dbMock.Record.findAll.mockReset();
    dbMock.MappingOption.findAll.mockReset();
    dbMock.MappingQuestion.findAll.mockReset();
    dbMock.RecordAssessment.findAll.mockReset();
    dbMock.RecordAssessment.findOne.mockReset();
    dbMock.RecordAssessment.findByPk.mockReset();
    dbMock.RecordAssessment.findOrCreate.mockReset();
    dbMock.RecordAssessmentOption.destroy.mockReset();
    dbMock.RecordAssessmentOption.bulkCreate.mockReset();
    dbMock.RecordMappingOption.destroy.mockReset();
    dbMock.RecordMappingOption.bulkCreate.mockReset();
  });

  it("compare returns pairwise metrics (with CI) and ignores comment-only disagreements", async () => {
    dbMock.UserProfile.findAll.mockResolvedValue([
      { id: 1, name: "Alice", isActive: true },
      { id: 2, name: "Bob", isActive: true },
    ]);
    dbMock.RecordAssessment.findAll.mockResolvedValue([
      {
        recordId: 10,
        userId: 1,
        status: "included",
        comment: "yes",
        updatedAt: "2026-01-01T00:00:00.000Z",
        AssessmentMappingOptions: [{ id: 2, mappingQuestionId: 1 }],
      },
      {
        recordId: 10,
        userId: 2,
        status: "excluded",
        comment: "no",
        updatedAt: "2026-01-01T00:00:00.000Z",
        AssessmentMappingOptions: [{ id: 3, mappingQuestionId: 1 }],
      },
      {
        recordId: 11,
        userId: 1,
        status: "included",
        comment: "note from alice",
        updatedAt: "2026-01-01T00:00:00.000Z",
        AssessmentMappingOptions: [{ id: 2, mappingQuestionId: 1 }],
      },
      {
        recordId: 11,
        userId: 2,
        status: "included",
        comment: "note from bob",
        updatedAt: "2026-01-01T00:00:00.000Z",
        AssessmentMappingOptions: [{ id: 2, mappingQuestionId: 1 }],
      },
    ]);
    dbMock.MappingQuestion.findAll.mockResolvedValue([
      { id: 1, title: "Domain", position: 1 },
    ]);

    const req = {
      body: { userIds: [1, 2] },
    } as unknown as Request;
    const res = mockResponse();

    await compare(req, res);

    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        users: expect.arrayContaining([expect.objectContaining({ id: 1 }), expect.objectContaining({ id: 2 })]),
        pairwise: expect.arrayContaining([
          expect.objectContaining({
            userIdA: 1,
            userIdB: 2,
            metricType: "status",
            sharedCount: 2,
            kappaCi95Lower: expect.any(Number),
            kappaCi95Upper: expect.any(Number),
          }),
          expect.objectContaining({
            userIdA: 1,
            userIdB: 2,
            metricType: "mapping_question",
            mappingQuestionId: 1,
          }),
          expect.objectContaining({
            userIdA: 1,
            userIdB: 2,
            metricType: "mapping_all",
          }),
          expect.objectContaining({
            userIdA: 1,
            userIdB: 2,
            metricType: "status_mapping_all",
          }),
        ]),
        disagreements: expect.arrayContaining([expect.objectContaining({ recordId: 10 })]),
      }),
    );
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        disagreements: expect.not.arrayContaining([expect.objectContaining({ recordId: 11 })]),
      }),
    );
  });

  it("upsert creates assessment and writes mapping links", async () => {
    dbMock.UserProfile.findByPk.mockResolvedValue({ id: 1, name: "Alice", isActive: true });
    dbMock.Record.findByPk.mockResolvedValue({ id: 15 });
    dbMock.MappingOption.findAll.mockResolvedValue([
      { id: 2, mappingQuestionId: 1 },
      { id: 4, mappingQuestionId: 2 },
    ]);

    const assessmentModel = { id: 88, update: vi.fn() };
    dbMock.RecordAssessment.findOrCreate.mockResolvedValue([assessmentModel, true]);
    dbMock.RecordAssessment.findByPk.mockResolvedValue({
      id: 88,
      recordId: 15,
      userId: 1,
      status: "included",
      comment: "keep",
      updatedAt: "2026-01-01T00:00:00.000Z",
      AssessmentMappingOptions: [{ id: 2 }, { id: 4 }],
    });

    const req = {
      params: { recordId: "15" },
      body: {
        userId: 1,
        status: "included",
        comment: "keep",
        mappingOptionIds: [2, 4],
      },
    } as unknown as Request;
    const res = mockResponse();

    await upsert(req, res);

    expect(dbMock.RecordAssessment.findOrCreate).toHaveBeenCalledWith({
      where: { recordId: 15, userId: 1 },
      defaults: { status: "included", comment: "keep" },
    });
    expect(dbMock.RecordAssessmentOption.destroy).toHaveBeenCalledWith({ where: { recordAssessmentId: 88 } });
    expect(dbMock.RecordAssessmentOption.bulkCreate).toHaveBeenCalledWith([
      { recordAssessmentId: 88, mappingOptionId: 2 },
      { recordAssessmentId: 88, mappingOptionId: 4 },
    ]);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        assessment: expect.objectContaining({
          recordId: 15,
          userId: 1,
          mappingOptionIds: [2, 4],
        }),
      }),
    );
  });
});
