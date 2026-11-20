import type {
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
  IssueType,
  MoveIssueInput,
  SprintStatus,
  UpdateIssueInput,
  UpdateSprintInput,
  UpdateWorkflowStateInput,
  WorkflowStateCategory,
  WorkspaceRole,
} from "@taskmanager/shared";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

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
};
