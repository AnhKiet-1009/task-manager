import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  aiUsageLogs,
  type AppDatabase,
  eq,
  workspaces,
} from "@taskmanager/db";
import {
  aiBreakdownResponseSchema,
  type AIBreakdownResponse,
  type AiProvider,
  aiSprintRiskReportSchema,
  type AISprintRiskReport,
  type IssuePriority,
  type IssueType,
  naturalLanguageFilterSchema,
  type NaturalLanguageFilter,
  STORY_POINT_SCALE,
  type WorkflowStateCategory,
} from "@taskmanager/shared";
import { generateText, Output } from "ai";
import type { AppRuntimeConfig } from "../types/env.js";
import type { ProjectAnalyticsData } from "./analytics-engine.js";
import { decryptSecret } from "./crypto.js";
import {
  getWorkspaceFreeAiQuota,
  incrementUpstashQuotaCounter,
} from "./rate-limit.js";

const DEFAULT_MODEL_BY_PROVIDER: Record<AiProvider, string> = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  openrouter: "google/gemini-2.5-flash",
};

export interface AiInvocationMeta {
  mode: "llm" | "smart_fallback";
  provider: string;
  model: string;
  usedByok: boolean;
  quotaRemaining: number | null;
  fallbackReason?: string;
}

interface ResolvedAiRuntime {
  provider: AiProvider;
  modelName: string;
  apiKey: string | null;
  usedByok: boolean;
  quotaRemaining: number | null;
  fallbackReason?: string;
}

function buildLanguageModel(
  provider: AiProvider,
  modelName: string,
  apiKey: string,
) {
  switch (provider) {
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(modelName);
    }
    case "groq": {
      const groq = createOpenAI({
        apiKey,
        baseURL: "https://api.groq.com/openai/v1",
      });
      return groq(modelName);
    }
    case "openrouter": {
      const openrouter = createOpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
      });
      return openrouter(modelName);
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(modelName);
    }
    case "openai":
    default: {
      const openai = createOpenAI({ apiKey });
      return openai(modelName);
    }
  }
}

async function resolveWorkspaceAiRuntime(
  db: AppDatabase,
  workspaceId: string,
  config: AppRuntimeConfig,
): Promise<ResolvedAiRuntime> {
  const [ws] = await db
    .select({ aiSettingsEncrypted: workspaces.aiSettingsEncrypted })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  const encrypted = ws?.aiSettingsEncrypted;

  // 1. Workspace BYOK key takes top priority (unlimited, bypasses free quota)
  if (
    encrypted?.encryptedApiKey &&
    encrypted.iv &&
    encrypted.authTag &&
    encrypted.provider
  ) {
    try {
      const apiKey = await decryptSecret(
        {
          encryptedApiKey: encrypted.encryptedApiKey,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        },
        config.byokEncryptionKey,
      );
      const provider = encrypted.provider;
      const modelName = encrypted.model || DEFAULT_MODEL_BY_PROVIDER[provider];
      return {
        provider,
        modelName,
        apiKey,
        usedByok: true,
        quotaRemaining: null,
      };
    } catch {
      // Fall back safely if encryption key rotated
    }
  }

  // 2. Server Free Tier key with rate limiting ($0 protection)
  const upstash = {
    url: config.upstashRedisRestUrl,
    token: config.upstashRedisRestToken,
  };
  const quota = await getWorkspaceFreeAiQuota(db, workspaceId, upstash);

  const serverKeyMap: Record<AiProvider, string | undefined> = {
    gemini: config.geminiApiKey,
    groq: config.groqApiKey,
    openai: config.openaiApiKey,
    anthropic: config.anthropicApiKey,
    openrouter: config.openrouterApiKey,
  };

  const preferredProvider = config.aiProvider;
  const preferredKey = serverKeyMap[preferredProvider];
  const fallbackProvider = (
    Object.keys(serverKeyMap) as AiProvider[]
  ).find((p) => Boolean(serverKeyMap[p]));

  const activeProvider = preferredKey
    ? preferredProvider
    : (fallbackProvider ?? preferredProvider);
  const activeKey = preferredKey ?? (fallbackProvider ? serverKeyMap[fallbackProvider] : undefined);

  if (!activeKey) {
    return {
      provider: activeProvider,
      modelName: "agile-heuristic-v1",
      apiKey: null,
      usedByok: false,
      quotaRemaining: quota.remaining,
      fallbackReason:
        "Chưa cấu hình API Key AI phía server hoặc BYOK — đang dùng bộ phân tích Agile thông minh (Smart Fallback).",
    };
  }

  if (!quota.allowed) {
    return {
      provider: activeProvider,
      modelName: "agile-heuristic-v1",
      apiKey: null,
      usedByok: false,
      quotaRemaining: 0,
      fallbackReason: `Đã hết hạn mức miễn phí (${quota.limit} lượt/ngày). Hãy cấu hình BYOK để dùng không giới hạn.`,
    };
  }

  return {
    provider: activeProvider,
    modelName: DEFAULT_MODEL_BY_PROVIDER[activeProvider],
    apiKey: activeKey,
    usedByok: false,
    quotaRemaining: Math.max(0, quota.remaining - 1),
  };
}

