import type { AppDatabase } from "@taskmanager/db";
import type { AiProvider, WorkspaceRole } from "@taskmanager/shared";
import type { AppAuth, AuthSession, AuthUser } from "../lib/auth.js";
import type { RealtimeEventBus } from "../realtime/event-bus.js";

export interface AppRuntimeConfig {
  aiProvider: AiProvider;
  geminiApiKey?: string;
  groqApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  openrouterApiKey?: string;
  byokEncryptionKey: string;
  githubWebhookSecret?: string;
  upstashRedisRestUrl?: string;
  upstashRedisRestToken?: string;
}

export interface AppVariables {
  db: AppDatabase;
  auth: AppAuth;
  eventBus: RealtimeEventBus;
  config: AppRuntimeConfig;
  user: AuthUser | null;
  session: AuthSession | null;
  workspaceId?: string;
  workspaceRole?: WorkspaceRole;
}

export interface AppEnv {
  Variables: AppVariables;
}
