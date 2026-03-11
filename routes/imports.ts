import type { Request, Response } from "express";

import { assertAllowedKeys, parseInteger, parseObject, parseString } from "../lib/validation";
import { badRequest } from "../lib/http";
import { createImportData, deleteImportWithRecords, listImports, previewImportData } from "../lib/importPipeline";
import { IMPORT_SOURCE_VALUES, type ImportSource } from "../shared/contracts";

const ensureSource = (value: unknown): ImportSource | undefined => {
  const source = parseString(value, "source", { optional: true, trim: true, maxLength: 50 });
  if (source === undefined || source.length === 0) {
    return undefined;
  }
  if ((IMPORT_SOURCE_VALUES as readonly string[]).includes(source)) {
    return source as ImportSource;
  }
  throw badRequest(`source must be one of: ${IMPORT_SOURCE_VALUES.join(", ")}`);
};

const parseImportBody = (body: unknown) => {
  const parsed = parseObject(body, "body");
  assertAllowedKeys(parsed, ["fileName", "content", "source"], "import body");

  const fileName = parseString(parsed.fileName, "fileName", {
    trim: true,
    allowEmpty: false,
    maxLength: 300,
  });
  const content = parseString(parsed.content, "content", {
    trim: false,
    allowEmpty: false,
    maxLength: 10_000_000,
  });
  const source = ensureSource(parsed.source) ?? "auto";

  if (fileName === undefined || content === undefined) {
    throw badRequest("fileName and content are required");
  }

  return { fileName, content, source };
};

export const preview = async (req: Request, res: Response) => {
  const payload = parseImportBody(req.body);
  const result = await previewImportData(payload);
  return res.send(result);
};

export const create = async (req: Request, res: Response) => {
  const payload = parseImportBody(req.body);
  const result = await createImportData(payload);
  return res.status(201).send(result);
};

export const listing = async (req: Request, res: Response) => {
  const offset = parseInteger(req.query.offset, "offset", { defaultValue: 0, min: 0 });
  const limit = parseInteger(req.query.limit, "limit", { defaultValue: 25, min: 1, max: 200 });
  const result = await listImports(offset, limit);
  return res.send(result);
};

export const remove = async (req: Request, res: Response) => {
  const importId = parseInteger(req.params.id, "id", { min: 1 });
  const result = await deleteImportWithRecords(importId);
  return res.send(result);
};
