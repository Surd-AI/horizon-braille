# Third-party notices

The project's Apache-2.0 license does not replace third-party licenses.

## pinyin-pro 3.29.4 — MIT

Upstream: https://github.com/zh-lx/pinyin-pro . Runtime Chinese reading/segmentation proposals use this dependency. packages/core/src/language/reading-inventory.ts is generated from its dictionary by scripts/generate-reading-inventory.mjs; this notice applies to that derived inventory too. Browser distributions bundle pinyin-pro and retain its MIT notice. The core npm package declares pinyin-pro as a dependency.

The license below is copied verbatim from the installed pinyin-pro 3.29.4 LICENSE:

```text
MIT License

Copyright (c) 2022-present zh-lx

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Development dependencies

TypeScript is Apache-2.0; Vite, Vitest, fast-check and @types/node are MIT; Playwright is Apache-2.0. These are build/test tools, not additional bundled core runtime dependencies. Their transitive dependencies retain their own installed license files; consult the committed lockfile for exact versions. Do not assume all dependencies use the project's license.

## Standards and historical evidence

Official GF/GB standards and scans are not relicensed under Apache-2.0. Original scans/viewer images are not redistributed. Links, edition identifiers, clause locators and captured hashes are recorded in standards/ and fixtures. Historical observation JSON is comparison evidence, not a redistributed legacy implementation or a standards certification. Original historical source hashes are retained even though those sources are absent from this repository.
