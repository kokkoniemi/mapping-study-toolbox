import fs from "node:fs";
import path from "node:path";

import * as SequelizeModule from "sequelize";

import { resolveDbConfig, type DbConfig } from "../lib/dbConfig";
import type { AssociableModel, DbModels, ModelFactory } from "./types";

const { DataTypes, Sequelize } = SequelizeModule;

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
const { config } = resolveDbConfig({ env });

let sequelize: SequelizeModule.Sequelize;
if (config.use_env_variable) {
  const connectionString = process.env[config.use_env_variable];
  if (!connectionString) {
    throw new Error(`Environment variable ${config.use_env_variable} is not set`);
  }
  sequelize = new Sequelize(connectionString, config as SequelizeModule.Options);
} else {
  sequelize = new Sequelize(
    config.database ?? "",
    config.username ?? "",
    config.password ?? "",
    config as SequelizeModule.Options,
  );
}

const loadedModels: Record<string, AssociableModel> = {};

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0
      && file !== basename
      && /\.(js|ts)$/.test(file)
      && !file.endsWith(".test.ts")
      && !file.endsWith(".d.ts")
      && !file.endsWith("types.ts")
    );
  })
  .forEach((file) => {
    const required = require(path.join(__dirname, file)) as {
      default?: ModelFactory<AssociableModel>;
    };

    const modelFactory = required.default;
    if (!modelFactory) {
      throw new Error(`Model file ${file} has no default export`);
    }

    const model = modelFactory(sequelize, DataTypes);
    loadedModels[model.name] = model;
  });

const requiredModelNames = [
  "Record",
  "RecordDocument",
  "Forum",
  "MappingQuestion",
  "MappingOption",
  "RecordMappingOption",
  "Import",
  "UserProfile",
  "RecordAssessment",
  "RecordAssessmentOption",
  "KeywordingJob",
  "KeywordingSuggestion",
  "KeywordingEvidenceSpan",
] as const;

requiredModelNames.forEach((name) => {
  if (!loadedModels[name]) {
    throw new Error(`Model ${name} was not loaded from models directory`);
  }
});

const db = loadedModels as unknown as DbModels;

requiredModelNames.forEach((name) => {
  db[name].associate?.(db);
});

db.sequelize = sequelize;
db.Sequelize = SequelizeModule;

export default db;
