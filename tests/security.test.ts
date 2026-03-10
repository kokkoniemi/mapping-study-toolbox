import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/http";
import { createCorsMiddleware, createRateLimitMiddleware, parseAllowedOrigins } from "../lib/security";

type MockResponse = Response & {
  headers: Record<string, string>;
  statusCodeSet: number | null;
};

const createMockResponse = (): MockResponse => {
  const headers: Record<string, string> = {};
  const res = {
    headers,
    statusCodeSet: null,
    setHeader: vi.fn((name: string, value: string) => {
      headers[name.toLocaleLowerCase()] = String(value);
    }),
    vary: vi.fn((value: string) => {
      const key = "vary";
      const current = headers[key];
      headers[key] = current ? `${current}, ${value}` : value;
    }),
    status: vi.fn(function status(this: MockResponse, code: number) {
      this.statusCodeSet = code;
      return this;
    }),
    send: vi.fn(),
  } as unknown as MockResponse;

  return res;
};

const createRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    method: "GET",
    headers: {},
    ip: "127.0.0.1",
    socket: {
      remoteAddress: "127.0.0.1",
    },
    ...overrides,
  }) as Request;

describe("lib/security", () => {
  it("parseAllowedOrigins returns env values when provided", () => {
    const origins = parseAllowedOrigins("http://a.local, http://b.local", ["http://fallback.local"]);
    expect([...origins]).toEqual(["http://a.local", "http://b.local"]);
  });

  it("parseAllowedOrigins falls back to defaults when env is empty", () => {
    const origins = parseAllowedOrigins("   ", ["http://fallback.local"]);
    expect([...origins]).toEqual(["http://fallback.local"]);
  });

  it("CORS middleware handles preflight requests with PATCH support", () => {
    const cors = createCorsMiddleware(new Set(["http://localhost:8080"]));
    const req = createRequest({
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:8080",
        "access-control-request-headers": "Content-Type,Authorization",
      },
    });
    const res = createMockResponse();
    const next = vi.fn() as unknown as NextFunction;

    cors(req, res, next);

    expect(res.statusCodeSet).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:8080");
    expect(res.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(res.headers["access-control-allow-headers"]).toContain("Content-Type");
    expect(res.headers.vary).toContain("Origin");
    expect(next).not.toHaveBeenCalled();
  });

  it("CORS middleware handles OPTIONS even for disallowed origins without setting allow-origin", () => {
    const cors = createCorsMiddleware(new Set(["http://allowed.local"]));
    const req = createRequest({
      method: "OPTIONS",
      headers: {
        origin: "http://blocked.local",
      },
    });
    const res = createMockResponse();
    const next = vi.fn() as unknown as NextFunction;

    cors(req, res, next);

    expect(res.statusCodeSet).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-methods"]).toContain("OPTIONS");
    expect(next).not.toHaveBeenCalled();
  });

  it("rate limiter returns RATE_LIMITED error after limit is exceeded", () => {
    const limiter = createRateLimitMiddleware({
      windowMs: 60_000,
      maxRequests: 2,
      scope: "enrichment",
    });
    const req = createRequest();

    const next1 = vi.fn();
    limiter(req, createMockResponse(), next1 as unknown as NextFunction);
    expect(next1).toHaveBeenCalledWith();

    const next2 = vi.fn();
    limiter(req, createMockResponse(), next2 as unknown as NextFunction);
    expect(next2).toHaveBeenCalledWith();

    const next3 = vi.fn();
    limiter(req, createMockResponse(), next3 as unknown as NextFunction);
    const error = next3.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(429);
    expect((error as ApiError).code).toBe("RATE_LIMITED");
  });
});
