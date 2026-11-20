import {
  and,
  asc,
  eq,
  inArray,
  issues,
  sprints,
  workflowStates,
} from "@taskmanager/db";
import {
  completeSprintSchema,
  createSprintSchema,
  updateSprintSchema,
} from "@taskmanager/shared";
import { Hono } from "hono";
import { AppError } from "../lib/errors.js";
import { validateJson } from "../lib/validator.js";
import {
  assertProjectAccess,
  assertSprintAccess,
  requireAuth,
} from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

export const sprintRoutes = new Hono<AppEnv>()
  .get("/api/v1/projects/:projectId/sprints", requireAuth, async (c) => {
    const projectId = c.req.param("projectId");
    await assertProjectAccess(c.var.db, projectId, c.var.user!.id, "viewer");

    const [projectSprints, projectIssues, states] = await Promise.all([
      c.var.db
        .select()
        .from(sprints)
        .where(eq(sprints.projectId, projectId))
        .orderBy(asc(sprints.createdAt)),
      c.var.db
        .select({
          sprintId: issues.sprintId,
          stateId: issues.stateId,
          storyPoints: issues.storyPoints,
        })
        .from(issues)
        .where(eq(issues.projectId, projectId)),
      c.var.db
        .select({ id: workflowStates.id, category: workflowStates.category })
        .from(workflowStates)
        .where(eq(workflowStates.projectId, projectId)),
    ]);

    const stateCategoryMap = new Map(states.map((s) => [s.id, s.category]));

    const enriched = projectSprints.map((sprint) => {
      const sprintIssues = projectIssues.filter((i) => i.sprintId === sprint.id);
      let completedIssues = 0;
      let totalPoints = 0;
      let completedPoints = 0;

      for (const issue of sprintIssues) {
        const pts = issue.storyPoints ?? 0;
        totalPoints += pts;
        if (stateCategoryMap.get(issue.stateId) === "completed") {
          completedIssues += 1;
          completedPoints += pts;
        }
      }

      return {
        ...sprint,
        metrics: {
          totalIssues: sprintIssues.length,
          completedIssues,
          totalPoints,
          completedPoints,
        },
      };
    });

    return c.json({ sprints: enriched });
  })

  .post(
    "/api/v1/projects/:projectId/sprints",
    requireAuth,
    validateJson(createSprintSchema),
    async (c) => {
      const projectId = c.req.param("projectId");
      const { project } = await assertProjectAccess(
        c.var.db,
        projectId,
        c.var.user!.id,
        "member",
      );
      const body = c.req.valid("json");

      if (body.status === "active") {
        const [active] = await c.var.db
          .select({ id: sprints.id })
          .from(sprints)
          .where(
            and(eq(sprints.projectId, projectId), eq(sprints.status, "active")),
          )
          .limit(1);

        if (active) {
          throw new AppError(
            409,
            "ACTIVE_SPRINT_EXISTS",
            "Project đã có 1 Sprint đang hoạt động. Hãy hoàn thành Sprint hiện tại trước.",
          );
        }
      }

      const [sprint] = await c.var.db
        .insert(sprints)
        .values({
          projectId,
          name: body.name,
          goal: body.goal ?? null,
          status: body.status,
          startDate: body.startDate ?? null,
          endDate: body.endDate ?? null,
        })
        .returning();

      c.var.eventBus.publish({
        id: crypto.randomUUID(),
        workspaceId: project.workspaceId,
        projectId,
        type: "sprint.updated",
        actorId: c.var.user!.id,
        timestamp: Date.now(),
        payload: { sprintId: sprint!.id, action: "created" },
      });

      return c.json({ sprint }, 201);
    },
  )

  .patch(
    "/api/v1/sprints/:sprintId",
    requireAuth,
    validateJson(updateSprintSchema),
    async (c) => {
      const sprintId = c.req.param("sprintId");
      const { project } = await assertSprintAccess(
        c.var.db,
        sprintId,
        c.var.user!.id,
        "member",
      );
      const body = c.req.valid("json");

      const [updated] = await c.var.db
        .update(sprints)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.goal !== undefined ? { goal: body.goal } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.startDate !== undefined ? { startDate: body.startDate } : {}),
          ...(body.endDate !== undefined ? { endDate: body.endDate } : {}),
          updatedAt: new Date(),
        })
        .where(eq(sprints.id, sprintId))
        .returning();

      c.var.eventBus.publish({
        id: crypto.randomUUID(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        type: "sprint.updated",
        actorId: c.var.user!.id,
        timestamp: Date.now(),
        payload: { sprintId, action: "updated" },
      });

      return c.json({ sprint: updated });
    },
  )

  .post("/api/v1/sprints/:sprintId/start", requireAuth, async (c) => {
    const sprintId = c.req.param("sprintId");
    const { sprint, project } = await assertSprintAccess(
      c.var.db,
      sprintId,
      c.var.user!.id,
      "member",
    );

    if (sprint.status === "completed") {
      throw new AppError(
        409,
        "SPRINT_ALREADY_COMPLETED",
        "Không thể bắt đầu lại Sprint đã hoàn thành.",
      );
    }

    const [active] = await c.var.db
      .select({ id: sprints.id })
      .from(sprints)
      .where(
        and(eq(sprints.projectId, project.id), eq(sprints.status, "active")),
      )
      .limit(1);

    if (active && active.id !== sprintId) {
      throw new AppError(
        409,
        "ACTIVE_SPRINT_EXISTS",
        "Project đã có Sprint đang hoạt động.",
      );
    }

    const now = new Date();
    const defaultStart = now.toISOString().slice(0, 10);
    const defaultEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const [updated] = await c.var.db
      .update(sprints)
      .set({
        status: "active",
        startDate: sprint.startDate ?? defaultStart,
        endDate: sprint.endDate ?? defaultEnd,
        updatedAt: now,
      })
      .where(eq(sprints.id, sprintId))
      .returning();

    c.var.eventBus.publish({
      id: crypto.randomUUID(),
      workspaceId: project.workspaceId,
      projectId: project.id,
      type: "sprint.updated",
      actorId: c.var.user!.id,
      timestamp: Date.now(),
      payload: { sprintId, action: "started" },
    });

    return c.json({ sprint: updated });
  })

  .post(
    "/api/v1/sprints/:sprintId/complete",
    requireAuth,
    validateJson(completeSprintSchema),
    async (c) => {
      const sprintId = c.req.param("sprintId");
      const { project } = await assertSprintAccess(
        c.var.db,
        sprintId,
        c.var.user!.id,
        "member",
      );
      const { moveIncompleteToSprintId } = c.req.valid("json");

      const result = await c.var.db.transaction(async (tx) => {
        const [sprintIssues, states] = await Promise.all([
          tx
            .select({
              id: issues.id,
              stateId: issues.stateId,
              storyPoints: issues.storyPoints,
            })
            .from(issues)
            .where(eq(issues.sprintId, sprintId)),
          tx
            .select({ id: workflowStates.id, category: workflowStates.category })
            .from(workflowStates)
            .where(eq(workflowStates.projectId, project.id)),
        ]);

        const categoryMap = new Map(states.map((s) => [s.id, s.category]));
        let completedPoints = 0;
        const incompleteIds: string[] = [];

        for (const issue of sprintIssues) {
          const cat = categoryMap.get(issue.stateId);
          if (cat === "completed") {
            completedPoints += issue.storyPoints ?? 0;
          } else if (cat !== "canceled") {
            incompleteIds.push(issue.id);
          }
        }

        if (incompleteIds.length > 0) {
          await tx
            .update(issues)
            .set({
              sprintId: moveIncompleteToSprintId ?? null,
              updatedAt: new Date(),
            })
            .where(inArray(issues.id, incompleteIds));
        }

        const [completedSprint] = await tx
          .update(sprints)
          .set({
            status: "completed",
            velocitySnapshot: completedPoints,
            updatedAt: new Date(),
          })
          .where(eq(sprints.id, sprintId))
          .returning();

        return {
          sprint: completedSprint,
          completedPoints,
          movedIncompleteCount: incompleteIds.length,
        };
      });

      c.var.eventBus.publish({
        id: crypto.randomUUID(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        type: "sprint.updated",
        actorId: c.var.user!.id,
        timestamp: Date.now(),
        payload: {
          sprintId,
          action: "completed",
          velocitySnapshot: result.completedPoints,
        },
      });

      return c.json(result);
    },
  )

  .delete("/api/v1/sprints/:sprintId", requireAuth, async (c) => {
    const sprintId = c.req.param("sprintId");
    await assertSprintAccess(c.var.db, sprintId, c.var.user!.id, "admin");
    await c.var.db.delete(sprints).where(eq(sprints.id, sprintId));
    return c.json({ deleted: true, id: sprintId });
  });
