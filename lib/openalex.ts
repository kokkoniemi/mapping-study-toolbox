import { extractDoiFromText } from "./crossref";
import { parseAuthorFamilyFromText, parseRetryAfterMs, scoreTitleSimilarity, sleep } from "./enrichmentCommon";

const OPENALEX_BASE_URL = (process.env.OPENALEX_BASE_URL ?? "https://api.openalex.org").replace(/\/+$/, "");
const OPENALEX_API_KEY = process.env.OPENALEX_API_KEY?.trim() ?? "";
const OPENALEX_MAILTO = process.env.OPENALEX_MAILTO?.trim() ?? "";
const OPENALEX_TIMEOUT_MS = Number.parseInt(process.env.OPENALEX_TIMEOUT_MS ?? "20000", 10);
const OPENALEX_MAX_ATTEMPTS = Number.parseInt(process.env.OPENALEX_MAX_ATTEMPTS ?? "5", 10);
const OPENALEX_MIN_DELAY_MS = Number.parseInt(process.env.OPENALEX_MIN_DELAY_MS ?? "250", 10);
const OPENALEX_MAX_DELAY_MS = Number.parseInt(
  process.env.OPENALEX_MAX_DELAY_MS ?? String(Math.max(OPENALEX_MIN_DELAY_MS, 800)),
  10,
);
const OPENALEX_SEARCH_MIN_TITLE_SCORE = Number.parseFloat(
  process.env.OPENALEX_SEARCH_MIN_TITLE_SCORE ?? "0.92",
);

type OpenAlexSourceRaw = {
  display_name?: string;
};

type OpenAlexLocationRaw = {
  landing_page_url?: string;
  source?: OpenAlexSourceRaw;
};

type OpenAlexAuthorRaw = {
  display_name?: string;
};

type OpenAlexInstitutionRaw = {
  display_name?: string;
};

type OpenAlexAuthorshipRaw = {
  author?: OpenAlexAuthorRaw;
  institutions?: OpenAlexInstitutionRaw[];
};

type OpenAlexTopicEntityRaw = {
  display_name?: string;
};

type OpenAlexTopicRaw = {
  id?: string;
  display_name?: string;
  score?: number;
  subfield?: OpenAlexTopicEntityRaw;
  field?: OpenAlexTopicEntityRaw;
  domain?: OpenAlexTopicEntityRaw;
};

export type OpenAlexWorkRaw = {
  id?: string;
  doi?: string;
  title?: string;
  publication_year?: number;
  cited_by_count?: number;
  primary_location?: OpenAlexLocationRaw | null;
  locations?: OpenAlexLocationRaw[];
  referenced_works?: string[];
  topics?: OpenAlexTopicRaw[];
  primary_topic?: OpenAlexTopicRaw | null;
  authorships?: OpenAlexAuthorshipRaw[];
};

type OpenAlexListResponse<TItem> = {
  results?: TItem[];
  meta?: {
    count?: number;
    next_cursor?: string | null;
  };
};

export type OpenAlexReferenceItem = {
  openAlexId: string | null;
  doi: string | null;
  title: string | null;
  year: number | null;
  url: string | null;
  forum: string | null;
  citedByCount: number | null;
};

export type OpenAlexTopicItem = {
  id: string | null;
  displayName: string | null;
  score: number | null;
  subfield: string | null;
  field: string | null;
  domain: string | null;
};

export type OpenAlexResolvedWork = {
  openAlexId: string | null;
  doi: string | null;
  title: string | null;
  year: number | null;
  citationCount: number | null;
  url: string | null;
  forum: string | null;
  topics: OpenAlexTopicItem[];
  authorAffiliations: string[];
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const normalizeOpenAlexId = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("https://openalex.org/")) {
    return trimmed;
  }

  if (/^[WASCFI]\d+$/i.test(trimmed)) {
    return `https://openalex.org/${trimmed.toUpperCase()}`;
  }

  return null;
};

const shortOpenAlexId = (value: string | null | undefined) => {
  const normalized = normalizeOpenAlexId(value);
  if (!normalized) {
    return null;
  }
  return normalized.replace("https://openalex.org/", "");
};

const sanitizeDoi = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const extracted = extractDoiFromText(value);
  if (extracted) {
    return extracted;
  }

  const fallback = value.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  return fallback.length > 0 ? fallback : null;
};

