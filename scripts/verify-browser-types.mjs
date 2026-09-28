import ts from "typescript";
import { resolve } from "node:path";
const entry = resolve(process.argv[2] ?? "dist/browser/types/apps/playground/src/library.d.ts");
const program = ts.createProgram([entry], {
  noEmit: true,
  strict: true,
  skipLibCheck: false,
  resolveJsonModule: true,
  esModuleInterop: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  types: [],
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
});
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: name => name,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  }));
  process.exitCode = 1;
} else console.log("Browser distribution declarations typecheck passed (skipLibCheck:false): " + entry);
