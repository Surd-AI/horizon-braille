import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {encodeText} from '../packages/core/src/rules/text';
import {parseDocument} from '../packages/core/src/parser/document';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'document' as const,paragraphIndent:0};
test.each([String.raw`\unknown{x}`,String.raw`\frac{a}{`,String.raw`前 \unknown{x} 后`,String.raw`# abc`+'\n\n'+String.raw`\unknown{x} $y^2$`])('unrecognized source remains readable while neighboring content converts: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='document-source-transcribed')).toBe(true);
 expect(r.unhandled.length).toBeGreaterThan(0);
 const unparsed=r.document.nodes.find(n=>n.kind==='unparsed');expect(unparsed).toBeTruthy();
 if(unparsed){const spelling=encodeText(unparsed.raw,0,{mathText:false}).atoms.map(a=>a.cells).join('');expect(r.atoms.map(a=>a.kind==='cell'?a.cells:'').join('')).toContain(spelling);}
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
});
test('explicit math still uses actual semantic fields rather than literal fallback',()=>{
 const r=convert(String.raw`\frac{a}{b}`,{mode:'math',paragraphIndent:0});expect(r.complete).toBe(true);
 expect(r.diagnostics.some(d=>d.code==='document-source-transcribed')).toBe(false);
});
test('a following known formula re-enters mathematics after the literal source field',()=>{
 const source=String.raw`\unknown $\frac{1}{2}$`,r=convert(source,options),start=source.indexOf('\\frac');
 expect(r.complete).toBe(false);
 const first=r.atoms.find(a=>a.kind==='cell'&&a.span.start>=start);
 expect(first?.kind).toBe('cell');if(first?.kind==='cell')expect(first.cells.codePointAt(0)).toBe(0x2828);
});
test('literal fallback word edits retain the review marker and caption',()=>{
 const source='\\custom{因为}',doc=parseDocument(source);
 // Exercise a retained source node carrying actual Chinese words, not a fake caption word.
 doc.nodes=[{kind:'unparsed',id:'retained',span:{start:0,end:source.length},raw:source,reason:'ambiguous-formula'}];
 const r=encodeDocument(doc,options),start=source.indexOf('因为'),edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(edited.atoms.filter(a=>a.ruleId==='unparsed-source-description')).toEqual(r.atoms.filter(a=>a.ruleId==='unparsed-source-description'));
 expect(edited.document.source).toBe(source);
});
test('resource-limit nodes stay bounded rather than triggering full reprocessing',()=>{
 const source='x'.repeat(1000001),r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.atoms.length).toBe(1);expect(r.diagnostics.some(d=>d.code==='document-source-transcribed')).toBe(false);
});
