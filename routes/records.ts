import type { Request, Response } from "express";

import db from "../models";

const parseNumber = (value: unknown, fallback: number) => {
  if (typeof value !== "string") {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toStringParam = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
};

const toRecordId = (value: unknown): number => Number.parseInt(String(value), 10);
const VALID_STATUSES = [null, "uncertain", "excluded", "included"] as const;

type ValidStatus = (typeof VALID_STATUSES)[number];

export const listing = async (req: Request, res: Response) => {
  const offset = parseNumber(toStringParam(req.query.offset), 0);
  const limit = parseNumber(toStringParam(req.query.limit), 25);
  const status = toStringParam(req.query.status);
  const search = toStringParam(req.query.search);

  const where: Record<PropertyKey, unknown> = {};

  if (status !== undefined) {
    where.status = status === "null" ? null : status;
  }

  if (search !== undefined) {
    const op = (db.Sequelize as any).Op;
    where[op.or] = [
      { comment: { [op.substring]: search } },
      { title: { [op.substring]: search } },
      { author: { [op.substring]: search } },
      { databases: { [op.substring]: search } },
    ];
  }

  try {
    const count = await db.Record.count({ where });
    const records = await db.Record.findAll({
      offset,
      limit,
      where,
      include: ["Publication", "MappingOptions"],
    });

    return res.send({ count, records });
  } catch (error) {
    return res.send(error);
  }
};

export const get = async (req: Request, res: Response) => {
  const id = toRecordId(req.params.id);

  try {
    const record = await db.Record.findByPk(id, { include: ["Publication", "MappingOptions"] });
    return res.send(record);
  } catch (error) {
    return res.send(error);
  }
};

// only enable updating the status or comment of the record
export const update = async (req: Request, res: Response) => {
  const id = toRecordId(req.params.id);
  const { status, editedBy, comment, MappingOptions } = req.body as {
    status?: ValidStatus | string;
    editedBy?: string;
    comment?: string | null;
    MappingOptions?: unknown;
  };

  if (status !== undefined && !VALID_STATUSES.includes(status as ValidStatus)) {
    return res.status(400).send(new Error("Illegal value for 'status'"));
  }

  try {
    const record = await db.Record.findByPk(id, { include: ["Publication", "MappingOptions"] });
    if (!record) {
      return res.status(404).send(new Error(`Record ${id} not found`));
    }

    try {
      await record.update({
        ...(status !== undefined ? { status } : {}),
        ...(comment !== undefined ? { comment } : {}),
        ...(MappingOptions !== undefined ? { MappingOptions } : {}),
        editedBy,
      });
      return res.send(record);
    } catch (error) {
      return res.status(400).send(error);
    }
  } catch (error) {
    return res.status(400).send(error);
  }
};

export const createOption = async (req: Request, res: Response) => {
  const recordId = toRecordId(req.params.recordId);
  const { mappingOptionId, mappingQuestionId } = req.body as {
    mappingOptionId: number | string;
    mappingQuestionId: number | string;
  };

  try {
    await db.RecordMappingOption.create({
      recordId,
      mappingQuestionId: Number(mappingQuestionId),
      mappingOptionId: Number(mappingOptionId),
    });

    const option = await db.MappingOption.findByPk(Number(mappingOptionId));
    return res.send(option);
  } catch (error) {
    return res.status(400).send(error);
  }
};

export const removeOption = async (req: Request, res: Response) => {
  const mappingOptionId = toRecordId(req.params.mappingOptionId);
  const recordId = toRecordId(req.params.recordId);

  try {
    await db.RecordMappingOption.destroy({
      where: { mappingOptionId, recordId },
    });
    return res.send(`${mappingOptionId} deleted successfully`);
  } catch (error) {
    return res.status(400).send(error);
  }
};
