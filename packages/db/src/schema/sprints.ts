import { SPRINT_STATUSES } from "@taskmanager/shared";
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { projects } from "./projects.js";

export const sprintStatusEnum = pgEnum("sprint_status", SPRINT_STATUSES);

export const sprints = pgTable(
  "sprints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    goal: text("goal"),
    status: sprintStatusEnum("status").notNull().default("planned"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    velocitySnapshot: integer("velocity_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sprints_project_status").on(table.projectId, table.status),
  ],
);
