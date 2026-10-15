import type { EncodedDocument } from './convert';
import type { SourceSpan, CellAtom } from './model';

export interface ManualBrailleEdit extends SourceSpan { cells: string }

/** Replace complete encoded source units before layout, never physical line slices. */
export function applyManualBraille(encoded: EncodedDocument, edits: ManualBrailleEdit[]): EncodedDocument {
  let atoms = encoded.atoms.slice();
  let previousEnd = -1;
  for (const edit of [...edits].sort((a,b) => a.start-b.start)) {
    if (!Number.isInteger(edit.start) || !Number.isInteger(edit.end) || edit.start < 0 || edit.start >= edit.end || edit.end > encoded.document.source.length || edit.start < previousEnd)
      throw new Error('盲文修订范围无效或重叠。');
    if (!/^[\u2800-\u283f]{1,1000}$/.test(edit.cells)) throw new Error('请输入 1–1000 个六点盲文字符；空方请使用 ⠀。');
    const ignored=(a:CellAtom)=>a.kind==='cell' && a.sourceRole==='structure' && a.span.start<=edit.start && a.span.end>=edit.end && (a.span.start<edit.start || a.span.end>edit.end);
    const indices = atoms.flatMap((a,i) => a.span.start < edit.end && a.span.end > edit.start && !ignored(a) ? [i] : []);
    if (!indices.length) throw new Error('该词已不在当前转换结果中。');
    const first = indices[0], last = indices[indices.length-1];
    const selected = atoms.slice(first,last+1);
    if (selected.some(a => a.kind !== 'cell' || a.span.start < edit.start || a.span.end > edit.end || a.span.start === a.span.end || a.rowSeparator))
      throw new Error('该范围包含其他内容，请重新选择完整词语。');
    const groups=new Set(selected.map(a=>a.group));
    const framed=atoms.some((a,i)=>(i<first || i>last) && groups.has(a.group));
    const group=framed?selected[0].group:`manual-braille:${edit.start}:${edit.end}`;
    const head=selected[0],tail=selected[selected.length-1];
    const replacement: CellAtom = { kind:'cell', cells:edit.cells, span:{start:edit.start,end:edit.end}, ruleId:'manual-braille', group, breakBefore:head.breakBefore, breakAfter:tail.breakAfter,continuation:tail.continuation,
      ...(head.kind==='cell'?{rowStart:head.rowStart,rowStartInline:head.rowStartInline,rowGapBefore:head.rowGapBefore,continuationIndent:head.continuationIndent,role:head.role,headingLevel:head.headingLevel}:{}),
      ...(tail.kind==='cell'?{rowEnd:tail.rowEnd}:{}),
    };
    // Preserve existing framing groups even when the edited word spans multiple
    // syllable groups. Direction and closing signs keep their payload attached.
    if(framed)atoms=atoms.map((a,i)=>(i<first || i>last) && groups.has(a.group)?{...a,group}:a);
    atoms.splice(first,last-first+1,replacement);
    previousEnd = edit.end;
  }
  return {...encoded, atoms, manualBrailleEdits:edits.map(e=>({...e}))};
}
