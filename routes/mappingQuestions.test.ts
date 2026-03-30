import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/http";

const dbMock = vi.hoisted(() => ({
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
}));

vi.mock("../models", () => ({ default: dbMock }));

import {
  create,
  createOption,
  listing,
  removeOption,
  updateOption,
} from "./mappingQuestions";

const mockResponse = () => {
  const res = {
    send: vi.fn(),
    status: vi.fn(),
  } as unknown as Response;

  (res.status as unknown as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
};

describe("routes/mappingQuestions", () => {
  beforeEach(() => {
    dbMock.MappingQuestion.count.mockReset();
    dbMock.MappingQuestion.create.mockReset();
    dbMock.MappingQuestion.findAll.mockReset();
    dbMock.MappingQuestion.findByPk.mockReset();

    dbMock.MappingOption.count.mockReset();
    dbMock.MappingOption.create.mockReset();
    dbMock.MappingOption.findAll.mockReset();
    dbMock.MappingOption.findByPk.mockReset();
  });

  it("listing returns ordered mapping questions", async () => {
    dbMock.MappingQuestion.count.mockResolvedValue(1);
    dbMock.MappingQuestion.findAll.mockResolvedValue([{ id: 1, title: "Q1" }]);

    const req = {} as Request;
    const res = mockResponse();

    await listing(req, res);

    expect(dbMock.MappingQuestion.count).toHaveBeenCalledTimes(1);
    expect(dbMock.MappingQuestion.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ include: dbMock.MappingOption }),
    );
    expect(res.send).toHaveBeenCalledWith({ count: 1, questions: [{ id: 1, title: "Q1" }] });
  });

  it("create persists mapping question", async () => {
    dbMock.MappingQuestion.create.mockResolvedValue({ id: 2, title: "Quality" });

    const req = {
      body: {
        title: "Quality",
        type: "multiSelect",
        position: 0,
        description: "Longer guidance",
        decisionGuidance: "Only code explicit evidence.",
        positiveExamples: ["Collaborative learning intervention"],
        negativeExamples: ["A passing mention in related work"],
        evidenceInstructions: "Quote the exact page excerpt.",
        allowNewOption: true,
      },
    } as unknown as Request;
    const res = mockResponse();

    await create(req, res);

    expect(dbMock.MappingQuestion.create).toHaveBeenCalledWith({
      title: "Quality",
      type: "multiSelect",
      position: 0,
      description: "Longer guidance",
      decisionGuidance: "Only code explicit evidence.",
      positiveExamples: ["Collaborative learning intervention"],
      negativeExamples: ["A passing mention in related work"],
      evidenceInstructions: "Quote the exact page excerpt.",
      allowNewOption: true,
    });
    expect(res.send).toHaveBeenCalledWith({ id: 2, title: "Quality" });
  });

  it("createOption writes mappingQuestionId from route param", async () => {
    dbMock.MappingOption.create.mockResolvedValue({ id: 11 });

    const req = {
      params: { id: "7" },
      body: { title: "Tag", position: 3, color: "#abc" },
    } as unknown as Request;
    const res = mockResponse();

    await createOption(req, res);

    expect(dbMock.MappingOption.create).toHaveBeenCalledWith({
      title: "Tag",
      position: 3,
      color: "#abc",
      mappingQuestionId: 7,
    });
    expect(res.send).toHaveBeenCalledWith({ id: 11 });
  });

  it("updateOption returns 404 when option does not exist", async () => {
    dbMock.MappingOption.findByPk.mockResolvedValue(null);

    const req = {
      params: { optionId: "999" },
      body: { title: "none" },
    } as unknown as Request;
    const res = mockResponse();

    await expect(updateOption(req, res)).rejects.toBeInstanceOf(ApiError);
  });

  it("removeOption destroys and returns option", async () => {
    const option = {
      id: 5,
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    dbMock.MappingOption.findByPk.mockResolvedValue(option);

    const req = {
      params: { optionId: "5" },
    } as unknown as Request;
    const res = mockResponse();

    await removeOption(req, res);

    expect(option.destroy).toHaveBeenCalledTimes(1);
    expect(res.send).toHaveBeenCalledWith(option);
  });
});
