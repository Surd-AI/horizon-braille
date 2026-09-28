import { expect, expectTypeOf, test } from 'vitest';
import { MAX_SOURCE_LENGTH, parseDocument } from '../packages/core/src/parser/document';
import type { BrailleCellAtom, BreakAtom, Continuation, ConversionResult } from '../packages/core/src/model';

test('exposes cell strings and string-array outputs to downstream encoders and consumers', () => {
  expectTypeOf<BrailleCellAtom>().toMatchTypeOf<{ cells: string; group: string }>();
  expectTypeOf<Continuation>().toEqualTypeOf<{ lineEnd: string; lineStart: string }>();
  expectTypeOf<ConversionResult['lines']>().toEqualTypeOf<string[]>();
  expectTypeOf<ConversionResult['pages']>().toEqualTypeOf<string[][]>();
  expectTypeOf<Extract<keyof BreakAtom, 'cells'>>().toEqualTypeOf<never>();
});

const samples = ['$x$', '$x$后文', '前文$x$后文', '$a$$b$', '$$a\nb$$', String.raw`价格\$5，\(x\)`, '', ' \t', '甲\r\n\r\n乙\n\n\n丙', '😀$𝑥$尾'];

test.each(samples)('preserves every source span and raw character: %j', source => {
  const doc = parseDocument(source);
  expect(doc.source).toBe(source);
  expect(doc.nodes.map(n => source.slice(n.span.start, n.span.end)).join('')).toBe(source);
  expect(doc.nodes.map(n => n.raw).join('')).toBe(source);
  let end = 0;
  for (const node of doc.nodes) {
    expect(node.span.start).toBe(end);
    expect(node.span.end).toBeGreaterThan(end);
    end = node.span.end;
  }
  expect(end).toBe(source.length);
  expect(new Set(doc.nodes.map(n => n.id)).size).toBe(doc.nodes.length);
  expect(doc.diagnostics).toEqual([]);
});

test('retains ordered text and typed adjacent math with exact content spans', () => {
  expect(parseDocument('前$a$$b$后').nodes).toMatchObject([
    { kind: 'text', text: '前', span: { start: 0, end: 1 } },
    { kind: 'inline-math', content: 'a', contentSpan: { start: 2, end: 3 }, openDelimiter: '$', closeDelimiter: '$', closed: true },
    { kind: 'inline-math', content: 'b', contentSpan: { start: 5, end: 6 }, closed: true },
    { kind: 'text', text: '后', span: { start: 7, end: 8 } },
  ]);
});

test.each([
  ['$$a\r\nb$$', 'display-math', 'a\r\nb', '$$', '$$'],
  [String.raw`\[a+b\]`, 'display-math', 'a+b', String.raw`\[`, String.raw`\]`],
  [String.raw`\(x\)`, 'inline-math', 'x', String.raw`\(`, String.raw`\)`],
  [String.raw`$a\$b$`, 'inline-math', String.raw`a\$b`, '$', '$'],
])('recognizes paired delimiters without normalizing inner source: %s', (source, kind, content, openDelimiter, closeDelimiter) => {
  expect(parseDocument(source).nodes).toMatchObject([{ kind, content, openDelimiter, closeDelimiter, closed: true }]);
});

test('respects escape parity and keeps escaped text separate from actual math', () => {
  expect(parseDocument(String.raw`价格\$5，\\(x)\\$y$`).nodes).toMatchObject([
    { kind: 'text', text: '价格' }, { kind: 'escaped-text', text: '$', raw: String.raw`\$` },
    { kind: 'text', text: '5，' }, { kind: 'escaped-text', text: '\\' },
    { kind: 'text', text: '(x)' }, { kind: 'escaped-text', text: '\\' },
    { kind: 'inline-math', content: 'y' },
  ]);
});

