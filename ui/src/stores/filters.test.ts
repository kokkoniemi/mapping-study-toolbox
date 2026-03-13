import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useFiltersStore } from "./filters";

describe("filters store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("updates status filter and resets page", () => {
    const store = useFiltersStore();
    store.page = 4;

    store.setStatusFilter("included");

    expect(store.statusFilter).toBe("included");
    expect(store.page).toBe(1);
  });

  it("rejects invalid page length", () => {
    const store = useFiltersStore();
    const previous = store.pageLength;

    store.setPageLength(999);

    expect(store.pageLength).toBe(previous);
  });

  it("tracks import filter", () => {
    const store = useFiltersStore();

    store.setDataImportFilter(42);
    expect(store.dataImportFilterId).toBe(42);

    store.setDataImportFilter(null);
    expect(store.dataImportFilterId).toBeNull();
  });
});
