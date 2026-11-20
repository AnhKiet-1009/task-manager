import { hasMinimumRole } from "@taskmanager/shared";
import {
  BarChart3,
  FolderKanban,
  Kanban,
  Layers,
  LogOut,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Target,
  X,
  Zap,
} from "lucide-react";
import { useSignOut } from "../../hooks/useAgileQueries";
import { useTheme } from "../../hooks/useTheme";
import { getInitials, ROLE_LABEL } from "../../lib/agileMeta";
import type { UserSummary, WorkspaceSummary } from "../../lib/api";
import { type AgileView, useUiStore } from "../../stores/uiStore";

interface SidebarProps {
  user: UserSummary;
  workspaces: WorkspaceSummary[];
  activeWorkspace: WorkspaceSummary | null;
  activeProjectId: string | null;
}

export function Sidebar({
  user,
  workspaces,
  activeWorkspace,
  activeProjectId,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const signOut = useSignOut();

  const activeView = useUiStore((s) => s.activeView);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setActiveWorkspaceId = useUiStore((s) => s.setActiveWorkspaceId);
  const setActiveProjectId = useUiStore((s) => s.setActiveProjectId);
  const setActiveView = useUiStore((s) => s.setActiveView);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const openWorkspaceProjectModal = useUiStore(
    (s) => s.openWorkspaceProjectModal,
  );

  const canManageProjects = activeWorkspace
    ? hasMinimumRole(activeWorkspace.role, "admin")
    : false;

  const navItems: Array<{
    id: AgileView;
    label: string;
    icon: typeof Kanban;
  }> = [
    { id: "board", label: "Active Sprint Board", icon: Kanban },
    { id: "backlog", label: "Backlog & Sprints", icon: Layers },
    { id: "epics", label: "Epics Roadmap", icon: Target },
  ];

  const sidebarContent = (
    <aside className="flex flex-col h-full w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 select-none">
      {/* Brand + Workspace Switcher */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Zap className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-sm tracking-tight">
              TaskManager
            </span>
            {activeWorkspace?.isSandbox && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Sandbox
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Đóng thanh điều hướng"
            className="lg:hidden p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <select
            aria-label="Chọn Workspace"
            value={activeWorkspace?.id ?? ""}
            onChange={(e) => setActiveWorkspaceId(e.target.value)}
            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            title="Tạo Workspace mới"
            aria-label="Tạo Workspace mới"
            onClick={() => openWorkspaceProjectModal("workspace")}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Agile Views */}
      <div className="p-3 space-y-1">
        <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Không gian Agile
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              aria-current={active ? "page" : undefined}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                active
                  ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Upcoming Phase 4 preview */}
        <div
          title="Sẽ mở khóa ở Giai đoạn 4"
          className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-400 dark:text-slate-500 cursor-not-allowed"
        >
          <span className="flex items-center gap-2.5">
            <BarChart3 className="w-4 h-4" />
            Analytics & AI Radar
          </span>
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-100/70 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
            <Sparkles className="w-2.5 h-2.5" />
            P4
          </span>
        </div>
      </div>

      {/* Projects List */}
      <div className="px-3 pt-2 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-2 pb-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Dự án ({activeWorkspace?.projects.length ?? 0})
          </p>
          {canManageProjects && (
            <button
              type="button"
              onClick={() => openWorkspaceProjectModal("project")}
              title="Tạo Project mới"
              aria-label="Tạo Project mới"
              className="p-0.5 rounded text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="space-y-1">
          {activeWorkspace?.projects.map((proj) => {
            const isSelected = proj.id === activeProjectId;
            return (
              <button
                key={proj.id}
                type="button"
                onClick={() => setActiveProjectId(proj.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition cursor-pointer ${
                  isSelected
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <FolderKanban className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                  {proj.key}
                </span>
                <span className="truncate">{proj.name}</span>
              </button>
            );
          })}

          {activeWorkspace && activeWorkspace.projects.length === 0 && (
            <button
              type="button"
              onClick={() => openWorkspaceProjectModal("project")}
              className="w-full px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 hover:border-blue-500 hover:text-blue-600 transition cursor-pointer"
            >
              + Tạo Project đầu tiên
            </button>
          )}
        </div>
      </div>

      {/* User & Controls Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center shrink-0">
            {getInitials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">{user.name}</p>
            <div className="flex items-center gap-1.5">
              {activeWorkspace && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {ROLE_LABEL[activeWorkspace.role]}
                </span>
              )}
              <span className="text-[10px] text-slate-400 truncate">
                {user.email}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Sáng
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5" />
                Tối
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => signOut.mutate()}
            title="Đăng xuất"
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Thoát
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <div className="hidden lg:block shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden flex"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
