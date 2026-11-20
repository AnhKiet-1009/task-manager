import { Pool as NeonPool } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema/index.js";

/**
 * Runtime-agnostic Drizzle PostgreSQL database type shared across
 * Node.js (pg), Cloudflare Workers (Neon Serverless), and PGlite (local/tests).
 */
export type AppDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

/**
 * Serverless WebSocket client for Cloudflare Workers + Neon PostgreSQL Free Tier.
 * Supports full interactive transactions (`db.transaction(...)`).
 */
export function createEdgeDb(connectionString: string) {
  const pool = new NeonPool({ connectionString });
  const db = drizzleNeon(pool, { schema });
  return { db: db as unknown as AppDatabase, pool };
}
