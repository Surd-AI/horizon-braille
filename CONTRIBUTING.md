# Contributing

Use Node 22.13+ and npm ci from the committed lockfile. Keep core changes in packages/core; optional UI/API code must not become an import-time dependency of the package entry point. Open a focused change with the problem, supported behavior, limitations and relevant validation. No public upstream repository or maintainer address is configured in this source export; use the review channel of the repository where you obtained it.

Run npm test, npm run typecheck, npm run verify:coverage, npm run build and npm run test:package. For UI changes, install Chromium with npx playwright install chromium and run npm run test:browser. See docs/verification.md.

New encoding behavior needs independent positive/negative fixtures and exact source spans; regression tests must not merely reproduce current output as a golden. Keep official, derived and legacy evidence distinct. Never promote a rule to verified without the rule-specific source locator, review and fixture links required by the gate. Expand inventory-manifest.json deliberately rather than deriving it from filtered registry data. Full standard support remains false until the complete applicability inventory is reviewed and all applicable entries are verified.

Do not commit tokens, .env.local, document contents from real users, local absolute paths, private endpoints or official scans without redistribution rights. Retain third-party notices for generated or bundled code. Contributions are submitted under this repository's Apache-2.0 license; third-party material keeps its own compatible terms.
