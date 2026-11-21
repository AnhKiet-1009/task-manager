import { QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import type {
  AiSettingsDto,
  IssueDetailDto,
  IssueListItem,
  MeResponse,
  ProjectAnalyticsDto,
  ProjectDetailResponse,
  SprintDto,
  WorkflowStateDto,
  WorkspaceDetail,
} from "../lib/api";
import { useUiStore } from "../stores/uiStore";

const WS_ID = "11111111-1111-4111-8111-111111111111";
const PROJ_ID = "22222222-2222-4222-8222-222222222222";
const SPRINT_ACTIVE_ID = "33333333-3333-4333-8333-333333333333";
const SPRINT_PLANNED_ID = "33333333-3333-4333-8333-333333333334";
const STATE_TODO_ID = "44444444-4444-4444-8444-444444444441";
const STATE_INPROG_ID = "44444444-4444-4444-8444-444444444442";
const STATE_DONE_ID = "44444444-4444-4444-8444-444444444443";
const EPIC_ID = "55555555-5555-4555-8555-555555555550";

const mockStates: WorkflowStateDto[] = [
  {
    id: STATE_TODO_ID,
    projectId: PROJ_ID,
    name: "Todo",
    category: "unstarted",
    color: "#64748b",
    wipLimit: null,
    position: "V",
    isDefault: true,
  },
  {
    id: STATE_INPROG_ID,
    projectId: PROJ_ID,
    name: "In Progress",
    category: "started",
    color: "#3b82f6",
    wipLimit: 1, // Deliberately 1 so 2 issues trigger WIP warning
    position: "k",
    isDefault: false,
  },
  {
    id: STATE_DONE_ID,
    projectId: PROJ_ID,
    name: "Done",
    category: "completed",
    color: "#10b981",
    wipLimit: null,
    position: "s",
    isDefault: false,
  },
];

const mockSprints: SprintDto[] = [
  {
    id: SPRINT_ACTIVE_ID,
    projectId: PROJ_ID,
    name: "Sprint 14 — AI Copilot",
    goal: "Ship Kanban & AI Radar",
    status: "active",
    startDate: "2026-11-14",
    endDate: "2026-11-28",
    velocitySnapshot: null,
  },
  {
    id: SPRINT_PLANNED_ID,
    projectId: PROJ_ID,
    name: "Sprint 15 — Scale",
    goal: "Edge optimization",
    status: "planned",
    startDate: "2026-11-29",
    endDate: "2026-12-13",
    velocitySnapshot: null,
  },
];

const mockIssues: IssueListItem[] = [
  {
    id: EPIC_ID,
    projectId: PROJ_ID,
    identifier: "ENG-1",
    type: "epic",
    parentId: null,
    sprintId: null,
    stateId: STATE_INPROG_ID,
    assigneeId: "u-1",
    reporterId: "u-1",
    title: "AI Copilot Engine",
    descriptionMd: "Core AI architecture",
    priority: "urgent",
    storyPoints: null,
    estimateHours: null,
    position: "V",
    dueDate: "2026-11-28",
    completedAt: null,
    createdAt: "2026-11-14T00:00:00Z",
    updatedAt: "2026-11-14T00:00:00Z",
    state: mockStates[1]!,
    assignee: { id: "u-1", name: "Demo Engineer", email: "demo@acme.local" },
    labels: [],
    externalLinks: [],
    subIssueCount: 2,
  },
  {
    id: "55555555-5555-4555-8555-555555555551",
    projectId: PROJ_ID,
    identifier: "ENG-12",
    type: "story",
    parentId: EPIC_ID,
    sprintId: SPRINT_ACTIVE_ID,
    stateId: STATE_INPROG_ID,
    assigneeId: "u-1",
    reporterId: "u-1",
    title: "Xây dựng AI Sprint Risk Radar",
    descriptionMd: "Phát hiện task bị kẹt quá lâu",
    priority: "urgent",
    storyPoints: 8,
    estimateHours: null,
    position: "V",
    dueDate: "2026-11-25",
    completedAt: null,
    createdAt: "2026-11-14T00:00:00Z",
    updatedAt: "2026-11-14T00:00:00Z",
    state: mockStates[1]!,
    assignee: { id: "u-1", name: "Demo Engineer", email: "demo@acme.local" },
    labels: [
      { id: "l-1", projectId: PROJ_ID, name: "ai-copilot", color: "#ec4899" },
    ],
    externalLinks: [
      {
        id: "el-1",
        issueId: "55555555-5555-4555-8555-555555555551",
        provider: "github",
        externalType: "pr",
        externalId: "160",
        title: "wip(ai): sprint risk detector",
        status: "draft",
        url: "https://github.com/acme/repo/pull/160",
      },
    ],
    subIssueCount: 0,
  },
  {
    id: "55555555-5555-4555-8555-555555555552",
    projectId: PROJ_ID,
    identifier: "ENG-13",
    type: "bug",
    parentId: EPIC_ID,
    sprintId: SPRINT_ACTIVE_ID,
    stateId: STATE_INPROG_ID,
    assigneeId: null,
    reporterId: "u-1",
    title: "Sửa race condition GitHub Webhook",
    descriptionMd: "Upsert idempotent",
    priority: "high",
    storyPoints: 5,
    estimateHours: null,
    position: "k",
    dueDate: null,
    completedAt: null,
    createdAt: "2026-11-14T00:00:00Z",
    updatedAt: "2026-11-14T00:00:00Z",
    state: mockStates[1]!,
    assignee: null,
    labels: [],
    externalLinks: [],
    subIssueCount: 0,
  },
  {
    id: "55555555-5555-4555-8555-555555555553",
    projectId: PROJ_ID,
    identifier: "ENG-14",
    type: "task",
    parentId: EPIC_ID,
    sprintId: SPRINT_ACTIVE_ID,
    stateId: STATE_DONE_ID,
    assigneeId: "u-1",
    reporterId: "u-1",
    title: "Cài đặt LexoRank O(1)",
    descriptionMd: "Base-62 ordering",
    priority: "medium",
    storyPoints: 3,
    estimateHours: null,
    position: "V",
    dueDate: null,
    completedAt: "2026-11-16T00:00:00Z",
    createdAt: "2026-11-14T00:00:00Z",
    updatedAt: "2026-11-16T00:00:00Z",
    state: mockStates[2]!,
    assignee: { id: "u-1", name: "Demo Engineer", email: "demo@acme.local" },
    labels: [],
    externalLinks: [],
    subIssueCount: 0,
  },
  {
    id: "55555555-5555-4555-8555-555555555554",
    projectId: PROJ_ID,
    identifier: "ENG-18",
    type: "story",
    parentId: null,
    sprintId: null,
    stateId: STATE_TODO_ID,
    assigneeId: null,
    reporterId: "u-1",
    title: "Tích hợp pgvector Semantic Search",
    descriptionMd: "Backlog item",
    priority: "low",
    storyPoints: 8,
    estimateHours: null,
    position: "V",
    dueDate: null,
    completedAt: null,
    createdAt: "2026-11-14T00:00:00Z",
    updatedAt: "2026-11-14T00:00:00Z",
    state: mockStates[0]!,
    assignee: null,
    labels: [],
    externalLinks: [],
    subIssueCount: 0,
  },
];

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function setupMockFetch(options: {
  initialAuth: boolean;
  role?: "owner" | "viewer";
}) {
  let authed = options.initialAuth;
  const role = options.role ?? "owner";
  const currentIssues = [...mockIssues];
  let seq = 18;
  let relSeq = 1;
  let commentSeq = 1;
  let aiSettingsState: AiSettingsDto = {
    provider: "gemini",
    model: "gemini-2.5-flash",
    hasByokKey: false,
    quota: {
      allowed: true,
      used: 2,
      limit: 15,
      remaining: 13,
    },
  };

  const outgoingRelationsByIssue = new Map<
    string,
    IssueDetailDto["relations"]["outgoing"]
  >();
  const commentsByIssue = new Map<string, IssueDetailDto["comments"]>([
    [
      "55555555-5555-4555-8555-555555555551",
      [
        {
          id: "c-seed-1",
          bodyMd: "Đã dựng xong query Activity Logs.",
          createdAt: "2026-11-15T10:00:00Z",
          author: { id: "u-2", name: "Minh Anh", email: "minh.anh@acme.local" },
        },
      ],
    ],
  ]);
  const activityLogsByIssue = new Map<string, IssueDetailDto["activityLogs"]>([
    [
      "55555555-5555-4555-8555-555555555551",
      [
        {
          id: "log-1",
          action: "state_changed",
          payload: { toStateName: "In Progress", toCategory: "started" },
          createdAt: "2026-11-15T09:00:00Z",
          actor: { id: "u-1", name: "Demo Engineer" },
        },
      ],
    ],
  ]);

  const mePayload = (): MeResponse => ({
    user: { id: "u-1", name: "Demo Engineer", email: "demo@acme.local" },
    workspaces: [
      {
        id: WS_ID,
        name: "Acme Engineering (Demo)",
        slug: "acme-demo",
        isSandbox: true,
        role,
        projects: [{ id: PROJ_ID, key: "ENG", name: "Core Platform" }],
      },
    ],
  });

  const wsPayload: { workspace: WorkspaceDetail } = {
    workspace: {
      id: WS_ID,
      name: "Acme Engineering (Demo)",
      slug: "acme-demo",
      isSandbox: true,
      hasByokConfigured: false,
      role,
      members: [
        {
          id: "m-1",
          role,
          createdAt: "2026-11-14T00:00:00Z",
          user: { id: "u-1", name: "Demo Engineer", email: "demo@acme.local" },
        },
        {
          id: "m-2",
          role: "member",
          createdAt: "2026-11-14T00:00:00Z",
          user: { id: "u-2", name: "Minh Anh", email: "minh.anh@acme.local" },
        },
      ],
      projects: [
        {
          id: PROJ_ID,
          workspaceId: WS_ID,
          key: "ENG",
          name: "Core Platform",
          description: null,
          issueSequence: 18,
          githubRepoFullName: "acme/core-platform",
        },
      ],
    },
  };

  const projectPayload: ProjectDetailResponse = {
    project: wsPayload.workspace.projects[0]!,
    role,
    workflowStates: mockStates,
    labels: [
      { id: "l-1", projectId: PROJ_ID, name: "ai-copilot", color: "#ec4899" },
    ],
    sprints: mockSprints,
  };

  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();

      if (url.endsWith("/api/v1/sandbox") && method === "POST") {
        authed = true;
        return jsonResponse(
          {
            user: mePayload().user,
            workspace: mePayload().workspaces[0],
            project: projectPayload.project,
            activeSprint: mockSprints[0],
            issueCount: currentIssues.length,
          },
          201,
        );
      }

      if (url.endsWith("/api/v1/me")) {
        return authed
          ? jsonResponse(mePayload())
          : jsonResponse({ error: { code: "UNAUTHORIZED" } }, 401);
      }

      if (url.endsWith(`/api/v1/workspaces/${WS_ID}`)) {
        return jsonResponse(wsPayload);
      }

      if (url.endsWith(`/api/v1/projects/${PROJ_ID}`)) {
        return jsonResponse(projectPayload);
      }

      if (url.endsWith(`/api/v1/projects/${PROJ_ID}/sprints`)) {
        return jsonResponse({ sprints: mockSprints });
      }

      if (
        url.endsWith(`/api/v1/projects/${PROJ_ID}/issues`) &&
        method === "GET"
      ) {
        return jsonResponse({ issues: currentIssues });
      }

      if (
        url.endsWith(`/api/v1/projects/${PROJ_ID}/issues`) &&
        method === "POST"
      ) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          title: string;
          type?: IssueListItem["type"];
          priority?: IssueListItem["priority"];
          stateId?: string;
          sprintId?: string | null;
          parentId?: string | null;
        };
        seq += 1;
        const created: IssueListItem = {
          ...mockIssues[1]!,
          id: `55555555-5555-4555-8555-5555555555${seq}`,
          identifier: `ENG-${seq}`,
          title: body.title,
          descriptionMd: null,
          type: body.type ?? "task",
          priority: body.priority ?? "medium",
          parentId: body.parentId ?? null,
          stateId: body.stateId ?? STATE_TODO_ID,
          state:
            mockStates.find((s) => s.id === (body.stateId ?? STATE_TODO_ID)) ??
            mockStates[0]!,
          sprintId: body.sprintId !== undefined ? body.sprintId : SPRINT_ACTIVE_ID,
          externalLinks: [],
          labels: [],
        };
        currentIssues.push(created);
        return jsonResponse({ issue: created }, 201);
      }

      const relCreateMatch = url.match(/\/api\/v1\/issues\/([^/?]+)\/relations$/);
      if (relCreateMatch && method === "POST") {
        const sourceId = relCreateMatch[1]!;
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          targetIssueId: string;
          type: IssueDetailDto["relations"]["outgoing"][number]["type"];
        };
        const target = currentIssues.find((i) => i.id === body.targetIssueId);
        if (!target) return jsonResponse({ error: { code: "NOT_FOUND" } }, 404);
        const relId = `rel-${relSeq++}`;
        const list = outgoingRelationsByIssue.get(sourceId) ?? [];
        list.push({
          id: relId,
          type: body.type,
          targetIssue: {
            id: target.id,
            identifier: target.identifier,
            title: target.title,
            type: target.type,
            stateId: target.stateId,
            priority: target.priority,
          },
        });
        outgoingRelationsByIssue.set(sourceId, list);
        return jsonResponse({ relation: { id: relId } }, 201);
      }

      const relDeleteMatch = url.match(/\/api\/v1\/issue-relations\/([^/?]+)$/);
      if (relDeleteMatch && method === "DELETE") {
        const relId = relDeleteMatch[1]!;
        for (const [k, list] of outgoingRelationsByIssue.entries()) {
          outgoingRelationsByIssue.set(
            k,
            list.filter((r) => r.id !== relId),
          );
        }
        return jsonResponse({ deleted: true, id: relId });
      }

      const commentCreateMatch = url.match(/\/api\/v1\/issues\/([^/?]+)\/comments$/);
      if (commentCreateMatch && method === "POST") {
        const issueId = commentCreateMatch[1]!;
        const body = JSON.parse(String(init?.body ?? "{}")) as { bodyMd: string };
        const newComment = {
          id: `c-${commentSeq++}`,
          bodyMd: body.bodyMd,
          createdAt: new Date().toISOString(),
          author: { id: "u-1", name: "Demo Engineer", email: "demo@acme.local" },
        };
        const list = commentsByIssue.get(issueId) ?? [];
        list.push(newComment);
        commentsByIssue.set(issueId, list);
        return jsonResponse({ comment: newComment }, 201);
      }

      const commentDeleteMatch = url.match(/\/api\/v1\/comments\/([^/?]+)$/);
      if (commentDeleteMatch && method === "DELETE") {
        const commentId = commentDeleteMatch[1]!;
        for (const [k, list] of commentsByIssue.entries()) {
          commentsByIssue.set(
            k,
            list.filter((c) => c.id !== commentId),
          );
        }
        return jsonResponse({ deleted: true, id: commentId });
      }

      const issueDetailMatch = url.match(/\/api\/v1\/issues\/([^/?]+)$/);
      if (issueDetailMatch && method === "GET") {
        const found = currentIssues.find((i) => i.id === issueDetailMatch[1]);
        if (!found) return jsonResponse({ error: { code: "NOT_FOUND" } }, 404);
        const parent = found.parentId
          ? currentIssues.find((p) => p.id === found.parentId)
          : null;
        const children = currentIssues
          .filter((c) => c.parentId === found.id)
          .map((c) => ({
            id: c.id,
            identifier: c.identifier,
            title: c.title,
            type: c.type,
            priority: c.priority,
            stateId: c.stateId,
            storyPoints: c.storyPoints,
          }));
        const detail: IssueDetailDto = {
          ...found,
          sprint: mockSprints.find((s) => s.id === found.sprintId) ?? null,
          parent: parent
            ? {
                id: parent.id,
                identifier: parent.identifier,
                title: parent.title,
                type: parent.type,
              }
            : null,
          children,
          relations: {
            outgoing: outgoingRelationsByIssue.get(found.id) ?? [],
            incoming: [],
          },
          comments: [...(commentsByIssue.get(found.id) ?? [])],
          activityLogs: [...(activityLogsByIssue.get(found.id) ?? [])],
        };
        return jsonResponse({ issue: detail });
      }

      if (
        url.includes(`/api/v1/projects/${PROJ_ID}/analytics`) &&
        method === "GET"
      ) {
        const analytics: ProjectAnalyticsDto = {
          projectId: PROJ_ID,
          selectedSprint: {
            id: SPRINT_ACTIVE_ID,
            name: "Sprint 14 — AI Copilot",
            goal: "Ship Kanban & AI Radar",
            status: "active",
            startDate: "2026-11-14",
            endDate: "2026-11-28",
            daysTotal: 14,
            daysElapsed: 7,
            daysRemaining: 7,
          },
          summary: {
            totalIssues: 3,
            completedIssues: 1,
            totalPoints: 16,
            completedPoints: 3,
            remainingPoints: 13,
            completionPercent: 19,
            averageVelocity: 24,
            stalledCount: 1,
            overdueCount: 1,
            unassignedHighPriorityCount: 1,
            wipBreachCount: 1,
          },
          burndown: [
            {
              date: "2026-11-14",
              label: "14/11",
              idealPoints: 16,
              remainingPoints: 16,
              completedPoints: 0,
            },
            {
              date: "2026-11-16",
              label: "16/11",
              idealPoints: 12,
              remainingPoints: 13,
              completedPoints: 3,
            },
          ],
          velocity: [
            {
              sprintId: SPRINT_ACTIVE_ID,
              name: "Sprint 14 — AI Copilot",
              status: "active",
              plannedPoints: 16,
              completedPoints: 3,
              totalIssues: 3,
              completedIssues: 1,
            },
          ],
          workload: [
            {
              assigneeId: "u-1",
              assigneeName: "Demo Engineer",
              totalIssues: 2,
              inProgressIssues: 1,
              totalPoints: 11,
              completedPoints: 3,
              overdueCount: 0,
            },
            {
              assigneeId: null,
              assigneeName: "Chưa phân công",
              totalIssues: 1,
              inProgressIssues: 1,
              totalPoints: 5,
              completedPoints: 0,
              overdueCount: 1,
            },
          ],
          stalledIssues: [
            {
              id: "55555555-5555-4555-8555-555555555551",
              identifier: "ENG-12",
              title: "Xây dựng AI Sprint Risk Radar",
              stateName: "In Progress",
              assigneeName: "Demo Engineer",
              storyPoints: 8,
              hoursStalled: 96,
              dueDate: "2026-11-25",
              isOverdue: false,
            },
          ],
          wipBreaches: [
            {
              stateId: STATE_INPROG_ID,
              stateName: "In Progress",
              wipLimit: 1,
              currentCount: 2,
            },
          ],
        };
        return jsonResponse({ analytics });
      }

      if (
        url.endsWith(`/api/v1/workspaces/${WS_ID}/ai/settings`) &&
        method === "GET"
      ) {
        return jsonResponse({ settings: aiSettingsState });
      }

      if (
        url.endsWith(`/api/v1/workspaces/${WS_ID}/ai/settings`) &&
        method === "PUT"
      ) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          provider: AiSettingsDto["provider"];
          model?: string;
          apiKey?: string;
          clearKey?: boolean;
        };
        aiSettingsState = {
          ...aiSettingsState,
          provider: body.provider,
          model: body.model || aiSettingsState.model,
          hasByokKey: body.clearKey
            ? false
            : body.apiKey
              ? true
              : aiSettingsState.hasByokKey,
        };
        return jsonResponse({ settings: aiSettingsState });
      }

      if (url.endsWith("/api/v1/ai/sprint-risk") && method === "POST") {
        return jsonResponse({
          report: {
            riskLevel: "high",
            riskScore: 72,
            summary:
              "Sprint 14 đang có 1 issue bị kẹt quá 72 giờ và cột In Progress vượt giới hạn WIP.",
            bottlenecks: ["ENG-12 đứng im 4 ngày trong cột In Progress"],
            stalledIssueIdentifiers: ["ENG-12"],
            recommendations: [
              "Tách nhỏ ENG-12 và bổ sung reviewer ngay trong Daily Standup.",
              "Gán người phụ trách cho bug ưu tiên cao ENG-13.",
            ],
          },
          meta: {
            mode: "smart_fallback",
            provider: "gemini",
            model: "smart-agile-analyzer-v1",
            usedByok: false,
            quotaRemaining: 12,
          },
        });
      }

      if (url.endsWith("/api/v1/ai/prd-breakdown") && method === "POST") {
        return jsonResponse({
          breakdown: {
            epic: {
              title: "Hệ thống Thông báo Realtime đa kênh",
              descriptionMd: "Epic tự động sinh từ PRD.",
            },
            issues: [
              {
                tempId: "T1",
                title: "Thiết kế bảng notifications & API đánh dấu đã đọc",
                descriptionMd: "Tạo migration Drizzle và REST API.",
                type: "story",
                priority: "high",
                storyPoints: 5,
                blockedByTempIds: [],
              },
              {
                tempId: "T2",
                title: "Xây dựng Popover chuông thông báo trên TopBar",
                descriptionMd: "Hiển thị đếm chưa đọc realtime qua SSE.",
                type: "task",
                priority: "medium",
                storyPoints: 3,
                blockedByTempIds: ["T1"],
              },
            ],
            rationale:
              "Đã phân rã PRD thành 1 Epic và 2 hạng mục theo trình tự Backend → Frontend.",
          },
          meta: {
            mode: "smart_fallback",
            provider: "gemini",
            model: "smart-agile-breakdown-v1",
            usedByok: false,
            quotaRemaining: 11,
          },
        });
      }

      if (
        url.endsWith("/api/v1/ai/prd-breakdown/commit") &&
        method === "POST"
      ) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          sprintId?: string | null;
          epic: { title: string; descriptionMd: string };
          issues: Array<{
            tempId: string;
            title: string;
            descriptionMd: string;
            type: IssueListItem["type"];
            priority: IssueListItem["priority"];
            storyPoints: number;
          }>;
        };
        seq += 1;
        const epicId = `55555555-5555-4555-8555-5555555555${seq}`;
        const epicIdentifier = `ENG-${seq}`;
        currentIssues.push({
          ...mockIssues[0]!,
          id: epicId,
          identifier: epicIdentifier,
          title: body.epic.title,
          descriptionMd: body.epic.descriptionMd,
        });
        const createdList = body.issues.map((item) => {
          seq += 1;
          const created: IssueListItem = {
            ...mockIssues[1]!,
            id: `55555555-5555-4555-8555-5555555555${seq}`,
            identifier: `ENG-${seq}`,
            title: item.title,
            descriptionMd: item.descriptionMd,
            type: item.type,
            priority: item.priority,
            storyPoints: item.storyPoints,
            parentId: epicId,
            sprintId: body.sprintId ?? SPRINT_ACTIVE_ID,
            stateId: STATE_TODO_ID,
            state: mockStates[0]!,
            externalLinks: [],
            labels: [],
          };
          currentIssues.push(created);
          return {
            id: created.id,
            identifier: created.identifier,
            title: created.title,
          };
        });
        return jsonResponse(
          {
            epic: {
              id: epicId,
              identifier: epicIdentifier,
              title: body.epic.title,
            },
            issues: createdList,
            relationsCreated: 1,
          },
          201,
        );
      }

      if (url.endsWith("/api/v1/ai/nl-filter") && method === "POST") {
        return jsonResponse({
          filter: {
            types: ["bug"],
            priorities: ["high", "urgent"],
            unassignedOnly: true,
            explanation:
              "Đang lọc AI: Bug ưu tiên Cao/Khẩn cấp và chưa có người phụ trách.",
          },
          meta: {
            mode: "smart_fallback",
            provider: "gemini",
            model: "smart-nl-filter-v1",
            usedByok: false,
            quotaRemaining: 10,
          },
        });
      }

      if (
        url.endsWith(`/api/v1/projects/${PROJ_ID}/github/simulate-pr`) &&
        method === "POST"
      ) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          issueIdentifier: string;
          action: "opened" | "merged";
        };
        const target = currentIssues.find(
          (i) => i.identifier === body.issueIdentifier,
        );
        if (target && body.action === "merged") {
          target.stateId = STATE_DONE_ID;
          target.state = mockStates[2]!;
        }
        return jsonResponse({
          simulated: true,
          prNumber: "404",
          status: body.action === "merged" ? "merged" : "open",
          matchedIdentifiers: [body.issueIdentifier],
          updatedIssues: target
            ? [
                {
                  id: target.id,
                  identifier: target.identifier,
                  previousStateName: "In Progress",
                  nextStateName:
                    body.action === "merged" ? "Done" : "In Review",
                  transitioned: true,
                },
              ]
            : [],
        });
      }

      return jsonResponse({ error: { code: "NOT_MOCKED", url } }, 404);
    });

  return spy;
}

