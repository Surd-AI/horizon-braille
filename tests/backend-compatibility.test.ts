import {test,expect} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {encodeMath} from '../packages/core/src/rules/math';
import {parseMath} from '../packages/core/src/parser/math';
import {braille as b} from '../packages/core/src/rules/math-symbols';

test.each([String.raw`x^{\prime}`,String.raw`x^{\prime\prime}`])('OCR prime spelling preserves derivative notation: %s',s=>{
 const r=convert(s,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(s.includes('prime\\prime')?"x''":"x'",{mode:'math',paragraphIndent:0}).unicode);
});
test.each([['mathcal','346'],['mathscr','346'],['boldsymbol','1456']])('OCR %s letter font uses the section 5.2.2 indicator', (name,font)=>{
 expect(convert(`\\${name}{x}`,{mode:'math',paragraphIndent:0}).unicode).toBe(b(['56',font,'1346']));
});
test.each([['hat','256'],['widehat','256'],['tilde','26'],['underline','25']])('OCR %s single-letter annotation retains its checked position', (name,mark)=>{
 const r=convert(`\\${name}{x}`,{mode:'math',paragraphIndent:0});expect(r.complete).toBe(true);
 expect(r.unicode).toBe(b(['56','1346',name==='underline'?'56':'45',mark,'156']));
});
test('function names and invisible delimiters preserve arithmetic',()=>{
 expect(convert(String.raw`\operatorname{sin}(x)`,{mode:'math',paragraphIndent:0}).unicode).toBe(convert(String.raw`\sin(x)`,{mode:'math',paragraphIndent:0}).unicode);
 expect(convert(String.raw`\left.x\right.`,{mode:'math',paragraphIndent:0}).unicode).toBe(convert('x',{mode:'math',paragraphIndent:0}).unicode);
 const unknown=convert(String.raw`\operatorname{custom-name}(x)`,{mode:'math'});expect(unknown.complete).toBe(false);expect(unknown.document.source).toContain('custom-name');expect(unknown.unicode).toBeTruthy();
});
test('aligned Chinese reasoning and its conditions retain their exact source words and order',()=>{
 const source=String.raw`\begin{aligned}\text{因为}&x>0\\\text{所以}&x^2>0\end{aligned}`;
 const r=convert(source,{mode:'math',columns:30,paragraphIndent:0});
 expect(r.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
 for(const raw of ['因为','所以']){
  expect(r.metadata.chineseWords.some(w=>w.raw===raw && source.slice(w.span.start,w.span.end)===raw)).toBe(true);
 }
 const text=encodeMath(parseMath(String.raw`\text{因为}`)).atoms.map(a=>a.cells).join('');
 expect(r.atoms.map(a=>a.kind==='cell'?a.cells:'').join('')).toContain(text+'⠀'+b(['46','56','1346']));
 expect(r.document.source).toBe(source);expect(r.unicode).toBeTruthy();
});
test('aligned English condition cells remain prose and binary signs remain binary',()=>{
 const source=String.raw`\begin{aligned}f(x)&=x^2\quad\text{if }x>0\\f(x)&=0\quad\text{otherwise}\end{aligned}`;
 const r=convert(source,{mode:'math',columns:30,paragraphIndent:0});
 expect(r.diagnostics.filter(d=>d.severity==='error')).toEqual([]);expect(r.unhandled).toEqual([]);expect(r.unicode).toBeTruthy();
 expect(parseMath(source).raw).toBe(source);
});
test('layout failure preserves a display-only preview and strict exports remain flagged',()=>{
 const source=String.raw`\sqrt{123456789}`;
 const r=convert(source,{mode:'math',columns:4,paragraphIndent:0});
 expect(r.complete).toBe(false);expect(r.unicode).toBe('');expect(r.preview?.unicode).toBeTruthy();expect(r.preview?.truncated).toBe(false);
 expect(r.preview?.unicode).toBe(r.atoms.map(a=>a.kind==='cell'?a.cells:'').join(''));
 expect(r.document.source).toBe(source);expect(r.diagnostics.some(d=>d.code==='layout-overflow')).toBe(true);
});
test('unknown commands retain the original source and a visible unresolved marker',()=>{
 const source=String.raw`a+\notyet{x}+b`;
 const r=convert(source,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unhandled.some(u=>u.raw==='\\notyet')).toBe(true);expect(r.unicode).toContain('⠿');
});
test.each([['varepsilon','epsilon'],['varphi','phi'],['vartheta','theta'],['varrho','rho'],['varsigma','sigma'],['varpi','pi']])('declared %s form retains letter and distinct name',(variant,standard)=>{
 const options={mode:'math' as const,paragraphIndent:0};
 const single=convert(`\\${variant}`,options);
 expect(single.complete).toBe(true);expect(single.unicode).not.toBe(convert(`\\${standard}`,options).unicode);
 const conflict=convert(`\\${standard}+\\${variant}`,options);
 expect(conflict.complete).toBe(true);expect(conflict.diagnostics.some(d=>d.code==='math-greek-variant-described')).toBe(true);
});
test.each(['*','\\ast','\\star'])('superscript %s is a positioned annotation; a bare star is not guessed as multiplication',star=>{
 const r=convert(`x^{${star}}`,{mode:'math',paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unicode).toBe(b(['56','1346','34','23','156']));
 expect(convert(`x${star}y`,{mode:'math'}).complete).toBe(false);
});
test('curled l retains a distinct handwritten font and dot multiplication aliases share the checked symbol',()=>{
 expect(convert('\\ell',{mode:'math',paragraphIndent:0}).unicode).toBe(b(['56','346','123']));
 expect(convert('\\ell').complete).toBe(true);
 expect(convert('x\\cdotp y',{mode:'math',paragraphIndent:0}).unicode).toBe(convert('x\\cdot y',{mode:'math',paragraphIndent:0}).unicode);
});
test('Greek variable identities retain readable distinctions across aligned rows and matrix cells',()=>{
 for(const source of [String.raw`\begin{aligned}\epsilon&=1\\\varepsilon&=2\end{aligned}`,String.raw`\begin{matrix}\phi&\varphi\end{matrix}`]){
  const r=convert(source,{mode:'math',columns:30});expect(r.complete).toBe(true);
  expect(r.diagnostics.some(d=>d.code==='math-greek-variant-described')).toBe(true);
  expect(r.unhandled.every(u=>source.slice(u.span.start,u.span.end)===u.raw)).toBe(true);
 }
});
