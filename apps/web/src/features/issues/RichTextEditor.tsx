import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  FileCode2,
  Heading2,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  Strikethrough,
} from "lucide-react";
import { htmlToMarkdown, markdownToHtml } from "../../lib/markdown";

interface RichTextEditorProps {
  initialMarkdown: string;
  editable: boolean;
  placeholder?: string;
  onChange: (markdown: string) => void;
}

export function RichTextEditor({
  initialMarkdown,
  editable,
  placeholder = "Viết mô tả kỹ thuật, danh sách kiểm tra hoặc đoạn mã...",
  onChange,
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: markdownToHtml(initialMarkdown),
    onUpdate: ({ editor: instance }) => {
      onChange(htmlToMarkdown(instance.getHTML()));
    },
  });

  const toolbarActions = [
    {
      label: "In đậm",
      icon: Bold,
      active: () => editor?.isActive("bold") ?? false,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: "In nghiêng",
      icon: Italic,
      active: () => editor?.isActive("italic") ?? false,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: "Gạch ngang",
      icon: Strikethrough,
      active: () => editor?.isActive("strike") ?? false,
      run: () => editor?.chain().focus().toggleStrike().run(),
    },
    {
      label: "Mã inline",
      icon: Code,
      active: () => editor?.isActive("code") ?? false,
      run: () => editor?.chain().focus().toggleCode().run(),
    },
    {
      label: "Tiêu đề H2",
      icon: Heading2,
      active: () => editor?.isActive("heading", { level: 2 }) ?? false,
      run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "Danh sách",
      icon: List,
      active: () => editor?.isActive("bulletList") ?? false,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: "Danh sách số",
      icon: ListOrdered,
      active: () => editor?.isActive("orderedList") ?? false,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: "Checklist",
      icon: ListChecks,
      active: () => editor?.isActive("taskList") ?? false,
      run: () => editor?.chain().focus().toggleTaskList().run(),
    },
    {
      label: "Khối mã",
      icon: FileCode2,
      active: () => editor?.isActive("codeBlock") ?? false,
      run: () => editor?.chain().focus().toggleCodeBlock().run(),
    },
    {
      label: "Trích dẫn",
      icon: Quote,
      active: () => editor?.isActive("blockquote") ?? false,
      run: () => editor?.chain().focus().toggleBlockquote().run(),
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500 transition">
      {editable && (
        <div
          role="toolbar"
          aria-label="Định dạng nội dung"
          className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80"
        >
          {toolbarActions.map((item) => {
            const Icon = item.icon;
            const isActive = item.active();
            return (
              <button
                key={item.label}
                type="button"
                title={item.label}
                aria-label={item.label}
                aria-pressed={isActive}
                onClick={item.run}
                className={`p-1.5 rounded-md transition cursor-pointer ${
                  isActive
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
      )}

      <div className="px-3.5 py-2.5 text-slate-800 dark:text-slate-100">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
