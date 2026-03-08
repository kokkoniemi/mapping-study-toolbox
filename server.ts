import express, { type NextFunction, type Request, type Response } from "express";

import { errorMiddleware, notFound } from "./lib/http";
import apiRouter from "./routes/api";

const PORT = Number(process.env.PORT ?? 3000);
const ALLOWED_ORIGINS = ["http://localhost:8080", "http://localhost:3000"] as const;

export const createApp = () => {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin as (typeof ALLOWED_ORIGINS)[number])) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT,DELETE");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");

    next();
  });

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
