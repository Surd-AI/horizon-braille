import type { Diagnostic, SourceSpan } from "../model";
interface ChemicalBase {
  raw: string;
  span: SourceSpan;
}
export type ChemicalPart = ChemicalBase &
  (
    | { kind: "Element"; symbol: string }
    | { kind: "Count"; value: string; symbolic: boolean }
    | { kind: "Coefficient"; value: string }
    | {
        kind: "Group";
        bracket: "(" | "[";
        closed: boolean;
        children: ChemicalPart[];
      }
    | { kind: "Charge"; magnitude: string; sign: "+" | "-" }
    | { kind: "Oxidation"; magnitude: string; sign: "+" | "-"; position: "right" | "above" }
    | { kind: "ElectronConfiguration"; core?: ChemicalBase & { symbol: "Ne" | "Ar" }; orbitals: (ChemicalBase & { shell: string; orbital: "s" | "p" | "d" | "f"; population: string })[] }
    | { kind: "Isotope"; atomicNumber?: string; massNumber?: string }
    | { kind: "Bond"; order: 1 | 2 | 3 }
    | {
        kind: "ReactionArrow";
        direction:
          | "right"
          | "left"
          | "equilibrium"
          | "reverse-equilibrium"
          | "equals";
        conditions: ChemicalPart[];
      }
    | {
        kind: "Condition";
        position: "above" | "below";
        content: string;
        contentSpan: SourceSpan;
      }
    | { kind: "State"; value: "g" | "l" | "s" | "aq" }
    | { kind: "Evolution"; direction: "gas" | "precipitate" }
    | { kind: "Hydrate" | "Addition" | "Whitespace" | "Electron" }
    | { kind: "Decomposition"; position: "above" | "below"; children: ChemicalPart[] }
    | {
        kind: "UnsupportedStructure";
        representation: "graph" | "lewis" | "orbital";
        metadata?: unknown;
        reason: string;
      }
    | { kind: "Unknown"; reason: string }
  );
export interface ChemicalNode extends ChemicalBase {
  kind: "Chemistry";
  contentSpan: SourceSpan;
  children: ChemicalPart[];
  diagnostics: Diagnostic[];
}
export interface ChemicalParseOptions {
  maxDepth?: number;
  maxLength?: number;
}
/** Modern 118 symbols. Obsolete temporary names are not silently accepted. */
export const ELEMENT_SYMBOLS: readonly string[] = Object.freeze(
  "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split(
    " ",
  ),
);
const elements = new Set(ELEMENT_SYMBOLS);
const bounded = (v: number | undefined, fallback: number, cap: number) =>
  Number.isFinite(v) ? Math.max(1, Math.min(cap, Math.floor(v!))) : fallback;
/** Explicit chemistry only. Tight '=' is a bond; spaced '=' or '=[condition]'
 * is a reaction sign. Caret charges disambiguate Fe^{3+}. */
