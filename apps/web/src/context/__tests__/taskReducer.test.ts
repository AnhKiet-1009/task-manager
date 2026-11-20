import { describe, expect, it } from "vitest";
import type { Task } from "../../types/task";
import { createInitialTaskState, taskReducer } from "../taskReducer";

const baseTasks: Task[] = [
  {
    id: "t1",
    title: "Task 1",
    priority: "medium",
    status: "todo",
    category: "work",
    createdAt: 100,
    updatedAt: 100,
  },
  {
    id: "t2",
    title: "Task 2",
    priority: "high",
    status: "done",
    category: "study",
    createdAt: 200,
    updatedAt: 200,
  },
];

describe("taskReducer", () => {
  it("thêm task mới lên đầu danh sách", () => {
    const state = createInitialTaskState(baseTasks);
    const next = taskReducer(state, {
      type: "ADD_TASK",
      payload: {
        title: "  Task mới  ",
        description: "Mô tả chi tiết",
        priority: "high",
        status: "todo",
        category: "personal",
        dueDate: "2026-12-01",
      },
    });

    expect(next.tasks).toHaveLength(3);
    expect(next.tasks[0].title).toBe("Task mới");
    expect(next.tasks[0].description).toBe("Mô tả chi tiết");
    expect(next.toast?.type).toBe("success");
  });

  it("cập nhật đầy đủ tiêu đề, mô tả, độ ưu tiên, danh mục và trạng thái", () => {
    const state = createInitialTaskState(baseTasks);
    const next = taskReducer(state, {
      type: "UPDATE_TASK",
      payload: {
        id: "t1",
        updates: {
          title: "Task 1 đã sửa",
          description: "Đã bổ sung mô tả",
          priority: "high",
          status: "in_progress",
          category: "study",
          dueDate: "2026-11-30",
        },
      },
    });

    expect(next.tasks[0]).toMatchObject({
      id: "t1",
      title: "Task 1 đã sửa",
      description: "Đã bổ sung mô tả",
      priority: "high",
      status: "in_progress",
      category: "study",
      dueDate: "2026-11-30",
    });
  });

  it("xóa task và hỗ trợ Hoàn tác (UNDO_LAST_ACTION)", () => {
    const state = createInitialTaskState(baseTasks);
    const afterDelete = taskReducer(state, {
      type: "DELETE_TASK",
      payload: { id: "t1" },
    });

    expect(afterDelete.tasks.map((t) => t.id)).toEqual(["t2"]);
    expect(afterDelete.toast?.canUndo).toBe(true);

    const afterUndo = taskReducer(afterDelete, { type: "UNDO_LAST_ACTION" });
    expect(afterUndo.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(afterUndo.undoSnapshot).toBeNull();
  });

  it("chuyển trạng thái cột Kanban và xóa các task đã hoàn thành kèm hoàn tác", () => {
    const state = createInitialTaskState(baseTasks);
    const moved = taskReducer(state, {
      type: "MOVE_TASK_STATUS",
      payload: { id: "t1", status: "in_progress" },
    });
    expect(moved.tasks[0].status).toBe("in_progress");

    const cleared = taskReducer(moved, { type: "CLEAR_COMPLETED" });
    expect(cleared.tasks).toHaveLength(1);
    expect(cleared.tasks[0].id).toBe("t1");

    const restored = taskReducer(cleared, { type: "UNDO_LAST_ACTION" });
    expect(restored.tasks).toHaveLength(2);
  });

  it("tự đặt lại bộ lọc trạng thái khi chuyển sang chế độ Kanban", () => {
    const state = createInitialTaskState(baseTasks);
    const filtered = taskReducer(state, {
      type: "SET_FILTER",
      payload: { status: "todo" },
    });
    expect(filtered.filter.status).toBe("todo");

    const boardState = taskReducer(filtered, {
      type: "SET_VIEW_MODE",
      payload: "board",
    });
    expect(boardState.viewMode).toBe("board");
    expect(boardState.filter.status).toBe("all");
  });
});