async function logAiUsage(
  db: AppDatabase,
  config: AppRuntimeConfig,
  entry: {
    workspaceId: string;
    userId: string;
    feature: string;
    provider: string;
    model: string;
    usedByok: boolean;
    inputTokens?: number;
    outputTokens?: number;
  },
) {
  await db.insert(aiUsageLogs).values({
    workspaceId: entry.workspaceId,
    userId: entry.userId,
    feature: entry.feature,
    provider: entry.provider,
    model: entry.model,
    usedByok: entry.usedByok,
    inputTokens: entry.inputTokens ?? 0,
    outputTokens: entry.outputTokens ?? 0,
  });

  if (!entry.usedByok) {
    await incrementUpstashQuotaCounter(entry.workspaceId, {
      url: config.upstashRedisRestUrl,
      token: config.upstashRedisRestToken,
    });
  }
}

// ==============================================
// Smart Deterministic Fallbacks ($0 Guarantee)
// ==============================================

function snapToFibonacci(n: number): number {
  let closest: number = STORY_POINT_SCALE[0];
  for (const fib of STORY_POINT_SCALE) {
    if (Math.abs(fib - n) < Math.abs(closest - n)) {
      closest = fib;
    }
  }
  return closest;
}

function buildFallbackPrdBreakdown(
  prompt: string,
  maxIssues: number,
): AIBreakdownResponse {
  const cleanLines = prompt
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, "").trim())
    .filter((l) => l.length >= 6);

  const firstLine = cleanLines[0] ?? prompt.trim().slice(0, 90);
  const epicTitle =
    firstLine.length > 100 ? `${firstLine.slice(0, 97)}...` : firstLine;

  // Split candidate requirements from bullet lines or sentences
  const rawItems =
    cleanLines.length >= 3
      ? cleanLines.slice(1)
      : prompt
          .split(/[.!?;]\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length >= 10);

  const seedSpecs =
    rawItems.length >= 2
      ? rawItems.slice(0, Math.min(maxIssues, 8))
      : [
          `Thiết kế kiến trúc dữ liệu & API contract cho: ${epicTitle}`,
          `Triển khai Backend core logic và validation cho: ${epicTitle}`,
          `Xây dựng giao diện người dùng (UI/UX) cho: ${epicTitle}`,
          `Thêm phân quyền bảo mật, xử lý lỗi & tối ưu hiệu năng`,
          `Viết Unit/Integration Test & tài liệu bàn giao`,
        ];

  const issues: AIBreakdownResponse["issues"] = seedSpecs
    .slice(0, maxIssues)
    .map((text, idx) => {
      const lower = text.toLowerCase();
      let type: "story" | "task" | "bug" | "subtask" = "story";
      if (/bug|lỗi|sửa|fix|khắc phục/.test(lower)) type = "bug";
      else if (/test|kiểm thử|tối ưu|migration|schema|ci|deploy|cấu hình/.test(lower))
        type = "task";

      let priority: IssuePriority = "medium";
      if (/bảo mật|security|auth|thanh toán|payment|khẩn|critical|urgent/.test(lower)) {
        priority = "urgent";
      } else if (/api|database|core|chính|quan trọng|backend|webhook/.test(lower)) {
        priority = "high";
      }

      const estimatedPts = snapToFibonacci(
        text.length > 90 ? 8 : text.length > 55 ? 5 : idx === 0 ? 3 : 3,
      );

      return {
        tempId: `t${idx + 1}`,
        title: text.length > 140 ? `${text.slice(0, 137)}...` : text,
        descriptionMd: `### Tiêu chí nghiệm thu (Acceptance Criteria)\n\n- [ ] Triển khai đầy đủ yêu cầu: **${text}**\n- [ ] Xử lý edge cases và kiểm định dữ liệu đầu vào\n- [ ] Bổ sung unit/integration test xanh 100%`,
        type,
        priority,
        storyPoints: estimatedPts,
        blockedByTempIds: idx > 0 && idx <= 2 ? ["t1"] : [],
      };
    });

  return {
    epic: {
      title: epicTitle,
      descriptionMd: `Epic được bóc tách tự động từ yêu cầu sản phẩm:\n\n> ${prompt.trim().slice(0, 400)}`,
      priority: "high",
    },
    issues,
    rationale:
      "Đã chia nhỏ yêu cầu thành Epic và các hạng mục độc lập theo chuỗi phụ thuộc kỹ thuật (Thiết kế/Backend trước → UI → Kiểm thử), ước lượng Story Points theo dãy Fibonacci.",
  };
}

