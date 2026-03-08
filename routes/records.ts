import type { Request, Response } from "express";
import { Op } from "sequelize";

import { badRequest, notFound } from "../lib/http";
import {
  assertAllowedKeys,
  parseInteger,
  parseObject,
  parseOptionalNullableString,
  parseString,
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
      include: ["Publication", "MappingOptions"],
    }),
  ]);

  return res.send({ count, records });
};

export const get = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.id, "id", { min: 1 });

  const record = await db.Record.findByPk(id, { include: ["Publication", "MappingOptions"] });
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

  const record = await db.Record.findByPk(id, { include: ["Publication", "MappingOptions"] });
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
