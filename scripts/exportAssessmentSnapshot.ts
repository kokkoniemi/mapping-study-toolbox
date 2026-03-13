import fs from "node:fs";
import path from "node:path";

type Args = {
  userId: number;
  out: string;
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

  const userId = Number.parseInt(values.get("user-id") ?? "", 10);
  const out = values.get("out") ?? "";
  const apiBase = values.get("api") ?? "http://localhost:3000/api";
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Usage: npm run snapshots:export -- --user-id <id> --out <path> [--api <baseUrl>]");
  }
  if (out.trim().length === 0) {
    throw new Error("`--out` is required");
  }

  return { userId, out, apiBase: apiBase.replace(/\/$/, "") };
};

const stableSnapshot = (payload: Record<string, unknown>) => {
  const user = payload.user as { id: number; name: string };
  const assessments = Array.isArray(payload.assessments) ? payload.assessments : [];
  const normalized = assessments
    .map((item) => {
      const row = item as Record<string, unknown>;
      const mappingOptionIds = Array.isArray(row.mappingOptionIds)
        ? [...new Set(row.mappingOptionIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))]
            .sort((left, right) => left - right)
        : [];
      return {
        recordId: Number(row.recordId),
        userId: Number(row.userId),
        status: row.status ?? null,
        comment: typeof row.comment === "string" ? row.comment : (row.comment === null ? null : null),
        mappingOptionIds,
        updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date(0).toISOString(),
      };
    })
    .sort((left, right) => left.recordId - right.recordId);

  return {
    version: 1,
    user: {
      id: Number(user.id),
      name: String(user.name),
    },
    assessments: normalized,
  };
};

const main = async () => {
  const args = parseArgs();
  const response = await fetch(`${args.apiBase}/snapshots/export?userId=${args.userId}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to export snapshot (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const stable = stableSnapshot(payload);
  const output = `${JSON.stringify(stable, null, 2)}\n`;
  const outputPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  if (fs.existsSync(outputPath)) {
    const current = fs.readFileSync(outputPath, "utf8");
    if (current === output) {
      console.log(`No changes for user ${args.userId} snapshot (${outputPath}).`);
      return;
    }
  }

  fs.writeFileSync(outputPath, output, "utf8");
  console.log(`Snapshot updated: ${outputPath}`);
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