function buildFallbackSprintRisk(
  analytics: ProjectAnalyticsData,
): AISprintRiskReport {
  const { summary, selectedSprint, stalledIssues, wipBreaches } = analytics;
  let score = 15;

  // Pace calculation
  if (selectedSprint && selectedSprint.daysTotal > 0) {
    const expectedPercent = Math.round(
      (selectedSprint.daysElapsed / selectedSprint.daysTotal) * 100,
    );
    const paceGap = expectedPercent - summary.completionPercent;
    if (paceGap > 30) score += 30;
    else if (paceGap > 15) score += 18;
    else if (paceGap > 5) score += 8;
  }

  score += Math.min(25, summary.stalledCount * 12);
  score += Math.min(20, summary.overdueCount * 10);
  score += Math.min(15, summary.wipBreachCount * 10);
  score += Math.min(10, summary.unassignedHighPriorityCount * 5);
  score = Math.max(5, Math.min(98, score));

  const riskLevel: AISprintRiskReport["riskLevel"] =
    score >= 75
      ? "critical"
      : score >= 50
        ? "high"
        : score >= 28
          ? "medium"
          : "low";

  const recommendations: string[] = [];
  if (stalledIssues.length > 0) {
    const stalledList = stalledIssues
      .slice(0, 3)
      .map((s) => `${s.identifier} (${Math.round(s.hoursStalled / 24)} ngày)`)
      .join(", ");
    recommendations.push(
      `Gỡ tắc ngay cho ${stalledIssues.length} issue bị kẹt lâu ở trạng thái đang làm: ${stalledList}.`,
    );
  }
  if (wipBreaches.length > 0) {
    const cols = wipBreaches
      .map((b) => `${b.stateName} (${b.currentCount}/${b.wipLimit})`)
      .join(", ");
    recommendations.push(
      `Giảm tải cột vượt giới hạn WIP: ${cols} — ưu tiên review & đóng thẻ đang mở trước khi kéo thêm thẻ mới.`,
    );
  }
  if (summary.overdueCount > 0) {
    recommendations.push(
      `Có ${summary.overdueCount} issue quá hạn chót; rà soát lại phạm vi Sprint hoặc tách nhỏ story lớn (> 5 pts).`,
    );
  }
  if (summary.unassignedHighPriorityCount > 0) {
    recommendations.push(
      `Phân công ngay ${summary.unassignedHighPriorityCount} issue độ ưu tiên Cao/Khẩn cấp đang chưa có người phụ trách.`,
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "Tiến độ Sprint đang bám sát đường chuẩn Burndown. Duy trì tốc độ review PR và giữ WIP ổn định.",
    );
  }

  const sprintLabel = selectedSprint?.name ?? "Sprint hiện tại";
  const summaryText = `${sprintLabel} hoàn thành ${summary.completedPoints}/${summary.totalPoints} pts (${summary.completionPercent}%), còn ${selectedSprint?.daysRemaining ?? 0} ngày. Phát hiện ${summary.stalledCount} issue kẹt > 72h, ${summary.overdueCount} quá hạn và ${summary.wipBreachCount} cột vượt WIP.`;

  return {
    riskLevel,
    riskScore: score,
    summary: summaryText,
    stalledIssueIdentifiers: stalledIssues.map((s) => s.identifier),
    recommendations,
  };
}

