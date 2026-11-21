import { lazy, Suspense, useEffect, useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FolderPlus, Loader2, Sparkles } from "lucide-react";
import { ToastStack } from "./components/ui/ToastStack";
import { AiSettingsModal } from "./features/ai/AiSettingsModal";
import { PrdBreakdownModal } from "./features/ai/PrdBreakdownModal";
import { AuthScreen } from "./features/auth/AuthScreen";
import { BacklogSprintView } from "./features/backlog/BacklogSprintView";
import { CompleteSprintModal } from "./features/backlog/CompleteSprintModal";
import { SprintModal } from "./features/backlog/SprintModal";
import { AgileKanbanBoard } from "./features/board/AgileKanbanBoard";
import { WorkflowStateModal } from "./features/board/WorkflowStateModal";
import { CommandPalette } from "./features/command/CommandPalette";
import { EpicsView } from "./features/epics/EpicsView";
import { IssueDetailDrawer } from "./features/issues/IssueDetailDrawer";
import { IssueModal } from "./features/issues/IssueModal";
import { Sidebar } from "./features/layout/Sidebar";
import { TopBar } from "./features/layout/TopBar";
import { WorkspaceProjectModal } from "./features/layout/WorkspaceProjectModal";
import {
  useLaunchSandbox,
  useMe,
  useProject,
  useProjectIssues,
  useSprints,
  useWorkspace,
} from "./hooks/useAgileQueries";
import { useTheme } from "./hooks/useTheme";
import { useWorkspaceRealtime } from "./hooks/useWorkspaceRealtime";
import type { MeResponse } from "./lib/api";
import { createQueryClient } from "./lib/queryClient";
import { useUiStore } from "./stores/uiStore";

const AnalyticsDashboard = lazy(() =>
  import("./features/analytics/AnalyticsDashboard").then((m) => ({
    default: m.AnalyticsDashboard,
  })),
);

