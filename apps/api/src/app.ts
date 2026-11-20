import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { globalErrorHandler } from "./lib/errors.js";
import { eventRoutes } from "./routes/events.js";
import { healthRoutes } from "./routes/health.js";

export interface CreateAppOptions {
  corsOrigin?: string;
  enableLogger?: boolean;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono();

  if (options.enableLogger !== false) {
    app.use("*", logger());
  }

  app.use(
    "*",
    cors({
      origin: options.corsOrigin ?? "http://localhost:5173",
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );

  app.onError(globalErrorHandler);

  app.notFound((c) => {
    return c.json(
      {
        error: {
          code: "NOT_FOUND",
          message: `Endpoint không tồn tại: ${c.req.method} ${c.req.path}`,
        },
      },
      404,
    );
  });

  return app.route("/", healthRoutes).route("/", eventRoutes);
}

export const app = createApp({
  corsOrigin:
    typeof process !== "undefined" ? process.env.CORS_ORIGIN : undefined,
});

export type AppType = typeof app;
