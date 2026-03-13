import fs from "node:fs";
import path from "node:path";

type Args = {
  input: string;
  apiBase: string;
};

const parseArgs = (): Args => {
  const args = process.argv.slice(2);
  const values = new Map<string, string>();
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      values.set(key, "true");
      continue;
    }
    values.set(key, next);
    i += 1;
  }

  const input = values.get("in") ?? "";
  const apiBase = values.get("api") ?? "http://localhost:3000/api";
  if (input.trim().length === 0) {
    throw new Error("Usage: npm run snapshots:import -- --in <path> [--api <baseUrl>]");
  }

  return { input, apiBase: apiBase.replace(/\/$/, "") };
};

const main = async () => {
  const args = parseArgs();
  const filePath = path.resolve(args.input);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Snapshot file not found: ${filePath}`);
  }

  const text = fs.readFileSync(filePath, "utf8");
  const snapshot = JSON.parse(text) as Record<string, unknown>;
  const payload = {
    ...snapshot,
    exportedAt: new Date().toISOString(),
  };

  const response = await fetch(`${args.apiBase}/snapshots/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to import snapshot (${response.status}): ${body}`);
  }

  const result = await response.json() as {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    userId: number;
  };
  console.log(
    `Imported snapshot for user ${result.userId}: total=${result.total}, created=${result.created}, updated=${result.updated}, skipped=${result.skipped}`,
  );
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
