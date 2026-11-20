import { describe, expect, it } from "vitest";
import { DEFAULT_FILTER } from "../../constants/task";
import type { Task } from "../../types/task";
import {
  filterAndSortTasks,
  getDueDateState,
  getTaskStats,
  normalizeTasks,
  reorderTasks,
} from "../taskHelpers";
import { validateTaskInput } from "../validation";

const sampleTasks: Task[] = [
  {
    id: "1",
    title: "Học React Context",
    description: "Tìm hiểu useReducer và custom hook",
    priority: "high",
    status: "in_progress",
    category: "study",
    dueDate: "2026-11-18",
    createdAt: 1000,
    updatedAt: 1000,
  },
  {
    id: "2",
    title: "Đi siêu thị",
    description: "Mua trái cây và sữa tươi",
    priority: "low",
    status: "todo",
    category: "personal",
    dueDate: "2026-11-25",
    createdAt: 2000,
    updatedAt: 2000,
  },
  {
    id: "3",
    title: "Hoàn thành báo cáo sprint",
    priority: "medium",
    status: "done",
    category: "work",
    dueDate: "2026-11-15",
    createdAt: 3000,
    updatedAt: 3000,
  },
];

describe("validateTaskInput", () => {
  it("báo lỗi khi tiêu đề trống hoặc dưới 3 ký tự", () => {
    expect(validateTaskInput({ title: "   " }).title).toBeDefined();
    expect(validateTaskInput({ title: "ab" }).title).toBeDefined();
    expect(validateTaskInput({ title: "Học TypeScript" }).title).toBeUndefined();
  });

  it("báo lỗi khi mô tả vượt quá 200 ký tự", () => {
    const longDesc = "a".repeat(201);
    expect(
      validateTaskInput({ title: "Task hợp lệ", description: longDesc })
        .description,
    ).toBeDefined();
  });
});

describe("normalizeTasks", () => {
  it("trả về mảng rỗng với dữ liệu sai cấu trúc", () => {
    expect(normalizeTasks(null)).toEqual([]);
    expect(normalizeTasks("invalid")).toEqual([]);
    expect(normalizeTasks({ foo: "bar" })).toEqual([]);
  });

  it("chuyển đổi (migrate) dữ liệu cũ dùng isCompleted sang status mới", () => {
    const legacy = [
      {
        id: "old-1",
        title: "Task cũ đã xong",
        priority: "high",
        isCompleted: true,
        createdAt: 1700000000000,
      },
      {
        id: "old-2",
        title: "Task cũ chưa xong",
        priority: "invalid_priority",
        isCompleted: false,
        createdAt: 1700000001000,
      },
      { title: "   " }, // invalid - skipped
    ];

    const result = normalizeTasks(legacy);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "old-1",
      status: "done",
      priority: "high",
      category: "work",
    });
    expect(result[1]).toMatchObject({
      id: "old-2",
      status: "todo",
      priority: "medium",
    });
  });
});

describe("filterAndSortTasks", () => {
  it("tìm kiếm trên cả tiêu đề và mô tả", () => {
    const byTitle = filterAndSortTasks(sampleTasks, {
      ...DEFAULT_FILTER,
      searchQuery: "siêu thị",
    });
    expect(byTitle.map((t) => t.id)).toEqual(["2"]);

    const byDescription = filterAndSortTasks(sampleTasks, {
      ...DEFAULT_FILTER,
      searchQuery: "useReducer",
    });
    expect(byDescription.map((t) => t.id)).toEqual(["1"]);
  });

  it("lọc theo trạng thái, độ ưu tiên và danh mục", () => {
    const result = filterAndSortTasks(sampleTasks, {
      ...DEFAULT_FILTER,
      status: "in_progress",
      priority: "high",
      category: "study",
    });
    expect(result.map((t) => t.id)).toEqual(["1"]);
  });

  it("sắp xếp theo độ ưu tiên cao nhất và hạn chót gần nhất", () => {
    const byPriority = filterAndSortTasks(sampleTasks, {
      ...DEFAULT_FILTER,
      sortBy: "priority",
    });
    expect(byPriority.map((t) => t.id)).toEqual(["1", "3", "2"]);

    const byDueDate = filterAndSortTasks(sampleTasks, {
      ...DEFAULT_FILTER,
      sortBy: "dueDate",
    });
    expect(byDueDate.map((t) => t.id)).toEqual(["3", "1", "2"]);
  });
});

describe("getDueDateState & getTaskStats", () => {
  const fixedNow = new Date("2026-11-20T10:00:00");

  it("phân loại đúng trạng thái hạn chót", () => {
    expect(getDueDateState("2026-11-19", "todo", fixedNow)).toBe("overdue");
    expect(getDueDateState("2026-11-20", "todo", fixedNow)).toBe("today");
    expect(getDueDateState("2026-11-22", "todo", fixedNow)).toBe("soon");
    expect(getDueDateState("2026-11-25", "todo", fixedNow)).toBe("normal");
    expect(getDueDateState("2026-11-10", "done", fixedNow)).toBe("normal");
  });

  it("tính đúng số liệu thống kê và % hoàn thành", () => {
    const stats = getTaskStats(sampleTasks, fixedNow);
    expect(stats).toEqual({
      total: 3,
      todo: 1,
      inProgress: 1,
      done: 1,
      overdue: 1, // task 1 quá hạn; task 3 đã done nên không tính quá hạn
      completionPercent: 33,
    });
  });
});

describe("reorderTasks", () => {
  it("đổi vị trí task khi kéo thả", () => {
    const reordered = reorderTasks(sampleTasks, "3", "1");
    expect(reordered.map((t) => t.id)).toEqual(["3", "1", "2"]);
  });
});
