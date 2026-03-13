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

export const calculateCohensKappa = (left: RecordStatus[], right: RecordStatus[]) => {
  if (left.length !== right.length) {
    throw new Error("Cohen's Kappa inputs must have equal lengths");
  }

  const n = left.length;
  if (n === 0) {
    return { agreementPercent: 0, kappa: 0, sharedCount: 0 };
  }

  const matrix: Record<StatusKey, Record<StatusKey, number>> = {
    __NULL__: { __NULL__: 0, uncertain: 0, excluded: 0, included: 0 },
    uncertain: { __NULL__: 0, uncertain: 0, excluded: 0, included: 0 },
    excluded: { __NULL__: 0, uncertain: 0, excluded: 0, included: 0 },
    included: { __NULL__: 0, uncertain: 0, excluded: 0, included: 0 },
  };

  for (let i = 0; i < n; i += 1) {
    const leftKey = toStatusKey(left[i]);
    const rightKey = toStatusKey(right[i]);
    matrix[leftKey][rightKey] += 1;
  }

  let observedAgreement = 0;
  for (const key of STATUS_KEYS) {
    observedAgreement += matrix[key][key];
  }
  observedAgreement /= n;

  let expectedAgreement = 0;
  for (const key of STATUS_KEYS) {
    let rowTotal = 0;
    let columnTotal = 0;
    for (const other of STATUS_KEYS) {
      rowTotal += matrix[key][other];
      columnTotal += matrix[other][key];
    }
    expectedAgreement += (rowTotal / n) * (columnTotal / n);
  }

  const denominator = 1 - expectedAgreement;
  const rawKappa = denominator === 0 ? 1 : (observedAgreement - expectedAgreement) / denominator;

  return {
    agreementPercent: observedAgreement * 100,
    kappa: Number.isFinite(rawKappa) ? rawKappa : 0,
    sharedCount: n,
  };
};

export const buildPairwiseAgreement = (
  assessments: ComparableAssessment[],
  userIds: number[],
): PairwiseAgreement[] => {
  const byUser = new Map<number, Map<number, ComparableAssessment>>();

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
      const leftStatuses: RecordStatus[] = [];
      const rightStatuses: RecordStatus[] = [];
      for (const recordId of sharedRecordIds) {
        const leftSelection = a.get(recordId);
        const rightSelection = b.get(recordId);
        if (!leftSelection || !rightSelection) {
          continue;
        }
        leftStatuses.push(leftSelection.status);
        rightStatuses.push(rightSelection.status);
      }

      const metrics = calculateCohensKappa(leftStatuses, rightStatuses);
      pairwise.push({
        userIdA,
        userIdB,
        sharedCount: metrics.sharedCount,
        agreementPercent: metrics.agreementPercent,
        kappa: metrics.kappa,
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
    const commentDisagreement = values.some((item) => (item.comment ?? "") !== (base.comment ?? ""));
    const mappingDisagreement = values.some((item) =>
      !arraysEqual(item.mappingOptionIds, base.mappingOptionIds));

    if (!(statusDisagreement || commentDisagreement || mappingDisagreement)) {
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
      commentDisagreement,
    });
  }

  disagreements.sort((left, right) => left.recordId - right.recordId);
  return disagreements;
};
