import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {encodeText} from '../packages/core/src/rules/text';
const options={mode:'math' as const,paragraphIndent:0};

test('unknown control words retain readable spelling and neighboring expressions',()=>{
 const source=String.raw`a+\notyet{x}+b`,r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.unhandled.some(u=>u.raw==='\\notyet')).toBe(true);
 const spelling=encodeText('notyet',0,{mathText:true}).atoms.map(a=>a.cells).join('');
 expect(r.unicode||r.preview?.unicode).toContain(spelling);
 expect(r.atoms.some(a=>a.kind==='cell' && a.ruleId==='unhandled-source-transcription')).toBe(true);
 for(const letter of ['a','x','b'])expect(r.atoms.some(a=>a.kind==='cell' && source.slice(a.span.start,a.span.end)===letter)).toBe(true);
 expect(r.diagnostics.some(d=>d.code==='math-source-transcribed')).toBe(true);
});

test.each([String.raw`\frac{\unknown{x}+1}{y}`,String.raw`x^{\unknown}`,String.raw`\begin{aligned}x&=\unknown{y}\\z&=2\end{aligned}`])('unknown spelling stays inside its original scope: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toBeTruthy();
 expect(r.atoms.filter(a=>a.kind==='cell' && a.ruleId==='unhandled-source-transcription').every(a=>a.span.start>=source.indexOf('unknown') && a.span.end<=source.indexOf('unknown')+7)).toBe(true);
 expect(r.document.source).toBe(source);
});

test('long unknown names survive layout failure as readable preview',()=>{
 const source='x+\\'+('unknown'.repeat(20))+'+y',r=convert(source,{...options,columns:4});
 expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toBeTruthy();
 expect(r.document.source).toBe(source);
 expect(r.atoms.flatMap(a=>a.kind==='cell' && a.ruleId==='unhandled-source-transcription'?[a.cells]:[]).join('')).toBe(encodeText('unknown'.repeat(20),0,{mathText:true}).atoms.map(a=>a.cells).join(''));
});

test.each(['constructor','toString','__proto__'])('literal prototype-like names cannot crash conversion: %s',name=>{
 const r=convert('x+\\'+name+'+y',options);expect(r.complete).toBe(false);
 expect(r.document.source).toBe('x+\\'+name+'+y');expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
