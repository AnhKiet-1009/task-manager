import { eq, projects } from "@taskmanager/db";
import {
  type ExternalLinkStatus,
  simulateGitHubPrSchema,
} from "@taskmanager/shared";
import { Hono } from "hono";
import { verifyGitHubWebhookSignature } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import { processPullRequestEvent } from "../lib/github-sync.js";
import { validateJson } from "../lib/validator.js";
import { assertProjectAccess, requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

interface GitHubPrWebhookPayload {
  action?: string;
  number?: number;
  repository?: { full_name?: string };
  pull_request?: {
    number?: number;
    title?: string;
    body?: string | null;
    html_url?: string;
    state?: string;
    draft?: boolean;
    merged?: boolean;
    head?: { ref?: string };
  };
}

function mapGitHubPrStatus(pr: NonNullable<GitHubPrWebhookPayload["pull_request"]>): ExternalLinkStatus {
  if (pr.merged) return "merged";
  if (pr.state === "closed") return "closed";
  if (pr.draft) return "draft";
  return "open";
}

export const githubRoutes = new Hono<AppEnv>()
  /**
   * Public GitHub App / Repository Webhook endpoint secured by HMAC-SHA256
   * (`X-Hub-Signature-256`). Automatically links PRs to Issues (`ENG-42`)
   * and transitions workflow columns (`In Review` / `Done`).
   */
  .post("/api/v1/webhooks/github", async (c) => {
    const secret = c.var.config.githubWebhookSecret;
    if (!secret) {
      throw new AppError(
        503,
        "GITHUB_WEBHOOK_UNCONFIGURED",
        "Chưa cấu hình GITHUB_WEBHOOK_SECRET trên server.",
      );
    }

    const rawBody = await c.req.text();
    const signature = c.req.header("x-hub-signature-256");
    const isValid = await verifyGitHubWebhookSignature(
      rawBody,
      signature,
      secret,
    );

    if (!isValid) {
      throw new AppError(
        401,
        "INVALID_WEBHOOK_SIGNATURE",
        "Chữ ký HMAC-SHA256 của GitHub Webhook không hợp lệ.",
      );
    }

    const eventType = c.req.header("x-github-event") ?? "";
    if (eventType === "ping") {
      return c.json({ ok: true, event: "ping" });
    }

    if (eventType !== "pull_request") {
      return c.json({ ok: true, ignored: true, event: eventType });
    }

    let payload: GitHubPrWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as GitHubPrWebhookPayload;
    } catch {
      throw new AppError(400, "INVALID_JSON", "Payload webhook không hợp lệ.");
    }

    const repoFullName = payload.repository?.full_name;
    const pr = payload.pull_request;
    if (!repoFullName || !pr) {
      return c.json({ ok: true, matchedProjects: 0 });
    }

    const matchedProjects = await c.var.db
      .select()
      .from(projects)
      .where(eq(projects.githubRepoFullName, repoFullName));

    if (matchedProjects.length === 0) {
      return c.json({ ok: true, matchedProjects: 0, repoFullName });
    }

    const prNumber = String(pr.number ?? payload.number ?? "0");
    const status = mapGitHubPrStatus(pr);
    const merged = Boolean(pr.merged);

    const results = [];
    for (const project of matchedProjects) {
      const syncResult = await processPullRequestEvent(
        c.var.db,
        c.var.eventBus,
        {
          projectId: project.id,
          workspaceId: project.workspaceId,
          repoFullName,
          prNumber,
          prTitle: pr.title ?? `PR #${prNumber}`,
          prBody: pr.body ?? "",
          branchName: pr.head?.ref ?? "",
          prUrl:
            pr.html_url ?? `https://github.com/${repoFullName}/pull/${prNumber}`,
          status,
          merged,
          actorId: null,
        },
      );
      results.push({ projectId: project.id, ...syncResult });
    }

    return c.json({
      ok: true,
      event: "pull_request",
      action: payload.action,
      results,
    });
  })

  /**
   * Interactive GitHub PR Simulator for Demo Sandbox & Local Testing.
   * Executes the exact same sync & auto-transition pipeline as a live GitHub Webhook.
   */
  .post(
    "/api/v1/projects/:projectId/github/simulate-pr",
    requireAuth,
    validateJson(simulateGitHubPrSchema),
    async (c) => {
      const projectId = c.req.param("projectId");
      const userId = c.var.user!.id;
      const { project } = await assertProjectAccess(
        c.var.db,
        projectId,
        userId,
        "member",
      );
      const body = c.req.valid("json");

      const repoFullName =
        project.githubRepoFullName ?? `acme/${project.key.toLowerCase()}-app`;
      const prNum = String(
        body.prNumber ?? Math.floor(200 + Math.random() * 700),
      );
      const key = body.issueIdentifier.toUpperCase();
      const merged = body.action === "merged";
      const status: ExternalLinkStatus =
        body.action === "merged"
          ? "merged"
          : body.action === "closed"
            ? "closed"
            : "open";
      const prTitle =
        body.prTitle ??
        (merged
          ? `feat(${project.key.toLowerCase()}): complete ${key}`
          : `feat(${project.key.toLowerCase()}): implement ${key}`);
      const prBody = merged
        ? `Automated PR simulation.\n\nCloses ${key}`
        : `Automated PR simulation referencing ${key}`;
      const branchName = `feat/${key.toLowerCase()}-pr-sync`;

      const result = await processPullRequestEvent(c.var.db, c.var.eventBus, {
        projectId: project.id,
        workspaceId: project.workspaceId,
        repoFullName,
        prNumber: prNum,
        prTitle,
        prBody,
        branchName,
        prUrl: `https://github.com/${repoFullName}/pull/${prNum}`,
        status,
        merged,
        actorId: userId,
      });

      return c.json({
        simulated: true,
        prNumber: prNum,
        status,
        ...result,
      });
    },
  );
