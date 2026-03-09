export const sleep = async (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const parseRetryAfterMs = (retryAfterHeader: string | null) => {
  if (!retryAfterHeader) {
    return null;
  }

  const asSeconds = Number.parseInt(retryAfterHeader, 10);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const asDate = Date.parse(retryAfterHeader);
  if (Number.isNaN(asDate)) {
    return null;
  }

  return Math.max(0, asDate - Date.now());
};

const normalizeText = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const scoreTitleSimilarity = (left: string, right: string) => {
  const leftNorm = normalizeText(left);
  const rightNorm = normalizeText(right);
  if (leftNorm.length === 0 || rightNorm.length === 0) {
    return 0;
  }

  if (leftNorm === rightNorm) {
    return 1;
  }

  const leftTokens = new Set(leftNorm.split(" "));
  const rightTokens = new Set(rightNorm.split(" "));

  let overlap = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  });

  const denom = Math.max(leftTokens.size, rightTokens.size, 1);
  return overlap / denom;
};

export const parseAuthorFamilyFromText = (authorText: string | null | undefined) => {
  if (!authorText) {
    return null;
  }

  const normalized = authorText
    .split(/[;,]/)[0]
    ?.trim()
    .toLocaleLowerCase();

  if (!normalized) {
    return null;
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  return parts[0] ?? null;
};
