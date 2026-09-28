import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// Only generated core output is replaced; optional demo artifacts are independent.
const outputRoot = resolve("dist");
const coreOutput = resolve(outputRoot, "core");
if (dirname(coreOutput) !== outputRoot) throw new Error("Core output escaped dist");
await rm(coreOutput, { recursive: true, force: true });
for (const [directory, module, resolution, type] of [
  ["esm", "ESNext", "Bundler", "module"],
  ["cjs", "CommonJS", "Node", "commonjs"],
]) {
  const outDir = `dist/core/${directory}`;
  execFileSync(process.execPath, [
    "node_modules/typescript/bin/tsc", "-p", "tsconfig.core.json",
    "--module", module, "--moduleResolution", resolution, "--outDir", outDir,
  ], { stdio: "inherit" });
  // Node ESM and strict NodeNext consumers require explicit relative extensions.
  async function fixImports(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const path = `${dir}/${item.name}`;
      if (item.isDirectory()) await fixImports(path);
      else if (item.name.endsWith(".js") || item.name.endsWith(".d.ts")) {
        const source = await readFile(path, "utf8");
        await writeFile(path, source.replace(
          /(\bfrom\s+["']|\bimport\s*["'])(\.{1,2}\/[^"']+)(["'])/g,
          (_, prefix, specifier, quote) => `${prefix}${specifier.endsWith(".js") ? specifier : specifier + ".js"}${quote}`,
        ));
      }
    }
  }
  await fixImports(outDir);
  await mkdir(outDir, { recursive: true });
  await writeFile(`${outDir}/package.json`, JSON.stringify({ type }) + "\n");
}
console.log("Built pure core ESM, CommonJS and declarations in dist/core.");
