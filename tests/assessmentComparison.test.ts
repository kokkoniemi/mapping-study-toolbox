import { describe, expect, it } from "vitest";

import {
  buildDisagreements,
  buildPairwiseAgreement,
  calculateCohensKappa,
  type ComparableAssessment,
} from "../lib/assessmentComparison";

describe("assessment comparison", () => {
  it("calculates Cohen's Kappa and agreement percent for status labels", () => {
    const left = ["included", "included", "excluded", "uncertain", null] as const;
    const right = ["included", "excluded", "excluded", "uncertain", null] as const;

    const metrics = calculateCohensKappa([...left], [...right]);

    expect(metrics.sharedCount).toBe(5);
    expect(metrics.agreementPercent).toBeCloseTo(80, 6);
    expect(metrics.kappa).toBeCloseTo(0.7368421, 6);
  });

  it("builds pairwise metrics for multiple users", () => {
    const selections: ComparableAssessment[] = [
      { recordId: 1, userId: 1, status: "included", comment: null, mappingOptionIds: [1] },
      { recordId: 2, userId: 1, status: "excluded", comment: null, mappingOptionIds: [2] },
      { recordId: 1, userId: 2, status: "included", comment: null, mappingOptionIds: [1] },
      { recordId: 2, userId: 2, status: "included", comment: null, mappingOptionIds: [2] },
      { recordId: 1, userId: 3, status: "included", comment: null, mappingOptionIds: [1] },
    ];

    const pairwise = buildPairwiseAgreement(selections, [1, 2, 3]);

    expect(pairwise).toEqual([
      expect.objectContaining({ userIdA: 1, userIdB: 2, sharedCount: 2 }),
      expect.objectContaining({ userIdA: 1, userIdB: 3, sharedCount: 1 }),
      expect.objectContaining({ userIdA: 2, userIdB: 3, sharedCount: 1 }),
    ]);
  });

  it("builds disagreement rows for status, comment, and mapping differences", () => {
    const selections: ComparableAssessment[] = [
      { recordId: 5, userId: 1, status: "included", comment: "Keep", mappingOptionIds: [1, 2] },
      { recordId: 5, userId: 2, status: "excluded", comment: "Skip", mappingOptionIds: [2, 1] },
      { recordId: 6, userId: 1, status: "included", comment: "Same", mappingOptionIds: [3] },
      { recordId: 6, userId: 2, status: "included", comment: "Same", mappingOptionIds: [3] },
    ];

    const disagreements = buildDisagreements(selections, [1, 2]);

    expect(disagreements).toHaveLength(1);
    expect(disagreements[0]).toMatchObject({
      recordId: 5,
      statusDisagreement: true,
      commentDisagreement: true,
      mappingDisagreement: false,
    });
  });
});
