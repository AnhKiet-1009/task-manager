import {
  ACTIVITY_ACTIONS,
  EXTERNAL_LINK_STATUSES,
  EXTERNAL_LINK_TYPES,
  EXTERNAL_PROVIDERS,
  ISSUE_PRIORITIES,
  ISSUE_RELATION_TYPES,
  ISSUE_TYPES,
} from "@taskmanager/shared";
import {
  type AnyPgColumn,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { labels, projects, workflowStates } from "./projects.js";
import { sprints } from "./sprints.js";
import { workspaces } from "./workspaces.js";

export const issueTypeEnum = pgEnum("issue_type", ISSUE_TYPES);
export const issuePriorityEnum = pgEnum("issue_priority", ISSUE_PRIORITIES);
export const issueRelationTypeEnum = pgEnum(
  "issue_relation_type",
  ISSUE_RELATION_TYPES,
);
export const activityActionEnum = pgEnum("activity_action", ACTIVITY_ACTIONS);
export const externalProviderEnum = pgEnum(
  "external_provider",
  EXTERNAL_PROVIDERS,
);
export const externalLinkTypeEnum = pgEnum(
  "external_link_type",
  EXTERNAL_LINK_TYPES,
);
export const externalLinkStatusEnum = pgEnum(
  "external_link_status",
  EXTERNAL_LINK_STATUSES,
);

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    identifier: varchar("identifier", { length: 24 }).notNull(),
    type: issueTypeEnum("type").notNull().default("task"),
    parentId: uuid("parent_id").references((): AnyPgColumn => issues.id, {
      onDelete: "set null",
    }),
    sprintId: uuid("sprint_id").references(() => sprints.id, {
      onDelete: "set null",
    }),
    stateId: uuid("state_id")
      .notNull()
      .references(() => workflowStates.id, { onDelete: "restrict" }),
    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reporterId: text("reporter_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: varchar("title", { length: 200 }).notNull(),
    descriptionMd: text("description_md"),
    priority: issuePriorityEnum("priority").notNull().default("medium"),
    storyPoints: integer("story_points"),
    estimateHours: real("estimate_hours"),
    position: text("position").notNull(),
    dueDate: date("due_date"),
    customProperties: jsonb("custom_properties")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_issues_project_identifier").on(
      table.projectId,
      table.identifier,
    ),
    index("idx_issues_board_query").on(
      table.projectId,
      table.sprintId,
      table.stateId,
      table.position,
    ),
    index("idx_issues_parent").on(table.parentId),
    index("idx_issues_assignee").on(table.assigneeId),
  ],
);

export const issueLabels = pgTable(
  "issue_labels",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.issueId, table.labelId] })],
);

export const issueRelations = pgTable(
  "issue_relations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceIssueId: uuid("source_issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    targetIssueId: uuid("target_issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    type: issueRelationTypeEnum("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_issue_relations_edge").on(
      table.sourceIssueId,
      table.targetIssueId,
      table.type,
    ),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    bodyMd: text("body_md").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_comments_issue_created").on(table.issueId, table.createdAt)],
);

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id").references(() => issues.id, {
      onDelete: "cascade",
    }),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: activityActionEnum("action").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_activity_logs_issue_time").on(table.issueId, table.createdAt),
    index("idx_activity_logs_project_time").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

export const externalLinks = pgTable(
  "external_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    provider: externalProviderEnum("provider").notNull().default("github"),
    externalType: externalLinkTypeEnum("external_type").notNull(),
    externalId: varchar("external_id", { length: 120 }).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    status: externalLinkStatusEnum("status").notNull().default("open"),
    url: text("url").notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_external_links_issue_ref").on(
      table.issueId,
      table.provider,
      table.externalType,
      table.externalId,
    ),
  ],
);
