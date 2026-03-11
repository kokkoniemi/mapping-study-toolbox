import { describe, expect, it } from "vitest";

import {
  extractAbstractFromWork,
  extractDoiFromRecordUrls,
  extractDoiFromText,
  extractIssnFromWork,
  normalizeIssn,
  pickBestSearchWork,
} from "../lib/crossref";

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
    const queryAuthor = "Doe, Alex";

    const selected = pickBestSearchWork(queryTitle, queryAuthor, 2024, [
      {
        DOI: "10.1000/wrong",
        title: ["A completely different article about climate policy outcomes"],
        author: [{ family: "Doe", given: "Alex" }],
        issued: { "date-parts": [[2024]] },
      },
    ]);

    expect(selected).toBeNull();
  });

  it("rejects same author with strong title but wrong year", () => {
    const selected = pickBestSearchWork(
      "Predicting teamwork group assessment using log data-based learning analytics",
      "Smith, Jordan",
      2024,
      [
        {
          DOI: "10.1000/off-by-years",
          title: ["Predicting teamwork group assessment using log data-based learning analytics"],
          author: [{ family: "Smith", given: "Jordan" }],
          issued: { "date-parts": [[2018]] },
        },
      ],
    );

    expect(selected).toBeNull();
  });

  it("accepts strong title match", () => {
    const queryTitle = "Predicting teamwork group assessment using log data-based learning analytics";
    const queryAuthor = "Smith, Jordan";

    const selected = pickBestSearchWork(queryTitle, queryAuthor, 2024, [
      {
        DOI: "10.1016/j.jss.2023.111795",
        title: ["Predicting teamwork group assessment using log data-based learning analytics"],
        author: [{ family: "Smith", given: "Jordan" }],
        issued: { "date-parts": [[2024]] },
      },
      {
        DOI: "10.1000/noise",
        title: ["Teaching methods and teamwork perceptions in virtual settings"],
        author: [{ family: "Smith", given: "Jordan" }],
        issued: { "date-parts": [[2021]] },
      },
    ]);

    expect(selected?.DOI).toBe("10.1016/j.jss.2023.111795");
  });
});

describe("crossref ISSN extraction", () => {
  it("normalizes ISSN variants", () => {
    expect(normalizeIssn("01641212")).toBe("0164-1212");
    expect(normalizeIssn("0164-1212")).toBe("0164-1212");
    expect(normalizeIssn("0164-121X")).toBe("0164-121X");
  });

  it("extracts ISSN from work payload", () => {
    const issn = extractIssnFromWork({
      ISSN: ["0164-1212"],
      "issn-type": [{ value: "1234-5678", type: "electronic" }],
    });
    expect(issn).toBe("0164-1212");
  });
});

describe("crossref abstract extraction", () => {
  it("extracts and normalizes JATS-like abstract markup", () => {
    const abstract = extractAbstractFromWork({
      abstract:
        "<jats:p>The <jats:bold>study</jats:bold> explores teamwork &amp; collaboration.</jats:p>",
    });

    expect(abstract).toBe("The study explores teamwork & collaboration.");
  });

  it("returns null when abstract is missing", () => {
    const abstract = extractAbstractFromWork({});
    expect(abstract).toBeNull();
  });
});
