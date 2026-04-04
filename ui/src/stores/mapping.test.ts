import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import type { MappingQuestion } from "../helpers/api";
import { useMappingStore } from "./mapping";

const apiMocks = vi.hoisted(() => ({
  mappingQuestionsIndex: vi.fn(),
  mappingQuestionsSave: vi.fn(),
  mappingQuestionsDelete: vi.fn(),
  mappingQuestionsUpdate: vi.fn(),
}));

vi.mock("../helpers/api", () => ({
  mappingQuestions: {
    index: apiMocks.mappingQuestionsIndex,
    save: apiMocks.mappingQuestionsSave,
    delete: apiMocks.mappingQuestionsDelete,
    update: apiMocks.mappingQuestionsUpdate,
  },
}));

const makeQuestion = (overrides: Partial<MappingQuestion> = {}): MappingQuestion => ({
  id: 1,
  title: "Question",
  type: "multiSelect",
  position: 0,
  description: "",
  decisionGuidance: "",
  positiveExamples: [],
  negativeExamples: [],
  evidenceInstructions: "",
  allowNewOption: true,
  MappingOptions: [],
  ...overrides,
});

describe("mapping store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiMocks.mappingQuestionsIndex.mockReset();
    apiMocks.mappingQuestionsSave.mockReset();
    apiMocks.mappingQuestionsDelete.mockReset();
    apiMocks.mappingQuestionsUpdate.mockReset();
  });

  it("fetches mapping questions", async () => {
    const store = useMappingStore();
    apiMocks.mappingQuestionsIndex.mockResolvedValue({
      status: 200,
      data: { count: 1, questions: [makeQuestion({ id: 7 })] },
    });

    await store.fetchMappingQuestions();

    expect(store.mappingQuestions.map((question) => question.id)).toEqual([7]);
  });

  it("updates a question in-place by id", async () => {
    const store = useMappingStore();
    store.mappingQuestions = [makeQuestion({ id: 1, title: "Before" })];

    apiMocks.mappingQuestionsUpdate.mockResolvedValue({
      status: 200,
      data: makeQuestion({ id: 1, title: "After" }),
    });

    await store.updateMappingQuestion({
      id: 1,
      title: "After",
      type: "multiSelect",
      position: 0,
    });

    expect(store.mappingQuestions[0]?.title).toBe("After");
  });
});
