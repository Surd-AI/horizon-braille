import { formulaScanner } from "./formula-islands";
import type { Document, MathNode, NodeBase } from "../model";

/** Scan at most this many UTF-16 code units; oversized sources remain intact. */
export const MAX_SOURCE_LENGTH = 100_000;

/**
 * Lossless, nonrecursive document scan. Delimiters do not nest. A matching close
 * ends math; other delimiters inside it remain raw TeX for the domain parser.
 * Each code unit is examined a constant number of times (O(n) time and space).
 */
export function parseDocument(
  source: string,
  options: { recognizeBare?: boolean; literalText?: boolean } = {},
): Document {
  const doc: Document = { source, nodes: [], diagnostics: [] };
  const base = (start: number, end: number): NodeBase => ({
    id: `node-${doc.nodes.length}`,
    span: { start, end },
    raw: source.slice(start, end),
  });
  if (source.length > MAX_SOURCE_LENGTH) {
    doc.nodes.push({
      ...base(0, source.length),
      kind: "unparsed",
      reason: "resource-limit",
    });
    doc.diagnostics.push({
      code: "resource-limit",
      severity: "error",
      span: { start: 0, end: source.length },
      message: `Document exceeds the ${MAX_SOURCE_LENGTH} UTF-16 code unit scan limit; source is preserved without parsing.`,
    });
    return doc;
  }

  const islands = formulaScanner(source);
  let cursor = 0;
  let textStart = 0;
  const flushText = () => {
    if (textStart < cursor) {
      doc.nodes.push({
        ...base(textStart, cursor),
        kind: "text",
        text: source.slice(textStart, cursor),
      });
    }
  };
  const newlineWidth = (at: number) =>
    source[at] === "\r"
      ? source[at + 1] === "\n"
        ? 2
        : 1
      : source[at] === "\n"
        ? 1
        : 0;

  while (cursor < source.length) {
    const start = cursor;
    const char = source[cursor];
    const next = source[cursor + 1];
    const lineWidth = newlineWidth(cursor);
    if (lineWidth) {
      flushText();
      cursor += lineWidth;
      let count = 1;
      // Blank lines may contain spaces/tabs. Whitespace after the final newline
      // belongs to the following text and must not be consumed here.
      while (cursor < source.length) {
        let probe = cursor;
        while (source[probe] === " " || source[probe] === "\t") probe++;
        const width = newlineWidth(probe);
        if (!width) break;
        cursor = probe + width;
        count++;
      }
      doc.nodes.push(
        count === 1
          ? { ...base(start, cursor), kind: "line-break", count: 1 }
          : { ...base(start, cursor), kind: "paragraph-break", count },
      );
      textStart = cursor;
      continue;
    }
    if (options.literalText) {
      cursor++;
      continue;
    }
    if (char === "\\" && (next === "\\" || next === "$")) {
      flushText();
      cursor += 2;
      doc.nodes.push({
        ...base(start, cursor),
        kind: "escaped-text",
        text: next,
      });
      textStart = cursor;
      continue;
    }

    let open: MathNode["openDelimiter"] | undefined;
    let close: Exclude<MathNode["closeDelimiter"], null> | undefined;
    if (char === "$") {
      open = next === "$" ? "$$" : "$";
      close = open;
    } else if (char === "\\" && (next === "(" || next === "[")) {
      open = next === "(" ? "\\(" : "\\[";
      close = next === "(" ? "\\)" : "\\]";
    }
    if (open && close) {
      flushText();
      cursor += open.length;
      const contentStart = cursor;
      const limit = islands.paragraphEnd(cursor);
      while (cursor < limit && !source.startsWith(close, cursor)) {
        // Paired backslashes escape each other; an odd backslash protects the
        // next delimiter character, including dollars and closing brackets.
        cursor += source[cursor] === "\\" && cursor + 1 < limit ? 2 : 1;
      }
      const contentEnd = cursor;
      const closed = cursor < limit;
      if (closed) cursor += close.length;
      doc.nodes.push({
        ...base(start, cursor),
        kind: open === "$$" || open === "\\[" ? "display-math" : "inline-math",
        content: source.slice(contentStart, contentEnd),
        contentSpan: { start: contentStart, end: contentEnd },
        openDelimiter: open,
        closeDelimiter: closed ? close : null,
        closed,
      });
      if (
        open === "$" &&
        /^\s*\d/.test(source.slice(contentStart, contentEnd)) &&
        (!closed || /[A-Za-z]{2,}/.test(source.slice(contentStart, contentEnd)))
      )
        doc.diagnostics.push({
          code: "ambiguous-dollar-number",
          severity: "warning",
          span: { start, end: cursor },
          message:
            "Dollar-number input may be currency. Explicit delimiter interpretation is retained; escape literal dollars as \\$.",
        });
      if (!closed)
        doc.diagnostics.push({
          code: "unclosed-math",
          severity: "error",
          span: { start, end: cursor },
          message: `Math opened with ${open} has no matching ${close}.`,
        });
      textStart = cursor;
      continue;
    }
    const island =
      options.recognizeBare === false
        ? undefined
        : islands.scan(cursor, cursor === textStart);
    if (island) {
      if (island.kind) {
        flushText();
        cursor = island.end;
        doc.nodes.push({
          ...base(start, cursor),
          kind: island.kind,
          content: source.slice(start, cursor),
          contentSpan: { start, end: cursor },
        });
        textStart = cursor;
      } else if (island.code && island.code !== "bare-ambiguous-formula") {
        flushText();
        cursor = island.end;
        doc.nodes.push({
          ...base(start, cursor),
          kind: "unparsed",
          reason: "ambiguous-formula",
        });
        textStart = cursor;
      } else cursor = island.end;
      if (island.code)
        doc.diagnostics.push({
          code: island.code,
          severity: "warning",
          span: { start, end: island.diagnosticEnd ?? cursor },
          message:
            "Bare formula syntax cannot be interpreted safely; original source retained. Use an explicit domain for ambiguous input.",
        });
      continue;
    }
    if (char === "\\" && (next === ")" || next === "]")) {
      doc.diagnostics.push({
        code: "unexpected-math-close",
        severity: "error",
        span: { start, end: start + 2 },
        message: `Closing delimiter \\${next} has no matching opening delimiter.`,
      });
      cursor += 2;
    } else cursor++;
  }
  flushText();
  return doc;
}
