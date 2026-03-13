import { describe, expect, it } from "vitest";

import { buildPairwiseAgreement, type ComparableAssessment } from "../lib/assessmentComparison";

describe("buildPairwiseAgreement", () => {
  it("returns status, per-question mapping, mapping summary, and status+mapping summary rows", () => {
    const assessments: ComparableAssessment[] = [
      { recordId: 1, userId: 1, status: "included", comment: null, mappingOptionIds: [10, 20] },
      { recordId: 1, userId: 2, status: "included", comment: null, mappingOptionIds: [10, 21] },
      { recordId: 2, userId: 1, status: "excluded", comment: null, mappingOptionIds: [11] },
      { recordId: 2, userId: 2, status: "excluded", comment: null, mappingOptionIds: [11] },
    ];

    const pairwise = buildPairwiseAgreement(assessments, [1, 2], {
      mappingQuestions: [
        { id: 1, title: "Question A", position: 1 },
        { id: 2, title: "Question B", position: 2 },
      ],
      mappingOptionQuestionIdByOptionId: new Map([
        [10, 1],
        [11, 1],
        [20, 2],
        [21, 2],
      ]),
    });

    expect(pairwise).toHaveLength(5);
    expect(pairwise).toEqual(expect.arrayContaining([
      expect.objectContaining({
        userIdA: 1,
        userIdB: 2,
        metricType: "status",
        metricKey: "status",
        metricLabel: "Status",
        sharedCount: 2,
        agreementPercent: 100,
      }),
      expect.objectContaining({
        metricType: "mapping_question",
        metricKey: "mapping_question:1",
        metricLabel: "Mapping: Question A",
        mappingQuestionId: 1,
        sharedCount: 2,
      }),
      expect.objectContaining({
        metricType: "mapping_question",
        metricKey: "mapping_question:2",
        metricLabel: "Mapping: Question B",
        mappingQuestionId: 2,
        sharedCount: 2,
      }),
      expect.objectContaining({
        metricType: "mapping_all",
        metricKey: "mapping_all",
        metricLabel: "Mapping (all questions)",
        sharedCount: 2,
      }),
      expect.objectContaining({
        metricType: "status_mapping_all",
        metricKey: "status_mapping_all",
        metricLabel: "Status + Mapping (all questions)",
        sharedCount: 2,
      }),
    ]));
  });

  it("still returns mapping summary rows when there are no mapping questions", () => {
    const assessments: ComparableAssessment[] = [
      { recordId: 1, userId: 1, status: "included", comment: null, mappingOptionIds: [] },
      { recordId: 1, userId: 2, status: "excluded", comment: null, mappingOptionIds: [] },
    ];

    const pairwise = buildPairwiseAgreement(assessments, [1, 2], {
      mappingQuestions: [],
      mappingOptionQuestionIdByOptionId: new Map(),
    });

    expect(pairwise).toHaveLength(3);
    expect(pairwise.map((row) => row.metricType)).toEqual([
      "status",
      "mapping_all",
      "status_mapping_all",
    ]);
    expect(pairwise.every((row) => row.sharedCount === 1)).toBe(true);
  });
});
