import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";

import { badRequest, notFound } from "../lib/http";
import db from "../models";
import type {
  AssessmentSnapshotAutoImportItem,
  AssessmentSnapshotAutoImportSummary,
  AssessmentSnapshotImportResponse,
  RecordStatus,
} from "../shared/contracts";
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
const SNAPSHOTS_DIR = path.resolve(process.cwd(), "snapshots");

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

type SnapshotPayload = {
  version: 1;
  exportedAt: string;
  user: {
    id: number;
    name: string;
  };
  assessments: Array<{
    recordId: number;
    userId: number;
    status: RecordStatus;
    comment: string | null;
    mappingOptionIds: number[];
    updatedAt: string;
  }>;
};

type ParsedSnapshotAssessment = {
  recordId: number;
  status: RecordStatus;
  comment: string | null;
  mappingOptionIds: number[];
  updatedAt: string | null;
};

type ParsedSnapshotImportPayload = {
  userId: number;
  userName: string;
  assessments: ParsedSnapshotAssessment[];
};

const buildSnapshotPayload = async (userId: number): Promise<SnapshotPayload> => {
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

  return {
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      name: user.name,
    },
    assessments: assessments.map((assessment) => serializeAssessment(assessment)),
  };
};

const stableSnapshot = (payload: SnapshotPayload) => ({
  version: 1 as const,
  user: {
    id: payload.user.id,
    name: payload.user.name,
  },
  assessments: payload.assessments
    .map((item) => ({
      recordId: item.recordId,
      userId: item.userId,
      status: item.status ?? null,
      comment: item.comment ?? null,
      mappingOptionIds: [...new Set(item.mappingOptionIds)].sort((left, right) => left - right),
      updatedAt: item.updatedAt,
    }))
    .sort((left, right) => left.recordId - right.recordId),
});

const parseSnapshotImportPayload = (value: unknown, contextLabel: string): ParsedSnapshotImportPayload => {
  const body = parseObject(value, contextLabel);
  assertAllowedKeys(body, ["version", "exportedAt", "user", "assessments"], contextLabel);

  const version = parseInteger(body.version, `${contextLabel}.version`, { min: 1, max: 1 });
  if (version !== 1) {
    throw badRequest("Only snapshot version 1 is supported");
  }

  const userObject = parseObject(body.user, `${contextLabel}.user`);
  assertAllowedKeys(userObject, ["id", "name"], `${contextLabel}.user`);

  const userId = parseInteger(userObject.id, `${contextLabel}.user.id`, { min: 1 });
  const userName = parseString(userObject.name, `${contextLabel}.user.name`, {
    trim: true,
    allowEmpty: false,
    maxLength: 120,
  });
  if (userName === undefined) {
    throw badRequest("user.name is required");
  }

  if (!Array.isArray(body.assessments)) {
    throw badRequest(`${contextLabel}.assessments must be an array`);
  }

  const assessments = body.assessments.map((item, index) => {
    const rowLabel = `${contextLabel}.assessments[${index}]`;
    const row = parseObject(item, rowLabel);
    assertAllowedKeys(row, ["recordId", "status", "comment", "mappingOptionIds", "updatedAt", "userId"], rowLabel);

    const recordId = parseInteger(row.recordId, `${rowLabel}.recordId`, { min: 1 });
    const status = parseStatus(row.status);
    const comment = parseOptionalNullableString(row.comment, `${rowLabel}.comment`, {
      trim: false,
      maxLength: 10000,
    }) ?? null;
    const updatedAt = parseString(row.updatedAt, `${rowLabel}.updatedAt`, {
      optional: true,
      trim: true,
      allowEmpty: false,
      maxLength: 80,
    }) ?? null;
    const mappingOptionIds = row.mappingOptionIds === undefined
      ? []
      : parseIntegerArray(row.mappingOptionIds, `${rowLabel}.mappingOptionIds`, { min: 1, maxItems: 5000 }) ?? [];

    return {
      recordId,
      status,
      comment,
      mappingOptionIds: [...new Set(mappingOptionIds)].sort((left, right) => left - right),
      updatedAt,
    };
  });

  return {
    userId,
    userName,
    assessments,
  };
};

