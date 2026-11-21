import { createEdgeDb } from "@taskmanager/db";
import type { AiProvider } from "@taskmanager/shared";
import { createApp } from "./app.js";

export interface WorkerEnv {
  DATABASE_URL: string;
  CORS_ORIGIN?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  AI_PROVIDER?: AiProvider;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  BYOK_ENCRYPTION_KEY?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
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
        githubWebhookSecret: env.GITHUB_WEBHOOK_SECRET,
        aiProvider: env.AI_PROVIDER,
        geminiApiKey: env.GEMINI_API_KEY,
        groqApiKey: env.GROQ_API_KEY,
        openaiApiKey: env.OPENAI_API_KEY,
        anthropicApiKey: env.ANTHROPIC_API_KEY,
        openrouterApiKey: env.OPENROUTER_API_KEY,
        byokEncryptionKey: env.BYOK_ENCRYPTION_KEY,
        upstashRedisRestUrl: env.UPSTASH_REDIS_REST_URL,
        upstashRedisRestToken: env.UPSTASH_REDIS_REST_TOKEN,
      });
      return await app.fetch(request);
    } finally {
      await pool.end();
    }
  },
};
