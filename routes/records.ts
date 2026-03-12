import type { Request, Response } from "express";
import { Op } from "sequelize";

import { badRequest, notFound, tooManyRequests } from "../lib/http";
import {
  cancelEnrichmentJob,
  createEnrichmentJob,
  getEnrichmentJob,
  getEnrichmentQueueStatus,
} from "../lib/recordEnrichment";
import {
  RECORD_STATUS_VALUES,
  type EnrichmentMode,
  type EnrichmentJobOptions,
  type EnrichmentProvider,
  type OpenAlexTopicPatchItem,
  type PatchRecordPayload,
  type RecordStatus,
} from "../shared/contracts";
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

const VALID_STATUSES: readonly RecordStatus[] = RECORD_STATUS_VALUES;
const VALID_STATUSES_TEXT = ["null", "uncertain", "excluded", "included"] as const;
const VALID_ENRICHMENT_MODES = ["missing", "full"] as const;
const RECORD_LIST_DEFAULT_MAX = Number.parseInt(process.env.RECORD_LIST_LIMIT_MAX ?? "", 10) || 250;
const ENRICHMENT_MAX_RECORDS_PER_JOB = Number.parseInt(process.env.ENRICHMENT_MAX_RECORDS_PER_JOB ?? "", 10) || 500;
const LIST_RECORD_ATTRIBUTES = [
  "id",
  "title",
  "url",
  "author",
  "year",
  "status",
  "abstract",
  "databases",
  "alternateUrls",
  "enrichmentProvenance",
  "forumId",
  "doi",
  "citationCount",
  "editedBy",
  "comment",
  "crossrefEnrichedAt",
  "crossrefLastError",
  "openAlexId",
  "openAlexEnrichedAt",
  "openAlexLastError",
  "openAlexTopicItems",
  "createdAt",
  "updatedAt",
] as const;

const TOPIC_PATCH_ALLOWED_KEYS = [
  "id",
  "displayName",
  "score",
  "subfield",
  "field",
  "domain",
] as const;

const parseBooleanQuery = (value: unknown, key: string): boolean => {
  const raw = parseString(value, key, { optional: true, trim: true });
  if (raw === undefined || raw.length === 0) {
    return false;
  }
  if (raw === "1" || raw.toLocaleLowerCase() === "true") {
    return true;
  }
  if (raw === "0" || raw.toLocaleLowerCase() === "false") {
    return false;
  }
  throw badRequest(`${key} must be one of: 1, 0, true, false`);
};

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

const parseImportIdQuery = (value: unknown): number | undefined => {
  const importId = parseString(value, "importId", { optional: true, trim: true });
  if (importId === undefined || importId.length === 0) {
    return undefined;
  }

  return parseInteger(importId, "importId", { min: 1 });
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

const parseTopicScore = (value: unknown, fieldName: string): number | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw badRequest(`${fieldName} must be a number or null`);
  }
  if (value < 0 || value > 1) {
    throw badRequest(`${fieldName} must be between 0 and 1`);
  }
  return value;
};