describe("Phase 2 Core Agile Engine UI", () => {
  const originalEventSource = (globalThis as { EventSource?: unknown })
    .EventSource;

  beforeEach(() => {
    useUiStore.getState().resetSessionState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEventSource === undefined) {
      delete (globalThis as { EventSource?: unknown }).EventSource;
    } else {
      (globalThis as { EventSource?: unknown }).EventSource =
        originalEventSource;
    }
  });

  it("launches 1-Click Demo Sandbox from AuthScreen and renders Kanban Board with WIP Limit warning", async () => {
    setupMockFetch({ initialAuth: false });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();

    render(<App queryClient={qc} />);

    // Unauthenticated users see 1-Click Demo Sandbox button
    const demoBtn = await screen.findByRole("button", {
      name: /trải nghiệm demo 1-click/i,
    });
    await user.click(demoBtn);

    // Enters Active Sprint Board with ENG-12, ENG-13, ENG-14
    const inProgressCol = await screen.findByTestId(
      "kanban-column-in-progress",
    );
    expect(
      within(inProgressCol).getByText("Xây dựng AI Sprint Risk Radar"),
    ).toBeInTheDocument();
    expect(
      within(inProgressCol).getByText("Sửa race condition GitHub Webhook"),
    ).toBeInTheDocument();

    // WIP Limit (2/1) warning banner is visible!
    expect(
      within(inProgressCol).getByText(/vượt giới hạn wip \(2\/1\)/i),
    ).toBeInTheDocument();

    // Filter by search keyword hides non-matching issues
    const searchInput = screen.getByLabelText(/lọc issue theo từ khóa/i);
    await user.type(searchInput, "Webhook");
    expect(
      screen.getByText("Sửa race condition GitHub Webhook"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Xây dựng AI Sprint Risk Radar"),
    ).not.toBeInTheDocument();
  });

  it("navigates Backlog & Sprints and Epics Roadmap and opens Command Palette with Ctrl+K", async () => {
    setupMockFetch({ initialAuth: true });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();

    render(<App queryClient={qc} />);

    // Wait for board to load
    await screen.findByTestId("kanban-column-in-progress");

    // Switch to Backlog & Sprints view
    await user.click(
      screen.getByRole("button", { name: /backlog & sprints/i }),
    );
    expect(
      await screen.findByText(/backlog & lập kế hoạch sprint/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tích hợp pgvector Semantic Search"),
    ).toBeInTheDocument();

    // Switch to Epics Roadmap view
    await user.click(screen.getByRole("button", { name: /epics roadmap/i }));
    expect(
      await screen.findByText("AI Copilot Engine"),
    ).toBeInTheDocument();
    expect(screen.getByText(/1\/3 issues/i)).toBeInTheDocument();

    // Open Command Palette via Ctrl+K and jump straight to ENG-12 detail modal
    await user.keyboard("{Control>}k{/Control}");
    const palette = await screen.findByRole("dialog", {
      name: /command palette/i,
    });
    const cmdInput = within(palette).getByPlaceholderText(/gõ lệnh hoặc tìm issue/i);
    await user.type(cmdInput, "ENG-12");
    await user.keyboard("{Enter}");

    // Issue Detail Modal opens with 1-Click Copy Git Branch button!
    expect(
      await screen.findByRole("button", { name: /copy git branch/i }),
    ).toBeInTheDocument();
  });

  it("hides write controls for Viewer role (RBAC UI enforcement)", async () => {
    setupMockFetch({ initialAuth: true, role: "viewer" });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(<App queryClient={qc} />);

    await screen.findByTestId("kanban-column-in-progress");
    expect(
      screen.queryByRole("button", { name: /tạo issue/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /thêm cột trạng thái/i }),
    ).not.toBeInTheDocument();
  });

  it("opens Deep Issue Detail Drawer with Tiptap description, inline Sub-issue, Issue Relations, @mention comments, and Activity Timeline", async () => {
    setupMockFetch({ initialAuth: true });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();

    render(<App queryClient={qc} />);

    // Click ENG-12 card on Kanban Board to open Deep Issue Detail Drawer
    const card = await screen.findByTestId("issue-card-ENG-12");
    await user.click(card);

    const drawer = await screen.findByRole("dialog", { name: /ENG-12/i });
    expect(within(drawer).getByText("ENG-1")).toBeInTheDocument();

    // Tiptap editor displays the issue description
    expect(
      await within(drawer).findByText("Phát hiện task bị kẹt quá lâu"),
    ).toBeInTheDocument();

    // Add inline Sub-issue
    await user.click(
      within(drawer).getByRole("button", { name: /thêm sub-issue/i }),
    );
    const subInput = within(drawer).getByPlaceholderText(/tiêu đề sub-issue mới/i);
    await user.type(subInput, "Viết unit test Risk Radar");
    await user.click(within(drawer).getByRole("button", { name: /^thêm$/i }));
    expect(
      await within(drawer).findByText("Viết unit test Risk Radar"),
    ).toBeInTheDocument();

    // Add and then remove an Issue Relation
    await user.click(
      within(drawer).getByRole("button", { name: /thêm liên kết/i }),
    );
    const targetSelect = within(drawer).getByLabelText(/chọn issue liên kết/i);
    await user.selectOptions(
      targetSelect,
      "55555555-5555-4555-8555-555555555552",
    );
    await user.click(
      within(drawer).getByRole("button", { name: /^liên kết$/i }),
    );
    expect(
      await within(drawer).findByText("Sửa race condition GitHub Webhook"),
    ).toBeInTheDocument();

    await user.click(
      within(drawer).getByRole("button", { name: /gỡ liên kết eng-13/i }),
    );
    await waitFor(() => {
      expect(
        within(drawer).queryByRole("button", { name: /gỡ liên kết eng-13/i }),
      ).not.toBeInTheDocument();
    });

    // Post a comment using @mention autocomplete
    const commentInput = within(drawer).getByLabelText(/nội dung bình luận/i);
    await user.type(commentInput, "Nhờ @Minh");
    const mentionList = await within(drawer).findByRole("listbox", {
      name: /nhắc thành viên/i,
    });
    await user.click(within(mentionList).getByRole("option", { name: /minh anh/i }));
    await user.type(commentInput, "kiểm tra giúp nhé");
    await user.click(within(drawer).getByRole("button", { name: /^gửi$/i }));

    expect(
      await within(drawer).findByText(/kiểm tra giúp nhé/i),
    ).toBeInTheDocument();

    // Switch to Activity Log Timeline tab
    await user.click(
      within(drawer).getByRole("tab", { name: /lịch sử hoạt động/i }),
    );
    expect(
      await within(drawer).findByText(/đã chuyển trạng thái sang "in progress"/i),
    ).toBeInTheDocument();
  });

  it("connects to Workspace SSE stream, displays Live badge, and refetches issues on remote events", async () => {
    const instances: Array<{
      listeners: Map<string, Array<(e: MessageEvent<string>) => void>>;
      emit: (eventName: string, data: unknown) => void;
    }> = [];

    class MockEventSource {
      listeners = new Map<string, Array<(e: MessageEvent<string>) => void>>();
      onerror: (() => void) | null = null;
      close = vi.fn();

      constructor() {
        instances.push(this);
      }

      addEventListener(
        type: string,
        listener: (e: MessageEvent<string>) => void,
      ) {
        const list = this.listeners.get(type) ?? [];
        list.push(listener);
        this.listeners.set(type, list);
      }

      emit(eventName: string, data: unknown) {
        const list = this.listeners.get(eventName) ?? [];
        const evt = new MessageEvent(eventName, {
          data: JSON.stringify(data),
        });
        for (const fn of list) fn(evt);
      }
    }

    (globalThis as { EventSource?: unknown }).EventSource = MockEventSource;

    const fetchSpy = setupMockFetch({ initialAuth: true });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(<App queryClient={qc} />);
    await screen.findByTestId("kanban-column-in-progress");

    await waitFor(() => {
      expect(instances.length).toBeGreaterThan(0);
    });
    const es = instances[instances.length - 1]!;

    // Emit SSE connected event -> Live badge appears
    act(() => {
      es.emit("connected", { workspaceId: WS_ID, timestamp: Date.now() });
    });
    expect(await screen.findByTestId("realtime-status-pill")).toHaveTextContent(
      "Live",
    );

    const issueFetchCountBefore = fetchSpy.mock.calls.filter(([u]) =>
      String(u).endsWith(`/api/v1/projects/${PROJ_ID}/issues`),
    ).length;

    // Emit remote issue.moved event from another teammate -> Toast + Refetch
    act(() => {
      es.emit("issue.moved", {
        id: "evt-remote-1",
        workspaceId: WS_ID,
        projectId: PROJ_ID,
        type: "issue.moved",
        actorId: "u-2",
        timestamp: Date.now(),
        payload: {
          issueId: "55555555-5555-4555-8555-555555555551",
          identifier: "ENG-12",
        },
      });
    });

    expect(
      await screen.findByText(/đồng bộ realtime: eng-12 vừa đổi trạng thái/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      const issueFetchCountAfter = fetchSpy.mock.calls.filter(([u]) =>
        String(u).endsWith(`/api/v1/projects/${PROJ_ID}/issues`),
      ).length;
      expect(issueFetchCountAfter).toBeGreaterThan(issueFetchCountBefore);
    });
  });

  it("renders Sprint Analytics Dashboard, runs AI Sprint Risk Radar, and simulates GitHub PR merge", async () => {
    setupMockFetch({ initialAuth: true });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();

    render(<App queryClient={qc} />);
    await screen.findByTestId("kanban-column-in-progress");

    // Navigate to Analytics & AI Radar via Sidebar
    await user.click(
      screen.getByRole("button", { name: /analytics & ai radar/i }),
    );
    expect(
      await screen.findByRole("heading", {
        name: /sprint analytics & ai risk radar/i,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/sprint burndown chart/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/biểu đồ team velocity/i)).toBeInTheDocument();
    expect(screen.getByText(/phân bổ tải công việc/i)).toBeInTheDocument();

    // Run AI Sprint Risk Radar scan
    await user.click(
      screen.getByRole("button", { name: /quét rủi ro sprint bằng ai/i }),
    );
    expect(
      await screen.findByText(/cao \(cần chú ý\) \(72\/100\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/tách nhỏ eng-12 và bổ sung reviewer/i),
    ).toBeInTheDocument();

    // Simulate GitHub PR Merge -> Done
    await user.click(screen.getByRole("button", { name: /merge → done/i }));
    await user.click(
      screen.getByRole("button", { name: /chạy đồng bộ github pr/i }),
    );
    expect(
      await screen.findByText(/github pr #404 \(merged\)/i),
    ).toBeInTheDocument();
  });

  it("generates and commits Epic + Issues with AI PRD-to-Backlog, applies Natural Language AI Filter, and saves BYOK Vault settings", async () => {
    setupMockFetch({ initialAuth: true });
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();

    render(<App queryClient={qc} />);
    await screen.findByTestId("kanban-column-in-progress");

    // 1. Natural Language AI Filter on Kanban Board
    const nlInput = screen.getByLabelText(/lọc bằng ngôn ngữ tự nhiên ai/i);
    await user.type(nlInput, "bug ưu tiên cao chưa có người làm");
    await user.click(screen.getByRole("button", { name: /^lọc ai$/i }));

    const aiBanner = await screen.findByTestId("ai-filter-banner");
    expect(aiBanner).toHaveTextContent(
      /đang lọc ai: bug ưu tiên cao\/khẩn cấp/i,
    );
    expect(
      screen.getByText("Sửa race condition GitHub Webhook"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Xây dựng AI Sprint Risk Radar"),
    ).not.toBeInTheDocument();

    // Clear AI Filter -> restores ENG-12
    await user.click(screen.getByRole("button", { name: /xóa lọc ai/i }));
    expect(
      await screen.findByText("Xây dựng AI Sprint Risk Radar"),
    ).toBeInTheDocument();

    // 2. AI PRD-to-Backlog Generator Modal
    await user.click(screen.getByRole("button", { name: /ai backlog/i }));
    const prdDialog = await screen.findByRole("dialog", {
      name: /ai prd-to-backlog generator/i,
    });
    await user.click(
      within(prdDialog).getByRole("button", {
        name: /mẫu: thông báo realtime đa kênh/i,
      }),
    );
    await user.click(
      within(prdDialog).getByRole("button", { name: /phân tích bằng ai/i }),
    );
    expect(
      await within(prdDialog).findByText(
        "Thiết kế bảng notifications & API đánh dấu đã đọc",
      ),
    ).toBeInTheDocument();
    await user.click(
      within(prdDialog).getByRole("button", {
        name: /tạo hàng loạt \(1 epic \+ 2 issues\)/i,
      }),
    );
    expect(
      await screen.findByText(
        "Thiết kế bảng notifications & API đánh dấu đã đọc",
      ),
    ).toBeInTheDocument();

    // 3. AI Copilot & BYOK Settings Modal
    await user.click(
      screen.getByRole("button", { name: /cài đặt ai \(byok\)/i }),
    );
    const settingsDialog = await screen.findByRole("dialog", {
      name: /cấu hình ai byok/i,
    });
    const providerSelect = await within(settingsDialog).findByLabelText(
      /nhà cung cấp llm/i,
    );
    await user.selectOptions(providerSelect, "groq");
    const keyInput = within(settingsDialog).getByLabelText(/api key riêng/i);
    await user.type(keyInput, "gsk_test_secret_key_123456");
    await user.click(
      within(settingsDialog).getByRole("button", { name: /lưu cấu hình/i }),
    );

    // Reopen to verify AES-256-GCM BYOK active status
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: /cấu hình ai byok/i }),
      ).not.toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: /cài đặt ai \(byok\)/i }),
    );
    expect(
      await screen.findByText(/không giới hạn \(byok\)/i),
    ).toBeInTheDocument();
  });
});
