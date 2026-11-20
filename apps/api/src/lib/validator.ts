import { zValidator } from "@hono/zod-validator";
import type { ZodType } from "zod";
import { AppError } from "./errors.js";

export function validateJson<T extends ZodType>(schema: T) {
  return zValidator("json", schema, (result) => {
    if (!result.success) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Dữ liệu đầu vào không hợp lệ.",
        result.error.issues,
      );
    }
  });
}

export function validateQuery<T extends ZodType>(schema: T) {
  return zValidator("query", schema, (result) => {
    if (!result.success) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Tham số truy vấn không hợp lệ.",
        result.error.issues,
      );
    }
  });
}
