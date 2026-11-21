import { useState, type FormEvent } from "react";
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
  Loader2,
  Menu,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useParseNaturalLanguageFilter } from "../../hooks/useAgileQueries";
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
  const aiFilter = useUiStore((s) => s.aiFilter);
  const realtimeStatus = useUiStore((s) => s.realtimeStatus);
  const setBoardSprintId = useUiStore((s) => s.setBoardSprintId);
  const setFilters = useUiStore((s) => s.setFilters);
  const setAiFilter = useUiStore((s) => s.setAiFilter);
  const resetFilters = useUiStore((s) => s.resetFilters);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const openCreateIssueModal = useUiStore((s) => s.openCreateIssueModal);
  const setPrdModalOpen = useUiStore((s) => s.setPrdModalOpen);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);

  const [nlQuery, setNlQuery] = useState("");
  const parseNlFilter = useParseNaturalLanguageFilter();

  const canWrite = hasMinimumRole(role, "member");
  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.priority !== "all" ||
    filters.type !== "all" ||
    filters.assigneeId !== "all" ||
    Boolean(aiFilter);

  const activeSprint = sprints.find((s) => s.status === "active");
  const defaultCreateSprintId =
    boardSprintId && boardSprintId !== "all"
      ? boardSprintId
      : (activeSprint?.id ?? null);

  const handleNlSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = nlQuery.trim();
    if (!projectDetail || trimmed.length < 3 || parseNlFilter.isPending) return;
    parseNlFilter.mutate(
      {
        projectId: projectDetail.project.id,
        query: trimmed,
      },
      {
        onSuccess: () => {
          setNlQuery("");
        },
      },
    );
  };

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
          {realtimeStatus !== "idle" && (
            <span
              data-testid="realtime-status-pill"
              title={
                realtimeStatus === "connected"
                  ? "Đang đồng bộ Realtime qua SSE"
                  : "Đang kết nối lại luồng Realtime..."
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${
                realtimeStatus === "connected"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                  realtimeStatus === "connected"
                    ? "bg-emerald-500"
                    : "bg-amber-500"
                }`}
              />
              {realtimeStatus === "connected" ? "Live" : "Đang kết nối..."}
            </span>
          )}

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
            <>
              <button
                type="button"
                onClick={() => setPrdModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AI Backlog</span>
              </button>

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
            </>
          )}
        </div>
      </div>

      {/* Row 2: Sprint Scope + Filters + Natural Language AI Filter */}
      {activeView !== "analytics" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {activeView === "board" && sprints.length > 0 && (
              <select
                aria-label="Chọn Sprint hiển thị trên Board"
                value={boardSprintId ?? "all"}
                onChange={(e) =>
                  setBoardSprintId(
                    e.target.value === "all" ? "all" : e.target.value,
                  )
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

            <div className="relative flex-1 min-w-[160px] max-w-xs">
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
                setFilters({
                  priority: e.target.value as "all" | IssuePriority,
                })
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

            {(activeView === "board" || activeView === "backlog") &&
              projectDetail && (
                <form
                  onSubmit={handleNlSubmit}
                  className="flex items-center gap-1.5 flex-1 min-w-[230px] max-w-md"
                >
                  <div className="relative flex-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      aria-label="Lọc bằng ngôn ngữ tự nhiên AI"
                      value={nlQuery}
                      onChange={(e) => setNlQuery(e.target.value)}
                      placeholder="Hỏi AI lọc (VD: bug ưu tiên cao chưa có người làm)..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/30 placeholder:text-purple-400/80 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={
                      nlQuery.trim().length < 3 || parseNlFilter.isPending
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-45 text-white text-xs font-semibold transition cursor-pointer shrink-0"
                  >
                    {parseNlFilter.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    Lọc AI
                  </button>
                </form>
              )}

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

          {aiFilter && (
            <div
              data-testid="ai-filter-banner"
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-xs"
            >
              <span className="flex items-center gap-1.5 text-purple-800 dark:text-purple-200 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>{aiFilter.explanation}</span>
              </span>
              <button
                type="button"
                onClick={() => setAiFilter(null)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
              >
                <X className="w-3 h-3" />
                Xóa lọc AI
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
