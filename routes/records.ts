import type { Request, Response } from "express";
import { Op } from "sequelize";

import { badRequest, notFound } from "../lib/http";
import { createEnrichmentJob, getEnrichmentJob } from "../lib/recordEnrichment";
import {
  assertAllowedKeys,
  parseIntegerArray,
  parseInteger,
  parseObject,
  parseOptionalNullableString,
  parseString,
  parseStringArray,
} from "../lib/validation";
import db from "../models";
import type { RecordStatus } from "../models/types";

const VALID_STATUSES: readonly RecordStatus[] = [null, "uncertain", "excluded", "included"];
const VALID_STATUSES_TEXT = ["null", "uncertain", "excluded", "included"] as const;

const parseStatusQuery = (value: unknown): RecordStatus | undefined => {
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

const parseStatusBody = (value: unknown): RecordStatus | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw badRequest("status must be a string or null");
  }

  if (VALID_STATUSES.includes(value as RecordStatus)) {
    return value as RecordStatus;
  }

  throw badRequest(`status must be one of: ${VALID_STATUSES_TEXT.join(", ")}`);
};

const parseStatusRequired = (value: unknown): RecordStatus => {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw badRequest("status must be a string or null");
  }

  if (VALID_STATUSES.includes(value as RecordStatus)) {
    return value as RecordStatus;
  }

  throw badRequest(`status must be one of: ${VALID_STATUSES_TEXT.join(", ")}`);
};

type RecordPatchPayload = Partial<{
  title: string;
  author: string;
  url: string;
  status: RecordStatus;
  comment: string | null;
  abstract: string | null;
  databases: string[];
  alternateUrls: string[];
  editedBy: string;
}>;

export const listing = async (req: Request, res: Response) => {
  const offset = parseInteger(req.query.offset, "offset", { defaultValue: 0, min: 0 });
  const limit = parseInteger(req.query.limit, "limit", { defaultValue: 25, min: 1, max: 250 });
  const status = parseStatusQuery(req.query.status);
  const search = parseString(req.query.search, "search", {
    optional: true,
    trim: true,
    maxLength: 500,
  });

  const where: Record<PropertyKey, unknown> = {};

  if (status !== undefined) {
    where.status = status;
  }

  if (search !== undefined && search.length > 0) {
    where[Op.or] = [
      { comment: { [Op.substring]: search } },
      { title: { [Op.substring]: search } },
      { author: { [Op.substring]: search } },
      { databases: { [Op.substring]: search } },
    ];
  }

  const [count, records] = await Promise.all([
    db.Record.count({ where }),
    db.Record.findAll({
      offset,
      limit,
      where,
      include: ["Forum", "MappingOptions"],
    }),
  ]);

  return res.send({ count, records });
};

export const get = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.id, "id", { min: 1 });

  const record = await db.Record.findByPk(id, { include: ["Forum", "MappingOptions"] });
  if (!record) {
    throw notFound(`Record ${id} not found`);
  }

  return res.send(record);
};

// only enable updating the status or comment of the record
export const update = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.id, "id", { min: 1 });
  const body = parseObject(req.body, "body");

  assertAllowedKeys(body, ["status", "editedBy", "comment", "MappingOptions"], "record update body");

  const status = parseStatusBody(body.status);
  const editedBy = parseString(body.editedBy, "editedBy", {
    optional: true,
    trim: true,
    maxLength: 120,
  });
  const comment = parseOptionalNullableString(body.comment, "comment", {
    trim: false,
    maxLength: 10000,
  });

  const record = await db.Record.findByPk(id, { include: ["Forum", "MappingOptions"] });
  if (!record) {
    throw notFound(`Record ${id} not found`);
  }

  await record.update({
    ...(status !== undefined ? { status } : {}),
    ...(comment !== undefined ? { comment } : {}),
    ...(body.MappingOptions !== undefined ? { MappingOptions: body.MappingOptions } : {}),
    ...(editedBy !== undefined ? { editedBy } : {}),
  });

  return res.send(record);
};

