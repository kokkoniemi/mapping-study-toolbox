import type { Request, Response } from "express";
import { Op } from "sequelize";

import { buildDisagreements, buildPairwiseAgreement, type ComparableAssessment } from "../lib/assessmentComparison";
import { badRequest, notFound } from "../lib/http";
import db from "../models";
import type { RecordStatus } from "../shared/contracts";
import {
  RECORD_STATUS_VALUES,
  type AssessmentSelection,
} from "../shared/contracts";
import {
  assertAllowedKeys,
  parseInteger,
  parseIntegerArray,
  parseObject,
  parseOptionalNullableString,
  parseString,
} from "../lib/validation";

const LIST_RECORD_ATTRIBUTES = [
  "id",
  "title",
  "url",
  "author",
  "year",
  "status",
  "abstract",
  "databases",
  "alternateUrls",
  "enrichmentProvenance",
  "forumId",
  "doi",
  "citationCount",
  "editedBy",
  "comment",
  "crossrefEnrichedAt",
  "crossrefLastError",
  "openAlexId",
  "openAlexEnrichedAt",
  "openAlexLastError",
  "openAlexTopicItems",
  "createdAt",
  "updatedAt",
] as const;

const VALID_STATUSES: readonly RecordStatus[] = RECORD_STATUS_VALUES;
const VALID_STATUSES_TEXT = ["null", "uncertain", "excluded", "included"] as const;

const toPlainObject = <T extends Record<string, unknown>>(value: unknown): T => {
  if (value && typeof value === "object") {
    const maybeGet = (value as { get?: unknown }).get;
    if (typeof maybeGet === "function") {
      return maybeGet.call(value, { plain: true }) as T;
    }
  }
  return value as T;
};

const parseBooleanQuery = (value: unknown, key: string): boolean => {
  const raw = parseString(value, key, { optional: true, trim: true });
  if (raw === undefined || raw.length === 0) {
    return false;
  }
  if (raw === "1" || raw.toLocaleLowerCase() === "true") {
    return true;
  }
  if (raw === "0" || raw.toLocaleLowerCase() === "false") {
    return false;
  }
  throw badRequest(`${key} must be one of: 1, 0, true, false`);
};

const parseStatusFilter = (value: unknown): RecordStatus | undefined => {
  const status = parseString(value, "status", { optional: true, trim: true });
  if (status === undefined || status.length === 0) {
    return undefined;
  }
  if (status === "null") {
    return null;
  }
  if (VALID_STATUSES.includes(status as RecordStatus)) {
    return status as RecordStatus;
  }
  throw badRequest(`status must be one of: ${VALID_STATUSES_TEXT.join(", ")}`);
};

const parseUserId = (req: Request, body?: Record<string, unknown>) => {
  const headerValue = req.headers?.["x-user-profile-id"];
  const headerText = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof headerText === "string" && headerText.trim().length > 0) {
    return parseInteger(headerText.trim(), "x-user-profile-id", { min: 1 });
  }

  if (req.query?.userId !== undefined) {
    return parseInteger(req.query.userId, "userId", { min: 1 });
  }

  if (body && body.userId !== undefined) {
    return parseInteger(body.userId, "userId", { min: 1 });
  }

  throw badRequest("userId is required (query, body, or x-user-profile-id header)");
};

const ensureUser = async (userId: number) => {
  const user = await db.UserProfile.findByPk(userId);
  if (!user) {
    throw notFound(`User profile ${userId} not found`);
  }
  return user;
};

const parseRecordIdsFromQuery = (value: unknown): number[] | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return parseIntegerArray(value, "recordIds", { min: 1, minItems: 1, maxItems: 10000 });
  }

  if (typeof value === "string") {
    if (value.includes(",")) {
      const items = value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      return parseIntegerArray(items, "recordIds", { min: 1, minItems: 1, maxItems: 10000 });
    }
    return [parseInteger(value, "recordIds[0]", { min: 1 })];
  }

  throw badRequest("recordIds must be an array or comma-separated string");
};

