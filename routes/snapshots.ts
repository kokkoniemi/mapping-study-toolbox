import type { Request, Response } from "express";

import { badRequest, notFound } from "../lib/http";
import db from "../models";
import type { RecordStatus } from "../shared/contracts";
import { RECORD_STATUS_VALUES } from "../shared/contracts";
import {
  assertAllowedKeys,
  parseInteger,
  parseIntegerArray,
  parseObject,
  parseOptionalNullableString,
  parseString,
} from "../lib/validation";

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

const parseStatus = (value: unknown): RecordStatus => {
  if (value === null) {
    return null;
  }
  if (typeof value === "string" && VALID_STATUSES.includes(value as RecordStatus)) {
    return value as RecordStatus;
  }
  throw badRequest(`status must be one of: ${VALID_STATUSES_TEXT.join(", ")}`);
};

const serializeAssessment = (value: unknown) => {
  const plain = toPlainObject<{
    recordId: number;
    userId: number;
    status: RecordStatus;
    comment: string | null;
    updatedAt: string;
    AssessmentMappingOptions?: Array<{ id: number }>;
  }>(value);
  const mappingOptionIds = [...new Set((plain.AssessmentMappingOptions ?? []).map((option) => option.id))]
    .sort((left, right) => left - right);

  return {
    recordId: plain.recordId,
    userId: plain.userId,
    status: plain.status ?? null,
    comment: plain.comment ?? null,
    mappingOptionIds,
    updatedAt: plain.updatedAt,
  };
};

const ensureUser = async (userId: number) => {
  const user = await db.UserProfile.findByPk(userId);
  if (!user) {
    throw notFound(`User profile ${userId} not found`);
  }
  return user;
};

const parseUserId = (req: Request) => {
  const headerValue = req.headers?.["x-user-profile-id"];
  const headerText = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof headerText === "string" && headerText.trim().length > 0) {
    return parseInteger(headerText.trim(), "x-user-profile-id", { min: 1 });
  }
  if (req.query.userId !== undefined) {
    return parseInteger(req.query.userId, "userId", { min: 1 });
  }
  throw badRequest("userId is required (query or x-user-profile-id header)");
};

export const exportUserSnapshot = async (req: Request, res: Response) => {
  const userId = parseUserId(req);
  const user = await ensureUser(userId);

  const assessments = await db.RecordAssessment.findAll({
    where: { userId },
    include: [
      {
        association: "AssessmentMappingOptions",
        attributes: ["id"],
        through: { attributes: [] },
      },
    ],
    order: [["recordId", "ASC"]],
  });

  const payload = {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      name: user.name,
    },
    assessments: assessments.map((assessment) => serializeAssessment(assessment)),
  };

  return res.send(payload);
};

export const importUserSnapshot = async (req: Request, res: Response) => {
  const body = parseObject(req.body, "body");
  assertAllowedKeys(body, ["version", "exportedAt", "user", "assessments"], "snapshot body");

  const version = parseInteger(body.version, "version", { min: 1, max: 1 });
  if (version !== 1) {
    throw badRequest("Only snapshot version 1 is supported");
  }

  const userObject = parseObject(body.user, "user");
  assertAllowedKeys(userObject, ["id", "name"], "snapshot user");

  const userId = parseInteger(userObject.id, "user.id", { min: 1 });
  const userName = parseString(userObject.name, "user.name", { trim: true, allowEmpty: false, maxLength: 120 });
  if (userName === undefined) {
    throw badRequest("user.name is required");
  }

  let user = await db.UserProfile.findByPk(userId);
  if (!user) {
    user = await db.UserProfile.findOne({ where: { name: userName } });
  }
  if (!user) {
    user = await db.UserProfile.create({ name: userName, isActive: true });
  } else if (user.name !== userName) {
    await user.update({ name: userName });
  }

  if (!Array.isArray(body.assessments)) {
    throw badRequest("assessments must be an array");
  }

  const normalized = body.assessments.map((item, index) => {
    const row = parseObject(item, `assessments[${index}]`);
    assertAllowedKeys(row, ["recordId", "status", "comment", "mappingOptionIds", "updatedAt", "userId"], `assessments[${index}]`);

    const recordId = parseInteger(row.recordId, `assessments[${index}].recordId`, { min: 1 });
    const status = parseStatus(row.status);
    const comment = parseOptionalNullableString(row.comment, `assessments[${index}].comment`, {
      trim: false,
      maxLength: 10000,
    }) ?? null;
    const mappingOptionIds = row.mappingOptionIds === undefined
      ? []
      : parseIntegerArray(row.mappingOptionIds, `assessments[${index}].mappingOptionIds`, { min: 1, maxItems: 5000 }) ?? [];

    return {
      recordId,
      status,
      comment,
      mappingOptionIds: [...new Set(mappingOptionIds)].sort((left, right) => left - right),
    };
  });

  const recordIds = [...new Set(normalized.map((item) => item.recordId))];
  const existingRecords = await db.Record.findAll({ where: { id: recordIds }, attributes: ["id"] });
  const existingRecordIds = new Set(existingRecords.map((record) => record.id));

  const allMappingOptionIds = [...new Set(normalized.flatMap((item) => item.mappingOptionIds))];
  const mappingOptions = allMappingOptionIds.length === 0
    ? []
    : await db.MappingOption.findAll({ where: { id: allMappingOptionIds }, attributes: ["id"] });
  const existingMappingOptionIds = new Set(mappingOptions.map((option) => option.id));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of normalized) {
    if (!existingRecordIds.has(item.recordId)) {
      skipped += 1;
      continue;
    }
    if (item.mappingOptionIds.some((mappingOptionId) => !existingMappingOptionIds.has(mappingOptionId))) {
      skipped += 1;
      continue;
    }

    const [assessment, wasCreated] = await db.RecordAssessment.findOrCreate({
      where: { recordId: item.recordId, userId: user.id },
      defaults: {
        recordId: item.recordId,
        userId: user.id,
        status: item.status,
        comment: item.comment,
      },
    });

    const current = await db.RecordAssessment.findByPk(assessment.id, {
      include: [
        {
          association: "AssessmentMappingOptions",
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
    });

    if (!current) {
      skipped += 1;
      continue;
    }

    const serialized = serializeAssessment(current);
    const sameStatus = serialized.status === item.status;
    const sameComment = (serialized.comment ?? "") === (item.comment ?? "");
    const sameMappings = serialized.mappingOptionIds.length === item.mappingOptionIds.length
      && serialized.mappingOptionIds.every((id, index) => id === item.mappingOptionIds[index]);

    if (wasCreated) {
      if (item.mappingOptionIds.length > 0) {
        await db.RecordAssessmentOption.bulkCreate(
          item.mappingOptionIds.map((mappingOptionId) => ({
            recordAssessmentId: assessment.id,
            mappingOptionId,
          })),
        );
      }
      created += 1;
      continue;
    } else if (!(sameStatus && sameComment && sameMappings)) {
      await assessment.update({
        status: item.status,
        comment: item.comment,
      });
      await db.RecordAssessmentOption.destroy({
        where: { recordAssessmentId: assessment.id },
      });
      if (item.mappingOptionIds.length > 0) {
        await db.RecordAssessmentOption.bulkCreate(
          item.mappingOptionIds.map((mappingOptionId) => ({
            recordAssessmentId: assessment.id,
            mappingOptionId,
          })),
        );
      }
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return res.send({
    total: normalized.length,
    created,
    updated,
    skipped,
    userId: user.id,
  });
};
