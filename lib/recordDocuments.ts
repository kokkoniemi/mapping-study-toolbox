import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { Op } from "sequelize";

import db from "../models";
import type { DocumentChunkCreationAttributes, RecordDocumentModel } from "../models/types";
import type {
  RecordDocumentExtractResponse,
  RecordDocumentSummary,
  RecordDocumentsIndexResponse,
} from "../shared/contracts";
import { badRequest, notFound } from "./http";
import type { ParsedMultipartFile } from "./multipart";
import {
  getAppDataDir,
  getPdfStorageDir,
  toAbsoluteStoragePath,
  toRelativeStoragePath,
} from "./storagePaths";
import { requestWorkerExtraction } from "./workerClient";

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

const toWarningList = (value: string[] | null | undefined) => Array.isArray(value) ? value : [];

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
  sourceType: document.sourceType,
  pageCount: document.pageCount,
  extractorKind: document.extractorKind,
  extractorVersion: document.extractorVersion,
  extractedTextPath: document.extractedTextPath,
  structuredDocumentPath: document.structuredDocumentPath,
  chunkManifestPath: document.chunkManifestPath,
  extractionError: document.extractionError,
  qualityStatus: document.qualityStatus,
  qualityScore: document.qualityScore,
  printableTextRatio: document.printableTextRatio,
  weirdCharacterRatio: document.weirdCharacterRatio,
  ocrUsed: Boolean(document.ocrUsed),
  ocrConfidence: document.ocrConfidence,
  extractionWarnings: toWarningList(document.extractionWarnings),
  isActive: Boolean(document.isActive),
  createdAt: toIso(document.createdAt),
  updatedAt: toIso(document.updatedAt),
});

const safeBaseName = (value: string) =>
  value.replace(/[^a-z0-9._-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "document";

const getStoredDocumentPath = (relativePath: string | null | undefined) =>
  relativePath ? toAbsoluteStoragePath(relativePath) : null;

const deleteIfPresent = (relativePath: string | null | undefined) => {
  const absolutePath = getStoredDocumentPath(relativePath);
  if (!absolutePath) {
    return;
  }

  try {
    fs.rmSync(absolutePath, { force: true });
  } catch {
    // Ignore missing artifacts so metadata cleanup still completes.
  }
};

const normalizeChunkRows = (recordDocumentId: number, chunks: Awaited<ReturnType<typeof requestWorkerExtraction>>["chunks"]) =>
  chunks.map<DocumentChunkCreationAttributes>((chunk) => ({
    recordDocumentId,
    chunkKey: chunk.chunkKey,
    chunkIndex: chunk.chunkIndex,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    sectionName: chunk.sectionName,
    headingPath: chunk.headingPath,
    text: chunk.text,
    charCount: chunk.charCount,
    tokenCount: chunk.tokenCount,
    embeddingReference: chunk.embeddingReference,
    qualityScore: chunk.qualityScore,
    qualityFlags: chunk.qualityFlags,
  }));

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
    sourceType: "unknown",
    pageCount: null,
    extractorKind: null,
    extractorVersion: null,
    extractedTextPath: null,
    structuredDocumentPath: null,
    chunkManifestPath: null,
    extractionError: null,
    qualityStatus: "pending",
    qualityScore: null,
    printableTextRatio: null,
    weirdCharacterRatio: null,
    ocrUsed: false,
    ocrConfidence: null,
    extractionWarnings: [],
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

  deleteIfPresent(document.storedPath);
  deleteIfPresent(document.extractedTextPath);
  deleteIfPresent(document.structuredDocumentPath);
  deleteIfPresent(document.chunkManifestPath);

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
    const result = await requestWorkerExtraction({
      recordId,
      documentId,
      absolutePdfPath: toAbsoluteStoragePath(document.storedPath),
      appDataDir: getAppDataDir(),
      relativePdfPath: document.storedPath,
    });

    await db.DocumentChunk.destroy({ where: { recordDocumentId: document.id } });
    if (result.chunks.length > 0) {
      await db.DocumentChunk.bulkCreate(normalizeChunkRows(document.id, result.chunks));
    }

    document.extractionStatus =
      result.qualityStatus === "passed"
        ? "completed"
        : result.qualityStatus === "needs_review"
          ? "needs_review"
          : "failed";
    document.sourceType = result.sourceType;
    document.pageCount = result.pageCount;
    document.extractorKind = result.extractorKind;
    document.extractorVersion = result.extractorVersion;
    document.extractedTextPath = result.extractedTextPath;
    document.structuredDocumentPath = result.structuredDocumentPath;
    document.chunkManifestPath = result.chunkManifestPath;
    document.extractionError = result.qualityStatus === "failed"
      ? (result.warnings[0] ?? "Document extraction failed quality checks")
      : null;
    document.qualityStatus = result.qualityStatus;
    document.qualityScore = result.qualityScore;
    document.printableTextRatio = result.printableTextRatio;
    document.weirdCharacterRatio = result.weirdCharacterRatio;
    document.ocrUsed = result.ocrUsed;
    document.ocrConfidence = result.ocrConfidence;
    document.extractionWarnings = result.warnings;
    await document.save();

    return {
      document: toDocumentSummary(document),
      extractedCharacters: result.extractedCharacters,
      chunkCount: result.chunks.length,
    };
  } catch (error) {
    document.extractionStatus = "failed";
    document.extractionError = error instanceof Error ? error.message : String(error);
    document.qualityStatus = "failed";
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
      extractionStatus: { [Op.in]: ["completed", "needs_review"] },
    },
    order: [["createdAt", "DESC"], ["id", "DESC"]],
  });

export const readExtractedDocumentText = (relativePath: string) =>
  fs.readFileSync(toAbsoluteStoragePath(relativePath), "utf8");
