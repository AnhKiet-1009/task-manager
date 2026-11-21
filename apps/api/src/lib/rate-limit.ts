import { aiUsageLogs, and, type AppDatabase, eq, gte } from "@taskmanager/db";

export const AI_FREE_DAILY_LIMIT = 15;

export interface QuotaCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

export interface UpstashConfig {
  url?: string;
  token?: string;
}

/**
 * Checks daily free-tier AI usage for a workspace.
 * Uses Upstash Redis REST API when configured (Cloudflare Workers compatible),
 * or falls back cleanly to counting `ai_usage_logs` over the last 24h in PostgreSQL.
 */
export async function getWorkspaceFreeAiQuota(
  db: AppDatabase,
  workspaceId: string,
  upstash?: UpstashConfig,
): Promise<QuotaCheckResult> {
  const limit = AI_FREE_DAILY_LIMIT;

  if (upstash?.url && upstash?.token) {
    try {
      const todayKey = `ai:quota:${workspaceId}:${new Date().toISOString().slice(0, 10)}`;
      const res = await fetch(
        `${upstash.url.replace(/\/$/, "")}/get/${encodeURIComponent(todayKey)}`,
        {
          headers: { Authorization: `Bearer ${upstash.token}` },
        },
      );
      if (res.ok) {
        const data = (await res.json()) as { result: string | null };
        const used = Number(data.result ?? 0);
        return {
          allowed: used < limit,
          used,
          limit,
          remaining: Math.max(0, limit - used),
        };
      }
    } catch {
      // Fall through to PostgreSQL count if Upstash is temporarily unreachable
    }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ id: aiUsageLogs.id })
    .from(aiUsageLogs)
    .where(
      and(
        eq(aiUsageLogs.workspaceId, workspaceId),
        eq(aiUsageLogs.usedByok, false),
        gte(aiUsageLogs.createdAt, since),
      ),
    );

  const used = rows.length;
  return {
    allowed: used < limit,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

export async function incrementUpstashQuotaCounter(
  workspaceId: string,
  upstash?: UpstashConfig,
): Promise<void> {
  if (!upstash?.url || !upstash?.token) return;
  try {
    const todayKey = `ai:quota:${workspaceId}:${new Date().toISOString().slice(0, 10)}`;
    const base = upstash.url.replace(/\/$/, "");
    await fetch(`${base}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstash.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", todayKey],
        ["EXPIRE", todayKey, 86400],
      ]),
    });
  } catch {
    // Non-blocking counter update
  }
}
