import type { ReactNode } from "react";

// Muestra texto de la IA con formato sencillo: negrita (**texto**),
// listas (- punto / 1. punto), títulos (# Título) y párrafos.
// No interpreta HTML: todo se muestra como texto, así que es seguro.

type Block =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "heading"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "numbers"; items: string[] };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

// Convierte **negrita** en <strong>
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts
    .filter((part) => part !== "")
    .map((part, index) => {
      const bold = /^\*\*([^*]+)\*\*$/.exec(part);
      if (bold) {
        return (
          <strong key={`${keyPrefix}-${index}`} className="font-semibold">
            {bold[1]}
          </strong>
        );
      }
      // Quita asteriscos sueltos que hayan quedado
      return <span key={`${keyPrefix}-${index}`}>{part.replace(/\*\*/g, "")}</span>;
    });
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];

  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    const last = blocks[blocks.length - 1];

    if (line.trim() === "") {
      // Línea vacía: cierra el bloque actual
      blocks.push({ kind: "paragraph", lines: [] });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", text: heading[1] });
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      if (last?.kind === "bullets") last.items.push(bullet[1]);
      else blocks.push({ kind: "bullets", items: [bullet[1]] });
      continue;
    }

    const number = NUMBER.exec(line);
    if (number) {
      if (last?.kind === "numbers") last.items.push(number[1]);
      else blocks.push({ kind: "numbers", items: [number[1]] });
      continue;
    }

    if (last?.kind === "paragraph") last.lines.push(line);
    else blocks.push({ kind: "paragraph", lines: [line] });
  }

  return blocks.filter(
    (block) => !(block.kind === "paragraph" && block.lines.length === 0)
  );
}

export default function SimpleMarkdown({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const blocks = parseBlocks(text);

  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, index) => {
        const key = `b-${index}`;

        if (block.kind === "heading") {
          return (
            <p key={key} className="font-bold">
              {renderInline(block.text, key)}
            </p>
          );
        }

        if (block.kind === "bullets") {
          return (
            <ul key={key} className="list-disc space-y-1 pl-5">
              {block.items.map((item, i) => (
                <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
              ))}
            </ul>
          );
        }

        if (block.kind === "numbers") {
          return (
            <ol key={key} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, i) => (
                <li key={`${key}-${i}`}>{renderInline(item, `${key}-${i}`)}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={key} className="whitespace-pre-wrap">
            {block.lines.map((line, i) => (
              <span key={`${key}-${i}`}>
                {i > 0 && "\n"}
                {renderInline(line, `${key}-${i}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}