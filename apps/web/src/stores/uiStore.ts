import type { IssueType } from "@taskmanager/shared";
import { create } from "zustand";
import type { SprintDto, WorkflowStateDto } from "../lib/api";
import type { IssueFilterValues } from "../lib/agileMeta";

export type AgileView = "board" | "backlog" | "epics";
export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting";

export interface ToastItem {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

export interface IssueModalState {
  open: boolean;
  mode: "create" | "edit";
  issueId?: string;
  defaultStateId?: string;
  defaultSprintId?: string | null;
  defaultType?: IssueType;
  defaultParentId?: string | null;
}

const DEFAULT_FILTERS: IssueFilterValues = {
  search: "",
  priority: "all",
  type: "all",
  assigneeId: "all",
};

interface UiStore {
  activeWorkspaceId: string | null;
  activeProjectId: string | null;
  activeView: AgileView;
  boardSprintId: string | "all" | null;
  sidebarOpen: boolean;

  filters: IssueFilterValues;

  realtimeStatus: RealtimeStatus;
  issueDrawerId: string | null;
  issueModal: IssueModalState;
  sprintModal: { open: boolean; sprint?: SprintDto };
  completeSprintId: string | null;
  workflowStateModal: { open: boolean; state?: WorkflowStateDto };
  workspaceProjectModal: { open: boolean; mode: "workspace" | "project" };
  commandPaletteOpen: boolean;

  toasts: ToastItem[];

  setActiveWorkspaceId: (id: string | null) => void;
  setActiveProjectId: (id: string | null) => void;
  setActiveView: (view: AgileView) => void;
  setBoardSprintId: (id: string | "all" | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setRealtimeStatus: (status: RealtimeStatus) => void;

  setFilters: (partial: Partial<IssueFilterValues>) => void;
  resetFilters: () => void;

  openCreateIssueModal: (defaults?: {
    stateId?: string;
    sprintId?: string | null;
    type?: IssueType;
    parentId?: string | null;
  }) => void;
  openEditIssueModal: (issueId: string) => void;
  openIssueDrawer: (issueId: string) => void;
  closeIssueDrawer: () => void;
  closeIssueModal: () => void;

  openSprintModal: (sprint?: SprintDto) => void;
  closeSprintModal: () => void;
  setCompleteSprintId: (sprintId: string | null) => void;

  openWorkflowStateModal: (state?: WorkflowStateDto) => void;
  closeWorkflowStateModal: () => void;

  openWorkspaceProjectModal: (mode: "workspace" | "project") => void;
  closeWorkspaceProjectModal: () => void;

  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;

  pushToast: (message: string, type?: ToastItem["type"]) => void;
  dismissToast: (id: string) => void;
  resetSessionState: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  activeWorkspaceId: null,
  activeProjectId: null,
  activeView: "board",
  boardSprintId: null,
  sidebarOpen: false,

  filters: DEFAULT_FILTERS,

  realtimeStatus: "idle",
  issueDrawerId: null,
  issueModal: { open: false, mode: "create" },
  sprintModal: { open: false },
  completeSprintId: null,
  workflowStateModal: { open: false },
  workspaceProjectModal: { open: false, mode: "project" },
  commandPaletteOpen: false,

  toasts: [],

  setActiveWorkspaceId: (id) =>
    set({
      activeWorkspaceId: id,
      activeProjectId: null,
      boardSprintId: null,
      issueDrawerId: null,
    }),
  setActiveProjectId: (id) =>
    set({
      activeProjectId: id,
      boardSprintId: null,
      filters: DEFAULT_FILTERS,
      issueDrawerId: null,
    }),
  setActiveView: (view) => set({ activeView: view, sidebarOpen: false }),
  setBoardSprintId: (id) => set({ boardSprintId: id }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setRealtimeStatus: (realtimeStatus) => set({ realtimeStatus }),

  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),
  resetFilters: () => set({ filters: DEFAULT_FILTERS }),

  openCreateIssueModal: (defaults) =>
    set({
      issueModal: {
        open: true,
        mode: "create",
        defaultStateId: defaults?.stateId,
        defaultSprintId: defaults?.sprintId,
        defaultType: defaults?.type ?? "task",
        defaultParentId: defaults?.parentId ?? null,
      },
    }),
  openEditIssueModal: (issueId) => set({ issueDrawerId: issueId }),
  openIssueDrawer: (issueId) => set({ issueDrawerId: issueId }),
  closeIssueDrawer: () => set({ issueDrawerId: null }),
  closeIssueModal: () =>
    set({ issueModal: { open: false, mode: "create" } }),

  openSprintModal: (sprint) => set({ sprintModal: { open: true, sprint } }),
  closeSprintModal: () => set({ sprintModal: { open: false } }),
  setCompleteSprintId: (sprintId) => set({ completeSprintId: sprintId }),

  openWorkflowStateModal: (state) =>
    set({ workflowStateModal: { open: true, state } }),
  closeWorkflowStateModal: () => set({ workflowStateModal: { open: false } }),

  openWorkspaceProjectModal: (mode) =>
    set({ workspaceProjectModal: { open: true, mode } }),
  closeWorkspaceProjectModal: () =>
    set((s) => ({
      workspaceProjectModal: { ...s.workspaceProjectModal, open: false },
    })),

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () =>
    set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

  pushToast: (message, type = "info") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, type }] }));
    window.setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4500);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  resetSessionState: () =>
    set({
      activeWorkspaceId: null,
      activeProjectId: null,
      activeView: "board",
      boardSprintId: null,
      realtimeStatus: "idle",
      issueDrawerId: null,
      filters: DEFAULT_FILTERS,
      issueModal: { open: false, mode: "create" },
      commandPaletteOpen: false,
    }),
}));
