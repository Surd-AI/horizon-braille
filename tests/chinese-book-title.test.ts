import { expect, test } from "vitest";
import { encodeDocument } from "../packages/core/src/convert";

test("book-title brackets are emitted exactly once with their own source spans", () => {
  const source = "请读《数学之美》。";
  const result = encodeDocument(source);
  const cells = result.atoms.filter(atom => atom.kind === "cell");
  const opening = cells.filter(atom => atom.span.start === 2 && atom.span.end === 3);
  const closing = cells.filter(atom => atom.span.start === 7 && atom.span.end === 8);
  expect(opening).toHaveLength(1);
  expect(closing).toHaveLength(1);
  expect(opening[0].cells).not.toBe(closing[0].cells);
  expect(result.document.source).toBe(source);
});