const scoreAuthorSimilarity = (queryAuthor: string | null | undefined, work: OpenAlexWorkRaw) => {
  const queryFamily = parseAuthorFamilyFromText(queryAuthor);
  if (!queryFamily) {
    return 0;
  }

  const families = (work.authorships ?? [])
    .map((item) => item.author?.display_name?.toLocaleLowerCase().trim())
    .filter((item): item is string => Boolean(item))
    .map((fullName) => {
      const parts = fullName.split(/\s+/);
      return parts[parts.length - 1] ?? fullName;
    });

  if (families.length === 0) {
    return 0;
  }

  if (families.includes(queryFamily)) {
    return 1;
  }

  return families.some((family) => family.includes(queryFamily) || queryFamily.includes(family)) ? 0.5 : 0;
};

export const pickBestOpenAlexSearchWork = (
  title: string,
  author: string | null | undefined,
  items: OpenAlexWorkRaw[],
): OpenAlexWorkRaw | null => {
  if (items.length === 0) {
    return null;
  }

  const scored = items
    .map((item) => {
      const candidateTitle = item.title ?? "";
      const titleScore = scoreTitleSimilarity(title, candidateTitle);
      const authorScore = scoreAuthorSimilarity(author, item);
      return { item, titleScore, authorScore, score: titleScore * 100 + authorScore * 8 };
    })
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (!best) {
    return null;
  }

  if (best.titleScore < OPENALEX_SEARCH_MIN_TITLE_SCORE) {
    return null;
  }

  const second = scored[1];
  if (second) {
    const ambiguous = best.score - second.score < 6 && best.titleScore < 0.95;
    if (ambiguous) {
      return null;
    }
  }

  return best.item;
};

const normalizeTopic = (topic: OpenAlexTopicRaw): OpenAlexTopicItem => ({
  id: normalizeOpenAlexId(topic.id),
  displayName: topic.display_name?.trim() || null,
  score: typeof topic.score === "number" ? topic.score : null,
  subfield: topic.subfield?.display_name?.trim() || null,
  field: topic.field?.display_name?.trim() || null,
  domain: topic.domain?.display_name?.trim() || null,
});

const uniqueStrings = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }

  return result;
};

const workToSummary = (work: OpenAlexWorkRaw): OpenAlexReferenceItem => {
  const doi = sanitizeDoi(work.doi);
  const forum =
    work.primary_location?.source?.display_name?.trim()
    || work.locations?.find((location) => location.source?.display_name)?.source?.display_name?.trim()
    || null;
  const locationUrl = work.primary_location?.landing_page_url?.trim();

  return {
    openAlexId: normalizeOpenAlexId(work.id),
    doi,
    title: work.title?.trim() || null,
    year: typeof work.publication_year === "number" ? work.publication_year : null,
    url: locationUrl || (doi ? `https://doi.org/${doi}` : null),
    forum,
    citedByCount: typeof work.cited_by_count === "number" ? work.cited_by_count : null,
  };
};

const workToResolved = (work: OpenAlexWorkRaw): OpenAlexResolvedWork => {
  const summary = workToSummary(work);
  const topicsRaw = work.topics && work.topics.length > 0 ? work.topics : work.primary_topic ? [work.primary_topic] : [];
  const authorAffiliations = uniqueStrings(
    (work.authorships ?? []).flatMap((authorship) =>
      (authorship.institutions ?? []).map((institution) => institution.display_name?.trim() || null),
    ),
  );

  return {
    openAlexId: summary.openAlexId,
    doi: summary.doi,
    title: summary.title,
    year: summary.year,
    citationCount: summary.citedByCount,
    url: summary.url,
    forum: summary.forum,
    topics: topicsRaw.map(normalizeTopic),
    authorAffiliations,
  };
};

export class OpenAlexClient {
  public requestCount = 0;

  private lastRequestAt = 0;

  private readonly defaultSelect =
    "id,doi,title,publication_year,cited_by_count,primary_location,locations,topics,primary_topic,authorships";

  private async waitForRequestSlot() {
    const now = Date.now();
    const delay = OPENALEX_MAX_DELAY_MS > OPENALEX_MIN_DELAY_MS
      ? Math.floor(Math.random() * (OPENALEX_MAX_DELAY_MS - OPENALEX_MIN_DELAY_MS + 1)) + OPENALEX_MIN_DELAY_MS
      : OPENALEX_MIN_DELAY_MS;
    const next = this.lastRequestAt + delay;
    if (next > now) {
      await sleep(next - now);
    }
  }

  private withCommonParams(url: URL) {
    if (OPENALEX_MAILTO) {
      url.searchParams.set("mailto", OPENALEX_MAILTO);
    }
    if (OPENALEX_API_KEY) {
      url.searchParams.set("api_key", OPENALEX_API_KEY);
    }
  }

