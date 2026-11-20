import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { AlertTriangle, Plus, Settings2 } from "lucide-react";
import type { IssueListItem, WorkflowStateDto } from "../../lib/api";
import { IssueCard } from "./IssueCard";

interface KanbanColumnProps {
  state: WorkflowStateDto;
  issues: IssueListItem[];
  canWrite: boolean;
  canAdmin: boolean;
  onAddIssue: (stateId: string) => void;
  onSelectIssue: (issueId: string) => void;
  onEditState: (state: WorkflowStateDto) => void;
}

export function KanbanColumn({
  state,
  issues,
  canWrite,
  canAdmin,
  onAddIssue,
  onSelectIssue,
  onEditState,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col:${state.id}`,
    data: { type: "column", stateId: state.id },
  });

  const wipExceeded =
    state.wipLimit !== null && issues.length > state.wipLimit;
  const totalPoints = issues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0);

  return (
    <section
      ref={setNodeRef}
      data-testid={`kanban-column-${state.name.toLowerCase().replace(/\s+/g, "-")}`}
      aria-label={`Cột ${state.name}`}
      className={`flex flex-col w-80 shrink-0 rounded-2xl border p-3 min-h-[460px] transition-all ${
        isOver
          ? "bg-blue-50/80 dark:bg-blue-950/30 border-blue-400 ring-2 ring-blue-500/20"
          : wipExceeded
            ? "bg-rose-50/40 dark:bg-rose-950/15 border-rose-300 dark:border-rose-800/80"
            : "bg-slate-100/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-slate-800"
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: state.color }}
          />
          <h2 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
            {state.name}
          </h2>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full ${
              wipExceeded
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                : "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {wipExceeded && <AlertTriangle className="w-3 h-3" />}
            {issues.length}
            {state.wipLimit !== null ? `/${state.wipLimit}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {totalPoints > 0 && (
            <span className="text-[11px] font-semibold text-slate-400 mr-1">
              {totalPoints} pts
            </span>
          )}
          {canAdmin && (
            <button
              type="button"
              onClick={() => onEditState(state)}
              title={`Cấu hình cột ${state.name}`}
              aria-label={`Cấu hình cột ${state.name}`}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canWrite && (
            <button
              type="button"
              onClick={() => onAddIssue(state.id)}
              title={`Thêm Issue vào ${state.name}`}
              aria-label={`Thêm Issue vào ${state.name}`}
              className="p-1 rounded-lg text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-white/80 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* WIP Warning Banner */}
      {wipExceeded && (
        <div
          role="status"
          className="mb-2.5 px-2.5 py-1.5 rounded-lg bg-rose-100/80 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-semibold flex items-center gap-1.5"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Vượt giới hạn WIP ({issues.length}/{state.wipLimit})
        </div>
      )}

      {/* Sortable Issues Container */}
      <SortableContext
        items={issues.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 space-y-2.5">
          {issues.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center px-3 text-center text-xs text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
              <p>Kéo thả thẻ vào đây</p>
            </div>
          ) : (
            issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                canDrag={canWrite}
                onSelect={onSelectIssue}
              />
            ))
          )}
        </div>
      </SortableContext>

      {canWrite && (
        <button
          type="button"
          onClick={() => onAddIssue(state.id)}
          className="mt-3 w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-white/80 dark:hover:bg-slate-800/80 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Thêm Issue
        </button>
      )}
    </section>
  );
}
