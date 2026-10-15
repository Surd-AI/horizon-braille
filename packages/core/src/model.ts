/** All source positions are half-open UTF-16 offsets into Document.source. */
export interface SourceSpan {
  start: number;
  end: number;
}

export interface Diagnostic {
  code: string;
  severity: "info" | "warning" | "error";
  span: SourceSpan;
  message: string;
  ruleId?: string;
}

export interface NodeBase {
  /** Deterministic within one parse; not a persistent editor identity. */
  id: string;
  span: SourceSpan;
  raw: string;
}

export interface TextNode extends NodeBase {
  kind: "text";
  text: string;
}
export interface EscapedTextNode extends NodeBase {
  kind: "escaped-text";
  text: string;
}
export interface CodeNode extends NodeBase {
  kind:'code-block'|'code-span';
  /** Verbatim source content; no HTML whitespace normalization or execution. */
  content:string;
  contentSpan:SourceSpan;
  openingSpan:SourceSpan;
  closingSpan:SourceSpan;
  closed:boolean;
  info?:string;
  infoSpan?:SourceSpan;
  quoteLinePrefixes?:{span:SourceSpan;level:number}[];
}
export interface MarkdownMarkerNode extends NodeBase {
  kind:'markdown-marker';
  role:'heading'|'heading-end'|'list-item'|'separator'|'blockquote'|'emphasis-start'|'emphasis-end'|'strong-start'|'strong-end';
  indent:number;
  level?:number;
  ordinal?:string;
  bullet?:string;
}
export interface LineBreakNode extends NodeBase {
  kind: "line-break";
  count: 1;
}
export interface ParagraphBreakNode extends NodeBase {
  kind: "paragraph-break";
  count: number;
}

export interface MathNode extends NodeBase {
  kind: "inline-math" | "display-math";
  /** Raw inner TeX; domain parsing is a subsequent stage. */
  content: string;
  contentSpan: SourceSpan;
  openDelimiter: "$" | "$$" | "\\(" | "\\[";
  closeDelimiter: "$" | "$$" | "\\)" | "\\]" | null;
  closed: boolean;
}

export interface BareFormulaNode extends NodeBase {
  kind: "bare-math" | "chemistry";
  content: string;
  contentSpan: SourceSpan;
}

/** Source preserved without a guessed semantic interpretation, or beyond a resource limit. */
export interface UnparsedNode extends NodeBase {
  kind: "unparsed";
  reason: "resource-limit" | "ambiguous-formula";
}
export type Node =
  | TextNode
  | EscapedTextNode
  | CodeNode
  | MarkdownMarkerNode
  | LineBreakNode
  | ParagraphBreakNode
  | MathNode
  | BareFormulaNode
  | UnparsedNode;
export interface Document {
  source: string;
  nodes: Node[];
  diagnostics: Diagnostic[];
}

/**
 * Continuation markers contain only six-dot Unicode braille (U+2800..U+283F).
 * Empty strings mean no marker. Encoding/layout consumers validate this range.
 */
export interface Continuation {
  lineEnd: string;
  lineStart: string;
}
export interface AtomBase {
  span: SourceSpan;
  ruleId: string;
  /** Adjacent atoms with the same group must stay together. */
  group: string;
  breakBefore: boolean;
  breakAfter: boolean;
  continuation?: Continuation;
}
export interface BrailleCellAtom extends AtomBase {
  /** Generated framing/direction cells whose source span may enclose content. */
  sourceRole?: 'structure';
  kind: "cell";
  /** Nonempty six-dot Unicode braille (U+2800..U+283F), validated by the codec. */
  cells: string;
  preserveSpace?: boolean;
  textMarker?: boolean;
  role?: "heading";
  headingLevel?: number;
  /** Linear representation separator rendered as a row control by layout. */
  rowSeparator?: boolean;
  rowStart?: boolean;
  /** Start a matrix row without separating its preceding formula prefix. */
  rowStartInline?: boolean;
  /** §6.17.2.6: leave a blank line before the next matrix in a composition. */
  rowGapBefore?: boolean;
  rowEnd?: boolean;
  continuationIndent?: number;
}
/** Explicit controls consume no cells and cannot be confused with braille blanks. */
export interface BreakAtom extends AtomBase {
  kind: "line-break" | "paragraph-break" | "page-break";
  count?: number;
}
export type CellAtom = BrailleCellAtom | BreakAtom;
export interface LayoutOptions {
  columns: number;
  rows: number;
  paragraphIndent: number;
  strict: boolean;
}
export interface ConversionResult {
  document: Document;
  atoms: CellAtom[];
  lines: string[];
  pages: string[][];
  unicode: string;
  brf: string;
  diagnostics: Diagnostic[];
  complete: boolean;
}
