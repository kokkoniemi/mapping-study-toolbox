import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import type { MappingOption, MappingQuestion, RecordItem } from "../helpers/api";
import { defaultStore } from "./default";

const apiMocks = vi.hoisted(() => ({
  recordsIndex: vi.fn(),
  recordsUpdate: vi.fn(),
  recordsPatch: vi.fn(),
  recordsMappingSave: vi.fn(),
  recordsMappingDelete: vi.fn(),
  mappingQuestionsIndex: vi.fn(),
  mappingQuestionsSave: vi.fn(),
  mappingQuestionsDelete: vi.fn(),
  mappingQuestionsUpdate: vi.fn(),
  mappingQuestionsOptionSave: vi.fn(),
}));

vi.mock("../helpers/api", () => ({
  records: {
    index: apiMocks.recordsIndex,
    update: apiMocks.recordsUpdate,
    patch: apiMocks.recordsPatch,
    mappingOptions: {
      save: apiMocks.recordsMappingSave,
      delete: apiMocks.recordsMappingDelete,
    },
  },
  mappingQuestions: {
    index: apiMocks.mappingQuestionsIndex,
    save: apiMocks.mappingQuestionsSave,
    delete: apiMocks.mappingQuestionsDelete,
    update: apiMocks.mappingQuestionsUpdate,
    mappingOptions: {
      save: apiMocks.mappingQuestionsOptionSave,
    },
  },
}));

const makeOption = (overrides: Partial<MappingOption> = {}): MappingOption => ({
  id: 1,
  title: "Option",
  position: 0,
  color: "#abc",
  mappingQuestionId: 1,
  ...overrides,
});

const makeQuestion = (overrides: Partial<MappingQuestion> = {}): MappingQuestion => ({
  id: 1,
  title: "Question",
  type: "multiSelect",
  position: 0,
  MappingOptions: [],
  ...overrides,
});

const makeRecord = (overrides: Partial<RecordItem> = {}): RecordItem => ({
  id: 1,
  title: "Title",
  author: "Author",
  url: "https://example.com",
  databases: ["db"],
  alternateUrls: [],
  abstract: null,
  description: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  status: null,
  comment: null,
  MappingOptions: [],
  ...overrides,
});

const resetApiMocks = () => {
  apiMocks.recordsIndex.mockReset();
  apiMocks.recordsUpdate.mockReset();
  apiMocks.recordsPatch.mockReset();
  apiMocks.recordsMappingSave.mockReset();
  apiMocks.recordsMappingDelete.mockReset();
  apiMocks.mappingQuestionsIndex.mockReset();
  apiMocks.mappingQuestionsSave.mockReset();
  apiMocks.mappingQuestionsDelete.mockReset();
  apiMocks.mappingQuestionsUpdate.mockReset();
  apiMocks.mappingQuestionsOptionSave.mockReset();
};

