import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';
import {braille} from '../packages/core/src/rules/math-symbols';
import {collectAmbiguities,resolveAmbiguities,convertWithResolutions} from '../packages/core/src/ambiguity';
const options={mode:'math' as const,paragraphIndent:0};

test.each([
 ['notsubset','4 12346'],['notsupset','4 1456'],['Subset','12346 12346'],['Supset','1456 1456'],
 ['prec','25 246'],['succ','135 25'],['preceq','25 246 2356'],['succeq','135 25 2356'],
 ['mapsto','456 25 135'],['leftrightarrow','246 25 135'],
])('checked set glyph %s retains the transcribed point pattern',(command,dots)=>{
 const r=convert(`\\${command}`,options);expect(r.complete).toBe(true);
 expect(r.unicode.replace(/^⠀+|⠀+$/g,'')).toBe(braille(dots.split(' ')));
});
test.each([['\\not=','\\neq'],['\\not \\in','\\notin'],['\\not\\isin','\\notin'],['\\not ∈','\\notin'],['\\not\\subset','⊄'],['\\not ⊃','⊅']])('negation %s consumes the relation and preserves operands',(spelling,canonical)=>{
 const source=`A${spelling} B`,r=convert(source,options);
 expect(r.complete).toBe(true);expect(r.unicode).toBe(convert(`A${canonical} B`,options).unicode);
 expect(r.document.source).toBe(source);expect(r.unhandled).toEqual([]);
 expect(convert(source,{paragraphIndent:0}).unicode).toBe(r.unicode);
 expect(r.atoms.every(a=>a.span.start>=0 && a.span.end<=source.length)).toBe(true);
});
test('negated existence retains the exact standard glyph',()=>{
 const r=convert(String.raw`\not\exists x`,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(String.raw`\nexists x`,options).unicode);
});
test.each([['backslash','setminus'],['longmapsto','mapsto'],['longleftrightarrow','leftrightarrow'],['preccurlyeq','preceq'],['succcurlyeq','succeq'],['isin','in']])('alias %s preserves the checked glyph and spacing',(alias,canonical)=>{
 const source=`A\\${alias} B`,r=convert(source,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(`A\\${canonical} B`,options).unicode);
 expect(convert(source,{paragraphIndent:0}).unicode).toBe(r.unicode);
});
test.each(['to','rightarrow','mapsto','longmapsto','leftrightarrow','longleftrightarrow'])('explicit mapping form with %s retains colon semantics',async name=>{
 const source=`F:A\\${name} B`,r=convert(source,options);expect(r.complete).toBe(true);
 expect(collectAmbiguities(source,options).find(a=>a.kind==='colon')).toMatchObject({mappingSyntax:true,plainText:false});
 const decisions=await resolveAmbiguities(source,options),resolved=convertWithResolutions(source,decisions,options);
 expect(resolved.complete,JSON.stringify({ambiguities:decisions.ambiguities,resolutions:decisions.resolutions,diagnostics:resolved.diagnostics})).toBe(true);expect(resolved.unhandled).toEqual([]);
 expect(r.diagnostics.some(d=>d.code==='math-colon-ambiguous')).toBe(false);
});
test('literal text mode does not adopt a mathematical mapping declaration',()=>{
 const source=String.raw`F:A\mapsto B`,questions=collectAmbiguities(source,{mode:'text'});
 expect(questions.filter(a=>a.kind==='colon').every(a=>!a.mappingSyntax)).toBe(true);
});
test('a manual semantic mapping decision keeps precedence over local inference',async()=>{
 const source=String.raw`F:A\mapsto B`,question=collectAmbiguities(source,options).find(a=>a.kind==='colon')!;
 const decisions=await resolveAmbiguities(source,{...options,manual:{documentSource:source,resolutions:[{id:question.id,choice:'ratio',source:'manual'}]}});
 expect(decisions.resolutions.find(r=>r.id===question.id)).toMatchObject({choice:'ratio',source:'manual'});
 expect(convertWithResolutions(source,decisions,options).complete).toBe(true);
});
test('bare negation does not consume the relation in another paragraph',()=>{
 const source='A\\not\n\n\\in B',r=convert(source,{paragraphIndent:0});
 expect(r.document.source).toBe(source);
 expect(r.document.nodes.some(n=>n.kind==='paragraph-break')).toBe(true);
 expect(r.document.nodes.every(n=>n.kind!=='bare-math' || !n.raw.includes('\n\n'))).toBe(true);
});
test('line whitespace remains legal inside explicitly delimited mathematics',()=>{
 const r=convert('$A\\not\n\\in B$',{paragraphIndent:0});expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(String.raw`A\notin B`,options).unicode);
});
test.each([['↦','mapsto'],['↔','leftrightarrow'],['∖','setminus'],['⊄','notsubset'],['≺','prec'],['≽','succeq']])('Unicode %s agrees with its command',(glyph,name)=>{
 const source=`A${glyph}B`,r=convert(source,options);expect(r.complete).toBe(true);
 expect(r.unicode).toBe(convert(`A\\${name} B`,options).unicode);
 expect(convert(source,{paragraphIndent:0}).unicode).toBe(r.unicode);
});
test.each([String.raw`A\not\approx B`,String.raw`A\not B`,String.raw`A\not\inside B`,String.raw`A\not`])('unverified or missing negation target stays visible: %s',source=>{
 const r=convert(source,options);expect(r.complete).toBe(false);expect(r.document.source).toBe(source);
 expect(r.unhandled.some(u=>u.raw==='\\not')).toBe(true);expect(r.unicode||r.preview?.unicode).toBeTruthy();
});