function buildFallbackNlFilter(rawQuery: string): NaturalLanguageFilter {
  const q = rawQuery.toLowerCase();
  const types: IssueType[] = [];
  const priorities: IssuePriority[] = [];
  const stateCategories: WorkflowStateCategory[] = [];
  const explanationParts: string[] = [];

  if (/\bbugs?\b|lỗi|sửa lỗi/.test(q)) types.push("bug");
  if (/\bstor(y|ies)\b|tính năng/.test(q)) types.push("story");
  if (/\btasks?\b|công việc|tác vụ/.test(q)) types.push("task");
  if (/\bsubtasks?\b|việc con/.test(q)) types.push("subtask");
  if (/\bepics?\b/.test(q)) types.push("epic");

  if (/khẩn|urgent|gấp|critical/.test(q)) priorities.push("urgent");
  if (/ưu tiên cao|\bcao\b|\bhigh\b/.test(q)) priorities.push("high");
  if (/trung bình|\bmedium\b/.test(q)) priorities.push("medium");
  if (/ưu tiên thấp|\bthấp\b|\blow\b/.test(q)) priorities.push("low");

  if (/backlog|tồn đọng/.test(q)) stateCategories.push("backlog");
  if (/chưa làm|cần làm|\btodo\b|unstarted/.test(q))
    stateCategories.push("unstarted");
  if (/đang làm|đang thực hiện|in progress|review|started/.test(q))
    stateCategories.push("started");
  if (/hoàn thành|đã xong|\bdone\b|completed/.test(q))
    stateCategories.push("completed");

  const unassignedOnly =
    /chưa gán|chưa có người|không có người|unassigned/.test(q)
      ? true
      : undefined;
  const overdueOnly = /quá hạn|trễ hạn|trễ deadline|overdue|late/.test(q)
    ? true
    : undefined;

  let minStoryPoints: number | undefined;
  const minPtMatch = q.match(/(?:>=|trên|lớn hơn|từ)\s*(\d+)\s*(?:pts?|điểm|points?)/);
  if (minPtMatch?.[1]) {
    minStoryPoints = Number(minPtMatch[1]);
  }

  let maxStoryPoints: number | undefined;
  const maxPtMatch = q.match(/(?:<=|dưới|nhỏ hơn|tối đa)\s*(\d+)\s*(?:pts?|điểm|points?)/);
  if (maxPtMatch?.[1]) {
    maxStoryPoints = Number(maxPtMatch[1]);
  }

  if (types.length > 0) explanationParts.push(`Loại: ${types.join(", ")}`);
  if (priorities.length > 0)
    explanationParts.push(`Ưu tiên: ${priorities.join(", ")}`);
  if (stateCategories.length > 0)
    explanationParts.push(`Trạng thái: ${stateCategories.join(", ")}`);
  if (unassignedOnly) explanationParts.push("Chưa có người phụ trách");
  if (overdueOnly) explanationParts.push("Đang quá hạn");
  if (minStoryPoints !== undefined)
    explanationParts.push(`>= ${minStoryPoints} pts`);
  if (maxStoryPoints !== undefined)
    explanationParts.push(`<= ${maxStoryPoints} pts`);

  // If no structured filter matched, treat the query as a keyword search
  const searchQuery =
    explanationParts.length === 0 ? rawQuery.trim() : undefined;
  if (searchQuery) {
    explanationParts.push(`Từ khóa: "${searchQuery}"`);
  }

  return {
    ...(types.length > 0 ? { types } : {}),
    ...(priorities.length > 0 ? { priorities } : {}),
    ...(stateCategories.length > 0 ? { stateCategories } : {}),
    ...(unassignedOnly ? { unassignedOnly } : {}),
    ...(overdueOnly ? { overdueOnly } : {}),
    ...(minStoryPoints !== undefined ? { minStoryPoints } : {}),
    ...(maxStoryPoints !== undefined ? { maxStoryPoints } : {}),
    ...(searchQuery ? { searchQuery } : {}),
    explanation: `Đã dịch truy vấn thành bộ lọc: ${explanationParts.join(" • ")}`,
  };
}

