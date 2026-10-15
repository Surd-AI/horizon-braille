import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {parseMath,type MathSemanticNode as N} from '../packages/core/src/parser/math';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'math' as const,paragraphIndent:0};
const styles=(n:N):N[]=>[...(n.kind==='style'?[n]:[]),...(n.kind==='sequence'?n.children:n.kind==='group'||n.kind==='style'?[n.body]:[]).flatMap(styles)];
test.each([String.raw`\color{red} a+b`,String.raw`{\color{blue}{a}b+c}d`,String.raw`\textcolor{#aBc123}{a+b}c`])('color preserves literal specification and exact body scope: %s',source=>{
 const r=convert(source,options),found=styles(parseMath(source).body);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-color-described')).toBe(true);
 for(const n of found)if(n.kind==='style'&&n.color)expect(source.slice(n.color.span.start,n.color.span.end)).toBe(n.color.value);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
});
test('color declaration consumes the entire group while textcolor takes one argument',()=>{
 const c=styles(parseMath(String.raw`{\color{red}{a}b+c}d`).body)[0],t=styles(parseMath(String.raw`\textcolor{red}{a}b`).body)[0];
 if(c.kind==='style')expect(c.body.raw).toBe('{a}b+c');if(t.kind==='style')expect(t.body.raw).toBe('{a}');
});
test('nested colors retain both specifications and restore surrounding scope',()=>{
 const source=String.raw`{\color{red}a{\color{blue}b}c}d`,r=convert(source,options),found=styles(parseMath(source).body);
 expect(r.complete).toBe(true);expect(found.filter(n=>n.kind==='style').map(n=>n.kind==='style'?n.color?.value:'')).toEqual(['red','blue']);
 expect(found.every(n=>!n.raw.includes('}d'))).toBe(true);
});
test('matching right delimiters end a color declaration',()=>{
 const source=String.raw`\left(\color{red}a+\left[b\right]\right)c`,r=convert(source,options),color=styles(parseMath(source).body)[0];
 expect(r.complete).toBe(true);if(color.kind==='style')expect(color.body.raw).not.toContain('c');
});
test('colors retain inherited native fonts',()=>{
 const letters=(s:string)=>{const r=convert(s,options);return r.atoms.filter(a=>a.kind==='cell'&&['A','B'].includes(s.slice(a.span.start,a.span.end))).map(a=>a.kind==='cell'?a.cells:'');};
 expect(letters(String.raw`\mathit{\color{red}A+B}`)).toEqual(letters(String.raw`\mathit{A+B}`));
});
test.each([String.raw`\color{red}`,String.raw`\color{}a`,String.raw`\textcolor{red}{}`,String.raw`\color{\unknown}a`,String.raw`\color[RGB]{1,0,0}a`,String.raw`\color{red!50!blue}a`,String.raw`\textcolor{red}{\unknown}`,String.raw`\sqrt\color{red}a`])('unverified color syntax retains output: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('unbraced textcolor body consumes only one token',()=>{
 const tree=parseMath(String.raw`\textcolor{red}ab`).body;if(tree.kind==='sequence'){expect(tree.children).toHaveLength(2);const first=tree.children[0];if(first.kind==='style')expect(first.body.raw).toBe('a');}
});
test.each([String.raw`\color{red} a+b`,String.raw`\textcolor{blue}{a+b}`])('document scanner recognizes color scope: %s',source=>{
 const r=convert(source,{mode:'document',paragraphIndent:0});expect(r.complete).toBe(true);expect(r.diagnostics.some(d=>d.code==='math-color-described')).toBe(true);
});
test('Chinese body edits do not change color captions or specifications',()=>{
 const source=String.raw`\begin{aligned}{\color{red}\text{因为}A}&=B\\\textcolor{blue}{\text{所以}C}&=D\end{aligned}`,r=encodeDocument(source,options),start=source.indexOf('因为');
 expect(r.complete).toBe(true);for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(edited.atoms.filter(a=>a.ruleId.startsWith('editorial-color'))).toEqual(r.atoms.filter(a=>a.ruleId.startsWith('editorial-color')));
});
test('color identities stay distinct and unknown names are retained literally',()=>{
 expect(convert(String.raw`\color{red}a`,options).unicode).not.toBe(convert(String.raw`\color{blue}a`,options).unicode);
 const source=String.raw`\textcolor{CustomName}{a+b}`,r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
});
test('nested color scopes respect depth limits',()=>{
 const source='\\color{red}'.repeat(80)+'x',r=convert(source,options);expect(r.complete).toBe(false);expect(r.diagnostics.some(d=>d.code==='math-depth-limit')).toBe(true);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
