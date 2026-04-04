import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const spawnSyncMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawnSync: spawnSyncMock,
}));

import { extractTextFromPdfFile } from "../lib/pdfExtraction";

const createTempPdf = (contents: string | Buffer) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mapping-study-toolbox-pdf-"));
  const filePath = path.join(dir, "sample.pdf");
  fs.writeFileSync(filePath, contents);
  return { dir, filePath };
};

describe("pdfExtraction", () => {
  afterEach(() => {
    spawnSyncMock.mockReset();
  });

  it("returns normalized pdftotext output when quality is good", () => {
    const temp = createTempPdf(Buffer.from("%PDF-1.4"));
    spawnSyncMock.mockReturnValue({
      status: 0,
      error: undefined,
      stdout: "Title line\n\nThis is a proper extracted paragraph about online team-based learning and peer assessment.\n",
      stderr: "",
    });

    const extracted = extractTextFromPdfFile(temp.filePath);

    expect(extracted).toContain("Title line");
    expect(extracted).toContain("peer assessment");
    fs.rmSync(temp.dir, { recursive: true, force: true });
  });

  it("rejects corrupted extraction output instead of returning binary-looking garbage", () => {
    const temp = createTempPdf(Buffer.from("%PDF-1.4"));
    spawnSyncMock.mockReturnValue({
      status: 0,
      error: undefined,
      stdout: 'doi:10.1080/0144929X.2018.1451558 Effects of an online team project �&�~p,h IP=�<��9K?� 6k ,� V# " x��6|��X�#m',
      stderr: "",
    });

    expect(() => extractTextFromPdfFile(temp.filePath)).toThrow(/Unable to extract meaningful text from PDF/);
    fs.rmSync(temp.dir, { recursive: true, force: true });
  });

  it("falls back to literal PDF strings when pdftotext is unavailable but the fallback is readable", () => {
    const temp = createTempPdf(Buffer.from("%PDF-1.4\n(Meaningful Title)\n(Online team project learning with peer assessment in higher education)\n"));
    spawnSyncMock.mockReturnValue({
      status: 1,
      error: new Error("pdftotext missing"),
      stdout: "",
      stderr: "missing",
    });

    const extracted = extractTextFromPdfFile(temp.filePath);

    expect(extracted).toContain("Meaningful Title");
    expect(extracted).toContain("peer assessment");
    fs.rmSync(temp.dir, { recursive: true, force: true });
  });
});
