import {
  and,
  asc,
  eq,
  issues,
  labels,
  projects,
  sprints,
  workflowStates,
} from "@taskmanager/db";
import {
  createLabelSchema,
  createProjectSchema,
  createWorkflowStateSchema,
  DEFAULT_WORKFLOW_STATES,
  generateInitialRanks,
  generateRankBetween,
  updateProjectSchema,
  updateWorkflowStateSchema,
} from "@taskmanager/shared";
import { Hono } from "hono";
import { AppError } from "../lib/errors.js";
import { validateJson } from "../lib/validator.js";
import {
  assertProjectAccess,
  requireAuth,
  requireWorkspaceRole,
} from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

export const projectRoutes = new Hono<AppEnv>()
  .get(
    "/api/v1/workspaces/:workspaceId/projects",
    requireAuth,
    requireWorkspaceRole("viewer"),
    async (c) => {
      const workspaceId = c.req.param("workspaceId");
      const list = await c.var.db
        .select()
        .from(projects)
        .where(eq(projects.workspaceId, workspaceId))
        .orderBy(asc(projects.createdAt));

      return c.json({ projects: list });
    },
  )

  .post(
    "/api/v1/workspaces/:workspaceId/projects",
    requireAuth,
    requireWorkspaceRole("admin"),
    validateJson(createProjectSchema),
    async (c) => {
      const workspaceId = c.req.param("workspaceId");
      const body = c.req.valid("json");

      const [existing] = await c.var.db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.workspaceId, workspaceId),
            eq(projects.key, body.key),
          ),
        )
        .limit(1);

      if (existing) {
        throw new AppError(
          409,
          "PROJECT_KEY_EXISTS",
          `Project key "${body.key}" đã tồn tại trong Workspace này.`,
        );
      }

      const result = await c.var.db.transaction(async (tx) => {
        const [project] = await tx
          .insert(projects)
          .values({
            workspaceId,
            key: body.key,
            name: body.name,
            description: body.description ?? null,
            githubRepoFullName: body.githubRepoFullName ?? null,
          })
          .returning();

        if (!project) {
          throw new AppError(
            500,
            "PROJECT_CREATE_FAILED",
            "Không thể tạo Project.",
          );
        }

        const ranks = generateInitialRanks(DEFAULT_WORKFLOW_STATES.length);
        const states = await tx
          .insert(workflowStates)
          .values(
            DEFAULT_WORKFLOW_STATES.map((s, idx) => ({
              projectId: project.id,
              name: s.name,
              category: s.category,
              color: s.color,
              wipLimit: s.wipLimit,
              position: ranks[idx]!,
              isDefault: s.isDefault,
            })),
          )
          .returning();

        return { project, workflowStates: states };
      });

      return c.json(result, 201);
    },
  )

  .get("/api/v1/projects/:projectId", requireAuth, async (c) => {
    const projectId = c.req.param("projectId");
    const { project, role } = await assertProjectAccess(
      c.var.db,
      projectId,
      c.var.user!.id,
      "viewer",
    );

    const [states, projectLabels, projectSprints] = await Promise.all([
      c.var.db
        .select()
        .from(workflowStates)
        .where(eq(workflowStates.projectId, projectId))
        .orderBy(asc(workflowStates.position)),
      c.var.db
        .select()
        .from(labels)
        .where(eq(labels.projectId, projectId))
        .orderBy(asc(labels.name)),
      c.var.db
        .select()
        .from(sprints)
        .where(eq(sprints.projectId, projectId))
        .orderBy(asc(sprints.createdAt)),
    ]);

    return c.json({
      project,
      role,
      workflowStates: states,
      labels: projectLabels,
      sprints: projectSprints,
    });
  })

  .patch(
    "/api/v1/projects/:projectId",
    requireAuth,
    validateJson(updateProjectSchema),
    async (c) => {
      const projectId = c.req.param("projectId");
      await assertProjectAccess(c.var.db, projectId, c.var.user!.id, "admin");
      const body = c.req.valid("json");

      const [updated] = await c.var.db
        .update(projects)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined
            ? { description: body.description }
            : {}),
          ...(body.githubRepoFullName !== undefined
            ? { githubRepoFullName: body.githubRepoFullName }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId))
        .returning();

      return c.json({ project: updated });
    },
  )

  .delete("/api/v1/projects/:projectId", requireAuth, async (c) => {
    const projectId = c.req.param("projectId");
    await assertProjectAccess(c.var.db, projectId, c.var.user!.id, "admin");
    await c.var.db.delete(projects).where(eq(projects.id, projectId));
    return c.json({ deleted: true, id: projectId });
  })

  // ==============================================
  // Custom Workflow States (Kanban columns + WIP)
  // ==============================================

  .post(
    "/api/v1/projects/:projectId/states",
    requireAuth,
    validateJson(createWorkflowStateSchema),
    async (c) => {
      const projectId = c.req.param("projectId");
      await assertProjectAccess(c.var.db, projectId, c.var.user!.id, "admin");
      const body = c.req.valid("json");

      const existing = await c.var.db
        .select({ position: workflowStates.position })
        .from(workflowStates)
        .where(eq(workflowStates.projectId, projectId))
        .orderBy(asc(workflowStates.position));

      const lastPos = existing[existing.length - 1]?.position ?? null;
      const position = body.position ?? generateRankBetween(lastPos, null);

      const [state] = await c.var.db
        .insert(workflowStates)
        .values({
          projectId,
          name: body.name,
          category: body.category,
          color: body.color,
          wipLimit: body.wipLimit ?? null,
          position,
          isDefault: body.isDefault ?? false,
        })
        .returning();

      return c.json({ state }, 201);
    },
  )

  .patch(
    "/api/v1/projects/:projectId/states/:stateId",
    requireAuth,
    validateJson(updateWorkflowStateSchema),
    async (c) => {
      const projectId = c.req.param("projectId");
      const stateId = c.req.param("stateId");
      await assertProjectAccess(c.var.db, projectId, c.var.user!.id, "admin");
      const body = c.req.valid("json");

      const [updated] = await c.var.db
        .update(workflowStates)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.category !== undefined ? { category: body.category } : {}),
          ...(body.color !== undefined ? { color: body.color } : {}),
          ...(body.wipLimit !== undefined ? { wipLimit: body.wipLimit } : {}),
          ...(body.position !== undefined ? { position: body.position } : {}),
          ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        })
        .where(
          and(
            eq(workflowStates.id, stateId),
            eq(workflowStates.projectId, projectId),
          ),
        )
        .returning();

      if (!updated) {
        throw new AppError(404, "STATE_NOT_FOUND", "Không tìm thấy cột trạng thái.");
      }

      return c.json({ state: updated });
    },
  )

  .delete(
    "/api/v1/projects/:projectId/states/:stateId",
    requireAuth,
    async (c) => {
      const projectId = c.req.param("projectId");
      const stateId = c.req.param("stateId");
      await assertProjectAccess(c.var.db, projectId, c.var.user!.id, "admin");

      const [inUse] = await c.var.db
        .select({ id: issues.id })
        .from(issues)
        .where(eq(issues.stateId, stateId))
        .limit(1);

      if (inUse) {
        throw new AppError(
          409,
          "STATE_IN_USE",
          "Không thể xóa cột đang chứa Issue. Hãy chuyển các Issue sang cột khác trước.",
        );
      }

      await c.var.db
        .delete(workflowStates)
        .where(
          and(
            eq(workflowStates.id, stateId),
            eq(workflowStates.projectId, projectId),
          ),
        );

      return c.json({ deleted: true, id: stateId });
    },
  )

  // ==============================================
  // Project Labels
  // ==============================================

  .post(
    "/api/v1/projects/:projectId/labels",
    requireAuth,
    validateJson(createLabelSchema),
    async (c) => {
      const projectId = c.req.param("projectId");
      await assertProjectAccess(c.var.db, projectId, c.var.user!.id, "member");
      const body = c.req.valid("json");

      const [existing] = await c.var.db
        .select({ id: labels.id })
        .from(labels)
        .where(and(eq(labels.projectId, projectId), eq(labels.name, body.name)))
        .limit(1);

      if (existing) {
        throw new AppError(
          409,
          "LABEL_EXISTS",
          `Nhãn "${body.name}" đã tồn tại trong Project.`,
        );
      }

      const [label] = await c.var.db
        .insert(labels)
        .values({ projectId, name: body.name, color: body.color })
        .returning();

      return c.json({ label }, 201);
    },
  )

  .delete(
    "/api/v1/projects/:projectId/labels/:labelId",
    requireAuth,
    async (c) => {
      const projectId = c.req.param("projectId");
      const labelId = c.req.param("labelId");
      await assertProjectAccess(c.var.db, projectId, c.var.user!.id, "member");

      await c.var.db
        .delete(labels)
        .where(and(eq(labels.id, labelId), eq(labels.projectId, projectId)));

      return c.json({ deleted: true, id: labelId });
    },
  );
