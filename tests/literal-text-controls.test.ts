import {expect,test} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {parseMath} from '../packages/core/src/parser/math';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,paragraphIndent:0};
test.each(['text','mbox'])('nested textcircled in %s retains its text-mode enclosure',name=>{
 const source=`\\${name}{\\textcircled{1}}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(String.raw`\textcircled{1}`,options).unicode);
 expect(convert(source,{paragraphIndent:0}).unicode).toBe(r.unicode);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
 expect(r.document.source).toBe(source);expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});
test.each(['%','{','}'])('escaped %s keeps its checked character and full two-character source span',glyph=>{
 const source=`\\text{\\${glyph}}`,r=convert(source,options);
 const literal=glyph==='}'?String.raw`\text{\}}`:glyph==='{'?String.raw`\text{\{}`:String.raw`\text{%}`;
 expect(r.complete).toBe(true);if(glyph==='%')expect(r.unicode).toBe(convert(literal,options).unicode);
 expect(convert(source,{paragraphIndent:0}).complete).toBe(true);
 const start=source.indexOf('\\'+glyph);
 expect(r.atoms.filter(a=>a.kind==='cell' && a.cells.trim()).every(a=>a.span.start>=start && a.span.end<=start+2)).toBe(true);
 expect(r.metadata.chineseWords.every(w=>source.slice(w.span.start,w.span.end)===w.raw)).toBe(true);
});
test.each(['$','#','_','&'])('escaped literal %s retains a readable description and full source span',glyph=>{
 const source=`\\text{\\${glyph}}`,r=convert(source,options),start=source.indexOf('\\'+glyph);
 expect(r.complete).toBe(true);expect(r.unhandled).toEqual([]);
 expect(r.document.source).toBe(source);expect(r.unicode).toBeTruthy();
 expect(r.atoms.filter(a=>a.kind==='cell' && a.ruleId==='editorial-text-symbol-description').every(a=>a.span.start===start && a.span.end===start+2)).toBe(true);
 expect(r.diagnostics.some(d=>d.code==='math-text-unclosed-inline')).toBe(false);
});
test('mixed text, nested circles and actual inline mathematics preserve their separate scopes',()=>{
 const source=String.raw`$\text{abc \textcircled{1} def $x^2$ ghi}$`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.unicode).toBe(convert(String.raw`\text{abc }\textcircled{1}\text{ def }x^2\text{ ghi}`,options).unicode);
});
test.each([['abc\\%def','abc%def'],['abc\\{def\\}ghi','abc{def}ghi']])('decoded escapes retain neighboring text/symbol spacing: %s',(escaped,literal)=>{
 expect(convert(`\\text{${escaped}}`,options).unicode).toBe(convert(`\\text{${literal}}`,options).unicode);
});
test('Chinese word edits preserve a nested circle and exact source offsets',()=>{
 const source=String.raw`\text{\textcircled{因为}\%}`,r=convert(source,options),start=source.indexOf('因为');
 expect(r.complete).toBe(true);expect(r.metadata.chineseWords.some(w=>w.raw==='因为' && w.span.start===start)).toBe(true);
 const encoded=encodeDocument(source,options),edited=applyManualBraille(encoded,[{start,end:start+2,cells:'⠁⠃'}]);
 const frames=(r:typeof encoded)=>r.atoms.flatMap(a=>a.kind==='cell' && a.sourceRole==='structure'?[a.cells]:[]);
 expect(frames(edited)).toEqual(frames(encoded));expect(edited.document.source).toBe(source);
});
test('nested circles obey the shared parser depth limit',()=>{
 let source='x';for(let i=0;i<12;i++)source=`\\textcircled{${source}}`;
 expect(parseMath(source,undefined,{maxDepth:5}).diagnostics.some(d=>d.code==='math-depth-limit')).toBe(true);
});
test('unknown nested enclosure content remains incomplete',()=>{
 const source=String.raw`\text{\textcircled{\unknown}}`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toContain('⠿');
});
