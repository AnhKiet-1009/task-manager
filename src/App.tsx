import { useState, useEffect, useMemo } from "react";
import type {
  Task,
  TaskFormData,
  TaskFilterState,
  TaskPriority,
} from "./types/task";
import { TaskForm } from "./components/TaskForm";
import { TaskFilter } from "./components/TaskFilter";
import { TaskList } from "./components/TaskList";

const STORAGE_KEY = "TASKS_APP_DATA";

export function App() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const savedTasks = localStorage.getItem(STORAGE_KEY);
      if (!savedTasks) return [];

      return JSON.parse(savedTasks) as Task[];
    } catch (error) {
      console.error("Lỗi khi đọc dữ liệu từ localStorage: ", error);
      return [];
    }
  });

  const [filter, setFilter] = useState<TaskFilterState>({
    status: "all",
    priority: "all",
    searchQuery: "",
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      console.error("Lỗi khi ghi dữ liệu vào localStorage:", error);
    }
  }, [tasks]);

  const handleAddTask = (data: TaskFormData) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description,
      priority: data.priority,
      isCompleted: false,
      createdAt: Date.now(),
    };
    setTasks((prev) => [...prev, newTask]);
  };

  const handleToggleStatus = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, isCompleted: !task.isCompleted } : task,
      ),
    );
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const handleUpdateTask = (
    id: string,
    updatedTitle: string,
    updatedPriority: TaskPriority,
  ) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id
          ? {
              ...task,
              title: updatedTitle,
              priority: updatedPriority,
            }
          : task,
      ),
    );
  };

  const filteredTasks = useMemo(() => {
    const query = filter.searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchStatus =
        filter.status === "all" ||
        (filter.status === "completed" && task.isCompleted) ||
        (filter.status === "pending" && !task.isCompleted);

      const matchPriority =
        filter.priority === "all" || task.priority === filter.priority;

      const matchSearch =
        query === "" || task.title.toLowerCase().includes(query);

      return matchStatus && matchPriority && matchSearch;
    });
  }, [tasks, filter]);

  return (
    <main className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Task Manager
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Ứng dụng quản lý công việc và tiến độ cá nhân
          </p>
        </header>

        <TaskForm onAddTask={handleAddTask} />

        <TaskFilter filter={filter} onFilterChange={setFilter} />

        <TaskList
          tasks={filteredTasks}
          onToggleStatus={handleToggleStatus}
          onDeleteTask={handleDeleteTask}
          onUpdateTask={handleUpdateTask}
        />
      </div>
    </main>
  );
}

export default App;
