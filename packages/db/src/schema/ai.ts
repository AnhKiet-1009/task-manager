import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";
import { workspaces } from "./workspaces.js";

/**
 * Tracks AI Copilot invocations per workspace for $0 free-tier rate limiting
 * and future commercial credit metering.
 */
export const aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    feature: varchar("feature", { length: 50 }).notNull(),
    provider: varchar("provider", { length: 40 }).notNull(),
    model: varchar("model", { length: 80 }).notNull(),
    usedByok: boolean("used_byok").notNull().default(false),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_ai_usage_workspace_time").on(table.workspaceId, table.createdAt),
  ],
);
