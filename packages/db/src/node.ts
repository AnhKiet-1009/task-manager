import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { AppDatabase } from "./client.js";
import * as schema from "./schema/index.js";

/**
 * Node.js / Docker PostgreSQL client (local dev, CI, Node containers).
 */
export function createNodeDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  const db = drizzleNode(pool, { schema });
  return { db: db as unknown as AppDatabase, pool };
}
