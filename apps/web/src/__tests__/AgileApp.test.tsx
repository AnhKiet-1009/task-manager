import { QueryClient } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import type {
  IssueDetailDto,
  IssueListItem,
  MeResponse,
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
        };
        const created: IssueListItem = {
          ...mockIssues[1]!,
          id: "55555555-5555-4555-8555-555555555599",
          identifier: "ENG-19",
          title: body.title,
          type: body.type ?? "task",
          priority: body.priority ?? "medium",
          stateId: body.stateId ?? STATE_TODO_ID,
          state:
            mockStates.find((s) => s.id === (body.stateId ?? STATE_TODO_ID)) ??
            mockStates[0]!,
          sprintId: body.sprintId ?? SPRINT_ACTIVE_ID,
          externalLinks: [],
          labels: [],
        };
        currentIssues.push(created);
        return jsonResponse({ issue: created }, 201);
      }

      const issueDetailMatch = url.match(/\/api\/v1\/issues\/([^/?]+)$/);
      if (issueDetailMatch && method === "GET") {
        const found = currentIssues.find((i) => i.id === issueDetailMatch[1]);
        if (!found) return jsonResponse({ error: { code: "NOT_FOUND" } }, 404);
        const detail: IssueDetailDto = {
          ...found,
          sprint: mockSprints.find((s) => s.id === found.sprintId) ?? null,
          parent: null,
          children: [],
          comments: [],
          activityLogs: [],
        };
        return jsonResponse({ issue: detail });
      }

      return jsonResponse({ error: { code: "NOT_MOCKED", url } }, 404);
    });

  return spy;
}

describe("Phase 2 Core Agile Engine UI", () => {
  beforeEach(() => {
    useUiStore.getState().resetSessionState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
});
