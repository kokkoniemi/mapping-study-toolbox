import type { Request, Response } from "express";

import {
  deleteRecordDocument,
  extractRecordDocument,
  getRecordDocument,
  listRecordDocuments,
  uploadRecordDocument,
} from "../lib/recordDocuments";
import { parseSingleMultipartFile } from "../lib/multipart";
import { parseInteger } from "../lib/validation";

const parseIds = (req: Request) => ({
  recordId: parseInteger(req.params.recordId, "recordId", { min: 1 }),
  documentId: parseInteger(req.params.documentId, "documentId", { min: 1 }),
});

export const listing = async (req: Request, res: Response) => {
  const recordId = parseInteger(req.params.recordId, "recordId", { min: 1 });
  return res.send(await listRecordDocuments(recordId));
};

export const get = async (req: Request, res: Response) => {
  const { recordId, documentId } = parseIds(req);
  return res.send(await getRecordDocument(recordId, documentId));
};

export const upload = async (req: Request, res: Response) => {
  const recordId = parseInteger(req.params.recordId, "recordId", { min: 1 });
  const file = await parseSingleMultipartFile(req, { fieldName: "file" });
  return res.status(201).send(await uploadRecordDocument(recordId, file));
};

export const remove = async (req: Request, res: Response) => {
  const { recordId, documentId } = parseIds(req);
  return res.send(await deleteRecordDocument(recordId, documentId));
};

export const extract = async (req: Request, res: Response) => {
  const { recordId, documentId } = parseIds(req);
  return res.send(await extractRecordDocument(recordId, documentId));
};
