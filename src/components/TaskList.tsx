import type { Task, TaskPriority } from "../types/task";
import { TaskItem } from "./TaskItem";

interface TaskListProps {
  tasks: Task[];
  onToggleStatus: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: (
    id: string,
    updatedTitle: string,
    updatedPriority: TaskPriority,
  ) => void;
}

export function TaskList({
  tasks,
  onToggleStatus,
  onDeleteTask,
  onUpdateTask,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-lg text-gray-500">
        <p className="font-medium">Chưa có công việc nào!</p>
        <p className="text-xs text-gray-400 mt-1">
          Hãy thêm task mới hoặc điều chỉnh lại bộ lọc tìm kiếm.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggleStatus={onToggleStatus}
          onDeleteTask={onDeleteTask}
          onUpdateTask={onUpdateTask}
        />
      ))}
    </div>
  );
}
