import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveDbConfig } from "../lib/dbConfig";

const withTempDir = (run: (directory: string) => void) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mapping-study-toolbox-db-config-test-"));
  try {
    run(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
};

describe("resolveDbConfig", () => {
  it("uses db-config.json values in non-test environments", () => {
    withTempDir((directory) => {
      const configPath = path.join(directory, "db-config.json");
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          dialect: "sqlite",
          storage: "./custom.sqlite3",
          logging: true,
        }),
        "utf8",
      );

      const resolved = resolveDbConfig({ env: "development", cwd: directory });
      expect(resolved.sourcePath).toBe(configPath);
      expect(resolved.config.dialect).toBe("sqlite");
      expect(resolved.config.storage).toBe("./custom.sqlite3");
      expect(resolved.config.logging).toBe(true);
    });
  });

  it("supports env-sectioned db-config.json", () => {
    withTempDir((directory) => {
      const configPath = path.join(directory, "db-config.json");
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          development: { dialect: "sqlite", storage: "./dev.sqlite3", logging: false },
          production: { dialect: "sqlite", storage: "./prod.sqlite3", logging: false },
        }),
        "utf8",
      );

      const resolved = resolveDbConfig({ env: "production", cwd: directory });
      expect(resolved.sourcePath).toBe(configPath);
      expect(resolved.config.storage).toBe("./prod.sqlite3");
    });
  });

  it("always forces test environment to sqlite :memory:", () => {
    withTempDir((directory) => {
      fs.writeFileSync(
        path.join(directory, "db-config.json"),
        JSON.stringify({
          test: { dialect: "sqlite", storage: "./should-not-be-used.sqlite3", logging: true },
        }),
        "utf8",
      );

      const resolved = resolveDbConfig({ env: "test", cwd: directory });
      expect(resolved.sourcePath).toBeNull();
      expect(resolved.config.dialect).toBe("sqlite");
      expect(resolved.config.storage).toBe(":memory:");
      expect(resolved.config.logging).toBe(false);
    });
  });

  it("falls back to defaults when db-config.json is missing", () => {
    withTempDir((directory) => {
      const resolved = resolveDbConfig({ env: "development", cwd: directory });
      expect(resolved.sourcePath).toBeNull();
      expect(resolved.config.dialect).toBe("sqlite");
      expect(resolved.config.storage).toBe("./db.sqlite3");
      expect(resolved.config.logging).toBe(false);
    });
  });

  it("throws when an explicit config path does not exist", () => {
    withTempDir((directory) => {
      expect(() =>
        resolveDbConfig({
          env: "development",
          cwd: directory,
          configPath: "./missing-db-config.json",
        })
      ).toThrow("DB config file not found");
    });
  });

  it("uses DB_CONFIG_PATH override when provided", () => {
    withTempDir((directory) => {
      const customConfigPath = path.join(directory, "custom-db-config.json");
      fs.writeFileSync(
        customConfigPath,
        JSON.stringify({
          dialect: "sqlite",
          storage: "./override.sqlite3",
          logging: false,
        }),
        "utf8",
      );

      const resolved = resolveDbConfig({
        env: "development",
        cwd: directory,
        configPath: "./custom-db-config.json",
      });
      expect(resolved.sourcePath).toBe(customConfigPath);
      expect(resolved.config.storage).toBe("./override.sqlite3");
    });
  });
});
