import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { AppDatabase } from "./client.js";
import * as schema from "./schema/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DRIZZLE_MIGRATIONS_DIR = path.resolve(__dirname, "../drizzle");

/**
 * Applies all Drizzle-generated PostgreSQL migrations into a PGlite instance
 * idempotently. Used for zero-Docker local dev and fast Vitest integration tests.
 */
export async function applyPgliteMigrations(client: PGlite): Promise<void> {
  await client.exec(`
    CREATE TABLE IF NOT EXISTS "_taskmanager_migrations" (
      "name" text PRIMARY KEY NOT NULL,
      "applied_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  const appliedResult = await client.query<{ name: string }>(
    `SELECT "name" FROM "_taskmanager_migrations"`,
  );
  const appliedSet = new Set(appliedResult.rows.map((r) => r.name));

  const entries = await readdir(DRIZZLE_MIGRATIONS_DIR);
  const sqlFiles = entries.filter((f) => f.endsWith(".sql")).sort();

  for (const fileName of sqlFiles) {
    if (appliedSet.has(fileName)) continue;

    const fullPath = path.join(DRIZZLE_MIGRATIONS_DIR, fileName);
    const sqlContent = await readFile(fullPath, "utf8");
    const statements = sqlContent
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      await client.exec(stmt);
    }

    await client.query(
      `INSERT INTO "_taskmanager_migrations" ("name") VALUES ($1)`,
      [fileName],
    );
  }
}

/**
 * Creates a real PostgreSQL PGlite database (in-memory when `dataDir` is omitted,
 * or persisted on disk when a directory path is provided) with all migrations applied.
 */
export async function createPgliteDb(dataDir?: string) {
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  await client.waitReady;
  await applyPgliteMigrations(client);
  const db = drizzlePglite(client, { schema });
  return {
    db: db as unknown as AppDatabase,
    client,
    close: () => client.close(),
  };
}
