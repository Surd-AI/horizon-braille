import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,paragraphIndent:0};
test.each(['texttt','textsf'])('%s retains readable font identity and literal English/Chinese content',name=>{
 const source=`\\${name}{abc 因为}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-font-described')).toBe(true);
 expect(r.metadata.chineseWords.some(w=>w.raw==='因为' && source.slice(w.span.start,w.span.end)===w.raw)).toBe(true);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
});
test.each([String.raw`\texttt{abc\_def\#\$}`,String.raw`\textsf{因为 $x^2>0$ 所以}`,String.raw`\begin{aligned}\texttt{因为}&x>0\\\textsf{所以}&x^2>0\end{aligned}`])('text controls and nested math retain separate scopes: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});
test('single-token text fonts retain the same text framing as braced forms',()=>{
 expect(convert(String.raw`\texttt x`,options).unicode).toBe(convert(String.raw`\texttt{x}`,options).unicode);
 expect(convert(String.raw`\textsf 2`,options).unicode).toBe(convert(String.raw`\textsf{2}`,options).unicode);
});
test('different text families do not collapse into one caption',()=>{
 expect(convert(String.raw`\texttt{abc}`,options).unicode).not.toBe(convert(String.raw`\textsf{abc}`,options).unicode);
});
test.each([String.raw`\texttt{}`,String.raw`\textsf{\unknown}`])('empty/unresolved text stays source-visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
test('manual body edits preserve font descriptions',()=>{
 const source=String.raw`\texttt{因为}`,encoded=encodeDocument(source,options),start=source.indexOf('因为');
 const edited=applyManualBraille(encoded,[{start,end:start+2,cells:'⠁⠃'}]);
 const frames=(r:typeof encoded)=>r.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[]);
 expect(frames(edited)).toEqual(frames(encoded));expect(edited.document.source).toBe(source);
});
