export const WORKSPACE_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const WORKSPACE_ROLE_WEIGHT: Record<WorkspaceRole, number> = {
  viewer: 1,
  member: 2,
  admin: 3,
  owner: 4,
};

export function hasMinimumRole(
  actual: WorkspaceRole,
  required: WorkspaceRole,
): boolean {
  return WORKSPACE_ROLE_WEIGHT[actual] >= WORKSPACE_ROLE_WEIGHT[required];
}

export const WORKFLOW_STATE_CATEGORIES = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "canceled",
] as const;
export type WorkflowStateCategory = (typeof WORKFLOW_STATE_CATEGORIES)[number];

export const ISSUE_TYPES = [
  "epic",
  "story",
  "task",
  "bug",
  "subtask",
] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_PRIORITIES = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const SPRINT_STATUSES = ["planned", "active", "completed"] as const;
export type SprintStatus = (typeof SPRINT_STATUSES)[number];

export const ISSUE_RELATION_TYPES = [
  "blocks",
  "blocked_by",
  "relates_to",
  "duplicates",
] as const;
export type IssueRelationType = (typeof ISSUE_RELATION_TYPES)[number];

export const EXTERNAL_PROVIDERS = ["github", "gitlab"] as const;
export type ExternalProvider = (typeof EXTERNAL_PROVIDERS)[number];

export const EXTERNAL_LINK_TYPES = ["pr", "branch", "commit"] as const;
export type ExternalLinkType = (typeof EXTERNAL_LINK_TYPES)[number];

export const EXTERNAL_LINK_STATUSES = [
  "open",
  "draft",
  "merged",
  "closed",
] as const;
export type ExternalLinkStatus = (typeof EXTERNAL_LINK_STATUSES)[number];

export const ACTIVITY_ACTIONS = [
  "issue_created",
  "state_changed",
  "sprint_moved",
  "assignee_changed",
  "priority_changed",
  "points_changed",
  "pr_linked",
  "pr_merged",
  "comment_added",
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const STORY_POINT_SCALE = [1, 2, 3, 5, 8, 13, 21] as const;

export const DEFAULT_WORKFLOW_STATES: ReadonlyArray<{
  name: string;
  category: WorkflowStateCategory;
  color: string;
  wipLimit: number | null;
  isDefault: boolean;
}> = [
  {
    name: "Backlog",
    category: "backlog",
    color: "#94a3b8",
    wipLimit: null,
    isDefault: false,
  },
  {
    name: "Todo",
    category: "unstarted",
    color: "#64748b",
    wipLimit: null,
    isDefault: true,
  },
  {
    name: "In Progress",
    category: "started",
    color: "#3b82f6",
    wipLimit: 5,
    isDefault: false,
  },
  {
    name: "In Review",
    category: "started",
    color: "#8b5cf6",
    wipLimit: 4,
    isDefault: false,
  },
  {
    name: "Done",
    category: "completed",
    color: "#10b981",
    wipLimit: null,
    isDefault: false,
  },
];
