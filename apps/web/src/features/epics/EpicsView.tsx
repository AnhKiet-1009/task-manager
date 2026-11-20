import { useMemo } from "react";
import { hasMinimumRole, type WorkspaceRole } from "@taskmanager/shared";
import { Calendar, Layers, Plus } from "lucide-react";
import {
  formatShortDateVN,
  ISSUE_PRIORITY_META,
  ISSUE_TYPE_META,
} from "../../lib/agileMeta";
import type { IssueListItem } from "../../lib/api";
import { useUiStore } from "../../stores/uiStore";

interface EpicsViewProps {
  role: WorkspaceRole;
  issues: IssueListItem[];
}

export function EpicsView({ role, issues }: EpicsViewProps) {
  const openCreateIssueModal = useUiStore((s) => s.openCreateIssueModal);
  const openEditIssueModal = useUiStore((s) => s.openEditIssueModal);
  const canWrite = hasMinimumRole(role, "member");

  const epics = useMemo(
    () => issues.filter((i) => i.type === "epic"),
    [issues],
  );

  const childrenByEpic = useMemo(() => {
    const map = new Map<string, IssueListItem[]>();
    for (const issue of issues) {
      if (issue.parentId && issue.type !== "epic") {
        const list = map.get(issue.parentId) ?? [];
        list.push(issue);
        map.set(issue.parentId, list);
      }
    }
    return map;
  }, [issues]);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold">Epics & Lộ trình Sản phẩm</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Theo dõi tiến độ các hạng mục lớn dựa trên Story Points và tỷ lệ
            hoàn thành Issue con.
          </p>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() => openCreateIssueModal({ type: "epic", sprintId: null })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Tạo Epic mới
          </button>
        )}
      </div>

      {epics.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-10 text-center text-sm text-slate-400">
          Chưa có Epic nào trong Project này.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {epics.map((epic) => {
            const children = childrenByEpic.get(epic.id) ?? [];
            const doneCount = children.filter(
              (c) => c.state?.category === "completed",
            ).length;
            const totalPts = children.reduce(
              (s, c) => s + (c.storyPoints ?? 0),
              0,
            );
            const donePts = children
              .filter((c) => c.state?.category === "completed")
              .reduce((s, c) => s + (c.storyPoints ?? 0), 0);
            const percent =
              children.length > 0
                ? Math.round((doneCount / children.length) * 100)
                : 0;

            return (
              <article
                key={epic.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
              >
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
                        {epic.identifier}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ISSUE_PRIORITY_META[epic.priority].badgeClass}`}
                      >
                        {ISSUE_PRIORITY_META[epic.priority].label}
                      </span>
                      {epic.dueDate && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Calendar className="w-3 h-3" />
                          Hạn {formatShortDateVN(epic.dueDate)}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditIssueModal(epic.id)}
                      className="text-left font-bold text-sm sm:text-base hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                    >
                      {epic.title}
                    </button>

                    {epic.descriptionMd && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {epic.descriptionMd}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="w-44 space-y-1">
                      <div className="flex justify-between text-[11px] font-semibold">
                        <span className="text-slate-500">
                          {doneCount}/{children.length} issues • {donePts}/
                          {totalPts} pts
                        </span>
                        <span className="text-purple-600 dark:text-purple-400">
                          {percent}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {canWrite && (
                      <button
                        type="button"
                        onClick={() =>
                          openCreateIssueModal({
                            type: "story",
                            parentId: epic.id,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Issue con
                      </button>
                    )}
                  </div>
                </div>

                {children.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => openEditIssueModal(child.id)}
                        className="w-full px-4 py-2 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${ISSUE_TYPE_META[child.type].badgeClass}`}
                          >
                            {ISSUE_TYPE_META[child.type].label}
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            {child.identifier}
                          </span>
                          <span className="text-xs font-medium truncate">
                            {child.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {child.state && (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: child.state.color }}
                              />
                              {child.state.name}
                            </span>
                          )}
                          {child.storyPoints !== null && (
                            <span className="text-[11px] font-bold text-slate-500">
                              {child.storyPoints} pts
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
