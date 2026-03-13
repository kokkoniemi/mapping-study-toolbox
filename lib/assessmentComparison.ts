import type {
  AssessmentDisagreementItem,
  PairwiseAgreement,
  RecordStatus,
} from "../shared/contracts";

export type ComparableAssessment = {
  recordId: number;
  userId: number;
  status: RecordStatus;
  comment: string | null;
  mappingOptionIds: number[];
};

const STATUS_KEYS = ["__NULL__", "uncertain", "excluded", "included"] as const;
type StatusKey = (typeof STATUS_KEYS)[number];
const UNSET_MAPPING_TOKEN = "__NONE__";
const NO_MAPPING_QUESTIONS_TOKEN = "__NO_QUESTIONS__";
const CATEGORY_SEPARATOR = "||";

type PairwiseMetricResult = {
  agreementPercent: number;
  kappa: number;
  sharedCount: number;
  kappaCi95Lower: number | null;
  kappaCi95Upper: number | null;
};

type PairwiseMappingQuestionMeta = {
  id: number;
  label: string;
  position: number;
};

export type PairwiseAgreementBuildOptions = {
  mappingQuestions?: Array<{
    id: number;
    title: string | null;
    position: number | null;
  }>;
  mappingOptionQuestionIdByOptionId?: ReadonlyMap<number, number>;
};

const toStatusKey = (status: RecordStatus): StatusKey => {
  if (status === null) {
    return "__NULL__";
  }
  return status;
};

const uniqueSortedInts = (values: number[]) => [...new Set(values)].sort((left, right) => left - right);

const arraysEqual = (left: number[], right: number[]) => {
  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
};

const calculateCohensKappaForLabels = (
  left: string[],
  right: string[],
): PairwiseMetricResult => {
  if (left.length !== right.length) {
    throw new Error("Cohen's Kappa inputs must have equal lengths");
  }

  const n = left.length;
  if (n === 0) {
    return {
      agreementPercent: 0,
      kappa: 0,
      sharedCount: 0,
      kappaCi95Lower: null,
      kappaCi95Upper: null,
    };
  }

  const categories = [...new Set([...left, ...right])].sort((a, b) => a.localeCompare(b));
  const rowTotals = new Map<string, number>();
  const columnTotals = new Map<string, number>();
  let observedAgreementCount = 0;

  for (let i = 0; i < n; i += 1) {
    const leftKey = left[i];
    const rightKey = right[i];
    rowTotals.set(leftKey, (rowTotals.get(leftKey) ?? 0) + 1);
    columnTotals.set(rightKey, (columnTotals.get(rightKey) ?? 0) + 1);
    if (leftKey === rightKey) {
      observedAgreementCount += 1;
    }
  }

  const observedAgreement = observedAgreementCount / n;

  let expectedAgreement = 0;
  for (const key of categories) {
    const rowTotal = rowTotals.get(key) ?? 0;
    const columnTotal = columnTotals.get(key) ?? 0;
    expectedAgreement += (rowTotal / n) * (columnTotal / n);
  }

  const denominator = 1 - expectedAgreement;
  const rawKappa = denominator === 0 ? 1 : (observedAgreement - expectedAgreement) / denominator;
  const kappa = Number.isFinite(rawKappa) ? rawKappa : 0;

  let kappaCi95Lower: number | null = null;
  let kappaCi95Upper: number | null = null;
  if (n >= 2) {
    const varianceDenominator = n * denominator * denominator;
    if (varianceDenominator > 0) {
      const variance = (observedAgreement * (1 - observedAgreement)) / varianceDenominator;
      if (Number.isFinite(variance) && variance >= 0) {
        const standardError = Math.sqrt(variance);
        if (Number.isFinite(standardError)) {
          const margin = 1.96 * standardError;
          kappaCi95Lower = Math.max(-1, kappa - margin);
          kappaCi95Upper = Math.min(1, kappa + margin);
        }
      }
    }
  }

  return {
    agreementPercent: observedAgreement * 100,
    kappa,
    sharedCount: n,
    kappaCi95Lower,
    kappaCi95Upper,
  };
};

export const calculateCohensKappa = (
  left: RecordStatus[],
  right: RecordStatus[],
): PairwiseMetricResult => calculateCohensKappaForLabels(
  left.map((value) => toStatusKey(value)),
  right.map((value) => toStatusKey(value)),
);

const toMappingQuestionLabel = (questionId: number, title: string | null): string => {
  const normalized = (title ?? "").trim();
  if (normalized.length > 0) {
    return normalized;
  }
  return `Question ${questionId}`;
};

