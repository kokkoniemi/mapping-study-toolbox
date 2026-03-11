import express from "express";

import { errorMiddleware, notFound } from "./lib/http";
import { createCorsMiddleware, createSecurityHeadersMiddleware, parseAllowedOrigins } from "./lib/security";
import apiRouter from "./routes/api";

const PORT = Number(process.env.PORT ?? 3000);
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT?.trim() || "8mb";
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:8080", "http://localhost:3000"] as const;

export const createApp = () => {
  const app = express();
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS, DEFAULT_ALLOWED_ORIGINS);

  app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));
  app.use(createSecurityHeadersMiddleware());
  app.use(createCorsMiddleware(allowedOrigins));

  app.use("/api", apiRouter);
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