export function parseChemistry(
  raw: string,
  span: SourceSpan = { start: 0, end: raw.length },
  options: ChemicalParseOptions = {},
): ChemicalNode {
  const diagnostics: Diagnostic[] = [];
  let source = raw,
    offset = span.start;
  if (raw.startsWith("\\ce{") && raw.endsWith("}")) {
    source = raw.slice(4, -1);
    offset += 4;
  }
  const contentSpan = { start: offset, end: offset + source.length };
  const maxDepth = bounded(options.maxDepth, 64, 128),
    maxLength = bounded(options.maxLength, 100000, 1000000);
  let i = 0;
  const base = (start: number, end = i): ChemicalBase => ({
    raw: source.slice(start, end),
    span: { start: offset + start, end: offset + end },
  });
  const issue = (code: string, message: string, n: ChemicalBase) =>
    diagnostics.push({
      code: "chemistry-" + code,
      severity: "warning",
      message,
      span: n.span,
    });
  const unknown = (
    start: number,
    reason: string,
    code = "unsupported",
  ): ChemicalPart => {
    const n: ChemicalPart = { ...base(start), kind: "Unknown", reason };
    issue(code, reason, n);
    return n;
  };
  const block = (open: string, close: string) => {
    const start = i++;
    let depth = 1;
    while (i < source.length && depth) {
      if (source[i] === open) depth++;
      if (source[i] === close) depth--;
      i++;
    }
    return {
      start,
      end: i,
      closed: depth === 0,
      content: source.slice(start + 1, depth === 0 ? i - 1 : i),
    };
  };
  const script = () => {
    if (source[i] === "{") return block("{", "}");
    const start = i;
    const m = /^(?:\d+[+-]?|[a-z]|[+-])/.exec(source.slice(i));
    i += m?.[0].length ?? 0;
    return { start, end: i, closed: !!m, content: source.slice(start, i) };
  };
  const significant = (nodes: ChemicalPart[]) =>
    nodes.filter((n) => n.kind !== "Whitespace");
  // Both compact count/charge ambiguity and unit-charge parsing must agree on
  // the sign and what can end its term. Inspect before committing digits to Count.
  const terminalChargeSign = (position: number): "+" | "-" | null => {
    const sign = source[position];
    if (sign !== "+" && sign !== "-" && sign !== "−") return null;
    const suffix = source.slice(position + 1);
    const next = suffix.trimStart();
    const terminal =
      !next ||
      (/^\s/u.test(suffix) && /^(?:\(v\)|\(\^\)|v|\^)(?=\s|$)/u.test(next)) ||
      /^(?:\+|->|<-|<=>|=>|=|→|←|⇌|⇋|↑|↓|\)|\]|\((?:g|l|s|aq)\))/.test(next);
    return terminal ? (sign === "+" ? "+" : "-") : null;
  };
  const parse = (depth: number, closing?: string): ChemicalPart[] => {
    const nodes: ChemicalPart[] = [];
    while (i < source.length && source[i] !== closing) {
      const start = i,
        c = source[i],
        rest = source.slice(i);
      let last = nodes.length - 1;
      while (last >= 0 && nodes[last].kind === "Whitespace") last--;
      const prev = nodes[last];
      if (/\s/u.test(c)) {
        while (i < source.length && /\s/u.test(source[i])) i++;
        nodes.push({ ...base(start), kind: "Whitespace" });
        continue;
      }
      // mhchem source compatibility only: whole, whitespace-delimited tokens
      // at the top level. Never reinterpret scripts or nested molecular groups.
      const evolutionAlias = depth === 0 && (i === 0 || /\s/u.test(source[i - 1]))
        ? /^(?:\(v\)|\(\^\)|v|\^)(?=\s|$)/u.exec(rest)?.[0]
        : undefined;
      if (evolutionAlias) {
        i += evolutionAlias.length;
        nodes.push({ ...base(start), kind: "Evolution",
          direction: evolutionAlias.includes("v") ? "precipitate" : "gas" });
        continue;
      }
      const state = /^\((g|l|s|aq)\)/.exec(rest);
      if (state) {
        i += state[0].length;
        nodes.push({
          ...base(start),
          kind: "State",
          value: state[1] as "g" | "l" | "s" | "aq",
        });
        continue;
      }
      if (rest.startsWith("<->")) {
        i += 3;
        nodes.push(
          unknown(
            start,
            "Double-headed resonance arrow is not the checked equilibrium sign",
            "unsupported-arrow",
          ),
        );
        continue;
      }
      const arrow = /^(<=>|->|<-|=>|→|←|⇌|⇋)/.exec(rest);
      const reactionEquals =
        c === "=" &&
        (source[i + 1] === "[" ||
          /\s/.test(source[i - 1] ?? "") ||
          /\s/.test(source[i + 1] ?? ""));
      if (arrow || reactionEquals) {
        const token = arrow?.[0] ?? "=";
        i += token.length;
        const conditions: ChemicalPart[] = [];
        const direction = ["->", "→"].includes(token)
          ? "right"
          : ["<-", "←"].includes(token)
            ? "left"
            : ["<=>", "⇌"].includes(token)
              ? "equilibrium"
              : token === "⇋"
                ? "reverse-equilibrium"
                : "equals";
        for (const position of ["above", "below"] as const) {
          if (source[i] !== "[") break;
          const b = block("[", "]");
          let content = b.content,
            innerStart = b.start + 1;
          if (content.startsWith("\\text{") && content.endsWith("}")) {
            content = content.slice(6, -1);
            innerStart += 6;
          }
          const n: ChemicalPart = {
            ...base(b.start, b.end),
            kind: "Condition",
            position,
            content,
            contentSpan: {
              start: offset + innerStart,
              end: offset + innerStart + content.length,
            },
          };
          conditions.push(n);
          if (!b.closed)
            issue(
              "malformed-condition",
              "Missing condition closing bracket",
              n,
            );
        }
        nodes.push({
          ...base(start),
          kind: "ReactionArrow",
          direction,
          conditions,
        });
        continue;
      }
      if (c === "(" || c === "[") {
        if (depth >= maxDepth) {
          const b = block(c, c === "(" ? ")" : "]");
          nodes.push(
            unknown(
              b.start,
              "Chemical nesting limit exceeded",
              "resource-limit",
            ),
          );
          continue;
        }
        i++;
        const children = parse(depth + 1, c === "(" ? ")" : "]"),
          closed = source[i] === (c === "(" ? ")" : "]");
        if (closed) i++;
        const n: ChemicalPart = {
          ...base(start),
          kind: "Group",
          bracket: c,
          children,
          closed,
        };
        nodes.push(n);
        if (!closed)
          issue("unclosed-group", "Missing closing chemical group bracket", n);
        continue;
      }
      if (
        ((c === "^" || c === "_") &&
          (!prev ||
            [
              "Addition",
              "ReactionArrow",
              "Hydrate",
              "Coefficient",
              "Bond",
            ].includes(prev.kind))) ||
        rest.startsWith("{}^") ||
        rest.startsWith("{}_")
      ) {
        if (rest.startsWith("{}")) i += 2;
        let atomicNumber: string | undefined,
          massNumber: string | undefined,
          valid = true;
        for (
          let k = 0;
          k < 2 && (source[i] === "^" || source[i] === "_");
          k++
        ) {
          const direction = source[i++],
            v = script();
          if (!v.closed || !/^\d+$/.test(v.content)) valid = false;
          if (direction === "^") {
            if (massNumber) valid = false;
            massNumber = v.content;
          } else {
            if (atomicNumber) valid = false;
            atomicNumber = v.content;
          }
        }
        if (valid && /^[A-Z]/.test(source.slice(i)))
          nodes.push({
            ...base(start),
            kind: "Isotope",
            atomicNumber,
            massNumber,
          });
        else
          nodes.push(
            unknown(
              start,
              "Left isotope scripts require integer values and a following element",
              "invalid-isotope",
            ),
          );
        continue;
      }
      if (c === "^") {
        i++;
        const v = script(),
          m = /^(\d*)([+-])$/.exec(v.content);
        if (
          v.closed &&
          m &&
          prev &&
          ["Element", "Count", "Group", "Electron"].includes(prev.kind)
        )
          nodes.push({
            ...base(start),
            kind: "Charge",
            magnitude: m[1],
            sign: m[2] as "+" | "-",
          });
        else
          nodes.push(
            unknown(
              start,
              "Charge must be an unsigned magnitude followed by + or -",
              "invalid-charge",
            ),
          );
        continue;
      }
      if (c === "_") {
        i++;
        const v = script();
        if (
          v.closed &&
          /^(?:\d+|(?:[1-9]\d*)?[a-z](?:[+-](?:0|[1-9]\d*))?)$/.test(v.content) &&
          prev &&
          ["Element", "Group", "Oxidation"].includes(prev.kind)
        )
          nodes.push({
            ...base(start),
            kind: "Count",
            value: v.content,
            symbolic: !/^\d+$/.test(v.content),
          });
        else
          nodes.push(
            unknown(
              start,
              "Count requires an integer or a linear single-variable index (e.g. n+1 or 2n+2)",
              "invalid-count",
            ),
          );
        continue;
      }
      if (/[A-Z]/.test(c)) {
        const token = /^[A-Z][a-z]*/.exec(rest)![0];
        i += token.length;
        if (elements.has(token))
          nodes.push({ ...base(start), kind: "Element", symbol: token });
        else
          nodes.push(
            unknown(start, `Unknown element ${token}`, "invalid-element"),
          );
        continue;
      }
      if (/\d/.test(c)) {
        const value = /^\d+/.exec(rest)![0];
        i += value.length;
        const isCount = !!prev && ["Element", "Group", "Oxidation"].includes(prev.kind);
        if (isCount && terminalChargeSign(i) !== null) {
          let numElements = 0;
          for (
            let k = nodes.length - 1;
            k >= 0 &&
            !["Addition", "ReactionArrow", "Hydrate", "Bond"].includes(
              nodes[k].kind,
            );
            k--
          )
            if (nodes[k].kind === "Element") numElements++;
          if (prev.kind === "Element" && numElements === 1) {
            i++;
            nodes.push(
              unknown(
                start,
                "Compact single-element count/charge is ambiguous; use a caret charge",
                "ambiguous-charge",
              ),
            );
            continue;
          }
        }
        if (isCount)
          nodes.push({ ...base(start), kind: "Count", value, symbolic: false });
        else if (
          !prev ||
          ["Addition", "ReactionArrow", "Hydrate"].includes(prev.kind)
        )
          nodes.push({ ...base(start), kind: "Coefficient", value });
        else
          nodes.push(
            unknown(
              start,
              "Numeral has no count or coefficient role",
              "invalid-number",
            ),
          );
        continue;
      }
      if (c === "+" || c === "-" || c === "−") {
        const next = source.slice(i + 1).trimStart();
        const terminalSign = terminalChargeSign(i);
        i++;
        if (
          prev &&
          prev.span.end === offset + start &&
          ["Element", "Count", "Group", "Electron"].includes(prev.kind) &&
          terminalSign !== null
        ) {
          nodes.push({
            ...base(start),
            kind: "Charge",
            magnitude: "",
            sign: terminalSign,
          });
          continue;
        }
        if (c === "+") {
          nodes.push({ ...base(start), kind: "Addition" });
          if (!prev || !next)
            issue(
              "malformed-addition",
              "Addition requires two chemical terms",
              nodes.at(-1)!,
            );
          continue;
        }
        if (
          prev &&
          ["Element", "Count", "Group"].includes(prev.kind) &&
          /^[A-Z([]/.test(next)
        ) {
          nodes.push({ ...base(start), kind: "Bond", order: 1 });
          continue;
        }
        nodes.push(
          unknown(start, "Unattached chemical minus/bond", "invalid-bond"),
        );
        continue;
      }
      if (c === "=" || c === "#" || c === "≡" || c === "–") {
        i++;
        nodes.push({
          ...base(start),
          kind: "Bond",
          order: c === "=" ? 2 : c === "–" ? 1 : 3,
        });
        continue;
      }
      if (c === "·" || c === "." || rest.startsWith("\\cdot")) {
        i += rest.startsWith("\\cdot") ? 5 : 1;
        nodes.push({ ...base(start), kind: "Hydrate" });
        continue;
      }
      if (c === "↑" || c === "↓") {
        i++;
        nodes.push({
          ...base(start),
          kind: "Evolution",
          direction: c === "↑" ? "gas" : "precipitate",
        });
        continue;
      }
      if (c === "e" && source[i + 1] === "-") {
        i++;
        nodes.push({ ...base(start), kind: "Electron" });
        continue;
      }
      if (c === "\\") {
        const command = /^\\[a-zA-Z]+/.exec(rest)?.[0] ?? "\\";
        i += command.length;
        // §8.2.2.10 has two distinct presentations of a secondary
        // decomposition. Only the linear one is expressible in a text stream.
        // The explicit command records which side of the original product the
        // decomposition arrow was printed on; this cannot be inferred from a
        // plain reaction arrow or from whitespace.
        if (command === "\\decompabove" || command === "\\decompbelow") {
          const b = source[i] === "{" ? block("{", "}") : undefined;
          const earlier = significant(nodes).at(-1);
          const nested = b?.closed && b.content && !b.content.includes("\\decomp")
            ? parseChemistry(b.content, { start: offset + b.start + 1, end: offset + b.end - 1 }, { maxDepth: maxDepth - depth - 1, maxLength })
            : undefined;
          const children = nested?.children ?? [];
          const n: ChemicalPart = {
            ...base(start), kind: "Decomposition",
            position: command === "\\decompabove" ? "above" : "below",
            children,
          };
          nodes.push(n);
          if (!earlier || !["Element", "Count", "Group", "State", "Evolution"].includes(earlier.kind) ||
              !nested || nested.diagnostics.length || !children.some(c => c.kind === "Element"))
            issue("invalid-decomposition", "Linear decomposition requires an earlier complete product and a valid braced product formula", n);
          diagnostics.push(...(nested?.diagnostics ?? []));
          continue;
        }
        if (["\\oxidation", "\\oxidationabove", "\\ox", "\\oxabove"].includes(command)) {
          const v = source[i] === "{" ? block("{", "}") : undefined;
          const m = v?.closed ? /^([+-])([1-9]\d*|0)$/.exec(v.content) : null;
          if (m && prev?.kind === "Element" && prev.span.end === offset + start) {
            nodes.push({ ...base(start), kind: "Oxidation", magnitude: m[2], sign: m[1] as "+" | "-", position: command.endsWith("above") ? "above" : "right" });
          } else nodes.push(unknown(start, "Explicit oxidation requires an adjacent element and signed integer, e.g. Fe\\oxidation{+3}", "invalid-oxidation"));
          continue;
        }
        if (source[i] === "{") block("{", "}");
        const rep =
          command === "\\chemgraph"
            ? "graph"
            : command === "\\lewis"
              ? "lewis"
              : command === "\\orbital"
                ? "orbital"
                : undefined;
        if (rep) {
          const n: ChemicalPart = {
            ...base(start),
            kind: "UnsupportedStructure",
            representation: rep,
            reason:
              "Spatial structure requires a separately verified graph/electron encoder",
          };
          nodes.push(n);
          issue("unsupported-structure", n.reason, n);
        } else
          nodes.push(
            unknown(start, `Unsupported chemistry command ${command}`),
          );
        continue;
      }
      i += String.fromCodePoint(source.codePointAt(i)!).length;
      nodes.push(
        unknown(start, "Unsupported chemical scalar or unmatched bracket"),
      );
    }
    const terms = significant(nodes),
      invalid = new Map<ChemicalPart, string>();
    const head = (n: ChemicalPart | undefined) =>
      !!n &&
      ["Element", "Group", "Coefficient", "Isotope", "Electron"].includes(
        n.kind,
      );
    const tail = (n: ChemicalPart | undefined) =>
      !!n &&
      [
        "Element",
        "Count",
        "Group",
        "Charge",
        "State",
        "Evolution",
        "Electron",
        "Oxidation",
      ].includes(n.kind);
    terms.forEach((n, k) => {
      const before = terms[k - 1],
        after = terms[k + 1];
      let reason = "";
      if (
        n.kind === "Bond" &&
        (!before ||
          !["Element", "Count", "Group"].includes(before.kind) ||
          !after ||
          !["Element", "Group", "Isotope"].includes(after.kind))
      )
        reason = "Bond requires chemical operands on both sides";
      if (
        ["Addition", "ReactionArrow", "Hydrate"].includes(n.kind) &&
        (!tail(before) || !head(after))
      )
        reason = "Chemical separator requires two complete terms";
      if (
        depth > 0 &&
        ["Addition", "ReactionArrow", "Hydrate"].includes(n.kind)
      )
        reason = "Reaction syntax inside a molecular group is unsupported";
      if (
        n.kind === "Coefficient" &&
        (!head(after) || after?.kind === "Coefficient" || /^0+$/.test(n.value))
      )
        reason = "Positive coefficient requires a following chemical term";
      if (n.kind === "Count" && /^0/.test(n.value))
        reason = "Atom count must be a positive integer without a leading zero";
      if (
        n.kind === "Group" &&
        !n.children.some((c) => c.kind !== "Whitespace")
      )
        reason = "Empty chemical group";
      if (
        n.kind === "Charge" &&
        after &&
        !["Addition", "ReactionArrow", "State", "Evolution"].includes(
          after.kind,
        )
      )
        reason =
          "Charge ends a chemical term; separate subsequent terms explicitly";
      if (n.kind === "Decomposition" && after)
        reason = "Linear decomposition annotation must end its chemical expression";
      if (reason) {
        invalid.set(n, reason);
        issue("invalid-grammar", reason, n);
      }
    });
    return nodes.map((n) =>
      invalid.has(n)
        ? { kind: "Unknown", raw: n.raw, span: n.span, reason: invalid.get(n)! }
        : n,
    );
  };
  let children: ChemicalPart[];
  if (source.length > maxLength) {
    i = source.length;
    children = [
      unknown(0, "Chemical input length limit exceeded", "resource-limit"),
    ];
  } else if (/^\s*(?:\[(?:Ne|Ar)\]\s*)?\d+[spdf]\^/.test(source)) {
    // A configuration consumes the whole explicit chemistry input. Never infer
    // orbital diagrams or atom identities from this notation. The only
    // shortened cores supported here are the standard's printed [Ne]/[Ar].
    const orbitals: Extract<ChemicalPart, { kind: "ElectronConfiguration" }>["orbitals"] = [];
    const seen = new Set<string>();
    let valid = true;
    while (/\s/.test(source[i] ?? "") && i < source.length) i++;
    let core: Extract<ChemicalPart, { kind: "ElectronConfiguration" }>["core"];
    const prefix = /^\[(Ne|Ar)\]/.exec(source.slice(i));
    if (prefix) {
      const start = i;
      i += prefix[0].length;
      core = { ...base(start), symbol: prefix[1] as "Ne" | "Ar" };
    }
    while (i < source.length) {
      while (/\s/.test(source[i] ?? "") && i < source.length) i++;
      if (i === source.length) break;
      const start = i, m = /^([1-7])([spdf])\^(?:\{([1-9]\d*)\}|([1-9]\d*))(?=\s|$)/.exec(source.slice(i));
      if (!m || orbitals.length >= 28) { valid = false; break; }
      const orbital = m[2] as "s" | "p" | "d" | "f", population = m[3] ?? m[4];
      const order = "spdf".indexOf(orbital), key = m[1] + orbital;
      if (+m[1] <= order || +population > [2,6,10,14][order] || seen.has(key) || (core && +m[1] <= (core.symbol === "Ne" ? 2 : 3))) { valid = false; break; }
      seen.add(key);
      i += m[0].length;
      orbitals.push({ ...base(start), shell: m[1], orbital, population });
    }
    i = source.length;
    children = valid && orbitals.length
      ? [{ ...base(0), kind: "ElectronConfiguration", core, orbitals }]
      : [unknown(0, "Invalid or unsupported complete linear electron configuration", "invalid-configuration")];
  } else children = parse(0);
  return { kind: "Chemistry", raw, span, contentSpan, children, diagnostics };
}