describe("defaultStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    resetApiMocks();
  });

  it("fetchPageItems updates list/count and sets first item as current", async () => {
    const store = defaultStore();
    const first = makeRecord({ id: 10 });
    const second = makeRecord({ id: 11 });

    apiMocks.recordsIndex.mockResolvedValue({
      status: 200,
      data: { count: 2, records: [first, second] },
    });

    await store.fetchPageItems();

    expect(store.pageItems.map((item) => item.id)).toEqual([10, 11]);
    expect(store.itemCount).toBe(2);
    expect(store.currentItemId).toBe(10);
    expect(apiMocks.recordsIndex).toHaveBeenCalledWith({ offset: 0, limit: 25 });
  });

  it("fetchPageItems keeps current item when it still exists", async () => {
    const store = defaultStore();
    const keep = makeRecord({ id: 5 });

    store.pageItems = [keep, makeRecord({ id: 6 })];
    store.currentItemId = 5;

    apiMocks.recordsIndex.mockResolvedValue({
      status: 200,
      data: { count: 2, records: [keep, makeRecord({ id: 7 })] },
    });

    await store.fetchPageItems();

    expect(store.currentItemId).toBe(5);
  });

  it("setPage ignores requests above max pages", async () => {
    const store = defaultStore();
    store.itemCount = 10;
    store.pageLength = 5;

    await store.setPage(3);

    expect(store.page).toBe(1);
    expect(apiMocks.recordsIndex).not.toHaveBeenCalled();
  });

  it("setItemStatus updates current record in-place when filter is not active", async () => {
    const store = defaultStore();
    const first = makeRecord({ id: 1, status: null });
    const second = makeRecord({ id: 2, status: null });

    store.pageItems = [first, second];
    store.currentItemId = 1;
    store.nick = "mk";

    apiMocks.recordsUpdate.mockResolvedValue({
      status: 200,
      data: makeRecord({ id: 1, status: "included" }),
    });

    await store.setItemStatus("included");

    expect(apiMocks.recordsUpdate).toHaveBeenCalledWith(1, {
      status: "included",
      editedBy: "mk",
    });
    expect(store.pageItems[0]?.status).toBe("included");
    expect(store.currentItemId).toBe(1);
  });

  it("setItemStatus refetches and moves current item when active filter no longer matches", async () => {
    const store = defaultStore();

    store.statusFilter = "excluded";
    store.pageItems = [makeRecord({ id: 1, status: "excluded" }), makeRecord({ id: 2, status: "excluded" })];
    store.currentItemId = 1;

    apiMocks.recordsUpdate.mockResolvedValue({
      status: 200,
      data: makeRecord({ id: 1, status: "included" }),
    });

    apiMocks.recordsIndex.mockResolvedValue({
      status: 200,
      data: {
        count: 2,
        records: [makeRecord({ id: 20, status: "excluded" }), makeRecord({ id: 21, status: "excluded" })],
      },
    });

    await store.setItemStatus("included");

    expect(apiMocks.recordsIndex).toHaveBeenCalledWith({ offset: 0, limit: 25, status: "excluded" });
    expect(store.pageItems[0]?.id).toBe(20);
    expect(store.currentItemId).toBe(20);
  });

  it("setItemComment updates local state and normalizes empty comment to null for API", async () => {
    const store = defaultStore();
    store.pageItems = [makeRecord({ id: 1, comment: "before" })];
    store.currentItemId = 1;
    store.nick = "mk";

    apiMocks.recordsUpdate.mockResolvedValue({ status: 200, data: makeRecord({ id: 1 }) });

    await store.setItemComment(1, "");

    expect(store.pageItems[0]?.comment).toBe("");
    expect(apiMocks.recordsUpdate).toHaveBeenCalledWith(1, {
      comment: null,
      editedBy: "mk",
    });
  });

  it("patchRecord updates row and clears draft/saving state", async () => {
    const store = defaultStore();
    store.pageItems = [makeRecord({ id: 42, title: "Before" })];
    store.nick = "mk";
    store.setCellDraft(42, "title", "After");

    apiMocks.recordsPatch.mockResolvedValue({
      status: 200,
      data: makeRecord({ id: 42, title: "After" }),
    });

    await store.patchRecord(42, { title: "After" });

    expect(apiMocks.recordsPatch).toHaveBeenCalledWith(42, {
      title: "After",
      editedBy: "mk",
    });
    expect(store.pageItems[0]?.title).toBe("After");
    expect(store.getCellState(42, "title")).toMatchObject({
      saving: false,
      error: null,
      draft: undefined,
    });
  });

  it("setRecordArrayField serializes chip arrays via patch endpoint", async () => {
    const store = defaultStore();
    store.pageItems = [makeRecord({ id: 9, databases: ["db"] })];

    apiMocks.recordsPatch.mockResolvedValue({
      status: 200,
      data: makeRecord({ id: 9, databases: ["scopus", "wos"] }),
    });

    await store.setRecordArrayField(9, "databases", ["scopus", "wos"]);

    expect(apiMocks.recordsPatch).toHaveBeenCalledWith(9, {
      databases: ["scopus", "wos"],
    });
    expect(store.pageItems[0]?.databases).toEqual(["scopus", "wos"]);
  });

  it("createMappingQuestion appends created question with empty MappingOptions", async () => {
    const store = defaultStore();
    store.mappingQuestions = [makeQuestion({ id: 1, position: 0 })];

    apiMocks.mappingQuestionsSave.mockResolvedValue({
      status: 200,
      data: makeQuestion({ id: 2, position: 1 }),
    });

    await store.createMappingQuestion();

    expect(apiMocks.mappingQuestionsSave).toHaveBeenCalledWith({
      title: "",
      type: "multiSelect",
      position: 1,
    });
    expect(store.mappingQuestions).toHaveLength(2);
    expect(store.mappingQuestions[1]?.MappingOptions).toEqual([]);
  });

  it("createMappingOption links a new option to current record and refreshes questions", async () => {
    const store = defaultStore();
    const current = makeRecord({ id: 1, MappingOptions: [] });

    store.pageItems = [current];
    store.currentItemId = 1;
    store.mappingQuestions = [makeQuestion({ id: 10, MappingOptions: [] })];

    apiMocks.mappingQuestionsOptionSave.mockResolvedValue({
      status: 200,
      data: makeOption({ id: 101, mappingQuestionId: 10, title: "Tag" }),
    });
    apiMocks.recordsMappingSave.mockResolvedValue({
      status: 200,
      data: makeOption({ id: 101, mappingQuestionId: 10, title: "Tag" }),
    });
    apiMocks.mappingQuestionsIndex.mockResolvedValue({
      status: 200,
      data: { count: 1, questions: [makeQuestion({ id: 10, MappingOptions: [makeOption({ id: 101 })] })] },
    });

    await store.createMappingOption({ id: 10, title: "Tag", position: 0, color: "#abc" });

    expect(apiMocks.mappingQuestionsOptionSave).toHaveBeenCalledWith(10, {
      title: "Tag",
      position: 0,
      color: "#abc",
    });
    expect(apiMocks.recordsMappingSave).toHaveBeenCalledWith(1, {
      mappingQuestionId: 10,
      mappingOptionId: 101,
    });
    expect(apiMocks.mappingQuestionsIndex).toHaveBeenCalledTimes(1);
    expect(store.pageItems[0]?.MappingOptions.map((option) => option.id)).toEqual([101]);
  });

  it("createMappingOption does nothing when there is no current record", async () => {
    const store = defaultStore();

    await store.createMappingOption({ id: 10, title: "Tag", position: 0, color: "#abc" });

    expect(apiMocks.mappingQuestionsOptionSave).not.toHaveBeenCalled();
    expect(apiMocks.recordsMappingSave).not.toHaveBeenCalled();
  });

  it("addRecordMappingOption and removeRecordMappingOption mutate current record options", async () => {
    const store = defaultStore();
    const current = makeRecord({
      id: 1,
      MappingOptions: [makeOption({ id: 1, mappingQuestionId: 5 })],
    });

    store.pageItems = [current];
    store.currentItemId = 1;

    apiMocks.recordsMappingSave.mockResolvedValue({
      status: 200,
      data: makeOption({ id: 2, mappingQuestionId: 5 }),
    });
    apiMocks.recordsMappingDelete.mockResolvedValue({ status: 200, data: "ok" });

    await store.addRecordMappingOption({ mappingQuestionId: 5, mappingOptionId: 2 });

    expect(store.pageItems[0]?.MappingOptions.map((option) => option.id)).toEqual([1, 2]);

    await store.removeRecordMappingOption(2);

    expect(apiMocks.recordsMappingDelete).toHaveBeenCalledWith(1, 2);
    expect(store.pageItems[0]?.MappingOptions.map((option) => option.id)).toEqual([1]);
  });

  it("createMappingOptionAndLink creates option and links it to row", async () => {
    const store = defaultStore();
    store.pageItems = [makeRecord({ id: 3, MappingOptions: [] })];
    store.mappingQuestions = [makeQuestion({ id: 9, MappingOptions: [] })];

    apiMocks.mappingQuestionsOptionSave.mockResolvedValue({
      status: 200,
      data: makeOption({ id: 400, mappingQuestionId: 9, title: "New tag" }),
    });
    apiMocks.recordsMappingSave.mockResolvedValue({
      status: 200,
      data: makeOption({ id: 400, mappingQuestionId: 9, title: "New tag" }),
    });
    apiMocks.mappingQuestionsIndex.mockResolvedValue({
      status: 200,
      data: {
        count: 1,
        questions: [makeQuestion({ id: 9, MappingOptions: [makeOption({ id: 400, mappingQuestionId: 9 })] })],
      },
    });

    await store.createMappingOptionAndLink(3, 9, "New tag", "#abc");

    expect(apiMocks.mappingQuestionsOptionSave).toHaveBeenCalledWith(9, {
      title: "New tag",
      position: 0,
      color: "#abc",
    });
    expect(apiMocks.recordsMappingSave).toHaveBeenCalledWith(3, {
      mappingQuestionId: 9,
      mappingOptionId: 400,
    });
    expect(store.pageItems[0]?.MappingOptions.map((option) => option.id)).toEqual([400]);
  });
});
