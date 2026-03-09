import { normalizeIssn } from "./crossref";

const JUFO_BASE_URL = (process.env.JUFO_BASE_URL ?? "https://jufo-rest.csc.fi/v1.1").replace(/\/+$/, "");
const JUFO_TIMEOUT_MS = 10_000;
const JUFO_MAX_ATTEMPTS = 4;
const JUFO_MIN_DELAY_MS = Number.parseInt(process.env.JUFO_MIN_DELAY_MS ?? "500", 10);
const JUFO_MAX_DELAY_MS = Number.parseInt(process.env.JUFO_MAX_DELAY_MS ?? "1000", 10);

export type JufoLookupResult = {
  jufoId: number;
  jufoLevel: number | null;
  issn: string | null;
  name: string | null;
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

const sleep = async (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const boundedDelay = () => {
  const min = Number.isFinite(JUFO_MIN_DELAY_MS) ? JUFO_MIN_DELAY_MS : 500;
  const max = Number.isFinite(JUFO_MAX_DELAY_MS) ? JUFO_MAX_DELAY_MS : 1000;
  if (max <= min) {
    return clamp(min, 100, 10_000);
  }

  const random = Math.floor(Math.random() * (max - min + 1)) + min;
  return clamp(random, 100, 10_000);
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const collectStringValues = (value: unknown, accumulator: string[] = []): string[] => {
  if (typeof value === "string") {
    accumulator.push(value);
    return accumulator;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, accumulator);
    }
    return accumulator;
  }

  const object = asObject(value);
  if (!object) {
    return accumulator;
  }

  Object.values(object).forEach((entry) => {
    collectStringValues(entry, accumulator);
  });

  return accumulator;
};

const collectObjects = (value: unknown, accumulator: Record<string, unknown>[] = []) => {
  const object = asObject(value);
  if (!object) {
    if (Array.isArray(value)) {
      value.forEach((item) => collectObjects(item, accumulator));
    }
    return accumulator;
  }

  accumulator.push(object);
  Object.values(object).forEach((entry) => collectObjects(entry, accumulator));
  return accumulator;
};

const parseInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

const parseLevel = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 4) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 4) {
      return parsed;
    }
  }

  return null;
};

export const extractJufoChannelId = (payload: unknown): number | null => {
  const stringValues = collectStringValues(payload);
  for (const value of stringValues) {
    const match = value.match(/\/kanava\/(\d+)/);
    if (match?.[1]) {
      const id = Number.parseInt(match[1], 10);
      if (Number.isInteger(id) && id > 0) {
        return id;
      }
    }
  }

  const ID_KEYS = new Set(["id", "kanavaid", "kanava_id", "channelid", "channel_id", "tunniste"]);
  const objects = collectObjects(payload);
  for (const object of objects) {
    for (const [key, value] of Object.entries(object)) {
      if (!ID_KEYS.has(key.toLocaleLowerCase())) {
        continue;
      }
      const parsed = parseInteger(value);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
};

export const extractJufoLevel = (payload: unknown): number | null => {
  const CANDIDATE_KEYS = ["jufo", "taso", "luokka", "level"];
  const objects = collectObjects(payload);
  const levels: number[] = [];

  for (const object of objects) {
    for (const [key, value] of Object.entries(object)) {
      const lowered = key.toLocaleLowerCase();
      if (!CANDIDATE_KEYS.some((candidate) => lowered.includes(candidate))) {
        continue;
      }
      const parsed = parseLevel(value);
      if (parsed !== null) {
        levels.push(parsed);
      }
    }
  }

  if (levels.length === 0) {
    return null;
  }

  // Prefer highest recognized JuFo class from payload candidates.
  return Math.max(...levels);
};

export const extractJufoIssn = (payload: unknown): string | null => {
  const objects = collectObjects(payload);
  for (const object of objects) {
    for (const [key, value] of Object.entries(object)) {
      if (!key.toLocaleLowerCase().includes("issn")) {
        continue;
      }
      const normalized = normalizeIssn(typeof value === "string" ? value : null);
      if (normalized) {
        return normalized;
      }
    }
  }

  const values = collectStringValues(payload);
  for (const value of values) {
    const normalized = normalizeIssn(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

export const extractJufoName = (payload: unknown): string | null => {
  const CANDIDATE_KEYS = ["nimi", "name", "title", "kanava"];
  const objects = collectObjects(payload);
  for (const object of objects) {
    for (const [key, value] of Object.entries(object)) {
      const lowered = key.toLocaleLowerCase();
      if (!CANDIDATE_KEYS.some((candidate) => lowered.includes(candidate))) {
        continue;
      }
      if (typeof value !== "string") {
        continue;
      }
      const trimmed = value.trim();
      if (trimmed.length >= 3 && !trimmed.startsWith("http")) {
        return trimmed;
      }
    }
  }

  return null;
};

export class JufoClient {
  public requestCount = 0;

  private lastRequestAt = 0;

  private async waitForRequestSlot() {
    const now = Date.now();
    const next = this.lastRequestAt + boundedDelay();
    if (next > now) {
      await sleep(next - now);
    }
  }

  private async requestJson(path: string, params?: Record<string, string | number | undefined>) {
    const url = new URL(`${JUFO_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);
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

    while (attempt < JUFO_MAX_ATTEMPTS) {
      attempt += 1;
      await this.waitForRequestSlot();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), JUFO_TIMEOUT_MS);

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
          const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after")) ?? 600 * attempt;
          if (attempt < JUFO_MAX_ATTEMPTS) {
            await sleep(Math.min(30_000, retryAfterMs));
            continue;
          }
        }

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          const text = await response.text();
          throw new Error(`JUFO request failed with status ${response.status}: ${text.slice(0, 200)}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        if (attempt >= JUFO_MAX_ATTEMPTS) {
          throw error;
        }
        await sleep(350 * attempt);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError ?? new Error("JUFO request failed");
  }

  async lookupByIssn(issn: string): Promise<JufoLookupResult | null> {
    const normalizedIssn = normalizeIssn(issn);
    if (!normalizedIssn) {
      return null;
    }

    const searchPayload = await this.requestJson("/etsi.php", { issn: normalizedIssn });
    if (!searchPayload) {
      return null;
    }

    const jufoId = extractJufoChannelId(searchPayload);
    if (!jufoId) {
      return null;
    }

    const channelPayload = await this.requestJson(`/kanava/${jufoId}`);
    const level = extractJufoLevel(channelPayload);
    const parsedIssn = extractJufoIssn(channelPayload) ?? normalizedIssn;
    const name = extractJufoName(channelPayload);

    return {
      jufoId,
      jufoLevel: level,
      issn: parsedIssn,
      name,
    };
  }
}
