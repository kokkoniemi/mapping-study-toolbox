import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import db from "../models";
import type { RecordDocumentModel } from "../models/types";
import type {
  RecordDocumentExtractResponse,
  RecordDocumentSummary,
  RecordDocumentsIndexResponse,
} from "../shared/contracts";
import { badRequest, notFound } from "./http";
import type { ParsedMultipartFile } from "./multipart";
import {
  getPdfStorageDir,
  getPdfTextStorageDir,
  toAbsoluteStoragePath,
  toRelativeStoragePath,
} from "./storagePaths";

const MAX_PDF_BYTES = Number.parseInt(process.env.RECORD_DOCUMENT_MAX_BYTES ?? "", 10) || 20_000_000;

const isPdfUpload = (fileName: string, contentType: string, data: Buffer) =>
  fileName.toLowerCase().endsWith(".pdf")
  || contentType.toLowerCase() === "application/pdf"
  || data.subarray(0, 4).toString("ascii") === "%PDF";

const ensureRecordExists = async (recordId: number) => {
  const record = await db.Record.findByPk(recordId);
  if (!record) {
    throw notFound(`Record ${recordId} not found`);
  }
  return record;
};

const toIso = (value: Date | string | null | undefined) => {
  if (!value) {
    return "";
  }
  return value instanceof Date ? value.toISOString() : String(value);
};

const toDocumentSummary = (document: RecordDocumentModel): RecordDocumentSummary => ({
  id: document.id,
  recordId: document.recordId,
  originalFileName: document.originalFileName,
  storedPath: document.storedPath,
  mimeType: document.mimeType,
  checksum: document.checksum,
  fileSize: document.fileSize,
  uploadStatus: document.uploadStatus,
  extractionStatus: document.extractionStatus,
  extractedTextPath: document.extractedTextPath,
  extractionError: document.extractionError,
  isActive: Boolean(document.isActive),
  createdAt: toIso(document.createdAt),
  updatedAt: toIso(document.updatedAt),
});

const safeBaseName = (value: string) =>
  value.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "document";

const extractTextFromPdf = (buffer: Buffer) => {
  const utf8 = buffer.toString("utf8");
  const literalMatches = [...utf8.matchAll(/\(([^()]{4,500})\)/g)].map((match) => match[1]);
  const candidate = literalMatches.length > 0 ? literalMatches.join("\n") : utf8;
  const normalized = candidate
    .replace(/\0/g, " ")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length < 20) {
    throw new Error("Unable to extract meaningful text from PDF");
  }

  return normalized;
};

const writeExtractedText = (recordId: number, documentId: number, text: string) => {
  const recordDir = path.join(getPdfTextStorageDir(), `record-${recordId}`);
  fs.mkdirSync(recordDir, { recursive: true });
  const outputPath = path.join(recordDir, `document-${documentId}.txt`);
  fs.writeFileSync(outputPath, `${text}\n`, "utf8");
  return toRelativeStoragePath(outputPath);
};

const getStoredDocumentPath = (relativePath: string) => toAbsoluteStoragePath(relativePath);

export const listRecordDocuments = async (recordId: number): Promise<RecordDocumentsIndexResponse> => {
  await ensureRecordExists(recordId);
  const documents = await db.RecordDocument.findAll({
    where: { recordId },
    order: [["createdAt", "DESC"], ["id", "DESC"]],
  });

  return {
    count: documents.length,
    documents: documents.map((document) => toDocumentSummary(document)),
  };
};

export const getRecordDocument = async (recordId: number, documentId: number): Promise<RecordDocumentSummary> => {
  await ensureRecordExists(recordId);
  const document = await db.RecordDocument.findOne({
    where: { id: documentId, recordId },
  });
  if (!document) {
    throw notFound(`Document ${documentId} not found for record ${recordId}`);
  }
  return toDocumentSummary(document);
};

