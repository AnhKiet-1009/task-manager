import { Hono } from "hono";
import { computeProjectAnalytics } from "../lib/analytics-engine.js";
import { assertProjectAccess, requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

export const analyticsRoutes = new Hono<AppEnv>().get(
  "/api/v1/projects/:projectId/analytics",
  requireAuth,
  async (c) => {
    const projectId = c.req.param("projectId");
    await assertProjectAccess(c.var.db, projectId, c.var.user!.id, "viewer");
    const sprintId = c.req.query("sprintId") || null;

    const analytics = await computeProjectAnalytics(
      c.var.db,
      projectId,
      sprintId,
    );

    return c.json({ analytics });
  },
);
