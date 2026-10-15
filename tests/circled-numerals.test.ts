import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {encodeText} from '../packages/core/src/rules/text';
import {braille,DIGITS,LOWER_DIGITS} from '../packages/core/src/rules/math-symbols';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,paragraphIndent:0};
// Independent endpoint/range fixtures from Unicode Enclosed Alphanumerics/CJK.
const glyphs='⓪①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳㉑㉒㉓㉔㉕㉖㉗㉘㉙㉚㉛㉜㉝㉞㉟㊱㊲㊳㊴㊵㊶㊷㊸㊹㊺㊻㊼㊽㊾㊿';
test.each([...glyphs].map((glyph,n)=>[glyph,n] as const))('%s retains the whole circled decimal numeral %s',(glyph,n)=>{
 const dots=['3456',...Array.from(String(n),c=>DIGITS[+c]),'6','356'];
 const prose=encodeText(glyph,7),math=convert(glyph,options);
 expect(prose.complete).toBe(true);// Preserve the already published GF0019 Annex B prose profile for ①–⑩.
 expect(prose.atoms.map(a=>a.cells).join('')).toBe(braille(n>=1&&n<=10?['3456',...Array.from(String(n),c=>LOWER_DIGITS[+c])]:dots));
 expect(prose.atoms.every(a=>a.span.start===7&&a.span.end===8)).toBe(true);
 expect(math.complete).toBe(true);expect(math.document.source).toBe(glyph);
 expect(math.unicode).toBe(braille(['4',...dots]));
 expect(math.atoms.every(a=>a.span.start===0&&a.span.end===1)).toBe(true);
 expect(math.metadata.chineseWords.every(w=>w.kind!=='chinese' && w.raw===glyph && w.span.start===0&&w.span.end===1)).toBe(true);
});
test('single-digit math glyphs agree with explicit circled text notation',()=>{
 for(const [i,glyph] of [...'⓪①②③④⑤⑥⑦⑧⑨'].entries())
  expect(convert(glyph,options).unicode).toBe(convert(`\\textcircled{${i}}`,options).unicode);
});
test('circled numbers keep distinct frames and digits under wrapping',()=>{
 const source='①②⑩⑳㉑㉟㊱㊿',wide=convert(source,{...options,columns:100}),narrow=convert(source,{...options,columns:10});
 expect(narrow.complete).toBe(true);expect(narrow.lines.length).toBeGreaterThan(1);
 expect(narrow.atoms).toEqual(wide.atoms);expect(narrow.lines.every(l=>l.length<=10)).toBe(true);
 expect(new Set([...source].map(g=>convert(g,options).unicode)).size).toBe([...source].length);
});
test.each([String.raw`\frac{①+②}{⑩}`,String.raw`①^2+②`,String.raw`\begin{aligned}\text{因为}&①=1\\\text{所以}&②=2\end{aligned}`])('circled labels remain inside formula fields: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});
test('Chinese source edits preserve circled numeric labels',()=>{
 const source=String.raw`\begin{aligned}\text{因为}&①=1\\\text{所以}&②=2\end{aligned}`,r=encodeDocument(source,options),start=source.indexOf('因为');
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 const frames=(v:typeof r)=>v.atoms.filter(a=>source.slice(a.span.start,a.span.end)==='①'||source.slice(a.span.start,a.span.end)==='②');
 expect(frames(edited)).toEqual(frames(r));expect(edited.document.source).toBe(source);
});
test('different enclosures and unknown neighbors remain visible for review',()=>{
 for(const source of ['❶','⓵','⓿','⑴','⒈','①🦄']) {
  const r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
 }
});
