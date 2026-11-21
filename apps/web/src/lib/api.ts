import type {
  AIBreakdownRequest,
  AIBreakdownResponse,
  AICommitBreakdownInput,
  AINaturalLanguageFilterRequest,
  AiProvider,
  AISprintRiskReport,
  AISprintRiskRequest,
  CompleteSprintInput,
  CreateIssueInput,
  CreateProjectInput,
  CreateSprintInput,
  CreateWorkflowStateInput,
  CreateWorkspaceInput,
  ExternalLinkStatus,
  ExternalLinkType,
  ExternalProvider,
  IssuePriority,
  IssueRelationType,
  IssueType,
  MoveIssueInput,
  NaturalLanguageFilter,
  SimulateGitHubPrInput,
  SprintStatus,
  UpdateIssueInput,
  UpdateSprintInput,
  UpdateWorkflowStateInput,
  WorkflowStateCategory,
  WorkspaceAiSettingsInput,
  WorkspaceRole,
} from "@taskmanager/shared";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export function getEventsUrl(workspaceId: string): string {
  return `${API_BASE}/api/v1/workspaces/${workspaceId}/events`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  if (!res.ok) {
    let code = "HTTP_ERROR";
    let message = `Yêu cầu thất bại (${res.status})`;
    let details: unknown;

    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string; details?: unknown };
        message?: string;
      };
      if (body.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
        details = body.error.details;
      } else if (body.message) {
        message = body.message;
      }
    } catch {
      // Non-JSON response
    }

    throw new ApiError(res.status, code, message, details);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

// ==============================================
// DTO Interfaces (aligned with apps/api routes)
// ==============================================

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface ProjectSummary {
  id: string;
  key: string;
  name: string;
  githubRepoFullName?: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  isSandbox: boolean;
  sandboxExpiresAt?: string | null;
  role: WorkspaceRole;
  projects: ProjectSummary[];
}

export interface MeResponse {
  user: UserSummary;
  workspaces: WorkspaceSummary[];
}

export interface SandboxLaunchResponse {
  user: UserSummary;
  workspace: { id: string; name: string; slug: string; isSandbox: boolean };
  project: { id: string; key: string; name: string };
  activeSprint: { id: string; name: string };
  issueCount: number;
}

export interface WorkspaceMemberDto {
  id: string;
  role: WorkspaceRole;
  createdAt: string;
  user: UserSummary;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  slug: string;
  isSandbox: boolean;
  sandboxExpiresAt?: string | null;
  hasByokConfigured: boolean;
  role: WorkspaceRole;
  members: WorkspaceMemberDto[];
  projects: Array<{
    id: string;
    workspaceId: string;
    key: string;
    name: string;
    description: string | null;
    issueSequence: number;
    githubRepoFullName: string | null;
  }>;
}

export interface WorkflowStateDto {
  id: string;
  projectId: string;
  name: string;
  category: WorkflowStateCategory;
  color: string;
  wipLimit: number | null;
  position: string;
  isDefault: boolean;
}

