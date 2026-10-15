import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {parseMath} from '../packages/core/src/parser/math';

const options={mode:'math' as const,columns:30,paragraphIndent:0};
test.each([['(',')','pmatrix'],['[',']','bmatrix'],['\\{','\\}','Bmatrix'],['|','|','vmatrix'],['\\|','\\|','Vmatrix'],['\\{','.','cases']])('OCR array delimited by %s %s shares the checked %s row profile',(left,right,env)=>{
 const source=`\\left${left}\\begin{array}{cc}a&b\\\\c&d\\end{array}\\right${right}`;
 const r=convert(source,options),reference=convert(`\\begin{${env}}a&b\\\\c&d\\end{${env}}`,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(reference.unicode);expect(r.document.source).toBe(source);
 expect(r.unhandled).toEqual([]);expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});
test('a script binds to the bracketed array rather than only its closing delimiter',()=>{
 const source=String.raw`\left(\begin{array}{c}a\\b\end{array}\right)^2`;
 expect(convert(source,options).unicode).toBe(convert(String.raw`\begin{pmatrix}a\\b\end{pmatrix}^2`,options).unicode);
 const ast=parseMath(source).body;
 expect(ast.kind==='sequence' && ast.children[0].kind==='script' && ast.children[0].base.kind==='matrix').toBe(true);
});
test('a single-cell array is a grouping wrapper inside a subscript',()=>{
 const source=String.raw`x_{\begin{array}{c}s\end{array}}`;
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.unicode).toBe(convert('x_s',options).unicode);
});
test('standalone arrays preserve row order and column separation',()=>{
 const r=convert(String.raw`\begin{array}{lr}a&b\\c&d\end{array}`,options);
 expect(r.complete).toBe(true);expect(r.lines.length).toBe(2);
 expect(r.unicode).toBe(convert(String.raw`\begin{matrix}a&b\\c&d\end{matrix}`,options).unicode);
});
test('invalid or unclosed array syntax remains visible and incomplete',()=>{
 for(const source of [String.raw`\begin{array}{X}a\end{array}`,String.raw`\begin{array}{c}a`]) {
  const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode || r.preview?.unicode).toBeTruthy();
 }
});
test('an unmatched delimiter does not convert an array into cases',()=>{
 const source=String.raw`\left\{\begin{array}{c}a\\b\end{array}\right)`;
 const ast=parseMath(source).body;
 expect(ast.kind==='sequence' && ast.children.some(n=>n.kind==='matrix' && n.environment==='array')).toBe(true);
});
test.each([String.raw`\begin{array}{cc}\end{array}`,String.raw`\begin{aligned}&\begin{array}{cccc`])('an empty or truncated OCR array stays visibly unresolved: %s',source=>{
 const r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.unicode || r.preview?.unicode).toBeTruthy();
 expect(r.diagnostics.some(d=>d.code==='math-empty-environment')).toBe(true);
 expect(r.unhandled.every(u=>source.slice(u.span.start,u.span.end)===u.raw)).toBe(true);
});
test('document detection keeps a complete sized-bracket array in one math island',()=>{
 const source=String.raw`\left\{\begin{array}{c}x>0\\x<2\end{array}\right.`;
 const r=convert(source,{columns:30,paragraphIndent:0});
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(source,options).unicode);
 expect(r.document.source).toBe(source);
});