export const patch = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.id, "id", { min: 1 });
  const body = parseObject(req.body, "body");

  assertAllowedKeys(
    body,
    [
      "title",
      "author",
      "url",
      "status",
      "comment",
      "abstract",
      "databases",
      "alternateUrls",
      "editedBy",
    ],
    "record patch body",
  );

  const updates: RecordPatchPayload = {};

  if ("title" in body) {
    updates.title = parseString(body.title, "title", { trim: true, allowEmpty: false, maxLength: 500 });
  }

  if ("author" in body) {
    updates.author = parseString(body.author, "author", {
      trim: true,
      allowEmpty: false,
      maxLength: 500,
    });
  }

  if ("url" in body) {
    updates.url = parseString(body.url, "url", { trim: true, allowEmpty: false, maxLength: 2000 });
  }

  if ("status" in body) {
    updates.status = parseStatusRequired(body.status);
  }

  if ("comment" in body) {
    const value = parseOptionalNullableString(body.comment, "comment", {
      trim: false,
      maxLength: 10000,
    });
    if (value === undefined) {
      throw badRequest("comment is required");
    }
    updates.comment = value;
  }

  if ("abstract" in body) {
    const value = parseOptionalNullableString(body.abstract, "abstract", {
      trim: false,
      maxLength: 20000,
    });
    if (value === undefined) {
      throw badRequest("abstract is required");
    }
    updates.abstract = value;
  }

  if ("databases" in body) {
    updates.databases = parseStringArray(body.databases, "databases", {
      trim: true,
      allowEmptyItems: false,
      maxItemLength: 500,
      maxItems: 200,
    });
  }

  if ("alternateUrls" in body) {
    updates.alternateUrls = parseStringArray(body.alternateUrls, "alternateUrls", {
      trim: true,
      allowEmptyItems: false,
      maxItemLength: 2000,
      maxItems: 200,
    });
  }

  if ("editedBy" in body) {
    updates.editedBy = parseString(body.editedBy, "editedBy", {
      trim: true,
      allowEmpty: false,
      maxLength: 120,
    });
  }

  if (Object.keys(updates).length === 0) {
    throw badRequest("record patch body must contain at least one supported field");
  }

  const record = await db.Record.findByPk(id, { include: ["Forum", "MappingOptions"] });
  if (!record) {
    throw notFound(`Record ${id} not found`);
  }

  await record.update(updates);
  return res.send(record);
};

export const createOption = async (req: Request, res: Response) => {
  const recordId = parseInteger(req.params.recordId, "recordId", { min: 1 });
  const body = parseObject(req.body, "body");

  assertAllowedKeys(body, ["mappingOptionId", "mappingQuestionId"], "record mapping option body");

  const mappingOptionId = parseInteger(body.mappingOptionId, "mappingOptionId", { min: 1 });
  const mappingQuestionId = parseInteger(body.mappingQuestionId, "mappingQuestionId", { min: 1 });

  await db.RecordMappingOption.create({
    recordId,
    mappingQuestionId,
    mappingOptionId,
  });

  const option = await db.MappingOption.findByPk(mappingOptionId);
  if (!option) {
    throw notFound(`MappingOption ${mappingOptionId} not found`);
  }

  return res.send(option);
};

export const removeOption = async (req: Request, res: Response) => {
  const mappingOptionId = parseInteger(req.params.mappingOptionId, "mappingOptionId", { min: 1 });
  const recordId = parseInteger(req.params.recordId, "recordId", { min: 1 });

  await db.RecordMappingOption.destroy({
    where: { mappingOptionId, recordId },
  });

  return res.send(`${mappingOptionId} deleted successfully`);
};

export const createEnrichment = async (req: Request, res: Response) => {
  const body = parseObject(req.body, "body");
  assertAllowedKeys(body, ["recordIds"], "enrichment job body");

  const recordIds = parseIntegerArray(body.recordIds, "recordIds", {
    min: 1,
    minItems: 1,
    maxItems: 500,
  });
  if (!recordIds) {
    throw badRequest("recordIds are required");
  }

  const job = createEnrichmentJob(recordIds);
  return res.status(202).send(job);
};

export const getEnrichment = async (req: Request, res: Response) => {
  const jobId = parseString(req.params.jobId, "jobId", {
    trim: true,
    allowEmpty: false,
    maxLength: 120,
  });
  if (!jobId) {
    throw badRequest("jobId is required");
  }

  const job = getEnrichmentJob(jobId);
  if (!job) {
    throw notFound(`Enrichment job ${jobId} not found`);
  }

  return res.send(job);
};
