import { describe, expect, it } from "vitest";

import { pickBestOpenAlexSearchWork } from "../lib/openalex";

describe("openalex fallback search ranking", () => {
  it("rejects mismatched title even when author matches", () => {
    const selected = pickBestOpenAlexSearchWork(
      "Toward an Improvement of Engineering Teaming Skills through an In-House Professionalism Course",
      "Al-Abbas, Mohammad",
      [
        {
          id: "https://openalex.org/W1",
          title: "A completely different article about climate policy outcomes",
          authorships: [{ author: { display_name: "Mohammad Al-Abbas" } }],
        },
      ],
    );

    expect(selected).toBeNull();
  });

  it("accepts strong title match", () => {
    const selected = pickBestOpenAlexSearchWork(
      "Predicting teamwork group assessment using log data-based learning analytics",
      "Hernández-García, Ángel",
      [
        {
          id: "https://openalex.org/W2",
          title: "Predicting teamwork group assessment using log data-based learning analytics",
          authorships: [{ author: { display_name: "Ángel Hernández-García" } }],
        },
        {
          id: "https://openalex.org/W3",
          title: "Teaching methods and teamwork perceptions in virtual settings",
          authorships: [{ author: { display_name: "Ángel Hernández-García" } }],
        },
      ],
    );

    expect(selected?.id).toBe("https://openalex.org/W2");
  });
});