const ensureMappingOptionsExist = async (mappingOptionIds: number[]) => {
  if (mappingOptionIds.length === 0) {
    return [];
  }
  const deduped = [...new Set(mappingOptionIds)];
  const options = await db.MappingOption.findAll({
    where: { id: deduped },
    attributes: ["id", "title", "position", "color", "mappingQuestionId"],
  });
  if (options.length !== deduped.length) {
    const found = new Set(options.map((item) => item.id));
    const missing = deduped.filter((id) => !found.has(id));
    throw badRequest("Unknown mappingOptionIds", { missing });
  }
  return options;
};

type AssessmentPlain = {
  id: number;
  recordId: number;
  userId: number;
  status: RecordStatus;
  comment: string | null;
  updatedAt: string;
  AssessmentMappingOptions?: Array<{
    id: number;
    title: string | null;
    position: number | null;
    color: string | null;
    mappingQuestionId: number | null;
  }>;
};

const serializeAssessment = (value: unknown): {
  assessment: AssessmentSelection;
  mappingOptions: Array<{
    id: number;
    title: string | null;
    position: number | null;
    color: string | null;
    mappingQuestionId: number | null;
  }>;
} => {
  const plain = toPlainObject<AssessmentPlain>(value);
  const mappingOptions = [...(plain.AssessmentMappingOptions ?? [])]
    .sort((left, right) => left.id - right.id)
    .map((item) => ({
      id: item.id,
      title: item.title,
      position: item.position ?? 0,
      color: item.color,
      mappingQuestionId: item.mappingQuestionId,
    }));

  return {
    assessment: {
      recordId: plain.recordId,
      userId: plain.userId,
      status: plain.status ?? null,
      comment: plain.comment ?? null,
      mappingOptionIds: mappingOptions.map((item) => item.id),
      updatedAt: plain.updatedAt,
    },
    mappingOptions,
  };
};

const loadAssessmentsByRecord = async (userId: number, recordIds: number[]) => {
  if (recordIds.length === 0) {
    return new Map<number, ReturnType<typeof serializeAssessment>>();
  }

  const selections = await db.RecordAssessment.findAll({
    where: { userId, recordId: recordIds },
    include: [
      {
        association: "AssessmentMappingOptions",
        attributes: ["id", "title", "position", "color", "mappingQuestionId"],
        through: { attributes: [] },
      },
    ],
  });

  const map = new Map<number, ReturnType<typeof serializeAssessment>>();
  for (const selection of selections) {
    const serialized = serializeAssessment(selection);
    map.set(serialized.assessment.recordId, serialized);
  }
  return map;
};

const upsertAssessment = async ({
  recordId,
  userId,
  status,
  comment,
  mappingOptionIds,
}: {
  recordId: number;
  userId: number;
  status?: RecordStatus;
  comment?: string | null;
  mappingOptionIds?: number[];
}) => {
  const [assessment] = await db.RecordAssessment.findOrCreate({
    where: { recordId, userId },
    defaults: {
      status: status ?? null,
      comment: comment ?? null,
    },
  });

  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    updates.status = status;
  }
  if (comment !== undefined) {
    updates.comment = comment;
  }
  if (Object.keys(updates).length > 0) {
    await assessment.update(updates);
  }

  if (mappingOptionIds !== undefined) {
    const deduped = [...new Set(mappingOptionIds)];
    await db.RecordAssessmentOption.destroy({
      where: { recordAssessmentId: assessment.id },
    });

    if (deduped.length > 0) {
      await db.RecordAssessmentOption.bulkCreate(
        deduped.map((mappingOptionId) => ({
          recordAssessmentId: assessment.id,
          mappingOptionId,
        })),
      );
    }
  }

  return db.RecordAssessment.findByPk(assessment.id, {
    include: [
      {
        association: "AssessmentMappingOptions",
        attributes: ["id", "title", "position", "color", "mappingQuestionId"],
        through: { attributes: [] },
      },
    ],
  });
};

