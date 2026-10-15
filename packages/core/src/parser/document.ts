import { formulaScanner } from "./formula-islands";
import {emphasisMarkers,type EmphasisMarker} from './markdown-emphasis';
import type { Document, MathNode, NodeBase } from "../model";

/** Scan at most this many UTF-16 code units; oversized sources remain intact. */
export const MAX_SOURCE_LENGTH = 100_000;
/** Explicit source markers only; a bounded prefix scan, with no source rewrite. */
function quotePrefix(source:string,start:number,end:number,limit=Infinity):{end:number;level:number;indent:number}|undefined {
 let at=start,level=0,indent=0;
 while(level<limit){let probe=at,count=0;while(source[probe]===' '&&count<3){probe++;count++;}
  if(probe>=end||source[probe]!=='>')break;
  if(!level)indent=count;at=probe+1;level++;
  if(source[at]===' '||source[at]==='\t')at++;
 }
 return level?{end:at,level,indent}:undefined;
}

/**
 * Lossless, nonrecursive document scan. Delimiters do not nest. A matching close
 * ends math; other delimiters inside it remain raw TeX for the domain parser.
 * Each code unit is examined a constant number of times (O(n) time and space).
 */
export function parseDocument(
  source: string,
  options: { recognizeBare?: boolean; literalText?: boolean;recognizeCode?:boolean;recognizeMarkers?:boolean;recognizeEmphasis?:boolean } = {},
): Document {
  const doc: Document = { source, nodes: [], diagnostics: [] };
  const base = (start: number, end: number): NodeBase => ({
    id: `node-${doc.nodes.length}`,
    span: { start, end },
    raw: source.slice(start, end),
  });
  if (source.length > MAX_SOURCE_LENGTH) {
    doc.nodes.push({
      ...base(0, source.length),
      kind: "unparsed",
      reason: "resource-limit",
    });
    doc.diagnostics.push({
      code: "resource-limit",
      severity: "error",
      span: { start: 0, end: source.length },
      message: `Document exceeds the ${MAX_SOURCE_LENGTH} UTF-16 code unit scan limit; source is preserved without parsing.`,
    });
    return doc;
  }

  let emphasis=new Map<number,EmphasisMarker>(),scanSource=source;
  if(!options.literalText&&options.recognizeMarkers!==false&&options.recognizeEmphasis!==false&&/[*_]/.test(source)){
    const paired=emphasisMarkers(source,parseDocument(source,{...options,recognizeEmphasis:false}));emphasis=paired.markers;
    if(paired.limited)doc.diagnostics.push({code:'markdown-emphasis-resource-limit',severity:'warning',span:{start:0,end:source.length},message:'Emphasis pairing budget reached; unmatched source remains visible for review.'});
    if(emphasis.size){const units=source.split('');for(const [start,marker] of emphasis)for(let at=start;at<marker.end;at++)units[at]='\n';scanSource=units.join('');}
  }
  const islands = formulaScanner(scanSource);
  const nextTickRun=new Map<number,{start:number;length:number}>();
  const lastTickRun=new Map<number,number>();
  const headingEnds=new Map<number,number>();
  let headingLineEnd:number|undefined;
  let quoteBodyStart:number|undefined,quoteLevel=0;
  const blockStarts=new Set<number>();
  for(const match of source.matchAll(/^([^\r\n]*)(?:\r\n|\r|\n|$)/gm)){
    const line=match[1];
    const fence=/^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/.exec(line);
    if(fence && !(fence[1][0]==='`' && fence[2].includes('`')) || options.recognizeMarkers!==false && (
      /^ {0,3}>/.test(line) || /^ {0,3}#{1,6}(?=[ \t]|$)/.test(line) || /^ {0,3}(?:\d{1,9}[.)]|[-+*])(?:[ \t]|$)/.test(line) ||
      /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(line)))blockStarts.add(match.index);
  }
  const nextBlockStart=new Uint32Array(source.length+1);let blockEnd=source.length;
  for(let at=source.length;at>=0;at--){if(blockStarts.has(at))blockEnd=at;nextBlockStart[at]=blockEnd;}
  const tickRuns=Array.from(source.matchAll(/`+/g));
  for(let j=tickRuns.length-1;j>=0;j--){const match=tickRuns[j],next=lastTickRun.get(match[0].length);if(next!==undefined)nextTickRun.set(match.index,{start:next,length:match[0].length});lastTickRun.set(match[0].length,match.index);}
  let cursor = 0;
  let textStart = 0;
  const flushText = () => {
    if (textStart < cursor) {
      doc.nodes.push({
        ...base(textStart, cursor),
        kind: "text",
        text: source.slice(textStart, cursor),
      });
    }
  };
  const newlineWidth = (at: number) =>
    source[at] === "\r"
      ? source[at + 1] === "\n"
        ? 2
        : 1
      : source[at] === "\n"
        ? 1
        : 0;

  while (cursor < source.length) {
    if(headingLineEnd!==undefined && cursor>=headingLineEnd)headingLineEnd=undefined;
    const start = cursor;
    const char = source[cursor];
    const next = source[cursor + 1];
    const lineWidth = newlineWidth(cursor);
    if (lineWidth) {
      quoteBodyStart=undefined;quoteLevel=0;
      flushText();
      cursor += lineWidth;
      let count = 1;
      // Blank lines may contain spaces/tabs. Whitespace after the final newline
      // belongs to the following text and must not be consumed here.
      while (cursor < source.length) {
        let probe = cursor;
        while (source[probe] === " " || source[probe] === "\t") probe++;
        const width = newlineWidth(probe);
        if (!width) break;
        cursor = probe + width;
        count++;
      }
      doc.nodes.push(
        count === 1
          ? { ...base(start, cursor), kind: "line-break", count: 1 }
          : { ...base(start, cursor), kind: "paragraph-break", count },
      );
      textStart = cursor;
      continue;
    }
    if (options.literalText) {
      cursor++;
      continue;
    }
    if(options.recognizeMarkers!==false && (cursor===0 || /[\r\n]/.test(source[cursor-1]))) {
      let end=cursor;while(end<source.length&&!newlineWidth(end))end++;
      const prefix=quotePrefix(source,cursor,end);
      if(prefix){flushText();doc.nodes.push({...base(cursor,prefix.end),kind:'markdown-marker',role:'blockquote',indent:prefix.indent,level:prefix.level});cursor=prefix.end;textStart=cursor;quoteBodyStart=cursor;quoteLevel=prefix.level;continue;}
    }
    if(options.recognizeCode!==false && (cursor===0 || /[\r\n]/.test(source[cursor-1]) || cursor===quoteBodyStart)) {
      const opening=/^ {0,3}(`{3,}|~{3,})([^\r\n]*)(?:\r\n|\r|\n|$)/.exec(source.slice(cursor));
      if(opening && !(opening[1][0]==='`' && opening[2].includes('`'))) {
        flushText();const contentStart=cursor+opening[0].length;
        const closePattern=new RegExp('^ {0,3}'+opening[1][0]+'{'+opening[1].length+',}[ \\t]*$');
        let probe=contentStart,contentEnd=source.length,end=source.length,closed=false;
        const quoteLinePrefixes:{span:{start:number;end:number};level:number}[]=[];
        const quoted=cursor===quoteBodyStart?quoteLevel:0;
        while(probe<source.length){let lineEnd=probe;while(lineEnd<source.length && !newlineWidth(lineEnd))lineEnd++;
          const prefix=quoted?quotePrefix(source,probe,lineEnd,quoted):undefined;
          if(quoted&&prefix?.level!==quoted){contentEnd=probe;end=probe;break;}
          const bodyStart=prefix?.end??probe;
          if(closePattern.test(source.slice(bodyStart,lineEnd))){contentEnd=probe;end=lineEnd+newlineWidth(lineEnd);closed=true;break;}
          if(prefix)quoteLinePrefixes.push({span:{start:probe,end:prefix.end},level:quoted});
          probe=lineEnd+newlineWidth(lineEnd);
        }
        const infoStart=cursor+opening[0].indexOf(opening[1])+opening[1].length;
        doc.nodes.push({...base(cursor,end),kind:'code-block',content:source.slice(contentStart,contentEnd),contentSpan:{start:contentStart,end:contentEnd},openingSpan:{start:cursor,end:contentStart},closingSpan:{start:contentEnd,end},closed,info:opening[2],infoSpan:{start:infoStart,end:infoStart+opening[2].length},...(quoted?{quoteLinePrefixes}:{})});
        if(quoted&&!closed)doc.diagnostics.push({code:'markdown-quoted-code-unclosed',severity:'warning',span:{start:cursor,end},message:'Quoted code fence has no matching close before its container ends; literal content and following document retained.'});
        cursor=end;textStart=cursor;continue;
      }
    }
    if(options.recognizeMarkers!==false && headingEnds.has(cursor)){
      flushText();const end=headingEnds.get(cursor)!;
      doc.nodes.push({...base(cursor,end),kind:'markdown-marker',role:'heading-end',indent:0});cursor=end;textStart=cursor;continue;
    }
    if(options.recognizeMarkers!==false && (cursor===0 || /[\r\n]/.test(source[cursor-1]) || cursor===quoteBodyStart)) {
      let end=cursor;while(end<source.length && !newlineWidth(end))end++;
      const line=source.slice(cursor,end);
      const separator=/^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(line);
      const heading=/^( {0,3})(#{1,6})(?=[ \t]|$)[ \t]*/.exec(line);
      const item=/^( {0,3})(?:(\d{1,9})[.)]|([-+*]))(?:[ \t]+|$)/.exec(line);
      if(separator||heading||item){
        const closing=heading?/[ \t]+#+[ \t]*$/.exec(line):undefined;
        flushText();const length=separator?line.length:heading?Math.min(heading[0].length,closing?.index??heading[0].length):item![0].length;
        doc.nodes.push({...base(cursor,cursor+length),kind:'markdown-marker',role:separator?'separator':heading?'heading':'list-item',indent:separator?0:(heading??item)![1].length,
          ...(heading?{level:heading[2].length}:item?.[2]?{ordinal:item[2]}:item?.[3]?{bullet:item[3]}:{})});
        if(heading){headingLineEnd=end;if(closing)headingEnds.set(cursor+closing.index,end);}
        cursor+=length;textStart=cursor;continue;
      }
    }
    if(emphasis.has(cursor)){
      const marker=emphasis.get(cursor)!;flushText();doc.nodes.push({...base(cursor,marker.end),kind:'markdown-marker',role:marker.role,indent:0});cursor=marker.end;textStart=cursor;continue;
    }
    if(options.recognizeCode!==false && char==='`' && nextTickRun.has(cursor) &&
      nextTickRun.get(cursor)!.start<Math.min(islands.paragraphEnd(cursor),nextBlockStart[cursor+1]??source.length,headingLineEnd??source.length)) {
      const close=nextTickRun.get(cursor)!;flushText();const contentStart=cursor+close.length,end=close.start+close.length;
      doc.nodes.push({...base(cursor,end),kind:'code-span',content:source.slice(contentStart,close.start),contentSpan:{start:contentStart,end:close.start},openingSpan:{start:cursor,end:contentStart},closingSpan:{start:close.start,end},closed:true});
      cursor=end;textStart=cursor;continue;
    }
    if (char === "\\" && (next === "\\" || next === "$" || options.recognizeCode!==false && next==='`' || options.recognizeMarkers!==false&&'*_'.includes(next??'\0'))) {
      flushText();
      cursor += 2;
      doc.nodes.push({
        ...base(start, cursor),
        kind: "escaped-text",
        text: next,
      });
      textStart = cursor;
      continue;
    }

    let open: MathNode["openDelimiter"] | undefined;
    let close: Exclude<MathNode["closeDelimiter"], null> | undefined;
    if (char === "$") {
      open = next === "$" ? "$$" : "$";
      close = open;
    } else if (char === "\\" && (next === "(" || next === "[")) {
      open = next === "(" ? "\\(" : "\\[";
      close = next === "(" ? "\\)" : "\\]";
    }
    if (open && close) {
      flushText();
      cursor += open.length;
      const contentStart = cursor;
      const limit = islands.paragraphEnd(cursor);
      let braceDepth=0;
      while (cursor < limit) {
        // A text command may contain its own inline math. The outer delimiter
        // cannot close inside a balanced TeX argument such as \text{… $x$ …}.
        if(braceDepth===0 && source.startsWith(close,cursor))break;
        if(source[cursor]==='{')braceDepth++;
        else if(source[cursor]==='}' && braceDepth>0)braceDepth--;
        // Paired backslashes escape each other; an odd backslash protects the
        // next delimiter character, including dollars and closing brackets.
        cursor += source[cursor] === "\\" && cursor + 1 < limit ? 2 : 1;
      }
      const contentEnd = cursor;
      const closed = cursor < limit;
      if (closed) cursor += close.length;
      doc.nodes.push({
        ...base(start, cursor),
        kind: open === "$$" || open === "\\[" ? "display-math" : "inline-math",
        content: source.slice(contentStart, contentEnd),
        contentSpan: { start: contentStart, end: contentEnd },
        openDelimiter: open,
        closeDelimiter: closed ? close : null,
        closed,
      });
      if (
        open === "$" &&
        /^\s*\d/.test(source.slice(contentStart, contentEnd)) &&
        (!closed || (/[A-Za-z]{2,}/.test(source.slice(contentStart, contentEnd)) && !/\\[A-Za-z]+|[_^=<>]/.test(source.slice(contentStart,contentEnd))))
      )
        doc.diagnostics.push({
          code: "ambiguous-dollar-number",
          severity: "warning",
          span: { start, end: cursor },
          message:
            "Dollar-number input may be currency. Explicit delimiter interpretation is retained; escape literal dollars as \\$.",
        });
      if (!closed)
        doc.diagnostics.push({
          code: "unclosed-math",
          severity: "error",
          span: { start, end: cursor },
          message: `Math opened with ${open} has no matching ${close}.`,
        });
      textStart = cursor;
      continue;
    }
    const island =
      options.recognizeBare === false
        ? undefined
        : islands.scan(cursor, cursor === textStart);
    if (island) {
      if (island.kind) {
        flushText();
        cursor = island.end;
        doc.nodes.push({
          ...base(start, cursor),
          kind: island.kind,
          content: source.slice(start, cursor),
          contentSpan: { start, end: cursor },
        });
        textStart = cursor;
      } else if (island.code && island.code !== "bare-ambiguous-formula") {
        flushText();
        cursor = island.end;
        doc.nodes.push({
          ...base(start, cursor),
          kind: "unparsed",
          reason: "ambiguous-formula",
        });
        textStart = cursor;
      } else cursor = island.end;
      if (island.code)
        doc.diagnostics.push({
          code: island.code,
          severity: "warning",
          span: { start, end: island.diagnosticEnd ?? cursor },
          message:
            "Bare formula syntax cannot be interpreted safely; original source retained. Use an explicit domain for ambiguous input.",
        });
      continue;
    }
    if (char === "\\" && (next === ")" || next === "]")) {
      doc.diagnostics.push({
        code: "unexpected-math-close",
        severity: "error",
        span: { start, end: start + 2 },
        message: `Closing delimiter \\${next} has no matching opening delimiter.`,
      });
      cursor += 2;
    } else cursor++;
  }
  flushText();
  return doc;
}