const buildSortedMappingQuestionMeta = (
  options: PairwiseAgreementBuildOptions,
): PairwiseMappingQuestionMeta[] => {
  const byId = new Map<number, PairwiseMappingQuestionMeta>();
  for (const question of options.mappingQuestions ?? []) {
    byId.set(question.id, {
      id: question.id,
      label: toMappingQuestionLabel(question.id, question.title),
      position: Number.isInteger(question.position) ? question.position as number : Number.MAX_SAFE_INTEGER,
    });
  }

  for (const questionId of options.mappingOptionQuestionIdByOptionId?.values() ?? []) {
    if (!byId.has(questionId)) {
      byId.set(questionId, {
        id: questionId,
        label: `Question ${questionId}`,
        position: Number.MAX_SAFE_INTEGER,
      });
    }
  }

  return [...byId.values()].sort((left, right) =>
    left.position - right.position
    || left.label.localeCompare(right.label)
    || left.id - right.id);
};

const toMappingQuestionCategory = (
  mappingOptionIds: number[],
  mappingQuestionId: number,
  mappingOptionQuestionIdByOptionId: ReadonlyMap<number, number>,
): string => {
  const selectedOptionIds = mappingOptionIds.filter(
    (optionId) => mappingOptionQuestionIdByOptionId.get(optionId) === mappingQuestionId,
  );
  if (selectedOptionIds.length === 0) {
    return UNSET_MAPPING_TOKEN;
  }
  return selectedOptionIds.join(",");
};

const toMappingAllCategory = (
  mappingOptionIds: number[],
  mappingQuestions: PairwiseMappingQuestionMeta[],
  mappingOptionQuestionIdByOptionId: ReadonlyMap<number, number>,
): string => {
  if (mappingQuestions.length === 0) {
    return NO_MAPPING_QUESTIONS_TOKEN;
  }
  return mappingQuestions
    .map((question) =>
      `${question.id}:${toMappingQuestionCategory(mappingOptionIds, question.id, mappingOptionQuestionIdByOptionId)}`)
    .join(CATEGORY_SEPARATOR);
};

