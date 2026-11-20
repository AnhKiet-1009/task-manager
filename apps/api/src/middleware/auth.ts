import {
  and,
  type AppDatabase,
  eq,
  issues,
  projects,
  sprints,
  workspaceMembers,
} from "@taskmanager/db";
import { hasMinimumRole, type WorkspaceRole } from "@taskmanager/shared";
import { createMiddleware } from "hono/factory";
import { AppError } from "../lib/errors.js";
import type { AppEnv } from "../types/env.js";

/**
 * Resolves the current Better Auth session on every request without throwing.
 */
export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const result = await c.var.auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (result?.user && result?.session) {
    c.set("user", {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      image: result.user.image ?? null,
    });
    c.set("session", {
      id: result.session.id,
      userId: result.session.userId,
      expiresAt: new Date(result.session.expiresAt),
    });
  } else {
    c.set("user", null);
    c.set("session", null);
  }

  await next();
});

/**
 * Rejects unauthenticated requests with 401 UNAUTHORIZED.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.var.user) {
    throw new AppError(
      401,
      "UNAUTHORIZED",
      "Vui lòng đăng nhập hoặc khởi chạy Sandbox để tiếp tục.",
    );
  }
  await next();
});

export async function assertWorkspaceRole(
  db: AppDatabase,
  workspaceId: string,
  userId: string,
  minRole: WorkspaceRole,
): Promise<WorkspaceRole> {
  const [membership] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Bạn không phải thành viên của Workspace này.",
    );
  }

  if (!hasMinimumRole(membership.role, minRole)) {
    throw new AppError(
      403,
      "INSUFFICIENT_ROLE",
      `Thao tác này yêu cầu quyền tối thiểu là "${minRole}" (quyền hiện tại: "${membership.role}").`,
    );
  }

  return membership.role;
}

export function requireWorkspaceRole(minRole: WorkspaceRole) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.var.user;
    if (!user) {
      throw new AppError(401, "UNAUTHORIZED", "Vui lòng đăng nhập.");
    }
    const workspaceId = c.req.param("workspaceId");
    if (!workspaceId) {
      throw new AppError(400, "BAD_REQUEST", "Thiếu workspaceId.");
    }

    const role = await assertWorkspaceRole(c.var.db, workspaceId, user.id, minRole);
    c.set("workspaceId", workspaceId);
    c.set("workspaceRole", role);
    await next();
  });
}

export async function assertProjectAccess(
  db: AppDatabase,
  projectId: string,
  userId: string,
  minRole: WorkspaceRole,
) {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (!project) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Không tìm thấy Project.");
  }

  const role = await assertWorkspaceRole(
    db,
    project.workspaceId,
    userId,
    minRole,
  );
  return { project, role };
}

export async function assertSprintAccess(
  db: AppDatabase,
  sprintId: string,
  userId: string,
  minRole: WorkspaceRole,
) {
  const [sprint] = await db
    .select()
    .from(sprints)
    .where(eq(sprints.id, sprintId))
    .limit(1);

  if (!sprint) {
    throw new AppError(404, "SPRINT_NOT_FOUND", "Không tìm thấy Sprint.");
  }

  const { project, role } = await assertProjectAccess(
    db,
    sprint.projectId,
    userId,
    minRole,
  );
  return { sprint, project, role };
}

export async function assertIssueAccess(
  db: AppDatabase,
  issueId: string,
  userId: string,
  minRole: WorkspaceRole,
) {
  const [issue] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, issueId))
    .limit(1);

  if (!issue) {
    throw new AppError(404, "ISSUE_NOT_FOUND", "Không tìm thấy Issue.");
  }

  const { project, role } = await assertProjectAccess(
    db,
    issue.projectId,
    userId,
    minRole,
  );
  return { issue, project, role };
}
