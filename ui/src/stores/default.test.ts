import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import type { MappingOption, MappingQuestion, RecordItem } from "../helpers/api";
import { defaultStore } from "./default";

const apiMocks = vi.hoisted(() => ({
  recordsIndex: vi.fn(),
  recordsGet: vi.fn(),
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
    get: apiMocks.recordsGet,
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
  year: null,
  url: "https://example.com",
  databases: ["db"],
  alternateUrls: [],
  abstract: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  status: null,
  comment: null,
  MappingOptions: [],
  ...overrides,
});

const resetApiMocks = () => {
  apiMocks.recordsIndex.mockReset();
  apiMocks.recordsGet.mockReset();
  apiMocks.recordsUpdate.mockReset();
  apiMocks.recordsPatch.mockReset();
  apiMocks.recordsMappingSave.mockReset();
  apiMocks.recordsMappingDelete.mockReset();
  apiMocks.mappingQuestionsIndex.mockReset();
  apiMocks.mappingQuestionsSave.mockReset();
  apiMocks.mappingQuestionsDelete.mockReset();
  apiMocks.mappingQuestionsUpdate.mockReset();
  apiMocks.mappingQuestionsOptionSave.mockReset();

  apiMocks.recordsGet.mockImplementation(async (id: number) => ({
    status: 200,
    data: makeRecord({ id, status: "included" }),
  }));
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
    store.itemCount = 40;
    store.pageLength = 20;

    await store.setPage(3);

    expect(store.page).toBe(1);
    expect(apiMocks.recordsIndex).not.toHaveBeenCalled();
  });

  it("setPageLength updates pagination size, resets page, and refetches", async () => {
    const store = defaultStore();
    store.page = 3;
    store.itemCount = 120;

    apiMocks.recordsIndex.mockResolvedValue({
      status: 200,
      data: { count: 120, records: [makeRecord({ id: 99 })] },
    });

    await store.setPageLength(30);

    expect(store.pageLength).toBe(30);
    expect(store.page).toBe(1);
    expect(apiMocks.recordsIndex).toHaveBeenCalledWith({ offset: 0, limit: 30 });
  });

  it("setDataCellsTruncated updates persisted UI preference", () => {
    const store = defaultStore();

    expect(store.dataCellsTruncated).toBe(true);
    store.setDataCellsTruncated(false);
    expect(store.dataCellsTruncated).toBe(false);
  });

  it("loadInitialData and loadMoreData append all rows for infinite feed", async () => {
    const store = defaultStore();

    apiMocks.recordsIndex
      .mockResolvedValueOnce({
        status: 200,
        data: { count: 3, records: [makeRecord({ id: 1 }), makeRecord({ id: 2 })] },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { count: 3, records: [makeRecord({ id: 3 })] },
      });

    await store.loadInitialData();
    await store.loadMoreData();

    expect(apiMocks.recordsIndex).toHaveBeenNthCalledWith(1, { offset: 0, limit: 100 });
    expect(apiMocks.recordsIndex).toHaveBeenNthCalledWith(2, { offset: 2, limit: 100 });
    expect(store.dataItems.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(store.dataOffset).toBe(3);
    expect(store.dataTotal).toBe(3);
    expect(store.dataHasMore).toBe(false);
  });

  it("setSearchFilter in data tab reloads infinite feed", async () => {
    const store = defaultStore();
    store.tab = "data";

    apiMocks.recordsIndex.mockResolvedValue({
      status: 200,
      data: { count: 1, records: [makeRecord({ id: 77, title: "Filtered" })] },
    });

    await store.setSearchFilter("filtered");

    expect(apiMocks.recordsIndex).toHaveBeenCalledWith({
      offset: 0,
      limit: 100,
      search: "filtered",
    });
    expect(store.dataItems.map((item) => item.id)).toEqual([77]);
    expect(store.searchFilter).toBe("filtered");
  });

  it("hydrateRecordDetails fetches detail when only topics are present in list item", async () => {
    const store = defaultStore();

    store.pageItems = [
      makeRecord({
        id: 101,
        openAlexTopicItems: [
          {
            id: "https://openalex.org/T1",
            displayName: "Teamwork",
            score: 0.9,
            subfield: null,
            field: null,
            domain: null,
          },
        ],
      }),
    ];

    apiMocks.recordsGet.mockClear();
    apiMocks.recordsGet.mockResolvedValue({
      status: 200,
      data: makeRecord({
        id: 101,
        referenceItems: [
          {
            doi: "10.1000/example",
            key: "ref-1",
            unstructured: null,
            articleTitle: "Reference title",
            journalTitle: "Forum",
            author: "Author, A.",
            year: "2021",
            volume: "12",
            firstPage: "44",
          },
        ],
        openAlexCitationItems: [
          {
            openAlexId: "https://openalex.org/W1",
            doi: "10.1000/cite",
            title: "Citation title",
            year: 2022,
            url: "https://doi.org/10.1000/cite",
            forum: "Citation forum",
            citedByCount: 3,
          },
        ],
      }),
    });

    await store.hydrateRecordDetails(101);

    expect(apiMocks.recordsGet).toHaveBeenCalledWith(101);
    expect(store.pageItems[0]?.referenceItems?.length).toBe(1);
    expect(store.pageItems[0]?.openAlexCitationItems?.length).toBe(1);
  });

  it("hydrateRecordDetails skips fetch when references and citations are already loaded", async () => {
    const store = defaultStore();

    store.pageItems = [
      makeRecord({
        id: 102,
        referenceItems: [],
        openAlexCitationItems: [],
        openAlexTopicItems: [
          {
            id: "https://openalex.org/T2",
            displayName: "Collaboration",
            score: 0.82,
            subfield: null,
            field: null,
            domain: null,
          },
        ],
      }),
    ];

    apiMocks.recordsGet.mockClear();

    await store.hydrateRecordDetails(102);

    expect(apiMocks.recordsGet).not.toHaveBeenCalled();
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
      resolvedBy: "mk",
      resolvedByUserId: null,
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
      resolvedBy: "mk",
      resolvedByUserId: null,
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
      resolvedBy: "mk",
      resolvedByUserId: null,
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

    expect(apiMocks.recordsPatch).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        databases: ["scopus", "wos"],
        resolvedByUserId: null,
      }),
    );
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
