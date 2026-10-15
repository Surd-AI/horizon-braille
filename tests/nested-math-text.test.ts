import {expect,test} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {parseDocument} from '../packages/core/src/parser/document';
import {parseMath} from '../packages/core/src/parser/math';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {layout} from '../packages/core/src/layout';
const options={mode:'math' as const,paragraphIndent:0};

test.each(['text','mbox'])('%s preserves text/math transitions and exact Chinese spans',name=>{
 const source=`\\${name}{因为 $x>0$ 所以}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unhandled).toEqual([]);
 expect(r.unicode).toBe(convert(String.raw`\text{因为 }x>0\text{ 所以}`,options).unicode);
 expect(r.metadata.chineseWords.map(w=>w.raw).filter(w=>w.trim())).toEqual(['因为','所以']);
 expect(r.metadata.chineseWords.every(w=>source.slice(w.span.start,w.span.end)===w.raw)).toBe(true);
});
test.each([['$','$'],['$$','$$'],['\\(','\\)'],['\\[','\\]']])('outer %s wrapper remains intact around a text command containing inline mathematics',(open,close)=>{
 const inner=String.raw`\text{因为 $x>0$ 所以}`,source=open+inner+close;
 const doc=parseDocument(source);expect(doc.nodes).toHaveLength(1);expect(doc.nodes[0].raw).toBe(source);
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(inner,options).unicode);
 expect(r.document.source).toBe(source);expect(r.metadata.chineseWords.every(w=>source.slice(w.span.start,w.span.end)===w.raw)).toBe(true);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
});
test('multiple inline fragments keep their own nested formula scopes',()=>{
 const source=String.raw`\text{abc $x^2$ def $\frac{1}{2}$ ghi}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(String.raw`\text{abc }x^2\text{ def }\frac{1}{2}\text{ ghi}`,options).unicode);
});
test('literal Chinese word edits retain both the neighboring math and delimiter source',()=>{
 const source=String.raw`$\text{因为 $x>0$ 所以}$`,encoded=encodeDocument(source,options),start=source.indexOf('因为');
 const patched=applyManualBraille(encoded,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(patched.document.source).toBe(source);expect(layout(patched.atoms,{columns:30,paragraphIndent:0}).lines.join('\n')).toContain('⠁⠃');
 expect(patched.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[])).toEqual(encoded.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[]));
});
test.each([String.raw`\text{abc $x}`,String.raw`\text{abc $ $ def}`,String.raw`\text{abc $\unknown$ def}`])('malformed or unknown inner math stays visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('nested text-math parsing obeys the existing depth bound',()=>{
 let source='x';for(let i=0;i<12;i++)source=String.raw`\text{a $${source}$ b}`;
 expect(parseMath(source,undefined,{maxDepth:5}).diagnostics.some(d=>d.code==='math-depth-limit')).toBe(true);
});
