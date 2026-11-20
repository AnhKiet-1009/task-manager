import { relations } from "drizzle-orm";
import { aiUsageLogs } from "./ai.js";
import { users } from "./auth.js";
import {
  activityLogs,
  comments,
  externalLinks,
  issueLabels,
  issueRelations,
  issues,
} from "./issues.js";
import { labels, projects, workflowStates } from "./projects.js";
import { sprints } from "./sprints.js";
import { workspaceMembers, workspaces } from "./workspaces.js";

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  projects: many(projects),
  aiUsageLogs: many(aiUsageLogs),
}));

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceMembers.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [workspaceMembers.userId],
      references: [users.id],
    }),
  }),
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  workflowStates: many(workflowStates),
  sprints: many(sprints),
  issues: many(issues),
  labels: many(labels),
}));

export const workflowStatesRelations = relations(
  workflowStates,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [workflowStates.projectId],
      references: [projects.id],
    }),
    issues: many(issues),
  }),
);

export const sprintsRelations = relations(sprints, ({ one, many }) => ({
  project: one(projects, {
    fields: [sprints.projectId],
    references: [projects.id],
  }),
  issues: many(issues),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  state: one(workflowStates, {
    fields: [issues.stateId],
    references: [workflowStates.id],
  }),
  sprint: one(sprints, {
    fields: [issues.sprintId],
    references: [sprints.id],
  }),
  parent: one(issues, {
    fields: [issues.parentId],
    references: [issues.id],
    relationName: "issue_hierarchy",
  }),
  children: many(issues, { relationName: "issue_hierarchy" }),
  assignee: one(users, {
    fields: [issues.assigneeId],
    references: [users.id],
    relationName: "issue_assignee",
  }),
  reporter: one(users, {
    fields: [issues.reporterId],
    references: [users.id],
    relationName: "issue_reporter",
  }),
  issueLabels: many(issueLabels),
  outgoingRelations: many(issueRelations, {
    relationName: "relation_source",
  }),
  incomingRelations: many(issueRelations, {
    relationName: "relation_target",
  }),
  comments: many(comments),
  activityLogs: many(activityLogs),
  externalLinks: many(externalLinks),
}));

export const issueLabelsRelations = relations(issueLabels, ({ one }) => ({
  issue: one(issues, {
    fields: [issueLabels.issueId],
    references: [issues.id],
  }),
  label: one(labels, {
    fields: [issueLabels.labelId],
    references: [labels.id],
  }),
}));

export const issueRelationsTableRelations = relations(
  issueRelations,
  ({ one }) => ({
    sourceIssue: one(issues, {
      fields: [issueRelations.sourceIssueId],
      references: [issues.id],
      relationName: "relation_source",
    }),
    targetIssue: one(issues, {
      fields: [issueRelations.targetIssueId],
      references: [issues.id],
      relationName: "relation_target",
    }),
  }),
);

export const commentsRelations = relations(comments, ({ one }) => ({
  issue: one(issues, {
    fields: [comments.issueId],
    references: [issues.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));

export const externalLinksRelations = relations(externalLinks, ({ one }) => ({
  issue: one(issues, {
    fields: [externalLinks.issueId],
    references: [issues.id],
  }),
}));
