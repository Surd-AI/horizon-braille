import {horizontalSpaceAt} from './tex-spacing';
import {
  FUNCTIONS,
  SYMBOL_COMMAND_ALIASES,
  FONT_SIZE_NAMES,
  CONTEXTUAL_SYMBOLS,
  LABELED_ARROW_COMMANDS,
  NAMED_FUNCTION_COMMANDS,
  GREEK_COMMANDS,
  SYMBOLS,
  DESCRIBED_SYMBOLS,
  DESCRIBED_SYMBOL_ALIASES,
  BAR_DELIMITERS,
  SYMBOL_ALIASES,
  UNICODE_SUPERSCRIPT_DIGITS,
  UNICODE_SUBSCRIPT_DIGITS,
} from "../rules/math-symbols";
import { STYLES, FONT_DECLARATIONS, ENVIRONMENTS, negatedRelationAt } from "./math";
import {latinDiacritics} from '../rules/latin-diacritics';
import {CYRILLIC_LETTER_NAMES} from '../rules/cyrillic-letter-names';
import {LATIN_LETTER_NAMES} from '../rules/latin-letter-names';
import {ARABIC_CHARACTER_NAMES} from '../rules/arabic-character-names';
import {DEVANAGARI_CHARACTER_NAMES} from '../rules/devanagari-character-names';
import {PHANTOM_LAYOUTS} from '../rules/phantom-layouts';
import {MATHEMATICAL_LETTERS} from '../rules/math-alphabet';

