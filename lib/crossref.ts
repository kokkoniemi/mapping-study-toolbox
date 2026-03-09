const CROSSREF_BASE_URL = (process.env.CROSSREF_BASE_URL ?? "https://api.crossref.org").replace(/\/+$/, "");
const CROSSREF_MAILTO = process.env.CROSSREF_MAILTO?.trim() ?? "";
const CROSSREF_TIMEOUT_MS = 20_000;
const CROSSREF_MAX_ATTEMPTS = 5;
const CROSSREF_MIN_DELAY_MS = 150;
const CROSSREF_SEARCH_MIN_TITLE_SCORE = Number.parseFloat(
  process.env.CROSSREF_SEARCH_MIN_TITLE_SCORE ?? "0.80",
);

const DOI_REGEX = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;

type CrossrefResponse<TMessage> = {
  status: string;
  message: TMessage;
};

export type CrossrefAuthorRaw = {
  given?: string;
  family?: string;
  name?: string;
  sequence?: string;
  ORCID?: string;
  affiliation?: Array<{ name?: string }>;
};

export type CrossrefReferenceRaw = {
  DOI?: string;
  key?: string;
  unstructured?: string;
  author?: string;
  year?: string;
  volume?: string;
  "first-page"?: string;
  "article-title"?: string;
  "journal-title"?: string;
};

export type CrossrefWork = {
  DOI?: string;
  title?: string[];
  author?: CrossrefAuthorRaw[];
  reference?: CrossrefReferenceRaw[];
  publisher?: string;
  ISSN?: string[];
  "issn-type"?: Array<{ value?: string; type?: string }>;
  "container-title"?: string[];
  "short-container-title"?: string[];
};

type CrossrefSearchMessage = {
  items?: CrossrefWork[];
};

const sleep = async (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const normalizeText = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const scoreTitleSimilarity = (left: string, right: string) => {
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

const authorFamilyFromText = (authorText: string | null | undefined) => {
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

  // "Family, Given" and "Given Family" are both used in source data.
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  return parts[0] ?? null;
};

const scoreAuthorSimilarity = (queryAuthor: string | null | undefined, work: CrossrefWork) => {
  const queryFamily = authorFamilyFromText(queryAuthor);
  if (!queryFamily) {
    return 0;
  }

  const families = (work.author ?? [])
    .map((item) => item.family?.toLocaleLowerCase().trim())
    .filter((item): item is string => Boolean(item));

  if (families.length === 0) {
    return 0;
  }

  if (families.includes(queryFamily)) {
    return 1;
  }

  return families.some((family) => family.includes(queryFamily) || queryFamily.includes(family)) ? 0.5 : 0;
};

const parseRetryAfterMs = (retryAfterHeader: string | null) => {
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

const sanitizeDoi = (value: string) =>
  value
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/[)\].,;]+$/, "");

const normalizeIssnCandidate = (value: string) => value.toUpperCase().replace(/[^0-9X]/g, "");

export const normalizeIssn = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const compact = normalizeIssnCandidate(value);
  if (!/^\d{7}[\dX]$/.test(compact)) {
    return null;
  }

  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
};

export const extractIssnFromWork = (work: CrossrefWork): string | null => {
  const candidates = [
    ...(work.ISSN ?? []),
    ...((work["issn-type"] ?? []).map((item) => item.value ?? "")),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeIssn(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

export const extractDoiFromText = (input: string | null | undefined): string | null => {
  if (!input) {
    return null;
  }

  let decoded = input;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    decoded = input;
  }
  const match = decoded.match(DOI_REGEX);
  if (!match || !match[0]) {
    return null;
  }

  return sanitizeDoi(match[0]);
};

export const extractDoiFromRecordUrls = (
  url: string | null | undefined,
  alternateUrls: string[] | null | undefined,
) => {
  const candidates: string[] = [];
  if (typeof url === "string" && url.trim().length > 0) {
    candidates.push(url);
  }
  if (Array.isArray(alternateUrls)) {
    for (const item of alternateUrls) {
      if (typeof item === "string" && item.trim().length > 0) {
        candidates.push(item);
      }
    }
  }

  for (const candidate of candidates) {
    const doi = extractDoiFromText(candidate);
    if (doi) {
      return doi;
    }
  }

  return null;
};

export const pickBestSearchWork = (
  title: string,
  author: string | null | undefined,
  items: CrossrefWork[],
): CrossrefWork | null => {
  if (items.length === 0) {
    return null;
  }

  const scored = items
    .map((item) => {
      const candidateTitle = item.title?.[0] ?? "";
      const titleScore = scoreTitleSimilarity(title, candidateTitle);
      const authorScore = scoreAuthorSimilarity(author, item);
      return { item, titleScore, authorScore, score: titleScore * 100 + authorScore * 8 };
    })
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (!best) {
    return null;
  }

  if (best.titleScore < CROSSREF_SEARCH_MIN_TITLE_SCORE) {
    return null;
  }

  const second = scored[1];
  if (second) {
    const ambiguous = best.score - second.score < 6 && best.titleScore < 0.85;
    if (ambiguous) {
      return null;
    }
  }

  return best.item;
};

export class CrossrefClient {
  public requestCount = 0;

  private lastRequestAt = 0;

  private async waitForRequestSlot() {
    const now = Date.now();
    const next = this.lastRequestAt + CROSSREF_MIN_DELAY_MS;
    if (next > now) {
      await sleep(next - now);
    }
  }

  private async requestJson<TMessage>(path: string, params?: Record<string, string | number | undefined>) {
    const url = new URL(`${CROSSREF_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
    if (CROSSREF_MAILTO) {
      url.searchParams.set("mailto", CROSSREF_MAILTO);
    }
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value === undefined) {
          return;
        }
        url.searchParams.set(key, String(value));
      });
    }

    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < CROSSREF_MAX_ATTEMPTS) {
      attempt += 1;
      await this.waitForRequestSlot();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CROSSREF_TIMEOUT_MS);

      try {
        this.requestCount += 1;
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "mapping-study-toolbox/0.1",
          },
          signal: controller.signal,
        });
        this.lastRequestAt = Date.now();

        if (response.status === 429 || response.status === 503) {
          const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after")) ?? 700 * attempt;
          if (attempt < CROSSREF_MAX_ATTEMPTS) {
            await sleep(Math.min(30_000, retryAfterMs));
            continue;
          }
        }

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          const text = await response.text();
          throw new Error(`Crossref request failed with status ${response.status}: ${text.slice(0, 200)}`);
        }

        return (await response.json()) as CrossrefResponse<TMessage>;
      } catch (error) {
        lastError = error;
        if (attempt >= CROSSREF_MAX_ATTEMPTS) {
          throw error;
        }
        await sleep(300 * attempt);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError ?? new Error("Crossref request failed");
  }

  async fetchWorkByDoi(doi: string): Promise<CrossrefWork | null> {
    const normalizedDoi = sanitizeDoi(doi);
    if (!normalizedDoi) {
      return null;
    }

    const payload = await this.requestJson<CrossrefWork>(`/works/${encodeURIComponent(normalizedDoi)}`);
    if (!payload) {
      return null;
    }
    return payload.message;
  }

  async searchWorkByTitleAndAuthor(title: string, author?: string | null): Promise<CrossrefWork | null> {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return null;
    }

    const payload = await this.requestJson<CrossrefSearchMessage>("/works", {
      "query.title": trimmedTitle,
      "query.author": author?.trim() || undefined,
      rows: 8,
    });

    const items = payload?.message?.items ?? [];
    return pickBestSearchWork(trimmedTitle, author, items);
  }
}
