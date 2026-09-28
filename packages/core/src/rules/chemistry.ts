import type { BrailleCellAtom, Diagnostic, SourceSpan } from "../model";
import {
  parseChemistry,
  type ChemicalNode,
  type ChemicalPart,
} from "../parser/chemistry";
import type { MathEncodingOptions } from "./math";
import { braille, DIGITS, LOWER_DIGITS, LATIN_DOTS } from "./math-symbols";
import type { ChineseWord } from "../language/chinese";
import { encodeText, type TextOptions } from "./text";
import type { ChineseEncodingOptions } from "./chinese";
export interface ChemicalEncoding {
  chineseWords?: ChineseWord[];
  atoms: BrailleCellAtom[];
  diagnostics: Diagnostic[];
  unhandled: ChemicalPart[];
  complete: boolean;
}
export interface ChemicalEncodingOptions {
  chineseOverrides?: TextOptions["overrides"];
  wordBoundaries?: TextOptions["wordBoundaries"];
  analyzeChinese?: TextOptions["analyze"];
  chinese?: ChineseEncodingOptions;
}
const letters = (v: string) =>
  Array.from(v, (c) => LATIN_DOTS[c.toLowerCase().charCodeAt(0) - 97]);
const numbers = (v: string) => ["3456", ...Array.from(v, (c) => DIGITS[+c])];
const lowered = (v: string) => Array.from(v, (c) => LOWER_DIGITS[+c]);
/** Pure bounded-profile encoding. Groups are indivisible chemical terms;
 * reaction/addition boundaries expose legal splits. No hard wrapping. */
