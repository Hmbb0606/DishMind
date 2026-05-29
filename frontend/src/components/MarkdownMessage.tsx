import React, { Fragment } from "react";

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: { order: string; text: string }[] }
  | { type: "table"; headers: string[]; rows: string[][] };

function isTableLine(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function isTableDivider(line: string) {
  const trimmed = line.trim();
  return /^\|(?:\s*:?-{3,}:?\s*\|)+$/.test(trimmed);
}

function parseTableRow(line: string) {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: { order: string; text: string }[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        const currentLine = lines[index].trim();
        const matched = currentLine.match(/^(\d+)\.\s+(.*)$/);
        if (matched) {
          items.push({ order: matched[1], text: matched[2] });
        }
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    if (isTableLine(line)) {
      const tableLines: string[] = [];
      while (index < lines.length && isTableLine(lines[index].trim())) {
        tableLines.push(lines[index].trim());
        index += 1;
      }

      if (tableLines.length >= 2 && isTableDivider(tableLines[1])) {
        const headers = parseTableRow(tableLines[0]);
        const rows = tableLines.slice(2).map(parseTableRow);
        blocks.push({ type: "table", headers, rows });
        continue;
      }

      blocks.push({
        type: "paragraph",
        text: tableLines.join(" "),
      });
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length) {
      const nextLine = lines[index].trim();
      if (!nextLine || /^(#{1,3})\s+/.test(nextLine) || /^[-*+]\s+/.test(nextLine) || /^\d+\.\s+/.test(nextLine)) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" "),
    });
  }

  return blocks;
}

function renderInline(content: string) {
  const segments = content.split(/(\*\*.*?\*\*|`.*?`)/g).filter(Boolean);

  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong key={`${segment}-${index}`} className="font-semibold text-[#9a3412]">
          {segment.slice(2, -2)}
        </strong>
      );
    }

    if (segment.startsWith("`") && segment.endsWith("`")) {
      return (
        <code
          key={`${segment}-${index}`}
          className="rounded-md bg-[#fff2e8] px-1.5 py-0.5 text-[0.92em] text-[#c2410c]"
        >
          {segment.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={`${segment}-${index}`}>{segment}</Fragment>;
  });
}

function getHeadingClass(level: number) {
  if (level === 1) {
    return "text-xl font-display font-semibold text-[#9a3412]";
  }
  if (level === 2) {
    return "text-lg font-display font-semibold text-[#c2410c]";
  }
  return "text-sm font-display font-semibold uppercase tracking-[0.18em] text-[#ea580c]";
}

export default function MarkdownMessage({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="space-y-3 text-sm leading-7 text-[#4d403a]">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <div
              key={`${block.type}-${index}`}
              className="mt-4 flex items-center gap-2 rounded-2xl bg-[#fff6ef] px-3 py-2"
            >
              <span className="h-2 w-2 rounded-full bg-[#f97316]" />
              <h3 className={getHeadingClass(block.level)}>{block.text}</h3>
            </div>
          );
        }

        if (block.type === "unordered-list") {
          return (
            <ul key={`${block.type}-${index}`} className="space-y-2 pl-1">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#fb923c]" />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <div key={`${block.type}-${index}`} className="space-y-2">
              {block.items.map((item, itemIndex) => (
                <div
                  key={`${item.order}-${itemIndex}`}
                  className="flex items-start gap-3 rounded-2xl bg-[#fffaf5] px-3 py-3"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ffedd5] text-xs font-semibold text-[#c2410c]">
                    {item.order}
                  </span>
                  <span>{renderInline(item.text)}</span>
                </div>
              ))}
            </div>
          );
        }

        if (block.type === "table") {
          return (
            <div key={`${block.type}-${index}`} className="overflow-x-auto rounded-2xl border border-[#fed7aa] bg-[#fffaf5]">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-[#ffedd5] text-[#9a3412]">
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th key={`${header}-${headerIndex}`} className="px-4 py-3 font-semibold">
                        {renderInline(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`${row.join("-")}-${rowIndex}`} className="border-t border-[#fde7cf]">
                      {row.map((cell, cellIndex) => (
                        <td key={`${cell}-${cellIndex}`} className="px-4 py-3 align-top text-[#4d403a]">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <p key={`${block.type}-${index}`} className="whitespace-pre-wrap">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
