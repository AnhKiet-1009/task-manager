import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { createNodeDb } from "@taskmanager/db/node";
import { createPgliteDb } from "@taskmanager/db/pglite";
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
  const databaseUrl = process.env.DATABASE_URL;
  let db;

  if (databaseUrl) {
    console.log("[API] Connecting to PostgreSQL via DATABASE_URL...");
    ({ db } = createNodeDb(databaseUrl));
  } else {
    const pgliteDir = path.resolve(__dirname, "../../../.pglite-data");
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
  });

  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`[API] Server ready at http://localhost:${info.port}`);
    },
  );
}

void bootstrap();
