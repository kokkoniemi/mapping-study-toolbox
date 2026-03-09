import db from "../models";
import { extractIssnFromWork, normalizeIssn, type CrossrefWork } from "./crossref";
import type { ForumSnapshot, JobContext } from "./enrichmentTypes";

const JUFO_REFRESH_MS = Number.parseInt(process.env.JUFO_REFRESH_MS ?? String(1000 * 60 * 60 * 24 * 30), 10);

const normalizeName = (value: string | null | undefined) =>
  value
    ?.toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim() ?? "";

const uniqueNames = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeName(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(value);
  }

  return result;
};

const pickForumName = (work: CrossrefWork) => {
  const fromContainer = (work["container-title"] ?? []).find((item) => item?.trim().length > 0)?.trim();
  if (fromContainer) {
    return fromContainer;
  }

  const fromShort = (work["short-container-title"] ?? []).find((item) => item?.trim().length > 0)?.trim();
  return fromShort || null;
};

const shouldRefreshJufo = (fetchedAt: Date | null) => {
  if (!fetchedAt) {
    return true;
  }

  const age = Date.now() - fetchedAt.getTime();
  return age > JUFO_REFRESH_MS;
};

export const toForumSnapshot = (
  value: unknown,
): ForumSnapshot | null => {
  const forum = value as
    | {
        id?: unknown;
        name?: unknown;
        issn?: unknown;
        jufoLevel?: unknown;
        jufoFetchedAt?: unknown;
        jufoLastError?: unknown;
        update?: unknown;
      }
    | null
    | undefined;

  if (!forum || typeof forum !== "object") {
    return null;
  }

  const id = typeof forum.id === "number" ? forum.id : Number.NaN;
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  const updateFn = forum.update;
  if (typeof updateFn !== "function") {
    return null;
  }

  const fetchedAt =
    forum.jufoFetchedAt instanceof Date
      ? forum.jufoFetchedAt
      : typeof forum.jufoFetchedAt === "string"
        ? new Date(forum.jufoFetchedAt)
        : null;

  const boundUpdate = (values: Record<string, unknown>) =>
    (updateFn as (this: unknown, values: Record<string, unknown>) => Promise<unknown>).call(
      forum,
      values,
    );

  return {
    id,
    name: typeof forum.name === "string" ? forum.name : null,
    issn: normalizeIssn(typeof forum.issn === "string" ? forum.issn : null),
    jufoLevel: typeof forum.jufoLevel === "number" ? forum.jufoLevel : null,
    jufoFetchedAt: fetchedAt && !Number.isNaN(fetchedAt.getTime()) ? fetchedAt : null,
    jufoLastError: typeof forum.jufoLastError === "string" ? forum.jufoLastError : null,
    update: boundUpdate,
  };
};

