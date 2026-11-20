import { useState } from "react";
import type { DragEvent } from "react";
import { ClipboardList, FilterX, RotateCcw } from "lucide-react";
import { useTasks } from "../hooks/useTasks";
import { isFilterActive } from "../utils/taskHelpers";
import { TaskItem } from "./TaskItem";

export function TaskList() {
  const { tasks, filteredTasks, filter, resetFilter, reorderTask } = useTasks();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const hasFilters = isFilterActive(filter);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-14 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
          <ClipboardList className="w-6 h-6" />
        </div>
        <p className="font-semibold text-slate-800 dark:text-slate-100">
          Chưa có công việc nào!
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
          Hãy thêm công việc đầu tiên ở khung bên cạnh để bắt đầu theo dõi tiến độ của bạn.
        </p>
      </div>
    );
  }

  if (filteredTasks.length === 0) {
    return (
      <div className="text-center py-14 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
          <FilterX className="w-6 h-6" />
        </div>
        <p className="font-semibold text-slate-800 dark:text-slate-100">
          Không tìm thấy công việc phù hợp
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh lại bộ lọc hiện tại.
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={resetFilter}
            className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Đặt lại tất cả bộ lọc
          </button>
        )}
      </div>
    );
  }

  const handleDragStartItem = (taskId: string) => {
    setDraggedId(taskId);
  };

  const handleDragOverItem = (e: DragEvent<HTMLElement>, taskId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedId && draggedId !== taskId) {
      setDropTargetId(taskId);
    }
  };

  const handleDropOnItem = (e: DragEvent<HTMLElement>, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedId ?? e.dataTransfer.getData("text/plain");
    if (sourceId && sourceId !== targetId) {
      reorderTask(sourceId, targetId);
    }
    setDraggedId(null);
    setDropTargetId(null);
  };

  const handleDragEndItem = () => {
    setDraggedId(null);
    setDropTargetId(null);
  };

  return (
    <div className="space-y-3" role="list" aria-label="Danh sách công việc">
      {filter.sortBy === "newest" && filteredTasks.length > 1 && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1">
          Mẹo: Kéo thả biểu tượng ⋮⋮ ở đầu mỗi công việc để sắp xếp thứ tự tùy ý.
        </p>
      )}
      {filteredTasks.map((task) => (
        <div key={task.id} role="listitem">
          <TaskItem
            task={task}
            isDropTarget={dropTargetId === task.id}
            onDragStartItem={handleDragStartItem}
            onDragOverItem={handleDragOverItem}
            onDropOnItem={handleDropOnItem}
            onDragEndItem={handleDragEndItem}
          />
        </div>
      ))}
    </div>
  );
}