export const uploadRecordDocument = async (
  recordId: number,
  file: ParsedMultipartFile,
): Promise<RecordDocumentSummary> => {
  await ensureRecordExists(recordId);

  if (file.data.length <= 0) {
    throw badRequest("uploaded PDF must not be empty");
  }
  if (file.data.length > MAX_PDF_BYTES) {
    throw badRequest(`uploaded PDF must be at most ${MAX_PDF_BYTES} bytes`);
  }
  if (!isPdfUpload(file.fileName, file.contentType, file.data)) {
    throw badRequest("uploaded file must be a PDF");
  }

  const checksum = createHash("sha256").update(file.data).digest("hex");
  const recordDir = path.join(getPdfStorageDir(), `record-${recordId}`);
  fs.mkdirSync(recordDir, { recursive: true });
  const storedFileName = `${Date.now()}-${safeBaseName(file.fileName)}`;
  const absolutePath = path.join(recordDir, storedFileName);
  fs.writeFileSync(absolutePath, file.data);
  const relativePath = toRelativeStoragePath(absolutePath);

  await db.RecordDocument.update(
    { isActive: false },
    {
      where: {
        recordId,
        uploadStatus: "uploaded",
      },
    },
  );

  const document = await db.RecordDocument.create({
    recordId,
    originalFileName: file.fileName,
    storedPath: relativePath,
    mimeType: file.contentType,
    checksum,
    fileSize: file.data.length,
    uploadStatus: "uploaded",
    extractionStatus: "pending",
    extractedTextPath: null,
    extractionError: null,
    isActive: true,
  });

  return toDocumentSummary(document);
};

export const deleteRecordDocument = async (recordId: number, documentId: number): Promise<RecordDocumentSummary> => {
  await ensureRecordExists(recordId);
  const document = await db.RecordDocument.findOne({ where: { id: documentId, recordId } });
  if (!document) {
    throw notFound(`Document ${documentId} not found for record ${recordId}`);
  }

  document.uploadStatus = "deleted";
  document.isActive = false;
  await document.save();

  try {
    fs.rmSync(getStoredDocumentPath(document.storedPath), { force: true });
  } catch {
    // Ignore missing files so metadata can still be updated.
  }

  if (document.extractedTextPath) {
    try {
      fs.rmSync(getStoredDocumentPath(document.extractedTextPath), { force: true });
    } catch {
      // Ignore missing text artifacts.
    }
  }

  const replacement = await db.RecordDocument.findOne({
    where: {
      recordId,
      uploadStatus: "uploaded",
    },
    order: [["createdAt", "DESC"], ["id", "DESC"]],
  });
  if (replacement) {
    replacement.isActive = true;
    await replacement.save();
  }

  return toDocumentSummary(document);
};

export const extractRecordDocument = async (
  recordId: number,
  documentId: number,
): Promise<RecordDocumentExtractResponse> => {
  await ensureRecordExists(recordId);
  const document = await db.RecordDocument.findOne({ where: { id: documentId, recordId } });
  if (!document) {
    throw notFound(`Document ${documentId} not found for record ${recordId}`);
  }
  if (document.uploadStatus !== "uploaded") {
    throw badRequest("cannot extract text from a deleted document");
  }

  document.extractionStatus = "running";
  document.extractionError = null;
  await document.save();

  try {
    const content = fs.readFileSync(getStoredDocumentPath(document.storedPath));
    const extractedText = extractTextFromPdf(content);
    const extractedTextPath = writeExtractedText(recordId, documentId, extractedText);

    document.extractionStatus = "completed";
    document.extractedTextPath = extractedTextPath;
    document.extractionError = null;
    await document.save();

    return {
      document: toDocumentSummary(document),
      extractedCharacters: extractedText.length,
    };
  } catch (error) {
    document.extractionStatus = "failed";
    document.extractionError = error instanceof Error ? error.message : String(error);
    await document.save();
    throw badRequest(`text extraction failed: ${document.extractionError}`);
  }
};

export const getActiveExtractedDocumentForRecord = async (recordId: number) =>
  db.RecordDocument.findOne({
    where: {
      recordId,
      isActive: true,
      uploadStatus: "uploaded",
      extractionStatus: "completed",
    },
    order: [["createdAt", "DESC"], ["id", "DESC"]],
  });

export const readExtractedDocumentText = (relativePath: string) =>
  fs.readFileSync(getStoredDocumentPath(relativePath), "utf8");
