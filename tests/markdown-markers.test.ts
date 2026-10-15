import {test,expect} from 'vitest';
import {convert,encodeDocument} from '../packages/core/src/convert';
import {parseDocument} from '../packages/core/src/parser/document';
import {applyManualBraille} from '../packages/core/src/manual-braille';
const options={paragraphIndent:0};
test.each([1,2,3,4,5,6])('heading level %s preserves source and nested formula',level=>{
 const source='#'.repeat(level)+' $x^2$',d=parseDocument(source),r=convert(source,options);
 expect(d.nodes[0].kind).toBe('markdown-marker');if(d.nodes[0].kind==='markdown-marker')expect(d.nodes[0].level).toBe(level);
 expect(d.nodes.some(n=>n.kind==='inline-math')).toBe(true);
 expect(d.nodes.map(n=>n.raw).join('')).toBe(source);
 expect(r.complete).toBe(true);expect(r.document.source).toBe(source);expect(r.metadata.chineseWords).toEqual([]);
});
test.each(['## abc ###','# ###','#'])('closing/empty headings retain marker structure: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.nodes.map(n=>n.raw).join('')).toBe(source);
 if(source!=='#')expect(r.document.nodes.some(n=>n.kind==='markdown-marker'&&n.role==='heading-end')).toBe(true);
});
test.each(['#abc','####### abc','    # abc'])('invalid opening is not promoted as a heading: %s',source=>{
 expect(parseDocument(source).nodes.some(n=>n.kind==='markdown-marker'&&n.role==='heading')).toBe(false);
});
test.each(['1. $x$','007) $x$','- $x$','+ $x$','* $x$','  - $x$'])('list marker preserves ordinal/glyph/indent and formula: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(true);expect(r.document.nodes.map(n=>n.raw).join('')).toBe(source);
 expect(r.document.nodes.some(n=>n.kind==='markdown-marker'&&n.role==='list-item')).toBe(true);
 expect(r.document.nodes.some(n=>n.kind==='inline-math')).toBe(true);
});
test('source numbering is retained without automatic renumbering',()=>{
 const d=parseDocument('8. abc\n2. def');expect(d.nodes.flatMap(n=>n.kind==='markdown-marker'?[n.ordinal]:[])).toEqual(['8','2']);
});
test.each(['---','* * *','___'])('thematic %s has priority over list parsing',source=>{
 const d=parseDocument(source);expect(d.nodes).toHaveLength(1);expect(d.nodes[0].kind).toBe('markdown-marker');
 if(d.nodes[0].kind==='markdown-marker')expect(d.nodes[0].role).toBe('separator');
 expect(convert(source,options).complete).toBe(true);
});
test('code has priority and literal/explicit math policies remain authoritative',()=>{
 const source='```\n# abc\n- $x$\n```';expect(parseDocument(source).nodes.some(n=>n.kind==='markdown-marker')).toBe(false);
 expect(convert('# abc',{mode:'text'}).document.nodes.some(n=>n.kind==='markdown-marker')).toBe(false);
 expect(convert('- 1',{mode:'math',paragraphIndent:0}).complete).toBe(true);
 expect(parseDocument('# abc',{recognizeMarkers:false}).nodes.some(n=>n.kind==='markdown-marker')).toBe(false);
});
test('title word edits preserve synthetic markers',()=>{
 const source='## 因为',encoded=encodeDocument(source,options),start=source.indexOf('因为');
 const edited=applyManualBraille(encoded,[{start,end:start+2,cells:'⠁⠃'}]);
 expect(encoded.metadata.chineseWords.map(w=>w.raw)).toEqual(['因为']);
 const markers=(r:typeof encoded)=>r.atoms.flatMap(a=>a.kind==='cell'&&a.ruleId==='editorial-markdown-marker'?[a.cells]:[]);
 expect(markers(edited)).toEqual(markers(encoded));expect(edited.document.source).toBe(source);
});
test('indentation captions follow the selected full-tone policy',()=>{
 const full={tones:'full' as const},plain=convert('缩进',{mode:'text',paragraphIndent:0,chinese:full,overrides:[{start:0,end:2,readings:['suo1','jin4']}]});
 const list=convert('  - abc',{paragraphIndent:0,chinese:full});
 expect(list.complete).toBe(true);expect(list.unicode).toContain(plain.unicode);
});
test.each(['# `oops\n$y$`','before `oops\n\n$y$`','before `oops\n## $y$`','before `oops\n- $y$`'])('unpaired code cannot consume another block and its formula: %s',source=>{
 const d=parseDocument(source);expect(d.nodes.some(n=>n.kind==='code-span')).toBe(false);
 expect(d.nodes.some(n=>n.kind==='inline-math' && n.content==='y')).toBe(true);
 expect(d.nodes.map(n=>n.raw).join('')).toBe(source);
});
