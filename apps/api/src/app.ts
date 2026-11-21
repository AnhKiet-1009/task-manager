import type { AppDatabase } from "@taskmanager/db";
import type { AiProvider } from "@taskmanager/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { type AppAuth, createAuth } from "./lib/auth.js";
import { globalErrorHandler } from "./lib/errors.js";
import { sessionMiddleware } from "./middleware/auth.js";
import {
  eventBus as defaultEventBus,
  type RealtimeEventBus,
} from "./realtime/event-bus.js";
import { aiRoutes } from "./routes/ai.js";
import { analyticsRoutes } from "./routes/analytics.js";
import { authRoutes } from "./routes/auth.js";
import { eventRoutes } from "./routes/events.js";
import { githubRoutes } from "./routes/github.js";
import { healthRoutes } from "./routes/health.js";
import { issueRoutes } from "./routes/issues.js";
import { projectRoutes } from "./routes/projects.js";
import { sprintRoutes } from "./routes/sprints.js";
import { workspaceRoutes } from "./routes/workspaces.js";
import type { AppEnv, AppRuntimeConfig } from "./types/env.js";

export interface CreateAppOptions {
  db: AppDatabase;
  auth?: AppAuth;
  eventBus?: RealtimeEventBus;
  corsOrigin?: string;
  authSecret?: string;
  authBaseUrl?: string;
  githubClientId?: string;
  githubClientSecret?: string;
  githubWebhookSecret?: string;
  aiProvider?: AiProvider;
  geminiApiKey?: string;
  groqApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  openrouterApiKey?: string;
  byokEncryptionKey?: string;
  upstashRedisRestUrl?: string;
  upstashRedisRestToken?: string;
  enableLogger?: boolean;
}

export function createApp(options: CreateAppOptions) {
  const allowedOrigins = (options.corsOrigin ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const authSecret =
    options.authSecret ?? "dev-only-secret-change-in-production-32-chars";
  const auth =
    options.auth ??
    createAuth(options.db, {
      secret: authSecret,
      baseUrl: options.authBaseUrl ?? "http://localhost:8787",
      trustedOrigins: allowedOrigins,
      githubClientId: options.githubClientId,
      githubClientSecret: options.githubClientSecret,
    });
  const bus = options.eventBus ?? defaultEventBus;

  const runtimeConfig: AppRuntimeConfig = {
    aiProvider: options.aiProvider ?? "gemini",
    geminiApiKey: options.geminiApiKey,
    groqApiKey: options.groqApiKey,
    openaiApiKey: options.openaiApiKey,
    anthropicApiKey: options.anthropicApiKey,
    openrouterApiKey: options.openrouterApiKey,
    byokEncryptionKey: options.byokEncryptionKey || authSecret,
    githubWebhookSecret: options.githubWebhookSecret,
    upstashRedisRestUrl: options.upstashRedisRestUrl,
    upstashRedisRestToken: options.upstashRedisRestToken,
  };

  const app = new Hono<AppEnv>();

  if (options.enableLogger !== false) {
    app.use("*", logger());
  }

  app.use(
    "*",
    cors({
      origin: (reqOrigin) =>
        reqOrigin && allowedOrigins.includes(reqOrigin)
          ? reqOrigin
          : (allowedOrigins[0] ?? "*"),
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  );

  app.use("*", async (c, next) => {
    c.set("db", options.db);
    c.set("auth", auth);
    c.set("eventBus", bus);
    c.set("config", runtimeConfig);
    await next();
  });

  app.use("*", sessionMiddleware);

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

  return app
    .route("/", healthRoutes)
    .route("/", authRoutes)
    .route("/", workspaceRoutes)
    .route("/", projectRoutes)
    .route("/", sprintRoutes)
    .route("/", issueRoutes)
    .route("/", analyticsRoutes)
    .route("/", aiRoutes)
    .route("/", githubRoutes)
    .route("/", eventRoutes);
}

export type AppType = ReturnType<typeof createApp>;
