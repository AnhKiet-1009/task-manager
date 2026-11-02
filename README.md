# 📝 Task Manager - Quản Lý Công Việc Cá Nhân

Ứng dụng web quản lý công việc và tiến độ cá nhân hiện đại, trực quan, được xây dựng với **React 19**, **TypeScript**, **Tailwind CSS v4** và **Vite**.

---

## 🌟 Tính năng nổi bật

- **Quản lý công việc (CRUD đầy đủ)**:
  - ➕ **Thêm công việc mới**: Nhập tiêu đề, mô tả và chọn mức độ ưu tiên (*Thấp*, *Trung bình*, *Cao*).
  - ✏️ **Chỉnh sửa nhanh inline**: Cập nhật tiêu đề và độ ưu tiên trực tiếp ngay trên từng công việc mà không cần reload trang.
  - ❌ **Xóa công việc**: Loại bỏ công việc dễ dàng khi không còn cần thiết.
  - ✅ **Đánh dấu hoàn thành**: Toggle trạng thái hoàn thành với hiệu ứng gạch ngang trực quan.
- **Tìm kiếm & Bộ lọc linh hoạt**:
  - 🔍 **Tìm kiếm thời gian thực**: Tìm kiếm công việc theo từ khóa tiêu đề tức thì.
  - 📌 **Lọc theo trạng thái**: Xem tất cả, các việc chưa xong hoặc các việc đã hoàn thành.
  - 🎯 **Lọc theo độ ưu tiên**: Phân loại theo *Thấp*, *Trung bình*, hoặc *Cao*.
- **Xác thực dữ liệu (Form Validation)**:
  - Bắt buộc nhập tiêu đề, yêu cầu độ dài tối thiểu từ 3 ký tự.
  - Giới hạn độ dài mô tả tối đa 200 ký tự.
  - Thông báo lỗi hiển thị rõ ràng bên dưới input.
- **Tự động lưu trữ (Local Storage)**:
  - Dữ liệu công việc được đồng bộ tự động vào `localStorage` của trình duyệt, không bị mất dữ liệu khi tải lại hoặc tắt trang.
- **Giao diện hiện đại & Responsive**:
  - Tối ưu hiển thị mượt mà trên cả thiết bị di động và máy tính với Tailwind CSS.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

| Công nghệ | Phiên bản / Mô tả |
| :--- | :--- |
| **React** | `^19.3.1` - Thư viện xây dựng giao diện người dùng |
| **TypeScript** | Định kiểu tĩnh an toàn, hạn chế lỗi runtime |
| **Vite** | `^8.3.5` - Build tool thế hệ mới, tối ưu HMR cực nhanh |
| **Tailwind CSS** | `^4.3.3` - Utility-first CSS framework thiết kế UI hiện đại |
| **React Compiler** | `babel-plugin-react-compiler` - Tự động tối ưu hóa re-render |

---

## 📁 Cấu trúc thư mục (Project Structure)

```text
TaskManager/
├── public/                 # Static assets công khai
├── src/
│   ├── assets/             # Hình ảnh và icon
│   ├── components/         # Các React component giao diện
│   │   ├── TaskFilter.tsx  # Bộ lọc trạng thái, ưu tiên & thanh tìm kiếm
│   │   ├── TaskForm.tsx    # Form thêm task mới kèm validation
│   │   ├── TaskItem.tsx    # Component từng công việc (xem, sửa, xóa, toggle)
│   │   └── TaskList.tsx    # Danh sách hiển thị task & empty state
│   ├── types/              # Type definitions & Interfaces
│   │   └── task.ts         # Khai báo model Task, FilterState, FormErrors
│   ├── App.tsx             # Component gốc quản lý state & localStorage
│   ├── index.css           # Cấu hình Tailwind CSS
│   └── main.tsx            # Điểm khởi chạy ứng dụng React
├── index.html              # HTML template chính
├── package.json            # Thông tin dependencies và scripts
├── tsconfig.json           # Cấu hình TypeScript
└── vite.config.ts          # Cấu hình Vite & Tailwind
```

---

## 🚀 Hướng dẫn cài đặt & Chạy ứng dụng

### 1. Yêu cầu hệ thống
- Đã cài đặt [Node.js](https://nodejs.org/) (khuyến nghị phiên bản LTS mới nhất).
- Quản lý gói: khuyến nghị sử dụng **pnpm** (hoặc npm / yarn).

### 2. Clone repository
```bash
git clone https://github.com/AnhKiet-1009/task-manager.git
cd task-manager
```

### 3. Cài đặt dependencies
```bash
pnpm install
# hoặc nếu dùng npm:
# npm install
```

### 4. Khởi chạy môi trường phát triển (Dev Server)
```bash
pnpm dev
# hoặc: npm run dev
```
Mở trình duyệt và truy cập vào đường dẫn hiển thị trên terminal (mặc định: `http://localhost:5173`).

### 5. Build ứng dụng cho môi trường Production
```bash
pnpm build
# hoặc: npm run build
```
Bản build tĩnh sau khi đóng gói sẽ nằm tại thư mục `dist/`. Bạn có thể chạy thử bản build với:
```bash
pnpm preview
```

---

## 👨‍💻 Tác giả

- **Trương Anh Kiệt**
- GitHub: [@AnhKiet-1009](https://github.com/AnhKiet-1009)
