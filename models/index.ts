import fs from "node:fs";
import path from "node:path";

import * as SequelizeModule from "sequelize";

import type { AssociableModel, DbModels, ModelFactory } from "./types";

const { DataTypes, Sequelize } = SequelizeModule;

type DbConfig = {
  database?: string;
  username?: string;
  password?: string;
  use_env_variable?: string;
  [key: string]: unknown;
};

type DbConfigFile = {
  development?: DbConfig;
  test?: DbConfig;
  production?: DbConfig;
} & DbConfig;

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";

const configCandidates = [
  path.join(__dirname, "..", "config", "config.json"),
  path.join(path.dirname(process.execPath), "config", "config.json"),
  // Backward compatibility with older setups
  path.join(__dirname, "..", "db-config.json"),
  path.join(path.dirname(process.execPath), "db-config.json"),
];

const configPath = configCandidates.find((candidate) => fs.existsSync(candidate));
if (!configPath) {
  throw new Error(
    "No database config found. Expected config/config.json (preferred) or db-config.json (legacy).",
  );
}

const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8")) as DbConfigFile;
const envConfig = (rawConfig as Record<string, DbConfig | undefined>)[env];
const config: DbConfig = envConfig || rawConfig.development || rawConfig;

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
  "Forum",
  "MappingQuestion",
  "MappingOption",
  "RecordMappingOption",
  "Import",
  "UserProfile",
  "RecordAssessment",
  "RecordAssessmentOption",
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