export function encodeChemistry(
  node: ChemicalNode,
  options: ChemicalEncodingOptions = {},
): ChemicalEncoding {
  const chineseWords: ChineseWord[] = [];
  const atoms: BrailleCellAtom[] = [],
    diagnostics = [...node.diagnostics],
    unhandled: ChemicalPart[] = [];
  let serial = 0,
    group = `chemistry:${node.span.start}:${serial}`;
  // GB/T 18028-2010 §8.2.2.1 treats a pure substance's formula as a
  // single element followed, when needed, by a lowered atom count. This is
  // narrower than the general molecular-index rule in §8.2.2.4.
  const simpleSubstance = node.children.filter((part) => part.kind !== "Whitespace");
  const pureElementFormula =
    simpleSubstance[0]?.kind === "Element" &&
    (simpleSubstance.length === 1 ||
      (simpleSubstance.length === 2 && simpleSubstance[1]?.kind === "Count" && !simpleSubstance[1].symbolic));
  const emit = (
    d: readonly string[],
    n: { span: SourceSpan },
    clause: string,
  ) => {
    if (!d.length) return;
    atoms.push({
      kind: "cell",
      cells: braille(d.map((x) => (x === "SP" ? "0" : x))),
      span: n.span,
      ruleId: "GBT18028-2010-" + clause,
      group,
      breakBefore: false,
      breakAfter: false,
    });
  };
  const keep = (n: ChemicalPart, reason: string) => {
    unhandled.push(n);
    diagnostics.push({
      code: "chemistry-unhandled",
      severity: "warning",
      span: n.span,
      message: reason,
    });
  };
  const boundary = (n: ChemicalPart, space: boolean) => {
    if (atoms.length) {
      atoms.at(-1)!.breakAfter = true;
      if (!space)
        atoms.at(-1)!.continuation = { lineEnd: braille(["6"]), lineStart: "" };
    }
    group = `chemistry:${node.span.start}:${++serial}`;
    if (space) {
      emit(["SP"], n, "8.2.2.8");
      atoms.at(-1)!.breakAfter = true;
      group = `chemistry:${node.span.start}:${++serial}`;
    }
  };
  const condition = (n: Extract<ChemicalPart, { kind: "Condition" }>) => {
    if (!n.content.trim()) return;
    emit([n.position === "above" ? "45" : "56"], n, "8.2.2.9");
    if (n.content === "Δ" || n.content === "\\Delta") {
      emit(["456", "256"], n, "8.2.1");
    } else if (
      /^[\p{Script=Han}\s]+$/u.test(n.content) &&
      /\p{Script=Han}/u.test(n.content)
    ) {
      const result = encodeText(n.content, n.contentSpan.start, {
        chinese: options.chinese,
        overrides: options.chineseOverrides,
        wordBoundaries: options.wordBoundaries,
        analyze: options.analyzeChinese,
        mathText: true,
      });
      diagnostics.push(...result.diagnostics);
      chineseWords.push(...result.words);
      atoms.push(
        ...result.atoms.map((a) => ({
          ...a,
          ...(a.textMarker
            ? { span: n.span, ruleId: "GBT18028-2010-8.2.2.9" }
            : {}),
          group,
          breakBefore: false,
          breakAfter: false,
          continuation: undefined,
        })),
      );
      if (result.unhandled.length)
        keep(n, "Chinese reaction condition is only partially encoded");
      emit(["6"], n, "8.2.2.9");
    } else if (/^[A-Za-z]+$/.test(n.content)) {
      let type = "";
      for (const c of n.content) {
        const next = c === c.toUpperCase() ? "6" : "56";
        emit([...(type === next ? [] : [next]), ...letters(c)], n, "8.2.2.9");
        type = next;
      }
    } else
      keep(
        n,
        "Condition requires verified heat, Latin label, or Chinese text; unsupported content retained",
      );
    emit(["156"], n, "8.2.2.9");
  };
  const visit = (list: ChemicalPart[]) => {
    let capitalRun = false;
    for (let index = 0; index < list.length; index++) {
      const n = list[index];
      if (n.kind === "Whitespace") continue;
      if (n.kind !== "Element" && n.kind !== "Count" && n.kind !== "Oxidation") capitalRun = false;
      switch (n.kind) {
        case "Element": {
          if (n.symbol.length > 1) {
            emit(["6", ...letters(n.symbol)], n, "8.1.2.1");
            capitalRun = false;
            break;
          }
          if (!capitalRun) {
            let count = 0;
            for (let j = index; j < list.length; j++) {
              const next = list[j];
              if (next.kind === "Count" || next.kind === "Oxidation") continue;
              if (next.kind === "Element" && next.symbol.length === 1) {
                count++;
                continue;
              }
              break;
            }
            capitalRun = count > 1;
            emit(
              [capitalRun ? "456" : "6", ...letters(n.symbol)],
              n,
              capitalRun ? "8.2.2.2" : "8.1.2.1",
            );
          } else emit(letters(n.symbol), n, "8.2.2.2");
          break;
        }
        case "Count": {
          const symbolic: string[] = [];
          if (n.symbolic) {
            for (const token of n.value.match(/\d+|[a-z]|[+-]/g) ?? [])
              symbolic.push(...(/^\d+$/.test(token) ? numbers(token) : token === "+" ? ["235"] : token === "-" ? ["36"] : ["56", ...letters(token)]));
          }
          emit(
            n.symbolic
              ? ["16", ...symbolic, "156"]
              : lowered(n.value),
            n,
            pureElementFormula && list === node.children ? "8.2.2.1" : "8.2.2.4",
          );
          break;
        }
        case "Oxidation": {
          let nextIndex = index + 1;
          while (list[nextIndex]?.kind === "Whitespace") nextIndex++;
          const next = list[nextIndex];
          emit([
            ...(n.position === "above" ? ["46", "34"] : ["34"]),
            ...(n.sign === "-" ? ["36"] : []), ...lowered(n.magnitude),
            ...(next && next.kind !== "Element" ? ["156"] : []),
          ], n, "8.2.2.5");
          break;
        }
        case "ElectronConfiguration":
          if (n.core)
            emit(["12356", "6", ...letters(n.core.symbol), "23456"], n.core, "8.3.2.3");
          for (const orbital of n.orbitals)
            emit([...numbers(orbital.shell), "56", ...letters(orbital.orbital), "34", ...lowered(orbital.population)], orbital, n.core ? "8.3.2.3" : "8.3.2.1");
          break;
        case "Coefficient":
          emit(numbers(n.value), n, "8.2.2.8");
          break;
        case "Group":
          emit([n.bracket === "(" ? "126" : "12356"], n, "8.2.2.4");
          visit(n.children);
          if (n.closed)
            emit([n.bracket === "(" ? "345" : "23456"], n, "8.2.2.4");
          else keep(n, "Unclosed chemical group");
          break;
        case "Charge": {
          let elementCount = 0,
            hasGroup = false;
          for (
            let j = index - 1;
            j >= 0 &&
            !["Addition", "ReactionArrow", "Hydrate", "Bond"].includes(
              list[j].kind,
            );
            j--
          ) {
            if (list[j].kind === "Element") elementCount++;
            if (list[j].kind === "Group") hasGroup = true;
          }
          emit(
            [
              "46",
              ...(n.magnitude ? numbers(n.magnitude) : []),
              ...(n.magnitude && n.sign === "+" ? ["6"] : []),
              n.sign === "+" ? "235" : "36",
            ],
            n,
            hasGroup || elementCount > 1 ? "8.2.2.6" : "8.1.2.3",
          );
          break;
        }
        case "Isotope": {
          let j = index - 1;
          while (j >= 0 && list[j].kind === "Whitespace") j--;
          if (
            j >= 0 &&
            [
              "Coefficient",
              "Element",
              "Count",
              "Group",
              "Charge",
              "State",
            ].includes(list[j].kind)
          )
            emit(["6"], n, "8.2.2.14");
          emit(
            [
              ...(n.atomicNumber ? ["16", ...lowered(n.atomicNumber)] : []),
              ...(n.massNumber ? ["34", ...lowered(n.massNumber)] : []),
            ],
            n,
            "8.1.2.2",
          );
          break;
        }
        case "Bond":
          emit(
            [n.order === 1 ? "36" : n.order === 2 ? "1346" : "123456"],
            n,
            "8.4.2.1",
          );
          break;
        case "Hydrate":
          emit(["6", "3"], n, "8.2.2.7");
          break;
        case "Addition":
          boundary(n, true);
          emit(["235"], n, "8.2.2.8");
          break;
        case "ReactionArrow":
          boundary(n, ["right", "left", "equals"].includes(n.direction));
          emit(
            n.direction === "right"
              ? ["25", "135"]
              : n.direction === "left"
                ? ["246", "25"]
                : n.direction === "equilibrium"
                  ? ["6", "2356", "2"]
                  : n.direction === "reverse-equilibrium"
                    ? ["5", "2356", "3"]
                    : ["2356"],
            n,
            "8.2.2.8",
          );
          for (const c of n.conditions)
            if (c.kind === "Condition") condition(c);
          break;
        case "Condition":
          condition(n);
          break;
        case "State":
          emit(["126", "56", ...letters(n.value), "345"], n, "8.2.1");
          break;
        case "Evolution":
          emit(
            n.direction === "gas" ? ["56", "34"] : ["45", "16"],
            n,
            "8.2.2.8",
          );
          break;
        case "Electron":
          emit(["56", "15"], n, "8.2.1");
          break;
        case "Decomposition":
          // Official printed p64, §8.2.2.10: the linear presentation first
          // introduces the superscript direction, then the upper/lower
          // tailed right arrow (symbols 37/38 on printed p61), the new
          // product, and the index terminator. This is a single attached
          // annotation, so it must not be split across braille lines.
          emit(["34", n.position === "above" ? "45" : "56", "25", "135"], n, "8.2.2.10");
          visit(n.children);
          emit(["156"], n, "8.2.2.10");
          break;
        case "Unknown":
        case "UnsupportedStructure":
          keep(n, n.reason);
          break;
      }
    }
  };
  visit(node.children);
  const diagnosedSpans = new Set(
      node.diagnostics.map((d) => `${d.span.start}:${d.span.end}`),
    ),
    alreadyRetained = new Set(unhandled);
  const retainDiagnosed = (list: ChemicalPart[]) => {
    for (const n of list) {
      if (
        diagnosedSpans.has(`${n.span.start}:${n.span.end}`) &&
        !alreadyRetained.has(n)
      ) {
        unhandled.push(n);
        alreadyRetained.add(n);
      }
      if (n.kind === "Group") retainDiagnosed(n.children);
      if (n.kind === "Decomposition") retainDiagnosed(n.children);
      if (n.kind === "ReactionArrow") retainDiagnosed(n.conditions);
    }
  };
  if (node.diagnostics.length) retainDiagnosed(node.children);
  return {
    atoms,
    chineseWords,
    diagnostics,
    unhandled,
    complete:
      unhandled.length === 0 && !diagnostics.some((d) => d.severity !== "info"),
  };
}
/** Opt-in Task4 callback; no math→chemistry runtime dependency/cycle. */
export const chemistryMathHook: NonNullable<
  MathEncodingOptions["chemistry"]
> = (node) => {
  const result = encodeChemistry(parseChemistry(node.raw, node.span));
  return {
    ...result,
    unhandled: result.unhandled.map((n) => ({
      kind: "unknown" as const,
      raw: n.raw,
      span: n.span,
      reason: "Retained incomplete chemical source",
    })),
  };
};
