export type CommentValue = {
  userId: number;
  comment: string | null;
};

export const buildMergedResolvedComment = (
  values: CommentValue[],
  getUserName: (userId: number) => string,
) =>
  values
    .map((value) => {
      const trimmedComment = (value.comment ?? "").trim();
      if (trimmedComment.length === 0) {
        return null;
      }
      return `${getUserName(value.userId)}: ${trimmedComment}`;
    })
    .filter((line): line is string => line !== null)
    .join("\n");

export const formatKappaCi95 = (lower: number | null, upper: number | null) => {
  if (lower === null || upper === null || !Number.isFinite(lower) || !Number.isFinite(upper)) {
    return "n/a";
  }
  return `[${lower.toFixed(4)}, ${upper.toFixed(4)}]`;
};