  private async requestJson<TResponse>(path: string, params?: Record<string, string | number | undefined>) {
    if (!OPENALEX_API_KEY) {
      throw new Error("OPENALEX_API_KEY is not set");
    }

    const url = new URL(`${OPENALEX_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
    this.withCommonParams(url);
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

    while (attempt < OPENALEX_MAX_ATTEMPTS) {
      attempt += 1;
      await this.waitForRequestSlot();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OPENALEX_TIMEOUT_MS);

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
          const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after")) ?? 900 * attempt;
          if (attempt < OPENALEX_MAX_ATTEMPTS) {
            await sleep(Math.min(45_000, retryAfterMs));
            continue;
          }
        }

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          const text = await response.text();
          throw new Error(`OpenAlex request failed with status ${response.status}: ${text.slice(0, 200)}`);
        }

        return (await response.json()) as TResponse;
      } catch (error) {
        lastError = error;
        if (attempt >= OPENALEX_MAX_ATTEMPTS) {
          throw error;
        }
        await sleep(350 * attempt);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError ?? new Error("OpenAlex request failed");
  }

  async fetchWorkByDoi(doi: string): Promise<OpenAlexResolvedWork | null> {
    const normalizedDoi = sanitizeDoi(doi);
    if (!normalizedDoi) {
      return null;
    }

    const payload = await this.requestJson<OpenAlexListResponse<OpenAlexWorkRaw>>("/works", {
      filter: `doi:${normalizedDoi}`,
      "per-page": 1,
      select: this.defaultSelect,
    });
    const work = payload?.results?.[0];
    if (!work) {
      return null;
    }
    return workToResolved(work);
  }

  async searchWorkByTitleAndAuthor(title: string, author?: string | null): Promise<OpenAlexResolvedWork | null> {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return null;
    }

    const payload = await this.requestJson<OpenAlexListResponse<OpenAlexWorkRaw>>("/works", {
      search: trimmedTitle,
      "per-page": 10,
      select: this.defaultSelect,
    });

    const work = pickBestOpenAlexSearchWork(trimmedTitle, author, payload?.results ?? []);
    if (!work) {
      return null;
    }
    return workToResolved(work);
  }

  async fetchWorkById(openAlexId: string): Promise<OpenAlexReferenceItem | null> {
    const shortId = shortOpenAlexId(openAlexId);
    if (!shortId) {
      return null;
    }

    const payload = await this.requestJson<OpenAlexWorkRaw>(`/works/${encodeURIComponent(shortId)}`, {
      select: "id,doi,title,publication_year,cited_by_count,primary_location,locations",
    });
    if (!payload) {
      return null;
    }

    return workToSummary(payload);
  }

  async fetchReferencesByWorkIds(workIds: string[], limit: number): Promise<OpenAlexReferenceItem[]> {
    const capped = clamp(limit, 0, 300);
    if (capped === 0 || workIds.length === 0) {
      return [];
    }

    const summaries: OpenAlexReferenceItem[] = [];
    for (const workId of workIds.slice(0, capped)) {
      const item = await this.fetchWorkById(workId);
      if (item) {
        summaries.push(item);
      }
    }

    return summaries;
  }

  async fetchCitationsForWork(openAlexId: string, limit?: number | null): Promise<OpenAlexReferenceItem[]> {
    const shortId = shortOpenAlexId(openAlexId);
    const capped =
      typeof limit === "number" && Number.isFinite(limit)
        ? clamp(limit, 0, 50_000)
        : null;
    if (!shortId || capped === 0) {
      return [];
    }

    const output: OpenAlexReferenceItem[] = [];
    let cursor = "*";

    while (capped === null || output.length < capped) {
      const perPage = capped === null ? 100 : Math.min(100, capped - output.length);
      const payload = await this.requestJson<OpenAlexListResponse<OpenAlexWorkRaw>>("/works", {
        filter: `cites:${shortId}`,
        cursor,
        "per-page": perPage,
        select: "id,doi,title,publication_year,cited_by_count,primary_location,locations",
      });

      const works = payload?.results ?? [];
      if (works.length === 0) {
        break;
      }

      output.push(...works.map(workToSummary));
      const nextCursor = payload?.meta?.next_cursor;
      if (!nextCursor) {
        break;
      }
      cursor = nextCursor;
    }

    return capped === null ? output : output.slice(0, capped);
  }
}
