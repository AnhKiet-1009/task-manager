import { useState } from "react";
import { Header } from "./components/Header";
import { KanbanBoard } from "./components/KanbanBoard";
import { TaskFilter } from "./components/TaskFilter";
import { TaskForm } from "./components/TaskForm";
import { TaskList } from "./components/TaskList";
import { TaskModal } from "./components/TaskModal";
import { TaskStats } from "./components/TaskStats";
import { Toast } from "./components/Toast";
import { TaskProvider } from "./context/TaskContext";
import { useTasks } from "./hooks/useTasks";
import type { Task, TaskStatus } from "./types/task";

function TaskManagerWorkspace() {
  const { viewMode } = useTasks();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<TaskStatus>("todo");

  const handleOpenCreateModal = (status: TaskStatus = "todo") => {
    setModalStatus(status);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <main
        className={`mx-auto px-4 py-6 sm:py-8 space-y-5 transition-all ${
          viewMode === "board" ? "max-w-7xl" : "max-w-6xl"
        }`}
      >
        <Header />

        <TaskStats />

        {viewMode === "list" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <aside className="lg:col-span-4 lg:sticky lg:top-6">
              <TaskForm />
            </aside>

            <section className="lg:col-span-8 space-y-4">
              <TaskFilter />
              <TaskList />
            </section>
          </div>
        ) : (
          <div className="space-y-4">
            <TaskFilter
              onOpenCreateModal={() => handleOpenCreateModal("todo")}
            />
            <KanbanBoard onAddTaskInColumn={handleOpenCreateModal} />
          </div>
        )}
      </main>

      <TaskModal
        isOpen={modalOpen}
        defaultStatus={modalStatus}
        onClose={() => setModalOpen(false)}
      />

      <Toast />
    </div>
  );
}

interface AppProps {
  initialTasks?: Task[];
}

export function App({ initialTasks }: AppProps) {
  return (
    <TaskProvider initialTasks={initialTasks}>
      <TaskManagerWorkspace />
    </TaskProvider>
  );
}

export default App;
