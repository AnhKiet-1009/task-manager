import { useMemo, useState } from "react";
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { hasMinimumRole, type WorkspaceRole } from "@taskmanager/shared";
import { Calendar, CheckCircle2, Flag, Plus } from "lucide-react";
import { useMoveIssue } from "../../hooks/useAgileQueries";
import {
  filterIssues,
  formatShortDateVN,
  sortByLexoRank,
  SPRINT_STATUS_META,
} from "../../lib/agileMeta";
import type {
  IssueListItem,
  SprintDto,
  WorkflowStateDto,
} from "../../lib/api";
import { useUiStore } from "../../stores/uiStore";
import { IssueCard } from "./IssueCard";
import { KanbanColumn } from "./KanbanColumn";

interface AgileKanbanBoardProps {
  projectId: string;
  role: WorkspaceRole;
  workflowStates: WorkflowStateDto[];
  sprints: SprintDto[];
  issues: IssueListItem[];
}

export function AgileKanbanBoard({
  projectId,
  role,
  workflowStates,
  sprints,
  issues,
}: AgileKanbanBoardProps) {
  const boardSprintId = useUiStore((s) => s.boardSprintId);
  const filters = useUiStore((s) => s.filters);
  const aiFilter = useUiStore((s) => s.aiFilter);
  const openCreateIssueModal = useUiStore((s) => s.openCreateIssueModal);
  const openEditIssueModal = useUiStore((s) => s.openEditIssueModal);
  const openWorkflowStateModal = useUiStore((s) => s.openWorkflowStateModal);
  const setCompleteSprintId = useUiStore((s) => s.setCompleteSprintId);

  const canWrite = hasMinimumRole(role, "member");
  const canAdmin = hasMinimumRole(role, "admin");

  const moveIssue = useMoveIssue(projectId, workflowStates);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sortedStates = useMemo(
    () => sortByLexoRank(workflowStates),
    [workflowStates],
  );

  const selectedSprint = useMemo(
    () =>
      boardSprintId && boardSprintId !== "all"
        ? sprints.find((s) => s.id === boardSprintId) ?? null
        : null,
    [boardSprintId, sprints],
  );

  // Exclude Epics from Kanban columns; scope to selected sprint unless "all"
  const scopedIssues = useMemo(() => {
    const nonEpics = issues.filter((i) => i.type !== "epic");
    const bySprint = selectedSprint
      ? nonEpics.filter((i) => i.sprintId === selectedSprint.id)
      : nonEpics;
    return sortByLexoRank(filterIssues(bySprint, filters, aiFilter));
  }, [issues, selectedSprint, filters, aiFilter]);

  const issuesByState = useMemo(() => {
    const map = new Map<string, IssueListItem[]>();
    for (const s of sortedStates) {
      map.set(s.id, []);
    }
    for (const issue of scopedIssues) {
      const list = map.get(issue.stateId);
      if (list) list.push(issue);
    }
    return map;
  }, [sortedStates, scopedIssues]);

  // Compute progress metrics for the sprint banner
  const sprintProgress = useMemo(() => {
    if (!selectedSprint) return null;
    const sprintItems = issues.filter(
      (i) => i.sprintId === selectedSprint.id && i.type !== "epic",
    );
    let totalPoints = 0;
    let donePoints = 0;
    let doneCount = 0;
    for (const item of sprintItems) {
      const pts = item.storyPoints ?? 0;
      totalPoints += pts;
      if (item.state?.category === "completed") {
        donePoints += pts;
        doneCount += 1;
      }
    }
    const percent =
      totalPoints > 0
        ? Math.round((donePoints / totalPoints) * 100)
        : sprintItems.length > 0
          ? Math.round((doneCount / sprintItems.length) * 100)
          : 0;
    return {
      totalCount: sprintItems.length,
      doneCount,
      totalPoints,
      donePoints,
      percent,
    };
  }, [issues, selectedSprint]);

  const activeIssue = activeDragId
    ? scopedIssues.find((i) => i.id === activeDragId) ?? null
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const draggedId = String(active.id);
    const overId = String(over.id);
    if (draggedId === overId) return;

    const draggedIssue = scopedIssues.find((i) => i.id === draggedId);
    if (!draggedIssue) return;

    let targetStateId: string | null = null;
    let overIssueId: string | null = null;

    if (overId.startsWith("col:")) {
      targetStateId = overId.slice(4);
    } else {
      const overIssue = scopedIssues.find((i) => i.id === overId);
      if (overIssue) {
        targetStateId = overIssue.stateId;
        overIssueId = overIssue.id;
      }
    }

    if (!targetStateId) return;

    const targetColumnItems = (issuesByState.get(targetStateId) ?? []).filter(
      (i) => i.id !== draggedId,
    );

    let prevPosition: string | null;
    let nextPosition: string | null;

    if (!overIssueId) {
      // Dropped on column container -> append to end
      prevPosition =
        targetColumnItems[targetColumnItems.length - 1]?.position ?? null;
      nextPosition = null;
    } else {
      const targetIndex = targetColumnItems.findIndex(
        (i) => i.id === overIssueId,
      );
      if (targetIndex === -1) {
        prevPosition =
          targetColumnItems[targetColumnItems.length - 1]?.position ?? null;
        nextPosition = null;
      } else {
        const sameColumn = draggedIssue.stateId === targetStateId;
        const originalList = issuesByState.get(targetStateId) ?? [];
        const oldIdx = originalList.findIndex((i) => i.id === draggedId);
        const overIdxInOriginal = originalList.findIndex(
          (i) => i.id === overIssueId,
        );

        const insertAfter = sameColumn && oldIdx < overIdxInOriginal;
        if (insertAfter) {
          prevPosition = targetColumnItems[targetIndex]?.position ?? null;
          nextPosition = targetColumnItems[targetIndex + 1]?.position ?? null;
        } else {
          prevPosition = targetColumnItems[targetIndex - 1]?.position ?? null;
          nextPosition = targetColumnItems[targetIndex]?.position ?? null;
        }
      }
    }

    moveIssue.mutate({
      issueId: draggedId,
      input: {
        stateId: targetStateId,
        prevPosition,
        nextPosition,
      },
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Active Sprint Banner */}
      {selectedSprint && sprintProgress && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${SPRINT_STATUS_META[selectedSprint.status].badgeClass}`}
              >
                {SPRINT_STATUS_META[selectedSprint.status].label}
              </span>
              <h2 className="font-bold text-sm sm:text-base">
                {selectedSprint.name}
              </h2>
              {selectedSprint.startDate && selectedSprint.endDate && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatShortDateVN(selectedSprint.startDate)} →{" "}
                  {formatShortDateVN(selectedSprint.endDate)}
                </span>
              )}
            </div>
            {selectedSprint.goal && (
              <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>{selectedSprint.goal}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="w-44 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="text-slate-500 dark:text-slate-400">
                  {sprintProgress.donePoints}/{sprintProgress.totalPoints} pts (
                  {sprintProgress.doneCount}/{sprintProgress.totalCount})
                </span>
                <span className="text-blue-600 dark:text-blue-400">
                  {sprintProgress.percent}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                  style={{ width: `${sprintProgress.percent}%` }}
                />
              </div>
            </div>

            {canWrite && selectedSprint.status === "active" && (
              <button
                type="button"
                onClick={() => setCompleteSprintId(selectedSprint.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-950 transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Hoàn thành Sprint
              </button>
            )}
          </div>
        </section>
      )}

      {/* Horizontal Scrollable Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          {sortedStates.map((state) => (
            <KanbanColumn
              key={state.id}
              state={state}
              issues={issuesByState.get(state.id) ?? []}
              canWrite={canWrite}
              canAdmin={canAdmin}
              onAddIssue={(stateId) =>
                openCreateIssueModal({
                  stateId,
                  sprintId: selectedSprint?.id ?? null,
                })
              }
              onSelectIssue={(issueId) => openEditIssueModal(issueId)}
              onEditState={(st) => openWorkflowStateModal(st)}
            />
          ))}

          {canAdmin && (
            <button
              type="button"
              onClick={() => openWorkflowStateModal()}
              className="w-64 shrink-0 h-28 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              Thêm cột trạng thái
            </button>
          )}
        </div>

        <DragOverlay>
          {activeIssue ? (
            <div className="w-72">
              <IssueCard
                issue={activeIssue}
                canDrag={false}
                onSelect={() => {}}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
