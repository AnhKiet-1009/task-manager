import { QueryClient } from "@tanstack/react-query";
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";
import { del, get, set } from "idb-keyval";
import { ApiError } from "./api";

const IDB_CACHE_KEY = "TASKMANAGER_AGILE_QUERY_CACHE_V1";

export const queryKeys = {
  me: ["me"] as const,
  workspace: (workspaceId: string) => ["workspace", workspaceId] as const,
  project: (projectId: string) => ["project", projectId] as const,
  sprints: (projectId: string) => ["sprints", projectId] as const,
  issues: (projectId: string) => ["issues", projectId] as const,
  issue: (issueId: string) => ["issue", issueId] as const,
  analytics: (projectId: string, sprintId?: string | null) =>
    ["analytics", projectId, sprintId ?? "auto"] as const,
  aiSettings: (workspaceId: string) => ["ai-settings", workspaceId] as const,
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 1000 * 60 * 60 * 12,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          if (
            error instanceof ApiError &&
            [400, 401, 403, 404, 409].includes(error.status)
          ) {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
  });
}

/**
 * IndexedDB persister for instant startup cache (gracefully degrades if
 * IndexedDB is unavailable, e.g., inside JSDOM or private mode).
 */
export function createIdbPersister(): Persister {
  const hasIdb = typeof indexedDB !== "undefined";

  return {
    persistClient: async (client: PersistedClient) => {
      if (!hasIdb) return;
      try {
        await set(IDB_CACHE_KEY, client);
      } catch {
        // Ignore storage quota or private-mode errors
      }
    },
    restoreClient: async () => {
      if (!hasIdb) return undefined;
      try {
        return await get<PersistedClient>(IDB_CACHE_KEY);
      } catch {
        return undefined;
      }
    },
    removeClient: async () => {
      if (!hasIdb) return;
      try {
        await del(IDB_CACHE_KEY);
      } catch {
        // Ignore
      }
    },
  };
}
