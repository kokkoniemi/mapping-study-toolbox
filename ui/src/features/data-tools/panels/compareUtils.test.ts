import { describe, expect, it } from "vitest";

import { buildMergedResolvedComment, formatKappaCi95 } from "./compareUtils";

describe("compareUtils", () => {
  it("buildMergedResolvedComment joins non-empty comments by user name", () => {
    const merged = buildMergedResolvedComment(
      [
        { userId: 1, comment: " keep this " },
        { userId: 2, comment: "   " },
        { userId: 3, comment: null },
        { userId: 4, comment: "needs discussion" },
      ],
      (userId) => `User${userId}`,
    );

    expect(merged).toBe("User1: keep this\nUser4: needs discussion");
  });

  it("formatKappaCi95 renders bracketed bounds or n/a", () => {
    expect(formatKappaCi95(0.123456, 0.987654)).toBe("[0.1235, 0.9877]");
    expect(formatKappaCi95(null, 0.2)).toBe("n/a");
    expect(formatKappaCi95(0.1, null)).toBe("n/a");
  });
});
