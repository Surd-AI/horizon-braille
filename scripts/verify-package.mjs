import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const root = process.cwd();
const npm = process.env.npm_execpath;
assert(npm, "Run this check with npm run test:package");
const temporary = await mkdtemp(join(tmpdir(), "simpletex-braille-package-"));
const run = (args, cwd = temporary) => execFileSync(process.execPath, args, {
  cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
});
try {
  const packOutput = run([npm, "pack", "--silent", "--json", "--pack-destination", temporary], root);
  // npm forwards prepack lifecycle stdout before the JSON report.
  const packed = JSON.parse(packOutput.slice(packOutput.indexOf("[")))[0];
  const names = packed.files.map(file => file.path);
  for (const file of names) assert(
    file.startsWith("dist/core/") || ["package.json", "README.md", "README.en.md", "LICENSE", "NOTICE", "THIRD-PARTY-NOTICES.md"].includes(file),
    `Unexpected package content: ${file}`,
  );
  for (const file of ["dist/core/esm/index.js", "dist/core/cjs/index.js", "dist/core/esm/index.d.ts", "dist/core/cjs/index.d.ts", "README.md", "README.en.md", "LICENSE", "NOTICE", "THIRD-PARTY-NOTICES.md"])
    assert(names.includes(file), `Missing package content: ${file}`);
  await writeFile(join(temporary, "package.json"), JSON.stringify({ private: true }));
  const sourceManifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  run([npm, "install", "--ignore-scripts", "--no-audit", "--no-fund", join(temporary, packed.filename), `@types/node@${sourceManifest.devDependencies["@types/node"]}`]);
  const guard = `
    for (const name of ['fetch', 'Worker', 'document', 'window']) {
      Object.defineProperty(globalThis, name, {configurable: true, get() { throw new Error('Core accessed ' + name); }});
    }
  `;
  const assertion = `
    if (typeof core.convert !== 'function') throw new Error('Missing public convert');
    const result = core.convert('中国', {mode: 'text'});
    if (!result.unicode || typeof result.complete !== 'boolean' || !Array.isArray(result.diagnostics)) throw new Error('Conversion failed');
    console.log(result.unicode);
  `;
  await writeFile(join(temporary, "consumer.mjs"), guard + `const core = await import('simpletex-braille');` + assertion);
  await writeFile(join(temporary, "consumer.cjs"), guard + `const core = require('simpletex-braille');` + assertion);
  const esm = run(["consumer.mjs"]);
  const cjs = run(["consumer.cjs"]);
  assert.equal(esm, cjs, "ESM and CommonJS conversion outputs differ");
  const tsSource = `import { convert, type ConvertOptions, type UnifiedConversionResult } from 'simpletex-braille';
const options: ConvertOptions = { mode: 'text' };
const result: UnifiedConversionResult = convert('中国', options);
const unicode: string = result.unicode;
void unicode;
`;
  await writeFile(join(temporary, "consumer.mts"), tsSource);
  await writeFile(join(temporary, "consumer.cts"), tsSource);
  for (const environment of [
    { name: "browser", types: [], lib: ["ES2022", "DOM"] },
    { name: "node", types: ["node"], lib: ["ES2022"] },
  ]) {
  await writeFile(join(temporary, "tsconfig.json"), JSON.stringify({
    compilerOptions: { strict: true, skipLibCheck: false, noEmit: true,
      target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", types: environment.types, lib: environment.lib },
    files: ["consumer.mts", "consumer.cts"],
  }));
  run([resolve(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"]);
  console.log(`Strict ${environment.name} declarations passed.`);
  }
  const manifest = JSON.parse(await readFile(join(temporary, "node_modules/simpletex-braille/package.json"), "utf8"));
  assert.equal(manifest.license, "Apache-2.0");
  console.log(`Package passed: ${packed.filename}; ${names.length} files; ESM + CommonJS runtime, no browser/network access, strict NodeNext declarations.`);
} catch (error) {
  if (error.stdout) console.error(error.stdout.toString());
  if (error.stderr) console.error(error.stderr.toString());
  throw error;
} finally {
  assert.equal(dirname(resolve(temporary)), resolve(tmpdir()), "Unsafe cleanup parent");
  assert(basename(temporary).startsWith("simpletex-braille-package-"), "Unsafe cleanup target");
  await rm(temporary, { recursive: true, force: true });
}
