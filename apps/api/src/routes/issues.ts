import {
  activityLogs,
  and,
  asc,
  comments,
  desc,
  eq,
  externalLinks,
  ilike,
  inArray,
  isNull,
  issueLabels,
  issueRelations,
  issues,
  labels,
  or,
  projects,
  sprints,
  sql,
  users,
  workflowStates,
} from "@taskmanager/db";
import {
  createCommentSchema,
  createIssueRelationSchema,
  createIssueSchema,
  generateRankBetween,
  hasMinimumRole,
  issueListQuerySchema,
  moveIssueSchema,
  updateIssueSchema,
} from "@taskmanager/shared";
import { Hono } from "hono";
import { AppError } from "../lib/errors.js";
import { validateJson, validateQuery } from "../lib/validator.js";
import {
  assertIssueAccess,
  assertProjectAccess,
  requireAuth,
} from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

export const issueRoutes = new Hono<AppEnv>()
  .get(
    "/api/v1/projects/:projectId/issues",
    requireAuth,
    validateQuery(issueListQuerySchema),
    async (c) => {
      const projectId = c.req.param("projectId");
      await assertProjectAccess(c.var.db, projectId, c.var.user!.id, "viewer");
      const query = c.req.valid("query");

      const conditions = [eq(issues.projectId, projectId)];

      if (query.backlogOnly) {
        conditions.push(isNull(issues.sprintId));
      } else if (query.sprintId) {
        conditions.push(eq(issues.sprintId, query.sprintId));
      }

      if (query.stateId) conditions.push(eq(issues.stateId, query.stateId));
      if (query.type) conditions.push(eq(issues.type, query.type));
      if (query.priority) conditions.push(eq(issues.priority, query.priority));
      if (query.assigneeId) {
        conditions.push(eq(issues.assigneeId, query.assigneeId));
      }
      if (query.parentId) conditions.push(eq(issues.parentId, query.parentId));
      if (query.search) {
        const pattern = `%${query.search}%`;
        const searchCond = or(
          ilike(issues.title, pattern),
          ilike(issues.identifier, pattern),
          ilike(issues.descriptionMd, pattern),
        );
        if (searchCond) conditions.push(searchCond);
      }

      const rows = await c.var.db
        .select()
        .from(issues)
        .where(and(...conditions))
        .orderBy(asc(issues.position), asc(issues.createdAt));

      if (rows.length === 0) {
        return c.json({ issues: [] });
      }

      const issueIds = rows.map((r) => r.id);
      const assigneeIds = Array.from(
        new Set(rows.map((r) => r.assigneeId).filter((id): id is string => Boolean(id))),
      );

      const [stateRows, labelRows, linkRows, assigneeRows, childRows] =
        await Promise.all([
          c.var.db
            .select()
            .from(workflowStates)
            .where(eq(workflowStates.projectId, projectId)),
          c.var.db
            .select({
              issueId: issueLabels.issueId,
              label: labels,
            })
            .from(issueLabels)
            .innerJoin(labels, eq(issueLabels.labelId, labels.id))
            .where(inArray(issueLabels.issueId, issueIds)),
          c.var.db
            .select()
            .from(externalLinks)
            .where(inArray(externalLinks.issueId, issueIds)),
          assigneeIds.length > 0
            ? c.var.db
                .select({
                  id: users.id,
                  name: users.name,
                  email: users.email,
                  image: users.image,
                })
                .from(users)
                .where(inArray(users.id, assigneeIds))
            : Promise.resolve([]),
          c.var.db
            .select({ parentId: issues.parentId })
            .from(issues)
            .where(inArray(issues.parentId, issueIds)),
        ]);

      const stateMap = new Map(stateRows.map((s) => [s.id, s]));
      const assigneeMap = new Map(assigneeRows.map((u) => [u.id, u]));

      const labelsByIssue = new Map<string, (typeof labels.$inferSelect)[]>();
      for (const row of labelRows) {
        const list = labelsByIssue.get(row.issueId) ?? [];
        list.push(row.label);
        labelsByIssue.set(row.issueId, list);
      }

      const linksByIssue = new Map<
        string,
        (typeof externalLinks.$inferSelect)[]
      >();
      for (const link of linkRows) {
        const list = linksByIssue.get(link.issueId) ?? [];
        list.push(link);
        linksByIssue.set(link.issueId, list);
      }

      const subIssueCountByParent = new Map<string, number>();
      for (const child of childRows) {
        if (child.parentId) {
          subIssueCountByParent.set(
            child.parentId,
            (subIssueCountByParent.get(child.parentId) ?? 0) + 1,
          );
        }
      }

      const enriched = rows.map((issue) => ({
        ...issue,
        state: stateMap.get(issue.stateId) ?? null,
        assignee: issue.assigneeId ? (assigneeMap.get(issue.assigneeId) ?? null) : null,
        labels: labelsByIssue.get(issue.id) ?? [],
        externalLinks: linksByIssue.get(issue.id) ?? [],
        subIssueCount: subIssueCountByParent.get(issue.id) ?? 0,
      }));

      return c.json({ issues: enriched });
    },
  )

  .post(
    "/api/v1/projects/:projectId/issues",
    requireAuth,
    validateJson(createIssueSchema),
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

      const created = await c.var.db.transaction(async (tx) => {
        // Resolve target workflow state (provided or project default)
        let targetState;
        if (body.stateId) {
          [targetState] = await tx
            .select()
            .from(workflowStates)
            .where(
              and(
                eq(workflowStates.id, body.stateId),
                eq(workflowStates.projectId, projectId),
              ),
            )
            .limit(1);
        } else {
          const states = await tx
            .select()
            .from(workflowStates)
            .where(eq(workflowStates.projectId, projectId))
            .orderBy(asc(workflowStates.position));
          targetState = states.find((s) => s.isDefault) ?? states[0];
        }

        if (!targetState) {
          throw new AppError(
            400,
            "INVALID_STATE",
            "Không tìm thấy cột trạng thái hợp lệ cho Project.",
          );
        }

        // Atomic sequence increment for ENG-N identifier
        const [seqRow] = await tx
          .update(projects)
          .set({
            issueSequence: sql`${projects.issueSequence} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, projectId))
          .returning({
            key: projects.key,
            issueSequence: projects.issueSequence,
          });

        if (!seqRow) {
          throw new AppError(404, "PROJECT_NOT_FOUND", "Không tìm thấy Project.");
        }

        const identifier = `${seqRow.key}-${seqRow.issueSequence}`;

        // Compute LexoRank at the bottom of the target column
        const [lastInColumn] = await tx
          .select({ position: issues.position })
          .from(issues)
          .where(
            and(
              eq(issues.projectId, projectId),
              eq(issues.stateId, targetState.id),
            ),
          )
          .orderBy(desc(issues.position))
          .limit(1);

        const position = generateRankBetween(
          lastInColumn?.position ?? null,
          null,
        );

        const completedAt =
          targetState.category === "completed" ? new Date() : null;

        const [issue] = await tx
          .insert(issues)
          .values({
            projectId,
            identifier,
            type: body.type,
            parentId: body.parentId ?? null,
            sprintId: body.sprintId ?? null,
            stateId: targetState.id,
            assigneeId: body.assigneeId ?? null,
            reporterId: userId,
            title: body.title,
            descriptionMd: body.descriptionMd ?? null,
            priority: body.priority,
            storyPoints: body.storyPoints ?? null,
            estimateHours: body.estimateHours ?? null,
            position,
            dueDate: body.dueDate ?? null,
            customProperties: body.customProperties ?? {},
            completedAt,
          })
          .returning();

        if (!issue) {
          throw new AppError(500, "ISSUE_CREATE_FAILED", "Không thể tạo Issue.");
        }

        if (body.labelIds && body.labelIds.length > 0) {
          await tx
            .insert(issueLabels)
            .values(
              body.labelIds.map((labelId) => ({
                issueId: issue.id,
                labelId,
              })),
            )
            .onConflictDoNothing();
        }

        await tx.insert(activityLogs).values({
          workspaceId: project.workspaceId,
          projectId,
          issueId: issue.id,
          actorId: userId,
          action: "issue_created",
          payload: {
            identifier: issue.identifier,
            title: issue.title,
            storyPoints: issue.storyPoints,
            sprintId: issue.sprintId,
          },
        });

        return { issue, state: targetState };
      });

      c.var.eventBus.publish({
        id: crypto.randomUUID(),
        workspaceId: project.workspaceId,
        projectId,
        type: "issue.created",
        actorId: userId,
        timestamp: Date.now(),
        payload: {
          issueId: created.issue.id,
          identifier: created.issue.identifier,
          stateId: created.issue.stateId,
        },
      });

      return c.json(
        {
          issue: {
            ...created.issue,
            state: created.state,
          },
        },
        201,
      );
    },
  )

  .get("/api/v1/issues/:issueId", requireAuth, async (c) => {
    const issueId = c.req.param("issueId");
    const { issue } = await assertIssueAccess(
      c.var.db,
      issueId,
      c.var.user!.id,
      "viewer",
    );

    const [
      stateRow,
      sprintRow,
      parentRow,
      childrenRows,
      labelRows,
      outgoingRels,
      incomingRels,
      commentRows,
      linkRows,
      logRows,
    ] = await Promise.all([
      c.var.db
        .select()
        .from(workflowStates)
        .where(eq(workflowStates.id, issue.stateId))
        .limit(1),
      issue.sprintId
        ? c.var.db
            .select()
            .from(sprints)
            .where(eq(sprints.id, issue.sprintId))
            .limit(1)
        : Promise.resolve([]),
      issue.parentId
        ? c.var.db
            .select({
              id: issues.id,
              identifier: issues.identifier,
              title: issues.title,
              type: issues.type,
            })
            .from(issues)
            .where(eq(issues.id, issue.parentId))
            .limit(1)
        : Promise.resolve([]),
      c.var.db
        .select({
          id: issues.id,
          identifier: issues.identifier,
          title: issues.title,
          type: issues.type,
          priority: issues.priority,
          stateId: issues.stateId,
          storyPoints: issues.storyPoints,
        })
        .from(issues)
        .where(eq(issues.parentId, issueId))
        .orderBy(asc(issues.position)),
      c.var.db
        .select({ label: labels })
        .from(issueLabels)
        .innerJoin(labels, eq(issueLabels.labelId, labels.id))
        .where(eq(issueLabels.issueId, issueId)),
      c.var.db
        .select({
          id: issueRelations.id,
          type: issueRelations.type,
          targetIssue: {
            id: issues.id,
            identifier: issues.identifier,
            title: issues.title,
            type: issues.type,
            stateId: issues.stateId,
            priority: issues.priority,
          },
        })
        .from(issueRelations)
        .innerJoin(issues, eq(issueRelations.targetIssueId, issues.id))
        .where(eq(issueRelations.sourceIssueId, issueId)),
      c.var.db
        .select({
          id: issueRelations.id,
          type: issueRelations.type,
          sourceIssue: {
            id: issues.id,
            identifier: issues.identifier,
            title: issues.title,
            type: issues.type,
            stateId: issues.stateId,
            priority: issues.priority,
          },
        })
        .from(issueRelations)
        .innerJoin(issues, eq(issueRelations.sourceIssueId, issues.id))
        .where(eq(issueRelations.targetIssueId, issueId)),
      c.var.db
        .select({
          id: comments.id,
          bodyMd: comments.bodyMd,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          author: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
        })
        .from(comments)
        .leftJoin(users, eq(comments.authorId, users.id))
        .where(eq(comments.issueId, issueId))
        .orderBy(asc(comments.createdAt)),
      c.var.db
        .select()
        .from(externalLinks)
        .where(eq(externalLinks.issueId, issueId))
        .orderBy(desc(externalLinks.updatedAt)),
      c.var.db
        .select({
          id: activityLogs.id,
          action: activityLogs.action,
          payload: activityLogs.payload,
          createdAt: activityLogs.createdAt,
          actor: {
            id: users.id,
            name: users.name,
            image: users.image,
          },
        })
        .from(activityLogs)
        .leftJoin(users, eq(activityLogs.actorId, users.id))
        .where(eq(activityLogs.issueId, issueId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(50),
    ]);

    return c.json({
      issue: {
        ...issue,
        state: stateRow[0] ?? null,
        sprint: sprintRow[0] ?? null,
        parent: parentRow[0] ?? null,
        children: childrenRows,
        labels: labelRows.map((r) => r.label),
        relations: {
          outgoing: outgoingRels,
          incoming: incomingRels,
        },
        comments: commentRows,
        externalLinks: linkRows,
        activityLogs: logRows,
      },
    });
  })

  .patch(
    "/api/v1/issues/:issueId",
    requireAuth,
    validateJson(updateIssueSchema),
    async (c) => {
      const issueId = c.req.param("issueId");
      const userId = c.var.user!.id;
      const { issue, project } = await assertIssueAccess(
        c.var.db,
        issueId,
        userId,
        "member",
      );
      const body = c.req.valid("json");

      const updated = await c.var.db.transaction(async (tx) => {
        let nextCompletedAt = issue.completedAt;
        const logsToInsert: Array<{
          action:
            | "state_changed"
            | "sprint_moved"
            | "assignee_changed"
            | "priority_changed"
            | "points_changed";
          payload: Record<string, unknown>;
        }> = [];

        if (body.stateId && body.stateId !== issue.stateId) {
          const [oldState, newState] = await Promise.all([
            tx
              .select()
              .from(workflowStates)
              .where(eq(workflowStates.id, issue.stateId))
              .limit(1),
            tx
              .select()
              .from(workflowStates)
              .where(
                and(
                  eq(workflowStates.id, body.stateId),
                  eq(workflowStates.projectId, project.id),
                ),
              )
              .limit(1),
          ]);

          if (!newState[0]) {
            throw new AppError(400, "INVALID_STATE", "Trạng thái không hợp lệ.");
          }

          nextCompletedAt =
            newState[0].category === "completed" ? new Date() : null;

          logsToInsert.push({
            action: "state_changed",
            payload: {
              fromStateId: issue.stateId,
              fromCategory: oldState[0]?.category ?? null,
              toStateId: newState[0].id,
              toCategory: newState[0].category,
              toStateName: newState[0].name,
              storyPoints: body.storyPoints ?? issue.storyPoints,
            },
          });
        }

        if (body.sprintId !== undefined && body.sprintId !== issue.sprintId) {
          logsToInsert.push({
            action: "sprint_moved",
            payload: { fromSprintId: issue.sprintId, toSprintId: body.sprintId },
          });
        }

        if (
          body.assigneeId !== undefined &&
          body.assigneeId !== issue.assigneeId
        ) {
          logsToInsert.push({
            action: "assignee_changed",
            payload: {
              fromAssigneeId: issue.assigneeId,
              toAssigneeId: body.assigneeId,
            },
          });
        }

        if (body.priority !== undefined && body.priority !== issue.priority) {
          logsToInsert.push({
            action: "priority_changed",
            payload: { fromPriority: issue.priority, toPriority: body.priority },
          });
        }

        if (
          body.storyPoints !== undefined &&
          body.storyPoints !== issue.storyPoints
        ) {
          logsToInsert.push({
            action: "points_changed",
            payload: {
              fromPoints: issue.storyPoints,
              toPoints: body.storyPoints,
            },
          });
        }

        const [nextIssue] = await tx
          .update(issues)
          .set({
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.descriptionMd !== undefined
              ? { descriptionMd: body.descriptionMd }
              : {}),
            ...(body.type !== undefined ? { type: body.type } : {}),
            ...(body.priority !== undefined ? { priority: body.priority } : {}),
            ...(body.stateId !== undefined ? { stateId: body.stateId } : {}),
            ...(body.sprintId !== undefined ? { sprintId: body.sprintId } : {}),
            ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
            ...(body.assigneeId !== undefined
              ? { assigneeId: body.assigneeId }
              : {}),
            ...(body.storyPoints !== undefined
              ? { storyPoints: body.storyPoints }
              : {}),
            ...(body.estimateHours !== undefined
              ? { estimateHours: body.estimateHours }
              : {}),
            ...(body.dueDate !== undefined ? { dueDate: body.dueDate } : {}),
            ...(body.customProperties !== undefined
              ? { customProperties: body.customProperties }
              : {}),
            completedAt: nextCompletedAt,
            updatedAt: new Date(),
          })
          .where(eq(issues.id, issueId))
          .returning();

        if (body.labelIds !== undefined) {
          await tx.delete(issueLabels).where(eq(issueLabels.issueId, issueId));
          if (body.labelIds.length > 0) {
            await tx
              .insert(issueLabels)
              .values(body.labelIds.map((labelId) => ({ issueId, labelId })))
              .onConflictDoNothing();
          }
        }

        if (logsToInsert.length > 0) {
          await tx.insert(activityLogs).values(
            logsToInsert.map((entry) => ({
              workspaceId: project.workspaceId,
              projectId: project.id,
              issueId,
              actorId: userId,
              action: entry.action,
              payload: entry.payload,
            })),
          );
        }

        return nextIssue!;
      });

      c.var.eventBus.publish({
        id: crypto.randomUUID(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        type: "issue.updated",
        actorId: userId,
        timestamp: Date.now(),
        payload: { issueId, identifier: updated.identifier },
      });

      return c.json({ issue: updated });
    },
  )

  /**
   * Dedicated O(1) LexoRank Drag-and-Drop endpoint for Kanban Board & Backlog.
   * Updates position/state/sprint in a single row update, records activity_logs,
   * returns WIP warning metadata, and broadcasts real-time SSE event.
   */
  .patch(
    "/api/v1/issues/:issueId/move",
    requireAuth,
    validateJson(moveIssueSchema),
    async (c) => {
      const issueId = c.req.param("issueId");
      const userId = c.var.user!.id;
      const { issue, project } = await assertIssueAccess(
        c.var.db,
        issueId,
        userId,
        "member",
      );
      const body = c.req.valid("json");

      let nextPosition: string;
      try {
        nextPosition = generateRankBetween(body.prevPosition, body.nextPosition);
      } catch (err) {
        throw new AppError(
          400,
          "INVALID_POSITION_BOUNDS",
          err instanceof Error ? err.message : "Vị trí kéo thả không hợp lệ.",
        );
      }

      const result = await c.var.db.transaction(async (tx) => {
        const [targetState] = await tx
          .select()
          .from(workflowStates)
          .where(
            and(
              eq(workflowStates.id, body.stateId),
              eq(workflowStates.projectId, project.id),
            ),
          )
          .limit(1);

        if (!targetState) {
          throw new AppError(
            400,
            "INVALID_STATE",
            "Cột trạng thái đích không thuộc Project này.",
          );
        }

        const nextSprintId =
          body.sprintId !== undefined ? body.sprintId : issue.sprintId;
        const completedAt =
          targetState.category === "completed"
            ? (issue.completedAt ?? new Date())
            : null;

        const [moved] = await tx
          .update(issues)
          .set({
            stateId: targetState.id,
            sprintId: nextSprintId,
            position: nextPosition,
            completedAt,
            updatedAt: new Date(),
          })
          .where(eq(issues.id, issueId))
          .returning();

        // Check column WIP limit after move
        let wipExceeded = false;
        let columnCount = 0;
        if (targetState.wipLimit !== null) {
          const countConditions = [
            eq(issues.projectId, project.id),
            eq(issues.stateId, targetState.id),
            nextSprintId
              ? eq(issues.sprintId, nextSprintId)
              : isNull(issues.sprintId),
          ];
          const colIssues = await tx
            .select({ id: issues.id })
            .from(issues)
            .where(and(...countConditions));
          columnCount = colIssues.length;
          wipExceeded = columnCount > targetState.wipLimit;
        }

        if (issue.stateId !== targetState.id) {
          await tx.insert(activityLogs).values({
            workspaceId: project.workspaceId,
            projectId: project.id,
            issueId,
            actorId: userId,
            action: "state_changed",
            payload: {
              fromStateId: issue.stateId,
              toStateId: targetState.id,
              toCategory: targetState.category,
              toStateName: targetState.name,
              storyPoints: issue.storyPoints,
            },
          });
        }

        if (nextSprintId !== issue.sprintId) {
          await tx.insert(activityLogs).values({
            workspaceId: project.workspaceId,
            projectId: project.id,
            issueId,
            actorId: userId,
            action: "sprint_moved",
            payload: {
              fromSprintId: issue.sprintId,
              toSprintId: nextSprintId,
            },
          });
        }

        return {
          issue: moved!,
          wipWarning: wipExceeded
            ? {
                stateId: targetState.id,
                stateName: targetState.name,
                wipLimit: targetState.wipLimit!,
                currentCount: columnCount,
              }
            : null,
        };
      });

      c.var.eventBus.publish({
        id: crypto.randomUUID(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        type: "issue.moved",
        actorId: userId,
        timestamp: Date.now(),
        payload: {
          issueId,
          identifier: result.issue.identifier,
          stateId: result.issue.stateId,
          sprintId: result.issue.sprintId,
          position: result.issue.position,
        },
      });

      return c.json(result);
    },
  )

  .delete("/api/v1/issues/:issueId", requireAuth, async (c) => {
    const issueId = c.req.param("issueId");
    const userId = c.var.user!.id;
    const { issue, project } = await assertIssueAccess(
      c.var.db,
      issueId,
      userId,
      "member",
    );

    await c.var.db.delete(issues).where(eq(issues.id, issueId));

    c.var.eventBus.publish({
      id: crypto.randomUUID(),
      workspaceId: project.workspaceId,
      projectId: project.id,
      type: "issue.deleted",
      actorId: userId,
      timestamp: Date.now(),
      payload: { issueId, identifier: issue.identifier },
    });

    return c.json({ deleted: true, id: issueId });
  })

  // ==============================================
  // Comments & Issue Relations
  // ==============================================

  .post(
    "/api/v1/issues/:issueId/comments",
    requireAuth,
    validateJson(createCommentSchema),
    async (c) => {
      const issueId = c.req.param("issueId");
      const userId = c.var.user!.id;
      const { project } = await assertIssueAccess(
        c.var.db,
        issueId,
        userId,
        "member",
      );
      const { bodyMd } = c.req.valid("json");

      const comment = await c.var.db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(comments)
          .values({
            issueId,
            authorId: userId,
            bodyMd,
          })
          .returning();

        await tx.insert(activityLogs).values({
          workspaceId: project.workspaceId,
          projectId: project.id,
          issueId,
          actorId: userId,
          action: "comment_added",
          payload: { commentId: inserted!.id },
        });

        return inserted!;
      });

      c.var.eventBus.publish({
        id: crypto.randomUUID(),
        workspaceId: project.workspaceId,
        projectId: project.id,
        type: "comment.created",
        actorId: userId,
        timestamp: Date.now(),
        payload: { issueId, commentId: comment.id },
      });

      return c.json({ comment }, 201);
    },
  )

  .delete("/api/v1/comments/:commentId", requireAuth, async (c) => {
    const commentId = c.req.param("commentId");
    const userId = c.var.user!.id;

    const [comment] = await c.var.db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    if (!comment) {
      throw new AppError(404, "COMMENT_NOT_FOUND", "Không tìm thấy bình luận.");
    }

    const { project, role } = await assertIssueAccess(
      c.var.db,
      comment.issueId,
      userId,
      "viewer",
    );

    if (comment.authorId !== userId && !hasMinimumRole(role, "admin")) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Bạn chỉ có thể xóa bình luận của chính mình hoặc cần quyền Admin.",
      );
    }

    await c.var.db.delete(comments).where(eq(comments.id, commentId));

    c.var.eventBus.publish({
      id: crypto.randomUUID(),
      workspaceId: project.workspaceId,
      projectId: project.id,
      type: "issue.updated",
      actorId: userId,
      timestamp: Date.now(),
      payload: {
        issueId: comment.issueId,
        action: "comment_deleted",
        commentId,
      },
    });

    return c.json({ deleted: true, id: commentId });
  })

  .post(
    "/api/v1/issues/:issueId/relations",
    requireAuth,
    validateJson(createIssueRelationSchema),
    async (c) => {
      const issueId = c.req.param("issueId");
      const userId = c.var.user!.id;
      const { project } = await assertIssueAccess(
        c.var.db,
        issueId,
        userId,
        "member",
      );
      const { targetIssueId, type } = c.req.valid("json");

      if (issueId === targetIssueId) {
        throw new AppError(
          400,
          "SELF_RELATION_FORBIDDEN",
          "Không thể liên kết Issue với chính nó.",
        );
      }

      const [target] = await c.var.db
        .select({ id: issues.id })
        .from(issues)
        .where(
          and(eq(issues.id, targetIssueId), eq(issues.projectId, project.id)),
        )
        .limit(1);

      if (!target) {
        throw new AppError(
          404,
          "TARGET_ISSUE_NOT_FOUND",
          "Issue đích không tồn tại trong Project này.",
        );
      }

      const [relation] = await c.var.db
        .insert(issueRelations)
        .values({
          sourceIssueId: issueId,
          targetIssueId,
          type,
        })
        .onConflictDoNothing()
        .returning();

      if (relation) {
        c.var.eventBus.publish({
          id: crypto.randomUUID(),
          workspaceId: project.workspaceId,
          projectId: project.id,
          type: "issue.updated",
          actorId: userId,
          timestamp: Date.now(),
          payload: {
            issueId,
            targetIssueId,
            action: "relation_added",
          },
        });
      }

      return c.json({ relation: relation ?? null }, 201);
    },
  )

  .delete("/api/v1/issue-relations/:relationId", requireAuth, async (c) => {
    const relationId = c.req.param("relationId");
    const userId = c.var.user!.id;
    const [relation] = await c.var.db
      .select()
      .from(issueRelations)
      .where(eq(issueRelations.id, relationId))
      .limit(1);

    if (!relation) {
      throw new AppError(404, "RELATION_NOT_FOUND", "Không tìm thấy liên kết.");
    }

    const { project } = await assertIssueAccess(
      c.var.db,
      relation.sourceIssueId,
      userId,
      "member",
    );

    await c.var.db
      .delete(issueRelations)
      .where(eq(issueRelations.id, relationId));

    c.var.eventBus.publish({
      id: crypto.randomUUID(),
      workspaceId: project.workspaceId,
      projectId: project.id,
      type: "issue.updated",
      actorId: userId,
      timestamp: Date.now(),
      payload: {
        issueId: relation.sourceIssueId,
        targetIssueId: relation.targetIssueId,
        action: "relation_removed",
      },
    });

    return c.json({ deleted: true, id: relationId });
  });
