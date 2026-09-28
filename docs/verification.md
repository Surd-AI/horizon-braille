# Reproducing validation

Use Node 22.13+ (CI: 22/24), the committed lockfile and a clean checkout:

~~~sh
npm ci
npm test
npm run typecheck
npm run verify:coverage
npm run build
npm run test:package
npm run example
npm run build:api
npm run build:playground
npm run build:browser
~~~

npm test runs unit/core/API tests without requiring a browser. For the real Worker/editor flows:

~~~sh
npx playwright install chromium
npm run test:browser
~~~

The browser suite uses a fresh headless browser context. EDGE_PATH and PLAYWRIGHT_MODULE may select an existing local browser/module; no personal default path is required. HORIZON_AUDIT_DIR may select screenshot output. Tests use synthetic API responses and their own loopback servers; no live paid-provider request is part of CI. npm run test:all includes both unit and browser suites.

Package verification installs the generated tarball into an independent temporary project and checks ESM, CommonJS and strict NodeNext TypeScript consumption. This validates the distributable entry points without relying on a source checkout. Build artifacts and test reports are generated locally, not inherited proof from an earlier private project.

The coverage gate validates recorded rule-evidence relationships, not line/branch coverage or complete standards compliance. The registry is incomplete and only five narrow rules are verified. Official scans and historical probe executables are absent; fixture/provenance tests do not recreate their original capture or visual review. Historical frozen fixture hashes (LF-normalized) detect accidental changes, while modern encoder tests separately compare actual output to retained fixtures/corrections.
