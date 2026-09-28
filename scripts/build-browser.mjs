import { build } from "vite";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
await build({
  configFile: false,
  envDir: false,
  build: {
    outDir: "dist/browser",
    emptyOutDir: true,
    lib: {
      entry: "apps/playground/src/library.ts",
      formats: ["es"],
      fileName: () => "horizon.js",
      cssFileName: "horizon",
    },
    minify: false,
  },
});
await mkdir("dist/browser/types", { recursive: true });
execFileSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", "tsconfig.browser.json"],
  { stdio: "inherit" },
);
execFileSync(process.execPath, ["scripts/verify-browser-types.mjs"], { stdio: "inherit" });
await writeFile(
  "dist/browser/THIRD-PARTY-NOTICES.txt",
  "pinyin-pro 3.29.4\n\n" +
    (await readFile("node_modules/pinyin-pro/LICENSE", "utf8")),
);
await writeFile(
  "dist/browser/package.json",
  JSON.stringify(
    {
      name: "@simpletex/horizon-browser",
      version: "0.1.0",
      private: true,
      type: "module",
      main: "./horizon.js",
      types: "./types/apps/playground/src/library.d.ts",
      exports: {
        ".": {
          types: "./types/apps/playground/src/library.d.ts",
          default: "./horizon.js",
        },
        "./style.css": "./horizon.css",
      },
    },
    null,
    2,
  ) + "\n",
);
// Source archives and a new independent repository may have no Git metadata yet.
let sha = null;
let sourceTreeDirty = null;
try {
  sha = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  sourceTreeDirty = !!execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch { /* Null provenance explicitly indicates unavailable Git metadata. */ }
const files = {};
async function inventory(dir = "") {
  for (const entry of await readdir("dist/browser/" + dir, {
    withFileTypes: true,
  })) {
    const name = dir + entry.name;
    if (entry.isDirectory()) await inventory(name + "/");
    else if (name !== "artifact.json") {
      // Deterministic text bytes on Windows and POSIX, including upstream notice newlines.
      const data = Buffer.from(
        (await readFile("dist/browser/" + name, "utf8")).replace(/\r\n/g, "\n"),
      );
      await writeFile("dist/browser/" + name, data);
      files[name] = {
        sha256: createHash("sha256").update(data).digest("hex"),
        bytes: data.length,
      };
    }
  }
}
await inventory();
await writeFile(
  "dist/browser/artifact.json",
  JSON.stringify(
    {
      package: "simpletex-braille",
      version: "0.1.0",
      sourceCommit: sha,
      sourceTreeDirty,
      command: "npm ci && npm run build:browser",
      files,
    },
    null,
    2,
  ) + "\n",
);
