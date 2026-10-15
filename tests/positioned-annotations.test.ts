import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille as b} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};

// GB/T18028-2010 §6.5.1/.2 (printed p14), independently keyed position marks.
test.each([['overset','45'],['underset','56']])('%s preserves body, position and mark',(name,direction)=>{
 const r=convert(`\\${name}{+}{x}`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['56','1346',direction,'235','156']));
});
test.each([['leftarrow','246 25'],['leftrightarrow','246 25 135'],['rightarrow','25 135'],['circ','356'],['cdot','2'],['square','2356']])('positioned %s uses its mark glyph rather than a binary operator',(name,dots)=>{
 const r=convert(`\\overset{\\${name}}{x}`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['56','1346','45',...dots.split(' '),'156']));
});
test('compound annotation scope uses §5.4.2.3 grouping brackets',()=>{
 const source=String.raw`\overset{\ast}{a+b}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['12346','56','1','0','235','56','12','13456','45','23','156']));
 expect(r.document.source).toBe(source);
});
test.each([['overset','45'],['underset','56']])('multiple marks in %s each retain an ending under §6.5.2.2',(name,direction)=>{
 const r=convert(`\\${name}{\\ast+}{x}`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['56','1346',direction,'23','156','235','156']));
});
test('an annotated relation retains spacing outside its scoped body',()=>{
 const r=convert(String.raw`a\overset{\text{def}}{=}b`,options);
 expect(r.complete).toBe(true);
 expect(r.unicode).toBe(b(['56','1','0','12346','2356','13456','45','4','56','145','15','124','156','56','12']));
});
test('a division expression in the mark is not converted into a slash-shaped position mark',()=>{
 const r=convert(String.raw`\overset{a/b}{x}`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toContain(b(['6','1256']));expect(r.unicode).not.toContain(b(['5','26']));
});
test('a single relation mark has no binary-operator blank after its direction indicator',()=>{
 const r=convert(String.raw`\overset{=}{x}`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['56','1346','45','2356','156']));
});
test('superscripts retain ordinary division and degree rules',()=>{
 expect(convert('x^{a/b}',options).unicode).toContain(b(['6','1256']));
 expect(convert(String.raw`x^{\circ}`,options).unicode).toBe(b(['56','1346','5','356']));
});
test('an unknown annotation stays within its position rather than before the base',()=>{
 const source=String.raw`\overset{\notyet}{x}`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.unicode.startsWith(b(['56','1346','45','123456','12346']))).toBe(true);
 expect(r.unicode.endsWith(b(['13456','156']))).toBe(true);
 expect(r.atoms.some(a=>a.kind==='cell' && a.ruleId==='unhandled-source-transcription')).toBe(true);
 expect(r.unhandled).toHaveLength(1);expect(r.unhandled).toMatchObject([{raw:'\\notyet',span:{start:9,end:16}}]);
});
test('an unverified font in the label is flagged inside the label scope',()=>{
 const source=String.raw`\overset{\mathsf{x}}{y}`,r=convert(source,{...options,fontPolicy:'review-unmapped'});
 expect(r.complete).toBe(false);expect(r.unicode).toBe(b(['56','13456','45','56','1346','123456','156']));
 expect(r.unhandled).toHaveLength(1);expect(r.unhandled[0].raw).toBe(String.raw`\mathsf{x}`);
});
test.each([String.raw`\overset{}{x}`,String.raw`\overset{a}{}`])('empty annotation scope stays visible and incomplete: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
test('document detection and stackrel preserve annotation semantics',()=>{
 const a=String.raw`a\stackrel{\text{def}}{=}b`;
 expect(convert(a,{paragraphIndent:0}).complete).toBe(true);
 expect(convert(a,{paragraphIndent:0}).unicode).toBe(convert(String.raw`a\overset{\text{def}}{=}b`,options).unicode);
});
test.each([['overleftarrow','overset','leftarrow'],['overleftrightarrow','overset','leftrightarrow'],['underleftarrow','underset','leftarrow'],['underrightarrow','underset','rightarrow'],['underleftrightarrow','underset','leftrightarrow']])('%s retains its arrow direction and scope',(name,position,mark)=>{
 const source=`\\${name}{xy}`;
 const r=convert(source,{paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(`\\${position}{\\${mark}}{xy}`,options).unicode);
 expect(r.document.source).toBe(source);expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});
test('a long annotated expression can wrap without losing its scope or mark',()=>{
 const r=convert(String.raw`\overset{+}{abcdefghijklmnopqrstuv}`,{...options,columns:10});
 expect(r.complete).toBe(true);expect(r.lines.length).toBeGreaterThan(1);expect(r.lines.every(l=>l.length<=10)).toBe(true);
 expect(r.unicode).toContain(b(['13456','45','235','156']));
});
test('aligned Chinese annotation text retains its source and mathematical conditions',()=>{
 const source=String.raw`\begin{aligned}x&\overset{\text{定义}}{=}y\\z&\underset{n\to\infty}{=}u\end{aligned}`;
 const r=convert(source,options);
 expect(r.unhandled).toEqual([]);expect(r.diagnostics.filter(d=>d.severity==='error')).toEqual([]);expect(r.document.source).toBe(source);
 const words=r.metadata.chineseWords.filter(w=>w.kind==='chinese');
 expect(words.map(w=>w.raw).join('')).toBe('定义');
 expect(words.every(w=>source.slice(w.span.start,w.span.end)===w.raw)).toBe(true);
 expect(r.atoms.filter(a=>a.kind==='cell').map(a=>a.cells).join('')).toContain(b(['56','1345','0','25','135','3456','123456','156']));
});
test('review mode keeps a position-only native arrow unresolved as a bare operator',()=>{
 const r=convert('a\\leftarrow b',{...options,symbolPolicy:'review-unmapped'});expect(r.complete).toBe(false);expect(r.unhandled.some(u=>u.raw==='\\leftarrow')).toBe(true);
});
