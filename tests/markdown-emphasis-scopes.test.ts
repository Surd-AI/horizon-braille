import {test,expect} from 'vitest';
import {parseDocument} from '../packages/core/src/parser/document';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={mode:'document' as const,paragraphIndent:0};
const roles=(source:string)=>parseDocument(source).nodes.flatMap(n=>n.kind==='markdown-marker'&&/^(emphasis|strong)-/.test(n.role)?[n.role]:[]);
test.each([['*abc*',['emphasis-start','emphasis-end']],['_abc_',['emphasis-start','emphasis-end']],['**abc**',['strong-start','strong-end']],['__abc__',['strong-start','strong-end']],['***abc***',['emphasis-start','strong-start','strong-end','emphasis-end']],['**abc *def* ghi**',['strong-start','emphasis-start','emphasis-end','strong-end']],['*abc **def** ghi*',['emphasis-start','strong-start','strong-end','emphasis-end']],['abc*def*ghi',['emphasis-start','emphasis-end']]])('delimiter pairing retains scope: %s',(source,expected)=>{
 expect(roles(source as string)).toEqual(expected);const r=convert(source as string,options);expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.document.nodes.map(n=>n.raw).join('')).toBe(source);
});
test.each(['foo_bar_baz','foo__bar__baz','* abc*','*abc *','**','*a\n\nb*','---','* * *'])('unmatched/intraword/structural markers are not paired: %s',source=>{
 expect(roles(source)).toEqual([]);
});
test('flanking rules include Chinese and Unicode punctuation',()=>{
 const source='（**因为**） *条件*';expect(roles(source)).toEqual(['strong-start','strong-end','emphasis-start','emphasis-end']);expect(convert(source,options).complete).toBe(true);
});
test('strong text containing an explicit formula retains both fields',()=>{
 const source='**因为 $x>0$ 所以**',r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.nodes.filter(n=>n.kind==='inline-math')).toHaveLength(1);expect(roles(source)).toEqual(['strong-start','strong-end']);
});
test('closing emphasis cannot be swallowed by bare formula recognition',()=>{
 const source='**x^2**',r=convert(source,options);expect(r.complete).toBe(true);expect(roles(source)).toEqual(['strong-start','strong-end']);expect(r.document.nodes.some(n=>n.kind==='bare-math'&&n.raw==='x^2')).toBe(true);
});
test('bare formulas cannot consume a closing marker or following outside text',()=>{
 const source='**x^2**+y',r=convert(source,options);expect(r.complete).toBe(true);expect(roles(source)).toEqual(['strong-start','strong-end']);expect(r.document.nodes.some(n=>n.kind==='bare-math'&&n.raw==='x^2')).toBe(true);expect(r.document.nodes.map(n=>n.raw).join('')).toBe(source);
});
test('the delimiter rule of three retains nesting without crossing scopes',()=>{
 expect(roles('a***b**c*')).toEqual(['emphasis-start','strong-start','strong-end','emphasis-end']);
 expect(roles('a**b*c**d')).toEqual(['strong-start','strong-end']);
});
test('math, TeX arguments and code keep literal delimiters',()=>{
 for(const source of [String.raw`$a*b*c$`,String.raw`\frac{*a*}{b}`,'`**abc**`','```txt\n**abc**\n```'])expect(roles(source)).toEqual([]);
 expect(roles('**`*abc*`**')).toEqual(['strong-start','strong-end']);
});
test('escaped delimiters remain literal while neighboring delimiters can pair',()=>{
 expect(roles(String.raw`\*abc\*`)).toEqual([]);
 expect(roles(String.raw`*abc\**`)).toEqual(['emphasis-start','emphasis-end']);
 expect(convert(String.raw`\*abc\*`,options).complete).toBe(true);
});
test('block boundaries stop emphasis while soft line breaks do not',()=>{
 expect(roles('*abc\ndef*')).toEqual(['emphasis-start','emphasis-end']);expect(roles('*abc\n# def*')).toEqual([]);
});
test('emphasis in quotes and headings retains source markers',()=>{
 const source='> ## **因为 $x=1$** ##',r=convert(source,options);expect(r.complete).toBe(true);expect(roles(source)).toEqual(['strong-start','strong-end']);expect(r.document.source).toBe(source);
});
test('Chinese edits preserve emphasis captions and source offsets',()=>{
 const source='**因为** $x=1$',r=encodeDocument(source,options),start=source.indexOf('因为');expect(r.complete).toBe(true);
 for(const w of r.metadata.chineseWords)expect(source.slice(w.span.start,w.span.end)).toBe(w.raw);
 const edited=applyManualBraille(r,[{start,end:start+2,cells:'⠁⠃'}]);expect(edited.atoms.filter(a=>a.ruleId==='editorial-markdown-marker')).toEqual(r.atoms.filter(a=>a.ruleId==='editorial-markdown-marker'));
});
test('plain-text and marker-disabled modes retain literal source',()=>{
 for(const opts of [{mode:'text' as const},{...options,recognizeMarkdownMarkers:false}])expect(convert('**abc**',opts).document.nodes.some(n=>n.kind==='markdown-marker')).toBe(false);
});
test('pathological alternating delimiters stay bounded and source-lossless',()=>{
 const source='*_'.repeat(5000)+'x'+'_*'.repeat(5000),r=convert(source,options);expect(r.document.source).toBe(source);expect(r.document.nodes.map(n=>n.raw).join('')).toBe(source);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
test('link destinations and HTML attributes do not acquire emphasis roles',()=>{
 expect(roles('[abc](https://example.test/a*b*c)')).toEqual([]);
 expect(roles('<img src="a*b*c">')).toEqual([]);
 expect(roles('[**abc**](https://example.test/a*b*c)')).toEqual(['strong-start','strong-end']);
});
test('unclosed repeated markup contexts respect the pairing work budget',()=>{
 const source='**'+('<a '.repeat(1000)),d=parseDocument(source);expect(d.source).toBe(source);expect(d.nodes.map(n=>n.raw).join('')).toBe(source);expect(d.diagnostics.some(x=>x.code==='markdown-emphasis-resource-limit')).toBe(true);
});
