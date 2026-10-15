import {expect,test} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {layout} from '../packages/core/src/layout';
const options={mode:'math' as const,paragraphIndent:0};
test.each([['xrightarrow','rightarrow'],['xRightarrow','Rightarrow'],['xleftrightarrow','leftrightarrow'],['xLeftrightarrow','Leftrightarrow'],['xmapsto','mapsto'],['xlongequal','=']])('%s retains its base glyph and upper field',(name,base)=>{
 const source=`A\\${name}{f}B`,r=convert(source,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(`A\\overset{f}{${base==='='?'=':`\\${base}`}}B`,options).unicode);
 expect(r.document.source).toBe(source);expect(convert(source,{paragraphIndent:0}).unicode).toBe(r.unicode);
});
test('both optional lower and required upper labels retain their separate directions',()=>{
 const source=String.raw`A\xrightarrow[g]{f}B`,r=convert(source,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(String.raw`A\overset{f}{\underset{g}{\rightarrow}}B`,options).unicode);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});
test.each([String.raw`A\xrightarrow[]{f}B`,String.raw`A\xrightarrow[g]{}B`,String.raw`A\xrightarrow[]{}B`,String.raw`A\xrightarrow{}B`])('empty optional fields retain an arrow without inventing labels: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.unhandled).toEqual([]);expect(r.document.source).toBe(source);
});
test('Chinese label words retain exact spans and can be edited without losing arrow framing',()=>{
 const source=String.raw`A\xrightarrow[\text{函数}]{\text{因为}}B`,encoded=encodeDocument(source,options);
 expect(encoded.complete).toBe(true);expect(encoded.metadata.chineseWords.map(w=>w.raw)).toEqual(['函数','因为']);
 expect(encoded.metadata.chineseWords.every(w=>source.slice(w.span.start,w.span.end)===w.raw)).toBe(true);
 const start=source.indexOf('因为'),patched=applyManualBraille(encoded,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(patched.document.source).toBe(source);
 expect(patched.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[])).toEqual(encoded.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[]));
 expect(layout(patched.atoms,{columns:30,paragraphIndent:0}).lines.join('\n')).toContain('⠁⠃');
});
test.each([String.raw`A\xrightarrow`,String.raw`A\xrightarrow[g`,String.raw`A\xrightarrow{\notyet}B`])('missing or unsupported label content stays visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
