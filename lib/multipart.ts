import type { Request } from "express";

import { badRequest } from "./http";

export type ParsedMultipartFile = {
  fieldName: string;
  fileName: string;
  contentType: string;
  data: Buffer;
};

const parseBoundary = (contentType: string) => {
  const match = contentType.match(/boundary=([^;]+)/i);
  if (!match?.[1]) {
    throw badRequest("multipart boundary is missing");
  }
  return match[1].trim().replace(/^"|"$/g, "");
};

const collectBody = async (req: Request, maxBytes: number) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBytes) {
        reject(badRequest(`uploaded file must be at most ${maxBytes} bytes`));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });

const parseContentDisposition = (value: string) => {
  const nameMatch = value.match(/name="([^"]+)"/i);
  const fileNameMatch = value.match(/filename="([^"]*)"/i);
  return {
    name: nameMatch?.[1] ?? "",
    fileName: fileNameMatch?.[1] ?? "",
  };
};

export const parseSingleMultipartFile = async (
  req: Request,
  {
    fieldName = "file",
    maxBytes = 20_000_000,
  }: {
    fieldName?: string;
    maxBytes?: number;
  } = {},
): Promise<ParsedMultipartFile> => {
  const contentType = String(req.headers["content-type"] ?? "");
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw badRequest("content-type must be multipart/form-data");
  }

  const boundary = parseBoundary(contentType);
  const body = await collectBody(req, maxBytes);
  const boundaryMarker = `--${boundary}`;
  const raw = body.toString("latin1");
  const parts = raw
    .split(boundaryMarker)
    .map((part) => part.replace(/^\r\n/, ""))
    .filter((part) => part.length > 0 && part !== "--" && part !== "--\r\n");

  const files: ParsedMultipartFile[] = [];

  for (const part of parts) {
    const headerSplitIndex = part.indexOf("\r\n\r\n");
    if (headerSplitIndex < 0) {
      continue;
    }

    const headerText = part.slice(0, headerSplitIndex);
    let content = part.slice(headerSplitIndex + 4);
    content = content.replace(/\r\n--$/, "").replace(/\r\n$/, "");

    const headers = headerText.split("\r\n");
    const dispositionHeader = headers.find((header) => header.toLowerCase().startsWith("content-disposition:"));
    if (!dispositionHeader) {
      continue;
    }

    const disposition = parseContentDisposition(dispositionHeader);
    if (disposition.name !== fieldName || disposition.fileName.length === 0) {
      continue;
    }

    const fileContentType = headers
      .find((header) => header.toLowerCase().startsWith("content-type:"))
      ?.split(":")
      .slice(1)
      .join(":")
      .trim() || "application/octet-stream";

    files.push({
      fieldName: disposition.name,
      fileName: disposition.fileName,
      contentType: fileContentType,
      data: Buffer.from(content, "latin1"),
    });
  }

  const [file] = files;
  if (!file) {
    throw badRequest(`multipart upload must include a ${fieldName} file`);
  }

  return file;
};
