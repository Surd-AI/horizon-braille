import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {parseMath,type MathSemanticNode as N} from '../packages/core/src/parser/math';
import {applyManualBraille} from '../packages/core/src/manual-braille';
import {braille} from '../packages/core/src/rules/math-symbols';
const options={mode:'math' as const,paragraphIndent:0};
const sizes=['tiny','scriptsize','footnotesize','small','normalsize','large','Large','LARGE','huge','Huge'];
const children=(n:N):N[]=>n.kind==='sequence'?n.children:n.kind==='style'||n.kind==='group'?[n.body]:[];
const styles=(n:N):N[]=>[...(n.kind==='style'?[n]:[]),...children(n).flatMap(styles)];
test.each(sizes)('%s applies to the entire following declaration scope',name=>{
 const source=`\\${name} a+b`,r=convert(source,options),tree=parseMath(source).body;
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 const style=styles(tree).find(n=>n.kind==='style'&&n.name===name);
 expect(style?.kind).toBe('style');if(style?.kind==='style')expect(style.body.raw.trim()).toBe('a+b');
 expect(r.diagnostics.some(d=>d.code==='math-font-described')).toBe(true);
 expect(r.atoms.every(a=>a.span.start>=0&&a.span.end<=source.length)).toBe(true);
 expect(convert(source,{...options,fontPolicy:'review-unmapped'}).complete).toBe(false);
});
test('all ten relative size names remain distinct',()=>{
 expect(new Set(sizes.map(n=>convert(`\\${n} x`,options).unicode)).size).toBe(sizes.length);
});
test('a later size declaration overrides the following inner scope',()=>{
 const source=String.raw`{\Huge a\small b}c`,tree=parseMath(source).body,found=styles(tree);
 expect(found.filter(n=>n.kind==='style').map(n=>n.kind==='style'?n.name:'')).toEqual(['Huge','small']);
 const small=found[1];if(small.kind==='style')expect(small.body.raw.trim()).toBe('b');
 expect(found.every(n=>!n.raw.includes('c'))).toBe(true);expect(convert(source,options).complete).toBe(true);
});
test('repeated size declarations respect the semantic depth limit and retain source',()=>{
 const source=('\\large '.repeat(80))+'x',r=convert(source,options);
 expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.diagnostics.some(d=>d.code==='math-depth-limit')).toBe(true);
 expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('a braced body does not end an unbraced size declaration',()=>{
 const source=String.raw`\large{a}b+c`,style=styles(parseMath(source).body)[0];
 expect(style.kind).toBe('style');if(style.kind==='style')expect(style.body.raw).toBe('{a}b+c');
 expect(convert(source,options).complete).toBe(true);
});
test('surrounding groups restore the size scope',()=>{
 const source=String.raw`{\large a+b}c`,tree=parseMath(source).body,style=styles(tree)[0];
 expect(style.kind).toBe('style');if(style.kind==='style')expect(style.body.raw.trim()).toBe('a+b');
 expect(convert(source,options).complete).toBe(true);
 expect(styles(tree).every(n=>!n.raw.includes('c'))).toBe(true);
});
test('left/right groups restore size scope, including nested delimiters',()=>{
 for(const source of [String.raw`\left(\large a+b\right)c`,String.raw`\left(\large a+\left[b\right]\right)c`]) {
  const tree=parseMath(source).body,style=styles(tree)[0];expect(style.kind).toBe('style');
  if(style.kind==='style'){expect(style.body.raw).not.toContain('c');expect(style.body.raw).toContain('a');}
  expect(convert(source,options).complete).toBe(true);
 }
});
test('size declarations preserve the enclosing native letter font',()=>{
 const source=String.raw`\mathbf{\large A+B}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toContain(braille(['6','12456','1']));
 const plain=convert(String.raw`\mathbf{A+B}`,options);
 const letters=(v:typeof r)=>v.atoms.filter(a=>['A','B'].includes(v.document.source.slice(a.span.start,a.span.end))).map(a=>a.kind==='cell'?a.cells:'');
 expect(letters(r)).toEqual(letters(plain));
});
test.each([String.raw`\frac{\small a+b}{\large c}`,String.raw`x^{\tiny a+b}`,String.raw`\large\begin{pmatrix}a&b\\c&d\end{pmatrix}`,String.raw`\begin{aligned}{\large\text{因为}}&x=1\\{\small\text{所以}}&y=2\end{aligned}`])('size declarations retain formula and text fields: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
});
test.each([String.raw`\large`,String.raw`{\small}`,String.raw`\large\unknown`,String.raw`\sqrt\large x`])('empty/unverified/unknown size content remains visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.unicode||r.preview?.unicode).toContain('⠿');expect(r.document.source).toBe(source);
});
test('word edits and reflow preserve the complete size frame',()=>{
 const source=String.raw`{\large\text{因为}x+y}z`,r=encodeDocument(source,options),start=source.indexOf('因为');
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(edited.atoms.filter(a=>a.kind==='cell'&&a.sourceRole==='structure')).toEqual(r.atoms.filter(a=>a.kind==='cell'&&a.sourceRole==='structure'));
 const long=String.raw`\large a+b+c+d+e+f+g+h+i+j+k+l+m+n`,wide=convert(long,{...options,columns:100}),narrow=convert(long,{...options,columns:30});
 expect(narrow.complete).toBe(true);expect(narrow.lines.length).toBeGreaterThan(1);expect(narrow.atoms).toEqual(wide.atoms);
});