export const updateForumFromWork = async (
  record: { forumId?: number | null; Forum?: Record<string, unknown> | null },
  work: CrossrefWork,
) => {
  const forumName = pickForumName(work);
  const publisher = work.publisher?.trim() || null;
  const issn = extractIssnFromWork(work);

  if (!forumName && !publisher && !issn) {
    return toForumSnapshot(record.Forum);
  }

  const currentForum = record.Forum as
    | (Record<string, unknown> & {
        id: number;
        name?: string | null;
        alternateNames?: string[] | null;
        publisher?: string | null;
        issn?: string | null;
        jufoLevel?: number | null;
        jufoFetchedAt?: Date | string | null;
        jufoLastError?: string | null;
        update?: (values: Record<string, unknown>) => Promise<unknown>;
      })
    | null
    | undefined;

  if (currentForum?.id) {
    const updatePayload: Record<string, unknown> = {};
    const currentName = typeof currentForum.name === "string" ? currentForum.name : null;

    if (!currentName && forumName) {
      updatePayload.name = forumName;
    } else if (currentName && forumName && normalizeName(currentName) !== normalizeName(forumName)) {
      const alternates = Array.isArray(currentForum.alternateNames) ? currentForum.alternateNames : [];
      updatePayload.alternateNames = uniqueNames([...alternates, forumName]);
    }

    if (publisher && currentForum.publisher !== publisher) {
      updatePayload.publisher = publisher;
    }

    if (issn && normalizeIssn(currentForum.issn) !== issn) {
      updatePayload.issn = issn;
    }

    if (Object.keys(updatePayload).length > 0 && currentForum.update) {
      await currentForum.update(updatePayload);
    }
    const updateFn = currentForum.update;
    const boundUpdate =
      typeof updateFn === "function"
        ? (values: Record<string, unknown>) =>
            (updateFn as (this: unknown, values: Record<string, unknown>) => Promise<unknown>).call(
              currentForum,
              values,
            )
        : null;

    if (!boundUpdate) {
      return null;
    }

    return {
      id: currentForum.id,
      name: updatePayload.name as string | null | undefined ?? currentForum.name ?? null,
      issn: (updatePayload.issn as string | undefined) ?? normalizeIssn(currentForum.issn) ?? null,
      jufoLevel: currentForum.jufoLevel ?? null,
      jufoFetchedAt:
        currentForum.jufoFetchedAt instanceof Date
          ? currentForum.jufoFetchedAt
          : typeof currentForum.jufoFetchedAt === "string"
            ? new Date(currentForum.jufoFetchedAt)
            : null,
      jufoLastError: currentForum.jufoLastError ?? null,
      update: boundUpdate,
    } satisfies ForumSnapshot;
  }

  const existingForum =
    forumName
      ? await db.Forum.findOne({
          where: { name: forumName },
        })
      : null;

  if (existingForum) {
    const updatePayload: Record<string, unknown> = {};
    if (publisher && existingForum.publisher !== publisher) {
      updatePayload.publisher = publisher;
    }
    if (issn && normalizeIssn(existingForum.issn) !== issn) {
      updatePayload.issn = issn;
    }
    if (Object.keys(updatePayload).length > 0) {
      await existingForum.update(updatePayload);
    }
    return {
      id: existingForum.id,
      name: existingForum.name ?? null,
      issn: normalizeIssn((updatePayload.issn as string | undefined) ?? existingForum.issn) ?? null,
      jufoLevel: existingForum.jufoLevel ?? null,
      jufoFetchedAt: existingForum.jufoFetchedAt ?? null,
      jufoLastError: existingForum.jufoLastError ?? null,
      update: existingForum.update.bind(existingForum),
    };
  }

  if (!forumName) {
    return null;
  }

  const created = await db.Forum.create({
    name: forumName,
    publisher,
    issn,
  });
  return {
    id: created.id,
    name: created.name ?? null,
    issn: normalizeIssn(created.issn) ?? null,
    jufoLevel: created.jufoLevel ?? null,
    jufoFetchedAt: created.jufoFetchedAt ?? null,
    jufoLastError: created.jufoLastError ?? null,
    update: created.update.bind(created),
  };
};

export const enrichForumWithJufo = async (
  forum: ForumSnapshot | null,
  context: JobContext,
): Promise<{ message: string | null }> => {
  if (!forum) {
    return { message: null };
  }

  if (context.jufoProcessedForumIds.has(forum.id)) {
    return { message: null };
  }

  context.jufoProcessedForumIds.add(forum.id);
  context.metrics.jufo.records += 1;

  const issn = normalizeIssn(forum.issn);
  if (!issn) {
    await forum.update({
      jufoFetchedAt: new Date(),
      jufoLastError: "No ISSN available for JUFO lookup",
    });
    return { message: "No ISSN available for JUFO lookup" };
  }

  if (!shouldRefreshJufo(forum.jufoFetchedAt)) {
    return { message: null };
  }

  let lookup = context.jufoByIssn.get(issn);
  if (lookup === undefined) {
    lookup = await context.jufoClient.lookupByIssn(issn);
    context.jufoByIssn.set(issn, lookup ?? null);
  }

  if (!lookup) {
    await forum.update({
      jufoFetchedAt: new Date(),
      jufoLastError: `JUFO lookup not found for ISSN ${issn}`,
    });
    return { message: `JUFO lookup not found for ISSN ${issn}` };
  }

  const updatePayload: Record<string, unknown> = {
    jufoFetchedAt: new Date(),
    jufoLastError: null,
    jufoId: lookup.jufoId,
    ...(lookup.jufoLevel !== null ? { jufoLevel: lookup.jufoLevel } : {}),
    ...(lookup.issn ? { issn: normalizeIssn(lookup.issn) } : {}),
    ...(lookup.name && !forum.name ? { name: lookup.name } : {}),
  };

  await forum.update(updatePayload);
  return { message: null };
};
