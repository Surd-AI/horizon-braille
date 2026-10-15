import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {encodeText} from '../packages/core/src/rules/text';
import {braille,SYMBOLS} from '../packages/core/src/rules/math-symbols';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,paragraphIndent:0};
test.each([['therefore','∴'],['because','∵'],['square','□'],['Box','□'],['gets','←']])('%s matches the corresponding glyph %s',(name,glyph)=>{
 const source=`a\\${name} b`,r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.unicode).toBe(convert(`a${glyph}b`,options).unicode);expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test.each(['∴','∵','□'])('literal prose %s uses the existing text-math transition and native sign',source=>{const r=convert(source,{mode:'text',paragraphIndent:0}),t=encodeText(source,0);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(t.complete).toBe(true);expect(t.atoms.some(a=>a.cells===braille(['46',...SYMBOLS[source].dots])&&a.span.start===0&&a.span.end===1)).toBe(true);});
test('reasoning signs, hollow square and filled square remain distinct',()=>{expect(new Set(['∴','∵','□',String.raw`\blacksquare`].map(s=>convert(s,options).unicode)).size).toBe(4);});
test.each([String.raw`\begin{aligned}∵&x=1\\∴&x+1=2\end{aligned}`,String.raw`\text{因为}∵x=1`,String.raw`A^{\Box}`,String.raw`\frac{□}{x}`,String.raw`x\gets y`])('glyph aliases preserve fields and positions %s',source=>{const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();});
test.each([String.raw`$∴x=1$`,String.raw`\Box`,String.raw`x\gets y`])('document recognizes explicit glyph/alias context %s',source=>{const r=convert(source,{mode:'document',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.document.nodes.some(n=>n.kind==='inline-math'||n.kind==='bare-math')).toBe(true);});
test.each([String.raw`∴\unknown{x}+1`,String.raw`\Boxunknown{x}`,String.raw`\getsunknown{x}`])('unknown neighboring syntax stays visibly reviewable %s',source=>{const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();});
test('word edits retain neighboring native symbol cells',()=>{const source='因为 ∴ ∵ □',r=encodeDocument(source,{mode:'text',paragraphIndent:0}),e=applyManualBraille(r,[{start:0,end:2,cells:'⠁⠃'}]);expect(r.complete).toBe(true);const symbols=r.atoms.filter(a=>a.ruleId==='GBT18028-2010-5.4'&&a.span.start>2);expect(symbols).toHaveLength(3);expect(e.atoms.filter(a=>a.ruleId==='GBT18028-2010-5.4'&&a.span.start>2)).toEqual(symbols);});
