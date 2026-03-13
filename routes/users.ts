import type { Request, Response } from "express";

import { badRequest, notFound } from "../lib/http";
import {
  assertAllowedKeys,
  parseInteger,
  parseObject,
  parseString,
} from "../lib/validation";
import db from "../models";

const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ");

const findByNormalizedName = async (name: string) => {
  const normalized = normalizeName(name).toLocaleLowerCase();
  const users = await db.UserProfile.findAll();
  return users.find((user) => user.name.trim().toLocaleLowerCase() === normalized) ?? null;
};

export const listing = async (_req: Request, res: Response) => {
  const users = await db.UserProfile.findAll({
    order: [["name", "ASC"]],
  });
  return res.send({ count: users.length, users });
};

export const create = async (req: Request, res: Response) => {
  const body = parseObject(req.body, "body");
  assertAllowedKeys(body, ["name"], "user body");

  const name = parseString(body.name, "name", { trim: true, allowEmpty: false, maxLength: 120 });
  if (name === undefined) {
    throw badRequest("name is required");
  }

  const existing = await findByNormalizedName(name);
  if (existing) {
    throw badRequest(`User profile ${name} already exists`);
  }

  const user = await db.UserProfile.create({
    name: normalizeName(name),
    isActive: true,
  });

  return res.status(201).send(user);
};

export const update = async (req: Request, res: Response) => {
  const id = parseInteger(req.params.id, "id", { min: 1 });
  const body = parseObject(req.body, "body");
  assertAllowedKeys(body, ["name", "isActive"], "user update body");

  const user = await db.UserProfile.findByPk(id);
  if (!user) {
    throw notFound(`User profile ${id} not found`);
  }

  const updates: Record<string, unknown> = {};
  if ("name" in body) {
    const name = parseString(body.name, "name", { trim: true, allowEmpty: false, maxLength: 120 });
    if (name === undefined) {
      throw badRequest("name is required");
    }

    const existing = await findByNormalizedName(name);
    if (existing && existing.id !== id) {
      throw badRequest(`User profile ${name} already exists`);
    }
    updates.name = normalizeName(name);
  }

  if ("isActive" in body) {
    if (typeof body.isActive !== "boolean") {
      throw badRequest("isActive must be boolean");
    }

    if (body.isActive === false) {
      const activeCount = await db.UserProfile.count({ where: { isActive: true } });
      if (activeCount <= 1 && user.isActive) {
        throw badRequest("Cannot deactivate the last active user profile");
      }
    }
    updates.isActive = body.isActive;
  }

  if (Object.keys(updates).length === 0) {
    throw badRequest("user update body must include at least one field");
  }

  await user.update(updates);
  return res.send(user);
};
