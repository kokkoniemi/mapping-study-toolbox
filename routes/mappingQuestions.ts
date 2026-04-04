import type { Request, Response } from "express";

import {
  assertAllowedKeys,
  parseBoolean,
  parseInteger,
  parseObject,
  parseOptionalNullableString,
  parseString,
  parseStringArray,
} from "../lib/validation";
import { notFound } from "../lib/http";
import db from "../models";

const parseGuidanceFields = (body: Record<string, unknown>) => {
  const description = parseOptionalNullableString(body.description, "description", {
    trim: true,
    maxLength: 10_000,
  });
  const decisionGuidance = parseOptionalNullableString(body.decisionGuidance, "decisionGuidance", {
    trim: true,
    maxLength: 20_000,
  });
  const positiveExamples =
    body.positiveExamples === undefined
      ? undefined
      : parseStringArray(body.positiveExamples, "positiveExamples", {
        trim: true,
        maxItemLength: 2000,
        maxItems: 50,
      });
  const negativeExamples =
    body.negativeExamples === undefined
      ? undefined
      : parseStringArray(body.negativeExamples, "negativeExamples", {
        trim: true,
        maxItemLength: 2000,
        maxItems: 50,
      });
  const evidenceInstructions = parseOptionalNullableString(body.evidenceInstructions, "evidenceInstructions", {
    trim: true,
    maxLength: 10_000,
  });
  const allowNewOption =
    body.allowNewOption === undefined
      ? undefined
      : parseBoolean(body.allowNewOption, "allowNewOption");

  return {
    description,
    decisionGuidance,
    positiveExamples,
    negativeExamples,
    evidenceInstructions,
    allowNewOption,
  };
};

export const listing = async (_req: Request, res: Response) => {
  const [count, questions] = await Promise.all([
    db.MappingQuestion.count(),
    db.MappingQuestion.findAll({
      include: db.MappingOption,
      order: [
        ["position", "ASC"],
        [db.MappingOption, "position", "ASC"],
      ],
    }),
  ]);

  return res.send({ count, questions });
};

export const create = async (req: Request, res: Response) => {
  const body = parseObject(req.body, "body");
  assertAllowedKeys(
    body,
    [
      "title",
      "type",
      "position",
      "description",
      "decisionGuidance",
      "positiveExamples",
      "negativeExamples",
      "evidenceInstructions",
      "allowNewOption",
    ],
    "mapping question body",
  );

  const title = parseString(body.title, "title", { trim: true, maxLength: 500 });
  const type = parseString(body.type, "type", { trim: true, maxLength: 64 });
  const position = parseInteger(body.position, "position", { min: 0 });
  const guidance = parseGuidanceFields(body);

  const question = await db.MappingQuestion.create({
    title,
    type,
    position,
    description: guidance.description ?? null,
    decisionGuidance: guidance.decisionGuidance ?? null,
    positiveExamples: guidance.positiveExamples ?? [],
    negativeExamples: guidance.negativeExamples ?? [],
    evidenceInstructions: guidance.evidenceInstructions ?? null,
    allowNewOption: guidance.allowNewOption ?? true,
  });

  return res.send(question);
};

export const update = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.id, "id", { min: 1 });
  const body = parseObject(req.body, "body");

  assertAllowedKeys(
    body,
    [
      "title",
      "type",
      "position",
      "description",
      "decisionGuidance",
      "positiveExamples",
      "negativeExamples",
      "evidenceInstructions",
      "allowNewOption",
    ],
    "mapping question update body",
  );

  const title = parseString(body.title, "title", { optional: true, trim: true, maxLength: 500 });
  const type = parseString(body.type, "type", { optional: true, trim: true, maxLength: 64 });
  const position =
    body.position === undefined ? undefined : parseInteger(body.position, "position", { min: 0 });
  const guidance = parseGuidanceFields(body);

  const question = await db.MappingQuestion.findByPk(id, { include: "MappingOptions" });
  if (!question) {
    throw notFound(`MappingQuestion ${id} not found`);
  }

  await question.update({
    ...(title !== undefined ? { title } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(position !== undefined ? { position } : {}),
    ...(guidance.description !== undefined ? { description: guidance.description } : {}),
    ...(guidance.decisionGuidance !== undefined ? { decisionGuidance: guidance.decisionGuidance } : {}),
    ...(guidance.positiveExamples !== undefined ? { positiveExamples: guidance.positiveExamples } : {}),
    ...(guidance.negativeExamples !== undefined ? { negativeExamples: guidance.negativeExamples } : {}),
    ...(guidance.evidenceInstructions !== undefined ? { evidenceInstructions: guidance.evidenceInstructions } : {}),
    ...(guidance.allowNewOption !== undefined ? { allowNewOption: guidance.allowNewOption } : {}),
  });

  return res.send(question);
};

export const remove = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.id, "id", { min: 1 });

  const question = await db.MappingQuestion.findByPk(id, { include: "MappingOptions" });
  if (!question) {
    throw notFound(`MappingQuestion ${id} not found`);
  }

  await question.destroy();
  return res.send(question);
};

export const listOptions = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.id, "id", { min: 1 });

  const [count, options] = await Promise.all([
    db.MappingOption.count({ where: { mappingQuestionId: id } }),
    db.MappingOption.findAll({
      where: { mappingQuestionId: id },
      order: [["position", "ASC"]],
    }),
  ]);

  return res.send({ count, options });
};

export const createOption = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.id, "id", { min: 1 });
  const body = parseObject(req.body, "body");

  assertAllowedKeys(body, ["title", "position", "color"], "mapping option body");

  const title = parseString(body.title, "title", { trim: true, maxLength: 500 });
  const position = parseInteger(body.position, "position", { min: 0 });
  const color = parseString(body.color, "color", { optional: true, trim: true, maxLength: 64 });

  const option = await db.MappingOption.create({
    title,
    position,
    color,
    mappingQuestionId: id,
  });

  return res.send(option);
};

export const updateOption = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.optionId, "optionId", { min: 1 });
  const body = parseObject(req.body, "body");

  assertAllowedKeys(body, ["title", "color", "position"], "mapping option update body");

  const title = parseString(body.title, "title", { optional: true, trim: true, maxLength: 500 });
  const color = parseString(body.color, "color", { optional: true, trim: true, maxLength: 64 });
  const position =
    body.position === undefined ? undefined : parseInteger(body.position, "position", { min: 0 });

  const option = await db.MappingOption.findByPk(id);
  if (!option) {
    throw notFound(`MappingOption ${id} not found`);
  }

  await option.update({
    ...(title !== undefined ? { title } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(position !== undefined ? { position } : {}),
  });

  return res.send(option);
};

export const removeOption = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.optionId, "optionId", { min: 1 });

  const option = await db.MappingOption.findByPk(id);
  if (!option) {
    throw notFound(`MappingOption ${id} not found`);
  }

  await option.destroy();
  return res.send(option);
};
