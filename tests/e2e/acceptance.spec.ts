import { expect, test } from "vitest";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import { withBrowserServer } from "./browser-server";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ||
  "playwright");

// These are contract assertions, not snapshots of the current converter.
// Removing Worker overrides, treating all input as math, swallowing recovery tails,
// or confusing ASCII/BRF plus with the mathematical operator must fail this flow.
test("default mixed browser acceptance retains domains, manual cells and incomplete boundaries", async () => {
  const server = await createServer({
    configFile: false,
    root: "apps/playground",
    envDir: false,
    cacheDir: process.cwd() + "/.local/vite-acceptance",
    server: { host: "127.0.0.1", port: 5184, strictPort: true },
  });
  await withBrowserServer(
    server,
    () =>
      chromium.launch({
        headless: true,
        executablePath:
          process.env.EDGE_PATH || undefined,
      }),
    async (browser: any) => {
      const page = await browser.newPage();
      const errors: string[] = [],
        external: string[] = [];
      page.on("pageerror", (e: Error) => errors.push(e.message));
      await page.route("**/*", (route: any) => {
        const url = route.request().url();
        if (url.startsWith("http://127.0.0.1:5184/")) return route.continue();
        external.push(url);
        return route.abort();
      });
      await page.goto("http://127.0.0.1:5184");
      const source = page.getByLabel("原文输入", { exact: true });
      const cells = page.getByLabel("Unicode 六点盲文", { exact: true });
      const audit = async () => {
        const pending = page.waitForEvent("download");
        await page
          .getByRole("button", { name: "下载诊断与覆盖 JSON", exact: true })
          .click();
        return JSON.parse(await readFile(await (await pending).path(), "utf8"));
      };
      const load = async (text: string) => {
        await source.fill(text);
        await expect
          .poll(
            () =>
              page
                .locator("[data-result-source]")
                .getAttribute("data-result-source"),
            { timeout: 10000 },
          )
          .toBe(text);
        const a = await audit(),
          r = a.result;
        expect(r.document.source).toBe(text);
        expect(r.document.nodes.map((n: any) => n.raw).join("")).toBe(text);
        let end = 0;
        for (const n of r.document.nodes) {
          expect(n.span.start).toBe(end);
          expect(text.slice(n.span.start, n.span.end)).toBe(n.raw);
          end = n.span.end;
        }
        expect(end).toBe(text.length);
        expect(r.unicode).toMatch(/^[\u2800-\u283f\n\f]*$/u);
        expect(a.coverage.fullStandardSupport).toBe(false);
        return r;
      };
      await page.getByLabel("段首缩进", { exact: true }).fill("0");
      await page.getByLabel("段首缩进", { exact: true }).press("Tab");
      for (const [open, close, kind] of [
        ["$", "$", "inline-math"],
        ["$$", "$$", "display-math"],
        ["\\(", "\\)", "inline-math"],
        ["\\[", "\\]", "display-math"],
      ]) {
        const r = await load(`${open}\\frac{13}{28}${close}`);
        expect(r.document.nodes.map((n: any) => n.kind)).toEqual([kind]);
        // Independently reviewed GB/T18028 §6.4 fixture: 3456,1,14,23,236.
        expect(r.unicode).toBe("⠼⠁⠉⠆⠦");
        expect(r.complete).toBe(true);
      }
      for (const formula of [
        String.raw`\frac{13}{28}`,
        String.raw`\sqrt{3}`,
        "x^2+1",
      ]) {
        const r = await load(`前${formula}后`);
        expect(r.document.nodes.map((n: any) => n.kind)).toEqual([
          "text",
          "bare-math",
          "text",
        ]);
        expect(r.unhandled).toEqual([]);
      }
      const adjacent = await load("前文$x$后文$a$$b$");
      expect(
        adjacent.document.nodes
          .filter((n: any) => n.kind === "inline-math")
          .map((n: any) => n.content),
      ).toEqual(["x", "a", "b"]);
      const clock = await load(String.raw`会议12:30，反应\ce{H2}结束`);
      expect(clock.document.nodes.map((n: any) => n.kind)).toEqual([
        "text",
        "chemistry",
        "text",
      ]);
      expect(
        clock.diagnostics.some(
          (d: any) => d.code === "ambiguity-time-scope-unsupported",
        ),
      ).toBe(false);
      const escaped = await load(String.raw`C:\frac{1}{2} \$5`);
      expect(
        escaped.document.nodes.some((n: any) => n.kind.includes("math")),
      ).toBe(false);
      const recovered = await load(String.raw`坏\frac{1` + "\n\n后文$x$");
      expect(recovered.complete).toBe(false);
      expect(recovered.document.nodes.at(-1)).toMatchObject({
        kind: "inline-math",
        content: "x",
      });
      expect(
        recovered.document.nodes.some((n: any) => n.kind === "paragraph-break"),
      ).toBe(true);
      const emoji = await load("前😀后");
      expect(emoji.unhandled).toContainEqual(
        expect.objectContaining({ raw: "😀", span: { start: 1, end: 3 } }),
      );
      await load("$重量$");
      await page.getByLabel("修订起点", { exact: true }).fill("1");
      await page.getByLabel("修订终点（不含）", { exact: true }).fill("3");
      const manual = async (reading: string) => {
        await page.getByLabel("拼音与分词", { exact: true }).fill(reading);
        await page
          .getByRole("button", { name: "应用人工修订", exact: true })
          .click();
        await expect
          .poll(() => page.locator(".word").allTextContents())
          .toEqual([`重量 · ${reading} · 人工 · 人工/人工`]);
        return (await audit()).result;
      };
      const heavy = await manual("zhong4 liang4");
      const repeated = await manual("chong2 liang4");
      expect(repeated.unicode).not.toBe(heavy.unicode);
      expect(
        repeated.atoms
          .filter((a: any) => a.kind === "cell" && a.span.start === 1)
          .map((a: any) => a.cells),
      ).not.toEqual(
        heavy.atoms
          .filter((a: any) => a.kind === "cell" && a.span.start === 1)
          .map((a: any) => a.cells),
      );
      expect(repeated.metadata.chineseWords[0].source).toBe("manual");
      expect(repeated.document.source).toBe("$重量$");
      const dir =
        process.env.HORIZON_AUDIT_DIR ||
        ".local/browser-artifacts";
      await mkdir(dir, { recursive: true });
      await page.setViewportSize({ width: 1365, height: 900 });
      await source.scrollIntoViewIfNeeded();
      await page.screenshot({ path: dir + "/task-9-manual-reading.png" });
      await page.getByLabel("每行方数", { exact: true }).fill("1");
      await page.getByLabel("每行方数", { exact: true }).press("Tab");
      await expect.poll(() => cells.inputValue()).toBe("");
      expect((await audit()).result.complete).toBe(false);
      expect(external.every(url => url === "http://127.0.0.1:8787/health")).toBe(true);
      expect(errors).toEqual([]);
      await writeFile(
        dir + "/task-9-acceptance.json",
        JSON.stringify(
          {
            external,
            errors,
            manual: {
              source: heavy.document.source,
              heavy: heavy.unicode,
              repeated: repeated.unicode,
            },
            checks:
              "four delimiter independent fraction cells, default bare domains, adjacent math, prose clock plus chemistry, escapes, recovery, supplementary scalar, manual actual cells, atomic overflow",
          },
          null,
          2,
        ),
      );
    },
  );
}, 90000);

test("failed browser launch releases only its own acceptance server", async () => {
  const server = await createServer({
    configFile: false,
    envDir: false,
    server: { host: "127.0.0.1", port: 0 },
  });
  try {
    await expect(
      withBrowserServer(
        server,
        () =>
          chromium.launch({
            executablePath: "Z:/horizon-nonexistent-browser.exe",
          }),
        async () => {
          throw new Error("unreachable browser flow");
        },
      ),
    ).rejects.toThrow(/executable/i);
    expect(server.httpServer?.listening).toBe(false);
  } finally {
    // Also contain the deliberately red pre-fix run.
    await server.close();
  }
});
