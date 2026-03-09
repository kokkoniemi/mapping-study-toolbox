import type { NextFunction, Request, RequestHandler, Response } from "express";

import { tooManyRequests } from "./http";

const DEFAULT_ALLOWED_HEADERS = "Origin, X-Requested-With, Content-Type, Accept, Authorization";
const DEFAULT_ALLOWED_METHODS = "GET,HEAD,OPTIONS,POST,PUT,PATCH,DELETE";

const getClientIdentifier = (req: Request) =>
  req.ip
  || req.headers["x-forwarded-for"]
  || req.socket.remoteAddress
  || "unknown";

export const parseAllowedOrigins = (
  value: string | undefined,
  fallback: readonly string[],
) => {
  const parsed = value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return new Set((parsed && parsed.length > 0) ? parsed : fallback);
};

export const createCorsMiddleware = (allowedOrigins: Set<string>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const originAllowed = typeof origin === "string" && allowedOrigins.has(origin);

    if (originAllowed && origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.vary("Origin");
    }

    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", DEFAULT_ALLOWED_METHODS);
    res.setHeader(
      "Access-Control-Allow-Headers",
      typeof req.headers["access-control-request-headers"] === "string"
        ? req.headers["access-control-request-headers"]
        : DEFAULT_ALLOWED_HEADERS,
    );
    res.setHeader("Access-Control-Max-Age", "600");

    if (req.method === "OPTIONS") {
      res.status(204).send();
      return;
    }

    next();
  };

export const createSecurityHeadersMiddleware = (): RequestHandler =>
  (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    next();
  };

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  scope: string;
  keyPrefix?: string;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export const createRateLimitMiddleware = ({
  windowMs,
  maxRequests,
  scope,
  keyPrefix = "ratelimit",
}: RateLimitOptions): RequestHandler => {
  if (!Number.isFinite(windowMs) || !Number.isFinite(maxRequests) || windowMs <= 0 || maxRequests <= 0) {
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  }

  const bucketByKey = new Map<string, RateLimitBucket>();
  let requestCount = 0;
  const cleanupEvery = 200;

  return (req: Request, res: Response, next: NextFunction) => {
    requestCount += 1;
    const now = Date.now();

    if (requestCount % cleanupEvery === 0) {
      for (const [key, bucket] of bucketByKey.entries()) {
        if (bucket.resetAt <= now) {
          bucketByKey.delete(key);
        }
      }
    }

    const key = `${keyPrefix}:${scope}:${getClientIdentifier(req)}`;
    const current = bucketByKey.get(key);
    const active = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    active.count += 1;
    bucketByKey.set(key, active);

    const remaining = Math.max(0, maxRequests - active.count);
    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(active.resetAt / 1000)));

    if (active.count > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((active.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      next(
        tooManyRequests(`Too many ${scope} requests. Please try again later.`, {
          scope,
          retryAfterSeconds,
        }),
      );
      return;
    }

    next();
  };
};