function AgileWorkspaceShell({ me }: { me: MeResponse }) {
  const activeWorkspaceId = useUiStore((s) => s.activeWorkspaceId);
  const activeProjectId = useUiStore((s) => s.activeProjectId);
  const activeView = useUiStore((s) => s.activeView);
  const boardSprintId = useUiStore((s) => s.boardSprintId);
  const setActiveWorkspaceId = useUiStore((s) => s.setActiveWorkspaceId);
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const setBoardSprintId = useUiStore((s) => s.setBoardSprintId);
  const openWorkspaceProjectModal = useUiStore(
    (s) => s.openWorkspaceProjectModal,
  );

  const launchSandbox = useLaunchSandbox();

  const activeWorkspace =
    me.workspaces.find((w) => w.id === activeWorkspaceId) ??
    me.workspaces[0] ??
    null;

  // Keep activeWorkspaceId & activeProjectId synchronized with available data
  useEffect(() => {
    if (activeWorkspace && activeWorkspace.id !== activeWorkspaceId) {
      setActiveWorkspaceId(activeWorkspace.id);
    }
  }, [activeWorkspace, activeWorkspaceId, setActiveWorkspaceId]);

  const resolvedProjectId =
    activeWorkspace?.projects.find((p) => p.id === activeProjectId)?.id ??
    activeWorkspace?.projects[0]?.id ??
    null;

  useEffect(() => {
    if (resolvedProjectId && resolvedProjectId !== activeProjectId) {
      setActiveProjectId(resolvedProjectId);
    }
  }, [resolvedProjectId, activeProjectId, setActiveProjectId]);

  const workspaceQuery = useWorkspace(activeWorkspace?.id ?? null);
  const projectQuery = useProject(resolvedProjectId);
  const sprintsQuery = useSprints(resolvedProjectId);
  const issuesQuery = useProjectIssues(resolvedProjectId);

  useWorkspaceRealtime({
    workspaceId: activeWorkspace?.id ?? null,
    projectId: resolvedProjectId,
    currentUserId: me.user.id,
  });

  const sprints = useMemo(
    () => sprintsQuery.data ?? projectQuery.data?.sprints ?? [],
    [sprintsQuery.data, projectQuery.data?.sprints],
  );
  const issues = issuesQuery.data ?? [];
  const workflowStates = projectQuery.data?.workflowStates ?? [];
  const labels = projectQuery.data?.labels ?? [];
  const members = workspaceQuery.data?.members ?? [];
  const role = projectQuery.data?.role ?? activeWorkspace?.role ?? "viewer";

  // Auto-select Active Sprint on Board when entering a project
  useEffect(() => {
    if (!resolvedProjectId || sprints.length === 0) return;
    if (boardSprintId === null) {
      const activeSprint = sprints.find((s) => s.status === "active");
      setBoardSprintId(activeSprint?.id ?? "all");
    }
  }, [resolvedProjectId, sprints, boardSprintId, setBoardSprintId]);

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Sidebar
        user={me.user}
        workspaces={me.workspaces}
        activeWorkspace={activeWorkspace}
        activeProjectId={resolvedProjectId}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {!activeWorkspace ? (
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <FolderPlus className="w-6 h-6" />
              </div>
              <h1 className="text-lg font-extrabold">
                Chào mừng, {me.user.name}!
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bạn chưa thuộc Workspace nào. Hãy tạo Workspace đầu tiên cho đội
                ngũ của bạn hoặc mở Demo Sandbox để trải nghiệm sẵn dữ liệu
                Agile.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
                <button
                  type="button"
                  onClick={() => openWorkspaceProjectModal("workspace")}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Tạo Workspace mới
                </button>
                <button
                  type="button"
                  onClick={() => launchSandbox.mutate()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Mở Demo Sandbox
                </button>
              </div>
            </div>
          </main>
        ) : !resolvedProjectId ? (
          <main className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center space-y-4">
              <h1 className="text-base font-bold">
                Workspace "{activeWorkspace.name}" chưa có Project nào
              </h1>
              <p className="text-xs text-slate-500">
                Tạo Project đầu tiên (tự động khởi tạo 5 cột trạng thái Agile &
                LexoRank).
              </p>
              <button
                type="button"
                onClick={() => openWorkspaceProjectModal("project")}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                + Tạo Project đầu tiên
              </button>
            </div>
          </main>
        ) : (
          <>
            <TopBar
              projectDetail={projectQuery.data}
              sprints={sprints}
              role={role}
            />

            <main className="flex-1 min-w-0">
              {projectQuery.isLoading || issuesQuery.isLoading ? (
                <div className="py-24 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tải không gian làm việc Agile...
                </div>
              ) : activeView === "board" ? (
                <AgileKanbanBoard
                  projectId={resolvedProjectId}
                  role={role}
                  workflowStates={workflowStates}
                  sprints={sprints}
                  issues={issues}
                />
              ) : activeView === "backlog" ? (
                <BacklogSprintView
                  projectId={resolvedProjectId}
                  role={role}
                  sprints={sprints}
                  issues={issues}
                />
              ) : activeView === "analytics" ? (
                <Suspense
                  fallback={
                    <div className="py-24 flex items-center justify-center gap-2 text-xs text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang tải Sprint Analytics & AI Risk Radar...
                    </div>
                  }
                >
                  <AnalyticsDashboard
                    projectId={resolvedProjectId}
                    role={role}
                    sprints={sprints}
                    issues={issues}
                  />
                </Suspense>
              ) : (
                <EpicsView role={role} issues={issues} />
              )}
            </main>
          </>
        )}
      </div>

      {/* Global Modals, Deep Issue Drawer & Command Palette */}
      <IssueDetailDrawer
        projectId={resolvedProjectId}
        role={role}
        currentUserId={me.user.id}
        workflowStates={workflowStates}
        sprints={sprints}
        labels={labels}
        members={members}
        allIssues={issues}
      />
      <IssueModal
        projectId={resolvedProjectId}
        role={role}
        workflowStates={workflowStates}
        sprints={sprints}
        labels={labels}
        members={members}
        allIssues={issues}
      />
      <SprintModal projectId={resolvedProjectId} />
      <CompleteSprintModal
        projectId={resolvedProjectId}
        sprints={sprints}
        issues={issues}
      />
      <WorkflowStateModal projectId={resolvedProjectId} />
      <WorkspaceProjectModal workspaceId={activeWorkspace?.id ?? null} />
      <PrdBreakdownModal projectId={resolvedProjectId} sprints={sprints} />
      <AiSettingsModal workspaceId={activeWorkspace?.id ?? null} role={role} />
      <CommandPalette issues={issues} role={role} />
    </div>
  );
}

function AgileAppContent() {
  // Initialize theme class on <html>
  useTheme();
  const meQuery = useMe();

  if (meQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center gap-2.5 text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        Đang kết nối phiên làm việc...
      </div>
    );
  }

  if (meQuery.isError || !meQuery.data?.user) {
    return (
      <>
        <AuthScreen />
        <ToastStack />
      </>
    );
  }

  return (
    <>
      <AgileWorkspaceShell me={meQuery.data} />
      <ToastStack />
    </>
  );
}

interface AppProps {
  queryClient?: QueryClient;
}

const fallbackClient = createQueryClient();

export function App({ queryClient }: AppProps) {
  if (queryClient) {
    return (
      <QueryClientProvider client={queryClient}>
        <AgileAppContent />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={fallbackClient}>
      <AgileAppContent />
    </QueryClientProvider>
  );
}

export { AgileAppContent };
export default App;
