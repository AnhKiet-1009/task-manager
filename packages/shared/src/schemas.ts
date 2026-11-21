import { z } from "zod";
import {
  EXTERNAL_LINK_STATUSES,
  EXTERNAL_LINK_TYPES,
  EXTERNAL_PROVIDERS,
  ISSUE_PRIORITIES,
  ISSUE_RELATION_TYPES,
  ISSUE_TYPES,
  SPRINT_STATUSES,
  WORKFLOW_STATE_CATEGORIES,
  WORKSPACE_ROLES,
} from "./enums.js";

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải có định dạng YYYY-MM-DD");

const hexColorString = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Mã màu phải có định dạng #RRGGBB");

// ==============================================
// Workspace & Project Schemas
// ==============================================

export const workspaceRoleSchema = z.enum(WORKSPACE_ROLES);

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang"),
});

export const updateWorkspaceSchema = createWorkspaceSchema.partial();

export const updateMemberRoleSchema = z.object({
  role: workspaceRoleSchema,
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(10)
    .regex(/^[A-Z][A-Z0-9]*$/, "Project key phải bắt đầu bằng chữ in hoa (VD: ENG, APP)"),
  description: z.string().trim().max(500).optional(),
  githubRepoFullName: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, "Định dạng repo phải là owner/repo")
    .nullable()
    .optional(),
});

export const updateProjectSchema = createProjectSchema.omit({ key: true }).partial();

export const createWorkflowStateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  category: z.enum(WORKFLOW_STATE_CATEGORIES),
  color: hexColorString.default("#64748b"),
  wipLimit: z.number().int().min(1).max(100).nullable().optional(),
  position: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
});

export const updateWorkflowStateSchema = createWorkflowStateSchema.partial();

export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: hexColorString.default("#6366f1"),
});

// ==============================================
// Sprint & Issue Schemas
// ==============================================

export const createSprintSchema = z.object({
  name: z.string().trim().min(2).max(100),
  goal: z.string().trim().max(500).optional(),
  status: z.enum(SPRINT_STATUSES).default("planned"),
  startDate: isoDateString.optional(),
  endDate: isoDateString.optional(),
});

export const updateSprintSchema = createSprintSchema.partial();

export const completeSprintSchema = z.object({
  moveIncompleteToSprintId: z.string().uuid().nullable().optional(),
});

export const issueListQuerySchema = z.object({
  sprintId: z.string().uuid().optional(),
  backlogOnly: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  stateId: z.string().uuid().optional(),
  type: z.enum(ISSUE_TYPES).optional(),
  priority: z.enum(ISSUE_PRIORITIES).optional(),
  assigneeId: z.string().optional(),
  parentId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
});

export const createIssueSchema = z.object({
  title: z.string().trim().min(2).max(200),
  descriptionMd: z.string().max(20_000).optional(),
  type: z.enum(ISSUE_TYPES).default("task"),
  priority: z.enum(ISSUE_PRIORITIES).default("medium"),
  stateId: z.string().uuid().optional(),
  sprintId: z.string().uuid().nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  storyPoints: z.number().int().min(0).max(100).nullable().optional(),
  estimateHours: z.number().min(0).max(1000).nullable().optional(),
  dueDate: isoDateString.nullable().optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  customProperties: z.record(z.string(), z.unknown()).optional(),
});

export const updateIssueSchema = createIssueSchema.partial();

export const moveIssueSchema = z.object({
  stateId: z.string().uuid(),
  sprintId: z.string().uuid().nullable().optional(),
  prevPosition: z.string().nullable(),
  nextPosition: z.string().nullable(),
});

export const createIssueRelationSchema = z.object({
  targetIssueId: z.string().uuid(),
  type: z.enum(ISSUE_RELATION_TYPES),
});

export const createCommentSchema = z.object({
  bodyMd: z.string().trim().min(1).max(10_000),
});

export const externalLinkSchema = z.object({
  provider: z.enum(EXTERNAL_PROVIDERS),
  externalType: z.enum(EXTERNAL_LINK_TYPES),
  externalId: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(EXTERNAL_LINK_STATUSES),
  url: z.string().url(),
});

// ==============================================
// AI Copilot Structured Output Schemas
// ==============================================

export const aiBreakdownRequestSchema = z.object({
  projectId: z.string().uuid(),
  sprintId: z.string().uuid().nullable().optional(),
  prompt: z.string().trim().min(10).max(15_000),
  maxIssues: z.number().int().min(2).max(20).default(8),
});

