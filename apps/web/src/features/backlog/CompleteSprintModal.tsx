import { useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { useCompleteSprint } from "../../hooks/useAgileQueries";
import type { IssueListItem, SprintDto } from "../../lib/api";
import { useUiStore } from "../../stores/uiStore";

interface CompleteSprintModalProps {
  projectId: string | null;
  sprints: SprintDto[];
  issues: IssueListItem[];
}

export function CompleteSprintModal({
  projectId,
  sprints,
  issues,
}: CompleteSprintModalProps) {
  const completeSprintId = useUiStore((s) => s.completeSprintId);
  const setCompleteSprintId = useUiStore((s) => s.setCompleteSprintId);
  const completeSprint = useCompleteSprint(projectId);

  const [targetSprintId, setTargetSprintId] = useState<string>("");

  const sprint = completeSprintId
    ? sprints.find((s) => s.id === completeSprintId) ?? null
    : null;

  if (!sprint) return null;

  const sprintIssues = issues.filter(
    (i) => i.sprintId === sprint.id && i.type !== "epic",
  );
  const doneIssues = sprintIssues.filter(
    (i) => i.state?.category === "completed",
  );
  const incompleteIssues = sprintIssues.filter(
    (i) =>
      i.state?.category !== "completed" && i.state?.category !== "canceled",
  );
  const donePoints = doneIssues.reduce((s, i) => s + (i.storyPoints ?? 0), 0);

  const plannedSprints = sprints.filter(
    (s) => s.status === "planned" && s.id !== sprint.id,
  );

  const handleConfirm = () => {
    completeSprint.mutate(
      {
        sprintId: sprint.id,
        input: { moveIncompleteToSprintId: targetSprintId || null },
      },
      {
        onSuccess: () => {
          setTargetSprintId("");
          setCompleteSprintId(null);
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      onClick={() => setCompleteSprintId(null)}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Hoàn thành {sprint.name}
          </h2>
          <button
            type="button"
            onClick={() => setCompleteSprintId(null)}
            aria-label="Đóng"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                Đã hoàn thành
              </p>
              <p className="text-xl font-extrabold text-emerald-800 dark:text-emerald-200">
                {doneIssues.length} issues
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Velocity: {donePoints} pts
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                Chưa hoàn thành
              </p>
              <p className="text-xl font-extrabold text-amber-800 dark:text-amber-200">
                {incompleteIssues.length} issues
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Sẽ tự động chuyển đi
              </p>
            </div>
          </div>

          {incompleteIssues.length > 0 && (
            <div>
              <label
                htmlFor="rollover-target"
                className="block text-xs font-semibold mb-1.5"
              >
                Chuyển {incompleteIssues.length} issue chưa xong tới:
              </label>
              <select
                id="rollover-target"
                value={targetSprintId}
                onChange={(e) => setTargetSprintId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
              >
                <option value="">Product Backlog</option>
                {plannedSprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCompleteSprintId(null)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={completeSprint.isPending}
              onClick={handleConfirm}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 cursor-pointer"
            >
              {completeSprint.isPending && (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              )}
              Xác nhận hoàn thành
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
