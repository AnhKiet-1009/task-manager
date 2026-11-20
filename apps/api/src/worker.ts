import { createEdgeDb } from "@taskmanager/db";
import { createApp } from "./app.js";

export interface WorkerEnv {
  DATABASE_URL: string;
  CORS_ORIGIN?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
}

/**
 * Cloudflare Workers Free Tier entrypoint (0ms cold start).
 * Creates an edge Neon Serverless DB handle per request safely.
 */
export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { db, pool } = createEdgeDb(env.DATABASE_URL);
    try {
      const app = createApp({
        db,
        corsOrigin: env.CORS_ORIGIN,
        authSecret: env.BETTER_AUTH_SECRET,
        authBaseUrl: env.BETTER_AUTH_URL,
        githubClientId: env.GITHUB_CLIENT_ID,
        githubClientSecret: env.GITHUB_CLIENT_SECRET,
      });
      return await app.fetch(request);
    } finally {
      await pool.end();
    }
  },
};
