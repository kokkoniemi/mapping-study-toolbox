import fs from "node:fs";
import path from "node:path";

const APP_DATA_DIR = process.env.APP_DATA_DIR?.trim() || process.cwd();
const STORAGE_DIR = path.resolve(APP_DATA_DIR, "storage");

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
};

export const getAppDataDir = () => APP_DATA_DIR;
export const getStorageDir = () => ensureDir(STORAGE_DIR);
export const getPdfStorageDir = () => ensureDir(path.join(getStorageDir(), "pdfs"));
export const getPdfTextStorageDir = () => ensureDir(path.join(getStorageDir(), "pdf-text"));
export const getPdfStructureStorageDir = () => ensureDir(path.join(getStorageDir(), "pdf-structure"));
export const getPdfChunkStorageDir = () => ensureDir(path.join(getStorageDir(), "pdf-chunks"));
export const getPdfEmbeddingStorageDir = () => ensureDir(path.join(getStorageDir(), "pdf-embeddings"));
export const getTopicModelStorageDir = () => ensureDir(path.join(getStorageDir(), "topic-models"));
export const getKeywordingReportStorageDir = () => ensureDir(path.join(getStorageDir(), "keywording-reports"));

export const toRelativeStoragePath = (absolutePath: string) => path.relative(APP_DATA_DIR, absolutePath);
export const toAbsoluteStoragePath = (relativePath: string) => path.resolve(APP_DATA_DIR, relativePath);
