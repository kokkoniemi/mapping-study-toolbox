import { describe, expect, it } from "vitest";

import { extractJufoChannelId, extractJufoIssn, extractJufoLevel, extractJufoName } from "../lib/jufo";

describe("jufo payload parsing", () => {
  it("extracts channel id from url", () => {
    const id = extractJufoChannelId({
      status: "ok",
      message: [{ link: "https://jufo-rest.csc.fi/v1.1/kanava/61771" }],
    });
    expect(id).toBe(61771);
  });

  it("extracts channel id from object id field", () => {
    const id = extractJufoChannelId({
      status: "ok",
      message: [{ id: "61771" }],
    });
    expect(id).toBe(61771);
  });

  it("extracts jufo level and issn from channel response", () => {
    const payload = {
      kanava: {
        id: 61771,
        nimi: "Journal of Systems and Software",
        taso: "2",
        issn: "0164-1212",
      },
    };

    expect(extractJufoLevel(payload)).toBe(2);
    expect(extractJufoIssn(payload)).toBe("0164-1212");
    expect(extractJufoName(payload)).toBe("Journal of Systems and Software");
  });
});
