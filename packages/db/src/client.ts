import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

/**
 * Node.js / Docker PostgreSQL client (local dev, CI, Node containers).
 */
export function createNodeDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  const db = drizzleNode(pool, { schema });
  return { db, pool };
}

/**
 * Serverless HTTP client for Cloudflare Workers + Neon PostgreSQL Free Tier.
 */
export function createEdgeDb(connectionString: string) {
  const sql = neon(connectionString);
  return drizzleNeon(sql, { schema });
}

export type NodeDatabase = ReturnType<typeof createNodeDb>["db"];
export type EdgeDatabase = ReturnType<typeof createEdgeDb>;
export type AppDatabase = NodeDatabase | EdgeDatabase;
