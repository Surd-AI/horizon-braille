import {expect,test} from 'vitest';
import {convert} from '../packages/core/src/convert';

test.each(['$$$$',String.raw`\( \)`,String.raw`$$\displaystyle$$`,String.raw`$$\text{}$$`])('empty OCR math remains visible and editable: %s',source=>{
 const r=convert(source,{paragraphIndent:0});
 expect(r.complete).toBe(false);expect(r.unicode).toContain('⠿');
 expect(r.document.source).toBe(source);
 expect(r.unhandled).toEqual([{raw:source,span:{start:0,end:source.length}}]);
 expect(r.diagnostics.some(d=>d.code==='math-empty-expression')).toBe(true);
});

test('empty math in a mixed document retains its surrounding explanation',()=>{
 const source='abc $$$$ def',r=convert(source,{paragraphIndent:0});
 expect(r.complete).toBe(false);expect(r.unicode).toContain('⠿');
 expect(r.unhandled).toEqual([{raw:'$$$$',span:{start:4,end:8}}]);
 expect(r.document.nodes.map(n=>n.raw).join('')).toBe(source);
 expect(r.unicode.length).toBeGreaterThan(7);
});

test('an intentionally empty input remains a valid empty editor document',()=>{
 const r=convert('',{paragraphIndent:0});expect(r.complete).toBe(true);expect(r.unicode).toBe('');expect(r.unhandled).toEqual([]);
});
