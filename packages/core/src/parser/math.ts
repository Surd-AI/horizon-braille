import type { Diagnostic, SourceSpan } from "../model";
import {MATHEMATICAL_LETTERS} from '../rules/math-alphabet';
import {horizontalSpaceAt} from './tex-spacing';
import {TEXT_NUMBER_FORMS} from '../rules/text-number-forms';
import {parseTexColumns,isLiteralTexDimension,type TexColumnDefinition} from './tex-columns';
import {CYRILLIC_LETTER_NAMES} from '../rules/cyrillic-letter-names';
import {LATIN_LETTER_NAMES} from '../rules/latin-letter-names';
import {ARABIC_CHARACTER_NAMES} from '../rules/arabic-character-names';
import {DEVANAGARI_CHARACTER_NAMES} from '../rules/devanagari-character-names';
import {PHANTOM_LAYOUTS} from '../rules/phantom-layouts';
import {
  SYMBOLS,
  SYMBOL_COMMAND_ALIASES,
  FONT_SIZE_NAMES,
  CIRCLED_NUMBERS,
  DESCRIBED_SYMBOLS,
  DESCRIBED_SYMBOL_ALIASES,
  CONTEXTUAL_SYMBOLS,
  LABELED_ARROW_COMMANDS,
  POSITION_MARKS,
  FUNCTIONS,
  NAMED_FUNCTION_COMMANDS,
  GREEK_COMMANDS,
  GREEK_VARIANTS,
  SYMBOL_ALIASES,
  NEGATED_RELATIONS,
  UNICODE_SUPERSCRIPT_DIGITS,
  UNICODE_SUBSCRIPT_DIGITS,
} from "../rules/math-symbols";
interface Base {
  raw: string;
  span: SourceSpan;
  /** Prose-table geometry; never interpreted as mathematical multiplication. */
  tableMerge?:{columns:number;rows:number;annotations:{kind:'alignment'|'width'|'vpos'|'bigstruts'|'vmove';raw:string;span:SourceSpan}[]};
}
export type MathSemanticNode = Base &
  (
    | { kind: "sequence"; children: MathSemanticNode[] }
    | {
        kind: "number" | "letter" | "symbol" | "function" | "text";
        value: string;operatorLimits?:boolean;literalControl?:boolean;mathLetterControl?:boolean;texWhitespace?:'inline'|'paragraph';
      }
    | { kind: "group"; body: MathSemanticNode }
    | {
        kind: "fraction";
        numerator: MathSemanticNode;
        denominator: MathSemanticNode;
      }
    | { kind: "root"; body: MathSemanticNode; index?: MathSemanticNode }
    | {
        kind: "script";
        base: MathSemanticNode;
        sub?: MathSemanticNode;
        sup?: MathSemanticNode;
        emptyBase?:boolean;
      }
    | { kind: "accent"; name: string; body: MathSemanticNode }
    | { kind: "style"; name: string; body: MathSemanticNode;color?:{value:string;span:SourceSpan};operatorLimits?:boolean }
    | {kind:'annotation';direction:'above'|'below';body:MathSemanticNode;mark:MathSemanticNode}
    | {kind:'equation-tag';body:MathSemanticNode;parenthesized:boolean}
    | { kind: "matrix"; environment: string; rows: MathSemanticNode[][];rowRules?:{beforeRow:number;raw:string;span:SourceSpan;columns?:{first:number;last:number}}[];columnRules?:{beforeColumn:number;count:number;raw:string;span:SourceSpan}[];columnCount?:number;columnSpec?:{raw:string;span:SourceSpan};columnDefinitions?:TexColumnDefinition[] }
    | { kind: "format"; name: string;distance?:{value:string;span:SourceSpan};starred?:boolean }
    | { kind: "unknown" | "chemistry"; reason: string;sourcePayload?:{value:string;span:SourceSpan;environment:string;nameSpan:SourceSpan} }
  );