export const aiGeneratedIssueSchema = z.object({
  tempId: z.string(),
  title: z.string().min(2).max(200),
  descriptionMd: z.string(),
  type: z.enum(["story", "task", "bug", "subtask"]),
  priority: z.enum(ISSUE_PRIORITIES),
  storyPoints: z.number().int().min(1).max(21),
  blockedByTempIds: z.array(z.string()).default([]),
});

export const aiBreakdownResponseSchema = z.object({
  epic: z.object({
    title: z.string().min(2).max(200),
    descriptionMd: z.string(),
    priority: z.enum(ISSUE_PRIORITIES),
  }),
  issues: z.array(aiGeneratedIssueSchema).min(1),
  rationale: z.string(),
});

export const naturalLanguageFilterSchema = z.object({
  types: z.array(z.enum(ISSUE_TYPES)).optional(),
  priorities: z.array(z.enum(ISSUE_PRIORITIES)).optional(),
  stateCategories: z.array(z.enum(WORKFLOW_STATE_CATEGORIES)).optional(),
  unassignedOnly: z.boolean().optional(),
  overdueOnly: z.boolean().optional(),
  searchQuery: z.string().optional(),
  minStoryPoints: z.number().int().min(0).optional(),
  maxStoryPoints: z.number().int().min(0).optional(),
  explanation: z.string(),
});

export const aiSprintRiskReportSchema = z.object({
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  riskScore: z.number().int().min(0).max(100),
  summary: z.string(),
  stalledIssueIdentifiers: z.array(z.string()),
  recommendations: z.array(z.string()).min(1),
});

export const AI_PROVIDERS = [
  "gemini",
  "groq",
  "openai",
  "anthropic",
  "openrouter",
] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const aiCommitBreakdownSchema = z.object({
  projectId: z.string().uuid(),
  sprintId: z.string().uuid().nullable().optional(),
  epic: aiBreakdownResponseSchema.shape.epic,
  issues: z.array(aiGeneratedIssueSchema).min(1).max(25),
});

export const aiNaturalLanguageFilterRequestSchema = z.object({
  projectId: z.string().uuid(),
  query: z.string().trim().min(2).max(500),
});

export const aiSprintRiskRequestSchema = z.object({
  projectId: z.string().uuid(),
  sprintId: z.string().uuid(),
});

export const workspaceAiSettingsSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  model: z.string().trim().max(80).optional(),
  apiKey: z.string().trim().min(8).max(300).optional(),
  clearKey: z.boolean().optional(),
});

export const simulateGitHubPrSchema = z.object({
  issueIdentifier: z.string().trim().min(2).max(24),
  action: z.enum(["opened", "ready_for_review", "merged", "closed"]),
  prNumber: z.number().int().min(1).max(999_999).optional(),
  prTitle: z.string().trim().min(3).max(200).optional(),
});

// ==============================================
// Realtime Event Stream Schema
// ==============================================

export const realtimeEventSchema = z.object({
  id: z.string(),
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  type: z.enum([
    "issue.created",
    "issue.updated",
    "issue.moved",
    "issue.deleted",
    "sprint.updated",
    "comment.created",
    "github.pr_synced",
    "heartbeat",
  ]),
  actorId: z.string().nullable(),
  timestamp: z.number(),
  payload: z.record(z.string(), z.unknown()),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateWorkflowStateInput = z.infer<typeof createWorkflowStateSchema>;
export type UpdateWorkflowStateInput = z.infer<typeof updateWorkflowStateSchema>;
export type CreateLabelInput = z.infer<typeof createLabelSchema>;
export type CreateSprintInput = z.infer<typeof createSprintSchema>;
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;
export type CompleteSprintInput = z.infer<typeof completeSprintSchema>;
export type IssueListQuery = z.infer<typeof issueListQuerySchema>;
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type MoveIssueInput = z.infer<typeof moveIssueSchema>;
export type AIBreakdownRequest = z.infer<typeof aiBreakdownRequestSchema>;
export type AIBreakdownResponse = z.infer<typeof aiBreakdownResponseSchema>;
export type AICommitBreakdownInput = z.infer<typeof aiCommitBreakdownSchema>;
export type AINaturalLanguageFilterRequest = z.infer<
  typeof aiNaturalLanguageFilterRequestSchema
>;
export type AISprintRiskRequest = z.infer<typeof aiSprintRiskRequestSchema>;
export type WorkspaceAiSettingsInput = z.infer<typeof workspaceAiSettingsSchema>;
export type SimulateGitHubPrInput = z.infer<typeof simulateGitHubPrSchema>;
export type NaturalLanguageFilter = z.infer<typeof naturalLanguageFilterSchema>;
export type AISprintRiskReport = z.infer<typeof aiSprintRiskReportSchema>;
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
