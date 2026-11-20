import {
  hasMinimumRole,
  ISSUE_PRIORITIES,
  ISSUE_TYPES,
  type IssuePriority,
  type IssueType,
  type WorkspaceRole,
} from "@taskmanager/shared";
import {
  Command,
  Menu,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { ISSUE_PRIORITY_META, ISSUE_TYPE_META } from "../../lib/agileMeta";
import type { ProjectDetailResponse, SprintDto } from "../../lib/api";
import { useUiStore } from "../../stores/uiStore";

interface TopBarProps {
  projectDetail: ProjectDetailResponse | undefined;
  sprints: SprintDto[];
  role: WorkspaceRole;
}

export function TopBar({ projectDetail, sprints, role }: TopBarProps) {
  const activeView = useUiStore((s) => s.activeView);
  const boardSprintId = useUiStore((s) => s.boardSprintId);
  const filters = useUiStore((s) => s.filters);
  const setBoardSprintId = useUiStore((s) => s.setBoardSprintId);
  const setFilters = useUiStore((s) => s.setFilters);
  const resetFilters = useUiStore((s) => s.resetFilters);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const openCreateIssueModal = useUiStore((s) => s.openCreateIssueModal);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  const canWrite = hasMinimumRole(role, "member");
  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.priority !== "all" ||
    filters.type !== "all" ||
    filters.assigneeId !== "all";

  const activeSprint = sprints.find((s) => s.status === "active");
  const defaultCreateSprintId =
    boardSprintId && boardSprintId !== "all"
      ? boardSprintId
      : (activeSprint?.id ?? null);

  return (
    <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 space-y-2.5">
      {/* Row 1: Breadcrumb + Primary Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Mở thanh điều hướng"
            className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          >
            <Menu className="w-4 h-4" />
          </button>

          {projectDetail && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {projectDetail.project.key}
              </span>
              <h1 className="font-bold text-sm sm:text-base truncate">
                {projectDetail.project.name}
              </h1>
              {projectDetail.project.githubRepoFullName && (
                <span className="hidden md:inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                  {projectDetail.project.githubRepoFullName}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <Command className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tìm nhanh</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              Ctrl K
            </kbd>
          </button>

          {canWrite && (
            <button
              type="button"
              onClick={() =>
                openCreateIssueModal({ sprintId: defaultCreateSprintId })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo Issue
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Sprint Scope + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {activeView === "board" && sprints.length > 0 && (
          <select
            aria-label="Chọn Sprint hiển thị trên Board"
            value={boardSprintId ?? "all"}
            onChange={(e) =>
              setBoardSprintId(e.target.value === "all" ? "all" : e.target.value)
            }
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer"
          >
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.status === "active" ? "● " : ""}
                {s.name}
              </option>
            ))}
            <option value="all">Tất cả Issues (kể cả Backlog)</option>
          </select>
        )}

        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Lọc Issue theo từ khóa hoặc mã"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="Lọc mã (ENG-12), tiêu đề..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>

        <select
          aria-label="Lọc theo độ ưu tiên"
          value={filters.priority}
          onChange={(e) =>
            setFilters({ priority: e.target.value as "all" | IssuePriority })
          }
          className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 cursor-pointer"
        >
          <option value="all">Mọi độ ưu tiên</option>
          {ISSUE_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              Ưu tiên: {ISSUE_PRIORITY_META[p].label}
            </option>
          ))}
        </select>

        <select
          aria-label="Lọc theo loại Issue"
          value={filters.type}
          onChange={(e) =>
            setFilters({ type: e.target.value as "all" | IssueType })
          }
          className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 cursor-pointer"
        >
          <option value="all">Mọi loại Issue</option>
          {ISSUE_TYPES.map((t) => (
            <option key={t} value={t}>
              Loại: {ISSUE_TYPE_META[t].label}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Đặt lại
          </button>
        )}
      </div>
    </header>
  );
}
