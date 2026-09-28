import type {
  BrailleCellAtom,
  CellAtom,
  ConversionResult,
  Diagnostic,
  Document,
  SourceSpan,
} from "./model";
import { parseDocument } from "./parser/document";
import { parseMath } from "./parser/math";
import { parseChemistry } from "./parser/chemistry";
import { encodeMath, type MathEncodingOptions } from "./rules/math";
import { encodeChemistry } from "./rules/chemistry";
import { encodePhysics } from "./rules/physics";
import { encodeText, type TextOptions, type TextUnit } from "./rules/text";
import { validWordBoundaries, type ChineseWord } from "./language/chinese";
import { normalizeManualReading } from "./language/reading-validation";
import { braille } from "./rules/math-symbols";
import {
  layout,
  type PublishingOptions,
  type CellMapping,
  type LayoutResult,
} from "./layout";
import { unicodeToBrf } from "./codec";
export interface ConvertOptions extends PublishingOptions, TextOptions {
  colonMeaning?: MathEncodingOptions["colonMeaning"];
  mappingAllowed?: MathEncodingOptions["mappingAllowed"];
  mode?: "document" | "text" | "math" | "chemistry" | "physics";
  /** Independent document recognition controls; omitted preserves existing behavior. */
  recognizeMath?: boolean;
  recognizeChemistry?: boolean;
}
export interface EncodingMetadata {
  chineseWords: ChineseWord[];
  fontProfile: "roman-light-normalized";
  fontDescription: string;
}
export interface EncodedDocument {
  document: Document;
  atoms: CellAtom[];
  diagnostics: Diagnostic[];
  complete: boolean;
  unhandled: TextUnit[];
  metadata: EncodingMetadata;
}
export interface UnifiedConversionResult extends ConversionResult {
  unhandled: TextUnit[];
  metadata: EncodingMetadata;
  mappings: CellMapping[];
  layoutProfile: LayoutResult["profile"];
}
/** Only a single balanced ce wrapper is eligible for whole-formula prose closure. */
function isWholeChemicalWrapper(raw: string): boolean {
  const value = raw.trim();
  if (!value.startsWith("\\ce{")) return false;
  let depth = 1,
    cursor = 4;
  while (cursor < value.length && depth) {
    if (
      value[cursor] === "\\" &&
      (value[cursor + 1] === "{" || value[cursor + 1] === "}")
    ) {
      cursor += 2;
      continue;
    }
    if (value[cursor] === "{") depth++;
    else if (value[cursor] === "}") depth--;
    cursor++;
  }
  return depth === 0 && cursor === value.length;
}
const FONT_DESCRIPTION =
  "Roman-light normalized profile: unstyled mathematical letters use Roman light; explicit supported styles are retained. This is not TeX font fidelity and does not infer variable, constant, or unit meaning.";
