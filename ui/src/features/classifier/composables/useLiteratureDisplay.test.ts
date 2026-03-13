import { describe, expect, it } from "vitest";
import { ref } from "vue";

import type { RecordItem } from "../../../helpers/api";
import { useLiteratureDisplay } from "./useLiteratureDisplay";

const makeRecord = (overrides: Partial<RecordItem> = {}): RecordItem => ({
  id: 1,
  title: "Record",
  author: "Alice &amp; Bob",
  year: 2024,
  url: "https://example.com",
  databases: ["scopus"],
  alternateUrls: [],
  abstract: "Abstract:\nLine 1\n•\nLine 2",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  status: null,
  comment: null,
  MappingOptions: [],
  ...overrides,
});

describe("useLiteratureDisplay", () => {
  it("formats key display blocks for classifier", () => {
    const currentItem = ref<RecordItem | null>(
      makeRecord({
        Forum: { id: 1, name: "Forum &amp; Name", issn: null, jufoLevel: 2, publisher: null, enrichmentProvenance: null },
        referenceItems: [{
          doi: "10.1000/ref",
          key: "r1",
          unstructured: null,
          articleTitle: "Ref &amp; Title",
          journalTitle: "Journal",
          author: null,
          year: "2020",
          volume: null,
          firstPage: null,
        }],
      }),
    );

    const {
      authorDisplay,
      abstractText,
      forumName,
      referenceDisplayItems,
      showReferences,
      toggleReferencesVisibility,
      resetVisibility,
      databaseList,
    } = useLiteratureDisplay(currentItem);

    expect(authorDisplay.value).toBe("Alice & Bob");
    expect(abstractText.value).toContain("Line 1");
    expect(abstractText.value).not.toContain("•");
    expect(forumName.value).toBe("Forum & Name");
    expect(referenceDisplayItems.value[0]?.title).toBe("Ref & Title");
    expect(databaseList.value).toBe("scopus");

    toggleReferencesVisibility();
    expect(showReferences.value).toBe(true);

    resetVisibility();
    expect(showReferences.value).toBe(false);
  });
});
