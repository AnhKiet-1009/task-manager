import type { TaskFilterState, TaskPriority, TaskStatus } from '../types/task';

interface TaskFilterProps {
  filter: TaskFilterState;
  onFilterChange: (newFilter: TaskFilterState) => void;
}

export function TaskFilter({ filter, onFilterChange }: TaskFilterProps) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
      {/* Tìm kiếm theo tiêu đề */}
      <input
        type="text"
        placeholder="Tìm kiếm theo tiêu đề..."
        value={filter.searchQuery}
        onChange={(e) =>
          onFilterChange({ ...filter, searchQuery: e.target.value })
        }
        className="w-full md:w-1/3 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      />

      {/* Lọc theo trạng thái hoàn thành */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-md text-sm w-full md:w-auto justify-center">
        {(['all', 'pending', 'completed'] as TaskStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onFilterChange({ ...filter, status })}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
              filter.status === status
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            {status === 'all'
              ? 'Tất cả'
              : status === 'pending'
              ? 'Chưa xong'
              : 'Hoàn thành'}
          </button>
        ))}
      </div>

      {/* Lọc theo độ ưu tiên */}
      <select
        value={filter.priority}
        onChange={(e) =>
          onFilterChange({
            ...filter,
            priority: e.target.value as 'all' | TaskPriority,
          })
        }
        className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        <option value="all">Mọi mức ưu tiên</option>
        <option value="low">Thấp</option>
        <option value="medium">Trung bình</option>
        <option value="high">Cao</option>
      </select>
    </div>
  );
}