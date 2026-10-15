import type { BrailleCellAtom, Diagnostic, SourceSpan } from "../model";
import type { MathExpression, MathSemanticNode as N } from "../parser/math";
import { simpleMappingColon } from "../parser/math";
import {parseTexColumns} from '../parser/tex-columns';
import {PHANTOM_LAYOUTS} from './phantom-layouts';
import {
  SYMBOLS,
  FONT_SIZE_NAMES,
  DESCRIBED_SYMBOLS,
  ROUNDING_DELIMITERS,
  BAR_DELIMITERS,
  POSITION_MARKS,
  FUNCTIONS,
  DIGITS,
  LOWER_DIGITS,
  LATIN_DOTS,
  GREEK_DOTS,
  GREEK_VARIANTS,
  braille,
} from "./math-symbols";
import { encodeText, type TextOptions } from "./text";
import type { ChineseWord } from "../language/chinese";
import type { ChineseEncodingOptions } from "./chinese";
export interface MathEncoding {
  chineseWords?: ChineseWord[];
  atoms: BrailleCellAtom[];
  diagnostics: Diagnostic[];
  unhandled: N[];
  complete: boolean;
}
export interface MathEncodingOptions {
  /** Known font families without a native sign retain a visible scoped name. */
  fontPolicy?:'describe-unmapped'|'review-unmapped';
  symbolPolicy?:'describe-unmapped'|'review-unmapped';
  doubleQuoteOpening?: TextOptions['doubleQuoteOpening'];
  /** Semantic decision only; callers cannot supply cells. */
  colonMeaning?: (span: SourceSpan) => "ratio" | undefined;
  /** Explicit semantic rejection must override the narrow syntactic default. */
  mappingAllowed?: (span: SourceSpan) => boolean;
  physics?: boolean;
  chineseOverrides?: TextOptions["overrides"];
  wordBoundaries?: TextOptions["wordBoundaries"];
  analyzeChinese?: TextOptions["analyze"];
  chinese?: ChineseEncodingOptions;
  chemistry?: (
    node: Extract<N, { kind: "unknown" | "chemistry" }>,
  ) => MathEncoding;
}
const LETTER_FONTS: Readonly<Record<string, string>> = Object.freeze({
  mathrm: "1246",
  mathit: "146",
  textit: "146",
  mathbf: "12456",
  boldsymbol: "1456",
  mathcal: "346",
  mathscr: "346",
  mathnormal:'146',bm:'1456',bold:'12456',
  mathbfscr:'3456',
});
const FONT_NAMES:Readonly<Record<string,{label:string;readings:string[]}>>={
 pmb:{label:'模拟粗体',readings:['mo2','ni3','cu1','ti3']},
 mathbb:{label:'双线体',readings:['shuang1','xian4','ti3']},Bbb:{label:'双线体',readings:['shuang1','xian4','ti3']},
 mathfrak:{label:'德文花体',readings:['de2','wen2','hua1','ti3']},frak:{label:'德文花体',readings:['de2','wen2','hua1','ti3']},
 mathsf:{label:'无衬线体',readings:['wu2','chen4','xian4','ti3']},mathtt:{label:'等宽体',readings:['deng3','kuan1','ti3']},
 textsf:{label:'无衬线体',readings:['wu2','chen4','xian4','ti3']},texttt:{label:'等宽体',readings:['deng3','kuan1','ti3']},
 mathboldsf:{label:'无衬线粗体',readings:['wu2','chen4','xian4','cu1','ti3']},mathitsf:{label:'无衬线斜体',readings:['wu2','chen4','xian4','xie2','ti3']},
 mathbffrak:{label:'粗德文花体',readings:['cu1','de2','wen2','hua1','ti3']},mathbolditsf:{label:'无衬线粗斜体',readings:['wu2','chen4','xian4','cu1','xie2','ti3']},
 mathrm:{label:'直体细字',readings:['zhi2','ti3','xi4','zi4']},textrm:{label:'直体细字',readings:['zhi2','ti3','xi4','zi4']},
 mathbf:{label:'直体粗字',readings:['zhi2','ti3','cu1','zi4']},textbf:{label:'直体粗字',readings:['zhi2','ti3','cu1','zi4']},bold:{label:'直体粗字',readings:['zhi2','ti3','cu1','zi4']},
 mathit:{label:'斜体细字',readings:['xie2','ti3','xi4','zi4']},textit:{label:'斜体细字',readings:['xie2','ti3','xi4','zi4']},mathnormal:{label:'斜体细字',readings:['xie2','ti3','xi4','zi4']},
 boldsymbol:{label:'斜体粗字',readings:['xie2','ti3','cu1','zi4']},bm:{label:'斜体粗字',readings:['xie2','ti3','cu1','zi4']},
 mathcal:{label:'手写体细字',readings:['shou3','xie3','ti3','xi4','zi4']},mathscr:{label:'手写体细字',readings:['shou3','xie3','ti3','xi4','zi4']},
};
const unwrap = (n: N): N =>
  n.kind === "group"
    ? unwrap(n.body)
    : n.kind === "sequence" && n.children.length === 1
      ? unwrap(n.children[0])
      : n;
/** Inspect a supported font wrapper's mathematical role without discarding it
 * from the emission tree. Unknown styles retain their diagnostic boundary. */
const semanticRole = (n: N): N => {
  n = unwrap(n);
  return n.kind === "style" && (Object.hasOwn(LETTER_FONTS,n.name) || Object.hasOwn(FONT_NAMES,n.name))
    ? semanticRole(n.body)
    : n;
};
const emptyMathField=(value:N):boolean=>value.kind==='format'?true:value.kind==='group'||value.kind==='style'?emptyMathField(value.body):value.kind==='sequence'?value.children.every(emptyMathField):value.kind==='text'?!value.value.trim():false;
const integer = (n: N): string | null => {
  n = unwrap(n);
  if (n.kind === "number" && /^\d+$/.test(n.value)) return n.value;
  if (
    n.kind === "sequence" &&
    n.children.length === 2 &&
    n.children[0].kind === "symbol" &&
    ["-", "+"].includes(n.children[0].value)
  ) {
    const v = integer(n.children[1]);
    return v === null ? null : n.children[0].value + v;
  }
  return null;
};
const lower = (v: string) =>
  Array.from(v, (c) =>
    c === "-" ? "36" : c === "+" ? "235" : LOWER_DIGITS[+c],
  );
