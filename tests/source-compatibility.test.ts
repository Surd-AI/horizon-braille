import { expect, test, vi } from 'vitest';
import { convert, encodeDocument } from '../packages/core/src/convert';
import { brfToUnicode } from '../packages/core/src/codec';
import { parseChemistry } from '../packages/core/src/parser/chemistry';
import { encodeChemistry } from '../packages/core/src/rules/chemistry';
import { analyzeChineseDetailed } from '../packages/core/src/language/chinese';

const joined = ['来来往往', '说说笑笑', '清清楚楚', '弯弯曲曲'];
test.each(joined)('printed parallel repetition stays joined: %s', word => {
  for (const raw of [word, `每年${word}很好`, `${word}${word}`, `😀${word}，研究研究。`]) {
    const a = analyzeChineseDetailed(raw, [], 7);
    expect(a.words.filter(w => w.raw === word)).toHaveLength(raw === word + word ? 2 : 1);
    expect(a.words.map(w => w.raw).join('')).toBe(raw);
    for (const w of a.words) expect(raw.slice(w.span.start - 7, w.span.end - 7)).toBe(w.raw);
    expect(a.words.filter(w => w.raw === word).every(w => w.source === 'proposal')).toBe(true);
  }
});
test('bounded proposals preserve unrelated words and manual precedence', () => {
  expect(analyzeChineseDetailed('爸爸妈妈研究研究').words.map(w => w.raw)).toEqual(['爸爸','妈妈','研究','研究']);
  for (const text of ['来来往', '来往往', '来来，往往']) expect(analyzeChineseDetailed(text).words.some(w => joined.includes(w.raw))).toBe(false);
  for (const [start, end, readings] of [[2,6,['lai2','lai2','wang3','wang3']], [3,5,['lai2','wang3']]] as const) {
    const flags = readings.map(() => true);
    const a = analyzeChineseDetailed('😀来来往往清清楚楚', [{start,end,readings:[...readings],retainTones:flags}]);
    const manual = a.words.find(w => w.source === 'manual')!;
    expect(manual.span).toEqual({start,end});
    expect(manual.syllables.map(s => s.reading)).toEqual(readings);
    expect(manual.syllables.every(s => s.source === 'manual' && s.retainTone)).toBe(true);
    expect(a.words.map(w => w.raw).join('')).toBe('😀来来往往清清楚楚');
    expect(a.words.some(w => w.raw === '清清楚楚')).toBe(true);
  }
});
test.each([['v','↓','precipitate'],['(v)','↓','precipitate'],['^','↑','gas'],['(^)','↑','gas']])('explicit chemistry alias %s preserves typed source', (alias, arrow, direction) => {
  const raw = `\\ce{SO4^2- + Ba^2+ -> BaSO4 ${alias}}`;
  const node = parseChemistry(raw, {start:9,end:9+raw.length});
  const evolution = node.children.find(n => n.kind === 'Evolution')!;
  expect(evolution).toMatchObject({kind:'Evolution', direction, raw:alias});
  expect(raw.slice(evolution.span.start-9,evolution.span.end-9)).toBe(alias);
  expect(node.children.map(n => n.raw).join('')).toBe(raw.slice(4,-1));
  const encoded = encodeChemistry(node);
  expect(encoded.complete).toBe(true);
  expect(encoded.atoms.map(a => a.cells).join('')).toBe(encodeChemistry(parseChemistry(raw.replace(` ${alias}}`, ` ${arrow}}`))).atoms.map(a => a.cells).join(''));
  const atom = encoded.atoms.find(a => a.span.start === evolution.span.start)!;
  const dots = [...atom.cells].map(c => [...Array(6)].map((_,i) => (c.charCodeAt(0)-0x2800)&(1<<i) ? `${i+1}` : '').join(''));
  expect(dots).toEqual(direction === 'gas' ? ['56','34'] : ['45','16']);
});
test('aliases do not consume charges, isotopes, elements or embedded/malformed forms', () => {
  for (const raw of ['Fe^{3+}','SO4^2-','O_2^-','^{14}C','V','Hv','H2v','H2(v)','H2 ^{+}','H2 ((v))','H2 ( v )','H2 \\v']) {
    const node = parseChemistry(raw);
    const walk = (nodes: typeof node.children): boolean => nodes.some(n => n.kind === 'Evolution' || n.kind === 'Group' && walk(n.children));
    expect(walk(node.children),raw).toBe(false);
    expect(node.children.map(n => n.raw).join('')).toBe(raw);
  }
  expect(parseChemistry('A v B (v) -> B ^ B (^)').children.filter(n=>n.kind==='Evolution')).toHaveLength(4);
  expect(encodeChemistry(parseChemistry('Fe^{3+} + 3OH^- -> Fe(OH)3 v')).complete).toBe(true);
});
test('unit charges before whitespace aliases retain their role', () => {
  for (const raw of ['Na+ v','NH4+ (^)','O_2^- ^']) {
    const node = parseChemistry(raw);
    expect(node.children.some(n => n.kind === 'Charge'), raw).toBe(true);
    expect(encodeChemistry(node).complete, raw).toBe(true);
  }
  expect(parseChemistry('Fe3+ v').diagnostics.some(d => d.code === 'chemistry-ambiguous-charge')).toBe(true);
});
test('lexical proposal does not depend on ICU grouping shape', () => {
  for (const single of [true, false]) {
    const spy = vi.spyOn(Intl.Segmenter.prototype, 'segment').mockImplementation((raw: string) =>
      (raw ? single ? [{segment:raw,index:0}] : [...raw].map((segment,index)=>({segment,index})) : []) as unknown as Intl.Segments);
    try {
      const a = analyzeChineseDetailed('每年来来往往清清楚楚很好');
      expect(a.words.filter(w => joined.includes(w.raw)).map(w => w.raw)).toEqual(['来来往往','清清楚楚']);
      if (single) expect(a.words.map(w => w.raw)).toEqual(['每年','来来往往','清清楚楚','很好']);
    } finally { spy.mockRestore(); }
  }
});
test('source aliases are chemistry-only and preserve transport/layout invariants', () => {
  for (const mode of ['text','math'] as const) {
    const e = encodeDocument('中文 v ^ (v) (^)', {mode});
    expect(e.atoms.some(a => a.ruleId === 'GBT18028-2010-8.2.2.8')).toBe(false);
  }
  expect(encodeDocument('H2 ^', {mode:'chemistry'}).atoms.some(a => a.ruleId === 'GBT18028-2010-8.2.2.8')).toBe(true);
  for (const source of ['来来往往，说说笑笑。清清楚楚，弯弯曲曲。', String.raw`反应\ce{Fe^{3+} + 3OH^- -> Fe(OH)3 v}结束。`]) {
    const r = convert(source, {columns:10});
    expect(r.unhandled).toEqual([]);
    expect(brfToUnicode(r.brf)).toBe(r.unicode);
    expect(r.lines.every(line => [...line].length <= 10)).toBe(true);
    for (const a of r.atoms) expect(a.span.start >= 0 && a.span.end <= source.length).toBe(true);
  }
});
