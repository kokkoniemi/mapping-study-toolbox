import fs from "node:fs";
import path from "node:path";

export type DbConfig = {
  database?: string;
  username?: string;
  password?: string;
  use_env_variable?: string;
  dialect?: string;
  storage?: string;
  logging?: unknown;
  [key: string]: unknown;
};

type DbConfigFile = {
  development?: DbConfig;
  test?: DbConfig;
  production?: DbConfig;
} & DbConfig;

type ResolveDbConfigOptions = {
  env?: string;
  cwd?: string;
  configPath?: string;
};

type ResolvedDbConfig = {
  env: string;
  config: DbConfig;
  sourcePath: string | null;
};

const DEFAULT_DB_CONFIG: DbConfig = {
  dialect: "sqlite",
  storage: "./db.sqlite3",
  logging: false,
};

const TEST_DB_CONFIG: DbConfig = {
  dialect: "sqlite",
  storage: ":memory:",
  logging: false,
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const toAbsolutePath = (value: string, cwd: string) =>
  path.isAbsolute(value) ? value : path.resolve(cwd, value);

const readConfigFile = (sourcePath: string): DbConfigFile => {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Failed to parse DB config file at ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!isPlainObject(raw)) {
    throw new Error(`Invalid DB config at ${sourcePath}: expected a JSON object`);
  }

  return raw as DbConfigFile;
};

const resolveConfigPath = ({
  cwd,
  configPath,
}: {
  cwd: string;
  configPath: string | undefined;
}): string | null => {
  if (configPath && configPath.trim().length > 0) {
    const explicitPath = toAbsolutePath(configPath.trim(), cwd);
    if (!fs.existsSync(explicitPath)) {
      throw new Error(`DB config file not found at ${explicitPath}`);
    }
    return explicitPath;
  }

  const defaultPath = path.resolve(cwd, "db-config.json");
  return fs.existsSync(defaultPath) ? defaultPath : null;
};

const selectConfigForEnv = (fileConfig: DbConfigFile, env: string): DbConfig => {
  const envConfig = fileConfig[env];
  if (isPlainObject(envConfig)) {
    return envConfig;
  }

  if (isPlainObject(fileConfig.development)) {
    return fileConfig.development;
  }

  const { development: _development, test: _test, production: _production, ...flatConfig } = fileConfig;
  return flatConfig;
};

export const resolveDbConfig = (options: ResolveDbConfigOptions = {}): ResolvedDbConfig => {
  const env = (options.env ?? process.env.NODE_ENV ?? "development").trim() || "development";
  if (env === "test") {
    return {
      env,
      config: { ...TEST_DB_CONFIG },
      sourcePath: null,
    };
  }

  const cwd = options.cwd ?? process.cwd();
  const configPath = resolveConfigPath({
    cwd,
    configPath: options.configPath ?? process.env.DB_CONFIG_PATH,
  });

  if (!configPath) {
    return {
      env,
      config: { ...DEFAULT_DB_CONFIG },
      sourcePath: null,
    };
  }

  const fileConfig = readConfigFile(configPath);
  const selectedConfig = selectConfigForEnv(fileConfig, env);

  return {
    env,
    config: {
      ...DEFAULT_DB_CONFIG,
      ...selectedConfig,
    },
    sourcePath: configPath,
  };
};
