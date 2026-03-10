import type { Request, Response } from "express";
import { Op } from "sequelize";

import { badRequest, notFound } from "../lib/http";
import { assertAllowedKeys, parseInteger, parseIntegerArray, parseObject, parseString } from "../lib/validation";
import db from "../models";
import type { EnrichmentProvenanceMap, ForumDuplicateGroup, ForumDuplicateItem } from "../shared/contracts";

type ForumLike = {
  id: number;
  name: string | null;
  alternateNames: string[] | null;
  issn: string | null;
  publisher: string | null;
  jufoLevel: number | null;
  jufoId: number | null;
  enrichmentProvenance: EnrichmentProvenanceMap | null;
};

const normalizeName = (value: string | null | undefined) =>
  value?.toLocaleLowerCase().replace(/\s+/g, " ").trim() ?? "";

const normalizeIssn = (value: string | null | undefined) =>
  value?.toLocaleUpperCase().replace(/[^0-9X]/g, "").trim() ?? "";

const uniqueNames = (values: Array<string | null | undefined>) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) {
      continue;
    }
    const normalized = normalizeName(trimmed);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(trimmed);
  }

  return result;
};

const parseOptionalBoolean = (value: unknown, key: string) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLocaleLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  throw badRequest(`${key} must be a boolean`);
};

const duplicateGroupPriority = (group: ForumDuplicateGroup) => {
  if (group.issn) {
    return 2;
  }
  if (group.normalizedName) {
    return 1;
  }
  return 0;
};

const shouldReplaceDuplicateGroup = (current: ForumDuplicateGroup, candidate: ForumDuplicateGroup) => {
  const currentPriority = duplicateGroupPriority(current);
  const candidatePriority = duplicateGroupPriority(candidate);
  if (candidatePriority !== currentPriority) {
    return candidatePriority > currentPriority;
  }
  return candidate.key.localeCompare(current.key) < 0;
};

const mergeProvenance = (target: EnrichmentProvenanceMap | null, sources: ForumLike[]) => {
  const merged: EnrichmentProvenanceMap = { ...(target ?? {}) };
  for (const source of sources) {
    const sourceMap = source.enrichmentProvenance ?? {};
    for (const [field, value] of Object.entries(sourceMap)) {
      if (!(field in merged) && value) {
        merged[field] = value;
      }
    }
  }
  return Object.keys(merged).length > 0 ? merged : null;
};

export const listDuplicates = async (req: Request, res: Response) => {
  const offset = parseInteger(req.query.offset, "offset", { defaultValue: 0, min: 0 });
  const limit = parseInteger(req.query.limit, "limit", { defaultValue: 25, min: 1, max: 200 });
  const search = parseString(req.query.search, "search", {
    optional: true,
    trim: true,
    maxLength: 200,
  });

  const forums = (await db.Forum.findAll({
    attributes: [
      "id",
      "name",
      "alternateNames",
      "issn",
      "publisher",
      "jufoLevel",
    ],
    order: [["name", "ASC"]],
  })) as Array<ForumLike>;

  if (forums.length === 0) {
    return res.send({ count: 0, groups: [] });
  }

  const forumIds = forums.map((forum) => forum.id);
  const recordCountsRaw = (await db.Record.findAll({
    attributes: [
      "forumId",
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "recordCount"],
    ],
    where: {
      forumId: {
        [Op.in]: forumIds,
      },
    },
    group: ["forumId"],
    raw: true,
  })) as unknown as Array<{ forumId: number; recordCount: string | number }>;

  const recordCountByForumId = new Map<number, number>();
  for (const item of recordCountsRaw) {
    recordCountByForumId.set(item.forumId, Number(item.recordCount) || 0);
  }

  const groupedForumIds = new Map<string, Set<number>>();
  for (const forum of forums) {
    const keys = new Set<string>();
    const names = [forum.name, ...(Array.isArray(forum.alternateNames) ? forum.alternateNames : [])];
    for (const name of names) {
      const normalized = normalizeName(name);
      if (normalized) {
        keys.add(`name:${normalized}`);
      }
    }

    const issn = normalizeIssn(forum.issn);
    if (issn) {
      keys.add(`issn:${issn}`);
    }

    for (const key of keys) {
      const group = groupedForumIds.get(key) ?? new Set<number>();
      group.add(forum.id);
      groupedForumIds.set(key, group);
    }
  }

  const groupByForumSignature = new Map<string, ForumDuplicateGroup>();
  for (const [key, idSet] of groupedForumIds.entries()) {
    if (idSet.size < 2) {
      continue;
    }

    const duplicateForums = forums.filter((forum) => idSet.has(forum.id));
    const duplicateItems: ForumDuplicateItem[] = duplicateForums.map((forum) => ({
      id: forum.id,
      name: forum.name,
      alternateNames: Array.isArray(forum.alternateNames) ? forum.alternateNames : null,
      issn: forum.issn,
      publisher: forum.publisher,
      jufoLevel: forum.jufoLevel,
      recordCount: recordCountByForumId.get(forum.id) ?? 0,
    }));

    const normalizedName = key.startsWith("name:") ? key.replace(/^name:/, "") : null;
    const issn = key.startsWith("issn:") ? key.replace(/^issn:/, "") : null;
    const group: ForumDuplicateGroup = {
      key,
      normalizedName,
      issn,
      count: duplicateItems.length,
      forums: duplicateItems,
    };

    const signature = duplicateItems
      .map((item) => item.id)
      .sort((left, right) => left - right)
      .join(",");
    const existing = groupByForumSignature.get(signature);
    if (!existing || shouldReplaceDuplicateGroup(existing, group)) {
      groupByForumSignature.set(signature, group);
    }
  }

  const groups = [...groupByForumSignature.values()];

  let filtered = groups;
  if (search) {
    const needle = search.toLocaleLowerCase();
    filtered = groups.filter((group) => {
      if (group.normalizedName?.includes(needle) || group.issn?.toLocaleLowerCase().includes(needle)) {
        return true;
      }
      return group.forums.some((forum) => {
        const names = [forum.name, ...(forum.alternateNames ?? [])].filter(Boolean) as string[];
        return names.some((name) => name.toLocaleLowerCase().includes(needle));
      });
    });
  }

  filtered.sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
  const paged = filtered.slice(offset, offset + limit);

  return res.send({
    count: filtered.length,
    groups: paged,
  });
};