// ==============================================
// Public AI Copilot Operations
// ==============================================

export async function generatePrdBreakdown(
  db: AppDatabase,
  config: AppRuntimeConfig,
  ctx: { workspaceId: string; userId: string; projectName: string },
  input: { prompt: string; maxIssues: number },
): Promise<{ result: AIBreakdownResponse; meta: AiInvocationMeta }> {
  const runtime = await resolveWorkspaceAiRuntime(db, ctx.workspaceId, config);

  if (runtime.apiKey) {
    try {
      const model = buildLanguageModel(
        runtime.provider,
        runtime.modelName,
        runtime.apiKey,
      );
      const { output, usage } = await generateText({
        model,
        output: Output.object({ schema: aiBreakdownResponseSchema }),
        prompt: [
          `Bạn là Staff Engineering Manager chuyên Agile/Scrum cho dự án "${ctx.projectName}".`,
          `Hãy bóc tách yêu cầu sản phẩm (PRD) sau thành 1 Epic và tối đa ${input.maxIssues} Issues (story/task/bug/subtask) có tiêu chí nghiệm thu Markdown, Story Points Fibonacci (1,2,3,5,8,13), độ ưu tiên và phụ thuộc blockedByTempIds (dùng tempId "t1", "t2"...).`,
          `Trả lời bằng tiếng Việt rõ ràng, thực tế cho đội ngũ kỹ thuật.`,
          `\nPRD:\n${input.prompt}`,
        ].join("\n"),
      });

      const parsed = aiBreakdownResponseSchema.parse(output);
      await logAiUsage(db, config, {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        feature: "prd_to_backlog",
        provider: runtime.provider,
        model: runtime.modelName,
        usedByok: runtime.usedByok,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
      });

      return {
        result: parsed,
        meta: {
          mode: "llm",
          provider: runtime.provider,
          model: runtime.modelName,
          usedByok: runtime.usedByok,
          quotaRemaining: runtime.quotaRemaining,
        },
      };
    } catch (err) {
      console.warn("[AI prd_to_backlog] LLM error, falling back:", err);
    }
  }

  const fallback = buildFallbackPrdBreakdown(input.prompt, input.maxIssues);
  await logAiUsage(db, config, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    feature: "prd_to_backlog",
    provider: "smart-fallback",
    model: "agile-heuristic-v1",
    usedByok: runtime.usedByok,
  });

  return {
    result: fallback,
    meta: {
      mode: "smart_fallback",
      provider: "smart-fallback",
      model: "agile-heuristic-v1",
      usedByok: runtime.usedByok,
      quotaRemaining: runtime.quotaRemaining,
      fallbackReason: runtime.fallbackReason,
    },
  };
}

