export const sleep = async (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
};

export const decodeHtmlEntities = (value: string) =>
  value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g, (match, entity) => {
    const token = String(entity);
    if (token.startsWith("#x") || token.startsWith("#X")) {
      const codePoint = Number.parseInt(token.slice(2), 16);
      if (!Number.isFinite(codePoint) || codePoint <= 0) {
        return match;
      }
      return String.fromCodePoint(codePoint);
    }
    if (token.startsWith("#")) {
      const codePoint = Number.parseInt(token.slice(1), 10);
      if (!Number.isFinite(codePoint) || codePoint <= 0) {
        return match;
      }
      return String.fromCodePoint(codePoint);
    }

    return HTML_ENTITY_MAP[token.toLocaleLowerCase()] ?? match;
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

export const normalizeDoiValue = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/[)\].,;]+$/, "")
    .trim();

  return normalized.length > 0 ? normalized : null;
};

export const toDateOrNull = (value: unknown): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export const toPlainObject = (record: unknown): Record<string, unknown> => {
  const asRecord = record as { toJSON?: () => unknown; get?: (opts?: unknown) => unknown };
  if (typeof asRecord.toJSON === "function") {
    return asRecord.toJSON() as Record<string, unknown>;
  }
  if (typeof asRecord.get === "function") {
    return asRecord.get({ plain: true }) as Record<string, unknown>;
  }
  return record as Record<string, unknown>;
};