const parseOpenAlexTopicItems = (value: unknown): OpenAlexTopicPatchItem[] | null => {
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw badRequest("openAlexTopicItems must be an array or null");
  }
  if (value.length > 200) {
    throw badRequest("openAlexTopicItems must have at most 200 items");
  }

  const topics: OpenAlexTopicPatchItem[] = [];
  const seen = new Set<string>();

  for (const [index, item] of value.entries()) {
    const topic = parseObject(item, `openAlexTopicItems[${index}]`);
    assertAllowedKeys(topic, TOPIC_PATCH_ALLOWED_KEYS, `openAlexTopicItems[${index}]`);

    const displayName = parseString(topic.displayName, `openAlexTopicItems[${index}].displayName`, {
      trim: true,
      allowEmpty: false,
      maxLength: 500,
    });
    if (displayName === undefined) {
      throw badRequest(`openAlexTopicItems[${index}].displayName is required`);
    }
    const key = displayName.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const id = parseString(topic.id, `openAlexTopicItems[${index}].id`, {
      optional: true,
      trim: true,
      allowEmpty: false,
      maxLength: 300,
    });
    const score = parseTopicScore(topic.score, `openAlexTopicItems[${index}].score`);
    const subfield = parseString(topic.subfield, `openAlexTopicItems[${index}].subfield`, {
      optional: true,
      trim: true,
      allowEmpty: false,
      maxLength: 300,
    });
    const field = parseString(topic.field, `openAlexTopicItems[${index}].field`, {
      optional: true,
      trim: true,
      allowEmpty: false,
      maxLength: 300,
    });
    const domain = parseString(topic.domain, `openAlexTopicItems[${index}].domain`, {
      optional: true,
      trim: true,
      allowEmpty: false,
      maxLength: 300,
    });

    topics.push({
      displayName,
      id: id ?? null,
      score,
      subfield: subfield ?? null,
      field: field ?? null,
      domain: domain ?? null,
    });
  }

  return topics;
};

