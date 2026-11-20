import type { ErrorHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";

export class AppError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: ContentfulStatusCode,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const globalErrorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.status,
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu đầu vào không hợp lệ.",
          details: err.issues,
        },
      },
      400,
    );
  }

  console.error("[API Unhandled Error]", err);
  return c.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Đã xảy ra lỗi hệ thống.",
      },
    },
    500,
  );
};