/** Encoding is separate from layout so editor reading decisions never require repartitioning words. */
export function encodeDocument(
  source: string | Document,
  options: ConvertOptions = {},
): EncodedDocument {
  const standalone =
    options.mode && options.mode !== "document" && options.mode !== "text";
  // A selected domain is authoritative; weak auto-recognition warnings must not
  // survive a deliberate explicit-mode choice, including pre-parsed documents.
  let document =
    options.mode === "text"
      ? parseDocument(typeof source === "string" ? source : source.source, {
          literalText: true,
        })
      : standalone
        ? parseDocument(typeof source === "string" ? source : source.source, {
            recognizeBare: false,
          })
        : typeof source === "string"
          ? parseDocument(source)
          : source;
  if (!standalone && options.mode !== "text") {
    const diagnostics: Diagnostic[] = [];
    document = {
      ...document,
      nodes: document.nodes.map((node) => {
        const formula = node.kind === "inline-math" || node.kind === "display-math" || node.kind === "bare-math";
        const wholeChemical = formula && isWholeChemicalWrapper(node.content);
        const disabledChemical = options.recognizeChemistry === false &&
          (node.kind === "chemistry" || (formula && node.content.includes("\\ce{")));
        const disabledMath = options.recognizeMath === false && formula && !wholeChemical;
        if (disabledChemical || disabledMath) {
          diagnostics.push({ code: "domain-disabled-literal", severity: "info", span: node.span,
            message: `${disabledChemical ? "Chemistry" : "Mathematics"} recognition is disabled; this source scope is encoded as literal text.` });
          return { id: node.id, kind: "text" as const, span: node.span, raw: node.raw, text: node.raw };
        }
        if (wholeChemical && options.recognizeMath === false)
          return { id: node.id, kind: "chemistry" as const, span: node.span, raw: node.raw, content: node.content, contentSpan: node.contentSpan };
        return node;
      }),
      diagnostics: [...document.diagnostics, ...diagnostics],
    };
  }
  const output: EncodedDocument = {
    document,
    atoms: [],
    diagnostics: [...document.diagnostics],
    complete: true,
    unhandled: [],
    metadata: {
      chineseWords: [],
      fontProfile: "roman-light-normalized",
      fontDescription: FONT_DESCRIPTION,
    },
  };
  if (options.wordBoundaries !== undefined && !validWordBoundaries(document.source, options.wordBoundaries)) {
    options = { ...options, wordBoundaries: undefined };
    output.diagnostics.push({code: "CHINESE_INVALID_WORD_BOUNDARIES", severity: "warning",
      span: {start: 0, end: document.source.length},
      message: "Invalid automatic word boundaries; local proposals retained."});
  }
  for (const override of options.overrides ?? []) {
    if (
      !Number.isInteger(override.start) ||
      !Number.isInteger(override.end) ||
      override.start < 0 ||
      override.end > document.source.length ||
      override.start >= override.end ||
      override.readings.length !== [...document.source.slice(override.start, override.end)].length ||
      override.readings.some(reading => !normalizeManualReading(reading)) ||
      !/^\p{Script=Han}+$/u.test(
        document.source.slice(override.start, override.end),
      )
    ) {
      output.diagnostics.push({
        code: "CHINESE_INVALID_OVERRIDE",
        severity: "error",
        span: { start: 0, end: document.source.length },
        message:
          "Reading override must cover a nonempty Han range inside the original document.",
      });
    }
  }
  let serial = 0,
    usedMath = false;
  const make = (
    cells: string,
    span: SourceSpan,
    ruleId = "GBT18028-2010-5.4",
  ): BrailleCellAtom => ({
    kind: "cell",
    cells,
    span,
    ruleId,
    group: `document:${serial++}`,
    breakBefore: false,
    breakAfter: true,
  });
  const blank = (span: SourceSpan) => {
    if (output.atoms.length) {
      const last = output.atoms.at(-1)!;
      if (last.kind === "cell" && !/^\u2800+$/.test(last.cells))
        output.atoms.push(make(braille(["0"]), span));
    }
  };
  type DomainResult = {
    atoms: BrailleCellAtom[];
    diagnostics: Diagnostic[];
    unhandled: readonly TextUnit[];
    complete: boolean;
    words?: ChineseWord[];
    chineseWords?: ChineseWord[];
  };
  const accept = (
    r: DomainResult,
    frame: boolean,
    chemical: boolean,
    span: SourceSpan,
  ) => {
    const namespace = `domain:${serial++}`;
    let atoms = r.atoms.map((a) => ({
      ...a,
      group: `${namespace}:${a.group}`,
    }));
    // Prefix maxima locate the first source anchor without sorting domain output.
    // This stays O(atoms + unhandled*log(atoms)), including all-unknown documents.
    const represented = new Set(
      atoms
        .filter((a) => a.ruleId === "unhandled-placeholder")
        .map((a) => `${a.span.start}:${a.span.end}`),
    );
    const maxima: number[] = [];
    let maximum = -1;
    for (const a of atoms) {
      maximum = Math.max(maximum, a.span.start);
      maxima.push(maximum);
    }
    const insertions = new Map<number, BrailleCellAtom[]>();
    for (const unit of r.unhandled) {
      const key = `${unit.span.start}:${unit.span.end}`;
      if (represented.has(key)) continue;
      represented.add(key);
      let low = 0,
        high = maxima.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (maxima[middle] >= unit.span.end) high = middle;
        else low = middle + 1;
      }
      const bucket = insertions.get(low) ?? [];
      bucket.push(
        make(braille(["123456"]), unit.span, "unhandled-placeholder"),
      );
      insertions.set(low, bucket);
    }
    if (insertions.size) {
      const merged: BrailleCellAtom[] = [];
      for (let i = 0; i <= atoms.length; i++) {
        for (const a of insertions.get(i) ?? []) merged.push(a);
        if (i < atoms.length) merged.push(atoms[i]);
      }
      atoms = merged;
    }
    if (frame && atoms.length) {
      blank({ start: span.start, end: span.start });
      atoms[0] = { ...atoms[0], cells: braille(["46"]) + atoms[0].cells };
      if (chemical)
        atoms[atoms.length - 1] = {
          ...atoms.at(-1)!,
          cells: atoms.at(-1)!.cells + braille(["156"]),
        };
    }
    const previous = output.atoms.at(-1);
    if (
      atoms[0] &&
      /^\u2800+$/.test(atoms[0].cells) &&
      previous?.kind === "cell" &&
      previous.span.start === previous.span.end &&
      /^\u2800+$/.test(previous.cells)
    )
      output.atoms.pop();
    for (const atom of atoms) output.atoms.push(atom);
    output.diagnostics.push(...r.diagnostics);
    output.unhandled.push(...r.unhandled);
    output.metadata.chineseWords.push(...(r.words ?? r.chineseWords ?? []));
    output.complete &&= r.complete;
    if (frame && atoms.length) blank({ start: span.end, end: span.end });
  };
  const chemical = (raw: string, span: SourceSpan) =>
    encodeChemistry(parseChemistry(raw, span), {
      chinese: options.chinese,
      chineseOverrides: options.overrides,
      wordBoundaries: options.wordBoundaries,
      analyzeChinese: options.analyze,
    });
  const mathOptions: MathEncodingOptions = {
    colonMeaning: options.colonMeaning,
    mappingAllowed: options.mappingAllowed,
    chinese: options.chinese,
    chineseOverrides: options.overrides,
    wordBoundaries: options.wordBoundaries,
    analyzeChinese: options.analyze,
    chemistry: (n) => {
      const r = chemical(n.raw, n.span);
      return {
        ...r,
        unhandled: r.unhandled.map((u) => ({
          kind: "unknown" as const,
          raw: u.raw,
          span: u.span,
          reason: "chemistry-unhandled",
        })),
      };
    },
  };
  const math = (raw: string, span: SourceSpan) => {
    usedMath = true;
    return encodeMath(parseMath(raw, span), mathOptions);
  };
  if (standalone) {
    const span = { start: 0, end: document.source.length };
    if (document.source.length > 100000) {
      output.complete = false;
      output.unhandled.push({ raw: document.source, span });
      output.atoms.push(
        make(braille(["123456"]), span, "unhandled-placeholder"),
      );
    } else
      accept(
        options.mode === "chemistry"
          ? chemical(document.source, span)
          : options.mode === "physics"
            ? ((usedMath = true),
              encodePhysics(document.source, { ...mathOptions, unit: true }))
            : math(document.source, span),
        false,
        false,
        span,
      );
  } else {
    const containsProse = document.nodes.some(
      (n) =>
        (n.kind === "text" || n.kind === "escaped-text") && /\S/u.test(n.text),
    );
    const text = (raw: string, base: number) =>
      accept(encodeText(raw, base, options), false, false, {
        start: base,
        end: base + raw.length,
      });
    for (let nodeIndex = 0; nodeIndex < document.nodes.length; nodeIndex++) {
      const node = document.nodes[nodeIndex],
        nextNode = document.nodes[nodeIndex + 1];
      if (
        node.kind === "inline-math" ||
        node.kind === "display-math" ||
        node.kind === "bare-math"
      ) {
        if (
          node.kind === "display-math" &&
          output.atoms.at(-1)?.kind === "cell"
        )
          output.atoms.push({
            kind: "line-break",
            span: node.span,
            group: `display:${serial++}`,
            ruleId: "document-display",
            breakBefore: false,
            breakAfter: false,
          });
        const isChemical = isWholeChemicalWrapper(node.content);
        if (
          containsProse &&
          node.kind === "inline-math" &&
          !isChemical &&
          node.content.includes("\\ce{")
        ) {
          output.diagnostics.push({
            code: "mixed-chemistry-prose-unverified",
            severity: "warning",
            span: node.contentSpan,
            message:
              "Mixed chemical and mathematical scopes in prose need separately checked chemical closure placement; no whole-expression chemical ending marker was added.",
          });
        }
        accept(
          math(node.content, node.contentSpan),
          containsProse && node.kind !== "display-math",
          isChemical,
          node.span,
        );
        if (
          node.kind === "display-math" &&
          nextNode &&
          nextNode.kind !== "line-break" &&
          nextNode.kind !== "paragraph-break"
        )
          output.atoms.push({
            kind: "line-break",
            span: node.span,
            group: `display:${serial++}`,
            ruleId: "document-display",
            breakBefore: false,
            breakAfter: false,
          });
      } else if (node.kind === "line-break" || node.kind === "paragraph-break")
        output.atoms.push({
          kind: node.kind,
          count: node.count,
          span: node.span,
          group: `break:${serial++}`,
          ruleId: "document-break",
          breakBefore: false,
          breakAfter: false,
        });
      else if (node.kind === "unparsed") {
        output.unhandled.push(node);
        output.atoms.push(
          make(braille(["123456"]), node.span, "unhandled-placeholder"),
        );
        output.complete = false;
      } else if (node.kind === "escaped-text") {
        // Keep the full escape as the source range even though its text payload is one scalar.
        const r = encodeText(node.text, node.span.start, options);
        r.atoms = r.atoms.map((a) => ({ ...a, span: node.span }));
        r.unhandled = r.unhandled.map((u) => ({
          ...u,
          raw: node.raw,
          span: node.span,
        }));
        r.diagnostics = r.diagnostics.map((d) => ({ ...d, span: node.span }));
        accept(r, false, false, node.span);
      } else if (node.kind === "chemistry") {
        accept(
          chemical(node.content, node.contentSpan),
          containsProse,
          true,
          node.span,
        );
      } else if (node.kind === "text") {
        text(node.text, node.span.start);
      }
    }
  }
  // Domain-local punctuation grouping cannot resolve formula spacing at the
  // composition boundary. Retain the required blank and expose the uncertainty.
  for (let i = 0; i < output.atoms.length; i++) {
    const atom = output.atoms[i],
      previous = output.atoms[i - 1];
    if (
      atom.kind !== "cell" ||
      atom.ruleId !== "GF0019-2018-8" ||
      document.source.slice(atom.span.start, atom.span.end) !== "·"
    )
      continue;
    if (
      previous?.kind !== "cell" ||
      /^\u2800+$/.test(previous.cells) ||
      previous.group !== atom.group
    ) {
      output.diagnostics.push({
        code: "interpunct-adjacency-unverified",
        severity: "warning",
        span: atom.span,
        ruleId: "GBT44725-2024-4.8.5",
        message:
          "Interpunct requires attachment to preceding text. This composition boundary or required formula space has no checked adjacency rule; cells and spacing are retained for review.",
      });
    }
  }
  if (usedMath)
    output.diagnostics.push({
      code: "font-normalization-profile",
      severity: "info",
      span: { start: 0, end: document.source.length },
      message: FONT_DESCRIPTION,
    });
  // Normative bounded joins/splits can adjust a model word. Validate covered
  // source intervals rather than requiring those editable partitions to match.
  const encodedHanCoverage: SourceSpan[] = [];
  if (options.wordBoundaries?.length) for (const word of output.metadata.chineseWords
    .filter(w => w.kind === "chinese").sort((a,b) => a.span.start - b.span.start)) {
    const last = encodedHanCoverage.at(-1);
    if (last && word.span.start <= last.end) last.end = Math.max(last.end, word.span.end);
    else encodedHanCoverage.push({...word.span});
  }
  if (options.wordBoundaries?.some(p =>
    !(options.overrides ?? []).some(o => o.start < p.end && o.end > p.start) &&
    !encodedHanCoverage.some(span => span.start <= p.start && span.end >= p.end))) {
    output.diagnostics.push({code:"CHINESE_INVALID_WORD_BOUNDARIES",severity:"warning",
      span:{start:0,end:document.source.length},message:"Automatic boundaries cannot cross parsed text/formula boundaries; unmatched proposals were ignored."});
  }
  output.complete &&=
    output.unhandled.length === 0 &&
    !output.diagnostics.some((d) => d.severity !== "info");
  return output;
}
export function reflowExistingAtoms(
  encoded: EncodedDocument,
  options: PublishingOptions = {},
): UnifiedConversionResult {
  const r = layout(encoded.atoms, options);
  const unicode = r.pages.map((p) => p.join("\n")).join("\f");
  return {
    ...encoded,
    lines: r.lines,
    pages: r.pages,
    unicode,
    brf: unicodeToBrf(unicode),
    diagnostics: [...encoded.diagnostics, ...r.diagnostics],
    complete: encoded.complete && r.complete,
    mappings: r.mappings,
    layoutProfile: r.profile,
  };
}
export function convert(
  source: string,
  options: ConvertOptions = {},
): UnifiedConversionResult {
  return reflowExistingAtoms(encodeDocument(source, options), options);
}
