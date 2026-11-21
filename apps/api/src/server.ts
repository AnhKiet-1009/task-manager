import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createNodeDb } from "@taskmanager/db/node";
import { createPgliteDb } from "@taskmanager/db/pglite";
import type { AiProvider } from "@taskmanager/shared";
import { createApp } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.resolve(__dirname, "../../../.env");

if (existsSync(rootEnvPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(rootEnvPath);
}

const port = Number(process.env.PORT ?? 8787);
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
const authBaseUrl = process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`;
const authSecret =
  process.env.BETTER_AUTH_SECRET ??
  "dev-only-secret-change-in-production-32-chars";

async function bootstrap() {
  const useMemoryPglite = process.env.PGLITE_MEMORY === "1";
  const databaseUrl = process.env.DATABASE_URL;
  let db;

  if (useMemoryPglite) {
    console.log("[API] Starting isolated in-memory PostgreSQL (PGlite)...");
    ({ db } = await createPgliteDb());
  } else if (databaseUrl) {
    console.log("[API] Connecting to PostgreSQL via DATABASE_URL...");
    ({ db } = createNodeDb(databaseUrl));
  } else {
    const pgliteDir =
      process.env.PGLITE_DATA_DIR ||
      path.resolve(__dirname, "../../../.pglite-data");
    console.log(
      `[API] DATABASE_URL not set — starting embedded PostgreSQL (PGlite) at ${pgliteDir}`,
    );
    ({ db } = await createPgliteDb(pgliteDir));
  }

  const app = createApp({
    db,
    corsOrigin,
    authBaseUrl,
    authSecret,
    githubClientId: process.env.GITHUB_CLIENT_ID || undefined,
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET || undefined,
    githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET || undefined,
    aiProvider: (process.env.AI_PROVIDER as AiProvider | undefined) ?? "gemini",
    geminiApiKey: process.env.GEMINI_API_KEY || undefined,
    groqApiKey: process.env.GROQ_API_KEY || undefined,
    openaiApiKey: process.env.OPENAI_API_KEY || undefined,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || undefined,
    openrouterApiKey: process.env.OPENROUTER_API_KEY || undefined,
    byokEncryptionKey: process.env.BYOK_ENCRYPTION_KEY || undefined,
    upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL || undefined,
    upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || undefined,
  });

  const hostname = process.env.HOST || undefined;
  serve(
    {
      fetch: app.fetch,
      port,
      ...(hostname ? { hostname } : {}),
    },
    (info) => {
      console.log(
        `[API] Server ready at http://${hostname ?? "localhost"}:${info.port}`,
      );
    },
  );
}

void bootstrap();