export const listRecords = async (req: Request, res: Response) => {
  const offset = parseInteger(req.query.offset, "offset", { defaultValue: 0, min: 0 });
  const limit = parseInteger(req.query.limit, "limit", { defaultValue: 25, min: 1, max: 1000 });
  const userId = parseUserId(req);
  const statusFilter = parseStatusFilter(req.query.status);
  const search = parseString(req.query.search, "search", {
    optional: true,
    trim: true,
    maxLength: 500,
  });
  const importIdText = parseString(req.query.importId, "importId", {
    optional: true,
    trim: true,
  });
  const importId = importIdText ? parseInteger(importIdText, "importId", { min: 1 }) : undefined;
  const withDetails = parseBooleanQuery(req.query.withDetails, "withDetails");

  const user = await ensureUser(userId);
  if (!user.isActive) {
    throw badRequest("Selected user profile is inactive");
  }

  const where: Record<PropertyKey, unknown> = {};
  if (importId !== undefined) {
    where.importId = importId;
  }

  const baseRecords = await db.Record.findAll({
    where,
    attributes: withDetails ? undefined : [...LIST_RECORD_ATTRIBUTES],
    include: [
      {
        association: "Forum",
        attributes: withDetails
          ? undefined
          : [
            "id",
            "name",
            "jufoLevel",
            "issn",
            "publisher",
            "jufoFetchedAt",
            "jufoLastError",
            "enrichmentProvenance",
          ],
      },
      {
        association: "MappingOptions",
        attributes: withDetails ? undefined : ["id", "title", "color", "mappingQuestionId"],
        through: { attributes: [] },
      },
    ],
    order: [["id", "ASC"]],
  });

  const recordIds = baseRecords.map((record) => record.id);
  const assessmentsByRecord = await loadAssessmentsByRecord(userId, recordIds);

  const overlaid = baseRecords.map((record) => {
    const plain = toPlainObject<Record<string, unknown>>(record);
    const assessment = assessmentsByRecord.get(record.id);

    return {
      ...plain,
      status: assessment?.assessment.status ?? null,
      comment: assessment?.assessment.comment ?? null,
      editedBy: assessment ? user.name : null,
      MappingOptions: assessment?.mappingOptions ?? [],
    };
  }) as Array<Record<string, unknown>>;

  const filtered = overlaid.filter((record) => {
    if (statusFilter !== undefined && record.status !== statusFilter) {
      return false;
    }

    if (!search || search.length === 0) {
      return true;
    }

      const haystack = [
        typeof record.title === "string" ? record.title : "",
        typeof record.author === "string" ? record.author : "",
        Array.isArray(record.databases) ? record.databases.join(" ") : "",
        typeof record.comment === "string" ? record.comment : "",
      ]
        .join(" ")
        .toLocaleLowerCase();

    return haystack.includes(search.toLocaleLowerCase());
  });

  const page = filtered.slice(offset, offset + limit);
  return res.send({ count: filtered.length, records: page });
};

export const listing = async (req: Request, res: Response) => {
  const userId = parseUserId(req);
  const recordIds = parseRecordIdsFromQuery(req.query.recordIds) ?? [];
  await ensureUser(userId);

  const assessments = await loadAssessmentsByRecord(userId, recordIds);
  return res.send({
    count: assessments.size,
    assessments: [...assessments.values()].map((item) => item.assessment),
  });
};

export const get = async (req: Request, res: Response) => {
  const recordId = parseInteger(req.params.recordId, "recordId", { min: 1 });
  const userId = parseUserId(req);
  await ensureUser(userId);

  const assessment = await db.RecordAssessment.findOne({
    where: { recordId, userId },
    include: [
      {
        association: "AssessmentMappingOptions",
        attributes: ["id", "title", "position", "color", "mappingQuestionId"],
        through: { attributes: [] },
      },
    ],
  });

  if (!assessment) {
    return res.send({ assessment: null });
  }

  return res.send({ assessment: serializeAssessment(assessment).assessment });
};

export const upsert = async (req: Request, res: Response) => {
  const recordId = parseInteger(req.params.recordId, "recordId", { min: 1 });
  const body = parseObject(req.body, "body");
  assertAllowedKeys(body, ["userId", "status", "comment", "mappingOptionIds"], "assessment body");

  const userId = parseUserId(req, body);
  const user = await ensureUser(userId);
  if (!user.isActive) {
    throw badRequest("Selected user profile is inactive");
  }

  const status = body.status === undefined
    ? undefined
    : body.status === null
      ? null
      : parseStatusFilter(body.status);
  const comment = parseOptionalNullableString(body.comment, "comment", {
    trim: false,
    maxLength: 10000,
  });
  const mappingOptionIds = body.mappingOptionIds === undefined
    ? undefined
    : parseIntegerArray(body.mappingOptionIds, "mappingOptionIds", {
      min: 1,
      maxItems: 5000,
    });

  if (status === undefined && comment === undefined && mappingOptionIds === undefined) {
    throw badRequest("assessment body must include at least one field");
  }

  const record = await db.Record.findByPk(recordId);
  if (!record) {
    throw notFound(`Record ${recordId} not found`);
  }

  if (mappingOptionIds !== undefined) {
    await ensureMappingOptionsExist(mappingOptionIds);
  }

  const assessment = await upsertAssessment({
    recordId,
    userId,
    status,
    comment,
    mappingOptionIds,
  });

  if (!assessment) {
    throw notFound(`Assessment for record ${recordId} and user ${userId} not found`);
  }

  return res.send({ assessment: serializeAssessment(assessment).assessment });
};