export const listing = async (req: Request, res: Response) => {
  const offset = parseInteger(req.query.offset, "offset", { defaultValue: 0, min: 0 });
  const limit = parseInteger(req.query.limit, "limit", {
    defaultValue: 25,
    min: 1,
    max: RECORD_LIST_DEFAULT_MAX,
  });
  const status = parseStatusQuery(req.query.status);
  const importId = parseImportIdQuery(req.query.importId);
  const withDetails = parseBooleanQuery(req.query.withDetails, "withDetails");
  const search = parseString(req.query.search, "search", {
    optional: true,
    trim: true,
    maxLength: 500,
  });

  const where: Record<PropertyKey, unknown> = {};

  if (status !== undefined) {
    where.status = status;
  }

  if (importId !== undefined) {
    where.importId = importId;
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
      attributes: withDetails
        ? undefined
        : [
          ...LIST_RECORD_ATTRIBUTES,
          [
            db.Sequelize.fn(
              "COALESCE",
              db.Sequelize.fn("json_array_length", db.Sequelize.col("referenceItems")),
              0,
            ),
            "referenceCount",
          ],
          [
            db.Sequelize.fn(
              "COALESCE",
              db.Sequelize.fn("json_array_length", db.Sequelize.col("openAlexTopicItems")),
              0,
            ),
            "topicCount",
          ],
        ],
      include: [
        {
          association: "Forum",
          attributes: withDetails
            ? undefined
            : [
              "id",
              "name",
              "jufoLevel",
              "issn",
              "publisher",
              "jufoFetchedAt",
              "jufoLastError",
              "enrichmentProvenance",
            ],
        },
        {
          association: "MappingOptions",
          attributes: withDetails
            ? undefined
            : ["id", "title", "color", "mappingQuestionId"],
          through: { attributes: [] },
        },
      ],
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
      "year",
      "status",
      "comment",
      "abstract",
      "databases",
      "alternateUrls",
      "openAlexTopicItems",
      "editedBy",
    ],
    "record patch body",
  );

  const updates: PatchRecordPayload = {};

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

  if ("year" in body) {
    if (body.year === null) {
      updates.year = null;
    } else {
      updates.year = parseInteger(body.year, "year", { min: 1000, max: 3000 });
    }
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

  if ("openAlexTopicItems" in body) {
    updates.openAlexTopicItems = parseOpenAlexTopicItems(body.openAlexTopicItems);
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
  const [record, question, option] = await Promise.all([
    db.Record.findByPk(recordId),
    db.MappingQuestion.findByPk(mappingQuestionId),
    db.MappingOption.findByPk(mappingOptionId),
  ]);

  if (!record) {
    throw notFound(`Record ${recordId} not found`);
  }

  if (!question) {
    throw notFound(`MappingQuestion ${mappingQuestionId} not found`);
  }

  if (!option) {
    throw notFound(`MappingOption ${mappingOptionId} not found`);
  }

  if (option.mappingQuestionId !== mappingQuestionId) {
    throw badRequest(
      `MappingOption ${mappingOptionId} does not belong to MappingQuestion ${mappingQuestionId}`,
    );
  }

  const existing = await db.RecordMappingOption.findOne({
    where: { recordId, mappingOptionId },
  });

  if (!existing) {
    await db.RecordMappingOption.create({
      recordId,
      mappingQuestionId,
      mappingOptionId,
    });
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
  const queue = getEnrichmentQueueStatus();
  if (queue.queuedJobs >= queue.maxQueuedJobs) {
    throw tooManyRequests("Enrichment queue is full. Please wait for existing jobs to complete.", queue);
  }

  const body = parseObject(req.body, "body");
  assertAllowedKeys(
    body,
    ["recordIds", "provider", "mode", "maxCitations", "forceRefresh"],
    "enrichment job body",
  );

  const recordIds = parseIntegerArray(body.recordIds, "recordIds", {
    min: 1,
    minItems: 1,
    maxItems: ENRICHMENT_MAX_RECORDS_PER_JOB,
  });
  if (!recordIds) {
    throw badRequest("recordIds are required");
  }

  const provider = parseString(body.provider, "provider", {
    optional: true,
    trim: true,
    allowEmpty: false,
    maxLength: 20,
  });
  const validProviders: EnrichmentProvider[] = ["crossref", "openalex", "all"];
  if (provider !== undefined && !validProviders.includes(provider as EnrichmentProvider)) {
    throw badRequest("provider must be one of: crossref, openalex, all");
  }

  const mode = parseString(body.mode, "mode", {
    optional: true,
    trim: true,
    allowEmpty: false,
    maxLength: 20,
  });
  if (mode !== undefined && !VALID_ENRICHMENT_MODES.includes(mode as EnrichmentMode)) {
    throw badRequest("mode must be one of: missing, full");
  }

  const maxCitations = body.maxCitations === undefined
    ? undefined
    : parseInteger(body.maxCitations, "maxCitations", {
      min: 0,
      max: 50000,
    });

  const forceRefreshRaw = body.forceRefresh;
  if (forceRefreshRaw !== undefined && typeof forceRefreshRaw !== "boolean") {
    throw badRequest("forceRefresh must be a boolean");
  }
  const forceRefresh = forceRefreshRaw === true;

  const jobPayload: EnrichmentJobOptions = {
    ...(provider !== undefined ? { provider: provider as EnrichmentProvider } : {}),
    ...(mode !== undefined ? { mode: mode as EnrichmentMode } : {}),
    ...(maxCitations !== undefined ? { maxCitations } : {}),
    forceRefresh,
  };

  const job = createEnrichmentJob(recordIds, jobPayload);
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

  const compact = parseBooleanQuery(req.query.compact, "compact");
  const resultCursor = parseInteger(req.query.resultCursor, "resultCursor", {
    defaultValue: 0,
    min: 0,
  });
  const updatedCursor = parseInteger(req.query.updatedCursor, "updatedCursor", {
    defaultValue: 0,
    min: 0,
  });

  const job = getEnrichmentJob(jobId, {
    compact,
    resultCursor,
    updatedCursor,
  });
  if (!job) {
    throw notFound(`Enrichment job ${jobId} not found`);
  }

  return res.send(job);
};

export const cancelEnrichment = async (req: Request, res: Response) => {
  const jobId = parseString(req.params.jobId, "jobId", {
    trim: true,
    allowEmpty: false,
    maxLength: 120,
  });
  if (!jobId) {
    throw badRequest("jobId is required");
  }

  const job = cancelEnrichmentJob(jobId);
  if (!job) {
    throw notFound(`Enrichment job ${jobId} not found`);
  }

  return res.send(job);
};
