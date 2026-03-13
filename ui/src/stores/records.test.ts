import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import type { MappingQuestion, RecordItem } from "../helpers/api";
import { useFiltersStore } from "./filters";
import { useRecordsStore } from "./records";

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

const _unusedQuestionShape = (overrides: Partial<MappingQuestion> = {}): MappingQuestion => ({
  id: 1,
  title: "Question",
  type: "multiSelect",
  position: 0,
  MappingOptions: [],
  ...overrides,
});

describe("records store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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
    void _unusedQuestionShape;
  });

  it("loads initial data with active filters", async () => {
    const filtersStore = useFiltersStore();
    const recordsStore = useRecordsStore();

    filtersStore.setStatusFilter("included");
    filtersStore.setSearchFilter("teamwork");
    filtersStore.setDataImportFilter(15);

    apiMocks.recordsIndex.mockResolvedValue({
      status: 200,
      data: { count: 1, records: [makeRecord({ id: 99 })] },
    });

    await recordsStore.loadInitialData();

    expect(apiMocks.recordsIndex).toHaveBeenCalledWith({
      offset: 0,
      limit: 100,
      status: "included",
      search: "teamwork",
      importId: 15,
    });
    expect(recordsStore.dataItems.map((item) => item.id)).toEqual([99]);
    expect(recordsStore.dataTotal).toBe(1);
  });
});
