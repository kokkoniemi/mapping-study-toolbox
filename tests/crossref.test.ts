import { describe, expect, it } from "vitest";

import { extractDoiFromRecordUrls, extractDoiFromText, pickBestSearchWork } from "../lib/crossref";

describe("crossref DOI extraction", () => {
  it("extracts DOI from doi.org URL", () => {
    const doi = extractDoiFromText("https://doi.org/10.1016/j.jss.2023.111795");
    expect(doi).toBe("10.1016/j.jss.2023.111795");
  });

  it("extracts DOI from plain text", () => {
    const doi = extractDoiFromText("doi:10.1007/s10916-020-01585-8");
    expect(doi).toBe("10.1007/s10916-020-01585-8");
  });

  it("prefers DOI from record URL and falls back to alternate URLs", () => {
    const doi = extractDoiFromRecordUrls("https://example.com/no-doi", [
      "https://dx.doi.org/10.1145/3375637.3392406",
    ]);
    expect(doi).toBe("10.1145/3375637.3392406");
  });

  it("returns null when DOI is not present", () => {
    const doi = extractDoiFromRecordUrls("https://example.com/article", ["https://example.com/alt"]);
    expect(doi).toBeNull();
  });
});

describe("crossref fallback search ranking", () => {
  it("rejects mismatched title even when author matches", () => {
    const queryTitle = "Toward an Improvement of Engineering Teaming Skills through an In-House Professionalism Course";
    const queryAuthor = "Al-Abbas, Mohammad";

    const selected = pickBestSearchWork(queryTitle, queryAuthor, [
      {
        DOI: "10.1000/wrong",
        title: ["A completely different article about climate policy outcomes"],
        author: [{ family: "Al-Abbas", given: "Mohammad" }],
      },
    ]);

    expect(selected).toBeNull();
  });

  it("accepts strong title match", () => {
    const queryTitle = "Predicting teamwork group assessment using log data-based learning analytics";
    const queryAuthor = "Hernández-García, Ángel";

    const selected = pickBestSearchWork(queryTitle, queryAuthor, [
      {
        DOI: "10.1016/j.jss.2023.111795",
        title: ["Predicting teamwork group assessment using log data-based learning analytics"],
        author: [{ family: "Hernández-García", given: "Ángel" }],
      },
      {
        DOI: "10.1000/noise",
        title: ["Teaching methods and teamwork perceptions in virtual settings"],
        author: [{ family: "Hernández-García", given: "Ángel" }],
      },
    ]);

    expect(selected?.DOI).toBe("10.1016/j.jss.2023.111795");
  });
});