export const compare = async (req: Request, res: Response) => {
  const body = parseObject(req.body, "body");
  assertAllowedKeys(body, ["userIds"], "compare body");

  const userIds = body.userIds === undefined
    ? undefined
    : parseIntegerArray(body.userIds, "userIds", { min: 1, minItems: 2, maxItems: 100 });
  const dedupedUserIds = userIds ? [...new Set(userIds)] : undefined;

  const users = await db.UserProfile.findAll({
    where: dedupedUserIds ? { id: dedupedUserIds } : { isActive: true },
    order: [["name", "ASC"]],
  });
  if (users.length < 2) {
    throw badRequest("At least two users are required for comparison");
  }

  const selectedIds = users.map((user) => user.id);
  const assessmentRows = await db.RecordAssessment.findAll({
    where: { userId: { [Op.in]: selectedIds } },
    include: [
      {
        association: "AssessmentMappingOptions",
        attributes: ["id"],
        through: { attributes: [] },
      },
    ],
  });

  const assessments: ComparableAssessment[] = assessmentRows.map((row) => {
    const serialized = serializeAssessment(row).assessment;
    return {
      recordId: serialized.recordId,
      userId: serialized.userId,
      status: serialized.status,
      comment: serialized.comment,
      mappingOptionIds: serialized.mappingOptionIds,
    };
  });

  return res.send({
    users,
    pairwise: buildPairwiseAgreement(assessments, selectedIds),
    disagreements: buildDisagreements(assessments, selectedIds),
  });
};

export const resolve = async (req: Request, res: Response) => {
  const recordId = parseInteger(req.params.recordId, "recordId", { min: 1 });
  const body = parseObject(req.body, "body");
  assertAllowedKeys(body, ["status", "comment", "mappingOptionIds"], "resolve body");

  const status = body.status === undefined
    ? undefined
    : body.status === null
      ? null
      : parseStatusFilter(body.status);
  const comment = parseOptionalNullableString(body.comment, "comment", {
    trim: false,
    maxLength: 10000,
  });
  const mappingOptionIds = body.mappingOptionIds === undefined
    ? undefined
    : parseIntegerArray(body.mappingOptionIds, "mappingOptionIds", {
      min: 1,
      maxItems: 5000,
    });

  if (status === undefined && comment === undefined && mappingOptionIds === undefined) {
    throw badRequest("resolve body must include at least one field");
  }

  const record = await db.Record.findByPk(recordId, { include: ["Forum", "MappingOptions"] });
  if (!record) {
    throw notFound(`Record ${recordId} not found`);
  }

  const updates: Record<string, unknown> = {};
  if (status !== undefined) {
    updates.status = status;
  }
  if (comment !== undefined) {
    updates.comment = comment;
  }
  if (Object.keys(updates).length > 0) {
    await record.update(updates);
  }

  if (mappingOptionIds !== undefined) {
    const options = await ensureMappingOptionsExist(mappingOptionIds);
    const invalidOption = options.find((option) => option.mappingQuestionId === null || option.mappingQuestionId === undefined);
    if (invalidOption) {
      throw badRequest(`Mapping option ${invalidOption.id} has no mappingQuestionId`);
    }
    await db.RecordMappingOption.destroy({ where: { recordId } });
    if (options.length > 0) {
      await db.RecordMappingOption.bulkCreate(
        options.map((option) => ({
          recordId,
          mappingQuestionId: option.mappingQuestionId as number,
          mappingOptionId: option.id,
        })),
      );
    }
  }

  const updated = await db.Record.findByPk(recordId, { include: ["Forum", "MappingOptions"] });
  return res.send(updated);
};
