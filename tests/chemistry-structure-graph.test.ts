import { expect, test } from "vitest";
import { encodeStructureGraph, encodeStructurePosition, type StructureGraph } from "../packages/core/src/rules/structure-graph";
import { braille } from "../packages/core/src/rules/math-symbols";

// Symbol 20 and the two lowered coordinates are read directly from the
// official GB/T 18028-2010 printed pp.69 and 73 (§8.4.1, §8.4.2.9).
test("position marker is 12456 + lowered row + lowered column, without number sign", () => {
  expect(encodeStructurePosition(1, 2)).toBe(braille(["12456", "2", "23"]));
  expect(encodeStructurePosition(9, 9)).toBe(braille(["12456", "35", "35"]));
  for (const [row, column] of [[0, 1], [1, 0], [10, 1], [1, 10], [1.5, 2], [NaN, 1]])
    expect(encodeStructurePosition(row, column)).toBeNull();
});

const chain: StructureGraph = {
  atoms: [
    { id: "O", element: "O", row: 1, column: 2 },
    { id: "R", element: "H", row: 1, column: 3 },
    { id: "L", element: "H", row: 1, column: 1 },
  ],
  bonds: [
    { from: "O", to: "R", order: 1 },
    { from: "L", to: "O", order: 1 },
  ],
};

test("straight explicit path traverses in coordinate order and keeps all positions", () => {
  const result = encodeStructureGraph(chain);
  expect(result.complete).toBe(true);
  expect(result.traversal).toEqual(["L", "O", "R"]);
  expect(result.cells).toBe(braille([
    "12456", "2", "2", "6", "125", "36",
    "12456", "2", "23", "6", "135", "36",
    "12456", "2", "25", "6", "125",
  ]));
  expect(result.cells).not.toContain(braille(["0"]));
});

test("unordered edge direction does not change graph encoding", () => {
  const reversed = { ...chain, bonds: chain.bonds.map((edge) => ({ ...edge, from: edge.to, to: edge.from })) };
  expect(encodeStructureGraph(reversed)).toEqual(encodeStructureGraph(chain));
});

test.each([
  [{ atoms: chain.atoms, bonds: chain.bonds.slice(0, 1) }, "disconnected"],
  [{ atoms: chain.atoms, bonds: [...chain.bonds, { from: "L", to: "R", order: 1 }] }, "cycle"],
  [{ atoms: chain.atoms.map((a) => ({ ...a, row: a.id === "R" ? 2 : 1 })), bonds: chain.bonds }, "vertical"],
  [{ atoms: chain.atoms.map((a) => ({ ...a, column: a.id === "R" ? 4 : a.column })), bonds: chain.bonds }, "gap"],
  [{ atoms: [...chain.atoms, { id: "X", element: "H", row: 1, column: 4 }], bonds: [...chain.bonds, { from: "O", to: "X", order: 1 }] }, "branch"],
  [{ atoms: chain.atoms.map((a) => ({ ...a, column: a.id === "R" ? 2 : a.column })), bonds: chain.bonds }, "overlap"],
  [{ atoms: chain.atoms, bonds: [{ from: "L", to: "missing", order: 1 }, chain.bonds[1]] }, "missing endpoint"],
  [{ atoms: chain.atoms.map((a) => ({ ...a, element: a.id === "L" ? "Xx" : a.element })), bonds: chain.bonds }, "invalid element"],
] as const)("fails closed for %s (%s)", (graph, _caseName) => {
  const result = encodeStructureGraph(graph as StructureGraph);
  expect(result.complete).toBe(false);
  expect(result.cells).toBe("");
  expect(result.reason).toBeTruthy();
});
