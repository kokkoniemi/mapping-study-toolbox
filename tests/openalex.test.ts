import { describe, expect, it } from "vitest";

import { decodeOpenAlexAbstractInvertedIndex, pickBestOpenAlexSearchWork } from "../lib/openalex";

describe("openalex fallback search ranking", () => {
  it("rejects mismatched title even when author matches", () => {
    const selected = pickBestOpenAlexSearchWork(
      "Toward an Improvement of Engineering Teaming Skills through an In-House Professionalism Course",
      "Doe, Alex",
      2024,
      [
        {
          id: "https://openalex.org/W1",
          title: "A completely different article about climate policy outcomes",
          authorships: [{ author: { display_name: "Alex Doe" } }],
          publication_year: 2024,
        },
      ],
    );

    expect(selected).toBeNull();
  });

  it("accepts strong title match", () => {
    const selected = pickBestOpenAlexSearchWork(
      "Predicting teamwork group assessment using log data-based learning analytics",
      "Smith, Jordan",
      2024,
      [
        {
          id: "https://openalex.org/W2",
          title: "Predicting teamwork group assessment using log data-based learning analytics",
          authorships: [{ author: { display_name: "Jordan Smith" } }],
          publication_year: 2024,
        },
        {
          id: "https://openalex.org/W3",
          title: "Teaching methods and teamwork perceptions in virtual settings",
          authorships: [{ author: { display_name: "Jordan Smith" } }],
          publication_year: 2021,
        },
      ],
    );

    expect(selected?.id).toBe("https://openalex.org/W2");
  });

  it("rejects strong title match when publication year differs too much", () => {
    const selected = pickBestOpenAlexSearchWork(
      "Predicting teamwork group assessment using log data-based learning analytics",
      "Smith, Jordan",
      2024,
      [
        {
          id: "https://openalex.org/W2",
          title: "Predicting teamwork group assessment using log data-based learning analytics",
          authorships: [{ author: { display_name: "Jordan Smith" } }],
          publication_year: 2016,
        },
      ],
    );

    expect(selected).toBeNull();
  });
});

describe("openalex abstract decoding", () => {
  it("decodes abstract_inverted_index into readable text", () => {
    const abstract = decodeOpenAlexAbstractInvertedIndex({
      Teamwork: [0],
      skills: [1],
      improve: [2],
      outcomes: [3],
    });

    expect(abstract).toBe("Teamwork skills improve outcomes");
  });

  it("returns null for empty abstract index", () => {
    expect(decodeOpenAlexAbstractInvertedIndex({})).toBeNull();
  });
});
