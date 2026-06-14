import { Fragment } from "react";

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.92em]">{part.slice(1, -1)}</code>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return <a key={index} href={linkMatch[2]} target="_blank" rel="noreferrer" className="text-cyan-600 underline underline-offset-4 dark:text-cyan-300">{linkMatch[1]}</a>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function MarkdownContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter(Boolean);
        if (!lines.length) return null;
        if (lines.every((line) => line.trim().startsWith("- "))) {
          return (
            <ul key={index} className="space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
              {lines.map((line) => (
                <li key={line}>{renderInline(line.replace(/^- /, ""))}</li>
              ))}
            </ul>
          );
        }
        const first = lines[0];
        if (first.startsWith("### ")) {
          return (
            <div key={index} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">{first.replace(/^### /, "")}</h3>
              {lines.slice(1).map((line, lineIndex) => (
                <p key={lineIndex} className="text-sm leading-7 text-foreground/90">{renderInline(line)}</p>
              ))}
            </div>
          );
        }
        return (
          <div key={index} className="space-y-2">
            {lines.map((line, lineIndex) => (
              <p key={lineIndex} className="text-sm leading-7 text-foreground/90">{renderInline(line)}</p>
            ))}
          </div>
        );
      })}
    </div>
  );
}
