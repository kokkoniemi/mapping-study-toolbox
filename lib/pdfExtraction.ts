import fs from "node:fs";
import { spawnSync } from "node:child_process";

const PDFTOTEXT_PATH = process.env.PDFTOTEXT_BIN?.trim() || "pdftotext";
const PDFTOTEXT_TIMEOUT_MS = Number.parseInt(process.env.PDFTOTEXT_TIMEOUT_MS ?? "", 10) || 30_000;

const normalizeExtractedText = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\f/g, "\n")
    .replace(/\0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const qualityMetrics = (value: string) => {
  const visible = [...value].filter((char) => !/\s/u.test(char));
  const replacementCount = [...value.matchAll(/�/gu)].length;
  const letterOrDigitCount = [...value.matchAll(/[\p{L}\p{N}]/gu)].length;

  return {
    visibleCount: visible.length,
    replacementRatio: visible.length > 0 ? replacementCount / visible.length : 1,
    alphaNumericRatio: visible.length > 0 ? letterOrDigitCount / visible.length : 0,
  };
};

const isExtractionGoodEnough = (value: string) => {
  const metrics = qualityMetrics(value);
  return (
    metrics.visibleCount >= 40
    && metrics.replacementRatio <= 0.01
    && metrics.alphaNumericRatio >= 0.45
  );
};

const fallbackLiteralExtraction = (filePath: string) => {
  const utf8 = fs.readFileSync(filePath).toString("utf8");
  const literalMatches = [...utf8.matchAll(/\(([^()]{4,500})\)/g)].map((match) => match[1]);
  return normalizeExtractedText(literalMatches.join("\n"));
};

export const extractTextFromPdfFile = (filePath: string) => {
  const result = spawnSync(
    PDFTOTEXT_PATH,
    ["-layout", "-enc", "UTF-8", "-nopgbrk", filePath, "-"],
    {
      encoding: "utf8",
      timeout: PDFTOTEXT_TIMEOUT_MS,
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  const primaryOutput = normalizeExtractedText(result.stdout ?? "");
  if (!result.error && result.status === 0 && isExtractionGoodEnough(primaryOutput)) {
    return primaryOutput;
  }

  const fallbackOutput = fallbackLiteralExtraction(filePath);
  if (isExtractionGoodEnough(fallbackOutput)) {
    return fallbackOutput;
  }

  const reason =
    result.error?.message
    || (typeof result.stderr === "string" && result.stderr.trim().length > 0 ? result.stderr.trim() : "")
    || "Unable to extract meaningful text from PDF";
  throw new Error(reason);
};
