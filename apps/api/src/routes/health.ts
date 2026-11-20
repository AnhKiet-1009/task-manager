import {
  DEFAULT_WORKFLOW_STATES,
  ISSUE_PRIORITIES,
  ISSUE_TYPES,
  STORY_POINT_SCALE,
} from "@taskmanager/shared";
import { Hono } from "hono";

export const healthRoutes = new Hono()
  .get("/health", (c) => {
    return c.json({
      status: "ok",
      service: "@taskmanager/api",
      timestamp: new Date().toISOString(),
    });
  })
  .get("/api/v1/meta", (c) => {
    return c.json({
      name: "AI-First Agile PM API",
      version: "1.0.0",
      capabilities: {
        sandboxDemo: true,
        githubSmartSync: true,
        aiCopilot: {
          mode: "hybrid_free_and_byok",
          features: [
            "prd_to_backlog",
            "sprint_risk_radar",
            "natural_language_filter",
          ],
        },
        realtime: "sse",
      },
      domain: {
        issueTypes: ISSUE_TYPES,
        priorities: ISSUE_PRIORITIES,
        storyPointScale: STORY_POINT_SCALE,
        defaultWorkflowStates: DEFAULT_WORKFLOW_STATES,
      },
    });
  });
