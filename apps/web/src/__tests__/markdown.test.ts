import { describe, expect, it } from "vitest";
import { htmlToMarkdown, markdownToHtml } from "../lib/markdown";

describe("Markdown <-> Tiptap HTML converter", () => {
  it("converts headings, inline styles, and preserves inline code literals", () => {
    const md =
      "## Tiêu đề kỹ thuật\n\nĐoạn văn có **đậm**, *nghiêng*, ~~gạch ngang~~ và `const a = 1 * 2`.";
    const html = markdownToHtml(md);

    expect(html).toContain("<h2>Tiêu đề kỹ thuật</h2>");
    expect(html).toContain("<strong>đậm</strong>");
    expect(html).toContain("<em>nghiêng</em>");
    expect(html).toContain("<s>gạch ngang</s>");
    expect(html).toContain("<code>const a = 1 * 2</code>");

    expect(htmlToMarkdown(html)).toBe(md);
  });

  it("converts fenced code blocks, blockquotes, and lists cleanly", () => {
    const md = [
      "> Lưu ý quan trọng về HMAC",
      "",
      "- Mục một",
      "- Mục hai",
      "",
      "1. Bước 1",
      "2. Bước 2",
      "",
      "```",
      "const ok = verifySignature(rawBody);",
      "```",
    ].join("\n");

    const html = markdownToHtml(md);
    expect(html).toContain("<blockquote><p>Lưu ý quan trọng về HMAC</p></blockquote>");
    expect(html).toContain("<ul><li><p>Mục một</p></li><li><p>Mục hai</p></li></ul>");
    expect(html).toContain("<ol><li><p>Bước 1</p></li><li><p>Bước 2</p></li></ol>");
    expect(html).toContain("<pre><code>const ok = verifySignature(rawBody);</code></pre>");

    expect(htmlToMarkdown(html)).toBe(md);
  });

  it("supports Tiptap TaskList checklists round-trip", () => {
    const md = ["- [x] Viết migration SQL", "- [ ] Kiểm thử SSE"].join("\n");
    const html = markdownToHtml(md);

    expect(html).toContain('data-type="taskList"');
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('data-checked="false"');

    expect(htmlToMarkdown(html)).toBe(md);
  });

  it("escapes raw HTML/script tags to prevent XSS", () => {
    const md = 'Báo lỗi <script>alert("xss")</script> trên input';
    const html = markdownToHtml(md);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });

  it("returns empty string for empty Tiptap paragraphs", () => {
    expect(markdownToHtml("   ")).toBe("");
    expect(htmlToMarkdown("<p></p>")).toBe("");
    expect(htmlToMarkdown("<p><br></p>")).toBe("");
  });
});
