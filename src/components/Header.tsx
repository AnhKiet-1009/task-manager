import { useRef } from "react";
import type { ChangeEvent } from "react";
import {
  CheckSquare,
  Download,
  Kanban,
  List,
  Moon,
  Sun,
  Upload,
} from "lucide-react";
import { useTasks } from "../hooks/useTasks";
import { useTheme } from "../hooks/useTheme";

export function Header() {
  const {
    tasks,
    viewMode,
    setViewMode,
    exportTasksToJson,
    importTasksFromJson,
  } = useTasks();
  const { theme, toggleTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        importTasksFromJson(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-600/30 shrink-0">
          <CheckSquare className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Task Manager
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Quản lý công việc, tiến độ & bảng Kanban cá nhân
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* View mode switcher */}
        <div
          className="inline-flex bg-slate-200/80 dark:bg-slate-800 p-1 rounded-lg"
          role="group"
          aria-label="Chế độ hiển thị"
        >
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
              viewMode === "list"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <List className="w-4 h-4" />
            Danh sách
          </button>
          <button
            type="button"
            onClick={() => setViewMode("board")}
            aria-pressed={viewMode === "board"}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
              viewMode === "board"
                ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Kanban className="w-4 h-4" />
            Kanban
          </button>
        </div>

        {/* Import / Export JSON */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Nhập file JSON công việc"
        />
        <button
          type="button"
          onClick={handleImportClick}
          title="Nhập dữ liệu từ file JSON"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nhập</span>
        </button>

        <button
          type="button"
          onClick={exportTasksToJson}
          disabled={tasks.length === 0}
          title="Xuất dữ liệu ra file JSON"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Xuất</span>
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={
            theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"
          }
          title={theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-amber-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
}
