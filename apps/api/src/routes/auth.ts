import {
  cleanupExpiredSandboxes,
  eq,
  projects,
  seedSandboxWorkspace,
  workspaceMembers,
  workspaces,
} from "@taskmanager/db";
import { Hono } from "hono";
import { AppError } from "../lib/errors.js";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

export const authRoutes = new Hono<AppEnv>()
  /**
   * Better Auth native endpoints:
   * - POST /api/auth/sign-up/email
   * - POST /api/auth/sign-in/email
   * - POST /api/auth/sign-in/social (GitHub OAuth)
   * - POST /api/auth/sign-out
   * - GET  /api/auth/get-session
   */
  .on(["GET", "POST"], "/api/auth/*", (c) => {
    return c.var.auth.handler(c.req.raw);
  })

  /**
   * Returns current authenticated user profile + workspaces they belong to.
   */
  .get("/api/v1/me", requireAuth, async (c) => {
    const user = c.var.user!;
    const memberships = await c.var.db
      .select({
        role: workspaceMembers.role,
        workspace: workspaces,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, user.id));

    const enrichedWorkspaces = await Promise.all(
      memberships.map(async ({ role, workspace }) => {
        const wsProjects = await c.var.db
          .select({
            id: projects.id,
            key: projects.key,
            name: projects.name,
            githubRepoFullName: projects.githubRepoFullName,
          })
          .from(projects)
          .where(eq(projects.workspaceId, workspace.id));

        return {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          isSandbox: workspace.isSandbox,
          sandboxExpiresAt: workspace.sandboxExpiresAt,
          role,
          projects: wsProjects,
        };
      }),
    );

    return c.json({
      user,
      workspaces: enrichedWorkspaces,
    });
  })

  /**
   * 1-Click Demo Sandbox Launcher (Portfolio Zero-Friction Experience).
   * Issues a real isolated Better Auth session cookie and seeds a rich
   * Agile Engineering Workspace (ENG project, active sprint, burndown logs, PRs).
   */
  .post("/api/v1/sandbox", async (c) => {
    const db = c.var.db;
    const auth = c.var.auth;

    // Lazily clean up expired sandboxes so free-tier PostgreSQL stays lean
    try {
      await cleanupExpiredSandboxes(db);
    } catch (err) {
      console.warn("[Sandbox] Cleanup warning:", err);
    }

    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const guestEmail = `demo-${token}@sandbox.taskmanager.local`;
    const guestPassword = `Sandbox!${crypto.randomUUID()}`;
    const guestName = "Demo Engineer";

    const signUpResponse = await auth.api.signUpEmail({
      body: {
        name: guestName,
        email: guestEmail,
        password: guestPassword,
      },
      asResponse: true,
    });

    if (!signUpResponse.ok) {
      throw new AppError(
        500,
        "SANDBOX_AUTH_FAILED",
        "Không thể khởi tạo phiên Sandbox Demo.",
      );
    }

    const authPayload = (await signUpResponse.json()) as {
      user?: { id: string; name: string; email: string };
    };

    if (!authPayload.user?.id) {
      throw new AppError(
        500,
        "SANDBOX_USER_MISSING",
        "Không nhận được thông tin người dùng Sandbox.",
      );
    }

    const seeded = await seedSandboxWorkspace(db, {
      userId: authPayload.user.id,
    });

    // Forward Better Auth session cookies cleanly onto the HTTP response
    const setCookies =
      typeof signUpResponse.headers.getSetCookie === "function"
        ? signUpResponse.headers.getSetCookie()
        : [];

    if (setCookies.length > 0) {
      for (const cookie of setCookies) {
        c.header("Set-Cookie", cookie, { append: true });
      }
    } else {
      const fallbackCookie = signUpResponse.headers.get("set-cookie");
      if (fallbackCookie) {
        c.header("Set-Cookie", fallbackCookie);
      }
    }

    return c.json(
      {
        user: authPayload.user,
        workspace: seeded.workspace,
        project: seeded.project,
        activeSprint: seeded.activeSprint,
        issueCount: seeded.issueCount,
      },
      201,
    );
  });
