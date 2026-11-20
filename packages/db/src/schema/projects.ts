import { WORKFLOW_STATE_CATEGORIES } from "@taskmanager/shared";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces.js";

export const workflowStateCategoryEnum = pgEnum(
  "workflow_state_category",
  WORKFLOW_STATE_CATEGORIES,
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 10 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    description: text("description"),
    issueSequence: integer("issue_sequence").notNull().default(0),
    githubRepoFullName: varchar("github_repo_full_name", { length: 200 }),
    githubWebhookId: varchar("github_webhook_id", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_projects_workspace_key").on(table.workspaceId, table.key),
    index("idx_projects_github_repo").on(table.githubRepoFullName),
  ],
);

export const workflowStates = pgTable(
  "workflow_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    category: workflowStateCategoryEnum("category").notNull(),
    color: varchar("color", { length: 7 }).notNull().default("#64748b"),
    wipLimit: integer("wip_limit"),
    position: text("position").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_workflow_states_project_pos").on(
      table.projectId,
      table.position,
    ),
  ],
);

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 40 }).notNull(),
    color: varchar("color", { length: 7 }).notNull().default("#6366f1"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_labels_project_name").on(table.projectId, table.name),
  ],
);
