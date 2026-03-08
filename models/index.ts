import fs from "node:fs";
import path from "node:path";

import { DataTypes, Sequelize } from "sequelize";

type Db = Record<string, any> & {
  sequelize: Sequelize;
  Sequelize: typeof Sequelize;
};

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

const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, any>;
const config = rawConfig[env] || rawConfig.development || rawConfig;
const db = {} as Db;

let sequelize: Sequelize;
if (config.use_env_variable) {
  const connectionString = process.env[config.use_env_variable];
  if (!connectionString) {
    throw new Error(`Environment variable ${config.use_env_variable} is not set`);
  }
  sequelize = new Sequelize(connectionString, config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0
      && file !== basename
      && /\.(js|ts)$/.test(file)
      && !file.endsWith(".test.ts")
      && !file.endsWith(".d.ts")
    );
  })
  .forEach((file) => {
    const required = require(path.join(__dirname, file));
    const modelFactory = required.default ?? required;
    const model = modelFactory(sequelize, DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
