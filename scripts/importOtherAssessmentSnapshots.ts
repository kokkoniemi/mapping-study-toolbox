import fs from "node:fs";
import path from "node:path";

type Args = {
  activeUserId: number;
  snapshotsDir: string;
  apiBase: string;
};

type SnapshotFile = {
  user: {
    id: number;
    name: string;
  };
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

  const activeUserId = Number.parseInt(values.get("active-user-id") ?? "", 10);
  if (!Number.isInteger(activeUserId) || activeUserId <= 0) {
    throw new Error(
      "Usage: npm run snapshots:import-others -- --active-user-id <id> [--dir snapshots] [--api <baseUrl>]",
    );
  }

  const snapshotsDir = path.resolve(values.get("dir") ?? path.resolve(process.cwd(), "snapshots"));
  const apiBase = (values.get("api") ?? "http://localhost:3000/api").replace(/\/$/, "");
  return { activeUserId, snapshotsDir, apiBase };
};

const main = async () => {
  const args = parseArgs();
  if (!fs.existsSync(args.snapshotsDir)) {
    throw new Error(`Snapshots directory not found: ${args.snapshotsDir}`);
  }

  const fileNames = fs.readdirSync(args.snapshotsDir)
    .filter((file) => file.toLowerCase().endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  let imported = 0;
  let total = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const fileName of fileNames) {
    const fullPath = path.join(args.snapshotsDir, fileName);
    const raw = fs.readFileSync(fullPath, "utf8");
    const snapshot = JSON.parse(raw) as SnapshotFile & Record<string, unknown>;
    const snapshotUserId = Number(snapshot?.user?.id);
    if (!Number.isInteger(snapshotUserId) || snapshotUserId <= 0) {
      throw new Error(`Invalid snapshot user id in ${fullPath}`);
    }
    if (snapshotUserId === args.activeUserId) {
      continue;
    }

    const response = await fetch(`${args.apiBase}/snapshots/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(snapshot),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to import ${fileName} (${response.status}): ${body}`);
    }
    const result = await response.json() as {
      userId: number;
      total: number;
      created: number;
      updated: number;
      skipped: number;
    };
    imported += 1;
    total += result.total;
    created += result.created;
    updated += result.updated;
    skipped += result.skipped;
    console.log(
      `Imported ${fileName} -> user ${result.userId}: total=${result.total}, created=${result.created}, updated=${result.updated}, skipped=${result.skipped}`,
    );
  }

  console.log(
    `Done. importedSnapshots=${imported}, total=${total}, created=${created}, updated=${updated}, skipped=${skipped}`,
  );
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