test.each([
  [String.raw`$a\\$tail`, String.raw`a\\`, 'inline-math'],
  [String.raw`$a\\\$b$tail`, String.raw`a\\\$b`, 'inline-math'],
  [String.raw`\(a\\\)tail`, String.raw`a\\`, 'inline-math'],
  [String.raw`\(a\\)b\)tail`, String.raw`a\\)b`, 'inline-math'],
  [String.raw`\[a\\\]tail`, String.raw`a\\`, 'display-math'],
  [String.raw`\[a\\]b\]tail`, String.raw`a\\]b`, 'display-math'],
])('respects odd/even escape parity before math closing delimiters: %s', (source, content, kind) => {
  const doc = parseDocument(source);
  expect(doc.nodes).toMatchObject([
    { kind, content, closed: true },
    { kind: 'text', text: 'tail' },
  ]);
  expect(doc.nodes.map(n => n.raw).join('')).toBe(source);
  expect(doc.diagnostics).toEqual([]);
});

test('preserves line and paragraph breaks including whitespace-only blank lines', () => {
  expect(parseDocument('a\r\nb\n \t\r\n\nc\rd').nodes).toMatchObject([
    { kind: 'text', text: 'a' }, { kind: 'line-break', raw: '\r\n', count: 1 },
    { kind: 'text', text: 'b' }, { kind: 'paragraph-break', raw: '\n \t\r\n\n', count: 3 },
    { kind: 'text', text: 'c' }, { kind: 'line-break', raw: '\r', count: 1 }, { kind: 'text', text: 'd' },
  ]);
});

test('keeps whitespace after a single newline and uses UTF-16 offsets', () => {
  expect(parseDocument('😀\n  $𝑥$').nodes).toMatchObject([
    { kind: 'text', text: '😀', span: { start: 0, end: 2 } },
    { kind: 'line-break', span: { start: 2, end: 3 } },
    { kind: 'text', text: '  ', span: { start: 3, end: 5 } },
    { kind: 'inline-math', content: '𝑥', contentSpan: { start: 6, end: 8 }, span: { start: 5, end: 9 } },
  ]);
});

test.each(['$x', '$$x', String.raw`\(x`, String.raw`\[x`])('retains unclosed math with a located error: %s', source => {
  const doc = parseDocument(source);
  expect(doc.nodes).toMatchObject([{ raw: source, closed: false, closeDelimiter: null, span: { start: 0, end: source.length } }]);
  expect(doc.diagnostics).toMatchObject([{ code: 'unclosed-math', severity: 'error', span: { start: 0, end: source.length } }]);
});

test('orphan closing delimiters remain visible with diagnostics', () => {
  const doc = parseDocument(String.raw`a\)b\]c`);
  expect(doc.nodes.map(n => n.raw).join('')).toBe(String.raw`a\)b\]c`);
  expect(doc.diagnostics).toMatchObject([
    { code: 'unexpected-math-close', span: { start: 1, end: 3 } },
    { code: 'unexpected-math-close', span: { start: 4, end: 6 } },
  ]);
});

test('bounds scanning while preserving oversized input as explicitly unparsed source', () => {
  const source = '$'.repeat(MAX_SOURCE_LENGTH + 1);
  const doc = parseDocument(source);
  expect(doc.source).toBe(source);
  expect(doc.nodes).toMatchObject([{ kind: 'unparsed', raw: source, reason: 'resource-limit', span: { start: 0, end: source.length } }]);
  expect(doc.diagnostics).toMatchObject([{ code: 'resource-limit', severity: 'error' }]);
  const accepted = parseDocument('x'.repeat(MAX_SOURCE_LENGTH));
  expect(accepted.nodes).toHaveLength(1);
  expect(accepted.nodes[0].kind).toBe('text');
  expect(accepted.diagnostics).toEqual([]);
});

test('long adversarial escape and unmatched delimiter sequences terminate without recursion', () => {
  const source = String.raw`\\\$`.repeat(5000) + String.raw`\(` + '['.repeat(20000);
  const doc = parseDocument(source);
  expect(doc.nodes.map(n => n.raw).join('')).toBe(source);
  expect(doc.diagnostics.map(d => d.code)).toEqual(['unclosed-math']);
});
