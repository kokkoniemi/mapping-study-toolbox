import type {
  EnrichmentConfidenceLevel,
  EnrichmentFieldProvenance,
  EnrichmentMode,
  EnrichmentProvenanceMap,
} from "../shared/contracts";

type ProvenanceInput = {
  provider: EnrichmentFieldProvenance["provider"];
  confidenceScore: number;
  reason: string;
  source?: string | null;
  mode: EnrichmentMode;
  enrichedAt?: Date;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export const confidenceLevelFromScore = (score: number): EnrichmentConfidenceLevel => {
  if (score >= 90) {
    return "high";
  }
  if (score >= 70) {
    return "medium";
  }
  return "low";
};

export const buildFieldProvenance = ({
  provider,
  confidenceScore,
  reason,
  source = null,
  mode,
  enrichedAt = new Date(),
}: ProvenanceInput): EnrichmentFieldProvenance => {
  const score = clampScore(confidenceScore);
  return {
    provider,
    confidenceScore: score,
    confidenceLevel: confidenceLevelFromScore(score),
    reason,
    source,
    mode,
    enrichedAt: enrichedAt.toISOString(),
  };
};

export const mergeProvenance = (
  current: EnrichmentProvenanceMap | null | undefined,
  updates: EnrichmentProvenanceMap,
): EnrichmentProvenanceMap | null => {
  const merged: EnrichmentProvenanceMap = {
    ...(current ?? {}),
    ...updates,
  };

  return Object.keys(merged).length > 0 ? merged : null;
};
