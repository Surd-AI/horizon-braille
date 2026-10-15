// Input is a private, read-only backend export. Do not commit customer samples.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {convert} from '../dist/browser/horizon.js';
const [input,output,privateFailuresFile]=process.argv.slice(2);
if(!input || !output)throw new Error('Usage: node scripts/audit-backend-corpus.mjs private-samples.json aggregate-report.json [private-failures.json]');
if(fs.statSync(input).size>256*1024*1024)throw new Error('Corpus exceeds 256 MiB');
const corpus=JSON.parse(fs.readFileSync(input,'utf8').replace(/^\uFEFF/,''));
if(!Array.isArray(corpus.samples) || corpus.samples.length>100000)throw new Error('Expected at most 100000 samples');
const counters=()=>({samples:0,complete:0,partial:0,fontDescriptionInputs:0,fontDescriptionFields:0,completeWithFontDescriptions:0,symbolDescriptionInputs:0,symbolDescriptionFields:0,completeWithSymbolDescriptions:0,literalGlyphDescriptionInputs:0,literalGlyphDescriptionFields:0,completeWithLiteralGlyphDescriptions:0,exceptions:0,unpagedPreviews:0,empty:0,sourceChanged:0,invalidDocumentSpans:0,invalidAtomSpans:0,invalidDiagnosticSpans:0,invalidUnhandledSpans:0,previewTruncated:0,diagnosticCounts:{}});
const report={sampledRecords:corpus.scanned,uniqueInputs:corpus.samples.length,skippedRecords:corpus.skipped ?? 0,skippedReasons:corpus.skippedReasons ?? {},duplicateRecords:corpus.duplicates,sourceLimits:{latex:5000,markdown:20000},columns:30,engineHash:createHash('sha256').update(fs.readFileSync(new URL('../dist/browser/horizon.js',import.meta.url))).digest('hex'),...counters(),byFormat:{},markdownFeatures:{},warning:'Conversion completeness is not independently verified braille accuracy or Markdown structural support. Markdown is tested through the document input mode. Raw samples and user metadata are excluded.'};
const failures=[];
const features={headings:/^ {0,3}#{1,6}\s/m,lists:/^\s*(?:[-*+]\s|\d+[.)]\s)/m,tables:/^\s*\|.*\|/m,links:/\[[^\]]+\]\([^\n)]+\)/,images:/!\[[^\]]*\]\([^\n)]+\)/,fencedCode:/^\s*(?:```|~~~)/m,inlineCode:/`[^`\n]+`/,mathDelimiters:/\$|\\[([]/,chinese:/\p{Script=Han}/u,multiline:/\n/};
const started=Date.now();
for(const sample of corpus.samples){
 const {source}=sample,format=sample.format ?? (sample.contentType==='mix_doc'?'markdown':'latex');
 if(!Object.hasOwn(report.sourceLimits,format) || typeof source!=='string' || source.length>report.sourceLimits[format])throw new Error('Invalid corpus sample');
 const category=report.byFormat[format] ??= {...counters(),conversionMode:format==='latex'?'math':'document'};
 const buckets=[report,category];for(const bucket of buckets)bucket.samples++;
 if(format==='markdown')for(const [key,pattern] of Object.entries(features))if(pattern.test(source))report.markdownFeatures[key]=(report.markdownFeatures[key]||0)+1;
 let r;
 try{r=convert(source,{mode:category.conversionMode,columns:30,paragraphIndent:0});}
 catch(error){for(const bucket of buckets){bucket.exceptions++;bucket.partial++;}if(privateFailuresFile)failures.push({...sample,format,exception:String(error?.name ?? 'Error')});continue;}
 for(const bucket of buckets){
  bucket[r.complete?'complete':'partial']++;
  const fontFields=r.diagnostics.filter(d=>d.code==='math-font-described').length;
  bucket.fontDescriptionFields+=fontFields;
  if(fontFields){bucket.fontDescriptionInputs++;if(r.complete)bucket.completeWithFontDescriptions++;}
  const symbolFields=r.diagnostics.filter(d=>d.code==='math-symbol-described').length;
  bucket.symbolDescriptionFields+=symbolFields;
  if(symbolFields){bucket.symbolDescriptionInputs++;if(r.complete)bucket.completeWithSymbolDescriptions++;}
  const glyphFields=r.diagnostics.filter(d=>['text-latin-described','text-number-form-described','text-cyrillic-letter-described','text-latin-identity-letter-described','text-unicode-space-described','text-arabic-character-described','text-devanagari-character-described','math-greek-variant-described'].includes(d.code)).length;
  bucket.literalGlyphDescriptionFields+=glyphFields;
  if(glyphFields){bucket.literalGlyphDescriptionInputs++;if(r.complete)bucket.completeWithLiteralGlyphDescriptions++;}
  if(r.preview?.unicode)bucket.unpagedPreviews++;
  if(!r.unicode && !r.preview?.unicode && source.trim())bucket.empty++;
  if(r.document.source!==source)bucket.sourceChanged++;
  if(r.preview?.truncated)bucket.previewTruncated++;
  let cursor=0;
  for(const node of r.document.nodes){if(node.span.start!==cursor || node.span.end<node.span.start || source.slice(node.span.start,node.span.end)!==node.raw)bucket.invalidDocumentSpans++;cursor=node.span.end;}
  if(cursor!==source.length)bucket.invalidDocumentSpans++;
  for(const atom of r.atoms)if(atom.span.start<0 || atom.span.end>source.length || atom.span.start>atom.span.end)bucket.invalidAtomSpans++;
  for(const d of r.diagnostics)if(d.span.start<0 || d.span.end>source.length || d.span.start>d.span.end)bucket.invalidDiagnosticSpans++;
  for(const u of r.unhandled)if(u.span.start<0 || u.span.end>source.length || source.slice(u.span.start,u.span.end)!==u.raw)bucket.invalidUnhandledSpans++;
  for(const d of r.diagnostics)if(d.severity!=='info')bucket.diagnosticCounts[d.code]=(bucket.diagnosticCounts[d.code]||0)+1;
 }
 if(!r.complete && privateFailuresFile)failures.push({...sample,format,diagnostics:r.diagnostics.filter(d=>d.severity!=='info')});
 if(report.samples%10000===0)process.stderr.write(JSON.stringify({processed:report.samples,total:corpus.samples.length,complete:report.complete,partial:report.partial})+'\n');
}
report.elapsedMs=Date.now()-started;
report.uniqueFormulas=report.byFormat.latex?.samples ?? 0;
fs.writeFileSync(output,JSON.stringify(report,null,2));
if(privateFailuresFile)fs.writeFileSync(privateFailuresFile,JSON.stringify(failures));
console.log(JSON.stringify({...report,diagnosticCounts:undefined,byFormat:Object.fromEntries(Object.entries(report.byFormat).map(([k,v])=>[k,{...v,diagnosticCounts:undefined}]))},null,2));
if(report.exceptions || report.empty || report.sourceChanged || report.invalidDocumentSpans || report.invalidAtomSpans || report.invalidDiagnosticSpans || report.invalidUnhandledSpans || report.previewTruncated)process.exitCode=1;
