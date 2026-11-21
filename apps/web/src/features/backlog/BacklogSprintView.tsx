import { useMemo, useState } from "react";
import { hasMinimumRole, type WorkspaceRole } from "@taskmanager/shared";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Flag,
  Kanban,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  useStartSprint,
  useUpdateIssue,
} from "../../hooks/useAgileQueries";
import {
  filterIssues,
  formatShortDateVN,
  getInitials,
  ISSUE_PRIORITY_META,
  ISSUE_TYPE_META,
  sortByLexoRank,
  SPRINT_STATUS_META,
} from "../../lib/agileMeta";
import type { IssueListItem, SprintDto } from "../../lib/api";
import { useUiStore } from "../../stores/uiStore";

interface BacklogSprintViewProps {
  projectId: string;
  role: WorkspaceRole;
  sprints: SprintDto[];
  issues: IssueListItem[];
}

export function BacklogSprintView({
  projectId,
  role,
  sprints,
  issues,
}: BacklogSprintViewProps) {
  const filters = useUiStore((s) => s.filters);
  const aiFilter = useUiStore((s) => s.aiFilter);
  const openCreateIssueModal = useUiStore((s) => s.openCreateIssueModal);
  const openEditIssueModal = useUiStore((s) => s.openEditIssueModal);
  const openSprintModal = useUiStore((s) => s.openSprintModal);
  const setCompleteSprintId = useUiStore((s) => s.setCompleteSprintId);
  const setBoardSprintId = useUiStore((s) => s.setBoardSprintId);
  const setActiveView = useUiStore((s) => s.setActiveView);

  const canWrite = hasMinimumRole(role, "member");
  const startSprint = useStartSprint(projectId);
  const updateIssue = useUpdateIssue(projectId);

  const [showCompleted, setShowCompleted] = useState(false);

  const filteredIssues = useMemo(
    () =>
      sortByLexoRank(
        filterIssues(
          issues.filter((i) => i.type !== "epic"),
          filters,
          aiFilter,
        ),
      ),
    [issues, filters, aiFilter],
  );

  const activeSprints = useMemo(
    () => sprints.filter((s) => s.status === "active"),
    [sprints],
  );
  const plannedSprints = useMemo(
    () => sprints.filter((s) => s.status === "planned"),
    [sprints],
  );
  const completedSprints = useMemo(
    () => sprints.filter((s) => s.status === "completed"),
    [sprints],
  );
  const openSprints = useMemo(
    () => [...activeSprints, ...plannedSprints],
    [activeSprints, plannedSprints],
  );

  const backlogIssues = useMemo(
    () => filteredIssues.filter((i) => i.sprintId === null),
    [filteredIssues],
  );

  const renderIssueRow = (issue: IssueListItem) => {
    const typeMeta = ISSUE_TYPE_META[issue.type];
    const priorityMeta = ISSUE_PRIORITY_META[issue.priority];

    return (
      <div
        key={issue.id}
        data-testid={`backlog-row-${issue.identifier}`}
        className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800/80 transition"
      >
        <button
          type="button"
          onClick={() => openEditIssueModal(issue.id)}
          className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
        >
          <span
            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${typeMeta.badgeClass}`}
          >
            {typeMeta.label}
          </span>
          <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
            {issue.identifier}
          </span>
          <span className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 truncate hover:text-blue-600 dark:hover:text-blue-400">
            {issue.title}
          </span>
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {issue.state && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: issue.state.color }}
              />
              {issue.state.name}
            </span>
          )}

          <span
            className={`hidden md:inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border ${priorityMeta.badgeClass}`}
          >
            {priorityMeta.label}
          </span>

          {issue.storyPoints !== null && (
            <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
              {issue.storyPoints}
            </span>
          )}

          {issue.assignee && (
            <span
              title={issue.assignee.name}
              className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-center"
            >
              {getInitials(issue.assignee.name)}
            </span>
          )}

          {canWrite && (
            <select
              aria-label={`Chuyển Sprint cho ${issue.identifier}`}
              value={issue.sprintId ?? ""}
              onChange={(e) => {
                const nextSprintId = e.target.value || null;
                updateIssue.mutate({
                  issueId: issue.id,
                  input: { sprintId: nextSprintId },
                });
              }}
              className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <option value="">Backlog</option>
              {openSprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  };

  const renderSprintCard = (sprint: SprintDto) => {
    const sprintIssues = filteredIssues.filter((i) => i.sprintId === sprint.id);
    const totalPts = sprintIssues.reduce((s, i) => s + (i.storyPoints ?? 0), 0);
    const donePts = sprintIssues
      .filter((i) => i.state?.category === "completed")
      .reduce((s, i) => s + (i.storyPoints ?? 0), 0);
    const statusMeta = SPRINT_STATUS_META[sprint.status];

    return (
      <section
        key={sprint.id}
        data-testid={`sprint-section-${sprint.status}`}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
      >
        <div className="px-4 py-3.5 bg-slate-50/70 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusMeta.badgeClass}`}
              >
                {statusMeta.label}
              </span>
              <h2 className="font-bold text-sm">{sprint.name}</h2>
              {sprint.startDate && sprint.endDate && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatShortDateVN(sprint.startDate)} →{" "}
                  {formatShortDateVN(sprint.endDate)}
                </span>
              )}
              <span className="text-xs font-semibold text-slate-500">
                • {sprintIssues.length} issues • {donePts}/{totalPts} pts
              </span>
              {sprint.status === "completed" &&
                sprint.velocitySnapshot !== null && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <Sparkles className="w-3 h-3" />
                    Velocity: {sprint.velocitySnapshot} pts
                  </span>
                )}
            </div>
            {sprint.goal && (
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Flag className="w-3 h-3 text-blue-500 shrink-0" />
                {sprint.goal}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sprint.status !== "completed" && (
              <button
                type="button"
                onClick={() => {
                  setBoardSprintId(sprint.id);
                  setActiveView("board");
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Kanban className="w-3.5 h-3.5" />
                Mở Board
              </button>
            )}

            {canWrite && sprint.status === "planned" && (
              <button
                type="button"
                disabled={startSprint.isPending}
                onClick={() => startSprint.mutate(sprint.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Bắt đầu Sprint
              </button>
            )}

            {canWrite && sprint.status === "active" && (
              <button
                type="button"
                onClick={() => setCompleteSprintId(sprint.id)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Hoàn thành Sprint
              </button>
            )}

            {canWrite && sprint.status !== "completed" && (
              <button
                type="button"
                onClick={() => openCreateIssueModal({ sprintId: sprint.id })}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Issue
              </button>
            )}
          </div>
        </div>

        <div>
          {sprintIssues.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
              Chưa có Issue nào trong Sprint này.
            </div>
          ) : (
            sprintIssues.map(renderIssueRow)
          )}
        </div>
      </section>
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold">
            Backlog & Lập kế hoạch Sprint
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Phân bổ Issue giữa Product Backlog và các chu kỳ Sprint, theo dõi
            Story Points & Velocity.
          </p>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() => openSprintModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Tạo Sprint mới
          </button>
        )}
      </div>

      {/* Active & Planned Sprints */}
      {activeSprints.map(renderSprintCard)}
      {plannedSprints.map(renderSprintCard)}

      {/* Product Backlog */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="px-4 py-3.5 bg-slate-50/70 dark:bg-slate-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm">Product Backlog</h2>
            <span className="text-xs font-semibold text-slate-500">
              • {backlogIssues.length} issues
            </span>
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => openCreateIssueModal({ sprintId: null })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Thêm vào Backlog
            </button>
          )}
        </div>
        <div>
          {backlogIssues.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
              Backlog đang trống — tất cả Issue đã được phân vào Sprint hoặc hoàn
              thành.
            </div>
          ) : (
            backlogIssues.map(renderIssueRow)
          )}
        </div>
      </section>

      {/* Collapsible Completed Sprints */}
      {completedSprints.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            {showCompleted ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            Lịch sử Sprint đã hoàn thành ({completedSprints.length})
          </button>
          {showCompleted && completedSprints.map(renderSprintCard)}
        </div>
      )}
    </div>
  );
}