function contains(n: N, kind: N["kind"]): boolean {
  if (n.kind === kind) return true;
  switch (n.kind) {
    case "sequence":
      return n.children.some((c) => contains(c, kind));
    case "group":
    case "style":
    case "accent":
    case "root":
    case "equation-tag":
      return contains(n.body, kind);
    case 'annotation':return contains(n.body,kind) || contains(n.mark,kind);
    case "script":
      return (
        contains(n.base, kind) ||
        (!!n.sub && contains(n.sub, kind)) ||
        (!!n.sup && contains(n.sup, kind))
      );
    default:
      return false;
  }
}
function simple(n: N): boolean {
  n = unwrap(n);
  switch (n.kind) {
    case "letter":
    case "number":
    case "script":
    case "root":
      return true;
    case "style":
      return !Object.hasOwn(PHANTOM_LAYOUTS,n.name) && simple(n.body);
    case "sequence":
      return (
        n.children.length > 0 &&
        n.children.every(
          (c) =>
            simple(c) ||
            (c.kind === "symbol" &&
              ["(", ")", "[", "]", "partial"].includes(c.value)),
        )
      );
    case "symbol":
      return n.value === "partial";
    default:
      return false;
  }
}
/** Stateless semantic encoder. No wrapping; diagnostics/unhandled are required consumer channels. */
export function encodeMath(
  expression: MathExpression,
  options: MathEncodingOptions = {},
): MathEncoding {
  const atoms: BrailleCellAtom[] = [];
  const chineseWords: ChineseWord[] = [];
  const diagnostics = [...expression.diagnostics];
  const unhandled: N[] = [];
  let serial = 0;
  let fractionLevel = -1;
  let letterType = "";
  // Input policy: unstyled variables are normalized to Roman light. Its initial
  // marker may be omitted, but an explicit style and every later restoration
  // are encoded. A TeX group or mathematical operator is NOT a font terminator.
  let activeFont = "1246";
  let explicitFont = false;
  let emittedFont = "1246";
  let emittedFontMarker = false;
  const reset = () => {
    letterType = "";
  };
  const emit = (
    d: readonly string[],
    n: N,
    clause: string,
    span: SourceSpan = n.span,
  ) => {
    if (!d.length) return;
    atoms.push({
      kind: "cell",
      cells: braille(d),
      ...(['fraction','root','script','accent','matrix','annotation','equation-tag','style','group','sequence'].includes(n.kind)?{sourceRole:'structure' as const}:{}),
      span,
      ruleId: "GBT18028-2010-" + clause,
      group: `math:${expression.span.start}:${serial++}`,
      breakBefore: false,
      breakAfter: true,
      continuation: { lineEnd: braille(["6"]), lineStart: "" },
    });
  };
  const blank = (n: N, count = 1) => {
    emit(Array(count).fill("0"), n, "5.4");
    const a = atoms.at(-1)!;
    a.breakBefore = true;
    a.continuation = { lineEnd: "", lineStart: "" };
    reset();
  };
  /** Exact numeral cells with §5.4.2.2 continuation opportunities, not rounding.
   * Sign/number prefix stays with the first digit; a decimal point stays with
   * both neighboring digits. Ordinary and lower-position digits stay distinct.
   */
  const numeral = (value: string, n: N, clause: string, lowerPosition = false, prefix: string[] = []) => {
    const start = atoms.length;
    for (let index=0;index<value.length;index++) {
      const c=value[index];
      const dots=c==='-'?'36':c==='+'?'235':c==='.'?'2':(lowerPosition?LOWER_DIGITS:DIGITS)[+c];
      const span=n.span.end-n.span.start===value.length
        ? {start:n.span.start+index,end:n.span.start+index+1}:n.span;
      emit([...(index===0?prefix:[]),dots],n,clause,span);
      if(index>0 && (c==='.' || value[index-1]==='.' || /[+-]/.test(value[index-1])))
        atoms.at(-1)!.group=atoms.at(-2)!.group;
    }
    return start;
  };
  const problem = (n: N, code: string, message: string) => {
    unhandled.push(n);
    diagnostics.push({ code, severity: "warning", span: n.span, message });
  };
  const scoped = (n: N, context: Context = {}) => {
    reset();
    visit(n, { unary: true, ...context });
    reset();
  };
  interface Context {
    annotationMark?:boolean;
    suppressSymbolSpacing?:boolean;
    postfixOperand?:boolean;
    ellipsisBlank?:boolean;
    matrixFlow?: {seen:boolean};
    transposeOperand?:boolean;
    positionMark?: boolean;
    unary?: boolean;
    matrixCell?: boolean;
    forceFraction?: boolean;
  }
  const scriptValue = (n: N, direction: string[], clause: string) => {
    const prefix = atoms.length;
    emit(direction, n, clause);
    const v = integer(n);
    if (v !== null) {
      const first=numeral(v,n,clause,true);
      const group=atoms[first].group;
      atoms[prefix].group=group;
    } else {
      const payload = atoms.length;
      scoped(n,{positionMark:true});
      emit(["156"], n, clause);
      // §5.4.2.2 allows a formula to continue between semantic units. Keep
      // the direction with the first index unit and the ending with its last.
      if (atoms.length > payload + 1) {
        atoms[prefix].group = atoms[payload].group;
        atoms.at(-1)!.group = atoms.at(-2)!.group;
      } else atoms.at(-1)!.group = atoms[prefix].group;
    }
    reset();
  };
  const sequence = (nodes: N[], context: Context) => {
    const tags = nodes.filter(n => n.kind === 'equation-tag');
    if (tags.length) {
      if (tags.length > 1) problem(tags[1], 'math-duplicate-equation-tag', 'Multiple explicit labels in one row require correction; all labels retained.');
      if (nodes.every(n => n.kind === 'equation-tag' || n.kind === 'format'))
        problem(tags[0], 'math-tag-missing-equation', 'Equation label has no expression in its row; source retained.');
      nodes = [...nodes.filter(n => n.kind !== 'equation-tag'), ...tags];
    }
    const matrixFlow=context.matrixFlow ?? {seen:false};
    const mapping = simpleMappingColon({kind:"sequence",children:nodes,raw:"",span:expression.span});
    let previous: N | undefined;
    const barStack:{width:1|2;node:N;explicit:boolean;opening:number;headJoined:boolean}[]=[];
    let previousBarClosed=false;
      const bracketStack:string[]=[];
      const bracketPairs:Readonly<Record<string,string>>={'(':')','[':']','{':'}',lbrace:'}',langle:'rangle',lfloor:'rfloor',lceil:'rceil'};
    let angle = false;
    for (let index = 0; index < nodes.length; index++) {
      const n = nodes[index];
      if(n.kind==='format'){visit(n,context);continue;}
      if (mapping && n.span.start === mapping.start && options.mappingAllowed?.(mapping) === false && options.colonMeaning?.(mapping) !== "ratio") {
        problem(n,"math-mapping-unresolved","Mapping syntax retained pending an explicit semantic decision.");
        previous = n;
        continue;
      }
      if (mapping && n.span.start === mapping.start && options.colonMeaning?.(mapping) !== "ratio") {
        emit(["36"], n, "6.18");
        blank(n);
        reset();
        previous = n;
        continue;
      }
      // A recurring decimal is one number, not a pair of derivative annotations.
      if (
        n.kind === "number" &&
        n.value.includes(".") &&
        nodes[index + 1]?.kind === "accent"
      ) {
        let end = index + 1;
        const digits: string[] = [];
        let marked = 0;
        while (end < nodes.length) {
          const p = nodes[end];
          if (p.kind === "accent" && p.name === "dot") {
            const v = integer(p.body);
            if (v === null || !/^\d+$/.test(v)) {
              problem(
                p,
                "math-invalid-recurrence",
                "A recurring decimal mark must contain unsigned digits; annotation retained.",
              );
              break;
            }
            digits.push(...Array.from(v, (c) => DIGITS[+c]));
            marked++;
            end++;
            if (marked === 2) break;
          } else if (p.kind === "number" && /^\d+$/.test(p.value)) {
            digits.push(...Array.from(p.value, (c) => DIGITS[+c]));
            end++;
          } else break;
        }
        if (marked === 0)
          problem(
            n,
            "math-invalid-recurrence",
            "Decimal recurrence requires marked digits.",
          );
        if (marked > 0) {
          emit(
            [
              "3456",
              ...Array.from(n.value, (c) => (c === "." ? "2" : DIGITS[+c])),
              "5",
              ...digits,
            ],
            n,
            "5.1",
            { start: n.span.start, end: nodes[end - 1].span.end },
          );
          reset();
          index = end - 1;
          previous = n;
          continue;
        }
      }
      if (
        n.kind === "script" &&
        n.sup &&
        unwrap(n.sup).kind === "symbol" &&
        (unwrap(n.sup) as N & { value: string }).value === "circ"
      ) {
        visit(n, context);
        reset();
        angle = true;
        previous = n;
        continue;
      }
      if (angle && n.kind === "symbol" && n.value === "'") {
        emit(["5", "35"], n, "5.3");
        reset();
        previous = n;
        continue;
      }
      const unary =
        !previous ||
        (previous.kind==='symbol' && ROUNDING_DELIMITERS[previous.value]?.side==='left') ||
        (previous.kind==='symbol' && Object.hasOwn(BAR_DELIMITERS,previous.value) && !previousBarClosed) ||
        (previous.kind === "symbol" &&
          ["=", "(", "[", "{", "+", "-", "times", "div", ":",'bmod','mod','neg','lnot','@modulus'].includes(
            previous.value,
          ));
      const previousSemantic = previous ? semanticRole(previous) : undefined;
      const previousBase =
        previousSemantic?.kind === "script"
          ? semanticRole(previousSemantic.base)
          : previousSemantic;
      const argument = semanticRole(n);
      const currentBase=argument.kind==='script'?semanticRole(argument.base):argument;
      const closedGroup=currentBase.kind==='symbol' && bracketStack.at(-1)===(currentBase.value==='rbrace'?'}':currentBase.value);
      const bar=currentBase.kind==='symbol'?BAR_DELIMITERS[currentBase.value]:undefined;
      const closesBar=!!bar && bar.side!=='left' && barStack.at(-1)?.width===bar.width;
      if(bar?.side==='right' && !closesBar)problem(currentBase,'math-unmatched-bar','Closing absolute-value bar has no matching opening bar; source retained.');
      if(closesBar && !barStack.at(-1)!.headJoined && (barStack.at(-1)!.explicit || bar!.side==='right'))
        problem(currentBase,'math-empty-bar-body','Absolute-value enclosure has no body expression; source retained.');
      const following=nodes[index+1] ? semanticRole(nodes[index+1]) : undefined;
      const followingBlank=following?.kind==='symbol' && SYMBOLS[following.value]?.spacing!=='none' || following?.kind==='format' && ['quad','qquad','enspace',' '].includes(following.name);
      const ellipsisBlank=argument.kind==='symbol' && ['dots','ldots','cdots'].includes(argument.value) && (following ? !followingBlank && !(following.kind==='symbol' && [',','.',':',')',']','}'].includes(following.value)) : !!context.ellipsisBlank);
      const proseRole=(node:N)=>node.kind==='text' || node.kind==='symbol' && options.symbolPolicy!=='review-unmapped' && Object.hasOwn(DESCRIBED_SYMBOLS,node.value);
      if(previousSemantic && proseRole(previousSemantic) !== proseRole(argument)) {
        if(atoms.length && !/^⠀+$/.test(atoms.at(-1)!.cells))blank(n);
        if(proseRole(previousSemantic))emit(['46'],n,'5.4');
      }
      const escapedTextSymbol=(node:N)=>node.kind==='text' && node.raw.length===2 && node.raw[0]==='\\' && node.raw[1]===node.value && Object.hasOwn(SYMBOLS,node.value);
      if(previousSemantic?.kind==='text' && argument.kind==='text' &&
        (escapedTextSymbol(previousSemantic) || escapedTextSymbol(argument)) &&
        !/^\s/.test(argument.value) && atoms.length && !/^⠀+$/.test(atoms.at(-1)!.cells))blank(n);
      const functionArgument = previousBase?.kind === "function";
      if (
        functionArgument &&
        n.kind === "symbol" &&
        ["-", "+"].includes(n.value)
      )
        problem(
          n,
          "math-function-argument-unverified",
          "Signed function argument needs explicit grouping under §6.9.2.2.",
        );
      if (
        functionArgument &&
        previousBase?.value === "log" &&
        argument.kind === "fraction" &&
        previousSemantic?.kind === "script" &&
        previousSemantic.sub &&
        integer(previousSemantic.sub) !== null
      )
        emit(["6"], n, "6.7");
      if (
        n.kind === "symbol" &&
        n.value === ":" &&
        previous?.kind === "number" &&
        nodes[index + 1]?.kind === "number" &&
        options.colonMeaning?.(n.span) !== "ratio"
      )
        problem(
          n,
          "math-colon-ambiguous",
          "Colon defaults to ratio; clock time needs explicit contextual semantics.",
        );
      const atomStart=atoms.length,pendingBar=barStack.at(-1);
      visit(n, {
        ...context,
        matrixFlow,
        transposeOperand:!!closedGroup,
        postfixOperand:!!previousSemantic && !['unknown','format','function'].includes(previousSemantic.kind) && (previousSemantic.kind!=='symbol' || ['!',')',']','}','rbrace','rangle','rfloor','rceil','hbar','infty','emptyset','varnothing'].includes(previousSemantic.value) || previousBarClosed && Object.hasOwn(BAR_DELIMITERS,previousSemantic.value)),
        ellipsisBlank,
        unary,
        forceFraction:
          context.forceFraction ||
          (functionArgument && argument.kind === "fraction"),
      });
      if(atoms.length>atomStart) {
        if(closesBar && atomStart>0)atoms[atomStart].group=atoms[atomStart-1].group;
        else if(pendingBar && !pendingBar.headJoined) {
          const first=atoms[atomStart],headGroup=first.group,prefix=atoms[pendingBar.opening];
          for(let at=atomStart;at<atoms.length && atoms[at].group===headGroup;at++)atoms[at].group=prefix.group;
          if(first.rowStart) {
            prefix.rowStart=first.rowStart;prefix.rowStartInline=first.rowStartInline;
            prefix.rowGapBefore=first.rowGapBefore;prefix.continuationIndent=first.continuationIndent;
            delete first.rowStart;delete first.rowStartInline;delete first.rowGapBefore;
          }
          pendingBar.headJoined=true;
        }
      }
      previous = n;
      if(currentBase.kind==='symbol') {
        const close=Object.hasOwn(bracketPairs,currentBase.value)?bracketPairs[currentBase.value]:undefined;
        if(close)bracketStack.push(close);
        else if(closedGroup)bracketStack.pop();
      }
      if(bar) {
        if(closesBar)barStack.pop();
        else if(bar.side!=='right')barStack.push({width:bar.width,node:currentBase,explicit:bar.side==='left',opening:atomStart,headJoined:false});
      }
      previousBarClosed=closesBar;
    }
    for(const bar of barStack)if(bar.explicit)problem(bar.node,'math-unmatched-bar','Opening absolute-value bar has no matching closing bar; source retained.');
  };
  const visitNode = (n: N, context: Context = {}) => {
    switch (n.kind) {
      case "sequence":
        sequence(n.children, context);
        return;
      case "group":
        visit(n.body, context);
        return;
      case "format":
        if(['nobreak','allowbreak'].includes(n.name)) {
          diagnostics.push({code:'math-layout-hint-adapted',severity:'info',span:n.span,message:`TeX ${n.name} is a zero-width print-layout hint; mathematical content is retained and Braille layout uses its own checked break rules. Original hint remains in source.`});
          return;
        }
        if(n.name==='hspace' && n.distance) {
          const label=n.starred?'行首空白':'水平空白';
          const readings=n.starred?['hang2','shou3','kong4','bai2']:['shui3','ping2','kong4','bai2'];
          const caption=encodeText(label,0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:label.length,readings}],wordBoundaries:[{start:0,end:label.length}]});
          const distance=encodeText(n.distance.value,n.distance.span.start,{mathText:true});
          const group=`spacing-description:${expression.span.start}:${serial++}`;
          emit(['12346'],n,'5.4');atoms.at(-1)!.group=group;
          atoms.push(...caption.atoms.map(a=>({...a,span:n.span,sourceRole:'structure' as const,group,ruleId:'editorial-spacing-description'})));
          blank(n);atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';
          atoms.push(...distance.atoms.map(a=>({...a,sourceRole:'structure' as const,group,ruleId:'editorial-spacing-distance'})));
          emit(['13456'],n,'5.4');atoms.at(-1)!.group=group;
          diagnostics.push({code:'math-spacing-described',severity:'info',span:n.span,message:'Explicit horizontal spacing and literal distance retained as readable layout annotation; physical TeX lengths are not converted to braille cells.'});
          if(!caption.complete||!distance.complete)problem(n,'math-spacing-description-unverified','Spacing annotation could not be fully encoded; source retained.');
          reset();return;
        }
        if(['quad','qquad','enspace',' '].includes(n.name))blank(n,n.name==='qquad'?2:1);
        return;
      case "unknown":
        unhandled.push(n);
        emit(['123456'],n,'unhandled-placeholder');
        atoms.at(-1)!.ruleId='unhandled-placeholder';
        if(n.sourcePayload) {
          atoms.at(-1)!.sourceRole='structure';
          // Unknown environments can contain drawings/programs, not just math.
          // Retain readable literal source without inventing wrapper semantics.
          const payload=n.sourcePayload;
          const label=encodeText('环境原文',0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:4,readings:['huan2','jing4','yuan2','wen2']}],wordBoundaries:[{start:0,end:4}]});
          emit(['12346'],n,'5.4');atoms.at(-1)!.sourceRole='structure';
          atoms.push(...label.atoms.map(a=>({...a,span:n.span,sourceRole:'structure' as const,ruleId:'unhandled-source-description'})));
          blank(n);atoms.at(-1)!.sourceRole='structure';
          const environment=encodeText(payload.environment,payload.nameSpan.start);
          atoms.push(...environment.atoms.map(a=>({...a,sourceRole:'structure' as const,ruleId:'unhandled-environment-name'})));
          blank(n);atoms.at(-1)!.sourceRole='structure';
          for(const part of payload.value.matchAll(/[^\r\n]+|\r\n|\r|\n/g)) {
            const span={start:payload.span.start+part.index,end:payload.span.start+part.index+part[0].length};
            if(/^[\r\n]+$/.test(part[0])) {
              const line=encodeText('换行',0,{chinese:options.chinese,overrides:[{start:0,end:2,readings:['huan4','hang2']}],wordBoundaries:[{start:0,end:2}]});
              blank(n);atoms.at(-1)!.sourceRole='structure';atoms.push(...line.atoms.map(a=>({...a,span,sourceRole:'structure' as const,ruleId:'unhandled-source-line-break'})));blank(n);atoms.at(-1)!.sourceRole='structure';
            } else {
              const literal=encodeText(part[0],span.start,{chinese:options.chinese,overrides:options.chineseOverrides,wordBoundaries:options.wordBoundaries,analyze:options.analyzeChinese});
              const namespace=`unhandled-source:${expression.span.start}:${serial++}`;
              atoms.push(...literal.atoms.map(a=>({...a,group:`${namespace}:${a.group}`})));
              chineseWords.push(...literal.words);diagnostics.push(...literal.diagnostics);
              unhandled.push(...literal.unhandled.map(u=>({kind:'unknown' as const,reason:'unhandled literal environment source',...u})));
            }
          }
          emit(['13456'],n,'5.4');atoms.at(-1)!.sourceRole='structure';
          diagnostics.push({code:'math-environment-source-transcribed',severity:'info',span:n.span,message:'Unknown environment name and complete literal body retained as readable source, not an inferred mathematical or drawing translation.'});
        }
        // Preserve the spelling of an unknown control word as readable prose.
        // This is source transcription, never an inferred mathematical operator.
        if (/^\\[A-Za-z]+$/.test(n.raw)) {
          const label=encodeText('原文命令',0,{mathText:true,chinese:options.chinese,
            overrides:[{start:0,end:4,readings:['yuan2','wen2','ming4','ling4']}],
            wordBoundaries:[{start:0,end:4}],
          });
          const spelling=encodeText(n.raw.slice(1),n.span.start+1,{mathText:true});
          emit(['12346'],n,'5.4');
          atoms.push(...label.atoms.map(a=>({...a,span:n.span,sourceRole:'structure' as const,ruleId:'unhandled-source-description'})));
          blank(n);
          atoms.push(...spelling.atoms.map(a=>({...a,sourceRole:'structure' as const,ruleId:'unhandled-source-transcription'})));
          emit(['13456'],n,'5.4');
          diagnostics.push({code:'math-source-transcribed',severity:'info',span:n.span,
            message:'Unknown command spelling retained as readable source prose; mathematical meaning still requires review.'});
        }
        reset();
        return;
      case "chemistry": {
        if (options.chemistry) {
          const result = options.chemistry(n);
          const namespace = `math-ce:${expression.span.start}:${serial++}`;
          if (!result.complete)
            problem(
              n,
              "math-chemistry-incomplete",
              "Delegated chemistry conversion is incomplete.",
            );
          atoms.push(
            ...result.atoms.map((a) => ({
              ...a,
              group: `${namespace}:${a.group}`,
            })),
          );
          diagnostics.push(...result.diagnostics);
          chineseWords.push(...(result.chineseWords ?? []));
          unhandled.push(...result.unhandled);
        } else
          problem(
            n,
            "math-chemistry-deferred",
            "Chemical source retained for the chemistry encoder.",
          );
        reset();
        return;
      }
      case "number":
        numeral(n.value,n,'5.1',false,['3456']);
        reset();
        return;
      case "letter": {
        const isLatin = /^[A-Za-z]$/.test(n.value);
        const small = n.value === n.value.toLowerCase();
        const type = isLatin ? (small ? "56" : "6") : small ? "46" : "456";
        const pos = isLatin
          ? n.value.toLowerCase().charCodeAt(0) - 97
          : Array.from("αβγδεζηθικλμνξοπρστυφχψω").indexOf(
              n.value.toLowerCase(),
            );
        const d = (isLatin ? LATIN_DOTS : GREEK_DOTS)[pos];
        if (!d) {
          problem(
            n,
            "math-unsupported-letter",
            "Letter variant has no independently checked mapping.",
          );
          reset();
          return;
        }
        const fontChange =
          activeFont !== emittedFont || (explicitFont && !emittedFontMarker);
        emit(
          [
            ...(letterType === type ? [] : [type]),
            ...(fontChange ? [activeFont] : []),
            d,
          ],
          n,
          "5.2",
        );
        if (fontChange) emittedFontMarker = true;
        emittedFont = activeFont;
        letterType = type;
        return;
      }
      case "symbol": {
        if(context.annotationMark && Object.hasOwn(POSITION_MARKS,n.value)) {
          emit(POSITION_MARKS[n.value],n,'6.5');reset();return;
        }
        const description=DESCRIBED_SYMBOLS[n.value];
        if(description && options.symbolPolicy!=='review-unmapped') {
          const label=encodeText(description.label,0,{mathText:true,chinese:options.chinese,
            overrides:[{start:0,end:description.label.length,readings:description.readings}],
            wordBoundaries:[{start:0,end:description.label.length}],
          });
          const group=`symbol-description:${expression.span.start}:${serial++}`;
          emit(['12346'],n,'5.4');atoms.at(-1)!.group=group;
          atoms.push(...label.atoms.map(a=>({...a,span:n.span,sourceRole:'structure' as const,group,ruleId:'editorial-symbol-description'})));
          if(description.letter) {
            blank(n);
            atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';
            const spelling=encodeText(description.letter,0,{mathText:true});
            atoms.push(...spelling.atoms.map(a=>({...a,span:n.span,sourceRole:'structure' as const,group,ruleId:'editorial-symbol-description'})));
          }
          emit(['13456'],n,'5.4');atoms.at(-1)!.group=group;
          if(!label.complete) {
            problem(n,'math-symbol-description-unverified','Symbol description cannot be encoded under the selected Chinese policy; source retained.');
            emit(['123456'],n,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';
          }
          diagnostics.push({code:'math-symbol-described',severity:'info',span:n.span,message:`${n.value} retained as ${description.label}; editorial semantic transcription, not a new GB symbol sign.`});
          reset();return;
        }
        const rule = SYMBOLS[n.value];
        if (!rule) {
          problem(n, "math-unsupported-symbol", "No semantic rule for symbol.");
          emit(['123456'],n,'unhandled-placeholder');
          atoms.at(-1)!.ruleId='unhandled-placeholder';
          return;
        }
        if(['*','ast','star'].includes(n.value) && !context.positionMark)problem(n,'math-star-role-unverified','A bare star may be a product, convolution or annotation; original source retained for semantic review.');
        if(n.value==='!' && (context.unary || context.postfixOperand===false))problem(n,'math-factorial-missing-base','Factorial needs a preceding operand; original source retained.');
        const unary =
          context.unary && ["+", "-", "−", "pm", "mp"].includes(n.value);
        if (!context.suppressSymbolSpacing && !unary && rule.spacing !== "none") {
          if (context.matrixCell && ["+", "-", "−"].includes(n.value))
            emit(["5"], n, "6.17");
          else blank(n);
        }
        emit(rule.dots, n, rule.clause);
        if (!context.suppressSymbolSpacing && rule.spacing === "both") blank(n);
        if (!context.suppressSymbolSpacing && rule.spacing === "because") blank(n, 2);
        if (n.value === ",") blank(n);
        if(context.ellipsisBlank)blank(n);
        if (n.value === "oint") emit(["156"], n, "6.14");
        reset();
        return;
      }
      case "function":
        emit(
          FUNCTIONS[n.value] ?? ['1246',...Array.from(n.value).flatMap(c=>[...(/[A-Z]/.test(c)?['6']:[]),LATIN_DOTS[c.toLowerCase().charCodeAt(0)-97]])],
          n,
          n.value === "log" || n.value === "lg" || n.value === "ln"
            ? "6.7"
            : [
                  "sin",
                  "cos",
                  "tan",
                  "cot",
                  "sec",
                  "csc",
                  "arcsin",
                  "arccos",
                  "arctan",
                  "arccot","arcsec","arccsc","tg","ctg","cosec",
                ].includes(n.value)
              ? "6.9"
              : ['arg','Re','Im'].includes(n.value) ? "6.13" : ['det','Tr','SP'].includes(n.value) ? "6.17" : Object.hasOwn(FUNCTIONS,n.value) && !['sinh','cosh','tanh','coth','arsinh','arcosh','artanh','arcoth','Ei','li','si','Si','ci','Ci','am','sn','cn','dn','ns','nc','nd','sc','sd','cs','cd','ds','dc','se','ce'].includes(n.value) ? "6.14" : "6.16",
        );
        reset();
        return;
      case "fraction": {
        const a = integer(n.numerator),
          b = integer(n.denominator);
        if (
          a !== null &&
          b !== null &&
          /^\d+$/.test(a) &&
          /^\d+$/.test(b) &&
          fractionLevel < 0 &&
          !context.forceFraction
        ) {
          numeral(a,n.numerator,'6.4',false,['3456']);
          const lastNumerator=atoms.at(-1)!.group;
          const denominatorStart=numeral(b,n.denominator,'6.4',true);
          atoms[denominatorStart].group=lastNumerator;
          reset();
          return;
        }
        const compound=contains(n.numerator,'fraction') || contains(n.denominator,'fraction');
        const inHierarchy=fractionLevel>=0 || compound;
        const level=fractionLevel+1;
        const frame =
          compound ||
          context.forceFraction ||
          !simple(n.numerator) ||
          !simple(n.denominator);
        if(frame && atoms.at(-1)?.ruleId==='GBT18028-2010-6.4.2.8' && atoms.at(-1)!.cells.startsWith(braille(['1256']))) emit(['6'],n,'6.4.2.8');
        if (frame) emit(["23"], n, "6.4");
        const previousLevel=fractionLevel;
        if(inHierarchy) fractionLevel=level;
        const field=(value:N)=>{
          scoped(value);
          if(emptyMathField(value)){problem(value,'math-empty-fraction-field','Fraction field has no operand; existing content and missing-field marker retained.');emit(['123456'],value,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';}
        };
        field(n.numerator);
        if (frame || inHierarchy) blank(n);
        emit(["1256", ...(inHierarchy && level>0 ? lower(String(level)) : [])], n, inHierarchy ? '6.4.2.8' : '6.4');
        if(inHierarchy && level===0) blank(n);
        field(n.denominator);
        fractionLevel=previousLevel;
        if (frame) emit(["56"], n, "6.4");
        reset();
        return;
      }
      case "root": {
        const rootStart=atoms.length;
        const matrixRoot=semanticRole(n.body).kind==='matrix' && !['cases','aligned','gathered'].includes((semanticRole(n.body) as Extract<N,{kind:'matrix'}>).environment);
        emit(["146"], n, "6.6");
        if(matrixRoot && context.matrixFlow) {
          if(context.matrixFlow.seen) {
            atoms[rootStart].rowStart=true;atoms[rootStart].rowGapBefore=true;
            atoms[rootStart].continuationIndent=2;
          }
          context.matrixFlow.seen=true;
        }
        if (n.index) {
          const indexStart=atoms.length;
          const v = integer(n.index);
          if (v !== null) numeral(v,n.index,'6.6',true);
          else scoped(n.index);
          if(atoms.length>indexStart)atoms[rootStart].group=atoms[indexStart].group;
        }
        const bodyPrefix=atoms.length;
        emit(["156"], n, "6.6");
        const bodyStart=atoms.length;
        scoped(n.body);
        if(emptyMathField(n.body)){problem(n.body,'math-empty-root-field','Root has no radicand; root frame and missing-field marker retained.');emit(['123456'],n.body,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';}
        emit(["1456"], n, "6.6");
        if((!contains(n.body,'matrix') || matrixRoot) && atoms.length>bodyStart+1) {
          // §5.4.2.2 allows continued expressions. Keep the root prefix with
          // its first semantic unit and the closing sign with its last unit.
          const firstGroup=atoms[bodyStart].group;
          const prefixStart=n.index?bodyPrefix:rootStart;
          const prefixGroup=atoms[prefixStart].group;
          let head=bodyStart;
          while(head<atoms.length-1 && atoms[head].group===firstGroup)head++;
          for(let j=prefixStart;j<head;j++)atoms[j].group=prefixGroup;
          atoms.at(-1)!.group=atoms.at(-2)!.group;
        }
        reset();
        return;
      }
      case "script": {
        const emptyNucleus=(value:N):boolean=>value.kind==='sequence'?value.children.length===0:value.kind==='group'&&emptyNucleus(value.body);
        if(n.emptyBase || emptyNucleus(n.base)) {
          const caption=(upper:boolean,value:N)=>{
            const label=upper?'空主体上标':'空主体下标',readings=['kong1','zhu3','ti3',upper?'shang4':'xia4','biao1'];
            const encoded=encodeText(label,0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:label.length,readings}],wordBoundaries:[{start:0,end:label.length}]});
            const group=`empty-script:${expression.span.start}:${serial++}`;
            emit(['12346'],n,'5.4');atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';
            atoms.push(...encoded.atoms.map(a=>({...a,span:n.span,group,sourceRole:'structure' as const,ruleId:'editorial-empty-script-description'})));
            emit(['13456'],n,'5.4');atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';blank(n);atoms.at(-1)!.sourceRole='structure';
            emit(['12346'],n,'5.4');atoms.at(-1)!.sourceRole='structure';
            scoped(value,{...context,positionMark:true});
            if(emptyMathField(value)){problem(value,'math-empty-script-field','Empty script payload retained with a review marker.');emit(['123456'],value,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';}
            emit(['13456'],n,'5.4');atoms.at(-1)!.sourceRole='structure';
            if(!encoded.complete || options.symbolPolicy==='review-unmapped')problem(n,'math-empty-script-description-unverified','Empty-nucleus script description requires review under the selected policy; payload retained.');
          };
          if(n.sub)caption(false,n.sub);if(n.sup)caption(true,n.sup);
          diagnostics.push({code:'math-empty-script-described',severity:'info',span:n.span,message:'Subscript/superscript payloads retain empty-nucleus identity; editorial position description, not a native left-script sign or inferred following base.'});
          reset();return;
        }
        const b = semanticRole(n.base);
        // An explicitly grouped scripted base is a complete expression. Its
        // outer script must not be read as another script on its last index.
        const groupedBase=b.kind==='script' || b.kind==='sequence' && b.children.length>1;
        const baseStart=atoms.length;
        if (groupedBase) emit(["126"], n.base, "6.3");
        const payloadStart=atoms.length;
        scoped(n.base, context);
        if (groupedBase) {
          const payloadEnd=atoms.length;
          emit(["345"], n.base, "6.3");
          if(payloadEnd>payloadStart) {
            atoms[baseStart].group=atoms[payloadStart].group;
            atoms.at(-1)!.group=atoms[payloadEnd-1].group;
          }
        }
        const primeBody=n.sup && unwrap(n.sup);
        const primes=primeBody?.kind==='sequence' ? primeBody.children : primeBody ? [primeBody] : [];
        const centeredPrime=b.kind==='accent' && ['overbrace','overbracket'].includes(b.name);
        if(!centeredPrime && !n.sub && primes.length && primes.every(p=>p.kind==='symbol' && ['prime',"'"].includes(p.value))) {
          emit(primes.map(()=> '35'),n,'6.14');reset();return;
        }
        if(b.kind==='accent' && ['underbrace','overbrace','underbracket','overbracket'].includes(b.name)) {
          const field=(value:N,centered:boolean,upper:boolean)=>{
            if(!centered){scriptValue(value,[upper?'34':'16'],'6.5');return;}
            const prefix=atoms.length,unhandledStart=unhandled.length;
            emit(['46',upper?'34':'16'],value,'6.5');
            const payload=atoms.length,v=integer(value);
            if(v!==null)numeral(v,value,'6.5',true);else scoped(value);
            if(atoms.length===payload) {
              problem(value,'math-empty-brace-label','Bracket annotation label is empty; source retained.');
              emit(['123456'],value,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';
            }
            for(const unit of unhandled.slice(unhandledStart)) {
              if(atoms.slice(payload).some(a=>a.ruleId==='unhandled-placeholder' && a.span.start===unit.span.start && a.span.end===unit.span.end))continue;
              emit(['123456'],unit,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';
            }
            emit(['156'],value,'6.5');
            atoms[prefix].group=atoms[payload].group;atoms.at(-1)!.group=atoms.at(-2)!.group;
          };
          if(n.sub)field(n.sub,b.name.startsWith('under'),false);
          if(n.sup)field(n.sup,b.name.startsWith('over'),true);
          reset();return;
        }
        const explicitLimits=b.kind==='function'||b.kind==='style'?b.operatorLimits:undefined;
        const large = explicitLimits ?? (
          (b.kind === "symbol" &&
            [
              "sum",
              "prod",
              "int",
              "iint",
              "iiint",
              "oint",
              "bigcup",
              "bigcap",
              'bigoplus','bigotimes','bigodot','bigwedge','bigvee','coprod','biguplus','bigsqcup',
            ].includes(b.value)) ||
          (b.kind === "function" &&
            ["lim", "limsup", "liminf", "max", "min", "sup", "inf"].includes(
              b.value,
            )));
        if (large) {
          const limitField = (value: N, direction: string[]) => {
            const prefix=atoms.length;
            emit(direction,value,'6.14');
            const payload=atoms.length,v=integer(value);
            if(v!==null)numeral(v,value,'6.14',true);
            else scoped(value);
            if(atoms.length>payload)atoms[prefix].group=atoms[payload].group;
          };
          if (n.sub) {
            limitField(n.sub,['46','16']);
          }
          if (n.sup) {
            limitField(n.sup,['46','34']);
          }
          const integral =
            b.kind === "symbol" && ["int", "iint", "iiint"].includes(b.value);
          if (!integral || !n.sup || integer(n.sup) === null) {
            emit(["156"], n, "6.14");
            if(atoms.length>1)atoms.at(-1)!.group=atoms.at(-2)!.group;
          }
          reset();
          return;
        }
        if (n.sub) {
          if (n.sup && b.kind === "function" && b.value === "log") {
            const prefix=atoms.length;
            emit(["16"], n.sub, "6.7");
            const payload=atoms.length;
            scoped(n.sub);
            emit(["156"], n.sub, "6.7");
            if(atoms.length>payload+1){atoms[prefix].group=atoms[payload].group;atoms.at(-1)!.group=atoms.at(-2)!.group;}
          } else scriptValue(n.sub, ["16"], "6.5");
        }
        if (n.sup) {
          const upper = unwrap(n.sup);
          const transposeBase=!['text','unknown','function','symbol','number'].includes(b.kind) && !(b.kind==='sequence' && !b.children.length);
          if(upper.kind==='symbol' && ['top','intercal'].includes(upper.value) && (transposeBase || context.transposeOperand)) {
            emit(['46','2345'],n.sup,'6.17');
            diagnostics.push({code:'math-transpose-normalized',severity:'info',span:n.sup.span,
              message:'Conventional superscript transpose glyph normalized to the §6.17 transpose mark; source spelling retained.'});
            if(atoms.length>1)atoms.at(-1)!.group=atoms.at(-2)!.group;
            reset();return;
          }
          if (upper.kind === "symbol" && upper.value === "circ") {
            emit(["5", "356"], n.sup, "5.3");
            reset();
            return;
          }
          const fraction = contains(n.sup, "fraction");
          if (fraction) {
            const prefix=atoms.length;
            emit(["34", "6"], n.sup, "6.6");
            const payload=atoms.length;
            scoped(n.sup, { forceFraction: true });
            emit(["156"], n.sup, "6.6");
            if(atoms.length>payload+1){atoms[prefix].group=atoms[payload].group;atoms.at(-1)!.group=atoms.at(-2)!.group;}
          } else scriptValue(n.sup, ["34"], "6.6");
        }
        reset();
        return;
      }
      case 'annotation': {
        const field=(value:N,fieldContext:Context) => {
          const atomStart=atoms.length,unhandledStart=unhandled.length;
          scoped(value,fieldContext);
          const represented=new Set(atoms.slice(atomStart).filter(a=>a.ruleId==='unhandled-placeholder').map(a=>`${a.span.start}:${a.span.end}`));
          for(const unit of unhandled.slice(unhandledStart)) {
            const key=`${unit.span.start}:${unit.span.end}`;
            if(represented.has(key))continue;
            emit(['123456'],unit,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';represented.add(key);
          }
        };
        const body=semanticRole(n.body),mark=semanticRole(n.mark);
        const grouped=!(body.kind==='letter' || body.kind==='number' && body.value.length===1);
        const bodyRule=body.kind==='symbol'?SYMBOLS[body.value]:undefined;
        if(bodyRule && bodyRule.spacing!=='none')blank(n);
        const opening=atoms.length;
        if(grouped)emit(['12346'],n,'5.4');
        const bodyStart=atoms.length;
        field(n.body,{suppressSymbolSpacing:!!bodyRule});
        if(atoms.length===bodyStart) {
          problem(n.body,'math-empty-annotation-base','Annotation has no base expression; source retained.');
          emit(['123456'],n.body,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';
        }
        if(grouped) {
          emit(['13456'],n,'5.4');
          if(atoms.length>opening+2) {atoms[opening].group=atoms[opening+1].group;atoms.at(-1)!.group=atoms.at(-2)!.group;}
        }
        emit([n.direction==='above'?'45':'56'],n,'6.5');
        const prefix=atoms.length-1;
        const positional=mark.kind==='symbol' && Object.hasOwn(POSITION_MARKS,mark.value);
        const marks=mark.kind==='sequence'?mark.children.filter(c=>c.kind!=='format'):[mark];
        const multiple=marks.length>1 && marks.every(c=>c.kind==='symbol' && Object.hasOwn(POSITION_MARKS,c.value));
        if(multiple) {
          // §6.5.2.2: a shared direction is allowed, but every distinct mark
          // still has its own ending. This is not one combined math expression.
          for(const part of marks){field(part,{annotationMark:true,positionMark:true});emit(['156'],part,'6.5');atoms.at(-1)!.group=atoms.at(-2)!.group;}
        } else field(n.mark,{annotationMark:positional,positionMark:positional,suppressSymbolSpacing:mark.kind==='symbol'});
        if(atoms.length===prefix+1) {
          problem(n.mark,'math-empty-annotation','Annotation has no encoded content; source retained.');
          emit(['123456'],n.mark,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';
        }
        if(!multiple)emit(['156'],n,'6.5');
        if(atoms.length>prefix+2) {
          atoms[prefix].group=atoms[prefix+1].group;
          atoms.at(-1)!.group=atoms.at(-2)!.group;
        }
        if(bodyRule?.spacing==='both')blank(n);
        if(bodyRule?.spacing==='because')blank(n,2);
        reset();return;
      }
      case "accent": {
        if(['underbrace','overbrace','underbracket','overbracket'].includes(n.name)) {
          // §6.5.2.6 examples 1–2: position then bracketed body, followed
          // by a centered label (46 plus index direction) when supplied.
          const square=n.name.endsWith('bracket'),opening=atoms.length,unhandledStart=unhandled.length;
          emit([n.name.startsWith('under')?'56':'45',square?'12356':'246'],n,'6.5');
          const payload=atoms.length;scoped(n.body);
          if(atoms.length===payload) {
            problem(n.body,'math-empty-brace-body','Bracket annotation has no body; source retained.');
            emit(['123456'],n.body,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';
          }
          for(const unit of unhandled.slice(unhandledStart)) {
            if(atoms.slice(payload).some(a=>a.ruleId==='unhandled-placeholder' && a.span.start===unit.span.start && a.span.end===unit.span.end))continue;
            emit(['123456'],unit,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';
          }
          const ending=atoms.at(-1)!.group;emit([square?'23456':'135'],n,'6.5');atoms.at(-1)!.group=ending;
          atoms[opening].group=atoms[payload].group;
          reset();return;
        }
        if(n.name==='textcircled' || n.name==='boxed') {
          // §6.5.2.5: an enclosure follows the entire enclosed expression.
          const bodyRole=semanticRole(n.body);
          const grouped=!(bodyRole.kind==='letter' || bodyRole.kind==='number' && bodyRole.value.length===1 || bodyRole.kind==='text' && [...bodyRole.value].length===1),opening=atoms.length,unhandledStart=unhandled.length;
          if(grouped)emit(['12346'],n,'5.4');
          const bodyStart=atoms.length;
          scoped(n.body,context);
          if(grouped && atoms[bodyStart]?.rowStart) {
            const first=atoms[bodyStart],prefix=atoms[opening];
            prefix.rowStart=first.rowStart;prefix.rowStartInline=first.rowStartInline;
            prefix.rowGapBefore=first.rowGapBefore;prefix.continuationIndent=first.continuationIndent;
            delete first.rowStart;delete first.rowStartInline;delete first.rowGapBefore;
          }
          if(atoms.length===bodyStart) {
            problem(n.body,'math-empty-enclosure','Enclosure has no content; source retained.');
            emit(['123456'],n.body,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';
          }
          for(const unit of unhandled.slice(unhandledStart)) {
            if(atoms.slice(bodyStart).some(a=>a.ruleId==='unhandled-placeholder' && a.span.start===unit.span.start && a.span.end===unit.span.end))continue;
            emit(['123456'],unit,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';
          }
          if(grouped) {
            const endingGroup=atoms.at(-1)!.group;
            emit(['13456'],n,'5.4');atoms.at(-1)!.group=endingGroup;
          }
          emit(['6',n.name==='textcircled'?'356':'2356'],n,'6.5');
          if(atoms.length>opening+1) {
            const suffix=atoms.at(-1)!;suffix.group=atoms.at(-2)!.group;
            if(grouped)atoms[opening].group=atoms[opening+1].group;
          }
          reset();return;
        }
        const vector=['vec','overrightarrow'].includes(n.name),role=semanticRole(n.body);
        const grouped = ['hat','widehat','check','breve','overparen','underparen','tilde','widetilde','underline','bar','overline'].includes(n.name) && unwrap(n.body).kind!=='letter' || vector && role.kind==='script';
        // §5.4.2.3: the grouping brackets delimit the complete expression
        // carrying a mark above or below, rather than only its last letter.
        if(grouped)emit(['12346'],n,'5.4');
        const accentBodyStart=atoms.length;
        scoped(n.body);
        if(atoms.length===accentBodyStart) {
          problem(n.body,'math-empty-accent-body','Position mark has no body; source retained.');
          emit(['123456'],n.body,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';
        }
        if(grouped)emit(['13456'],n,'5.4');
        if (n.name === "dot" || n.name === "ddot")
          emit(n.name === "dot" ? ["2"] : ["2", "2"], n, "6.14");
        else if(['check','breve','overparen','underparen'].includes(n.name)) {
          const mark=n.name==='check'?['56','35']:n.name==='overparen'?['35','26']:['26','35'];
          emit([n.name==='underparen'?'56':'45',...mark,'156'],n,'6.5');
        } else if(['hat','widehat','tilde','widetilde','underline'].includes(n.name)) {
          emit([n.name==='underline'?'56':'45',n.name==='underline'?'25':['hat','widehat'].includes(n.name)?'256':'26','156'],n,'6.5');
        } else if (["bar", "overline"].includes(n.name)) {
          emit(["45", "25", "156"], n, "6.5");
        } else if (n.name === "vec" || n.name === "overrightarrow") {
          const body = role.kind==='script'?semanticRole(role.base):role;
          const length =
            body.kind === "letter" || body.kind==='number' && body.value==='0'
              ? 1
              : body.kind === "sequence" &&
                  body.children.every((c) => c.kind === "letter")
                ? body.children.length
                : 0;
          if (length === 1 || length === 2) {
            const literalZero=role.kind==='number' && role.value==='0';
            emit(["45", "25", length === 1 ? "2" : "23",...(literalZero?[]:['156'])], n, "6.15");
            blank(n);
          }
          else problem(
            n,
            "math-vector-mark-unverified",
            "Vector position convention requires review; body and annotation retained.",
          );
        } else
          problem(
            n,
            "math-unsupported-accent",
            "Accent retained; no checked rule.",
          );
        reset();
        return;
      }
      case "style": {
        if(Object.hasOwn(PHANTOM_LAYOUTS,n.name)) {
          const form=PHANTOM_LAYOUTS[n.name],caption=encodeText(form.label,0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:form.label.length,readings:form.readings}],wordBoundaries:[{start:0,end:form.label.length}]});
          const group=`phantom-layout:${expression.span.start}:${serial++}`;
          emit(['12346'],n,'5.4');atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';
          atoms.push(...caption.atoms.map(a=>({...a,span:n.span,sourceRole:'structure' as const,group,ruleId:'editorial-phantom-layout'})));
          blank(n);emit(['46'],n,'5.4');const before=atoms.length;scoped(n.body,context);
          if(atoms.length===before) {
            const empty=encodeText('空内容',0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:3,readings:['kong1','nei4','rong2']}],wordBoundaries:[{start:0,end:3}]});
            atoms.push(...empty.atoms.map(a=>({...a,span:n.span,sourceRole:'structure' as const,group,ruleId:'editorial-phantom-empty-content'})));
            if(!empty.complete)problem(n,'math-phantom-description-unverified','Empty-content description needs review; source retained.');
          } else if(!atoms.slice(before).some(a=>/[^\u2800]/.test(a.cells))) {
            const source=encodeText(n.body.raw,n.body.span.start);
            atoms.push(...source.atoms.map(a=>({...a,sourceRole:'structure' as const,group,ruleId:'editorial-phantom-layout-source'})));
            problem(n,'math-phantom-spacing-unverified','Formatting-only phantom dimensions retained as literal source; no print metric inferred.');
          }
          if(atoms.length>before)atoms[before-1].group=atoms[before].group;
          emit(['13456'],n,'5.4');atoms.at(-1)!.group=atoms.at(-2)!.group;atoms.at(-1)!.sourceRole='structure';
          if(!caption.complete||options.symbolPolicy==='review-unmapped')problem(n,'math-phantom-description-unverified','Phantom layout requires review under the selected policy; content retained.');
          diagnostics.push({code:'math-phantom-layout-described',severity:'info',span:n.span,message:'Hidden print-layout content retains its declared dimension scope and original parsed body under a readable caption; body is not silently exposed as ordinary visible ink or discarded.'});
          reset();return;
        }
        if(n.name.startsWith('greek-variant:')&&Object.hasOwn(GREEK_VARIANTS,n.name.slice(14))) {
          const name=n.name.slice(14),label=encodeText('希腊字母变体',0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:6,readings:['xi1','la4','zi4','mu3','bian4','ti3']}],wordBoundaries:[{start:0,end:6}]});
          const group=`greek-variant:${expression.span.start}:${serial++}`;
          emit(['12346'],n,'5.4');atoms.at(-1)!.group=group;
          atoms.push(...label.atoms.map(a=>({...a,span:n.span,sourceRole:'structure' as const,group,ruleId:'editorial-greek-variant'})));
          blank(n);const before=atoms.length;scoped(n.body,context);
          if(atoms.length>before)atoms[before-1].group=atoms[before].group;
          blank(n);const spelling=encodeText(name,0);
          atoms.push(...spelling.atoms.map(a=>({...a,span:n.span,sourceRole:'structure' as const,group:`${group}:name`,ruleId:'editorial-greek-variant-name'})));
          emit(['13456'],n,'5.4');atoms.at(-1)!.group=atoms.at(-2)!.group;
          if(!label.complete||!spelling.complete||options.symbolPolicy==='review-unmapped')problem(n,'math-greek-variant-description-unverified','Greek form name requires review under the selected policy; letter and original name retained.');
          diagnostics.push({code:'math-greek-variant-described',severity:'info',span:n.span,message:`Declared Greek variant ${name} retains its letter, inherited font and exact command name; editorial identity description, not a new native Greek-form sign.`});
          reset();return;
        }
        if(n.name==='mathop') {
          const label=encodeText('运算符',0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:3,readings:['yun4','suan4','fu2']}],wordBoundaries:[{start:0,end:3}]});
          const group=`operator-body:${expression.span.start}:${serial++}`;
          emit(['12346'],n,'5.4');atoms.at(-1)!.group=group;
          atoms.push(...label.atoms.map(a=>({...a,span:n.span,sourceRole:'structure' as const,group,ruleId:'editorial-operator-body'})));
          blank(n);emit(['46'],n,'5.4');
          const before=atoms.length;scoped(n.body,context);
          if(emptyMathField(n.body)){problem(n.body,'math-empty-operator-body','Operator declaration has no meaningful body; frame and review marker retained.');emit(['123456'],n.body,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';}
          if(atoms.length>before)atoms[before-1].group=atoms[before].group;
          emit(['13456'],n,'5.4');atoms.at(-1)!.group=atoms.at(-2)!.group;
          if(!label.complete||options.symbolPolicy==='review-unmapped')problem(n,'math-operator-description-unverified','Operator-body description requires review under the selected policy; body retained.');
          diagnostics.push({code:'math-operator-body-described',severity:'info',span:n.span,message:'Explicit operator declaration retains parsed body, inherited fonts and limit placement under a readable role caption; not a new native operator sign.'});
          reset();return;
        }
        if(n.name==='operatorname') {
          const label=encodeText('命名运算符',0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:5,readings:['ming4','ming2','yun4','suan4','fu2']}],wordBoundaries:[{start:0,end:5}]});
          const group=`operator-description:${expression.span.start}:${serial++}`;
          emit(['12346'],n,'5.4');atoms.at(-1)!.group=group;
          atoms.push(...label.atoms.map(a=>({...a,span:n.span,sourceRole:'structure' as const,group,ruleId:'editorial-operator-description'})));
          blank(n);emit(['46'],n,'5.4');
          const previousFont=activeFont,previousExplicit=explicitFont;activeFont='1246';explicitFont=false;
          const before=atoms.length;scoped(n.body,context);activeFont=previousFont;explicitFont=previousExplicit;
          if(atoms.length===before){problem(n.body,'math-empty-operator-name','Named operator has no name; source retained.');emit(['123456'],n.body,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';}
          atoms[before-1].group=atoms[before].group;
          emit(['13456'],n,'5.4');atoms.at(-1)!.group=atoms.at(-2)!.group;
          if(!label.complete||options.symbolPolicy==='review-unmapped')problem(n,'math-operator-description-unverified','Named operator description requires review under the selected policy; source name retained.');
          diagnostics.push({code:'math-operatorname-described',severity:'info',span:n.span,message:'Explicit named operator retained with exact name/case and operator-role description; not a newly certified abbreviated operator sign.'});
          reset();return;
        }
        if(n.color) {
          const label=encodeText('颜色原文',0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:4,readings:['yan2','se4','yuan2','wen2']}],wordBoundaries:[{start:0,end:4}]});
          const group=`color-description:${expression.span.start}:${serial++}`;
          emit(['12346'],n,'5.4');atoms.at(-1)!.group=group;
          atoms.push(...label.atoms.map(a=>({...a,span:n.color!.span,sourceRole:'structure' as const,group,ruleId:'editorial-color-description'})));
          blank(n);
          const color=encodeText(n.color.value,n.color.span.start,{mathText:false,chinese:options.chinese});
          atoms.push(...color.atoms.map(a=>({...a,sourceRole:'structure' as const,group:`${group}:${a.group}`,ruleId:'editorial-color-source'})));
          diagnostics.push(...color.diagnostics);
          if(!label.complete || !color.complete)problem(n,'math-color-description-unverified','Color description/source needs review; formula body retained.');
          blank(n);emit(['46'],n,'5.4');
          const before=atoms.length;scoped(n.body,context);
          if(atoms.length===before){problem(n.body,'math-empty-color-body','Color scope has no content; source retained.');emit(['123456'],n.body,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';}
          atoms[before-1].group=atoms[before].group;
          emit(['13456'],n,'5.4');if(atoms.length>1)atoms.at(-1)!.group=atoms.at(-2)!.group;
          diagnostics.push({code:'math-color-described',severity:'info',span:n.span,message:'Literal color specification retained as a scoped readable source description; no color lookup or macro execution.'});
          reset();return;
        }
        const font = Object.hasOwn(LETTER_FONTS, n.name)
          ? LETTER_FONTS[n.name]
          : undefined;
        const sizeDeclaration=Object.hasOwn(FONT_SIZE_NAMES,n.name);
        const description=sizeDeclaration?FONT_SIZE_NAMES[n.name]:FONT_NAMES[n.name];
        if(options.fontPolicy!=='review-unmapped' && description &&
          (!font || contains(n.body,'text'))) {
          const label=encodeText(description.label,0,{
            mathText:true,chinese:options.chinese,
            overrides:[{start:0,end:description.label.length,readings:description.readings}],
            wordBoundaries:[{start:0,end:description.label.length}],
          });
          const commandLength=/^\\[A-Za-z]+/.exec(n.raw)?.[0].length ?? 0;
          const labelSpan={start:n.span.start,end:n.span.start+commandLength};
          const opening=atoms.length;emit(['12346'],n,'5.4');
          const labelStart=atoms.length;
          const group=`font-description:${expression.span.start}:${serial++}`;
          atoms.push(...label.atoms.map(a=>({...a,span:labelSpan,sourceRole:'structure' as const,group,ruleId:'editorial-font-description'})));
          if(atoms.length>labelStart)atoms[opening].group=group;
          if(!label.complete) {
            problem(n,'math-font-description-unverified','Font-name description cannot be encoded under the selected Chinese policy; original scope retained.');
            emit(['123456'],n,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';
          }
          blank(n);emit(['46'],n,'5.4');
          const bodyStart=atoms.length,unhandledStart=unhandled.length,previousFont=activeFont,previousExplicit=explicitFont;
          if(!sizeDeclaration && n.name!=='pmb'){activeFont='1246';explicitFont=false;}scoped(n.body,context);
          activeFont=previousFont;explicitFont=previousExplicit;
          if(atoms[bodyStart]?.rowStart) {
            const first=atoms[bodyStart],prefix=atoms[opening];
            prefix.rowStart=first.rowStart;prefix.rowStartInline=first.rowStartInline;
            prefix.rowGapBefore=first.rowGapBefore;prefix.continuationIndent=first.continuationIndent;
            delete first.rowStart;delete first.rowStartInline;delete first.rowGapBefore;
          }
          if(atoms.length===bodyStart) {
            problem(n.body,'math-empty-font-body','Font scope has no content; source retained.');
            emit(['123456'],n.body,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';
          }
          for(const unit of unhandled.slice(unhandledStart)) {
            if(atoms.slice(bodyStart).some(a=>a.ruleId==='unhandled-placeholder' && a.span.start===unit.span.start && a.span.end===unit.span.end))continue;
            emit(['123456'],unit,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';
          }
          if(atoms.length>bodyStart)atoms[bodyStart].group=atoms[bodyStart-1].group;
          const ending=atoms.at(-1)!.group;emit(['13456'],n,'5.4');atoms.at(-1)!.group=ending;
          diagnostics.push({code:'math-font-described',severity:'info',span:n.span,message:`${n.name} retained as a scoped Chinese description (${description.label}); editorial transcription, not a new GB font sign.`});
          reset();return;
        }
        if (!font) {
          problem(
            n,
            "math-font-unverified",
            "Explicit " +
              n.name +
              " retained; complete font indicators under §5.2.2 are not verified.",
          );
          scoped(n.body, context);
          return;
        }
        const previousFont = activeFont,
          previousExplicit = explicitFont;
        if (n.name === "textit" && /\s/.test(n.body.raw)) {
          problem(
            n,
            "math-font-text-unverified",
            "Literal textit whitespace semantics are outside the checked letter-font adapter; original scope retained.",
          );
        }
        activeFont = font;
        explicitFont = true;
        visit(n.body, context);
        activeFont = previousFont;
        explicitFont = previousExplicit;
        return;
      }
      case 'equation-tag': {
        const first = atoms.length;
        if (first) blank(n, 2);
        const labelStart = atoms.length;
        if (n.parenthesized) emit(['126'],n,'6.3');
        // Tags are prose identifiers, even when an enclosing formula font differs.
        const previousExplicit = explicitFont;
        explicitFont = false;
        scoped(n.body);
        explicitFont = previousExplicit;
        if (n.parenthesized) emit(['345'],n,'6.3');
        if (atoms.length > labelStart) {
          const group = `equation-tag:${expression.span.start}:${serial++}`;
          for (let j=labelStart;j<atoms.length;j++) atoms[j].group=group;
        }
        reset();return;
      }
      case "text": {
        if (explicitFont) {
          problem(
            n,
            "math-font-text-unverified",
            "Checked mathematical letter-font rules do not establish styled prose/Chinese typography; text retained.",
          );
        }
        const result = encodeText(n.value, n.span.start, {
          chinese: options.chinese,
          overrides: options.chineseOverrides,
          wordBoundaries: options.wordBoundaries,
          analyze: options.analyzeChinese,
          mathText: !n.literalControl || !!n.mathLetterControl,
          texWhitespace:n.texWhitespace,
          doubleQuoteOpening:options.doubleQuoteOpening,
        });
        const namespace = `math-text:${expression.span.start}:${serial++}`;
        const escaped=!!n.literalControl || n.raw.length===2 && n.raw[0]==='\\' && n.raw[1]===n.value;
        atoms.push(
          ...result.atoms.map((a) => ({
            ...a,
            ...(escaped?{span:n.span}:{}),
            group: `${namespace}:${a.group}`,
          })),
        );
        diagnostics.push(...result.diagnostics.map(d=>escaped?{...d,span:n.span}:d));
        chineseWords.push(...result.words.map(w=>escaped?{...w,raw:n.raw,span:n.span}:w));
        for (const u of result.unhandled)
          problem(
            { kind: "text", value: u.raw, raw: escaped?n.raw:u.raw, span: escaped?n.span:u.span },
            "math-text-unhandled",
            "Text character retained without a checked encoding.",
          );
        reset();
        return;
      }
      case "matrix": {
        const columnCaption=(label:string,readings:string[],span:SourceSpan,value?:string)=>{
          const encoded=encodeText(label,0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:label.length,readings}],wordBoundaries:[{start:0,end:label.length}]});
          const group=`paragraph-column:${expression.span.start}:${serial++}`;
          emit(['12346'],n,'5.4',span);atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';
          atoms.push(...encoded.atoms.map(a=>({...a,span,group,sourceRole:'structure' as const,ruleId:'editorial-column-description'})));
          if(value!==undefined) {
            blank(n);atoms.at(-1)!.span=span;atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';
            const literal=encodeText(value,0,{mathText:false});
            atoms.push(...literal.atoms.map(a=>({...a,span,group,sourceRole:'structure' as const,ruleId:'editorial-column-description'})));
            if(!literal.complete)problem(n,'math-column-description-unverified','Column specification transcription requires review; full source retained.');
          }
          emit(['13456'],n,'5.4',span);atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';blank(n);atoms.at(-1)!.span=span;atoms.at(-1)!.sourceRole='structure';
          if(!encoded.complete)problem(n,'math-column-description-unverified','Column description requires review; source retained.');
        };
        const paragraphColumn=(column:NonNullable<typeof n.columnDefinitions>[number],index?:number)=>{
          if(!column.width)return;
          if(index!==undefined)columnCaption('段落列位置',['duan4','luo4','lie4','wei4','zhi4'],column.span,String(index+1));
          columnCaption(column.type==='p'?'顶端对齐':column.type==='m'?'垂直居中':'底端对齐',column.type==='p'?['ding3','duan1','dui4','qi2']:column.type==='m'?['chui2','zhi2','ju1','zhong1']:['di3','duan1','dui4','qi2'],column.span);
          columnCaption('列宽原文',['lie4','kuan1','yuan2','wen2'],column.width.span,column.width.raw);
          diagnostics.push({code:'math-paragraph-column-described',severity:'info',span:column.span,message:`Paragraph column ${column.type} retains width and vertical alignment; editorial layout description, not a physical Braille width.`});
        };
        if(n.environment!=='tabular') {
          n.columnDefinitions?.forEach((column,index)=>paragraphColumn(column,index));
          if(n.columnSpec && n.columnCount===undefined)columnCaption('列定义原文',['lie4','ding4','yi4','yuan2','wen2'],n.columnSpec.span,n.columnSpec.raw);
        }
        if(n.environment==='tabular') {
          // A prose table is not a mathematical matrix: label each cell position.
          const caption=(label:string,readings:string[],span:SourceSpan,value?:string)=>{
            const encoded=encodeText(label,0,{mathText:true,chinese:options.chinese,
              overrides:[{start:0,end:label.length,readings}],wordBoundaries:[{start:0,end:label.length}]});
            const group=`table-description:${expression.span.start}:${serial++}`;
            emit(['12346'],n,'5.4',span);atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';
            atoms.push(...encoded.atoms.map(a=>({...a,span,group,sourceRole:'structure' as const,ruleId:'editorial-table-description'})));
            if(value!==undefined) {
              blank(n);atoms.at(-1)!.span=span;atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';
              const literal=encodeText(value,0,{mathText:false});
              atoms.push(...literal.atoms.map(a=>({...a,span,group,sourceRole:'structure' as const,ruleId:'editorial-table-description'})));
              if(!literal.complete)problem(n,'math-table-description-unverified','Literal table specification requires review; source retained.');
            }
            emit(['13456'],n,'5.4',span);atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';blank(n);atoms.at(-1)!.span=span;atoms.at(-1)!.sourceRole='structure';
            if(!encoded.complete)problem(n,'math-table-description-unverified','Table caption requires review; source retained.');
          };
          caption('表格开始',['biao3','ge2','kai1','shi3'],n.span);
          if(n.columnCount===undefined && n.columnSpec)caption('列定义',['lie4','ding4','yi4'],n.columnSpec.span,n.columnSpec.raw);
          const rowRules=(at:number)=>{
            for(const rule of n.rowRules??[])if(rule.beforeRow===at) {
              caption(rule.columns?'横线列范围':'表格横线',rule.columns?['heng2','xian4','lie4','fan4','wei2']:['biao3','ge2','heng2','xian4'],rule.span,rule.columns?`${rule.columns.first}-${rule.columns.last}`:undefined);
              diagnostics.push({code:'math-table-rule-described',severity:'info',span:rule.span,message:`Table rule at row boundary ${at}; source range retained.`});
            }
          };
          if(n.columnSpec && n.columnCount!==undefined) {
            n.columnDefinitions?.forEach((column,index)=>{
              const span=column.span,letter=column.type;
              caption('列位置',['lie4','wei4','zhi4'],span,String(index+1));
              if(column.width)paragraphColumn(column);
              else caption(letter==='l'?'左对齐':letter==='r'?'右对齐':'居中',letter==='l'?['zuo3','dui4','qi2']:letter==='r'?['you4','dui4','qi2']:['ju1','zhong1'],span);
            });
            for(const rule of n.columnRules??[]) {
              caption('竖线列边界',['shu4','xian4','lie4','bian1','jie4'],rule.span,String(rule.beforeColumn));
              caption('竖线条数',['shu4','xian4','tiao2','shu4'],rule.span,String(rule.count));
            }
          }
          const positions=n.rows.map((row,r)=>{
            let start:number|undefined=1;
            return row.map(cell=>{
              const width=cell.tableMerge?.columns??1;
              const end=start!==undefined && Number.isSafeInteger(start+width-1)?start+width-1:undefined;
              const position={cell,row:r+1,start,end};
              start=end!==undefined && Number.isSafeInteger(end+1)?end+1:undefined;
              return position;
            });
          });
          const empty=(cell:N):boolean=>cell.kind==='text'? !cell.value.trim():cell.kind==='group'?empty(cell.body):cell.kind==='sequence'&&cell.children.every(empty);
          type Position=typeof positions[number][number];
          const covered=new Map<N,Position[]>();
          let work=0;const budget=16*(positions.reduce((sum,row)=>sum+row.length,0)+positions.length+1);
          for(const row of positions)for(const anchor of row) {
            const merge=anchor.cell.tableMerge;if(!merge)continue;
            const first=anchor.row+Math.min(0,merge.rows+1),last=anchor.row+Math.max(0,merge.rows-1);
            if(anchor.start===undefined || anchor.end===undefined || first<1 || last>positions.length || n.columnCount!==undefined&&anchor.end>n.columnCount) {
              problem(anchor.cell,'math-table-merge-range-invalid','Merged cell exceeds the table row/column range; content retained.');continue;
            }
            let limited=false;
            for(let r=first-1;r<last;r++) {
              if(r===anchor.row-1)continue;
              const candidates=positions[r];let lo=0,hi=candidates.length;
              while(lo<hi){const mid=(lo+hi)>>>1;if((candidates[mid].end??Infinity)<anchor.start)lo=mid+1;else hi=mid;}
              if(++work>budget){limited=true;break;}
              for(let at=lo;at<candidates.length && (candidates[at].start??Infinity)<=anchor.end;at++) {
                if(++work>budget){limited=true;break;}
                const other=candidates[at];
                if(!empty(other.cell) || (other.start??0)<anchor.start || (other.end??Infinity)>anchor.end)
                  problem(other.cell,'math-table-merge-overlap','Content or a partial cell overlaps a multirow region; every body retained for review.');
                const list=covered.get(other.cell)??[];list.push(anchor);covered.set(other.cell,list);
              }
              if(limited)break;
            }
            if(limited)problem(anchor.cell,'math-table-merge-budget','Complex overlapping table spans exceed the bounded geometry check; content retained for review.');
          }
          n.rows.forEach((row,r)=>{
            rowRules(r);caption('行位置',['hang2','wei4','zhi4'],n.span,String(r+1));
            if(n.columnCount!==undefined && positions[r].at(-1)?.end!==n.columnCount)problem(n,'math-table-column-count-mismatch','Table row does not match its declared logical columns; cells retained with explicit positions.');
            row.forEach((cell,c)=>{
              const position=positions[r][c],merge=cell.tableMerge;
              if(position.start===undefined)problem(cell,'math-table-merge-range-invalid','Table column position exceeds integer limits; source retained.');
              caption(position.start===undefined?'列位置待确认':'列位置',position.start===undefined?['lie4','wei4','zhi4','dai4','que4','ren4']:['lie4','wei4','zhi4'],n.span,position.start===undefined?undefined:String(position.start));
              if(merge) {
                caption('合并列数',['he2','bing4','lie4','shu4'],n.span,String(merge.columns));
                caption('合并行数',['he2','bing4','hang2','shu4'],n.span,String(merge.rows));
                caption('覆盖行范围',['fu4','gai4','hang2','fan4','wei2'],n.span,`${position.row+Math.min(0,merge.rows+1)}-${position.row+Math.max(0,merge.rows-1)}`);
                if(position.end!==undefined)caption('覆盖列范围',['fu4','gai4','lie4','fan4','wei2'],n.span,`${position.start}-${position.end}`);
                for(const annotation of merge.annotations) {
                  const value=annotation.raw.trim();
                  const alignment=annotation.kind==='alignment'?parseTexColumns(annotation.raw,annotation.span.start):undefined;
                  if(annotation.kind==='alignment' && /^\|*[lcr]\|*$/.test(value.replace(/\s/g,''))) {
                    const compact=value.replace(/\s/g,''),align=compact.replace(/\|/g,'');
                    caption(align==='l'?'合并左对齐':align==='r'?'合并右对齐':'合并居中',align==='l'?['he2','bing4','zuo3','dui4','qi2']:align==='r'?['he2','bing4','you4','dui4','qi2']:['he2','bing4','ju1','zhong1'],annotation.span);
                    caption('左竖线条数',['zuo3','shu4','xian4','tiao2','shu4'],annotation.span,String(/^\|*/.exec(compact)![0].length));
                    caption('右竖线条数',['you4','shu4','xian4','tiao2','shu4'],annotation.span,String(/\|*$/.exec(compact)![0].length));
                  } else if(alignment?.known && alignment.definitions.length===1) {
                    const parsed=alignment,column=parsed.definitions[0];
                    if(column.width){caption('合并段落列',['he2','bing4','duan4','luo4','lie4'],annotation.span);paragraphColumn(column);}
                    else caption(column.type==='l'?'合并左对齐':column.type==='r'?'合并右对齐':'合并居中',column.type==='l'?['he2','bing4','zuo3','dui4','qi2']:column.type==='r'?['he2','bing4','you4','dui4','qi2']:['he2','bing4','ju1','zhong1'],annotation.span);
                    caption('左竖线条数',['zuo3','shu4','xian4','tiao2','shu4'],annotation.span,String(parsed.rules.filter(r=>r.beforeColumn===0).reduce((sum,r)=>sum+r.count,0)));
                    caption('右竖线条数',['you4','shu4','xian4','tiao2','shu4'],annotation.span,String(parsed.rules.filter(r=>r.beforeColumn===1).reduce((sum,r)=>sum+r.count,0)));
                  } else if(annotation.kind==='width' && value==='*')caption('自然宽度',['zi4','ran2','kuan1','du4'],annotation.span);
                  else if(annotation.kind==='width' && value==='=') {
                    caption('跟随列宽',['gen1','sui2','lie4','kuan1'],annotation.span);
                    const override=merge.annotations.find(a=>a.kind==='alignment');
                    const inherited=override?parseTexColumns(override.raw,override.span.start).definitions[0]?.width:position.start===undefined?undefined:n.columnDefinitions?.[position.start-1]?.width;
                    if(inherited)columnCaption('继承列宽',['ji4','cheng2','lie4','kuan1'],inherited.span,inherited.raw);
                    else problem(cell,'math-table-column-width-unverified','Inherited multirow width requires a supported paragraph-width column specification; source retained.');
                  } else if(annotation.kind==='vpos' && /^[tcb]$/.test(value))caption(value==='t'?'顶端对齐':value==='b'?'底端对齐':'垂直居中',value==='t'?['ding3','duan1','dui4','qi2']:value==='b'?['di3','duan1','dui4','qi2']:['chui2','zhi2','ju1','zhong1'],annotation.span);
                  else {
                    const labels={alignment:['合并列定义',['he2','bing4','lie4','ding4','yi4']],width:['单元格宽度',['dan1','yuan2','ge2','kuan1','du4']],bigstruts:['行高支撑',['hang2','gao1','zhi1','cheng1']],vmove:['垂直位移',['chui2','zhi2','wei4','yi2']],vpos:['垂直位置',['chui2','zhi2','wei4','zhi4']]} as const;
                    const [label,readings]=labels[annotation.kind];caption(label,[...readings],annotation.span,annotation.raw);
                  }
                }
                diagnostics.push({code:'math-table-merge-described',severity:'info',span:cell.span,message:`Merged cell at row ${position.row}, column ${position.start}; ${merge.columns} columns and ${merge.rows} signed rows retained.`});
              }
              for(const anchor of covered.get(cell)??[])caption('续接合并单元格',['xu4','jie1','he2','bing4','dan1','yuan2','ge2'],n.span,`${anchor.row},${anchor.start}`);
              if(empty(cell)) {
                if(!covered.has(cell))caption('空单元格',['kong1','dan1','yuan2','ge2'],n.span);
              }
              else scoped(cell);
              blank(cell);atoms.at(-1)!.span=n.span;atoms.at(-1)!.sourceRole='structure';
            });
          });
          rowRules(n.rows.length);caption('表格结束',['biao3','ge2','jie2','shu4'],n.span);
          diagnostics.push({code:'math-table-linearized',severity:'info',span:n.span,message:'Prose table cells retain explicit row/column coordinates, alignment and rules; editorial linearization, not native mathematical matrix signs.'});
          reset();return;
        }
        if(n.environment==='substack') {
          const caption=(label:string,readings:string[],span:SourceSpan)=>{
            const encoded=encodeText(label,0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:label.length,readings}],wordBoundaries:[{start:0,end:label.length}]});
            const group=`stack-description:${expression.span.start}:${serial++}`;
            emit(['12346'],n,'5.4',span);atoms.at(-1)!.group=group;
            atoms.push(...encoded.atoms.map(a=>({...a,span,sourceRole:'structure' as const,group,ruleId:'editorial-stack-description'})));
            emit(['13456'],n,'5.4',span);atoms.at(-1)!.group=group;
            if(!encoded.complete)problem(n,'math-stack-description-unverified','Stack layout description needs review; source retained.');
          };
          caption('多行内容',['duo1','hang2','nei4','rong2'],n.span);
          emit(['12346'],n,'5.4');
          for(let index=0;index<n.rows.length;index++) {
            const body=n.rows[index][0];
            if(index)caption('换行',['huan4','hang2'],{start:n.rows[index-1][0].span.end,end:body.span.start});
            const before=atoms.length;scoped(body);
            if(atoms.length===before){problem(body,'math-empty-stack-row','Stack row has no content; source retained.');emit(['123456'],body,'unhandled-placeholder');atoms.at(-1)!.ruleId='unhandled-placeholder';}
          }
          emit(['13456'],n,'5.4');
          diagnostics.push({code:'math-stack-linearized',severity:'info',span:n.span,message:'Stack rows retained in order inside one field with explicit readable row boundaries; not a matrix or separate display equations.'});
          reset();return;
        }
        const cases = ["cases", "aligned", "gathered"].includes(n.environment);
        const gapBefore=!cases && !!context.matrixFlow?.seen;
        if(!cases && context.matrixFlow)context.matrixFlow.seen=true;
        if (n.environment === "gathered" && n.rows.some(row => row.length !== 1))
          problem(n,"math-gathered-columns-unsupported","Gathered supports one expression per row; alignment columns require aligned.");
        const matrixBegin = atoms.length;
        const spatialAligned=n.environment==='aligned' && n.rows.some(row=>row.some(cell=>contains(cell,'matrix')));
        if (!cases && n.rows.some((row) => row.length !== n.rows[0].length))
          problem(
            n,
            "math-ragged-matrix",
            "Unequal matrix row widths retained for review.",
          );
        const brackets: Record<string, string[]> = {
          pmatrix: ["126", "345"],
          bmatrix: ["12356", "23456"],
          Bmatrix: ["246", "135"],
          vmatrix: ["456", "456"],
          Vmatrix: ["12456", "12456"],
          matrix: [],
        };
        if (cases && n.environment === "cases") emit(["246", "3"], n, "6.3");
        const rowRules=(beforeRow:number)=>{
          for(const rule of n.rowRules??[])if(rule.beforeRow===beforeRow){
            const caption=encodeText('表格横线',0,{mathText:true,chinese:options.chinese,
              overrides:[{start:0,end:4,readings:['biao3','ge2','heng2','xian4']}],wordBoundaries:[{start:0,end:4}]});
            const source:N={kind:'format',name:'hline',raw:rule.raw,span:rule.span};
            const group=`row-rule:${expression.span.start}:${serial++}`;
            emit(['12346'],source,'5.4');atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';
            atoms.push(...caption.atoms.map(a=>({...a,span:rule.span,group,sourceRole:'structure' as const,ruleId:'editorial-row-rule-description'})));
            emit(['13456'],source,'5.4');atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';
            blank(source);
            if(beforeRow<n.rows.length)emit(['46'],source,'5.4');
            if(!caption.complete)problem(source,'math-row-rule-description-unverified','Row-rule description needs review; source retained.');
            diagnostics.push({code:'math-row-rule-described',severity:'info',span:rule.span,message:`Horizontal rule at row boundary ${beforeRow}; editorial description, not an extra data row.`});
          }
        };
        const invalidColumnLayout=n.columnCount!==undefined && n.rows.some(row=>row.length!==n.columnCount);
        const byColumn=new Map<number,NonNullable<typeof n.columnRules>>();
        for(const rule of n.columnRules??[]){const bucket=byColumn.get(rule.beforeColumn)??[];bucket.push(rule);byColumn.set(rule.beforeColumn,bucket);}
        const columnRules=(beforeColumn:number)=>{
          if(invalidColumnLayout)return;
          for(const rule of byColumn.get(beforeColumn)??[]){
            const source:N={kind:'format',name:'column-rule',raw:rule.raw,span:rule.span};
            const caption=encodeText('表格竖线',0,{mathText:true,chinese:options.chinese,
              overrides:[{start:0,end:4,readings:['biao3','ge2','shu4','xian4']}],wordBoundaries:[{start:0,end:4}]});
            const group=`column-rule:${expression.span.start}:${serial++}`;
            blank(source);
            emit(['12346'],source,'5.4');atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';
            atoms.push(...caption.atoms.map(a=>({...a,span:rule.span,group,sourceRole:'structure' as const,ruleId:'editorial-column-rule-description'})));
            if(rule.count>1){
              const count=encodeText(String(rule.count),0,{mathText:true});
              emit(['0'],source,'5.4');atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';
              atoms.push(...count.atoms.map(a=>({...a,span:rule.span,group,sourceRole:'structure' as const,ruleId:'editorial-column-rule-description'})));
              const unit=encodeText('条',0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:1,readings:['tiao2']}],wordBoundaries:[{start:0,end:1}]});
              atoms.push(...unit.atoms.map(a=>({...a,span:rule.span,group,sourceRole:'structure' as const,ruleId:'editorial-column-rule-description'})));
            }
            emit(['13456'],source,'5.4');atoms.at(-1)!.group=group;atoms.at(-1)!.sourceRole='structure';
            blank(source);if(beforeColumn<n.rows[0].length)emit(['46'],source,'5.4');
            if(!caption.complete)problem(source,'math-column-rule-description-unverified','Column-rule caption requires review; source retained.');
          }
        };
        for(const rule of n.columnRules??[])diagnostics.push({code:'math-column-rule-described',severity:'info',span:rule.span,message:`${rule.count} vertical table rules at column boundary ${rule.beforeColumn}; editorial annotation, not an extra data column or absolute-value operator.`});
        if(invalidColumnLayout && n.columnSpec){
          const spec=n.columnSpec,source:N={kind:'format',name:'column-specification',raw:spec.raw,span:spec.span};
          const label=encodeText('列定义',0,{mathText:true,chinese:options.chinese,overrides:[{start:0,end:3,readings:['lie4','ding4','yi4']}],wordBoundaries:[{start:0,end:3}]});
          emit(['12346'],source,'5.4');atoms.at(-1)!.sourceRole='structure';
          atoms.push(...label.atoms.map(a=>({...a,span:spec.span,sourceRole:'structure' as const,ruleId:'editorial-array-column-specification'})));
          blank(source);
          const literal=encodeText(spec.raw,spec.span.start,{mathText:true});
          atoms.push(...literal.atoms.map(a=>({...a,sourceRole:'structure' as const,ruleId:'editorial-array-column-specification'})));
          emit(['13456'],source,'5.4');atoms.at(-1)!.sourceRole='structure';blank(source);emit(['46'],source,'5.4');
        }
        n.rows.forEach((row, r) => {
          if (r) {
            emit(["46", "1256"], n, cases ? "6.3" : "6.17");
            if (!cases || spatialAligned) atoms.at(-1)!.rowSeparator = true;
          }
          const rowBegin = atoms.length;
          const b = brackets[n.environment] ?? [];
          if (b[0]) emit([b[0]], n, "6.17");
          rowRules(r);
          if(n.environment==='aligned') {
            scoped({kind:'sequence',children:row.flatMap(cell=>cell.kind==='sequence' ? cell.children : [cell]),raw:n.raw,span:n.span});
          } else row.forEach((cell, c) => {
            if (c) blank(cell);
            columnRules(c);
            scoped(cell, { matrixCell: !cases });
          });
          columnRules(row.length);
          if(r===n.rows.length-1)rowRules(n.rows.length);
          if (b[1]) emit([b[1]], n, "6.17");
          // Keep row framing attached to the first/last semantic payload.
          if(b[0] && atoms.length>rowBegin+2) {
            atoms[rowBegin].group=atoms[rowBegin+1].group;
            atoms.at(-1)!.group=atoms.at(-2)!.group;
          }
          if (!cases && atoms.length > rowBegin) {
            atoms[rowBegin].rowStart = true;
            if(r===0 && !gapBefore)atoms[rowBegin].rowStartInline=true;
            if(r===0 && gapBefore)atoms[rowBegin].rowGapBefore=true;
            atoms[rowBegin].continuationIndent = 2;
            if (r < n.rows.length - 1) atoms.at(-1)!.rowEnd = true;
          }
        });
        if (n.environment === "cases") emit(["4", "135"], n, "6.3");
        if (cases && atoms.length > matrixBegin) {
          atoms[matrixBegin].rowStart = true;
          atoms[matrixBegin].continuationIndent = 2;
        }
        reset();
        return;
      }
    }
  };
  const visit = (n: N, context: Context = {}) => {
    const first = atoms.length;
    visitNode(n, context);
    // Position marks keep their complete suffix with the final body unit. Long
    // bodies may continue using the same §5.4.2.2 boundaries as other formulas.
    if (n.kind === 'accent' && atoms.length > first) {
      let end=atoms.length;
      while(end>first && /^\u2800+$/.test(atoms[end-1].cells))end--;
      let suffix=end;
      while(suffix>first && atoms[suffix-1].sourceRole==='structure' &&
        atoms[suffix-1].span.start===n.span.start && atoms[suffix-1].span.end===n.span.end)suffix--;
      if(suffix>first) {
        const group=atoms[suffix-1].group;
        for(let j=suffix;j<end;j++)atoms[j].group=group;
      }
      if(atoms[first].sourceRole==='structure' && atoms[first].cells===braille(['12346']) && first+1<suffix)
        atoms[first].group=atoms[first+1].group;
    }
    if (n.kind==='fraction' && atoms.length>first+1) {
      // Framing signs remain attached to their payloads; the expression may wrap
      // between encoded semantic units with the existing mathematical dot-6 rule.
      const opening=atoms[first].cells===braille(['6']) ? first+1 : first;
      if(atoms[opening].cells===braille(['23']) && opening+1<atoms.length) {
        atoms[opening].group=atoms[opening+1].group;
        if(opening>first) atoms[first].group=atoms[opening].group;
      }
      const last=atoms.length-1;
      if(atoms[last].cells===braille(['56'])) atoms[last].group=atoms[last-1].group;
      for(let j=first;j<last;j++) if(atoms[j].ruleId.startsWith('GBT18028-2010-6.4') && atoms[j].cells.startsWith(braille(['1256']))) atoms[j].group=atoms[j+1].group;
    }
  };
  const inspectMatrices = (n: N, structural = false) => {
    if (n.kind === "matrix") {
      if (structural && n.environment!=='substack')
        problem(
          n,
          "math-matrix-context-unverified",
          "Nested/structural matrix placement is outside the checked standalone-row profile.",
        );
      n.rows.flat().forEach((c) => inspectMatrices(c, ['aligned','gathered'].includes(n.environment) ? structural : true));
    } else if (n.kind === "sequence")
      n.children.forEach((c) => inspectMatrices(c, structural));
    else if (n.kind === "group" || n.kind === "style")
      inspectMatrices(n.body, n.kind==='style'&&['operatorname','mathop'].includes(n.name)?true:structural);
    else if (n.kind === "fraction") {
      inspectMatrices(n.numerator, true);
      inspectMatrices(n.denominator, true);
    } else if(n.kind==='root')
      inspectMatrices(n.body, semanticRole(n.body).kind==='matrix' ? structural : true);
    else if(n.kind==='annotation'){inspectMatrices(n.body,true);inspectMatrices(n.mark,true);}
    else if(n.kind==='equation-tag') {
      if(structural) problem(n,'math-tag-placement-unverified','Equation label inside a fraction, script, matrix cell or annotation needs placement review; label retained.');
      inspectMatrices(n.body,true);
    }
    else if (n.kind === "accent")inspectMatrices(n.body, ['boxed','textcircled'].includes(n.name)?structural:true);
    else if (n.kind === "script") {
      inspectMatrices(n.base, structural);
      if (n.sub) inspectMatrices(n.sub, true);
      if (n.sup) inspectMatrices(n.sup, true);
    }
  };
  // TeX grouping and font scopes are transparent to delimiters on the same
  // baseline. Fraction fields, scripts and annotations have independent flows.
  const inspectRoundingField = (nodes:readonly N[]) => {
    const stack:{node:N;expected:string;hasBody:boolean}[]=[];
    const payload=()=>{for(const item of stack)item.hasBody=true;};
    const walk=(n:N):void=>{
      if(n.kind==='format')return;
      if(n.kind==='sequence'){n.children.forEach(walk);return;}
      if(n.kind==='group'||n.kind==='style'){walk(n.body);return;}
      if(n.kind==='script'){
        walk(n.base);
        if(n.sub)inspectRoundingField([n.sub]);
        if(n.sup)inspectRoundingField([n.sup]);
        return;
      }
      const delimiter=n.kind==='symbol'?ROUNDING_DELIMITERS[n.value]:undefined;
      if(delimiter?.side==='left'){
        payload();stack.push({node:n,expected:delimiter.pair,hasBody:false});return;
      }
      if(delimiter?.side==='right' && n.kind==='symbol'){
        if(stack.at(-1)?.expected===n.value){
          const opening=stack.pop()!;
          if(!opening.hasBody)problem(n,'math-empty-rounding-body','Floor/ceiling delimiter pair has no expression; source retained.');
        }else problem(n,'math-unmatched-rounding-delimiter','Floor/ceiling closing delimiter has no matching opening delimiter; source retained.');
        payload();return;
      }
      payload();
      if(n.kind==='fraction'){inspectRoundingField([n.numerator]);inspectRoundingField([n.denominator]);}
      else if(n.kind==='root'){inspectRoundingField([n.body]);if(n.index)inspectRoundingField([n.index]);}
      else if(n.kind==='annotation'){inspectRoundingField([n.body]);inspectRoundingField([n.mark]);}
      else if(n.kind==='accent'||n.kind==='equation-tag')inspectRoundingField([n.body]);
      else if(n.kind==='matrix')n.rows.forEach(row=>inspectRoundingField(row));
    };
    nodes.forEach(walk);
    for(const item of stack)problem(item.node,'math-unmatched-rounding-delimiter','Floor/ceiling opening delimiter has no matching closing delimiter; source retained.');
  };
  inspectRoundingField([expression.body]);
  inspectMatrices(expression.body);
  visit(expression.body);
  // A preceding nonblank boundary adjoining a blank is a normal blank break.
  for (let j = 0; j < atoms.length - 1; j++)
    if (/^\u2800+$/.test(atoms[j + 1].cells))
      atoms[j].continuation = { lineEnd: "", lineStart: "" };
  return {
    atoms,
    chineseWords,
    diagnostics,
    unhandled,
    complete:
      unhandled.length === 0 &&
      !diagnostics.some((d) => d.severity === "error"),
  };
}
