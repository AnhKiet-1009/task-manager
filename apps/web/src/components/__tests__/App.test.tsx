import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../../App";
import type { Task } from "../../types/task";

const seedTasks: Task[] = [
  {
    id: "seed-1",
    title: "Thiết kế giao diện",
    description: "Làm Figma và Tailwind",
    priority: "high",
    status: "todo",
    category: "work",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: "seed-2",
    title: "Ôn tập TypeScript",
    description: "Generics và Utility Types",
    priority: "medium",
    status: "done",
    category: "study",
    createdAt: 1700000001000,
    updatedAt: 1700000001000,
  },
];

describe("TaskManager App Integration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("validate lỗi và thêm được công việc mới lên đầu danh sách", async () => {
    const user = userEvent.setup();
    render(<App initialTasks={[]} />);

    const submitBtn = screen.getByRole("button", { name: /thêm công việc/i });
    await user.click(submitBtn);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /không được bỏ trống tiêu đề/i,
    );

    const titleInput = screen.getByLabelText(/tiêu đề công việc/i);
    const descInput = screen.getByLabelText(/mô tả chi tiết/i);

    await user.type(titleInput, "Viết unit test với Vitest");
    await user.type(descInput, "Kiểm thử thêm sửa xóa và lọc");
    await user.click(submitBtn);

    expect(screen.getByText("Viết unit test với Vitest")).toBeInTheDocument();
    expect(screen.getByText("Kiểm thử thêm sửa xóa và lọc")).toBeInTheDocument();
  });

  it("cho phép chỉnh sửa cả tiêu đề và mô tả của công việc", async () => {
    const user = userEvent.setup();
    render(<App initialTasks={seedTasks} />);

    await user.click(
      screen.getByRole("button", { name: /sửa công việc "thiết kế giao diện"/i }),
    );

    const editTitle = screen.getByPlaceholderText(/tiêu đề công việc/i);
    const editDesc = screen.getByPlaceholderText(/mô tả chi tiết/i);

    await user.clear(editTitle);
    await user.type(editTitle, "Thiết kế giao diện v2");
    await user.clear(editDesc);
    await user.type(editDesc, "Cập nhật Dark Mode và Kanban");
    await user.click(screen.getByRole("button", { name: /^lưu$/i }));

    expect(screen.getByText("Thiết kế giao diện v2")).toBeInTheDocument();
    expect(
      screen.getByText("Cập nhật Dark Mode và Kanban"),
    ).toBeInTheDocument();
  });

  it("xóa công việc và khôi phục lại bằng nút Hoàn tác", async () => {
    const user = userEvent.setup();
    render(<App initialTasks={seedTasks} />);

    await user.click(
      screen.getByRole("button", { name: /xóa công việc "thiết kế giao diện"/i }),
    );
    expect(screen.queryByText("Thiết kế giao diện")).not.toBeInTheDocument();

    const undoButton = screen.getByRole("button", { name: /hoàn tác/i });
    await user.click(undoButton);

    expect(screen.getByText("Thiết kế giao diện")).toBeInTheDocument();
  });

  it("lọc theo từ khóa trong mô tả và hiển thị nút đặt lại khi không có kết quả", async () => {
    const user = userEvent.setup();
    render(<App initialTasks={seedTasks} />);

    const searchInput = screen.getByLabelText(/tìm kiếm công việc/i);
    await user.type(searchInput, "Generics");

    expect(screen.getByText("Ôn tập TypeScript")).toBeInTheDocument();
    expect(screen.queryByText("Thiết kế giao diện")).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "khong-ton-tai-xyz");
    expect(
      screen.getByText(/không tìm thấy công việc phù hợp/i),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /đặt lại tất cả bộ lọc/i }),
    );
    expect(screen.getByText("Thiết kế giao diện")).toBeInTheDocument();
    expect(screen.getByText("Ôn tập TypeScript")).toBeInTheDocument();
  });

  it("chuyển đổi sang Kanban, thêm thẻ trực tiếp vào cột Đang làm và chuyển cột nhanh", async () => {
    const user = userEvent.setup();
    render(<App initialTasks={seedTasks} />);

    await user.click(screen.getByRole("button", { name: /kanban/i }));

    const todoCol = screen.getByTestId("kanban-col-todo");
    const inProgressCol = screen.getByTestId("kanban-col-in_progress");
    const doneCol = screen.getByTestId("kanban-col-done");

    expect(within(todoCol).getByText("Thiết kế giao diện")).toBeInTheDocument();
    expect(within(doneCol).getByText("Ôn tập TypeScript")).toBeInTheDocument();

    // Thêm công việc trực tiếp vào cột Đang làm qua Modal
    await user.click(
      screen.getByRole("button", { name: /thêm công việc vào cột đang làm/i }),
    );
    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText(/tiêu đề công việc/i),
      "Tối ưu Kanban UI",
    );
    await user.click(
      within(dialog).getByRole("button", { name: /thêm công việc/i }),
    );

    expect(
      within(inProgressCol).getByText("Tối ưu Kanban UI"),
    ).toBeInTheDocument();

    // Chuyển thẻ sang cột Hoàn thành bằng nút mũi tên nhanh
    await user.click(
      screen.getByRole("button", {
        name: /chuyển "tối ưu kanban ui" sang hoàn thành/i,
      }),
    );
    expect(within(doneCol).getByText("Tối ưu Kanban UI")).toBeInTheDocument();
  });
});
