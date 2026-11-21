import {
  activityLogs,
  and,
  asc,
  desc,
  eq,
  issueRelations,
  issues,
  projects,
  sql,
  workflowStates,
  workspaces,
} from "@taskmanager/db";
import {
  aiBreakdownRequestSchema,
  aiCommitBreakdownSchema,
  aiNaturalLanguageFilterRequestSchema,
  aiSprintRiskRequestSchema,
  generateRankBetween,
  workspaceAiSettingsSchema,
} from "@taskmanager/shared";
import { Hono } from "hono";
import {
  analyzeSprintRisk,
  generatePrdBreakdown,
  parseNaturalLanguageFilter,
} from "../lib/ai-service.js";
import { computeProjectAnalytics } from "../lib/analytics-engine.js";
import { encryptSecret } from "../lib/crypto.js";
import { AppError } from "../lib/errors.js";
import { getWorkspaceFreeAiQuota } from "../lib/rate-limit.js";
import { validateJson } from "../lib/validator.js";
import {
  assertProjectAccess,
  requireAuth,
  requireWorkspaceRole,
} from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

export const aiRoutes = new Hono<AppEnv>()
  // ==============================================
  // Workspace AI BYOK Settings & Quota Status
  // ==============================================

  .get(
    "/api/v1/workspaces/:workspaceId/ai/settings",
    requireAuth,
    requireWorkspaceRole("viewer"),
    async (c) => {
      const workspaceId = c.req.param("workspaceId");
      const [ws] = await c.var.db
        .select({ aiSettingsEncrypted: workspaces.aiSettingsEncrypted })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      const quota = await getWorkspaceFreeAiQuota(c.var.db, workspaceId, {
        url: c.var.config.upstashRedisRestUrl,
        token: c.var.config.upstashRedisRestToken,
      });

      const current = ws?.aiSettingsEncrypted;
      return c.json({
        settings: {
          provider: current?.provider ?? c.var.config.aiProvider,
          model: current?.model ?? "",
          hasByokKey: Boolean(current?.encryptedApiKey),
          quota,
        },
      });
    },
  )

  .put(
    "/api/v1/workspaces/:workspaceId/ai/settings",
    requireAuth,
    requireWorkspaceRole("admin"),
    validateJson(workspaceAiSettingsSchema),
    async (c) => {
      const workspaceId = c.req.param("workspaceId");
      const body = c.req.valid("json");

      const [existing] = await c.var.db
        .select({ aiSettingsEncrypted: workspaces.aiSettingsEncrypted })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      let nextEncrypted = existing?.aiSettingsEncrypted ?? null;

      if (body.clearKey) {
        nextEncrypted = {
          provider: body.provider,
          model: body.model || undefined,
        };
      } else if (body.apiKey) {
        const cipher = await encryptSecret(
          body.apiKey,
          c.var.config.byokEncryptionKey,
        );
        nextEncrypted = {
          provider: body.provider,
          model: body.model || undefined,
          ...cipher,
        };
      } else {
        nextEncrypted = {
          ...(nextEncrypted ?? {}),
          provider: body.provider,
          model: body.model || undefined,
        };
      }

      await c.var.db
        .update(workspaces)
        .set({
          aiSettingsEncrypted: nextEncrypted,
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, workspaceId));

      const quota = await getWorkspaceFreeAiQuota(c.var.db, workspaceId, {
        url: c.var.config.upstashRedisRestUrl,
        token: c.var.config.upstashRedisRestToken,
      });

      return c.json({
        settings: {
          provider: nextEncrypted.provider,
          model: nextEncrypted.model ?? "",
          hasByokKey: Boolean(nextEncrypted.encryptedApiKey),
          quota,
        },
      });
    },
  )

  // ==============================================
  // Pillar 1: PRD-to-Backlog Generator & Atomic Commit
  // ==============================================

  .post(
    "/api/v1/ai/prd-breakdown",
    requireAuth,
    validateJson(aiBreakdownRequestSchema),
    async (c) => {
      const userId = c.var.user!.id;
      const body = c.req.valid("json");
      const { project } = await assertProjectAccess(
        c.var.db,
        body.projectId,
        userId,
        "member",
      );

      const { result, meta } = await generatePrdBreakdown(
        c.var.db,
        c.var.config,
        {
          workspaceId: project.workspaceId,
          userId,
          projectName: project.name,
        },
        { prompt: body.prompt, maxIssues: body.maxIssues },
      );

      return c.json({ breakdown: result, meta });
    },
  )

  .post(
    "/api/v1/ai/prd-breakdown/commit",
    requireAuth,
    validateJson(aiCommitBreakdownSchema),
    async (c) => {
      const userId = c.var.user!.id;
      const body = c.req.valid("json");
      const { project } = await assertProjectAccess(
        c.var.db,
        body.projectId,
        userId,
        "member",
      );

      const committed = await c.var.db.transaction(async (tx) => {
        const states = await tx
          .select()
          .from(workflowStates)
          .where(eq(workflowStates.projectId, project.id))
          .orderBy(asc(workflowStates.position));

        const defaultState =
          states.find((s) => s.isDefault) ??
          states.find((s) => s.category === "unstarted") ??
          states[0];
        const inProgressState =
          states.find((s) => s.category === "started") ?? defaultState;

        if (!defaultState || !inProgressState) {
          throw new AppError(
            400,
            "NO_WORKFLOW_STATES",
            "Project chưa có cột trạng thái để lưu Issues.",
          );
        }

        const totalToCreate = 1 + body.issues.length;
        const [seqRow] = await tx
          .update(projects)
          .set({
            issueSequence: sql`${projects.issueSequence} + ${totalToCreate}`,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, project.id))
          .returning({
            key: projects.key,
            issueSequence: projects.issueSequence,
          });

        if (!seqRow) {
          throw new AppError(404, "PROJECT_NOT_FOUND", "Không tìm thấy Project.");
        }

        const firstSeq = seqRow.issueSequence - totalToCreate + 1;

        // Compute bottom LexoRank in target state
        const [lastDefault] = await tx
          .select({ position: issues.position })
          .from(issues)
          .where(
            and(
              eq(issues.projectId, project.id),
              eq(issues.stateId, defaultState.id),
            ),
          )
          .orderBy(desc(issues.position))
          .limit(1);

        let lastPos = lastDefault?.position ?? null;

        // 1. Insert parent Epic
        const epicPos = generateRankBetween(lastPos, null);
        const epicIdentifier = `${seqRow.key}-${firstSeq}`;
        const [createdEpic] = await tx
          .insert(issues)
          .values({
            projectId: project.id,
            identifier: epicIdentifier,
            type: "epic",
            stateId: inProgressState.id,
            reporterId: userId,
            title: body.epic.title,
            descriptionMd: body.epic.descriptionMd,
            priority: body.epic.priority,
            position: epicPos,
          })
          .returning();

        if (!createdEpic) {
          throw new AppError(500, "EPIC_CREATE_FAILED", "Không thể tạo Epic.");
        }

        await tx.insert(activityLogs).values({
          workspaceId: project.workspaceId,
          projectId: project.id,
          issueId: createdEpic.id,
          actorId: userId,
          action: "issue_created",
          payload: {
            identifier: createdEpic.identifier,
            title: createdEpic.title,
            source: "ai_prd_breakdown",
          },
        });

        // 2. Insert child issues linked to Epic
        const idByTempId = new Map<string, string>();
        const createdChildren: Array<{
          id: string;
          identifier: string;
          title: string;
        }> = [];

        for (let i = 0; i < body.issues.length; i++) {
          const spec = body.issues[i]!;
          const nextPos = generateRankBetween(lastPos, null);
          lastPos = nextPos;
          const identifier = `${seqRow.key}-${firstSeq + 1 + i}`;

          const [child] = await tx
            .insert(issues)
            .values({
              projectId: project.id,
              identifier,
              type: spec.type,
              parentId: createdEpic.id,
              sprintId: body.sprintId ?? null,
              stateId: defaultState.id,
              reporterId: userId,
              title: spec.title,
              descriptionMd: spec.descriptionMd,
              priority: spec.priority,
              storyPoints: spec.storyPoints,
              position: nextPos,
            })
            .returning();

          if (!child) continue;
          idByTempId.set(spec.tempId, child.id);
          createdChildren.push({
            id: child.id,
            identifier: child.identifier,
            title: child.title,
          });

          await tx.insert(activityLogs).values({
            workspaceId: project.workspaceId,
            projectId: project.id,
            issueId: child.id,
            actorId: userId,
            action: "issue_created",
            payload: {
              identifier: child.identifier,
              title: child.title,
              storyPoints: child.storyPoints,
              sprintId: child.sprintId,
              source: "ai_prd_breakdown",
            },
          });
        }

        // 3. Create dependency relations from blockedByTempIds
        let relationsCreated = 0;
        for (const spec of body.issues) {
          const targetId = idByTempId.get(spec.tempId);
          if (!targetId) continue;
          for (const blockerTempId of spec.blockedByTempIds) {
            const blockerId = idByTempId.get(blockerTempId);
            if (!blockerId || blockerId === targetId) continue;
            await tx
              .insert(issueRelations)
              .values({
                sourceIssueId: blockerId,
                targetIssueId: targetId,
                type: "blocks",
              })
              .onConflictDoNothing();
            relationsCreated += 1;
          }
        }

        return {
          epic: {
            id: createdEpic.id,
            identifier: createdEpic.identifier,
            title: createdEpic.title,
          },
          issues: createdChildren,
          relationsCreated,
        };
      });

      c.var.eventBus.publish({
        id: crypto.randomUUID(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        type: "issue.created",
        actorId: userId,
        timestamp: Date.now(),
        payload: {
          issueId: committed.epic.id,
          identifier: committed.epic.identifier,
          batchCount: committed.issues.length + 1,
        },
      });

      return c.json(committed, 201);
    },
  )

  // ==============================================
  // Pillar 2: AI Sprint Risk & Bottleneck Radar
  // ==============================================

  .post(
    "/api/v1/ai/sprint-risk",
    requireAuth,
    validateJson(aiSprintRiskRequestSchema),
    async (c) => {
      const userId = c.var.user!.id;
      const body = c.req.valid("json");
      const { project } = await assertProjectAccess(
        c.var.db,
        body.projectId,
        userId,
        "viewer",
      );

      const analytics = await computeProjectAnalytics(
        c.var.db,
        project.id,
        body.sprintId,
      );

      const { report, meta } = await analyzeSprintRisk(
        c.var.db,
        c.var.config,
        { workspaceId: project.workspaceId, userId },
        analytics,
      );

      return c.json({ report, meta });
    },
  )

  // ==============================================
  // Pillar 3: Natural Language Filter (replaces JQL)
  // ==============================================

  .post(
    "/api/v1/ai/nl-filter",
    requireAuth,
    validateJson(aiNaturalLanguageFilterRequestSchema),
    async (c) => {
      const userId = c.var.user!.id;
      const body = c.req.valid("json");
      const { project } = await assertProjectAccess(
        c.var.db,
        body.projectId,
        userId,
        "viewer",
      );

      const { filter, meta } = await parseNaturalLanguageFilter(
        c.var.db,
        c.var.config,
        { workspaceId: project.workspaceId, userId },
        body.query,
      );

      return c.json({ filter, meta });
    },
  );
