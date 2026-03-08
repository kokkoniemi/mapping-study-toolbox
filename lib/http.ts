import type { ErrorRequestHandler } from "express";

const NODE_ENV = process.env.NODE_ENV || "development";

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, "VALIDATION_ERROR", message, details);

export const notFound = (message: string, details?: unknown) =>
  new ApiError(404, "NOT_FOUND", message, details);

const isSequelizeValidationError = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name = (error as { name?: string }).name;
  return name === "SequelizeValidationError" || name === "SequelizeUniqueConstraintError";
};

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    const payload: Record<string, unknown> = {
      error: {
        code: error.code,
        message: error.message,
      },
    };

    if (error.details !== undefined && NODE_ENV !== "production") {
      (payload.error as Record<string, unknown>).details = error.details;
    }

    res.status(error.status).json(payload);
    return;
  }

  if (isSequelizeValidationError(error)) {
    res.status(400).json({
      error: {
        code: "DB_VALIDATION_ERROR",
        message: "Database validation failed",
      },
    });
    return;
  }

  const payload: Record<string, unknown> = {
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    },
  };

  if (NODE_ENV !== "production") {
    const err = error as { message?: string; stack?: string };
    (payload.error as Record<string, unknown>).details = {
      message: err?.message,
      stack: err?.stack,
    };
  }

  console.error(error);
  res.status(500).json(payload);
};