export async function analyzeSprintRisk(
  db: AppDatabase,
  config: AppRuntimeConfig,
  ctx: { workspaceId: string; userId: string },
  analytics: ProjectAnalyticsData,
): Promise<{ report: AISprintRiskReport; meta: AiInvocationMeta }> {
  const runtime = await resolveWorkspaceAiRuntime(db, ctx.workspaceId, config);

  if (runtime.apiKey) {
    try {
      const model = buildLanguageModel(
        runtime.provider,
        runtime.modelName,
        runtime.apiKey,
      );
      const { output, usage } = await generateText({
        model,
        output: Output.object({ schema: aiSprintRiskReportSchema }),
        prompt: [
          "Bạn là AI Scrum Master chuyên phân tích rủi ro Sprint (Sprint Risk & Bottleneck Radar).",
          "Dựa trên dữ liệu telemetry JSON dưới đây, hãy đánh giá mức độ rủi ro (low/medium/high/critical), điểm rủi ro (0-100), tóm tắt ngắn gọn tiếng Việt, liệt kê chính xác mã các issue bị kẹt (stalledIssueIdentifiers) và 2-4 hành động khắc phục cụ thể:",
          JSON.stringify({
            sprint: analytics.selectedSprint,
            summary: analytics.summary,
            stalledIssues: analytics.stalledIssues,
            wipBreaches: analytics.wipBreaches,
            workload: analytics.workload,
          }),
        ].join("\n"),
      });

      const parsed = aiSprintRiskReportSchema.parse(output);
      await logAiUsage(db, config, {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        feature: "sprint_risk_radar",
        provider: runtime.provider,
        model: runtime.modelName,
        usedByok: runtime.usedByok,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
      });

      return {
        report: parsed,
        meta: {
          mode: "llm",
          provider: runtime.provider,
          model: runtime.modelName,
          usedByok: runtime.usedByok,
          quotaRemaining: runtime.quotaRemaining,
        },
      };
    } catch (err) {
      console.warn("[AI sprint_risk_radar] LLM error, falling back:", err);
    }
  }

  const report = buildFallbackSprintRisk(analytics);
  await logAiUsage(db, config, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    feature: "sprint_risk_radar",
    provider: "smart-fallback",
    model: "agile-heuristic-v1",
    usedByok: runtime.usedByok,
  });

  return {
    report,
    meta: {
      mode: "smart_fallback",
      provider: "smart-fallback",
      model: "agile-heuristic-v1",
      usedByok: runtime.usedByok,
      quotaRemaining: runtime.quotaRemaining,
      fallbackReason: runtime.fallbackReason,
    },
  };
}

export async function parseNaturalLanguageFilter(
  db: AppDatabase,
  config: AppRuntimeConfig,
  ctx: { workspaceId: string; userId: string },
  query: string,
): Promise<{ filter: NaturalLanguageFilter; meta: AiInvocationMeta }> {
  const runtime = await resolveWorkspaceAiRuntime(db, ctx.workspaceId, config);

  if (runtime.apiKey) {
    try {
      const model = buildLanguageModel(
        runtime.provider,
        runtime.modelName,
        runtime.apiKey,
      );
      const { output, usage } = await generateText({
        model,
        output: Output.object({ schema: naturalLanguageFilterSchema }),
        prompt: [
          "Dịch câu truy vấn lọc công việc bằng tiếng Việt hoặc tiếng Anh thành bộ lọc cấu trúc chuẩn thay cho JQL.",
          "Chỉ điền các trường liên quan trong schema và viết `explanation` ngắn gọn bằng tiếng Việt.",
          `Truy vấn: "${query}"`,
        ].join("\n"),
      });

      const parsed = naturalLanguageFilterSchema.parse(output);
      await logAiUsage(db, config, {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        feature: "natural_language_filter",
        provider: runtime.provider,
        model: runtime.modelName,
        usedByok: runtime.usedByok,
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
      });

      return {
        filter: parsed,
        meta: {
          mode: "llm",
          provider: runtime.provider,
          model: runtime.modelName,
          usedByok: runtime.usedByok,
          quotaRemaining: runtime.quotaRemaining,
        },
      };
    } catch (err) {
      console.warn("[AI nl_filter] LLM error, falling back:", err);
    }
  }

  const filter = buildFallbackNlFilter(query);
  await logAiUsage(db, config, {
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    feature: "natural_language_filter",
    provider: "smart-fallback",
    model: "agile-heuristic-v1",
    usedByok: runtime.usedByok,
  });

  return {
    filter,
    meta: {
      mode: "smart_fallback",
      provider: "smart-fallback",
      model: "agile-heuristic-v1",
      usedByok: runtime.usedByok,
      quotaRemaining: runtime.quotaRemaining,
      fallbackReason: runtime.fallbackReason,
    },
  };
}
