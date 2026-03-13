import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useUiStore } from "./ui";

describe("ui store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("updates tab and nickname", () => {
    const store = useUiStore();

    store.updateTab("map");
    store.updateNick("MK");

    expect(store.tab).toBe("map");
    expect(store.nick).toBe("MK");
  });

  it("toggles move lock and density preferences", () => {
    const store = useUiStore();

    store.setMoveLock();
    expect(store.moveLock).toBe(true);

    store.unsetMoveLock();
    expect(store.moveLock).toBe(false);

    store.setDataCellsTruncated(false);
    store.setEnrichmentMode("full");

    expect(store.dataCellsTruncated).toBe(false);
    expect(store.enrichmentMode).toBe("full");
  });
});
