import { ArrowUpDown, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import {
  CATEGORY_CONFIG,
  PRIORITY_CONFIG,
  SORT_OPTIONS,
  STATUS_CONFIG,
  STATUS_ORDER,
} from "../constants/task";
import { useTasks } from "../hooks/useTasks";
import type {
  TaskCategory,
  TaskPriority,
  TaskSortOption,
  TaskStatus,
} from "../types/task";
import { isFilterActive } from "../utils/taskHelpers";

interface TaskFilterProps {
  onOpenCreateModal?: () => void;
}

export function TaskFilter({ onOpenCreateModal }: TaskFilterProps) {
  const {
    filter,
    stats,
    viewMode,
    setFilter,
    resetFilter,
    clearCompleted,
  } = useTasks();

  const hasActiveFilter = isFilterActive(filter);

  const statusTabs: {
    value: "all" | TaskStatus;
    label: string;
    count: number;
  }[] = [
    { value: "all", label: "Tất cả", count: stats.total },
    ...STATUS_ORDER.map((status) => ({
      value: status,
      label: STATUS_CONFIG[status].shortLabel,
      count:
        status === "todo"
          ? stats.todo
          : status === "in_progress"
            ? stats.inProgress
            : stats.done,
    })),
  ];

  return (
    <section
      aria-label="Tìm kiếm và lọc công việc"
      className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3"
    >
      {/* Main toolbar row */}
      <div className="flex flex-col lg:flex-row gap-2.5 lg:items-center">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            aria-label="Tìm kiếm công việc"
            placeholder="Tìm theo tiêu đề hoặc mô tả..."
            value={filter.searchQuery}
            onChange={(e) => setFilter({ searchQuery: e.target.value })}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 focus:border-blue-500"
          />
          {filter.searchQuery && (
            <button
              type="button"
              onClick={() => setFilter({ searchQuery: "" })}
              aria-label="Xóa từ khóa tìm kiếm"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            aria-label="Lọc theo độ ưu tiên"
            value={filter.priority}
            onChange={(e) =>
              setFilter({ priority: e.target.value as "all" | TaskPriority })
            }
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900"
          >
            <option value="all">Mọi độ ưu tiên</option>
            {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((p) => (
              <option key={p} value={p}>
                Ưu tiên: {PRIORITY_CONFIG[p].label}
              </option>
            ))}
          </select>

          <select
            aria-label="Lọc theo danh mục"
            value={filter.category}
            onChange={(e) =>
              setFilter({ category: e.target.value as "all" | TaskCategory })
            }
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900"
          >
            <option value="all">Mọi danh mục</option>
            {(Object.keys(CATEGORY_CONFIG) as TaskCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_CONFIG[cat].label}
              </option>
            ))}
          </select>

          <div className="relative">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              aria-label="Sắp xếp công việc"
              value={filter.sortBy}
              onChange={(e) =>
                setFilter({ sortBy: e.target.value as TaskSortOption })
              }
              className="w-full pl-8 pr-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Board mode inline actions (Create + Clear/Reset) */}
        {viewMode === "board" && (
          <div className="flex items-center gap-2 shrink-0">
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilter}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Đặt lại
              </button>
            )}

            {stats.done > 0 && (
              <button
                type="button"
                onClick={clearCompleted}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa xong ({stats.done})
              </button>
            )}

            {onOpenCreateModal && (
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Thêm công việc
              </button>
            )}
          </div>
        )}
      </div>

      {/* List mode secondary row: Status tabs + Quick actions */}
      {viewMode === "list" && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
            {statusTabs.map((tab) => {
              const active = filter.status === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setFilter({ status: tab.value })}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                    active
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetFilter}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Đặt lại lọc
              </button>
            )}

            {stats.done > 0 && (
              <button
                type="button"
                onClick={clearCompleted}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa đã xong ({stats.done})
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
