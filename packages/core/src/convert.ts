import type {
  BrailleCellAtom,
  CellAtom,
  ConversionResult,
  Diagnostic,
  Document,
  SourceSpan,
} from "./model";
import { parseDocument } from "./parser/document";
import { parseMath } from "./parser/math";
import { parseChemistry } from "./parser/chemistry";
import { encodeMath, type MathEncodingOptions } from "./rules/math";
import { encodeChemistry } from "./rules/chemistry";
import { encodePhysics } from "./rules/physics";
import { encodeText, type TextOptions, type TextUnit } from "./rules/text";
import { validWordBoundaries, type ChineseWord } from "./language/chinese";
import { normalizeManualReading } from "./language/reading-validation";
import { braille } from "./rules/math-symbols";
import {
  layout,
  type PublishingOptions,
  type CellMapping,
  type LayoutResult,
} from "./layout";
import { unicodeToBrf } from "./codec";
import type { ManualBrailleEdit } from './manual-braille';
export interface ConvertOptions extends PublishingOptions, TextOptions {
  fontPolicy?:MathEncodingOptions['fontPolicy'];
  symbolPolicy?:MathEncodingOptions['symbolPolicy'];
  colonMeaning?: MathEncodingOptions["colonMeaning"];
  mappingAllowed?: MathEncodingOptions["mappingAllowed"];
  mode?: "document" | "text" | "math" | "chemistry" | "physics";
  /** Independent document recognition controls; omitted preserves existing behavior. */
  recognizeMath?: boolean;
  recognizeChemistry?: boolean;
  /** Document marker interpretation; explicit mathematical/text domains remain authoritative. */
  recognizeMarkdownMarkers?:boolean;
}
export interface EncodingMetadata {
  chineseWords: ChineseWord[];
  fontProfile: "roman-light-normalized";
  fontDescription: string;
}
export interface EncodedDocument {
  manualBrailleEdits?: ManualBrailleEdit[];
  document: Document;
  atoms: CellAtom[];
  diagnostics: Diagnostic[];
  complete: boolean;
  unhandled: TextUnit[];
  metadata: EncodingMetadata;
}
export interface UnifiedConversionResult extends ConversionResult {
  /** Display-only encoded content when strict publishing layout fails. Not a valid paginated export. */
  preview?: { unicode: string; brf: string; lines: string[]; truncated: boolean };
  unhandled: TextUnit[];
  metadata: EncodingMetadata;
  mappings: CellMapping[];
  layoutProfile: LayoutResult["profile"];
}
/** Only a single balanced ce wrapper is eligible for whole-formula prose closure. */
function isWholeChemicalWrapper(raw: string): boolean {
  const value = raw.trim();
  if (!value.startsWith("\\ce{")) return false;
  let depth = 1,
    cursor = 4;
  while (cursor < value.length && depth) {
    if (
      value[cursor] === "\\" &&
      (value[cursor + 1] === "{" || value[cursor + 1] === "}")
    ) {
      cursor += 2;
      continue;
    }
    if (value[cursor] === "{") depth++;
    else if (value[cursor] === "}") depth--;
    cursor++;
  }
  return depth === 0 && cursor === value.length;
}
const FONT_DESCRIPTION =
  "Roman-light normalized profile: unstyled mathematical letters use Roman light; explicit supported styles are retained. This is not TeX font fidelity and does not infer variable, constant, or unit meaning.";
/** A sole complete formula delimiter is syntax, including in an explicit domain.
 * Document source/nodes remain lossless; only the domain parser's span changes.
 */
