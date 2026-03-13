import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { resolveDbConfig } from "../lib/dbConfig";

const env = process.env.NODE_ENV || "development";

const runMigrations = () => {
  const { config, sourcePath } = resolveDbConfig({ env });
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "mapping-study-toolbox-migrate-"));
  const tempConfigPath = path.join(tempDirectory, "sequelize.config.json");
  const sequelizeCliEntry = path.resolve(process.cwd(), "node_modules", "sequelize-cli", "lib", "sequelize");

  if (!fs.existsSync(sequelizeCliEntry)) {
    throw new Error(
      `sequelize-cli entrypoint not found at ${sequelizeCliEntry}. Run npm install first.`,
    );
  }

  fs.writeFileSync(
    tempConfigPath,
    `${JSON.stringify({ [env]: config }, null, 2)}\n`,
    "utf8",
  );

  console.log(
    sourcePath
      ? `[migrate] Using DB config from ${sourcePath}`
      : "[migrate] Using default DB config (sqlite ./db.sqlite3)",
  );

  try {
    const result = spawnSync(
      process.execPath,
      [sequelizeCliEntry, "db:migrate", "--config", tempConfigPath, "--env", env],
      {
        stdio: "inherit",
        env: process.env,
      },
    );

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
};

try {
  runMigrations();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
