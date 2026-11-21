function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatInlineMarkdown(raw: string): string {
  // Split inline code spans first so markdown symbols inside backticks stay literal
  return raw
    .split(/(`[^`\n]+`)/g)
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
        return `<code>${escapeHtml(part.slice(1, -1))}</code>`;
      }
      return escapeHtml(part)
        .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
        .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
        .replace(/~~([^~\n]+)~~/g, "<s>$1</s>")
        .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    })
    .join("");
}

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const TASK_ITEM_RE = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;
const UL_ITEM_RE = /^\s*[-*]\s+(.*)$/;
const OL_ITEM_RE = /^\s*\d+\.\s+(.*)$/;
const BLOCKQUOTE_RE = /^>\s?(.*)$/;
const FENCE_RE = /^```/;

/**
 * Converts Markdown into Tiptap-compatible HTML with safe HTML escaping.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return "";

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Fenced code block
    if (FENCE_RE.test(line.trim())) {
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_RE.test(lines[i]!.trim())) {
        codeLines.push(lines[i]!);
        i += 1;
      }
      if (i < lines.length) i += 1; // skip closing fence
      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    // Heading h1..h3
    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      const level = headingMatch[1]!.length;
      const content = formatInlineMarkdown(headingMatch[2]!.trim());
      blocks.push(`<h${level}>${content}</h${level}>`);
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push("<hr>");
      i += 1;
      continue;
    }

    // Blockquote
    if (BLOCKQUOTE_RE.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const m = lines[i]!.match(BLOCKQUOTE_RE);
        if (!m) break;
        quoteLines.push(m[1]!);
        i += 1;
      }
      const inner = markdownToHtml(quoteLines.join("\n")) || "<p></p>";
      blocks.push(`<blockquote>${inner}</blockquote>`);
      continue;
    }

    // Task list (must precede standard unordered list)
    if (TASK_ITEM_RE.test(line)) {
      const items: Array<{ checked: boolean; text: string }> = [];
      while (i < lines.length) {
        const m = lines[i]!.match(TASK_ITEM_RE);
        if (!m) break;
        items.push({
          checked: m[1]!.toLowerCase() === "x",
          text: m[2]!,
        });
        i += 1;
      }
      const liHtml = items
        .map(
          ({ checked, text }) =>
            `<li data-type="taskItem" data-checked="${checked ? "true" : "false"}"><label><input type="checkbox"${checked ? ' checked="checked"' : ""}><span></span></label><div><p>${formatInlineMarkdown(text)}</p></div></li>`,
        )
        .join("");
      blocks.push(`<ul data-type="taskList">${liHtml}</ul>`);
      continue;
    }

    // Unordered list
    if (UL_ITEM_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        if (TASK_ITEM_RE.test(lines[i]!)) break;
        const m = lines[i]!.match(UL_ITEM_RE);
        if (!m) break;
        items.push(m[1]!);
        i += 1;
      }
      blocks.push(
        `<ul>${items.map((t) => `<li><p>${formatInlineMarkdown(t)}</p></li>`).join("")}</ul>`,
      );
      continue;
    }

    // Ordered list
    if (OL_ITEM_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i]!.match(OL_ITEM_RE);
        if (!m) break;
        items.push(m[1]!);
        i += 1;
      }
      blocks.push(
        `<ol>${items.map((t) => `<li><p>${formatInlineMarkdown(t)}</p></li>`).join("")}</ol>`,
      );
      continue;
    }

    // Paragraph (consume until blank line or next block marker)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !FENCE_RE.test(lines[i]!.trim()) &&
      !HEADING_RE.test(lines[i]!) &&
      !BLOCKQUOTE_RE.test(lines[i]!) &&
      !TASK_ITEM_RE.test(lines[i]!) &&
      !UL_ITEM_RE.test(lines[i]!) &&
      !OL_ITEM_RE.test(lines[i]!) &&
      !/^---+$/.test(lines[i]!.trim())
    ) {
      paraLines.push(lines[i]!);
      i += 1;
    }
    if (paraLines.length > 0) {
      blocks.push(`<p>${paraLines.map(formatInlineMarkdown).join("<br>")}</p>`);
    }
  }

  return blocks.join("");
}

function serializeInlineNode(node: Node): string {
  if (node.nodeType === 3) {
    return node.textContent ?? "";
  }
  if (node.nodeType !== 1) return "";

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === "br") {
    return "\n";
  }

  if (tag === "code") {
    return `\`${el.textContent ?? ""}\``;
  }

  const children = Array.from(el.childNodes).map(serializeInlineNode).join("");

  switch (tag) {
    case "strong":
    case "b":
      return children ? `**${children}**` : "";
    case "em":
    case "i":
      return children ? `*${children}*` : "";
    case "s":
    case "del":
    case "strike":
      return children ? `~~${children}~~` : "";
    case "a": {
      const href = el.getAttribute("href") ?? "";
      return href ? `[${children}](${href})` : children;
    }
    default:
      return children;
  }
}

function serializeListItemContent(li: Element): string {
  const parts: string[] = [];
  for (const child of Array.from(li.childNodes)) {
    if (child.nodeType === 1) {
      const tag = (child as Element).tagName.toLowerCase();
      if (tag === "label") continue;
      if (tag === "div" || tag === "p") {
        const text = Array.from(child.childNodes)
          .map((n) =>
            n.nodeType === 1 && (n as Element).tagName.toLowerCase() === "p"
              ? Array.from(n.childNodes).map(serializeInlineNode).join("")
              : serializeInlineNode(n),
          )
          .join("")
          .trim();
        if (text) parts.push(text);
        continue;
      }
    }
    const inline = serializeInlineNode(child).trim();
    if (inline) parts.push(inline);
  }
  return parts.join(" ").trim();
}

function serializeBlockNode(node: Node): string {
  if (node.nodeType === 3) {
    return (node.textContent ?? "").trim();
  }
  if (node.nodeType !== 1) return "";

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === "h1" || tag === "h2" || tag === "h3") {
    const level = Number(tag.slice(1));
    const text = Array.from(el.childNodes).map(serializeInlineNode).join("").trim();
    return text ? `${"#".repeat(level)} ${text}` : "";
  }

  if (tag === "p") {
    const raw = Array.from(el.childNodes)
      .map(serializeInlineNode)
      .join("")
      .replace(/\n+$/g, "");
    return raw.trim() ? raw : "";
  }

  if (tag === "pre") {
    const code = (el.textContent ?? "").replace(/\n$/, "");
    return `\`\`\`\n${code}\n\`\`\``;
  }

  if (tag === "hr") {
    return "---";
  }

  if (tag === "blockquote") {
    const inner = Array.from(el.childNodes)
      .map(serializeBlockNode)
      .filter(Boolean)
      .join("\n\n");
    if (!inner) return "";
    return inner
      .split("\n")
      .map((line) => (line ? `> ${line}` : ">"))
      .join("\n");
  }

  if (tag === "ul") {
    const isTaskList = el.getAttribute("data-type") === "taskList";
    const items = Array.from(el.children).filter(
      (c) => c.tagName.toLowerCase() === "li",
    );
    return items
      .map((li) => {
        const text = serializeListItemContent(li);
        if (isTaskList || li.getAttribute("data-type") === "taskItem") {
          const checked = li.getAttribute("data-checked") === "true";
          return `- [${checked ? "x" : " "}] ${text}`;
        }
        return `- ${text}`;
      })
      .join("\n");
  }

  if (tag === "ol") {
    const items = Array.from(el.children).filter(
      (c) => c.tagName.toLowerCase() === "li",
    );
    return items
      .map((li, idx) => `${idx + 1}. ${serializeListItemContent(li)}`)
      .join("\n");
  }

  return Array.from(el.childNodes)
    .map(serializeBlockNode)
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Serializes Tiptap editor HTML back into clean Markdown.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return "";
  if (typeof DOMParser === "undefined") {
    return html.replace(/<[^>]+>/g, "").trim();
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = Array.from(doc.body.childNodes)
    .map(serializeBlockNode)
    .filter((b) => b.trim().length > 0);

  return blocks
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
