import { WORKSPACE_ROLES } from "@taskmanager/shared";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./auth.js";

export const workspaceRoleEnum = pgEnum("workspace_role", WORKSPACE_ROLES);

export interface EncryptedAiSettings {
  provider: "gemini" | "groq" | "openai" | "anthropic" | "openrouter";
  model?: string;
  encryptedApiKey?: string;
  iv?: string;
  authTag?: string;
}

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 60 }).notNull().unique(),
    isSandbox: boolean("is_sandbox").notNull().default(false),
    sandboxExpiresAt: timestamp("sandbox_expires_at", { withTimezone: true }),
    aiSettingsEncrypted: jsonb("ai_settings_encrypted").$type<EncryptedAiSettings | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_workspaces_sandbox_expiry").on(
      table.isSandbox,
      table.sandboxExpiresAt,
    ),
  ],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_workspace_members_workspace_user").on(
      table.workspaceId,
      table.userId,
    ),
    index("idx_workspace_members_user").on(table.userId),
  ],
);
