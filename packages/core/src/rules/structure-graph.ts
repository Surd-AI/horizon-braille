import { braille, LATIN_DOTS, LOWER_DIGITS } from "./math-symbols";
import { ELEMENT_SYMBOLS } from "../parser/chemistry";

const elementSymbols = new Set(ELEMENT_SYMBOLS);

/** Explicit graph input; no chemical structure is inferred from typography. */
export interface StructureAtom {
  id: string;
  element: string;
  row: number;
  column: number;
}
export interface StructureBond {
  from: string;
  to: string;
  order: 1 | 2 | 3;
}
export interface StructureGraph {
  atoms: readonly StructureAtom[];
  bonds: readonly StructureBond[];
}
export interface StructureGraphEncoding {
  complete: boolean;
  cells: string;
  traversal: readonly string[];
  reason?: string;
}

const fail = (reason: string): StructureGraphEncoding => ({
  complete: false,
  cells: "",
  traversal: [],
  reason,
});

/**
 * GB/T 18028-2010 §8.4.1 item 20, printed p.69: position marker 12456.
 * §8.4.2.9, printed p.73: two lowered digits, row then column, no number sign.
 * Only one-digit positive row/column coordinates are accepted here.
 */
export function encodeStructurePosition(row: number, column: number): string | null {
  if (!Number.isInteger(row) || !Number.isInteger(column) ||
      row < 1 || row > 9 || column < 1 || column > 9) return null;
  return braille(["12456", LOWER_DIGITS[row], LOWER_DIGITS[column]]);
}

/**
 * Safely linearizes only a straight horizontal, acyclic path. This bounded
 * profile does not implement the full spatial transcription in §8.4.2.9.
 * A position is explicitly marked before every element so no coordinate is
 * lost; consumers must not treat this profile as a full standard certificate.
 */
export function encodeStructureGraph(graph: StructureGraph): StructureGraphEncoding {
  const { atoms, bonds } = graph;
  if (!atoms.length || atoms.length > 9) return fail("Structure requires 1–9 explicit atoms");
  const byId = new Map<string, StructureAtom>();
  const positions = new Set<string>();
  for (const atom of atoms) {
    if (!atom.id || byId.has(atom.id)) return fail("Atom IDs must be unique and nonempty");
    if (!elementSymbols.has(atom.element)) return fail("Unsupported element label");
    if (encodeStructurePosition(atom.row, atom.column) === null) return fail("Position outside supported one-digit grid");
    const position = `${atom.row}:${atom.column}`;
    if (positions.has(position)) return fail("Two atoms occupy the same position");
    positions.add(position);
    byId.set(atom.id, atom);
  }
  const ordered = [...atoms].sort((a, b) => a.row - b.row || a.column - b.column);
  if (ordered.some((atom) => atom.row !== ordered[0].row)) return fail("Vertical and diagonal structures require spatial encoding");
  if (ordered.some((atom, index) => index && atom.column !== ordered[index - 1].column + 1))
    return fail("Nonadjacent coordinates require spatial encoding");
  if (bonds.length !== atoms.length - 1) return fail("Only an acyclic connected path is supported");
  const edgeByPair = new Map<string, StructureBond>();
  for (const bond of bonds) {
    if (!byId.has(bond.from) || !byId.has(bond.to) || bond.from === bond.to)
      return fail("Bond endpoint is missing or self-referential");
    if (![1, 2, 3].includes(bond.order)) return fail("Invalid bond order");
    const pair = [bond.from, bond.to].sort().join("\u0000");
    if (edgeByPair.has(pair)) return fail("Duplicate bond");
    edgeByPair.set(pair, bond);
  }
  const dots: string[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const atom = ordered[i];
    const position = encodeStructurePosition(atom.row, atom.column)!;
    dots.push(position, braille(["6", ...Array.from(atom.element.toLowerCase(),
      (letter) => LATIN_DOTS[letter.charCodeAt(0) - 97])]));
    if (i + 1 < ordered.length) {
      const pair = [atom.id, ordered[i + 1].id].sort().join("\u0000");
      const edge = edgeByPair.get(pair);
      if (!edge) return fail("Disconnected, branched or crossing path");
      dots.push(braille([edge.order === 1 ? "36" : edge.order === 2 ? "1346" : "123456"]));
    }
  }
  return { complete: true, cells: dots.join(""), traversal: ordered.map((atom) => atom.id) };
}
