import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { requireAuth, requireWorkspaceRole } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

export const eventRoutes = new Hono<AppEnv>().get(
  "/api/v1/workspaces/:workspaceId/events",
  requireAuth,
  requireWorkspaceRole("viewer"),
  (c) => {
    const workspaceId = c.req.param("workspaceId");
    const bus = c.var.eventBus;

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({
          workspaceId,
          timestamp: Date.now(),
        }),
      });

      const unsubscribe = bus.subscribe(workspaceId, (event) => {
        void stream.writeSSE({
          id: event.id,
          event: event.type,
          data: JSON.stringify(event),
        });
      });

      const heartbeat = setInterval(() => {
        void stream.writeSSE({
          event: "heartbeat",
          data: JSON.stringify({ timestamp: Date.now() }),
        });
      }, 25_000);

      stream.onAbort(() => {
        clearInterval(heartbeat);
        unsubscribe();
      });

      await new Promise<void>((resolve) => {
        stream.onAbort(() => resolve());
      });
    });
  },
);
