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

    store.setToolsTab("pdfs");
    store.setExportScope("selected");
    store.setExportFormat("bibtex");

    expect(store.toolsTab).toBe("pdfs");
    expect(store.exportScope).toBe("selected");
    expect(store.exportFormat).toBe("bibtex");
  });

  it("supports keywording tab selection", () => {
    const store = useDataToolsStore();

    store.setToolsTab("keywording");

    expect(store.toolsTab).toBe("keywording");
  });

  it("resets selected records via clear action", () => {
    const store = useDataToolsStore();
    store.setSelectedRecordIds([1, 2, 3]);

    store.clearSelectedRecordIds();

    expect(store.selectedRecordIds).toEqual([]);
  });
});
