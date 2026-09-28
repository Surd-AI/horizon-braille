import type { MathSemanticNode as N } from "../parser/math";
import { parseMath } from "../parser/math";
import { encodeMath, type MathEncodingOptions } from "./math";
// GB/T18028 §7.2.3 writes adjacent physical quantities as an ordinary
// formula (F=ma); §7.2.4 reserves the product dot for compound units.
// A space alone cannot turn arbitrary variables into units.
const SIMPLE_UNIT_LETTERS = new Set("msgNAKVCWJFhL");
const unitLetter = (node: N, edge: "first" | "last"): string | undefined => {
  if (node.kind === "letter") return node.value;
  if (node.kind === "script") return unitLetter(node.base, edge);
  if (node.kind === "style" || node.kind === "group")
    return unitLetter(node.body, edge);
  if (node.kind === "sequence") {
    const child = edge === "first" ? node.children[0] : node.children.at(-1);
    return child && unitLetter(child, edge);
  }
  return undefined;
};
const unitProduct = (left: N, right: N): boolean => {
  const a = unitLetter(left, "last");
  const b = unitLetter(right, "first");
  return !!a && !!b && SIMPLE_UNIT_LETTERS.has(a) && SIMPLE_UNIT_LETTERS.has(b);
};
/** Explicit UI hook. `unit:true` means a quantity/unit expression, never inferred from Roman font. */
export function encodePhysics(
  raw: string,
  options: MathEncodingOptions & { unit?: boolean; baseOffset?: number } = {},
) {
  const base = options.baseOffset ?? 0;
  const expression = parseMath(raw, { start: base, end: base + raw.length });
  const unit = (n: N): N => {
    if (
      n.kind === "group" ||
      n.kind === "style" ||
      n.kind === "root" ||
      n.kind === "accent"
    )
      return { ...n, body: unit(n.body) };
    if (n.kind === "fraction")
      return {
        ...n,
        numerator: unit(n.numerator),
        denominator: unit(n.denominator),
      };
    // Unit products inside a scripted base still belong to the unit grammar;
    // exponent/subscript expressions are mathematical annotations, not units.
    if (n.kind === "script") return { ...n, base: unit(n.base) };
    if (n.kind !== "sequence") return n;
    const children: N[] = [];
    for (const original of n.children) {
      const node = unit(original);
      const prev = children.at(-1);
      if (
        node.kind === "format" &&
        [",", ";", "quad", "qquad", " "].includes(node.name)
      ) {
        if (!prev || prev.kind === "number") continue;
        children.push({
          kind: "symbol",
          value: "cdot",
          raw: node.raw,
          span: node.span,
        });
        continue;
      }
      if (
        prev &&
        unitProduct(prev, node) &&
        /^\s+$/.test(raw.slice(prev.span.end - base, node.span.start - base))
      )
        children.push({
          kind: "symbol",
          value: "cdot",
          raw: raw.slice(prev.span.end - base, node.span.start - base),
          span: { start: prev.span.end, end: node.span.start },
        });
      children.push(node);
    }
    return { ...n, children };
  };
  if (options.unit) expression.body = unit(expression.body);
  return encodeMath(expression, { ...options, physics: true });
}