export function standaloneDomainScope(document:Document):{source:string;span:SourceSpan} {
  const meaningful=document.nodes.filter(n=>n.kind==='text'?!!n.text.trim():!['line-break','paragraph-break'].includes(n.kind));
  const formula=meaningful.length===1?meaningful[0]:undefined;
  if(formula && (formula.kind==='inline-math' || formula.kind==='display-math') && formula.closed)
    return {source:formula.content,span:formula.contentSpan};
  return {source:document.source,span:{start:0,end:document.source.length}};
}
/** Encoding is separate from layout so editor reading decisions never require repartitioning words. */
export function encodeDocument(
  source: string | Document,
  options: ConvertOptions = {},
): EncodedDocument {
  const standalone =
    options.mode && options.mode !== "document" && options.mode !== "text";
  // A selected domain is authoritative; weak auto-recognition warnings must not
  // survive a deliberate explicit-mode choice, including pre-parsed documents.
  let document =
    options.mode === "text"
      ? parseDocument(typeof source === "string" ? source : source.source, {
          literalText: true,
        })
      : standalone
        ? parseDocument(typeof source === "string" ? source : source.source, {
            recognizeBare: false,
            recognizeCode:false,
            recognizeMarkers:false,
          })
        : typeof source === "string"
          ? parseDocument(source,{recognizeMarkers:options.recognizeMarkdownMarkers})
          : source;
  if (!standalone && options.mode !== "text") {
    const diagnostics: Diagnostic[] = [];
    document = {
      ...document,
      nodes: document.nodes.map((node) => {
        if(node.kind==='markdown-marker' && options.recognizeMarkdownMarkers===false)return {id:node.id,kind:'text' as const,span:node.span,raw:node.raw,text:node.raw};
        const formula = node.kind === "inline-math" || node.kind === "display-math" || node.kind === "bare-math";
        const wholeChemical = formula && isWholeChemicalWrapper(node.content);
        const disabledChemical = options.recognizeChemistry === false &&
          (node.kind === "chemistry" || (formula && node.content.includes("\\ce{")));
        const disabledMath = options.recognizeMath === false && formula && !wholeChemical;
        if (disabledChemical || disabledMath) {
          diagnostics.push({ code: "domain-disabled-literal", severity: "info", span: node.span,
            message: `${disabledChemical ? "Chemistry" : "Mathematics"} recognition is disabled; this source scope is encoded as literal text.` });
          return { id: node.id, kind: "text" as const, span: node.span, raw: node.raw, text: node.raw };
        }
        if (wholeChemical && options.recognizeMath === false)
          return { id: node.id, kind: "chemistry" as const, span: node.span, raw: node.raw, content: node.content, contentSpan: node.contentSpan };
        return node;
      }),
      diagnostics: [...document.diagnostics, ...diagnostics],
    };
  }
  const output: EncodedDocument = {
    document,
    atoms: [],
    diagnostics: [...document.diagnostics],
    complete: true,
    unhandled: [],
    metadata: {
      chineseWords: [],
      fontProfile: "roman-light-normalized",
      fontDescription: FONT_DESCRIPTION+(options.fontPolicy==='review-unmapped'?' Unmapped fonts remain flagged for review.':' Known unmapped font families retain visible scope-bound Chinese font-name descriptions; these are editorial transcription, not new GB font signs.'),
    },
  };
  const markerCaptionCache=new Map<string,ReturnType<typeof encodeText>>();
  if (options.wordBoundaries !== undefined && !validWordBoundaries(document.source, options.wordBoundaries)) {
    options = { ...options, wordBoundaries: undefined };
    output.diagnostics.push({code: "CHINESE_INVALID_WORD_BOUNDARIES", severity: "warning",
      span: {start: 0, end: document.source.length},
      message: "Invalid automatic word boundaries; local proposals retained."});
  }
  for (const override of options.overrides ?? []) {
    if (
      !Number.isInteger(override.start) ||
      !Number.isInteger(override.end) ||
      override.start < 0 ||
      override.end > document.source.length ||
      override.start >= override.end ||
      override.readings.length !== [...document.source.slice(override.start, override.end)].length ||
      override.readings.some(reading => !normalizeManualReading(reading)) ||
      !/^\p{Script=Han}+$/u.test(
        document.source.slice(override.start, override.end),
      )
    ) {
      output.diagnostics.push({
        code: "CHINESE_INVALID_OVERRIDE",
        severity: "error",
        span: { start: 0, end: document.source.length },
        message:
          "Reading override must cover a nonempty Han range inside the original document.",
      });
    }
  }
  let serial = 0,
    usedMath = false;
  const make = (
    cells: string,
    span: SourceSpan,
    ruleId = "GBT18028-2010-5.4",
  ): BrailleCellAtom => ({
    kind: "cell",
    cells,
    span,
    ruleId,
    group: `document:${serial++}`,
    breakBefore: false,
    breakAfter: true,
  });
  const blank = (span: SourceSpan) => {
    if (output.atoms.length) {
      const last = output.atoms.at(-1)!;
      if (last.kind === "cell" && !/^\u2800+$/.test(last.cells))
        output.atoms.push(make(braille(["0"]), span));
    }
  };
  type DomainResult = {
    atoms: CellAtom[];
    diagnostics: Diagnostic[];
    unhandled: readonly TextUnit[];
    complete: boolean;
    words?: ChineseWord[];
    chineseWords?: ChineseWord[];
  };
  const accept = (
    r: DomainResult,
    frame: boolean,
    chemical: boolean,
    span: SourceSpan,
  ) => {
    const namespace = `domain:${serial++}`;
    let atoms = r.atoms.map((a) => ({
      ...a,
      group: `${namespace}:${a.group}`,
    }));
    // Prefix maxima locate the first source anchor without sorting domain output.
    // This stays O(atoms + unhandled*log(atoms)), including all-unknown documents.
    const represented = new Set(
      atoms
        .filter((a) => a.ruleId === "unhandled-placeholder")
        .map((a) => `${a.span.start}:${a.span.end}`),
    );
    const maxima: number[] = [];
    let maximum = -1;
    for (const a of atoms) {
      maximum = Math.max(maximum, a.span.start);
      maxima.push(maximum);
    }
    const insertions = new Map<number, BrailleCellAtom[]>();
    for (const unit of r.unhandled) {
      const key = `${unit.span.start}:${unit.span.end}`;
      if (represented.has(key)) continue;
      represented.add(key);
      let low = 0,
        high = maxima.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (maxima[middle] >= unit.span.end) high = middle;
        else low = middle + 1;
      }
      const bucket = insertions.get(low) ?? [];
      bucket.push(
        make(braille(["123456"]), unit.span, "unhandled-placeholder"),
      );
      insertions.set(low, bucket);
    }
    if (insertions.size) {
      const merged: CellAtom[] = [];
      for (let i = 0; i <= atoms.length; i++) {
        for (const a of insertions.get(i) ?? []) merged.push(a);
        if (i < atoms.length) merged.push(atoms[i]);
      }
      atoms = merged;
    }
    if (frame && atoms.length) {
      blank({ start: span.start, end: span.start });
      const first=atoms[0];
      if(first.kind==='cell')atoms[0] = { ...first, cells: braille(["46"]) + first.cells };
      const last=atoms.at(-1)!;
      if (chemical && last.kind==='cell')
        atoms[atoms.length - 1] = {
          ...last,
          cells: last.cells + braille(["156"]),
        };
    }
    const previous = output.atoms.at(-1);
    if (
      atoms[0]?.kind==='cell' &&
      /^\u2800+$/.test(atoms[0].cells) &&
      previous?.kind === "cell" &&
      previous.span.start === previous.span.end &&
      /^\u2800+$/.test(previous.cells)
    )
      output.atoms.pop();
    for (const atom of atoms) output.atoms.push(atom);
    output.diagnostics.push(...r.diagnostics);
    output.unhandled.push(...r.unhandled);
    output.metadata.chineseWords.push(...(r.words ?? r.chineseWords ?? []));
    output.complete &&= r.complete;
    if (frame && atoms.length) blank({ start: span.end, end: span.end });
  };
  const chemical = (raw: string, span: SourceSpan) =>
    encodeChemistry(parseChemistry(raw, span), {
      chinese: options.chinese,
      chineseOverrides: options.overrides,
      wordBoundaries: options.wordBoundaries,
      analyzeChinese: options.analyze,
    });
  const quoteOpenings=new Map<number,boolean>();
  let quoteOpening=true;
  for(let i=0;i<document.source.length;i++)if(document.source[i]==='"'){quoteOpenings.set(i,quoteOpening);quoteOpening=!quoteOpening;}
  const doubleQuoteOpening=options.doubleQuoteOpening ?? ((span:SourceSpan)=>quoteOpenings.get(span.start) ?? true);
  const mathOptions: MathEncodingOptions = {
    fontPolicy:options.fontPolicy,
    symbolPolicy:options.symbolPolicy,
    doubleQuoteOpening,
    colonMeaning: options.colonMeaning,
    mappingAllowed: options.mappingAllowed,
    chinese: options.chinese,
    chineseOverrides: options.overrides,
    wordBoundaries: options.wordBoundaries,
    analyzeChinese: options.analyze,
    chemistry: (n) => {
      const r = chemical(n.raw, n.span);
      return {
        ...r,
        unhandled: r.unhandled.map((u) => ({
          kind: "unknown" as const,
          raw: u.raw,
          span: u.span,
          reason: "chemistry-unhandled",
        })),
      };
    },
  };
  const math = (raw: string, span: SourceSpan) => {
    usedMath = true;
    return encodeMath(parseMath(raw, span), mathOptions);
  };
  const hasVisibleContent=(r:DomainResult)=>r.atoms.some(a=>a.kind==='cell'&&/[^\u2800]/.test(a.cells));
  const emptyContent=(encoded:DomainResult,raw:string,span:SourceSpan):DomainResult=>{
    const group=`empty-content:${serial++}`,label=encodeText('排版原文',0,{chinese:options.chinese,overrides:[{start:0,end:4,readings:['pai2','ban3','yuan2','wen2']}],wordBoundaries:[{start:0,end:4}]});
    const atoms:CellAtom[]=[{...make(braille(['123456']),span,'unhandled-placeholder'),sourceRole:'structure',group},
      {...make(braille(['12346']),span,'empty-content-source'),sourceRole:'structure',group},
      ...label.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group,ruleId:'empty-content-source'}))];
    const diagnostics=[...encoded.diagnostics,...label.diagnostics.map(d=>({...d,span})),{code:'math-empty-expression',severity:'error' as const,span,message:'Expression has no visible encoded content; labelled literal source retained for correction.'}],unhandled:TextUnit[]=[{raw,span}],words:ChineseWord[]=[];
    for(const part of raw.matchAll(/[^\r\n]+|\r\n|\r|\n/g)){
      const range={start:span.start+part.index,end:span.start+part.index+part[0].length};
      if(/^[\r\n]+$/.test(part[0]))atoms.push({kind:'line-break',count:1,span:range,group:`${group}:line:${part.index}`,ruleId:'empty-content-source',breakBefore:false,breakAfter:false});
      else {
        atoms.push({...make(braille(['0']),{start:range.start,end:range.start},'empty-content-source'),sourceRole:'structure'});
        const literal=encodeText(part[0],range.start,{chinese:options.chinese,mathText:false,doubleQuoteOpening});
        atoms.push(...literal.atoms.map(a=>({...a,group:`${group}:literal:${a.group}`})));diagnostics.push(...literal.diagnostics);unhandled.push(...literal.unhandled);words.push(...literal.words);
      }
    }
    atoms.push({...make(braille(['13456']),span,'empty-content-source'),sourceRole:'structure',group:atoms.at(-1)!.group});
    return {atoms,diagnostics,unhandled,words,complete:false};
  };
  if (standalone) {
    const span = { start: 0, end: document.source.length };
    const scope=standaloneDomainScope(document);
    if (document.source.length > 100000) {
      output.complete = false;
      output.unhandled.push({ raw: document.source, span });
      output.atoms.push(
        make(braille(["123456"]), span, "unhandled-placeholder"),
      );
    } else {
      let encoded:DomainResult=options.mode === "chemistry"
          ? chemical(scope.source, scope.span)
          : options.mode === "physics"
            ? ((usedMath = true),
              encodePhysics(scope.source, { ...mathOptions, unit: true,baseOffset:scope.span.start }))
            : math(scope.source, scope.span);
      if(!hasVisibleContent(encoded) && !encoded.unhandled.length && document.source.trim())
        encoded=emptyContent(encoded,document.source,span);
      accept(encoded,false,false,span);
    }
  } else {
    const containsProse = document.nodes.some(
      (n) =>
        n.kind==='markdown-marker'||n.kind==='code-block'||n.kind==='code-span'||n.kind==='unparsed'&&n.reason==='ambiguous-formula'||(n.kind === "text" || n.kind === "escaped-text") && /\S/u.test(n.text),
    );
    const text = (raw: string, base: number) =>
      accept(encodeText(raw, base, {...options,doubleQuoteOpening}), false, false, {
        start: base,
        end: base + raw.length,
      });
    for (let nodeIndex = 0; nodeIndex < document.nodes.length; nodeIndex++) {
      const node = document.nodes[nodeIndex],
        nextNode = document.nodes[nodeIndex + 1];
      if (
        node.kind === "inline-math" ||
        node.kind === "display-math" ||
        node.kind === "bare-math"
      ) {
        if (
          node.kind === "display-math" &&
          output.atoms.at(-1)?.kind === "cell"
        )
          output.atoms.push({
            kind: "line-break",
            span: node.span,
            group: `display:${serial++}`,
            ruleId: "document-display",
            breakBefore: false,
            breakAfter: false,
          });
        const isChemical = isWholeChemicalWrapper(node.content);
        if (
          containsProse &&
          node.kind === "inline-math" &&
          !isChemical &&
          node.content.includes("\\ce{")
        ) {
          output.diagnostics.push({
            code: "mixed-chemistry-prose-unverified",
            severity: "warning",
            span: node.contentSpan,
            message:
              "Mixed chemical and mathematical scopes in prose need separately checked chemical closure placement; no whole-expression chemical ending marker was added.",
          });
        }
        let encoded:DomainResult=math(node.content,node.contentSpan);
        if(!hasVisibleContent(encoded) && !encoded.unhandled.length) {
          // Empty delimiters or formatting-only OCR output must not disappear
          // as a successful expression. Keep the exact wrapper available to edit.
          encoded=emptyContent(encoded,node.raw,node.span);
        }
        accept(
          encoded,
          containsProse && node.kind !== "display-math",
          isChemical,
          node.span,
        );
        if (
          node.kind === "display-math" &&
          nextNode &&
          nextNode.kind !== "line-break" &&
          nextNode.kind !== "paragraph-break"
        )
          output.atoms.push({
            kind: "line-break",
            span: node.span,
            group: `display:${serial++}`,
            ruleId: "document-display",
            breakBefore: false,
            breakAfter: false,
          });
      } else if (node.kind === "line-break" || node.kind === "paragraph-break")
        output.atoms.push({
          kind: node.kind,
          count: node.count,
          span: node.span,
          group: `break:${serial++}`,
          ruleId: "document-break",
          breakBefore: false,
          breakAfter: false,
        });
      else if (node.kind === "unparsed") {
        output.unhandled.push(node);
        output.atoms.push(
          make(braille(["123456"]), node.span, "unhandled-placeholder"),
        );
        if(node.reason==='ambiguous-formula') {
          // Failed automatic recognition is not permission to discard source.
          // Transcribe literally; never guess an unsupported macro's meaning.
          const marker=output.atoms.at(-1)!;if(marker.kind==='cell')marker.sourceRole='structure';
          const label=encodeText('原文转写',0,{chinese:options.chinese,overrides:[{start:0,end:4,readings:['yuan2','wen2','zhuan3','xie3']}],wordBoundaries:[{start:0,end:4}]});
          const group=`unparsed-caption:${serial++}`;
          output.atoms.push({...make(braille(['12346']),node.span,'unparsed-source-description'),group,sourceRole:'structure'});
          output.atoms.push(...label.atoms.map(a=>({...a,span:node.span,sourceRole:'structure' as const,group,ruleId:'unparsed-source-description'})));
          output.atoms.push({...make(braille(['0']),node.span,'unparsed-source-description'),sourceRole:'structure'});
          for(const part of node.raw.matchAll(/[^\r\n]+|\r\n|\r|\n/g)) {
            const span={start:node.span.start+part.index,end:node.span.start+part.index+part[0].length};
            if(/^[\r\n]+$/.test(part[0]))output.atoms.push({kind:'line-break',count:1,span,group:`unparsed-break:${serial++}`,ruleId:'unparsed-source-line-break',breakBefore:false,breakAfter:false});
            else accept(encodeText(part[0],span.start,{...options,mathText:false,doubleQuoteOpening}),false,false,span);
          }
          output.atoms.push({...make(braille(['13456']),node.span,'unparsed-source-description'),sourceRole:'structure'});
          output.diagnostics.push({code:'document-source-transcribed',severity:'info',span:node.span,message:'Unrecognized formula candidate retained as readable literal source; mathematical interpretation still requires review.'});
        }
        output.complete = false;
      } else if (node.kind === "escaped-text") {
        // Keep the full escape as the source range even though its text payload is one scalar.
        const r = encodeText(node.text, node.span.start, options);
        r.atoms = r.atoms.map((a) => ({ ...a, span: node.span }));
        r.unhandled = r.unhandled.map((u) => ({
          ...u,
          raw: node.raw,
          span: node.span,
        }));
        r.diagnostics = r.diagnostics.map((d) => ({ ...d, span: node.span }));
        accept(r, false, false, node.span);
      } else if (node.kind === "chemistry") {
        accept(
          chemical(node.content, node.contentSpan),
          containsProse,
          true,
          node.span,
        );
      } else if(node.kind==='markdown-marker') {
        blank(node.span);
        const emphasisCaptions={
          'emphasis-start':{label:'强调开始',readings:['qiang2','diao4','kai1','shi3']},'emphasis-end':{label:'强调结束',readings:['qiang2','diao4','jie2','shu4']},
          'strong-start':{label:'重点强调开始',readings:['zhong4','dian3','qiang2','diao4','kai1','shi3']},'strong-end':{label:'重点强调结束',readings:['zhong4','dian3','qiang2','diao4','jie2','shu4']},
        };
        const emphasis=Object.hasOwn(emphasisCaptions,node.role)?emphasisCaptions[node.role as keyof typeof emphasisCaptions]:undefined;
        const label=emphasis?.label??(node.role==='blockquote'?'引用层级':node.role==='heading'?'标题层级':node.role==='heading-end'?'标题结束':node.role==='separator'?'分隔线':node.ordinal!==undefined?'有序项目编号':'无序项目标记');
        const readings=emphasis?.readings??(node.role==='blockquote'?['yin3','yong4','ceng2','ji2']:node.role==='heading'?['biao1','ti2','ceng2','ji2']:node.role==='heading-end'?['biao1','ti2','jie2','shu4']:node.role==='separator'?['fen1','ge2','xian4']:node.ordinal!==undefined?['you3','xu4','xiang4','mu4','bian1','hao4']:['wu2','xu4','xiang4','mu4','biao1','ji4']);
        const caption=markerCaptionCache.get(label)??encodeText(label,0,{chinese:options.chinese,overrides:[{start:0,end:label.length,readings}],wordBoundaries:[{start:0,end:label.length}]});markerCaptionCache.set(label,caption);
        output.atoms.push(...caption.atoms.map(a=>({...a,span:node.span,group:`markdown-marker:${node.span.start}:${a.group}`,sourceRole:'structure' as const,ruleId:'editorial-markdown-marker'})));
        const value=node.level!==undefined?String(node.level):node.ordinal??node.bullet;
        if(value){blank(node.span);const valueAtoms=encodeText(value,0,{});output.atoms.push(...valueAtoms.atoms.map(a=>({...a,span:node.span,sourceRole:'structure' as const,ruleId:'editorial-markdown-marker'})));}
        if(node.indent){blank(node.span);const indentation=encodeText('缩进',0,{chinese:options.chinese,overrides:[{start:0,end:2,readings:['suo1','jin4']}],wordBoundaries:[{start:0,end:2}]});output.atoms.push(...indentation.atoms.map(a=>({...a,span:node.span,sourceRole:'structure' as const,ruleId:'editorial-markdown-marker'})));const count=encodeText(String(node.indent),0);output.atoms.push(...count.atoms.map(a=>({...a,span:node.span,sourceRole:'structure' as const,ruleId:'editorial-markdown-marker'})));}
        blank(node.span);
        if(!caption.complete){output.complete=false;output.unhandled.push({raw:node.raw,span:node.span});}
        output.diagnostics.push({code:'markdown-marker-described',severity:'info',span:node.span,message:`Source ${node.role} marker retained with hierarchy/ordinal/glyph/indent information; editorial structure description.`});
      } else if(node.kind==='code-block'||node.kind==='code-span') {
        const caption=(label:string,readings:string[],span:SourceSpan)=>{
          const r=encodeText(label,0,{chinese:options.chinese,overrides:[{start:0,end:label.length,readings}],wordBoundaries:[{start:0,end:label.length}]});
          output.atoms.push(...r.atoms.map(a=>({...a,span,sourceRole:'structure' as const,ruleId:'editorial-code-boundary'})));
          if(!r.complete){output.complete=false;output.unhandled.push({raw:document.source.slice(span.start,span.end),span});}
        };
        const block=node.kind==='code-block';
        caption(block?'代码块开始':'代码开始',block?['dai4','ma3','kuai4','kai1','shi3']:['dai4','ma3','kai1','shi3'],node.openingSpan);
        blank(node.openingSpan);
        if(node.info && node.infoSpan)text(node.info,node.infoSpan.start);
        if(block)output.atoms.push({kind:'line-break',count:1,span:node.openingSpan,group:`code:${serial++}`,ruleId:'editorial-code-boundary',breakBefore:false,breakAfter:true});
        const quotePrefixes=new Map((node.quoteLinePrefixes??[]).map(p=>[p.span.start,p]));
        for(const part of node.content.matchAll(/\r\n|\r|\n|[^\r\n]+/g)){
          const start=node.contentSpan.start+part.index,span={start,end:start+part[0].length};
          if(/^[\r\n]/.test(part[0]))output.atoms.push({kind:'line-break',count:1,span,group:`code:${serial++}`,ruleId:'document-code-line',breakBefore:false,breakAfter:true});
          else {
            const prefix=quotePrefixes.get(start);
            if(prefix){caption('引用层级',['yin3','yong4','ceng2','ji2'],prefix.span);blank(prefix.span);const ordinal=encodeText(String(prefix.level),0);output.atoms.push(...ordinal.atoms.map(a=>({...a,span:prefix.span,sourceRole:'structure' as const,ruleId:'editorial-code-quote-prefix'})));blank(prefix.span);}
            const offset=prefix?prefix.span.end-start:0;
            if(offset<part[0].length)accept(encodeText(part[0].slice(offset),start+offset,{...options,colonMeaning:undefined,doubleQuoteOpening:undefined}),false,false,{start:start+offset,end:span.end});
          }
        }
        blank(node.closingSpan);
        caption(block?'代码块结束':'代码结束',block?['dai4','ma3','kuai4','jie2','shu4']:['dai4','ma3','jie2','shu4'],node.closingSpan);
        if(block && nextNode)output.atoms.push({kind:'line-break',count:1,span:node.closingSpan,group:`code:${serial++}`,ruleId:'editorial-code-boundary',breakBefore:false,breakAfter:true});
        else blank(node.closingSpan);
        output.diagnostics.push({code:'markdown-code-literal',severity:'info',span:node.span,message:'Code content retained verbatim as literal text; no formula recognition, escape decoding or execution.'});
      } else if (node.kind === "text") {
        text(node.text, node.span.start);
      }
    }
  }
  // Domain-local punctuation grouping cannot resolve formula spacing at the
  // composition boundary. Retain the required blank and expose the uncertainty.
  for (let i = 0; i < output.atoms.length; i++) {
    const atom = output.atoms[i],
      previous = output.atoms[i - 1];
    if (
      atom.kind !== "cell" ||
      atom.ruleId !== "GF0019-2018-8" ||
      document.source.slice(atom.span.start, atom.span.end) !== "·"
    )
      continue;
    if (
      previous?.kind !== "cell" ||
      /^\u2800+$/.test(previous.cells) ||
      previous.group !== atom.group
    ) {
      output.diagnostics.push({
        code: "interpunct-adjacency-unverified",
        severity: "warning",
        span: atom.span,
        ruleId: "GBT44725-2024-4.8.5",
        message:
          "Interpunct requires attachment to preceding text. This composition boundary or required formula space has no checked adjacency rule; cells and spacing are retained for review.",
      });
    }
  }
  if (usedMath)
    output.diagnostics.push({
      code: "font-normalization-profile",
      severity: "info",
      span: { start: 0, end: document.source.length },
      message: FONT_DESCRIPTION,
    });
  // Normative bounded joins/splits can adjust a model word. Validate covered
  // source intervals rather than requiring those editable partitions to match.
  const encodedHanCoverage: SourceSpan[] = [];
  if (options.wordBoundaries?.length) for (const word of output.metadata.chineseWords
    .filter(w => w.kind === "chinese").sort((a,b) => a.span.start - b.span.start)) {
    const last = encodedHanCoverage.at(-1);
    if (last && word.span.start <= last.end) last.end = Math.max(last.end, word.span.end);
    else encodedHanCoverage.push({...word.span});
  }
  if (options.wordBoundaries?.some(p =>
    !(options.overrides ?? []).some(o => o.start < p.end && o.end > p.start) &&
    !encodedHanCoverage.some(span => span.start <= p.start && span.end >= p.end))) {
    output.diagnostics.push({code:"CHINESE_INVALID_WORD_BOUNDARIES",severity:"warning",
      span:{start:0,end:document.source.length},message:"Automatic boundaries cannot cross parsed text/formula boundaries; unmatched proposals were ignored."});
  }
  output.complete &&=
    output.unhandled.length === 0 &&
    !output.diagnostics.some((d) => d.severity !== "info");
  return output;
}
export function reflowExistingAtoms(
  encoded: EncodedDocument,
  options: PublishingOptions = {},
): UnifiedConversionResult {
  const r = layout(encoded.atoms, options);
  const unicode = r.pages.map((p) => p.join("\n")).join("\f");
  let preview: UnifiedConversionResult['preview'];
  if(!r.complete) {
    const pieces:string[]=[];let length=0,truncated=false;
    for(const a of encoded.atoms) {
      const value=a.kind==='cell' ? a.cells : (a.kind==='page-break'?'\f':'\n').repeat(Number.isInteger(a.count) && a.count!<=1000 && a.count!>0 ? a.count! : 1);
      if(length+value.length>200000){truncated=true;break;}
      pieces.push(value);length+=value.length;
    }
    const raw=pieces.join('');
    preview={unicode:raw,brf:unicodeToBrf(raw),lines:raw.split(/[\n\f]/),truncated};
  }
  return {
    ...encoded,
    lines: r.lines,
    pages: r.pages,
    unicode,
    brf: unicodeToBrf(unicode),
    diagnostics: [...encoded.diagnostics, ...r.diagnostics],
    complete: encoded.complete && r.complete,
    mappings: r.mappings,
    layoutProfile: r.profile,
    ...(preview ? {preview} : {}),
  };
}
export function convert(
  source: string,
  options: ConvertOptions = {},
): UnifiedConversionResult {
  return reflowExistingAtoms(encodeDocument(source, options), options);
}
