import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {parseMath} from '../packages/core/src/parser/math';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,paragraphIndent:0};
test.each([String.raw`x=1\eqno(1)`,String.raw`a+b=c\eqno 12`,String.raw`x=1\eqno{A.2}`,String.raw`x=1\eqno\frac{1}{2}`])('eqno retains a separate complete label: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-equation-tag-linearized')).toBe(true);
 expect(r.atoms.some(a=>a.kind==='cell'&&a.group.includes('equation-tag:'))).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
});
test('the complete suffix is the label rather than additional equation text',()=>{
 const source=String.raw`x=1\eqno(1)+A`,tree=parseMath(source).body;
 expect(tree.kind).toBe('sequence');if(tree.kind==='sequence') {
  const tag=tree.children.at(-1);expect(tag?.kind).toBe('equation-tag');
  if(tag?.kind==='equation-tag')expect(tag.body.raw).toBe('(1)+A');
 }
});
test.each([String.raw`\eqno1`,String.raw`x=1\eqno`,String.raw`x=1\eqno{}`,String.raw`x=1\eqno\quad`,String.raw`\frac{a}{b\eqno1}`,String.raw`x=1\eqno\unknown`])('missing/unverified label placements remain visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.unicode||r.preview?.unicode).toBeTruthy();expect(r.diagnostics.some(d=>d.severity!=='info')).toBe(true);
});
test('display delimiters and numbered aligned rows preserve the source',()=>{
 for(const source of [String.raw`$$x=1\eqno(1)$$`,String.raw`\begin{aligned}x&=1\eqno(1)\\y&=2\eqno(2)\end{aligned}`]) {
  const r=convert(source,{paragraphIndent:0});expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 }
});
test('editing Chinese label text preserves equation and numbering frames',()=>{
 const source=String.raw`x=1\eqno\text{因为}`,r=encodeDocument(source,options),start=source.indexOf('因为'),edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(edited.document.source).toBe(source);
 expect(edited.atoms.filter(a=>a.kind==='cell'&&a.sourceRole==='structure')).toEqual(r.atoms.filter(a=>a.kind==='cell'&&a.sourceRole==='structure'));
});