export interface Island {
  end: number;
  kind?: "bare-math" | "chemistry";
  code?: string;
  /** A failed operator can lie beyond the last complete mathematical atom. */
  diagnosticEnd?: number;
}
// Roles of names already present in SYMBOLS; no new commands or point tables.
const CONSTANTS = new Set(["infty", "emptyset", "empty", "varnothing", "aleph"]);
const GREEK_GLYPHS = new Set(Object.values(GREEK_COMMANDS));
const INFIX = new Set([
  "pm",
  "mp",
  "times",
  "cdot",
  "div",
  "neq",
  "ne",
  "approx",
  "equiv",
  "propto",
  "ge",
  "geq",
  "geqslant",
  "le",
  "leq",
  "leqslant",
  'ngtr','nless','gtrless','lessgtr','gg','ll',
  'gt','lt',
  'models','vDash','Vdash','Vvdash','nvdash','nvDash','nVdash','nVDash','nleq','ngeq','nmid','nparallel',
  "to",
  "rightarrow",
  "longrightarrow",
  "parallel",
  "perp",
  "cong",
  "sim",
  "Leftrightarrow",
  "Rightarrow",
  "Longrightarrow","Longleftrightarrow",
  "iff", "implies",
  "in",
  "notin",
  "subset",
  "supset",
  "subseteq",
  "supseteq",
  "cup",
  "cap",
  "setminus",
  "backslash", "isin", "notsubset", "notsupset", "Subset", "Supset",
  "prec", "succ", "preceq", "succeq", "preccurlyeq", "succcurlyeq",
  "mapsto", "longmapsto", "leftrightarrow", "longleftrightarrow",
]);
const unicodeScriptEnd = (source: string, at: number): number => {
  const digits = Object.hasOwn(UNICODE_SUPERSCRIPT_DIGITS, source[at] ?? "")
    ? UNICODE_SUPERSCRIPT_DIGITS
    : Object.hasOwn(UNICODE_SUBSCRIPT_DIGITS, source[at] ?? "")
      ? UNICODE_SUBSCRIPT_DIGITS
      : undefined;
  if (!digits) return at;
  while (at < source.length && Object.hasOwn(digits, source[at])) at++;
  return at;
};
// Remaining symbols are context-dependent (prefix operators, modifiers,
// delimiters or punctuation), not independent operand constants.
/** One linear index pass avoids rescanning unmatched groups at every command. */
export function formulaScanner(source: string) {
  const closes = new Map<number, number>();
  const stack: number[] = [];
  const paragraphEnds = new Uint32Array(source.length + 1);
  const envCloses = new Map<number, number>();
  const envStack: { name: string; start: number }[] = [];
  const sizedCloses=new Map<number,number>();
  const sizedStack:number[]=[];
  const barCloses=new Map<number,number>();
  const barStack:{width:1|2;start:number}[]=[];
  const paragraphs = new Set<number>();
  // Closed prose-capable TeX tables can contain paragraph breaks. Keep a
  // separate matched index; unclosed starts cannot consume later paragraphs.
  const proseEnvStack:{name:string;start:number}[]=[];
  const proseEnvCloses=new Map<number,number>();
  for (const m of source.matchAll(
    /(?:\r\n|\r(?!\n)|(?<!\r)\n)[ \t]*(?:\r\n|\r|\n)/g,
  ))
    paragraphs.add(m.index);
  let boundary = source.length;
  for (let i = source.length; i >= 0; i--) {
    if (paragraphs.has(i)) boundary = i;
    paragraphEnds[i] = boundary;
  }
  for (let i = 0; i < source.length; i++) {
    if (paragraphs.has(i)) {
      stack.length = 0;
      envStack.length = 0;
      sizedStack.length=0;
      barStack.length=0;
    }
    const c = source[i];
    if (c === "\\") {
      const sized=/^\\(left|right|(?:big|Big)g?[lr])\s*(\\(?:lbrace|rbrace|langle|rangle|lvert|rvert|lVert|rVert|vert|Vert|lfloor|rfloor|lceil|rceil|[{}|])|[()[\]|.⌊⌋⌈⌉])/.exec(source.slice(i,i+64));
      if(sized) {
        if(sized[1]==='left' || sized[1].endsWith('l'))sizedStack.push(i);
        else if(sizedStack.length)sizedCloses.set(sizedStack.pop()!,i+sized[0].length);
        i+=sized[0].length-1;
        continue;
      }
      const barCommand=/^\\(?:(lvert|rvert|lVert|rVert|vert|Vert)(?![A-Za-z])|(\|))/.exec(source.slice(i,i+16));
      if(barCommand) {
        const bar=BAR_DELIMITERS[barCommand[1] ?? 'Vert'];
        if(bar.side!=='left' && barStack.at(-1)?.width===bar.width)barCloses.set(barStack.pop()!.start,i+barCommand[0].length);
        else if(bar.side!=='right')barStack.push({width:bar.width,start:i});
        i+=barCommand[0].length-1;continue;
      }
      const m = /^\\(begin|end)\{([A-Za-z]+\*?)\}/.exec(source.slice(i, i + 64));
      if (m) {
        if(m[1]==='begin')proseEnvStack.push({name:m[2],start:i});
        else if(proseEnvStack.at(-1)?.name===m[2]) {
          const opening=proseEnvStack.pop()!;
          if(['array','tabular'].includes(opening.name))proseEnvCloses.set(opening.start,i+m[0].length);
        }
        if (m[1] === "begin") envStack.push({ name: m[2], start: i });
        else if (envStack.at(-1)?.name === m[2])
          envCloses.set(envStack.pop()!.start, i + m[0].length);
        i += m[0].length - 1;
      } else i++;
    } else if(c==='‖') {
      if(barStack.at(-1)?.width===2)barCloses.set(barStack.pop()!.start,i+1);
      else barStack.push({width:2,start:i});
    } else if (c === "{" || c === "[" || c === "(") stack.push(i);
    else if (c === "}" || c === "]" || c === ")") {
      // Literal text may contain unmatched parentheses; they cannot hide a TeX brace close.
      if (c === "}")
        while (stack.length && source[stack.at(-1)!] !== "{") stack.pop();
      const start = stack.at(-1);
      if (
        start !== undefined &&
        "{[(".indexOf(source[start]) === "}])".indexOf(c)
      ) {
        closes.set(start, i + 1);
        stack.pop();
      }
    }
  }
  const breakHint=/\\(?:nobreak|allowbreak)(?![A-Za-z])/y;
  const ws = (i: number) => {
    for(;;){
      if(source[i]===' '||source[i]==='\t'){i++;continue;}
      if(source[i]==='\\'){
        breakHint.lastIndex=i;const hint=breakHint.exec(source);
        if(hint){i=breakHint.lastIndex;continue;}
      }
      break;
    }
    return i;
  };
  const accents = new Set([
    'acute','grave','mathring',
    "dot",
    "ddot",
    "overline",
    "bar",
    "vec",
    "hat",
    "widehat",
    'check','breve','overparen','underparen',
    "tilde",
    "widetilde",
    "underline",
    "overrightarrow",
    'underbrace','overbrace','underbracket','overbracket',
    'overleftarrow','overleftrightarrow','underleftarrow','underrightarrow','underleftrightarrow',
  ]);
  type Atom = {
    end: number;
    strong: boolean;
    chemical?: boolean;
    uncertain?: boolean;
    invalid?: boolean;
    contextual?: boolean;
    infix?: boolean;
    /** Invalid outer grouping must yield back to the document scanner. */
    recoveryEnd?: number;
  };
  const atom = (start: number, depth = 0, single = false): Atom | undefined => {
    if (depth > 64) return;
    let i = start;
    if(source[i]==='\\'){breakHint.lastIndex=i;if(breakHint.exec(source))i=ws(breakHint.lastIndex);}
    const c = source[i];
    if(Object.hasOwn(DESCRIBED_SYMBOL_ALIASES,c ?? '') || c==='∃' || c==='∄')return {end:i+1,strong:true};
    const mathematicalGlyph=String.fromCodePoint(source.codePointAt(i) ?? 0);
    if(Object.hasOwn(MATHEMATICAL_LETTERS,mathematicalGlyph))return {end:i+mathematicalGlyph.length,strong:true};
    if(c==='‖' && barCloses.has(i))return {end:barCloses.get(i)!,strong:true};
    if(c==='⊤')return {end:i+1,strong:false};
    if ("{[(".includes(c ?? "\0")) {
      const end = closes.get(i);
      if (end === undefined) return;
      // Preserve literal TeX arguments, but classify standalone groups from all
      // their children. Weak valid groups remain cached by their consumed span.
      if (c === "{" && single) return { end, strong: false };
      const recover = (): Atom => ({
        end: start + 1,
        strong: false,
        uncertain: true,
        invalid: true,
        recoveryEnd: end,
      });
      let j = ws(i + 1),
        strong = false,
        uncertain = false,
        invalid = false;
      let pending = false,
        pendingStrong = false,
        hasOperand = false;
      while (j < end - 1) {
        const item = atom(j, depth + 1);
        if (!item || item.end > end - 1) {
          // Ordinary grouping must not hide an explicit formula delimiter.
          if (
            (!strong && !uncertain) ||
            source[j] === "$" ||
            source.startsWith("\\(", j) ||
            source.startsWith("\\[", j)
          )
            return;
          return recover();
        }
        if (item.recoveryEnd !== undefined) return recover();
        if (item.contextual) {
          if (!item.infix || !hasOperand || pending) return recover();
          pending = true;
          pendingStrong = true;
          uncertain = true;
          j = ws(item.end);
          continue;
        }
        strong ||= item.strong || (pending && pendingStrong);
        uncertain ||= !!item.uncertain;
        invalid ||= !!item.invalid;
        hasOperand = true;
        pending = false;
        j = ws(item.end);
        while(source[j]==='!' && source[j+1]!=='='){j=ws(j+1);strong=true;}
        while (unicodeScriptEnd(source, j) > j) {
          j = ws(unicodeScriptEnd(source, j));
          strong = true;
        }
        if (/[+*/=<>_^\-]/.test(source[j] ?? "")) {
          uncertain = true;
          pending = true;
          pendingStrong = /[=<>_^]/.test(source[j]);
          j = ws(j + 1);
        }
      }
      invalid ||= pending;
      return { end, strong: strong && !invalid, uncertain, invalid };
    }
    if (CONSTANTS.has(SYMBOL_ALIASES[c])) return { end: i + 1, strong: true };
    if (/[0-9]/.test(c ?? "")) {
      if (single) return { end: i + 1, strong: false };
      while (/[0-9]/.test(source[i] ?? "")) i++;
      if (source[i] === "." && /[0-9]/.test(source[i + 1] ?? "")) {
        i++;
        while (/[0-9]/.test(source[i] ?? "")) i++;
      }
      return { end: i, strong: false };
    }
    if (
      /[A-Za-z]/.test(c ?? "") &&
      (single || !/[A-Za-z]/.test(source[i + 1] ?? ""))
    )
      return { end: i + 1, strong: false };
    if (GREEK_GLYPHS.has(c))
      return { end: i + c.length, strong: true };
    if (c !== "·" && Object.hasOwn(SYMBOL_ALIASES, c))
      return {
        end: i + c.length,
        strong: false,
        contextual: true,
        infix: INFIX.has(SYMBOL_ALIASES[c]),
      };
    if (c !== "\\") return;
    if(barCloses.has(i))return {end:barCloses.get(i)!,strong:true};
    const m = /^\\([A-Za-z]+)/.exec(source.slice(i, i + 128));
    if (!m) return;
    const name = m[1];
    i = ws(i + m[0].length);
    if(Object.hasOwn(DESCRIBED_SYMBOLS,name) || ['exists','exist','nexists'].includes(name))return {end:start+m[0].length,strong:true};
    if(Object.hasOwn(SYMBOL_COMMAND_ALIASES,name))return {end:start+m[0].length,strong:true};
    if(CONTEXTUAL_SYMBOLS.has(name))return {end:start+m[0].length,strong:false};
    if(name==='not') {
      const relation=negatedRelationAt(source,i,false);
      if(relation)return {end:relation.end,strong:false,contextual:true,infix:true};
      return;
    }
    if(name==='left' || /^(?:big|Big)g?l$/.test(name)) {
      const end=sizedCloses.get(start);
      if(end)return {end,strong:true};
      return;
    }
    if(name==='operatorname') {
      if(source[i]==='*')i=ws(i+1);
      if(source[i]!=='{')return;
      const end=closes.get(i);
      if(end)return {end,strong:true};
      return;
    }
    if(name==='hspace') {
      const distance=horizontalSpaceAt(source,i);
      if(distance)return {end:distance.end,strong:true};
      return;
    }
    if(Object.hasOwn(FONT_SIZE_NAMES,name)||Object.hasOwn(FONT_DECLARATIONS,name))return {end:i,strong:true};
    if(name==='color') {
      if(source[i]==='{'){
        const end=closes.get(i);
        if(end){const body=atom(ws(end),depth+1,true);return {end:body && !body.chemical?body.end:end,strong:true};}
      }
      return;
    }
    if(name==='eqno') {
      if(source[i]==='{'){const end=closes.get(i);if(end)return {end,strong:true};}
      return {end:i,strong:true};
    }
    if (name==='tag') {
      if (source[i]==='*') i=ws(i+1);
      if (source[i]!=='{') return;
      const end=closes.get(i);
      if(end)return {end,strong:true};
      return;
    }
    if(Object.hasOwn(LABELED_ARROW_COMMANDS,name)) {
      if(source[i]==='['){const lowerEnd=closes.get(i);if(!lowerEnd)return;i=ws(lowerEnd);}
      const label=atom(i,depth+1,true);
      if(!label || label.recoveryEnd!==undefined)return;
      const end=label.end,operand=atom(ws(end),depth+1);
      return {end:operand && !operand.contextual && !operand.invalid && operand.recoveryEnd===undefined?operand.end:end,strong:true};
    }
    if (name === "begin") {
      const env = /^\{([A-Za-z]+\*?)\}/.exec(source.slice(i, i + 64));
      const end = envCloses.get(start) ?? proseEnvCloses.get(start);
      if (env && ENVIRONMENTS.has(env[1]) && end) return { end, strong: true };
      return;
    }
    const fraction = ["frac", "dfrac", "tfrac", "binom", "dbinom", "tbinom",'overset','underset','stackrel','textcolor'].includes(name);
    if (
      fraction ||
      name === "sqrt" ||
      name === "ce" ||
      name === "text" ||
      name === "mbox" ||
      name === "textcircled" ||
      name === "boxed" ||
      name === 'substack' ||
      name === 'pmod' || name === 'pod' ||
      STYLES.has(name) || Object.hasOwn(PHANTOM_LAYOUTS,name) ||
      accents.has(name)
    ) {
      if (name === "sqrt" && source[i] === "[") {
        const end = closes.get(i);
        if (!end) return;
        i = ws(end);
      }
      const argumentStart=i;
      for (let n = 0; n < (fraction ? 2 : 1); n++) {
        if (["ce", "text", "mbox"].includes(name) && source[i] !== "{") return;
        const argument = atom(i, depth + 1, true);
        if (!argument || argument.recoveryEnd !== undefined) return;
        i = argument.end;
        if (n === 0 && fraction) i = ws(i);
      }
      let literalControl=false;
      if(['text','mbox'].includes(name)) {
        literalControl=[...source.slice(argumentStart+1,i-1)].some(c=>!!latinDiacritics(c)||Object.hasOwn(CYRILLIC_LETTER_NAMES,c)||Object.hasOwn(LATIN_LETTER_NAMES,c)||Object.hasOwn(ARABIC_CHARACTER_NAMES,c)||Object.hasOwn(DEVANAGARI_CHARACTER_NAMES,c));
        for(let at=argumentStart+1;at<i-1;at++) {
          if(source[at]!=='\\')continue;
          if('%{}$#_&'.includes(source[at+1] ?? '\0')) {literalControl=true;break;}
          if(/^\\(?:phantom|hphantom|vphantom)(?![A-Za-z])\s*\{/.test(source.slice(at,i))){literalControl=true;break;}
          if(source.startsWith('\\textcircled',at) && !/[A-Za-z]/.test(source[at+12] ?? '')) {
            let group=at+12;while(group<i && /\s/.test(source[group]))group++;
            if(source[group]==='{'){literalControl=true;break;}
          }
          at++;
        }
      }
      return {
        end: i,
        strong: !["text", "mbox"].includes(name) || literalControl,
        chemical: name === "ce",
      };
    }
    if (Object.hasOwn(FUNCTIONS, name) || NAMED_FUNCTION_COMMANDS.has(name)) {
      while (source[i] === "^" || source[i] === "_") {
        const script = atom(ws(i + 1), depth + 1, true);
        if (!script) return;
        i = ws(script.end);
      }
      const operand = atom(i, depth + 1);
      if (!operand || operand.recoveryEnd !== undefined) return;
      return { end: operand.end, strong: true };
    }
    if(['ell','imath','jmath'].includes(name))return {end:start+m[0].length,strong:true};
    if (Object.hasOwn(GREEK_COMMANDS, name))
      return { end: start + m[0].length, strong: true };
    if (Object.hasOwn(SYMBOLS, name))
      return {
        end: start + m[0].length,
        strong: CONSTANTS.has(name),
        contextual: !CONSTANTS.has(name),
        infix: INFIX.has(name),
      };
  };
  const scan = (start: number, atBoundary = false): Island | undefined => {
    if (!atBoundary && /[A-Za-z0-9_\\/:.]/.test(source[start - 1] ?? ""))
      return;
    const path =
      /^(?:[A-Za-z]:[\\/]|[A-Za-z][A-Za-z0-9+.-]*:\/\/|\\\\)[^\s，。；\p{Script=Han}]*/u.exec(
        source.slice(start),
      );
    if (path) return { end: start + path[0].length };
    const first = atom(start);
    if (!first) {
      if (source[start] !== "\\") return;
      const command = /^\\[A-Za-z]+/.exec(source.slice(start));
      if (!command) return;
      const name = command[0].slice(1);
      const known =
        [
          "frac",
          "dfrac",
          "tfrac",
          "binom", "dbinom", "tbinom",
          "sqrt",
          "ce",
          "begin",
          "text",
          "mbox",
          "left",
          "bigl", "Bigl", "biggl", "Biggl",
          "operatorname",
          "nobreak", "allowbreak",
          "tag",
        ].includes(name) ||
        STYLES.has(name) || Object.hasOwn(PHANTOM_LAYOUTS,name) ||
        accents.has(name) ||
        Object.hasOwn(FUNCTIONS, name) || NAMED_FUNCTION_COMMANDS.has(name);
      return {
        end: start + command[0].length,
        code: known ? "bare-incomplete-formula" : "bare-unknown-command",
      };
    }
    if (first.recoveryEnd !== undefined)
      return {
        end: first.end,
        code: "bare-ambiguous-formula",
        diagnosticEnd: first.recoveryEnd,
      };
    let end = first.end,
      strong = first.strong,
      uncertain = !!first.uncertain || source[start] === "\\",
      incomplete = !!first.invalid,
      ambiguousBoundary = false;
    let diagnosticEnd: number | undefined;
    if (first.chemical) return { end, kind: "chemistry" };
    for (;;) {
      let i = ws(end);
      if(i===end && source[i]==='!' && source[i+1]!=='=') {end=i+1;strong=true;continue;}
      const unicodeEnd = unicodeScriptEnd(source, i);
      if (unicodeEnd > i) {
        end = unicodeEnd;
        strong = true;
        continue;
      }
      if (source[i] === "^" || source[i] === "_") {
        const scriptStart = ws(i + 1);
        const operand = atom(scriptStart, 0, source[scriptStart] === "{");
        if (!operand || operand.recoveryEnd !== undefined) {
          uncertain = true;
          incomplete = true;
          diagnosticEnd = i + 1;
          break;
        }
        end = operand.end;
        strong = true;
        continue;
      }
      if (/[+\-*/=<>]/.test(source[i] ?? "")) {
        const operator = source[i++];
        const operand = atom(ws(i));
        if (
          !operand ||
          operand.chemical ||
          operand.contextual ||
          operand.invalid
        ) {
          uncertain = true;
          incomplete = true;
          diagnosticEnd = i;
          break;
        }
        end = operand.end;
        uncertain = true;
        strong ||=
          operand.strong || source[start] === "\\" || /[=<>]/.test(operator);
        continue;
      }
      // Unicode operators use the same known infix rules as their TeX names.
      if (source[i] !== "·" && INFIX.has(SYMBOL_ALIASES[source[i]] ?? DESCRIBED_SYMBOL_ALIASES[source[i]])) {
        const right = atom(ws(i + 1));
        if (right && !right.chemical && !right.contextual && !right.invalid) {
          end = right.end;
          strong = true;
          continue;
        }
        uncertain = true;
        incomplete = true;
        diagnosticEnd = i + 1;
        break;
      }
      // Known infix commands require a following operand, never just a name prefix.
      if (source[i] === "\\") {
        const command = /^\\([A-Za-z]+)/.exec(source.slice(i));
        const negation=command?.[1]==='not' ? negatedRelationAt(source,i+command[0].length,false):undefined;
        if (command && (INFIX.has(command[1]) || negation)) {
          const right = atom(ws(negation?.end ?? i + command[0].length));
          if (right && !right.chemical && !right.contextual && !right.invalid) {
            end = right.end;
            strong = true;
            continue;
          }
          uncertain = true;
          incomplete = true;
          diagnosticEnd = i + command[0].length;
          break;
        }
        const next = atom(i);
        if (next?.strong && !next.chemical) {
          end = next.end;
          strong = true;
          continue;
        }
      }
      // Direct adjacency is implicit multiplication only between complete atoms.
      // A candidate may acquire its strong evidence later (2x^2); plain words
      // cannot become letter sequences because atom() rejects multi-letter runs.
      if (i === end) {
        const next = atom(i);
        if (next?.recoveryEnd !== undefined) {
          incomplete = true;
          uncertain = true;
          diagnosticEnd = next.recoveryEnd;
          break;
        }
        if (next && !next.chemical && !next.contextual) {
          end = next.end;
          strong ||= next.strong;
          uncertain ||= !!next.uncertain;
          incomplete ||= !!next.invalid;
          continue;
        }
        if (strong && /[A-Za-z]/.test(source[i] ?? "")) {
          ambiguousBoundary = true;
          diagnosticEnd = i + /^[A-Za-z]+/.exec(source.slice(i))![0].length;
        }
      }
      break;
    }
    return {
      end,
      kind: strong ? "bare-math" : undefined,
      diagnosticEnd,
      code: ambiguousBoundary
        ? "bare-ambiguous-boundary"
        : strong && incomplete
          ? "bare-incomplete-expression"
          : !strong && uncertain
            ? "bare-ambiguous-formula"
            : undefined,
    };
  };
  return { scan, paragraphEnd: (at: number) => paragraphEnds[at] };
}
