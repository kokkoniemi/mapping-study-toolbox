import fs from "node:fs";
import path from "node:path";

type Args = {
  users: number[];
  out: string | null;
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

  const userValues = (values.get("users") ?? "")
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  const out = values.get("out") ?? null;
  const apiBase = values.get("api") ?? "http://localhost:3000/api";
  return {
    users: [...new Set(userValues)],
    out,
    apiBase: apiBase.replace(/\/$/, ""),
  };
};

const formatReport = (payload: {
  users: Array<{ id: number; name: string }>;
  pairwise: Array<{
    userIdA: number;
    userIdB: number;
    sharedCount: number;
    agreementPercent: number;
    kappa: number;
  }>;
  disagreements: Array<{ recordId: number }>;
}) => {
  const nameById = new Map(payload.users.map((user) => [user.id, user.name]));
  const lines: string[] = [];
  lines.push("# Assessment Comparison Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`Compared users: ${payload.users.map((user) => `${user.name} (#${user.id})`).join(", ")}`);
  lines.push("");
  lines.push("## Pairwise Metrics");
  lines.push("");
  lines.push("| User A | User B | Shared Records | Agreement % | Cohen's Kappa |");
  lines.push("|---|---|---:|---:|---:|");
  for (const pair of payload.pairwise) {
    lines.push(
      `| ${nameById.get(pair.userIdA) ?? pair.userIdA} | ${nameById.get(pair.userIdB) ?? pair.userIdB} | ${pair.sharedCount} | ${pair.agreementPercent.toFixed(2)} | ${pair.kappa.toFixed(4)} |`,
    );
  }
  lines.push("");
  lines.push("## Disagreements");
  lines.push("");
  lines.push(`Total disagreement records: **${payload.disagreements.length}**`);
  lines.push("");
  if (payload.disagreements.length > 0) {
    lines.push("Record IDs:");
    lines.push(payload.disagreements.map((item) => item.recordId).join(", "));
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
};

const main = async () => {
  const args = parseArgs();
  const response = await fetch(`${args.apiBase}/assessments/compare`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(args.users.length > 0 ? { userIds: args.users } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Comparison request failed (${response.status}): ${text}`);
  }

  const payload = await response.json() as {
    users: Array<{ id: number; name: string }>;
    pairwise: Array<{
      userIdA: number;
      userIdB: number;
      sharedCount: number;
      agreementPercent: number;
      kappa: number;
    }>;
    disagreements: Array<{ recordId: number }>;
  };

  const report = formatReport(payload);
  if (!args.out) {
    console.log(report);
    return;
  }

  const outPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, "utf8");
  console.log(`Comparison report written: ${outPath}`);
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