const parseTimestamp = (value: string | null) => {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

type SnapshotImportResult = AssessmentSnapshotImportResponse & {
  userName: string;
};

const importSnapshotPayload = async (
  payload: ParsedSnapshotImportPayload,
  options?: { dryRun?: boolean },
): Promise<SnapshotImportResult> => {
  const dryRun = Boolean(options?.dryRun);
  let user = await db.UserProfile.findByPk(payload.userId);
  if (!user) {
    user = await db.UserProfile.findOne({ where: { name: payload.userName } });
  }
  if (!user && !dryRun) {
    user = await db.UserProfile.create({ name: payload.userName, isActive: true });
  } else if (user && user.name !== payload.userName && !dryRun) {
    await user.update({ name: payload.userName });
  }

  const recordIds = [...new Set(payload.assessments.map((item) => item.recordId))];
  const existingRecords = await db.Record.findAll({ where: { id: recordIds }, attributes: ["id"] });
  const existingRecordIds = new Set(existingRecords.map((record) => record.id));

  const allMappingOptionIds = [...new Set(payload.assessments.flatMap((item) => item.mappingOptionIds))];
  const mappingOptions = allMappingOptionIds.length === 0
    ? []
    : await db.MappingOption.findAll({ where: { id: allMappingOptionIds }, attributes: ["id"] });
  const existingMappingOptionIds = new Set(mappingOptions.map((option) => option.id));

  const currentByRecord = new Map<number, ReturnType<typeof serializeAssessment>>();
  if (user) {
    const existingAssessments = await db.RecordAssessment.findAll({
      where: {
        userId: user.id,
        recordId: recordIds,
      },
      include: [
        {
          association: "AssessmentMappingOptions",
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
    });
    for (const current of existingAssessments) {
      const serialized = serializeAssessment(current);
      currentByRecord.set(serialized.recordId, serialized);
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const resolvedUserId = user?.id ?? payload.userId;
  const resolvedUserName = user?.name ?? payload.userName;

  for (const item of payload.assessments) {
    if (!existingRecordIds.has(item.recordId)) {
      skipped += 1;
      continue;
    }
    if (item.mappingOptionIds.some((mappingOptionId) => !existingMappingOptionIds.has(mappingOptionId))) {
      skipped += 1;
      continue;
    }

    const existing = currentByRecord.get(item.recordId);
    if (!existing) {
      if (dryRun) {
        created += 1;
        continue;
      }

      const [assessment, wasCreated] = await db.RecordAssessment.findOrCreate({
        where: { recordId: item.recordId, userId: resolvedUserId },
        defaults: {
          recordId: item.recordId,
          userId: resolvedUserId,
          status: item.status,
          comment: item.comment,
        },
      });

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
      } else {
        skipped += 1;
      }
      continue;
    }

    const sameStatus = existing.status === item.status;
    const sameComment = (existing.comment ?? "") === (item.comment ?? "");
    const sameMappings = existing.mappingOptionIds.length === item.mappingOptionIds.length
      && existing.mappingOptionIds.every((id, index) => id === item.mappingOptionIds[index]);
    if (sameStatus && sameComment && sameMappings) {
      skipped += 1;
      continue;
    }

    const incomingUpdatedAt = parseTimestamp(item.updatedAt);
    const currentUpdatedAt = parseTimestamp(existing.updatedAt);
    const incomingIsNewer = incomingUpdatedAt !== null && (currentUpdatedAt === null || incomingUpdatedAt > currentUpdatedAt);
    if (!incomingIsNewer) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      updated += 1;
      continue;
    }

    const assessment = await db.RecordAssessment.findOne({
      where: { recordId: item.recordId, userId: resolvedUserId },
    });
    if (!assessment) {
      skipped += 1;
      continue;
    }
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
  }

  return {
    total: payload.assessments.length,
    created,
    updated,
    skipped,
    userId: resolvedUserId,
    userName: resolvedUserName,
  };
};

const listSnapshotFiles = () => {
  try {
    return fs.readdirSync(SNAPSHOTS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const importSnapshotsFromFiles = async (options?: {
  excludeUserId?: number;
  dryRun?: boolean;
}): Promise<AssessmentSnapshotAutoImportSummary> => {
  const files = listSnapshotFiles();
  const imports: AssessmentSnapshotAutoImportItem[] = [];
  const errors: string[] = [];
  let total = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    const fullPath = path.join(SNAPSHOTS_DIR, file);
    try {
      const raw = fs.readFileSync(fullPath, "utf8");
      const parsedBody = JSON.parse(raw) as unknown;
      const parsed = parseSnapshotImportPayload(parsedBody, `snapshot file ${file}`);
      if (options?.excludeUserId !== undefined && parsed.userId === options.excludeUserId) {
        continue;
      }
      const imported = await importSnapshotPayload(parsed, { dryRun: options?.dryRun });
      imports.push({
        file: path.relative(process.cwd(), fullPath),
        userId: imported.userId,
        userName: imported.userName,
        total: imported.total,
        created: imported.created,
        updated: imported.updated,
        skipped: imported.skipped,
      });
      total += imported.total;
      created += imported.created;
      updated += imported.updated;
      skipped += imported.skipped;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${file}: ${message}`);
    }
  }

  return {
    scannedFiles: files.length,
    importedSnapshots: imports.length,
    total,
    created,
    updated,
    skipped,
    errors,
    imports,
  };
};

export const exportUserSnapshot = async (req: Request, res: Response) => {
  const userId = parseUserId(req);
  return res.send(await buildSnapshotPayload(userId));
};

export const saveUserSnapshot = async (req: Request, res: Response) => {
  const body = parseObject(req.body, "body");
  assertAllowedKeys(body, ["userId"], "snapshot save body");
  const userId = parseInteger(body.userId, "userId", { min: 1 });

  const payload = await buildSnapshotPayload(userId);
  const normalized = stableSnapshot(payload);
  const output = `${JSON.stringify(normalized, null, 2)}\n`;
  const outputPath = path.join(SNAPSHOTS_DIR, `user-${payload.user.id}.json`);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  let changed = true;
  if (fs.existsSync(outputPath)) {
    const current = fs.readFileSync(outputPath, "utf8");
    if (current === output) {
      changed = false;
    }
  }

  if (changed) {
    fs.writeFileSync(outputPath, output, "utf8");
  }

  return res.send({
    userId: payload.user.id,
    path: path.relative(process.cwd(), outputPath),
    changed,
    savedAt: new Date().toISOString(),
  });
};

export const pendingSnapshotUploads = async (_req: Request, res: Response) => {
  const summary = await importSnapshotsFromFiles({ dryRun: true });
  const items = summary.imports.filter((item) => item.created > 0 || item.updated > 0);
  return res.send({
    scannedFiles: summary.scannedFiles,
    pendingSnapshots: items.length,
    errors: summary.errors,
    items,
  });
};

export const uploadSnapshotFiles = async (_req: Request, res: Response) => {
  return res.send(await importSnapshotsFromFiles());
};

export const importUserSnapshot = async (req: Request, res: Response) => {
  const parsed = parseSnapshotImportPayload(req.body, "snapshot body");
  const imported = await importSnapshotPayload(parsed);
  const { userName: _userName, ...response } = imported;
  return res.send(response);
};