export interface LabelDto {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

export interface SprintDto {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  velocitySnapshot: number | null;
  metrics?: {
    totalIssues: number;
    completedIssues: number;
    totalPoints: number;
    completedPoints: number;
  };
}

export interface ProjectDetailResponse {
  project: {
    id: string;
    workspaceId: string;
    key: string;
    name: string;
    description: string | null;
    issueSequence: number;
    githubRepoFullName: string | null;
  };
  role: WorkspaceRole;
  workflowStates: WorkflowStateDto[];
  labels: LabelDto[];
  sprints: SprintDto[];
}

export interface ExternalLinkDto {
  id: string;
  issueId: string;
  provider: ExternalProvider;
  externalType: ExternalLinkType;
  externalId: string;
  title: string;
  status: ExternalLinkStatus;
  url: string;
}

export interface IssueListItem {
  id: string;
  projectId: string;
  identifier: string;
  type: IssueType;
  parentId: string | null;
  sprintId: string | null;
  stateId: string;
  assigneeId: string | null;
  reporterId: string | null;
  title: string;
  descriptionMd: string | null;
  priority: IssuePriority;
  storyPoints: number | null;
  estimateHours: number | null;
  position: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  state: WorkflowStateDto | null;
  assignee: UserSummary | null;
  labels: LabelDto[];
  externalLinks: ExternalLinkDto[];
  subIssueCount: number;
}

export interface IssueRelationLinkedIssueDto {
  id: string;
  identifier: string;
  title: string;
  type: IssueType;
  stateId: string;
  priority: IssuePriority;
}

export interface IssueRelationOutgoingDto {
  id: string;
  type: IssueRelationType;
  targetIssue: IssueRelationLinkedIssueDto;
}

export interface IssueRelationIncomingDto {
  id: string;
  type: IssueRelationType;
  sourceIssue: IssueRelationLinkedIssueDto;
}

export interface IssueDetailDto extends IssueListItem {
  sprint: SprintDto | null;
  parent: { id: string; identifier: string; title: string; type: IssueType } | null;
  children: Array<{
    id: string;
    identifier: string;
    title: string;
    type: IssueType;
    priority: IssuePriority;
    stateId: string;
    storyPoints: number | null;
  }>;
  relations: {
    outgoing: IssueRelationOutgoingDto[];
    incoming: IssueRelationIncomingDto[];
  };
  comments: Array<{
    id: string;
    bodyMd: string;
    createdAt: string;
    author: UserSummary | null;
  }>;
  activityLogs: Array<{
    id: string;
    action: string;
    payload: Record<string, unknown>;
    createdAt: string;
    actor: { id: string; name: string; image?: string | null } | null;
  }>;
}

export interface MoveIssueResponse {
  issue: IssueListItem;
  wipWarning: {
    stateId: string;
    stateName: string;
    wipLimit: number;
    currentCount: number;
  } | null;
}

export interface BurndownPointDto {
  date: string;
  label: string;
  idealPoints: number;
  remainingPoints: number | null;
  completedPoints: number | null;
}

export interface VelocityItemDto {
  sprintId: string;
  name: string;
  status: SprintStatus;
  plannedPoints: number;
  completedPoints: number;
  totalIssues: number;
  completedIssues: number;
}

export interface WorkloadItemDto {
  assigneeId: string | null;
  assigneeName: string;
  totalIssues: number;
  inProgressIssues: number;
  totalPoints: number;
  completedPoints: number;
  overdueCount: number;
}

export interface StalledIssueDto {
  id: string;
  identifier: string;
  title: string;
  stateName: string;
  assigneeName: string | null;
  storyPoints: number | null;
  hoursStalled: number;
  dueDate: string | null;
  isOverdue: boolean;
}

export interface ProjectAnalyticsDto {
  projectId: string;
  selectedSprint: {
    id: string;
    name: string;
    goal: string | null;
    status: SprintStatus;
    startDate: string | null;
    endDate: string | null;
    daysTotal: number;
    daysElapsed: number;
    daysRemaining: number;
  } | null;
  summary: {
    totalIssues: number;
    completedIssues: number;
    totalPoints: number;
    completedPoints: number;
    remainingPoints: number;
    completionPercent: number;
    averageVelocity: number;
    stalledCount: number;
    overdueCount: number;
    unassignedHighPriorityCount: number;
    wipBreachCount: number;
  };
  burndown: BurndownPointDto[];
  velocity: VelocityItemDto[];
  workload: WorkloadItemDto[];
  stalledIssues: StalledIssueDto[];
  wipBreaches: Array<{
    stateId: string;
    stateName: string;
    wipLimit: number;
    currentCount: number;
  }>;
}

export interface AiInvocationMetaDto {
  mode: "llm" | "smart_fallback";
  provider: string;
  model: string;
  usedByok: boolean;
  quotaRemaining: number | null;
  fallbackReason?: string;
}

export interface AiSettingsDto {
  provider: AiProvider;
  model: string;
  hasByokKey: boolean;
  quota: {
    allowed: boolean;
    used: number;
    limit: number;
    remaining: number;
  };
}

export interface SimulatePrResponseDto {
  simulated: boolean;
  prNumber: string;
  status: ExternalLinkStatus;
  matchedIdentifiers: string[];
  updatedIssues: Array<{
    id: string;
    identifier: string;
    previousStateName: string | null;
    nextStateName: string | null;
    transitioned: boolean;
  }>;
}

// ==============================================
// API Client Methods
// ==============================================

export const api = {
  // Auth & Sandbox
  me: () => request<MeResponse>("/api/v1/me"),

  launchSandbox: () =>
    request<SandboxLaunchResponse>("/api/v1/sandbox", { method: "POST" }),

  signInEmail: (input: { email: string; password: string }) =>
    request<{ user: UserSummary }>("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  signUpEmail: (input: { name: string; email: string; password: string }) =>
    request<{ user: UserSummary }>("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  signOut: () =>
    request<void>("/api/auth/sign-out", { method: "POST", body: "{}" }),

  // Workspaces
  getWorkspace: (workspaceId: string) =>
    request<{ workspace: WorkspaceDetail }>(`/api/v1/workspaces/${workspaceId}`),

  createWorkspace: (input: CreateWorkspaceInput) =>
    request<{ workspace: WorkspaceSummary }>("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  // Projects & Workflow States
  createProject: (workspaceId: string, input: CreateProjectInput) =>
    request<{ project: ProjectSummary; workflowStates: WorkflowStateDto[] }>(
      `/api/v1/workspaces/${workspaceId}/projects`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  getProject: (projectId: string) =>
    request<ProjectDetailResponse>(`/api/v1/projects/${projectId}`),

  createWorkflowState: (projectId: string, input: CreateWorkflowStateInput) =>
    request<{ state: WorkflowStateDto }>(
      `/api/v1/projects/${projectId}/states`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  updateWorkflowState: (
    projectId: string,
    stateId: string,
    input: UpdateWorkflowStateInput,
  ) =>
    request<{ state: WorkflowStateDto }>(
      `/api/v1/projects/${projectId}/states/${stateId}`,
      { method: "PATCH", body: JSON.stringify(input) },
    ),

  deleteWorkflowState: (projectId: string, stateId: string) =>
    request<{ deleted: boolean }>(
      `/api/v1/projects/${projectId}/states/${stateId}`,
      { method: "DELETE" },
    ),

  // Sprints
  getSprints: (projectId: string) =>
    request<{ sprints: SprintDto[] }>(`/api/v1/projects/${projectId}/sprints`),

  createSprint: (projectId: string, input: CreateSprintInput) =>
    request<{ sprint: SprintDto }>(`/api/v1/projects/${projectId}/sprints`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateSprint: (sprintId: string, input: UpdateSprintInput) =>
    request<{ sprint: SprintDto }>(`/api/v1/sprints/${sprintId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  startSprint: (sprintId: string) =>
    request<{ sprint: SprintDto }>(`/api/v1/sprints/${sprintId}/start`, {
      method: "POST",
    }),

  completeSprint: (sprintId: string, input: CompleteSprintInput) =>
    request<{
      sprint: SprintDto;
      completedPoints: number;
      movedIncompleteCount: number;
    }>(`/api/v1/sprints/${sprintId}/complete`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  deleteSprint: (sprintId: string) =>
    request<{ deleted: boolean }>(`/api/v1/sprints/${sprintId}`, {
      method: "DELETE",
    }),

  // Issues
  getIssues: (projectId: string) =>
    request<{ issues: IssueListItem[] }>(
      `/api/v1/projects/${projectId}/issues`,
    ),

  getIssue: (issueId: string) =>
    request<{ issue: IssueDetailDto }>(`/api/v1/issues/${issueId}`),

  createIssue: (projectId: string, input: CreateIssueInput) =>
    request<{ issue: IssueListItem }>(`/api/v1/projects/${projectId}/issues`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateIssue: (issueId: string, input: UpdateIssueInput) =>
    request<{ issue: IssueListItem }>(`/api/v1/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  moveIssue: (issueId: string, input: MoveIssueInput) =>
    request<MoveIssueResponse>(`/api/v1/issues/${issueId}/move`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  deleteIssue: (issueId: string) =>
    request<{ deleted: boolean }>(`/api/v1/issues/${issueId}`, {
      method: "DELETE",
    }),

  createComment: (issueId: string, bodyMd: string) =>
    request<{ comment: { id: string; bodyMd: string; createdAt: string } }>(
      `/api/v1/issues/${issueId}/comments`,
      { method: "POST", body: JSON.stringify({ bodyMd }) },
    ),

  deleteComment: (commentId: string) =>
    request<{ deleted: boolean; id: string }>(
      `/api/v1/comments/${commentId}`,
      { method: "DELETE" },
    ),

  createIssueRelation: (
    issueId: string,
    input: { targetIssueId: string; type: IssueRelationType },
  ) =>
    request<{ relation: { id: string } | null }>(
      `/api/v1/issues/${issueId}/relations`,
      { method: "POST", body: JSON.stringify(input) },
    ),

  deleteIssueRelation: (relationId: string) =>
    request<{ deleted: boolean; id: string }>(
      `/api/v1/issue-relations/${relationId}`,
      { method: "DELETE" },
    ),

  // Sprint Analytics
  getProjectAnalytics: (projectId: string, sprintId?: string | null) => {
    const qs = sprintId ? `?sprintId=${encodeURIComponent(sprintId)}` : "";
    return request<{ analytics: ProjectAnalyticsDto }>(
      `/api/v1/projects/${projectId}/analytics${qs}`,
    );
  },

  // AI Copilot & BYOK Settings
  getAiSettings: (workspaceId: string) =>
    request<{ settings: AiSettingsDto }>(
      `/api/v1/workspaces/${workspaceId}/ai/settings`,
    ),

  updateAiSettings: (workspaceId: string, input: WorkspaceAiSettingsInput) =>
    request<{ settings: AiSettingsDto }>(
      `/api/v1/workspaces/${workspaceId}/ai/settings`,
      { method: "PUT", body: JSON.stringify(input) },
    ),

  generatePrdBreakdown: (input: AIBreakdownRequest) =>
    request<{ breakdown: AIBreakdownResponse; meta: AiInvocationMetaDto }>(
      "/api/v1/ai/prd-breakdown",
      { method: "POST", body: JSON.stringify(input) },
    ),

  commitPrdBreakdown: (input: AICommitBreakdownInput) =>
    request<{
      epic: { id: string; identifier: string; title: string };
      issues: Array<{ id: string; identifier: string; title: string }>;
      relationsCreated: number;
    }>("/api/v1/ai/prd-breakdown/commit", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  analyzeSprintRisk: (input: AISprintRiskRequest) =>
    request<{ report: AISprintRiskReport; meta: AiInvocationMetaDto }>(
      "/api/v1/ai/sprint-risk",
      { method: "POST", body: JSON.stringify(input) },
    ),

  parseNaturalLanguageFilter: (input: AINaturalLanguageFilterRequest) =>
    request<{ filter: NaturalLanguageFilter; meta: AiInvocationMetaDto }>(
      "/api/v1/ai/nl-filter",
      { method: "POST", body: JSON.stringify(input) },
    ),

  // GitHub Smart PR Simulator
  simulateGitHubPr: (projectId: string, input: SimulateGitHubPrInput) =>
    request<SimulatePrResponseDto>(
      `/api/v1/projects/${projectId}/github/simulate-pr`,
      { method: "POST", body: JSON.stringify(input) },
    ),
};
