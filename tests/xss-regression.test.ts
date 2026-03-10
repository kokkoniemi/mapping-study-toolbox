import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("XSS regression checks", () => {
  it("DataTable renderers avoid direct innerHTML assignments", () => {
    const filePath = path.join(process.cwd(), "ui", "src", "components", "DataTable.vue");
    const source = fs.readFileSync(filePath, "utf-8");

    expect(source).not.toMatch(/innerHTML\s*=/);
  });
});
