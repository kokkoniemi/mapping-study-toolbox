import type { Request, Response } from "express";
import type { CreateKeywordingJobPayload, KeywordingAnalysisMode } from "../shared/contracts";

import {
  cancelKeywordingJob,
  createKeywordingJob,
  getKeywordingJob,
  getKeywordingReport,
  listKeywordingJobs,
} from "../lib/keywording";
import { badRequest } from "../lib/http";
import { assertAllowedKeys, parseBoolean, parseIntegerArray, parseObject, parseString } from "../lib/validation";

const parseCreateBody = (body: unknown): CreateKeywordingJobPayload => {
  const parsed = parseObject(body, "body");
  assertAllowedKeys(parsed, ["recordIds", "mappingQuestionIds", "analysisMode", "reuseEmbeddingCache"], "keywording job body");

  const recordIds = parseIntegerArray(parsed.recordIds, "recordIds", {
    min: 1,
    minItems: 1,
    maxItems: 5000,
  });
  const mappingQuestionIds =
    parsed.mappingQuestionIds === undefined
      ? undefined
      : parseIntegerArray(parsed.mappingQuestionIds, "mappingQuestionIds", {
        min: 1,
        minItems: 1,
        maxItems: 500,
      });
  const analysisMode =
    parsed.analysisMode === undefined
      ? undefined
      : parseString(parsed.analysisMode, "analysisMode", { trim: true, allowEmpty: false, maxLength: 32 });
  if (analysisMode !== undefined && analysisMode !== "standard" && analysisMode !== "advanced") {
    throw badRequest("analysisMode must be either standard or advanced");
  }
  const reuseEmbeddingCache =
    parsed.reuseEmbeddingCache === undefined
      ? undefined
      : parseBoolean(parsed.reuseEmbeddingCache, "reuseEmbeddingCache");

  if (!recordIds || recordIds.length === 0) {
    throw new Error("recordIds validation should guarantee at least one record");
  }

  return { recordIds, mappingQuestionIds, analysisMode: analysisMode as KeywordingAnalysisMode | undefined, reuseEmbeddingCache };
};

export const listing = async (_req: Request, res: Response) => {
  return res.send(await listKeywordingJobs());
};

export const create = async (req: Request, res: Response) => {
  const payload = parseCreateBody(req.body);
  return res.status(202).send(await createKeywordingJob(payload));
};

export const get = async (req: Request, res: Response) => {
  const jobId = parseString(req.params.jobId, "jobId", {
    trim: true,
    allowEmpty: false,
    maxLength: 120,
  }) as string;
  return res.send(await getKeywordingJob(jobId));
};

export const cancel = async (req: Request, res: Response) => {
  const jobId = parseString(req.params.jobId, "jobId", {
    trim: true,
    allowEmpty: false,
    maxLength: 120,
  }) as string;
  return res.send(await cancelKeywordingJob(jobId));
};

export const report = async (req: Request, res: Response) => {
  const jobId = parseString(req.params.jobId, "jobId", {
    trim: true,
    allowEmpty: false,
    maxLength: 120,
  }) as string;
  const file = await getKeywordingReport(jobId);
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
  return res.send(file.content);
};
