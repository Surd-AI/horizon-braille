import {test,expect} from 'vitest';
import {EditorSession,executeSemanticJob} from '../apps/playground/src/session';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {encodeDocument} from '../packages/core/src/convert';
import {unicodeToBrf} from '../packages/core/src/codec';
import {layout} from '../packages/core/src/layout';
import {braille as b} from '../packages/core/src/rules/math-symbols';

test('word edits are occurrence-bound, reflow, export, survive recomputation and reset',async()=>{
  const s=new EditorSession(executeSemanticJob);
  await s.setSource('春天，春天。');
  s.setLayout({columns:10,paragraphIndent:0});
  const automatic=s.result!.unicode;
  s.setBrailleEdit({start:0,end:2},'⠁⠃⠉');
  expect(s.result!.unicode).toMatch(/^⠁⠃⠉/);
  expect(s.result!.atoms.filter(a=>a.ruleId==='manual-braille')).toHaveLength(1);
  expect(s.result!.atoms.filter(a=>a.span.start>=3 && a.span.end<=5)).toEqual(s.encoded!.atoms.filter(a=>a.span.start>=3 && a.span.end<=5));
  expect(s.result!.brf).toBe(unicodeToBrf(s.result!.unicode));
  await s.recompute();
  s.setLayout({columns:20,rows:1});
  expect(s.result!.unicode).toMatch(/^⠁⠃⠉/);
  expect(s.result!.mappings.some(m=>m.span.start===0 && m.span.end===2)).toBe(true);
  s.setBrailleEdit({start:0,end:2},null);
  s.setLayout({columns:10,rows:25});
  expect(s.result!.unicode).toBe(automatic);
  s.setBrailleEdit({start:0,end:2},'⠁');
  await s.setSource('新春天');
  expect(s.brailleEdits).toEqual([]);
});
test('invalid glyphs, overlaps and partial atoms cannot corrupt valid output',async()=>{
  const s=new EditorSession(executeSemanticJob);
  await s.setSource('春天');
  s.setBrailleEdit({start:0,end:2},'⠁⠀⠃');
  const before=s.result;
  for(const cells of ['','A','⡀','⠁\n⠃',' '.repeat(3)]) expect(()=>s.setBrailleEdit({start:0,end:2},cells)).toThrow();
  expect(s.result).toBe(before);
  expect(()=>applyManualBraille(s.encoded!,[{start:0,end:2,cells:'⠁'},{start:1,end:2,cells:'⠃'}])).toThrow();
  const math=encodeDocument('$x^2$');
  expect(()=>applyManualBraille(math,[{start:2,end:3,cells:'⠁'}])).toThrow();
});
test('a word selected across lines replaces encoded cells before wrapping',async()=>{
  const s=new EditorSession(executeSemanticJob);
  await s.setSource('中华人民共和国');
  await s.setOptions({wordBoundaries:[{start:0,end:7}]});
  s.setLayout({columns:10,paragraphIndent:0});
  s.setBrailleEdit({start:0,end:7},'⠁'.repeat(9));
  expect(s.result!.lines).toEqual(['⠁'.repeat(9)]);
  expect(s.result!.pages.flat()).toEqual(s.result!.lines);
});
test.each([String.raw`\overset{\text{因为}}{x}`,String.raw`\sqrt{\text{因为}}`,String.raw`\frac{\text{因为}}{2}`,String.raw`x=1\tag{因为}`,String.raw`\vec{a_{\text{因为}}}`])('a literal word inside mathematics can be edited while framing stays intact: %s',source=>{
 const encoded=encodeDocument(source,{mode:'math'}),start=source.indexOf('因为');
 const patched=applyManualBraille(encoded,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(patched.document.source).toBe(source);
 expect(patched.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[])).toEqual(encoded.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[]));
 const r=layout(patched.atoms,{columns:30,paragraphIndent:0});expect(r.complete).toBe(true);expect(r.lines.join('\n')).toContain('⠁⠃');
 if(source.startsWith('\\overset'))expect(r.lines.join('\n')).toBe(b(['56','1346','45','1','12','156']));
});
test('partial literal atoms and row separators remain protected during math-word edits',()=>{
 const encoded=encodeDocument(String.raw`\overset{\text{abc}}{x}`,{mode:'math'}),start=encoded.document.source.indexOf('abc');
 expect(()=>applyManualBraille(encoded,[{start:start+1,end:start+3,cells:'⠁'}])).toThrow();
 const matrix=encodeDocument(String.raw`\begin{pmatrix}a\\b\end{pmatrix}`,{mode:'math'});
 expect(()=>applyManualBraille(matrix,[{start:0,end:matrix.document.source.length,cells:'⠁'}])).toThrow();
});