/** Domain expression, distinct from the document's delimited MathNode wrapper. */
export interface MathExpression extends Base {
  kind: "math-expression";
  body: MathSemanticNode;
  diagnostics: Diagnostic[];
}
/** The narrow form directly illustrated by GB/T18028 §6.18.2 example 8. */
export function simpleMappingColon(body: MathSemanticNode): SourceSpan | undefined {
  if (body.kind !== "sequence" || body.children.length !== 5) return;
  const [f, colon, domain, arrow, range] = body.children;
  let arrowBody=arrow;
  while(arrowBody.kind==='annotation')arrowBody=arrowBody.body;
  if ([f,domain,range].every(n => n.kind === "letter" && /^[A-Za-z]$/.test(n.value)) &&
    colon.kind === "symbol" && colon.value === ":" && arrowBody.kind === "symbol" &&
    ["to","rightarrow","longrightarrow","mapsto","longmapsto","leftrightarrow","longleftrightarrow"].includes(SYMBOL_ALIASES[arrowBody.value] ?? arrowBody.value)) return colon.span;
}
/** Match the same nested/row scopes visited by the mathematical encoder. */
export function mappingColonSpans(body:MathSemanticNode):SourceSpan[] {
  const spans:SourceSpan[]=[];
  const visit=(node:MathSemanticNode):void=>{
    const direct=simpleMappingColon(node);if(direct)spans.push(direct);
    if(node.kind==='sequence')node.children.forEach(visit);
    else if(node.kind==='matrix') {
      if(node.environment==='aligned')for(const row of node.rows) {
        const joined:MathSemanticNode={kind:'sequence',children:row.flatMap(c=>c.kind==='sequence'?c.children:[c]),raw:node.raw,span:node.span};
        const at=simpleMappingColon(joined);if(at)spans.push(at);
      }
      node.rows.flat().forEach(visit);
    } else if(node.kind==='script'){visit(node.base);if(node.sub)visit(node.sub);if(node.sup)visit(node.sup);}
    else if(node.kind==='fraction'){visit(node.numerator);visit(node.denominator);}
    else if('body' in node){visit(node.body);if(node.kind==='root' && node.index)visit(node.index);if(node.kind==='annotation')visit(node.mark);}
  };
  visit(body);
  return [...new Map(spans.map(s=>[`${s.start}:${s.end}`,s])).values()];
}
/** Read the one relation consumed by TeX \not; do not consume its operands. */
export function negatedRelationAt(source:string,offset:number,allowLineBreaks=true):{value:string;end:number}|undefined {
  let at=offset;
  while(at<source.length && (allowLineBreaks?/\s/:/[ \t]/).test(source[at]))at++;
  const command=/^\\([A-Za-z]+)/.exec(source.slice(at,at+128));
  const name=command?.[1] ?? source[at];
  if(!Object.hasOwn(NEGATED_RELATIONS,name ?? ''))return;
  return {value:NEGATED_RELATIONS[name],end:at+(command?.[0].length ?? 1)};
}
export interface MathParseOptions {
  /** @internal Inherited prose paragraph mode for nested text-font commands. */
  proseParagraph?:boolean;
  /** @internal A layout scope invoked from original TeX prose retains prose spaces. */
  proseLayout?:boolean;
  /** @deprecated Declared variant names now retain individual identity descriptions. */
  greekVariantConflicts?: readonly string[];
  maxDepth?: number;
  maxLength?: number;
}
const FORMATTING = new Set([
  "left",
  "right",
  "big",
  "Big",
  "bigg",
  "Bigg",
  "bigl",
  "bigr",
  "Bigl",
  "Bigr",
  "biggl", "biggr", "Biggl", "Biggr",
  "bigm", "Bigm", "biggm", "Biggm", "middle",
  "limits",
  "nolimits",
  "nobreak", "allowbreak",
  "displaystyle",
  "textstyle",
  "scriptstyle",
  "scriptscriptstyle",
  ",",
  ";",
  "!",
  "quad",
  "qquad",
  "enspace",
  " ",
]);
export const FONT_DECLARATIONS:Readonly<Record<string,string>>=Object.freeze({
  rm:'mathrm',bf:'mathbf',it:'mathit',sf:'mathsf',tt:'mathtt',cal:'mathcal',
});
export const STYLES = new Set([
  "mathrm",
  "mathbf",
  "mathit",
  "mathsf",
  "mathtt",
  "mathcal",
  "mathbb",
  "textit",
  "textbf",
  "textrm",
  'texttt','textsf','pmb','mathop',
  "boldsymbol",
  "mathscr",
  'mathfrak','mathnormal','mathboldsf','mathitsf','bm','bold','Bbb','frak',
]);
export const ENVIRONMENTS = new Set([
  "matrix",
  "pmatrix",
  "bmatrix",
  "Bmatrix",
  "vmatrix",
  "Vmatrix",
  "cases",
  "aligned",
  "align",
  "align*",
  "alignedat",
  "alignat",
  "alignat*",
  "gathered",
  "gather",
  "gather*",
  "array",
  "tabular",
]);
export function parseMath(
  raw: string,
  span: SourceSpan = { start: 0, end: raw.length },
  options: MathParseOptions = {},
): MathExpression {
  const diagnostics: Diagnostic[] = [];
  const base = span.start;
  const maxDepth = Math.max(
    1,
    Math.min(128, Number.isFinite(options.maxDepth) ? options.maxDepth! : 64),
  );
  const maxLength = Math.max(
    1,
    Math.min(
      1000000,
      Number.isFinite(options.maxLength) ? options.maxLength! : 100000,
    ),
  );
  let i = 0;
  let leftDepth=0;
  const location = (start: number, end = i): Base => ({
    raw: raw.slice(start, end),
    span: { start: base + start, end: base + end },
  });
  const diagnose = (
    code: string,
    start: number,
    end: number,
    message: string,
  ) =>
    diagnostics.push({
      code,
      severity: "error",
      span: { start: base + start, end: base + end },
      message,
    });
  const unknown = (start: number, reason: string): MathSemanticNode => ({
    kind: "unknown",
    reason,
    ...location(start),
  });
  const white = () => {
    while (/\s/.test(raw[i] ?? "") && i < raw.length) i++;
  };
  const literalGroup = (): {
    value: string;
    start: number;
    end: number;
    closed: boolean;
  } => {
    white();
    const start = i;
    if (raw[i] !== "{") {
      const cp = String.fromCodePoint(raw.codePointAt(i) ?? 32);
      i = Math.min(raw.length, i + cp.length);
      return { value: raw.slice(start, i), start, end: i, closed: false };
    }
    i++;
    const content = i;
    let level = 1;
    while (i < raw.length && level) {
      if (raw[i] === "\\") {
        i += Math.min(2, raw.length - i);
        continue;
      }
      if (raw[i] === "{") level++;
      if (raw[i] === "}") level--;
      i++;
    }
    if (level)
      diagnose("math-unclosed-group", start, i, "Unclosed literal group.");
    return {
      value: raw.slice(content, level ? i : i - 1),
      start: content,
      end: level ? i : i - 1,
      closed: !level,
    };
  };
  // Shared prose parser preserves literal text and explicitly delimited mathematics.
  const textContent=(t:{value:string;start:number;end:number},depth:number,paragraph=false):MathSemanticNode=>{
    const nodes:MathSemanticNode[]=[];
    let cursor=0,textStart=0,hasMath=false;
    const text=(end:number)=>{
      if(end>textStart)nodes.push({kind:'text',value:t.value.slice(textStart,end),texWhitespace:paragraph?'paragraph':'inline',...location(t.start+textStart,t.start+end)});
    };
    while(cursor<t.value.length) {
      if(t.value[cursor]==='\\') {
        const escaped=t.value[cursor+1];
        if(escaped && '%{}$#_&'.includes(escaped)) {
          text(cursor);hasMath=true;
          nodes.push({kind:'text',value:escaped,...location(t.start+cursor,t.start+cursor+2)});
          cursor+=2;textStart=cursor;continue;
        }
        const literal=/^\\(textbackslash|textasciitilde|textasciicircum|textless|textgreater)(?![A-Za-z])/.exec(t.value.slice(cursor));
        if(literal) {
          const glyphs:Record<string,string>={textbackslash:'\\',textasciitilde:'~',textasciicircum:'^',textless:'<',textgreater:'>'};
          text(cursor);hasMath=true;
          nodes.push({kind:'text',value:glyphs[literal[1]],literalControl:true,...location(t.start+cursor,t.start+cursor+literal[0].length)});
          cursor+=literal[0].length;while(cursor<t.value.length && /\s/.test(t.value[cursor]))cursor++;
          textStart=cursor;continue;
        }
        const command=/^\\(?:textcircled|text|mbox|textit|textbf|textrm|texttt|textsf|phantom|hphantom|vphantom)(?![A-Za-z])\s*\{/.exec(t.value.slice(cursor));
        if(command) {
          let end=cursor+command[0].length,level=1;
          while(end<t.value.length && level) {
            if(t.value[end]==='\\'){end+=Math.min(2,t.value.length-end);continue;}
            if(t.value[end]==='{')level++;
            else if(t.value[end]==='}')level--;
            end++;
          }
          text(cursor);hasMath=true;
          if(depth>=maxDepth || maxDepth<=1) {
            diagnose('math-depth-limit',t.start+cursor,t.start+end,'Nested text enclosure exceeds the parse depth limit; source retained.');
            nodes.push({kind:'unknown',reason:'nested text depth limit',...location(t.start+cursor,t.start+end)});
          } else {
            const innerStart=t.start+cursor,innerEnd=t.start+end;
            const parsed=parseMath(raw.slice(innerStart,innerEnd),{start:base+innerStart,end:base+innerEnd},{maxDepth:Math.max(1,maxDepth-depth-1),maxLength,proseParagraph:paragraph,proseLayout:true});
            diagnostics.push(...parsed.diagnostics);nodes.push(parsed.body);
          }
          cursor=end;textStart=cursor;continue;
        }
        cursor+=Math.min(2,t.value.length-cursor);continue;
      }
      if(t.value[cursor]!=='$'){cursor++;continue;}
      if(t.value[cursor+1]==='$'){cursor+=2;continue;}
      let close=cursor+1,braceDepth=0;
      while(close<t.value.length) {
        if(t.value[close]==='$' && braceDepth===0)break;
        if(t.value[close]==='{')braceDepth++;
        else if(t.value[close]==='}' && braceDepth>0)braceDepth--;
        close+=t.value[close]==='\\'?Math.min(2,t.value.length-close):1;
      }
      if(close===t.value.length) {
        diagnose('math-text-unclosed-inline',t.start+cursor,t.end,'Inline mathematics in text has no closing dollar; source retained.');
        break;
      }
      text(cursor);hasMath=true;
      const innerStart=t.start+cursor+1,innerEnd=t.start+close;
      const inner=raw.slice(innerStart,innerEnd);
      if(!inner.trim() || depth>=maxDepth || maxDepth<=1) {
        diagnose(!inner.trim()?'math-text-empty-inline':'math-depth-limit',t.start+cursor,t.start+close+1,'Inline text-math content is empty or exceeds the nested parsing limit; source retained.');
        nodes.push({kind:'unknown',reason:'invalid text-math content',...location(t.start+cursor,t.start+close+1)});
      } else {
        const parsed=parseMath(inner,{start:base+innerStart,end:base+innerEnd},{maxDepth:Math.max(1,maxDepth-depth-1),maxLength});
        diagnostics.push(...parsed.diagnostics);
        nodes.push({kind:'group',body:parsed.body,...location(t.start+cursor,t.start+close+1)});
      }
      cursor=close+1;textStart=cursor;
    }
    if(!hasMath)return {kind:'text',value:t.value,texWhitespace:paragraph?'paragraph':'inline',...location(t.start,t.end)};
    text(t.value.length);
    const body:MathSemanticNode={kind:'sequence',children:nodes,...location(t.start,t.end)};
    return {kind:'group',body,...location(t.start,t.end)};
  };
  const tableCell=(start:number,end:number,depth:number,paragraph=false):MathSemanticNode=>{
    const fallback=()=>textContent({value:raw.slice(start,end),start,end},depth,paragraph);
    if(depth>=maxDepth){diagnose('math-depth-limit',start,end,'Nested table cell exceeds the parse depth limit; source retained.');return {kind:'unknown',reason:'table depth limit',...location(start,end)};}
    let at=start;const white=()=>{while(at<end && /\s/.test(raw[at]))at++;};white();
    const name=/^\\(multicolumn|multirow)(?![A-Za-z])/.exec(raw.slice(at,end));
    if(!name)return fallback();
    at+=name[0].length;
    const arg=(optional=false):{raw:string;span:SourceSpan;start:number;end:number}|undefined=>{
      white();const open=optional?'[':'{',close=optional?']':'}';
      if(raw[at]!==open) {
        if(optional || at>=end)return;
        const from=at;at+=String.fromCodePoint(raw.codePointAt(at)!).length;
        return {raw:raw.slice(from,at),span:{start:base+from,end:base+at},start:from,end:at};
      }
      const from=++at;let level=1;
      while(at<end && level) {
        if(raw[at]==='\\'){at+=Math.min(2,end-at);continue;}
        if(raw[at]===open)level++;if(raw[at]===close)level--;at++;
      }
      if(level)return;
      return {raw:raw.slice(from,at-1),span:{start:base+from,end:base+at-1},start:from,end:at-1};
    };
    const vpos=name[1]==='multirow'?arg(true):undefined;
    const count=arg(),bigstruts=name[1]==='multirow'?arg(true):undefined;
    const spec=arg(),vmove=name[1]==='multirow'?arg(true):undefined,content=arg();white();
    const integer=count && /^-?[1-9]\d*$/.test(count.raw.trim())?Number(count.raw.trim()):NaN;
    if(!count || !spec || !content || at!==end || !Number.isSafeInteger(integer) || name[1]==='multicolumn'&&integer<1) {
      diagnose('math-table-merge-unverified',start,end,'Merged table cell syntax or integer span needs review; full source retained.');return fallback();
    }
    const paragraphBody=name[1]==='multirow'?spec.raw.trim()!=='*':parseTexColumns(spec.raw,spec.span.start).definitions[0]?.width!==undefined;
    const child=tableCell(content.start,content.end,depth+1,paragraphBody),inner=child.tableMerge;
    if(inner && inner.annotations.some(a=>a.kind===(name[1]==='multicolumn'?'alignment':'width'))) {
      diagnose('math-table-merge-unverified',start,end,'Repeated merge on the same axis needs review; full source retained.');return fallback();
    }
    const annotations:NonNullable<Base['tableMerge']>['annotations']=[...(inner?.annotations??[])];
    const annotation=(kind:typeof annotations[number]['kind'],value:{raw:string;span:SourceSpan}|undefined)=>{if(value)annotations.push({kind,raw:value.raw,span:value.span});};
    annotation(name[1]==='multicolumn'?'alignment':'width',spec);annotation('vpos',vpos);annotation('bigstruts',bigstruts);annotation('vmove',vmove);
    const mergeColumns=name[1]==='multicolumn'?parseTexColumns(spec.raw,spec.span.start):undefined;
    if(mergeColumns && (!mergeColumns.known || mergeColumns.definitions.length!==1 || mergeColumns.unresolved.length) || name[1]==='multirow' &&
      (!['*','='].includes(spec.raw.trim())&&!isLiteralTexDimension(spec.raw) || vpos&&!/^[tcb]$/.test(vpos.raw.trim()) || bigstruts&&!/^(?:tb|t|b)?\s*\d+$/.test(bigstruts.raw.trim()) || vmove&&!isLiteralTexDimension(vmove.raw)))
      diagnose('math-table-merge-options-unverified',start,end,'Merged cell layout options are retained literally for review.');
    return {kind:'group',body:child,tableMerge:{columns:name[1]==='multicolumn'?integer:inner?.columns??1,rows:name[1]==='multirow'?integer:inner?.rows??1,annotations},...location(start,end)};
  };
  const argument = (depth: number): MathSemanticNode => {
    white();
    if (i >= raw.length || raw[i] === "}") {
      diagnose("math-missing-argument", i, i, "Missing required argument.");
      return unknown(i, "missing argument");
    }
    return atom(depth, true);
  };
  const sequence = (depth: number, stop?: string): MathSemanticNode => {
    const start = i;
    const sizeLeftDepth=leftDepth;
    const children: MathSemanticNode[] = [];
    while (i < raw.length) {
      white();
      if (i >= raw.length || (stop && raw[i] === stop) || stop==='size-scope' &&
        (raw[i]==='}' || sizeLeftDepth>0 && leftDepth===sizeLeftDepth && /^\\right(?![A-Za-z])/.test(raw.slice(i)))) break;
      if (raw[i] === "}") {
        const s = i++;
        diagnose("math-unexpected-close", s, i, "Unexpected closing group.");
        children.push(unknown(s, "unexpected group close"));
        continue;
      }
      const unicodeScript = Object.hasOwn(UNICODE_SUPERSCRIPT_DIGITS, raw[i] ?? "")
        ? UNICODE_SUPERSCRIPT_DIGITS
        : Object.hasOwn(UNICODE_SUBSCRIPT_DIGITS, raw[i] ?? "")
          ? UNICODE_SUBSCRIPT_DIGITS
          : undefined;
      if (raw[i] === "_" || raw[i] === "^" || unicodeScript) {
        const s = i;
        const direction = unicodeScript === UNICODE_SUBSCRIPT_DIGITS ? "_" : unicodeScript ? "^" : raw[i++];
        let lastIndex = children.length - 1;
        while (lastIndex >= 0 && children[lastIndex].kind === "format")
          lastIndex--;
        const last =
          lastIndex < 0 ? undefined : children.splice(lastIndex, 1)[0];
        let value: MathSemanticNode;
        if (unicodeScript) {
          let digits = "";
          while (i < raw.length && Object.hasOwn(unicodeScript, raw[i]))
            digits += unicodeScript[raw[i++]];
          if (/^[+-]\d+$/.test(digits)) {
            const sign: MathSemanticNode = {
              kind: "symbol", value: digits[0], raw: raw.slice(s, s + 1),
              span: { start: base + s, end: base + s + 1 },
            };
            const number: MathSemanticNode = {
              kind: "number", value: digits.slice(1), raw: raw.slice(s + 1, i),
              span: { start: base + s + 1, end: base + i },
            };
            value = { kind: "sequence", children: [sign, number], ...location(s) };
          } else if (/^\d+$/.test(digits))
            value = { kind: "number", value: digits, ...location(s) };
          else {
            diagnose("math-invalid-unicode-script", s, i, "Unicode script requires digits after an optional sign.");
            value = unknown(s, "invalid Unicode script");
          }
        } else value = argument(depth + 1);
        if (!last) {
          const baseNode:MathSemanticNode={kind:'sequence',children:[],...location(s,s)};
          children.push({kind:'script',base:baseNode,emptyBase:true,[direction==='_'?'sub':'sup']:value,...location(s)});
          diagnostics.push({code:'math-empty-script-base-adapted',severity:'info',span:{start:base+s,end:base+i},message:'TeX script on an empty nucleus retained without inferring an attachment to the following operand.'});
          continue;
        }
        const field = direction === "_" ? "sub" : "sup";
        if (last.kind === "script" && last[field]) {
          diagnose("math-duplicate-script", s, i, "Repeated script direction.");
          children.push(last, unknown(s, "duplicate script"));
          continue;
        }
        children.push(
          last.kind === "script"
            ? { ...last, [field]: value, ...location(last.span.start - base) }
            : {
                kind: "script",
                base: last,
                [field]: value,
                ...location(last.span.start - base),
              },
        );
        continue;
      }
      const next = atom(depth + 1, false);
      if (
        next.kind === "format" &&
        (next.name === "limits" || next.name === "nolimits") &&
        children.length
      ) {
        const previous=children.at(-1)!;
        const operator=previous.kind==='script'?previous.base:previous;
        if((operator.kind==='function'||operator.kind==='style')&&Object.hasOwn(operator,'operatorLimits'))operator.operatorLimits=next.name==='limits';
        continue;
      }
      children.push(next);
    }
    // Bind scripts first, then join only genuinely adjacent, unscripted Han.
    const joined: MathSemanticNode[] = [];
    for (let j = 0; j < children.length; ) {
      const first = children[j++];
      if (first.kind !== "text" || !/^\p{Script=Han}+$/u.test(first.value)) {
        joined.push(first);
        continue;
      }
      const parts = [first.value];
      let end = first.span.end;
      while (j < children.length) {
        const next = children[j];
        if (
          next.kind !== "text" ||
          next.span.start !== end ||
          !/^\p{Script=Han}+$/u.test(next.value)
        )
          break;
        parts.push(next.value);
        end = next.span.end;
        j++;
      }
      joined.push({
        ...first,
        value: parts.join(""),
        raw: raw.slice(first.span.start - base, end - base),
        span: { start: first.span.start, end },
      });
    }
    return { kind: "sequence", children: joined, ...location(start) };
  };
  const atom = (depth: number, single: boolean): MathSemanticNode => {
    const start = i;
    if (depth > maxDepth) {
      i = raw.length;
      diagnose(
        "math-depth-limit",
        start,
        i,
        "Maximum semantic parse depth exceeded; remainder retained.",
      );
      return unknown(start, "resource limit");
    }
    const char = String.fromCodePoint(raw.codePointAt(i) ?? 32);
    if(TEXT_NUMBER_FORMS[char]?.roman || Object.hasOwn(CYRILLIC_LETTER_NAMES,char) || Object.hasOwn(LATIN_LETTER_NAMES,char) || Object.hasOwn(ARABIC_CHARACTER_NAMES,char) || Object.hasOwn(DEVANAGARI_CHARACTER_NAMES,char)){i+=char.length;return {kind:'text',value:char,...location(start)};}
    const mathematicalLetter=MATHEMATICAL_LETTERS[char];
    if(mathematicalLetter) {
      i+=char.length;
      const body:MathSemanticNode={kind:'letter',value:mathematicalLetter.letter,...location(start)};
      return {kind:'style',name:mathematicalLetter.font,body,...location(start)};
    }
    if (char === "{") {
      const previousLeftDepth=leftDepth;
      i++;
      const body = sequence(depth, "}");
      leftDepth=previousLeftDepth;
      if (raw[i] === "}") i++;
      else
        diagnose(
          "math-unclosed-group",
          start,
          i,
          "Unclosed mathematical group.",
        );
      return { kind: "group", body, ...location(start) };
    }
    if (/[0-9]/.test(char)) {
      i++;
      if (!single) {
        while (/[0-9]/.test(raw[i] ?? "") && i < raw.length) i++;
        if (raw[i] === "." && /[0-9]/.test(raw[i + 1] ?? "")) {
          i++;
          while (/[0-9]/.test(raw[i] ?? "") && i < raw.length) i++;
        } else if (raw[i] === "." && raw.startsWith("\\dot", i + 1)) i++;
      }
      return { kind: "number", value: raw.slice(start, i), ...location(start) };
    }
    if (/[A-Za-z\u0370-\u03ff]/u.test(char)) {
      i += char.length;
      return { kind: "letter", value: char, ...location(start) };
    }
    if (char === "\\") {
      i++;
      const match = /^[A-Za-z]+/.exec(raw.slice(i));
      const name = match ? match[0] : (raw[i] ?? "");
      i += name.length;
      if(name==='not') {
        const relation=negatedRelationAt(raw,i);
        if(relation){i=relation.end;return {kind:'symbol',value:relation.value,...location(start)};}
        diagnose('math-negation-unverified',start,i,'Negation of this target has no checked adapter; source retained without inferring a different relation.');
        return unknown(start,'unverified negation');
      }
      if(name==='left') {
        // A bracketed array is commonly emitted instead of cases/pmatrix by
        // OCR. Bind its delimiters before scripts, preserving the whole span.
        const saved=i,diagnosticCount=diagnostics.length;
        const opening=/^\s*(\(|\[|\\\{|\\lbrace|\||\\vert|\\\|)\s*(?=\\begin\s*\{array\})/.exec(raw.slice(i));
        if(opening) {
          i+=opening[0].length;
          const body=atom(depth+1,false);
          white();
          const closing=/^\\right\s*(\)|\]|\\\}|\\rbrace|\||\\vert|\\\||\.)/.exec(raw.slice(i));
          const bracket=opening[1],end=closing?.[1];
          const environment=bracket==='(' && end===')' ? 'pmatrix' : bracket==='[' && end===']' ? 'bmatrix' : ['\\{','\\lbrace'].includes(bracket) && end==='.' ? 'cases' : ['\\{','\\lbrace'].includes(bracket) && ['\\}','\\rbrace'].includes(end ?? '') ? 'Bmatrix' : ['|','\\vert'].includes(bracket) && ['|','\\vert'].includes(end ?? '') ? 'vmatrix' : bracket==='\\|' && end==='\\|' ? 'Vmatrix' : undefined;
          if(environment && closing && (body.kind==='matrix' && body.environment==='array' || body.kind==='group')) {
            i+=closing[0].length;
            return {kind:'matrix',environment,rows:body.kind==='matrix'?body.rows:[[body.body]],...(body.kind==='matrix'?{rowRules:body.rowRules,columnRules:body.columnRules,columnCount:body.columnCount,columnSpec:body.columnSpec,columnDefinitions:body.columnDefinitions}:{}),...location(start)};
          }
        }
        i=saved;diagnostics.splice(diagnosticCount);
      }
      if(name==='hspace') {
        const distance=horizontalSpaceAt(raw,i);
        if(distance){i=distance.end;return {kind:'format',name,distance:{value:distance.value,span:{start:base+distance.start,end:base+distance.valueEnd}},starred:distance.starred,...location(start)};}
        white();if(raw[i]==='*'){i++;white();}
        if(raw[i]==='{')literalGroup();
        diagnose('math-invalid-horizontal-space',start,i,'Horizontal spacing requires a literal signed decimal distance and supported unit; source retained.');
        return unknown(start,'unverified spacing distance');
      }
      if(name==='color'||name==='textcolor') {
        if(name==='color'&&single){diagnose('math-color-argument-unverified',start,i,'Color declaration as an unbraced macro argument has no established body scope; source retained.');return unknown(start,'unverified color argument');}
        white();
        if(raw[i]!=='{'){diagnose('math-color-name-missing',start,i,'Color specification requires a braced literal; source retained.');return unknown(start,'missing color specification');}
        const color=literalGroup();
        if(!color.value.trim() || !/^(?:[A-Za-z]+|#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?)$/.test(color.value.trim()))diagnose('math-color-specification-unverified',color.start,color.end,'Color specification retained literally; macros/models/mixes require review.');
        const body=name==='color'?sequence(depth+1,'size-scope'):argument(depth+1);
        return {kind:'style',name,body,color:{value:color.value,span:{start:base+color.start,end:base+color.end}},...location(start)};
      }
      if(Object.hasOwn(FONT_DECLARATIONS,name)) {
        if(single){diagnose('math-font-argument-unverified',start,i,'Font declaration as an unbraced macro argument has no established body scope; source retained.');return unknown(start,'unverified font argument');}
        const body=sequence(depth+1,'size-scope');
        return {kind:'style',name:FONT_DECLARATIONS[name],body,...location(start)};
      }
      if(Object.hasOwn(FONT_SIZE_NAMES,name)) {
        if(single){diagnose('math-size-argument-unverified',start,i,'Size declaration as an unbraced macro argument has no established body scope; source retained.');return unknown(start,'unverified size argument');}
        const body=sequence(depth+1,'size-scope');
        return {kind:'style',name,body,...location(start)};
      }
      if (FORMATTING.has(name))
        { if(name==='left')leftDepth++;if(name==='right')leftDepth=Math.max(0,leftDepth-1);if(['left','right'].includes(name) && raw[i]==='.') i++;return { kind: "format", name, ...location(start) }; }
      if(name==='operatorname') {
        const operatorLimits=raw[i]==='*';if(operatorLimits)i++;
        const text=literalGroup();
        if(Object.hasOwn(FUNCTIONS,text.value))return {kind:'function',value:text.value,...(operatorLimits?{operatorLimits}:{}),...location(start)};
        // §6.16.2.2 permits unlisted named functions with at least two Latin
        // letters: lowercase, or an initial capital followed by lowercase.
        if(/^[A-Za-z][a-z]+$/.test(text.value))return {kind:'function',value:text.value,...(operatorLimits?{operatorLimits}:{}),...location(start)};
        let body:MathSemanticNode;
        if(/[\\{}]/.test(text.value)) {
          if(depth>=maxDepth){diagnose('math-depth-limit',text.start,text.end,'Maximum named-operator body depth exceeded.');body={kind:'unknown',reason:'resource limit',...location(text.start,text.end)};}
          else {
            const parsed=parseMath(text.value,{start:base+text.start,end:base+text.end},{maxDepth:Math.max(1,maxDepth-depth),maxLength});
            diagnostics.push(...parsed.diagnostics);body=parsed.body;
          }
          const meaningful=(n:MathSemanticNode):boolean=>n.kind==='format'?false:n.kind==='group'||n.kind==='style'?meaningful(n.body):n.kind==='sequence'?n.children.some(meaningful):n.kind==='text'?!!n.value.trim():true;
          if(!meaningful(body))diagnose('math-operatorname-unverified',start,i,'Named operator has no meaningful body; source retained.');
        } else {
          if(!text.closed || !text.value.trim() || !/^[\p{L}\p{N} ]+$/u.test(text.value))diagnose('math-operatorname-unverified',start,i,'Named operator specification retained with a role description; syntax/punctuation need review.');
          body={kind:'text',value:text.value,...location(text.start,text.end)};
        }
        return {kind:'style',name:'operatorname',body,operatorLimits,...location(start)};
      }
      if(name==='pmod'||name==='pod') {
        const commandEnd=i,body=argument(depth+1),command={start:base+start,end:base+commandEnd};
        const children:MathSemanticNode[]=[{kind:'symbol',value:'(',raw:raw.slice(start,commandEnd),span:command}];
        if(name==='pmod')children.push({kind:'symbol',value:'@modulus',raw:raw.slice(start,commandEnd),span:command});
        const meaningful=(node:MathSemanticNode):boolean=>node.kind==='format'?false:node.kind==='group'||node.kind==='style'?meaningful(node.body):node.kind==='sequence'?node.children.some(meaningful):node.kind==='text'?!!node.value.trim():true;
        if(name==='pmod' && !meaningful(body)){
          diagnose('math-empty-modulus',body.span.start-base,body.span.end-base,'Modulo annotation has no modulus expression; original argument retained.');
          children.push({kind:'unknown',reason:'empty modulus',raw:body.raw,span:body.span});
        }else children.push(body);
        children.push({kind:'symbol',value:')',raw:'',span:{start:base+i,end:base+i}});
        return {kind:'group',body:{kind:'sequence',children,...location(start)},...location(start)};
      }
      if(name==='eqno') {
        const body=sequence(depth+1,'size-scope');
        const meaningful=(node:MathSemanticNode):boolean=>node.kind==='format'?false:node.kind==='group'||node.kind==='style'?meaningful(node.body):node.kind==='sequence'?node.children.some(meaningful):node.kind==='text'?!!node.value.trim():true;
        if(!meaningful(body)){diagnose('math-invalid-equation-tag',start,i,'Equation-number command requires a nonempty label; source retained.');return unknown(start,'empty equation number');}
        diagnostics.push({code:'math-equation-tag-linearized',severity:'info',span:{start:base+start,end:base+i},message:'Explicit right equation number retained after the equation; original label content and source preserved.'});
        return {kind:'equation-tag',body,parenthesized:false,...location(start)};
      }
      if (name === 'tag') {
        white();
        const parenthesized = raw[i] !== '*';
        if (!parenthesized) { i++; white(); }
        const label = literalGroup();
        if (!label.closed || !label.value.trim()) {
          diagnose('math-invalid-equation-tag', start, i, 'Equation tag requires a nonempty closed braced label; source retained.');
          return unknown(start, 'invalid equation tag');
        }
        const body: MathSemanticNode = {kind:'text',value:label.value,...location(label.start,label.end)};
        diagnostics.push({code:'math-equation-tag-linearized',severity:'info',span:{start:base+start,end:base+i},
          message:'Explicit equation label retained after the row with a separating blank; source layout is linearized.'});
        return {kind:'equation-tag',body,parenthesized,...location(start)};
      }
      if(name==='boxed') {
        const body=argument(depth+1);
        return {kind:'accent',name,body,...location(start)};
      }
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const numerator = argument(depth + 1),
          denominator = argument(depth + 1);
        return { kind: "fraction", numerator, denominator, ...location(start) };
      }
      if (["binom", "dbinom", "tbinom"].includes(name)) {
        const commandEnd = i;
        const sub = argument(depth + 1), sup = argument(depth + 1);
        const empty = (node: MathSemanticNode): boolean => node.kind === "group"
          ? empty(node.body) : node.kind === "sequence" && node.children.length === 0;
        if (empty(sub) || empty(sup)) {
          diagnose("math-empty-binomial", start, i, "Binomial needs both arguments; source retained for correction.");
          return unknown(start, "empty binomial argument");
        }
        diagnostics.push({code: "math-binomial-normalized", severity: "info",
          span: {start: base + start, end: base + i},
          message: "Binomial coefficient written as C with total below and selection above under §6.10; original syntax retained."});
        const coefficient: MathSemanticNode = {kind: "letter", value: "C", ...location(start, commandEnd)};
        const body: MathSemanticNode = {kind: "script", base: coefficient, sub, sup, ...location(start)};
        // TeX scripts outside \binom apply to the entire coefficient, not to k.
        return {kind: "group", body, ...location(start)};
      }
      if(name==='overset' || name==='underset' || name==='stackrel') {
        const mark=argument(depth+1),body=argument(depth+1);
        return {kind:'annotation',direction:name==='underset'?'below':'above',body,mark,...location(start)};
      }
      if(name==='substack') {
        white();
        if(raw[i]!=='{')return {kind:'group',body:argument(depth+1),...location(start)};
        const content=literalGroup(),rows:MathSemanticNode[][]=[];
        let from=content.start,brace=0,nesting=0;
        const row=(end:number)=>{
          if(depth>=maxDepth){diagnose('math-depth-limit',from,end,'Maximum nested stack depth exceeded.');rows.push([{kind:'unknown',reason:'resource limit',...location(from,end)}]);return;}
          const parsed=parseMath(raw.slice(from,end),{start:base+from,end:base+end},{maxDepth:Math.max(1,maxDepth-depth),maxLength});
          diagnostics.push(...parsed.diagnostics);rows.push([parsed.body]);
        };
        for(let at=content.start;at<content.end;at++) {
          if(raw[at]==='\\') {
            const environment=/^\\(begin|end)\s*\{[^{}]*\}/.exec(raw.slice(at,content.end));
            if(environment){if(environment[1]==='begin')nesting++;else nesting=Math.max(0,nesting-1);at+=environment[0].length-1;continue;}
            if(!brace && !nesting && raw.startsWith('\\\\',at)){
              row(at);at++;from=at+1;
              if(raw[from]==='[')diagnose('math-stack-spacing-unverified',from,Math.min(content.end,from+1),'Optional stacked-row spacing retained for review.');
            }
            else at++;
          } else if(raw[at]==='{')brace++;
          else if(raw[at]==='}')brace--;
          else if(raw[at]==='&' && !brace && !nesting)diagnose('math-stack-columns-unsupported',at,at+1,'Substack supports one expression per row; source retained for correction.');
        }
        row(content.end);
        return {kind:'matrix',environment:'substack',rows,...location(start)};
      }
      if(['acute','grave','mathring'].includes(name)) {
        const mark:MathSemanticNode={kind:'symbol',value:`@${name}`,...location(start,i)};
        const body=argument(depth+1);
        return {kind:'annotation',direction:'above',body,mark,...location(start)};
      }
      if(Object.hasOwn(LABELED_ARROW_COMMANDS,name)) {
        const commandEnd=i;
        white();
        let lower:MathSemanticNode|undefined;
        if(raw[i]==='[') {
          i++;
          lower=sequence(depth+1,']');
          if(raw[i]===']')i++;
          else diagnose('math-unclosed-arrow-label',start,i,'Lower arrow label has no closing bracket; source retained.');
        }
        const upper=argument(depth+1);
        const empty=(n:MathSemanticNode):boolean=>n.kind==='group'?empty(n.body):n.kind==='sequence' && !n.children.length;
        let body:MathSemanticNode={kind:'symbol',value:LABELED_ARROW_COMMANDS[name],...location(start,commandEnd)};
        if(lower && !empty(lower))body={kind:'annotation',direction:'below',body,mark:lower,...location(start)};
        if(!empty(upper))body={kind:'annotation',direction:'above',body,mark:upper,...location(start)};
        return {...body,...location(start)};
      }
      if(['overleftarrow','overleftrightarrow','underleftarrow','underrightarrow','underleftrightarrow'].includes(name)) {
        const mark:MathSemanticNode={kind:'symbol',value:name.replace(/^(over|under)/,''),...location(start)};
        const body=argument(depth+1);
        return {kind:'annotation',direction:name.startsWith('under')?'below':'above',body,mark,...location(start)};
      }
      if (name === "sqrt") {
        white();
        let index: MathSemanticNode | undefined;
        if (raw[i] === "[") {
          i++;
          index = sequence(depth + 1, "]");
          if (raw[i] === "]") i++;
          else
            diagnose(
              "math-unclosed-root-index",
              start,
              i,
              "Missing root index bracket.",
            );
        }
        const body = argument(depth + 1);
        return { kind: "root", body, index, ...location(start) };
      }
      if (name === "text" || name === "mbox" || name === "textcircled" || ['texttt','textsf'].includes(name) || ['textit','textbf','textrm'].includes(name) && /^\s*\{/.test(raw.slice(i))) {
        const enclose=(body:MathSemanticNode):MathSemanticNode=>name==='textcircled'?{kind:'accent',name,body,...location(start)}:['textit','textbf','textrm','texttt','textsf'].includes(name)?{kind:'style',name,body,...location(start)}:body;
        white();
        if (raw[i] === "{") {
          const t = literalGroup();
          return enclose(textContent(t,depth,!!options.proseParagraph && !['text','mbox','textcircled'].includes(name)));
        }
        const body = argument(depth + 1);
        return enclose({
          kind: "text",
          value: body.raw,
          ...location(body.span.start - base),
        });
      }
      if(Object.hasOwn(PHANTOM_LAYOUTS,name)) {
        white();let body:MathSemanticNode;
        if(options.proseLayout && raw[i]==='{'){const t=literalGroup();body=textContent(t,depth,!!options.proseParagraph);}
        else body=argument(depth+1);
        return {kind:'style',name,body,...location(start)};
      }
      if (STYLES.has(name)) {
        const body = argument(depth + 1);
        return { kind: "style", name, body, ...(name==='mathop'?{operatorLimits:false}:{}), ...location(start) };
      }
      if (
        [
          "dot",
          "ddot",
          "overline",
          "bar",
          "vec",
          "hat",
          "widehat",
          "check",
          "breve",
          "overparen",
          "underparen",
          "tilde",
          "widetilde",
          "underline",
          "overrightarrow",
          "underbrace",
          "overbrace",
          "underbracket",
          "overbracket",
        ].includes(name)
      ) {
        const body = argument(depth + 1);
        return { kind: "accent", name, body, ...location(start) };
      }
      if (name === "ce") {
        literalGroup();
        return {
          kind: "chemistry",
          reason: "Requires chemistry domain encoder.",
          ...location(start),
        };
      }
      if (name === "begin") {
        const environmentName=literalGroup(),env=environmentName.value;
        if (!ENVIRONMENTS.has(env)) {
          const contentStart=i;
          const markers=/\\(begin|end)\s*\{([^{}]*)\}|%|\r\n|\r|\n/g;markers.lastIndex=i;
          let nested=1,contentEnd=raw.length,closed=false,comment=false;
          for(let marker=markers.exec(raw);marker;marker=markers.exec(raw)) {
            if(/^[\r\n]/.test(marker[0])){comment=false;continue;}
            let slashes=0;for(let at=marker.index-1;at>=contentStart&&raw[at]==='\\';at--)slashes++;
            if(slashes%2)continue;
            if(marker[0]==='%'){comment=true;continue;}
            if(comment)continue;
            if(marker[2]!==env)continue;
            nested+=marker[1]==='begin'?1:-1;
            if(!nested){contentEnd=marker.index;i=marker.index+marker[0].length;closed=true;break;}
          }
          if(!closed)i=raw.length;
          diagnose(
            "math-unsupported-environment",
            start,
            i,
            "Unsupported environment " + env,
          );
          if(!closed)diagnose('math-unclosed-environment',start,i,'Unsupported environment has no matching end; full remaining source retained.');
          return {kind:'unknown',reason:'unsupported environment',...location(start),sourcePayload:{value:raw.slice(contentStart,contentEnd),span:{start:base+contentStart,end:base+contentEnd},environment:env,nameSpan:{start:base+environmentName.start,end:base+environmentName.end}}};
        }
        white();
        if (['aligned','alignedat','gathered','tabular'].includes(env) && raw[i]==='[') {
          const position=/^\[([tbc])\]/.exec(raw.slice(i));
          if(position) { i+=position[0].length;white(); }
        }
        if (['alignedat','alignat','alignat*'].includes(env)) {
          const columns=literalGroup();
          if(!columns.closed || !/^[1-9]\d*$/.test(columns.value)) diagnose('math-invalid-alignment-columns',columns.start,columns.end,'Alignment pair count must be a positive integer.');
        }
        const columnRules:{beforeColumn:number;count:number;raw:string;span:SourceSpan}[]=[];
        let columnCount:number|undefined;
        let columnSpec:{raw:string;span:SourceSpan}|undefined;
        let columnDefinitions:TexColumnDefinition[]|undefined;
        if(env==='array' || env==='tabular') {
          const columns=literalGroup();
          columnSpec={raw:columns.value,span:{start:base+columns.start,end:base+columns.end}};
          const parsed=parseTexColumns(columns.value,base+columns.start);
          if(!columns.closed || !parsed.known)diagnose('math-array-columns-unsupported',columns.start,columns.end,'Column syntax remains reviewable; cells and the original specification are retained.');
          else {columnDefinitions=parsed.definitions;columnCount=columnDefinitions.length;columnRules.push(...parsed.rules);}
          for(const item of parsed.unresolved)diagnose('math-column-width-unverified',item.span.start-base,item.span.end-base,item.reason+'; original column source retained.');
          if(parsed.expanded)diagnostics.push({code:'math-column-repeat-adapted',severity:'info',span:columnSpec.span,message:'Repeated column pattern retains source-bound definitions and exact logical positions within the expansion budget.'});
        }
        const rows: MathSemanticNode[][] = [];
        const rowRules:NonNullable<Extract<MathSemanticNode,{kind:'matrix'}>['rowRules']>=[];
        let row: MathSemanticNode[] = [];
        let cellStart = i;
        let brace = 0;
        let nesting = 0;
        let closed = false;
        let textMath=false;
        const cell = (end: number) => {
          if (depth >= maxDepth) {
            diagnose(
              "math-depth-limit",
              cellStart,
              end,
              "Maximum nested environment depth exceeded.",
            );
            row.push({
              kind: "unknown",
              reason: "resource limit",
              ...location(cellStart, end),
            });
            return;
          }
          if(env==='tabular') {
            const logicalColumn=row.reduce((sum,cell)=>sum+(cell.tableMerge?.columns??1),0);
            row.push(tableCell(cellStart,end,depth+1,!!columnDefinitions?.[logicalColumn]?.width));
            return;
          }
          if(columnDefinitions?.[row.length]?.width) {
            row.push(textContent({value:raw.slice(cellStart,end),start:cellStart,end},depth+1,true));return;
          }
          const parsed = parseMath(
            raw.slice(cellStart, end),
            { start: base + cellStart, end: base + end },
            { maxDepth: Math.max(1, maxDepth - depth), maxLength },
          );
          diagnostics.push(...parsed.diagnostics);
          row.push(parsed.body);
        };
        while (i < raw.length) {
          if(raw.startsWith('\\hline',i) && !nesting && brace===0 && row.length===0 && !raw.slice(cellStart,i).trim() &&
            ['array','matrix','pmatrix','bmatrix','Bmatrix','vmatrix','Vmatrix','tabular'].includes(env)) {
            const rule=/^\\hline(?![A-Za-z])/.exec(raw.slice(i));
            if(rule){rowRules.push({beforeRow:rows.length,raw:rule[0],span:{start:base+i,end:base+i+rule[0].length}});i+=rule[0].length;cellStart=i;continue;}
          }
          if(env==='tabular' && !nesting && brace===0 && !textMath && row.length===0 && !raw.slice(cellStart,i).trim()) {
            const rule=/^\\cline\s*\{\s*([1-9]\d*)\s*-\s*([1-9]\d*)\s*\}/.exec(raw.slice(i));
            if(rule) {
              const first=Number(rule[1]),last=Number(rule[2]);
              if(!Number.isSafeInteger(last) || first>last || columnCount===undefined || last>columnCount)diagnose('math-table-rule-range-invalid',i,i+rule[0].length,'Partial table rule exceeds the declared column range; source retained.');
              rowRules.push({beforeRow:rows.length,raw:rule[0],span:{start:base+i,end:base+i+rule[0].length},columns:{first,last}});
              i+=rule[0].length;cellStart=i;continue;
            }
          }
          if (raw.startsWith("\\begin{", i)) {
            const beginMatch = /^\\begin\{([^}]+)\}/.exec(raw.slice(i));
            if (beginMatch) {
              nesting++;
              i += beginMatch[0].length;
              continue;
            }
          }
          if (raw.startsWith("\\end{", i)) {
            const endMatch = /^\\end\{([^}]+)\}/.exec(raw.slice(i));
            if (nesting && endMatch) {
              nesting--;
              i += endMatch[0].length;
              continue;
            }
            if (endMatch) {
              if(row.length || raw.slice(cellStart,i).trim() || env!=='tabular' && !rowRules.some(rule=>rule.beforeRow===rows.length)) {
                cell(i);rows.push(row);
              }
              if (endMatch[1] !== env)
                diagnose(
                  "math-mismatched-environment",
                  i,
                  i + endMatch[0].length,
                  "Mismatched environment end.",
                );
              i += endMatch[0].length;
              closed = true;
              break;
            }
          }
          if (
            !nesting &&
            brace === 0 &&
            !textMath &&
            (raw[i] === "&" || raw.startsWith("\\\\", i))
          ) {
            cell(i);
            if (raw[i] === "&") i++;
            else {
              rows.push(row);
              row = [];
              i += 2;
              // TeX optional inter-row vertical spacing has no braille payload.
              const spacing=/^\[[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:pt|em|ex|mm|cm)\]/.exec(raw.slice(i));
              if(spacing) i+=spacing[0].length;
            }
            cellStart = i;
            continue;
          }
          if (raw[i] === "\\") {
            i += Math.min(2, raw.length - i);
            continue;
          }
          if(env==='tabular' && raw[i]==='$')textMath=!textMath;
          if (raw[i] === "{") brace++;
          if (raw[i] === "}") brace--;
          i++;
        }
        if (!closed) {
          cell(i);
          rows.push(row);
          diagnose(
            "math-unclosed-environment",
            start,
            i,
            "Unclosed environment.",
          );
        }
        const environment=['align','align*','alignedat','alignat','alignat*'].includes(env) ? 'aligned' : ['gather','gather*'].includes(env) ? 'gathered' : env;
        if(rows.every(row=>row.every(cell=>!cell.raw.trim()))) {
          diagnose('math-empty-environment',start,i,'Environment contains no expression; original source retained for correction.');
          return unknown(start,'empty environment');
        }
        // A one-cell array only positions a single expression. Keeping it as
        // a group allows scripts/roots without introducing a spurious row break.
        if(env!=='tabular' && (columnRules.length || columnDefinitions?.some(c=>c.width)) && rows.some(row=>row.length!==columnCount))diagnose('math-array-column-count-mismatch',start,i,'Rows do not match the declared ruled/paragraph columns; cells and locations retained for correction.');
        if(env==='array' && columnCount!==undefined && rows.length===1 && rows[0].length===1 && !rowRules.length && !columnRules.length && !columnDefinitions?.some(c=>c.width))
          return {kind:'group',body:rows[0][0],...location(start)};
        return { kind: "matrix", environment, rows,...(rowRules.length?{rowRules}:{}),...(columnSpec?{columnRules,columnCount,columnSpec,columnDefinitions}:{}), ...location(start) };
      }
      if(Object.hasOwn(GREEK_VARIANTS,name)) {
        const variant=GREEK_VARIANTS[name as keyof typeof GREEK_VARIANTS];
        const body:MathSemanticNode={kind:'letter',value:variant.glyph,...location(start)};
        return {kind:'style',name:`greek-variant:${name}`,body,...location(start)};
      }
      if(name==='imath' || name==='jmath')return {kind:'text',value:name==='imath'?'ı':'ȷ',literalControl:true,mathLetterControl:true,...location(start)};
      if(name==='ell') {
        const body:MathSemanticNode={kind:'letter',value:'l',...location(start)};
        diagnostics.push({code:'math-letter-glyph-normalized',severity:'info',span:body.span,message:'Curled lowercase l encoded with the handwritten-light letter font; source spelling retained.'});
        return {kind:'style',name:'mathcal',body,...location(start)};
      }
      if (Object.hasOwn(GREEK_COMMANDS, name))
        return {
          kind: "letter",
          value: GREEK_COMMANDS[name],
          ...location(start),
        };
      if (Object.hasOwn(FUNCTIONS, name) || NAMED_FUNCTION_COMMANDS.has(name))
        return { kind: "function", value: name, ...location(start) };
      if(Object.hasOwn(SYMBOL_COMMAND_ALIASES,name))return {kind:'symbol',value:SYMBOL_COMMAND_ALIASES[name],...location(start)};
      if(name==='|')return {kind:'symbol',value:'Vert',...location(start)};
      if (Object.hasOwn(SYMBOLS,name) || Object.hasOwn(DESCRIBED_SYMBOLS,name) || Object.hasOwn(POSITION_MARKS,name) || CONTEXTUAL_SYMBOLS.has(name))
        return { kind: "symbol", value: name, ...location(start) };
      diagnose(
        "math-unknown-command",
        start,
        i,
        "Unsupported TeX command \\" + name + "; retained in semantic tree.",
      );
      return unknown(start, "unknown command");
    }
    i += char.length;
    if(Object.hasOwn(CIRCLED_NUMBERS,char))return {kind:'text',value:char,...location(start)};
    if(char==='⊤')return {kind:'symbol',value:'top',...location(start)};
    if(Object.hasOwn(DESCRIBED_SYMBOL_ALIASES,char))return {kind:'symbol',value:DESCRIBED_SYMBOL_ALIASES[char],...location(start)};
    if (char === "→") return {kind:"symbol",value:"rightarrow",...location(start)};
    if (Object.hasOwn(SYMBOLS, char))
      return {
        kind: "symbol",
        value: SYMBOL_ALIASES[char] ?? char,
        ...location(start),
      };
    if (/\p{Script=Han}/u.test(char))
      return {kind:'text',value:char,...location(start)};
    if(/[，。；、！？;]/u.test(char))return {kind:'text',value:char,...location(start)};
    if(char==='~')return {kind:'format',name:'quad',...location(start)};
    diagnose(
      "math-unknown-character",
      start,
      i,
      "Unsupported mathematical character " + char,
    );
    return unknown(start, "unknown character");
  };
  if (raw.length > maxLength) {
    i = raw.length;
    diagnose(
      "math-length-limit",
      0,
      i,
      "Maximum input size exceeded; complete source retained.",
    );
    return {
      kind: "math-expression",
      raw,
      span: { start: base, end: base + raw.length },
      body: unknown(0, "resource limit"),
      diagnostics,
    };
  }
  const body = sequence(0);
  return {
    kind: "math-expression",
    raw,
    span: { start: base, end: base + raw.length },
    body,
    diagnostics,
  };
}