export const buildPairwiseAgreement = (
  assessments: ComparableAssessment[],
  userIds: number[],
  options: PairwiseAgreementBuildOptions = {},
): PairwiseAgreement[] => {
  const byUser = new Map<number, Map<number, ComparableAssessment>>();
  const mappingOptionQuestionIdByOptionId = options.mappingOptionQuestionIdByOptionId ?? new Map<number, number>();
  const mappingQuestions = buildSortedMappingQuestionMeta(options);

  for (const userId of userIds) {
    byUser.set(userId, new Map<number, ComparableAssessment>());
  }

  for (const assessment of assessments) {
    const bucket = byUser.get(assessment.userId);
    if (!bucket) {
      continue;
    }
    bucket.set(assessment.recordId, {
      ...assessment,
      mappingOptionIds: uniqueSortedInts(assessment.mappingOptionIds),
    });
  }

  const pairwise: PairwiseAgreement[] = [];
  for (let i = 0; i < userIds.length; i += 1) {
    for (let j = i + 1; j < userIds.length; j += 1) {
      const userIdA = userIds[i];
      const userIdB = userIds[j];
      const a = byUser.get(userIdA) ?? new Map<number, ComparableAssessment>();
      const b = byUser.get(userIdB) ?? new Map<number, ComparableAssessment>();

      const sharedRecordIds = [...a.keys()].filter((recordId) => b.has(recordId)).sort((left, right) => left - right);
      const leftSelections: ComparableAssessment[] = [];
      const rightSelections: ComparableAssessment[] = [];
      for (const recordId of sharedRecordIds) {
        const leftSelection = a.get(recordId);
        const rightSelection = b.get(recordId);
        if (!leftSelection || !rightSelection) {
          continue;
        }
        leftSelections.push(leftSelection);
        rightSelections.push(rightSelection);
      }

      const leftStatuses = leftSelections.map((selection) => selection.status);
      const rightStatuses = rightSelections.map((selection) => selection.status);
      const statusMetrics = calculateCohensKappa(leftStatuses, rightStatuses);
      pairwise.push({
        userIdA,
        userIdB,
        metricType: "status",
        metricKey: "status",
        metricLabel: "Status",
        mappingQuestionId: null,
        sharedCount: statusMetrics.sharedCount,
        agreementPercent: statusMetrics.agreementPercent,
        kappa: statusMetrics.kappa,
        kappaCi95Lower: statusMetrics.kappaCi95Lower,
        kappaCi95Upper: statusMetrics.kappaCi95Upper,
      });

      for (const question of mappingQuestions) {
        const leftQuestionCategories = leftSelections.map((selection) =>
          toMappingQuestionCategory(
            selection.mappingOptionIds,
            question.id,
            mappingOptionQuestionIdByOptionId,
          ));
        const rightQuestionCategories = rightSelections.map((selection) =>
          toMappingQuestionCategory(
            selection.mappingOptionIds,
            question.id,
            mappingOptionQuestionIdByOptionId,
          ));

        const questionMetrics = calculateCohensKappaForLabels(leftQuestionCategories, rightQuestionCategories);
        pairwise.push({
          userIdA,
          userIdB,
          metricType: "mapping_question",
          metricKey: `mapping_question:${question.id}`,
          metricLabel: `Mapping: ${question.label}`,
          mappingQuestionId: question.id,
          sharedCount: questionMetrics.sharedCount,
          agreementPercent: questionMetrics.agreementPercent,
          kappa: questionMetrics.kappa,
          kappaCi95Lower: questionMetrics.kappaCi95Lower,
          kappaCi95Upper: questionMetrics.kappaCi95Upper,
        });
      }

      const leftMappingSummary = leftSelections.map((selection) =>
        toMappingAllCategory(
          selection.mappingOptionIds,
          mappingQuestions,
          mappingOptionQuestionIdByOptionId,
        ));
      const rightMappingSummary = rightSelections.map((selection) =>
        toMappingAllCategory(
          selection.mappingOptionIds,
          mappingQuestions,
          mappingOptionQuestionIdByOptionId,
        ));
      const mappingSummaryMetrics = calculateCohensKappaForLabels(leftMappingSummary, rightMappingSummary);
      pairwise.push({
        userIdA,
        userIdB,
        metricType: "mapping_all",
        metricKey: "mapping_all",
        metricLabel: "Mapping (all questions)",
        mappingQuestionId: null,
        sharedCount: mappingSummaryMetrics.sharedCount,
        agreementPercent: mappingSummaryMetrics.agreementPercent,
        kappa: mappingSummaryMetrics.kappa,
        kappaCi95Lower: mappingSummaryMetrics.kappaCi95Lower,
        kappaCi95Upper: mappingSummaryMetrics.kappaCi95Upper,
      });

      const leftCombined = leftSelections.map((selection, index) =>
        `${toStatusKey(selection.status)}${CATEGORY_SEPARATOR}${leftMappingSummary[index]}`);
      const rightCombined = rightSelections.map((selection, index) =>
        `${toStatusKey(selection.status)}${CATEGORY_SEPARATOR}${rightMappingSummary[index]}`);
      const combinedMetrics = calculateCohensKappaForLabels(leftCombined, rightCombined);
      pairwise.push({
        userIdA,
        userIdB,
        metricType: "status_mapping_all",
        metricKey: "status_mapping_all",
        metricLabel: "Status + Mapping (all questions)",
        mappingQuestionId: null,
        sharedCount: combinedMetrics.sharedCount,
        agreementPercent: combinedMetrics.agreementPercent,
        kappa: combinedMetrics.kappa,
        kappaCi95Lower: combinedMetrics.kappaCi95Lower,
        kappaCi95Upper: combinedMetrics.kappaCi95Upper,
      });
    }
  }

  return pairwise;
};

export const buildDisagreements = (
  assessments: ComparableAssessment[],
  userIds: number[],
): AssessmentDisagreementItem[] => {
  const users = new Set(userIds);
  const byRecord = new Map<number, ComparableAssessment[]>();

  for (const assessment of assessments) {
    if (!users.has(assessment.userId)) {
      continue;
    }
    const bucket = byRecord.get(assessment.recordId) ?? [];
    bucket.push({
      ...assessment,
      mappingOptionIds: uniqueSortedInts(assessment.mappingOptionIds),
    });
    byRecord.set(assessment.recordId, bucket);
  }

  const disagreements: AssessmentDisagreementItem[] = [];
  for (const [recordId, recordAssessments] of byRecord.entries()) {
    if (recordAssessments.length < 2) {
      continue;
    }

    const values = [...recordAssessments].sort((left, right) => left.userId - right.userId);
    const base = values[0];
    const statusDisagreement = values.some((item) => item.status !== base.status);
    const mappingDisagreement = values.some((item) =>
      !arraysEqual(item.mappingOptionIds, base.mappingOptionIds));

    if (!(statusDisagreement || mappingDisagreement)) {
      continue;
    }

    disagreements.push({
      recordId,
      values: values.map((item) => ({
        userId: item.userId,
        status: item.status,
        comment: item.comment,
        mappingOptionIds: item.mappingOptionIds,
      })),
      statusDisagreement,
      mappingDisagreement,
    });
  }

  disagreements.sort((left, right) => left.recordId - right.recordId);
  return disagreements;
};