export const mergeForums = async (req: Request, res: Response) => {
  const body = parseObject(req.body, "body");
  assertAllowedKeys(body, ["targetForumId", "sourceForumIds", "dryRun"], "forum merge body");

  const targetForumId = parseInteger(body.targetForumId, "targetForumId", { min: 1 });
  const sourceForumIds = parseIntegerArray(body.sourceForumIds, "sourceForumIds", {
    min: 1,
    minItems: 1,
    maxItems: 100,
  });
  const dryRun = parseOptionalBoolean(body.dryRun, "dryRun") ?? false;

  const dedupedSourceIds = [...new Set(sourceForumIds ?? [])];
  if (dedupedSourceIds.includes(targetForumId)) {
    throw badRequest("sourceForumIds must not contain targetForumId");
  }
  if (dedupedSourceIds.length === 0) {
    throw badRequest("sourceForumIds must contain at least one forum id");
  }

  const allForumIds = [targetForumId, ...dedupedSourceIds];
  const forums = (await db.Forum.findAll({
    where: { id: { [Op.in]: allForumIds } },
  })) as Array<ForumLike & { update: (values: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown> }>;

  const targetForum = forums.find((forum) => forum.id === targetForumId);
  if (!targetForum) {
    throw notFound(`Forum ${targetForumId} not found`);
  }

  const sourceForums = forums.filter((forum) => dedupedSourceIds.includes(forum.id));
  if (sourceForums.length !== dedupedSourceIds.length) {
    const foundSourceIds = new Set(sourceForums.map((forum) => forum.id));
    const missing = dedupedSourceIds.filter((id) => !foundSourceIds.has(id));
    throw notFound(`Source forums not found: ${missing.join(", ")}`);
  }

  const recordsToMove = await db.Record.findAll({
    attributes: ["id"],
    where: {
      forumId: {
        [Op.in]: dedupedSourceIds,
      },
    },
    raw: true,
  });
  const updatedRecordIds = (recordsToMove as Array<{ id: number }>).map((item) => item.id);

  const mergedAliases = uniqueNames([
    ...(Array.isArray(targetForum.alternateNames) ? targetForum.alternateNames : []),
    ...sourceForums.map((forum) => forum.name),
    ...sourceForums.flatMap((forum) => forum.alternateNames ?? []),
  ]);

  const targetPatch: Record<string, unknown> = {
    alternateNames: mergedAliases.length > 0 ? mergedAliases : null,
    enrichmentProvenance: mergeProvenance(targetForum.enrichmentProvenance ?? null, sourceForums),
  };

  if (!targetForum.publisher) {
    targetPatch.publisher = sourceForums.find((forum) => forum.publisher)?.publisher ?? null;
  }
  if (!targetForum.issn) {
    targetPatch.issn = sourceForums.find((forum) => forum.issn)?.issn ?? null;
  }
  if (targetForum.jufoLevel === null || targetForum.jufoLevel === undefined) {
    const jufoLevel = sourceForums.find((forum) => typeof forum.jufoLevel === "number")?.jufoLevel ?? null;
    if (jufoLevel !== null) {
      targetPatch.jufoLevel = jufoLevel;
    }
  }
  if (targetForum.jufoId === null || targetForum.jufoId === undefined) {
    const jufoId = sourceForums.find((forum) => typeof forum.jufoId === "number")?.jufoId ?? null;
    if (jufoId !== null) {
      targetPatch.jufoId = jufoId;
    }
  }

  if (dryRun) {
    return res.send({
      dryRun: true,
      targetForumId,
      sourceForumIds: dedupedSourceIds,
      movedRecordCount: updatedRecordIds.length,
      updatedRecordIds,
      mergedAliases,
    });
  }

  await db.sequelize.transaction(async (transaction) => {
    await db.Record.update(
      { forumId: targetForumId },
      {
        where: {
          forumId: {
            [Op.in]: dedupedSourceIds,
          },
        },
        transaction,
      },
    );

    await targetForum.update(targetPatch, { transaction });

    await db.Forum.destroy({
      where: {
        id: {
          [Op.in]: dedupedSourceIds,
        },
      },
      transaction,
    });
  });

  return res.send({
    dryRun: false,
    targetForumId,
    sourceForumIds: dedupedSourceIds,
    movedRecordCount: updatedRecordIds.length,
    updatedRecordIds,
    mergedAliases,
  });
};
