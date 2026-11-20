import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  ListTodo,
} from "lucide-react";
import { useTasks } from "../hooks/useTasks";

export function TaskStats() {
  const { stats } = useTasks();

  const cards = [
    {
      label: "Tổng công việc",
      value: stats.total,
      icon: ListTodo,
      color: "text-slate-700 dark:text-slate-200",
      bg: "bg-slate-100 dark:bg-slate-800",
    },
    {
      label: "Cần làm",
      value: stats.todo,
      icon: Circle,
      color: "text-slate-600 dark:text-slate-300",
      bg: "bg-slate-100 dark:bg-slate-800",
    },
    {
      label: "Đang làm",
      value: stats.inProgress,
      icon: Clock,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/60",
    },
    {
      label: "Hoàn thành",
      value: stats.done,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/60",
    },
  ];

  return (
    <section
      aria-label="Thống kê tiến độ"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-4"
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
            >
              <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {card.label}
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                  {card.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Tiến độ hoàn thành
            </span>
            {stats.overdue > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-medium">
                <AlertTriangle className="w-3 h-3" />
                {stats.overdue} quá hạn
              </span>
            )}
          </div>
          <span className="font-bold text-blue-600 dark:text-blue-400">
            {stats.completionPercent}%
          </span>
        </div>
        <div
          className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={stats.completionPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Phần trăm công việc đã hoàn thành"
        >
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${stats.completionPercent}%` }}
          />
        </div>
      </div>
    </section>
  );
}
