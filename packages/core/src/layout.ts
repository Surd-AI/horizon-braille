import type {
  BrailleCellAtom,
  CellAtom,
  Diagnostic,
  LayoutOptions,
  SourceSpan,
} from "./model";
import { isSixDot } from "./codec";
const SPACE = "\u2800";
export interface PublishingOptions extends Partial<LayoutOptions> {
  profile?: "custom" | "book-body";
  /** Explicit labels: §4.5.3 verifies placement, not body digit typography. */
  pageNumbers?: { labels: readonly string[]; duplex?: boolean };
}
export interface CellMapping {
  atomIndex: number | null;
  span: SourceSpan;
  line: number;
  column: number;
  length: number;
  page: number;
  row: number;
  kind: "atom" | "continuation" | "indent" | "control" | "footer";
  omittedAtWrap?: boolean;
}
export interface LayoutResult {
  lines: string[];
  pages: string[][];
  mappings: CellMapping[];
  diagnostics: Diagnostic[];
  complete: boolean;
  profile: {
    name: "custom" | "book-body";
    columns: number;
    bodyRows: number;
    paragraphIndent: number;
    indentPolicy: "editorial-default-or-explicit";
  };
}
interface Unit {
  indices: number[];
  atoms: BrailleCellAtom[];
  cells: string;
  blank: boolean;
}
interface Piece {
  cells: string;
  atomIndex: number | null;
  span: SourceSpan;
  kind: CellMapping["kind"];
  omittedAtWrap?: boolean;
}
const zero = { start: 0, end: 0 };
/** Domain-independent layout. Atomic groups override optional breaks. No hard cutting. */
export function layout(
  atoms: readonly CellAtom[],
  input: PublishingOptions = {},
): LayoutResult {
  const profile = input.profile ?? "custom",
    columns = input.columns ?? 30,
    rows = input.rows ?? 25,
    indent = input.paragraphIndent ?? 2;
  const result: LayoutResult = {
    lines: [],
    pages: [],
    mappings: [],
    diagnostics: [],
    complete: true,
    profile: {
      name: profile,
      columns,
      bodyRows: rows,
      paragraphIndent: indent,
      indentPolicy: "editorial-default-or-explicit",
    },
  };
  const fail = (code: string, message: string, span: SourceSpan = zero) => {
    result.complete = false;
    result.diagnostics.push({ code, severity: "error", message, span });
  };
  if (
    !Number.isInteger(columns) ||
    columns < 1 ||
    columns > 1000 ||
    !Number.isInteger(rows) ||
    rows < 1 ||
    rows > 1000 ||
    !Number.isInteger(indent) ||
    indent < 0 ||
    indent >= columns ||
    !["custom", "book-body"].includes(profile) ||
    (profile === "book-body" && (columns !== 30 || rows !== 25)) ||
    (input.pageNumbers && profile !== "book-body")
  ) {
    fail(
      "layout-invalid-options",
      "Columns/rows must be integers in 1..1000 and indentation in 0..columns-1. Book-body requires 30 columns/25 body rows; footers require that profile.",
    );
    return result;
  }
  if (atoms.length > 200000) {
    fail("layout-resource-limit", "At most 200000 atoms may be laid out.");
    return result;
  }
  let cellCount = 0;
  for (let index = 0; index < atoms.length; index++) {
    const atom = atoms[index],
      previous = atoms[index - 1];
    if (
      atom.kind === "cell" &&
      previous?.kind === "cell" &&
      atom.group === previous.group &&
      (atom.rowStart || previous.rowEnd || atom.rowSeparator)
    )
      fail(
        "layout-conflicting-control",
        "An explicit row control may not split adjacent atoms sharing an atomic group.",
        atom.span,
      );
    if (atom.kind === "cell") {
      cellCount += atom.cells.length;
      if (
        !isSixDot(atom.cells) ||
        (atom.continuation &&
          (!isSixDot(atom.continuation.lineEnd, true) ||
            !isSixDot(atom.continuation.lineStart, true))) ||
        (atom.continuationIndent !== undefined &&
          (!Number.isInteger(atom.continuationIndent) ||
            atom.continuationIndent < 0 ||
            atom.continuationIndent >= columns))
      )
        fail(
          "layout-invalid-cells",
          "Atoms/continuations must contain six-dot cells and valid indentation.",
          atom.span,
        );
    } else if (
      atom.count !== undefined &&
      (!Number.isInteger(atom.count) || atom.count < 1 || atom.count > 1000)
    )
      fail(
        "layout-invalid-control",
        "Break count must be an integer in 1..1000.",
        atom.span,
      );
  }
  if (cellCount > 2000000)
    fail("layout-resource-limit", "At most 2000000 cells may be laid out.");
  if (input.pageNumbers?.labels.some((s) => !isSixDot(s) || s.length > columns))
    fail(
      "layout-invalid-options",
      "Page-number labels must be nonempty six-dot cells fitting the footer.",
    );
  if (!result.complete) return result;
  let paragraph = true,
    pending: Unit[] = [],
    rowIndent = 0;
  const forcedPages = new Set<number>();
  const commit = (pieces: Piece[]) => {
    if (result.lines.length >= 200000) {
      fail(
        "layout-resource-limit",
        "At most 200000 output lines may be laid out.",
      );
      return;
    }
    const line = result.lines.length;
    let column = 0;
    result.lines.push(pieces.map((p) => p.cells).join(""));
    for (const p of pieces) {
      result.mappings.push({
        ...p,
        line,
        column,
        length: p.cells.length,
        page: 0,
        row: 0,
      });
      column += p.cells.length;
    }
  };
  const atomPieces = (unit: Unit): Piece[] =>
    unit.atoms.map((a, i) => ({
      cells: a.cells,
      atomIndex: unit.indices[i],
      span: a.span,
      kind: "atom",
    }));
  const flush = () => {
    if (!pending.length) return;
    const units = pending;
    pending = [];
    const heading = units.some((u) =>
      u.atoms.some((a) => a.role === "heading"),
    );
    if (heading) {
      const width = units.reduce((n, u) => n + u.cells.length, 0),
        pad = Math.max(4, Math.floor((columns - width) / 2));
      if (width + pad > columns) {
        fail(
          "layout-overflow",
          "Heading cannot fit with at least four leading blank cells (§4.5.1).",
          units[0].atoms[0].span,
        );
        return;
      }
      const level = units[0].atoms[0].headingLevel ?? 3;
      if (level <= 2 && result.lines.length && result.lines.at(-1) !== "")
        commit([]);
      commit([
        {
          cells: SPACE.repeat(pad),
          atomIndex: null,
          span: units[0].atoms[0].span,
          kind: "indent",
        },
        ...units.flatMap(atomPieces),
      ]);
      if (level <= 2) commit([]);
      paragraph = false;
      return;
    }
    let start = 0,
      prefix = paragraph ? SPACE.repeat(indent) : "",
      prefixSpan = units[0].atoms[0].span;
    let prefixKind: CellMapping["kind"] = "indent";
    paragraph = false;
    while (start < units.length && result.complete) {
      let width = prefix.length,
        end = start,
        lastBreak = -1,
        breakEnd = "",
        breakStart = "",
        trimFrom = -1;
      while (end < units.length && width + units[end].cells.length <= columns) {
        width += units[end].cells.length;
        end++;
        if (end === units.length) break;
        const left = units[end - 1],
          right = units[end],
          last = left.atoms.at(-1)!,
          first = right.atoms[0];
        if (last.breakAfter || first.breakBefore) {
          const blankBoundary = left.blank || right.blank;
          const continuation = blankBoundary
            ? { lineEnd: "", lineStart: "" }
            : (last.continuation ?? { lineEnd: "", lineStart: "" });
          let trimmedWidth = width,
            trim = end;
          while (trim > start && units[trim - 1].blank) {
            trimmedWidth -= units[--trim].cells.length;
          }
          if (
            trim > start &&
            trimmedWidth + continuation.lineEnd.length <= columns
          ) {
            lastBreak = end;
            breakEnd = continuation.lineEnd;
            breakStart = continuation.lineStart;
            trimFrom = trim;
          }
        }
      }
      if (end === units.length) {
        commit([
          ...(prefix
            ? [
                {
                  cells: prefix,
                  atomIndex: null,
                  span: prefixSpan,
                  kind: prefixKind,
                },
              ]
            : []),
          ...units.slice(start).flatMap(atomPieces),
        ]);
        break;
      }
      if (lastBreak < 0) {
        fail(
          "layout-overflow",
          "No supported legal break fits available cells; an atomic group or continuation cannot be split.",
          units[start].atoms[0].span,
        );
        break;
      }
      const pieces: Piece[] = [
        ...(prefix
          ? [
              {
                cells: prefix,
                atomIndex: null,
                span: prefixSpan,
                kind: prefixKind,
              },
            ]
          : []),
        ...units.slice(start, trimFrom).flatMap(atomPieces),
      ];
      const boundarySpan = units[lastBreak - 1].atoms.at(-1)!.span;
      if (breakEnd)
        pieces.push({
          cells: breakEnd,
          atomIndex: null,
          span: boundarySpan,
          kind: "continuation",
        });
      let next = lastBreak;
      while (next < units.length && units[next].blank) next++;
      for (let i = trimFrom; i < next; i++)
        for (const p of atomPieces(units[i]))
          pieces.push({ ...p, cells: "", omittedAtWrap: true });
      commit(pieces);
      prefix = SPACE.repeat(rowIndent) + breakStart;
      prefixSpan = boundarySpan;
      prefixKind = "continuation";
      start = next;
    }
  };
  for (let i = 0; i < atoms.length && result.complete; i++) {
    const atom = atoms[i];
    if (atom.kind !== "cell") {
      const hadPending = pending.length > 0;
      flush();
      if (!hadPending) commit([]);
      result.mappings.push({
        atomIndex: i,
        span: atom.span,
        line: Math.max(0, result.lines.length - 1),
        column: 0,
        length: 0,
        page: 0,
        row: 0,
        kind: "control",
      });
      if (atom.kind === "page-break") forcedPages.add(result.lines.length);
      else if (atom.kind === "paragraph-break") {
        for (let n = 1; n < (atom.count ?? 2); n++) commit([]);
        paragraph = true;
      }
      rowIndent = 0;
      continue;
    }
    if (atom.rowSeparator) {
      flush();
      result.mappings.push({
        atomIndex: i,
        span: atom.span,
        line: Math.max(0, result.lines.length - 1),
        column: 0,
        length: 0,
        page: 0,
        row: 0,
        kind: "control",
      });
      continue;
    }
    if (atom.rowStart) {
      flush();
      paragraph = false;
      rowIndent = atom.continuationIndent ?? 2;
    }
    if (pending.length && pending[0].atoms[0].role !== atom.role) flush();
    const prev = pending.at(-1);
    if (prev && prev.atoms.at(-1)!.group === atom.group) {
      prev.atoms.push(atom);
      prev.indices.push(i);
      prev.cells += atom.cells;
      prev.blank =
        prev.blank && /^\u2800+$/.test(atom.cells) && !atom.preserveSpace;
    } else
      pending.push({
        indices: [i],
        atoms: [atom],
        cells: atom.cells,
        blank: /^\u2800+$/.test(atom.cells) && !atom.preserveSpace,
      });
    if (atom.rowEnd) {
      flush();
      rowIndent = 0;
    }
  }
  flush();
  if (
    atoms.at(-1)?.kind === "line-break" ||
    atoms.at(-1)?.kind === "paragraph-break"
  )
    commit([]);
  if (!result.complete) {
    result.lines = [];
    result.pages = [];
    result.mappings = [];
    return result;
  }
  const coordinates: { page: number; row: number }[] = [];
  for (let line = 0; line < result.lines.length; line++) {
    if (
      !result.pages.length ||
      result.pages.at(-1)!.length === rows ||
      forcedPages.has(line)
    )
      result.pages.push([]);
    coordinates.push({
      page: result.pages.length - 1,
      row: result.pages.at(-1)!.length,
    });
    result.pages.at(-1)!.push(result.lines[line]);
  }
  for (const mapping of result.mappings)
    Object.assign(mapping, coordinates[mapping.line] ?? { page: 0, row: 0 });
  if (input.pageNumbers) {
    result.pages.forEach((page, index) => {
      while (page.length < 25) page.push("");
      const visible = !input.pageNumbers!.duplex || index % 2 === 0;
      const label = input.pageNumbers!.labels[index];
      if (visible && !label) {
        fail(
          "layout-missing-page-label",
          "A visible footer needs an explicit page-number cell label.",
        );
        return;
      }
      page.push(visible ? SPACE.repeat(columns - label.length) + label : "");
      if (visible)
        result.mappings.push({
          atomIndex: null,
          span: zero,
          line: -1,
          column: columns - label.length,
          length: label.length,
          page: index,
          row: 25,
          kind: "footer",
        });
    });
  }
  if (!result.complete) {
    result.lines = [];
    result.pages = [];
    result.mappings = [];
  }
  return result;
}
