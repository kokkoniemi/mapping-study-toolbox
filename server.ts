import fs from "node:fs";
import path from "node:path";

import express from "express";
import type { RequestHandler } from "express";

import { errorMiddleware, notFound } from "./lib/http";
import { createCorsMiddleware, createSecurityHeadersMiddleware, parseAllowedOrigins } from "./lib/security";
import apiRouter from "./routes/api";

const PORT = Number(process.env.PORT ?? 3000);
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT?.trim() || "8mb";
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:8080", "http://localhost:3000"] as const;
const UI_DIST_DIR = process.env.UI_DIST_DIR?.trim() || path.resolve(__dirname, "ui", "dist");
const UI_INDEX_FILE = path.join(UI_DIST_DIR, "index.html");
const HAS_UI_BUILD = fs.existsSync(UI_INDEX_FILE);

const isBrowserNavigationMethod = (method: string) => method === "GET" || method === "HEAD";
const isApiPath = (requestPath: string) => requestPath === "/api" || requestPath.startsWith("/api/");

const createSpaFallbackMiddleware = (indexFilePath: string): RequestHandler =>
  (req, res, next) => {
    if (!isBrowserNavigationMethod(req.method) || isApiPath(req.path)) {
      next();
      return;
    }

    res.sendFile(indexFilePath, (error) => {
      if (error) {
        next(error);
      }
    });
  };

export const createApp = () => {
  const app = express();
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS, DEFAULT_ALLOWED_ORIGINS);

  app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));
  app.use(createSecurityHeadersMiddleware());
  app.use(createCorsMiddleware(allowedOrigins));

  app.use("/api", apiRouter);
  if (HAS_UI_BUILD) {
    app.use(express.static(UI_DIST_DIR, { index: false }));
    app.use(createSpaFallbackMiddleware(UI_INDEX_FILE));
  }
  app.use((_req, _res, next) => {
    next(notFound("Route not found"));
  });
  app.use(errorMiddleware);

  return app;
};

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`The API is running on: http://localhost:${PORT}/api`);
  });
}
