import type { AppDatabase } from "@taskmanager/db";
import type { WorkspaceRole } from "@taskmanager/shared";
import type { AppAuth, AuthSession, AuthUser } from "../lib/auth.js";
import type { RealtimeEventBus } from "../realtime/event-bus.js";

export interface AppVariables {
  db: AppDatabase;
  auth: AppAuth;
  eventBus: RealtimeEventBus;
  user: AuthUser | null;
  session: AuthSession | null;
  workspaceId?: string;
  workspaceRole?: WorkspaceRole;
}

export interface AppEnv {
  Variables: AppVariables;
}
