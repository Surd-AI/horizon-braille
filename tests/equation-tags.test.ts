import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille} from '../packages/core/src/rules/math-symbols';

const options={mode:'math' as const,paragraphIndent:0,columns:100};
test('explicit numeric equation label is separated and retains its parentheses',()=>{
 const source=String.raw`x=1\tag{2}`,r=convert(source,options);
 expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert('x=1',options).unicode+braille(['0','0','126','4','3456','12','345']));
 expect(r.document.source).toBe(source);expect(r.unhandled).toEqual([]);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});
test('starred tag retains the label without inventing parentheses',()=>{
 const r=convert(String.raw`x=1\tag*{2}`,options);
 expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert('x=1',options).unicode+braille(['0','0','4','3456','12']));
});
test('an early tag remains the label for the whole equation',()=>{
 const a=convert(String.raw`\tag{2}x=1`,options),b=convert(String.raw`x=1\tag{2}`,options);
 expect(a.complete).toBe(true);expect(a.unicode).toBe(b.unicode);
});
test('aligned labels remain attached to their own row',()=>{
 const source=String.raw`\begin{aligned}x&=1\tag{2}\\y&=3\tag*{4}\end{aligned}`,r=convert(source,options);
 expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(String.raw`x=1\tag{2}`,options).unicode+
  braille(['46','1256'])+convert(String.raw`y=3\tag*{4}`,options).unicode);
});
test('literal Latin and decimal labels stay identifiers and fit intact',()=>{
 for(const label of ['1.2','A','A-1','(a)']){
  const r=convert(`x=1\\tag{${label}}`,{...options,columns:15});
  expect(r.complete).toBe(true);expect(r.document.source).toBe(`x=1\\tag{${label}}`);
  expect(r.lines.every(line=>line.length<=15)).toBe(true);
 }
});
test('Chinese label metadata retains exact source positions for manual editing',()=>{
 const source=String.raw`x=1\tag{函数}`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.metadata.chineseWords.some(w=>w.raw==='函数')).toBe(true);
 expect(r.metadata.chineseWords.every(w=>source.slice(w.span.start,w.span.end)===w.raw)).toBe(true);
});
test.each([String.raw`x=1\tag{}`,String.raw`x=1\tag`,String.raw`x=1\tag{1`,String.raw`x=1\tag{1}\tag{2}`,String.raw`\tag{1}`,String.raw`\frac{1\tag{2}}{3}`])('invalid or misplaced tag remains visible for correction: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('bare formula islands retain trailing tags',()=>{
 const source=String.raw`x=1\tag{2}`;
 const r=convert(source,{paragraphIndent:0,columns:100});expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(source,options).unicode);
});
