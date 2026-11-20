import {
  and,
  eq,
  projects,
  users,
  workspaceMembers,
  workspaces,
} from "@taskmanager/db";
import {
  createWorkspaceSchema,
  updateMemberRoleSchema,
  updateWorkspaceSchema,
} from "@taskmanager/shared";
import { Hono } from "hono";
import { AppError } from "../lib/errors.js";
import { validateJson } from "../lib/validator.js";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

export const workspaceRoutes = new Hono<AppEnv>()
  .get("/api/v1/workspaces", requireAuth, async (c) => {
    const userId = c.var.user!.id;
    const rows = await c.var.db
      .select({
        role: workspaceMembers.role,
        workspace: workspaces,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId));

    return c.json({
      workspaces: rows.map((r) => ({
        id: r.workspace.id,
        name: r.workspace.name,
        slug: r.workspace.slug,
        isSandbox: r.workspace.isSandbox,
        sandboxExpiresAt: r.workspace.sandboxExpiresAt,
        createdAt: r.workspace.createdAt,
        role: r.role,
      })),
    });
  })

  .post(
    "/api/v1/workspaces",
    requireAuth,
    validateJson(createWorkspaceSchema),
    async (c) => {
      const userId = c.var.user!.id;
      const body = c.req.valid("json");

      const [existing] = await c.var.db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.slug, body.slug))
        .limit(1);

      if (existing) {
        throw new AppError(
          409,
          "WORKSPACE_SLUG_TAKEN",
          `Slug "${body.slug}" đã được sử dụng.`,
        );
      }

      const created = await c.var.db.transaction(async (tx) => {
        const [ws] = await tx
          .insert(workspaces)
          .values({
            name: body.name,
            slug: body.slug,
            isSandbox: false,
          })
          .returning();

        if (!ws) {
          throw new AppError(
            500,
            "WORKSPACE_CREATE_FAILED",
            "Không thể tạo Workspace.",
          );
        }

        await tx.insert(workspaceMembers).values({
          workspaceId: ws.id,
          userId,
          role: "owner",
        });

        return ws;
      });

      return c.json(
        {
          workspace: {
            id: created.id,
            name: created.name,
            slug: created.slug,
            isSandbox: created.isSandbox,
            role: "owner" as const,
            createdAt: created.createdAt,
          },
        },
        201,
      );
    },
  )

  .get(
    "/api/v1/workspaces/:workspaceId",
    requireAuth,
    requireWorkspaceRole("viewer"),
    async (c) => {
      const workspaceId = c.req.param("workspaceId");
      const [workspace] = await c.var.db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!workspace) {
        throw new AppError(
          404,
          "WORKSPACE_NOT_FOUND",
          "Không tìm thấy Workspace.",
        );
      }

      const [members, wsProjects] = await Promise.all([
        c.var.db
          .select({
            id: workspaceMembers.id,
            role: workspaceMembers.role,
            createdAt: workspaceMembers.createdAt,
            user: {
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
            },
          })
          .from(workspaceMembers)
          .innerJoin(users, eq(workspaceMembers.userId, users.id))
          .where(eq(workspaceMembers.workspaceId, workspaceId)),
        c.var.db
          .select()
          .from(projects)
          .where(eq(projects.workspaceId, workspaceId)),
      ]);

      return c.json({
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          isSandbox: workspace.isSandbox,
          sandboxExpiresAt: workspace.sandboxExpiresAt,
          hasByokConfigured: Boolean(workspace.aiSettingsEncrypted?.encryptedApiKey),
          role: c.var.workspaceRole,
          members,
          projects: wsProjects,
        },
      });
    },
  )

  .patch(
    "/api/v1/workspaces/:workspaceId",
    requireAuth,
    requireWorkspaceRole("admin"),
    validateJson(updateWorkspaceSchema),
    async (c) => {
      const workspaceId = c.req.param("workspaceId");
      const body = c.req.valid("json");

      if (body.slug) {
        const [conflict] = await c.var.db
          .select({ id: workspaces.id })
          .from(workspaces)
          .where(eq(workspaces.slug, body.slug))
          .limit(1);

        if (conflict && conflict.id !== workspaceId) {
          throw new AppError(
            409,
            "WORKSPACE_SLUG_TAKEN",
            `Slug "${body.slug}" đã được sử dụng.`,
          );
        }
      }

      const [updated] = await c.var.db
        .update(workspaces)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.slug !== undefined ? { slug: body.slug } : {}),
          updatedAt: new Date(),
        })
        .where(eq(workspaces.id, workspaceId))
        .returning();

      if (!updated) {
        throw new AppError(404, "WORKSPACE_NOT_FOUND", "Không tìm thấy Workspace.");
      }

      return c.json({
        workspace: {
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          isSandbox: updated.isSandbox,
          updatedAt: updated.updatedAt,
        },
      });
    },
  )

  .delete(
    "/api/v1/workspaces/:workspaceId",
    requireAuth,
    requireWorkspaceRole("owner"),
    async (c) => {
      const workspaceId = c.req.param("workspaceId");
      await c.var.db.delete(workspaces).where(eq(workspaces.id, workspaceId));
      return c.json({ deleted: true, id: workspaceId });
    },
  )

  .patch(
    "/api/v1/workspaces/:workspaceId/members/:memberId",
    requireAuth,
    requireWorkspaceRole("admin"),
    validateJson(updateMemberRoleSchema),
    async (c) => {
      const workspaceId = c.req.param("workspaceId");
      const memberId = c.req.param("memberId");
      const { role: nextRole } = c.req.valid("json");

      const [target] = await c.var.db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.id, memberId),
            eq(workspaceMembers.workspaceId, workspaceId),
          ),
        )
        .limit(1);

      if (!target) {
        throw new AppError(404, "MEMBER_NOT_FOUND", "Không tìm thấy thành viên.");
      }

      // Only an owner can assign or revoke the owner role
      if (
        (target.role === "owner" || nextRole === "owner") &&
        c.var.workspaceRole !== "owner"
      ) {
        throw new AppError(
          403,
          "INSUFFICIENT_ROLE",
          "Chỉ Owner mới có thể thay đổi vai trò Owner.",
        );
      }

      if (target.role === "owner" && nextRole !== "owner") {
        const owners = await c.var.db
          .select({ id: workspaceMembers.id })
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspaceId),
              eq(workspaceMembers.role, "owner"),
            ),
          );
        if (owners.length <= 1) {
          throw new AppError(
            409,
            "LAST_OWNER_PROTECTED",
            "Không thể hạ quyền Owner duy nhất của Workspace.",
          );
        }
      }

      const [updated] = await c.var.db
        .update(workspaceMembers)
        .set({ role: nextRole })
        .where(eq(workspaceMembers.id, memberId))
        .returning();

      return c.json({ member: updated });
    },
  );
