import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useDataToolsStore } from "./dataTools";

describe("data tools store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("toggles selected records", () => {
    const store = useDataToolsStore();

    store.toggleRecordSelection(10);
    store.toggleRecordSelection(11);
    expect(store.selectedRecordIds).toEqual([10, 11]);

    store.toggleRecordSelection(10);
    expect(store.selectedRecordIds).toEqual([11]);
  });

  it("updates tools tab and export preferences", () => {
    const store = useDataToolsStore();

    store.setToolsTab("export");
    store.setExportScope("selected");
    store.setExportFormat("bibtex");

    expect(store.toolsTab).toBe("export");
    expect(store.exportScope).toBe("selected");
    expect(store.exportFormat).toBe("bibtex");
  });

  it("resets selected records via clear action", () => {
    const store = useDataToolsStore();
    store.setSelectedRecordIds([1, 2, 3]);

    store.clearSelectedRecordIds();

    expect(store.selectedRecordIds).toEqual([]);
  });
});
