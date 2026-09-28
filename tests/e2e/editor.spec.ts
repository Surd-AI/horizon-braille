import { test, expect } from "vitest";
import { createRequire } from "node:module";
import { createServer } from "vite";
import { collectAmbiguities } from "../../packages/core/src/ambiguity";
import { mkdir } from "node:fs/promises";
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ||
    "playwright",
);
test("editor loads offline and latest input wins without contacting a production gateway", async () => {
  const server = await createServer({
    configFile: false,
    cacheDir: process.cwd() + "/.local/vite-e2e",
    root: "apps/playground",
    server: { host: "127.0.0.1", port: 5182, strictPort: true },
    envDir: false,
  });
  await server.listen();
  let browser: any;
  try {
  browser = await chromium.launch({
    executablePath:
      process.env.EDGE_PATH || undefined,
    headless: true,
  });
    const page = await browser.newPage();
    page.setDefaultTimeout(8000);
    const requests: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (e: Error) => errors.push(e.message));
    page.on("console", (message: any) => {
      if (["error", "warning"].includes(message.type()))
        errors.push(message.text());
    });
    let onlineCalls = 0;
    await page.route("**/*", async (route: any) => {
      const url = route.request().url();
      requests.push(url);
      if (url === "http://127.0.0.1:8787/health") {
        return route.fulfill({contentType:"application/json",headers:{"Access-Control-Allow-Origin":"http://127.0.0.1:5182"},
          body:JSON.stringify({configured:false,userKeySupported:true})});
      }
      if (url === "http://127.0.0.1:8787/resolve") {
        onlineCalls++;
        const body = route.request().postDataJSON();
        const resolutions = collectAmbiguities(body.source).map((a) => ({
          id: a.id,
          choice: a.kind === "colon" ? "ratio" : a.candidates[0].id,
          source: "api",
          confidence: 0.95,
          probabilities: Object.fromEntries(
            a.candidates.map((c, i) => [
              c.id,
              c.id === (a.kind === "colon" ? "ratio" : a.candidates[0].id)
                ? 1
                : 0,
            ]),
          ),
        }));
        await new Promise((r) => setTimeout(r, 250));
        await route
          .fulfill({
            contentType: "application/json",
            headers: { "Access-Control-Allow-Origin": "http://127.0.0.1:5182" },
            body: JSON.stringify({
              decisions: { documentSource: body.source, resolutions },
            }),
          })
          .catch(() => {});
        return;
      }
      return url.startsWith("http://127.0.0.1:5182/")
        ? route.continue()
        : route.abort();
    });
    await page.goto("http://127.0.0.1:5182");
    const source = page.getByLabel("原文输入", { exact: true });
    await expect.poll(() => source.count(), { timeout: 3000 }).toBe(1);
    await source.fill("第一次");
    await source.fill(String.raw`第二次\frac{1}{2}`);
    await expect
      .poll(() =>
        page.locator("[data-result-source]").getAttribute("data-result-source"),
      )
      .toBe(String.raw`第二次\frac{1}{2}`);
    expect(requests.every((x) => x.startsWith("http://127.0.0.1:5182/") || x === "http://127.0.0.1:8787/health")).toBe(
      true,
    );
    expect(await page.title()).toBe("Horizon 统一盲文编辑器");
    expect(await page.getByText("开源算法预览 · 结果仅供参考").isVisible()).toBe(true);
    expect(await page.getByRole("link", { name: "查看开源核心与使用说明 →" }).getAttribute("href")).toBe("https://github.com/Surd-AI/horizon-braille");
    expect(await page.getByRole("link", { name: "注册 SurdAI 账号" }).getAttribute("href")).toBe("https://surdai.com/zh/register");
    expect(await page.getByRole("link", { name: "创建 API Key" }).getAttribute("href")).toBe("https://surdai.com/zh/platform/keys");
    expect(await page.locator("vite-error-overlay").count()).toBe(0);
    const waitSource = async (text: string) => {
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
    };
    for (const text of [
      "春天来了",
      String.raw`\frac{1}{2}`,
      String.raw`前\frac{1}{2}后`,
      String.raw`\frac{中文}{\text{中文 条件}}`,
      String.raw`反应\ce{2H2 + O2 ->[点燃] 2H2O}结束`,
      "第一行\n第二行\n\n第三段",
      String.raw`坏\frac{1` + "\n\n后文完整",
    ]) {
      await waitSource(text);
      expect(await source.inputValue()).toBe(text);
      expect(
        (
          await page
            .getByLabel("Unicode 六点盲文", { exact: true })
            .inputValue()
        ).length,
      ).toBeGreaterThan(0);
    }
    for (const [open, close] of [
      ["\\(", "\\)"],
      ["\\[", "\\]"],
      ["$", "$"],
      ["$$", "$$"],
    ]) {
      await waitSource(`前${open}\\frac{1}{2}${close}后`);
      expect(await page.locator(".hz").innerText()).not.toContain(
        "unclosed-math",
      );
      expect(
        await page.getByLabel("原文输入", { exact: true }).inputValue(),
      ).toBe(`前${open}\\frac{1}{2}${close}后`);
    }
    await waitSource(String.raw`\text{中文 条件}`);
    const auditPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "下载诊断与覆盖 JSON", exact: true })
      .click();
    const audit = await auditPromise;
    const auditPath = await audit.path();
    const fs = await import("node:fs/promises");
    const payload = JSON.parse(await fs.readFile(auditPath, "utf8"));
    expect(payload.result.document.source).toBe(String.raw`\text{中文 条件}`);
    expect(payload.coverage.fullStandardSupport).toBe(false);
    await waitSource("女儿");
    await page.getByLabel("修订起点", { exact: true }).fill("0");
    await page.getByLabel("修订终点（不含）", { exact: true }).fill("2");
    await page.getByLabel("拼音与分词", { exact: true }).fill("bad9");
    await page
      .getByRole("button", { name: "应用人工修订", exact: true })
      .click();
    expect(
      await page
        .getByLabel("拼音与分词", { exact: true })
        .getAttribute("aria-invalid"),
    ).toBe("true");
    await page.getByLabel("拼音与分词", { exact: true }).fill("nv3 | er0");
    await page
      .getByRole("button", { name: "应用人工修订", exact: true })
      .click();
    await expect
      .poll(() => page.locator(".word").allTextContents())
      .toEqual(["女 · nv3 · 人工 · 人工", "儿 · er5 · 人工 · 人工"]);
    await page.locator(".word").first().click();
    expect(
      await source.evaluate((e: HTMLTextAreaElement) => [
        e.selectionStart,
        e.selectionEnd,
      ]),
    ).toEqual([0, 1]);
    expect(await page.locator(".mapping.selected").count()).toBeGreaterThan(0);
    await page.getByLabel("每行方数", { exact: true }).fill("0");
    await page.getByLabel("每行方数", { exact: true }).press("Tab");
    await expect
      .poll(() =>
        page.getByLabel("Unicode 六点盲文", { exact: true }).inputValue(),
      )
      .toBe("");
    expect(await page.locator(".hz").innerText()).toContain(
      "layout-invalid-options",
    );
    await page.getByLabel("每行方数", { exact: true }).fill("30");
    await page.getByLabel("每行方数", { exact: true }).press("Tab");
    await waitSource("3:4");
    await page.getByLabel("候选 1", { exact: true }).focus();
    await page.getByLabel("候选 1", { exact: true }).selectOption("ratio");
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            document.activeElement?.getAttribute("aria-label"),
          ),
        { timeout: 3000 },
      )
      .toBe("候选 1");
    await waitSource("12:30");
    const before = await page
      .getByLabel("Unicode 六点盲文", { exact: true })
      .inputValue();
    await page.getByLabel("SurdAI API Key（仅本次页面使用）", {exact:true}).fill("sx_live_ABCDEFGHIJKLMNOPQRSTUVWXYZ123456");
    await page.getByLabel("每行方数", { exact: true }).fill("10");
    await page.getByLabel("每行方数", { exact: true }).press("Tab");
    await expect
      .poll(() => page.locator(".choice").innerText())
      .toContain("来源：API");
    expect(onlineCalls).toBe(1);
    expect(await page.locator(".status").innerText()).toContain("10 方/行");
    expect(
      await page.getByLabel("Unicode 六点盲文", { exact: true }).inputValue(),
    ).not.toBe(before);
    await page
      .getByRole("button", { name: "重新智能判断", exact: true })
      .click();
    await waitSource("最后的原文");
    await page.waitForTimeout(400);
    expect(await source.inputValue()).toBe("最后的原文");
    expect(
      await page
        .locator("[data-result-source]")
        .getAttribute("data-result-source"),
    ).toBe("最后的原文");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "下载 BRF", exact: true }).click();
    expect((await downloadPromise).suggestedFilename()).toBe("horizon.brf");
    // Native toggles must alter actual cells, not just labels.
    await waitSource("飞");
    const normative = await page
      .getByLabel("Unicode 六点盲文", { exact: true })
      .inputValue();
    await page.getByLabel("声调策略", { exact: true }).selectOption("full");
    await expect
      .poll(
        async () => {
          const value = await page
            .getByLabel("Unicode 六点盲文", { exact: true })
            .inputValue();
          return !!value && value !== normative;
        },
        { timeout: 10000 },
      )
      .toBe(true);
    await waitSource("你");
    const contracted = await page
      .getByLabel("Unicode 六点盲文", { exact: true })
      .inputValue();
    await page.getByLabel("启用已有简写规则", { exact: true }).uncheck();
    await expect
      .poll(
        async () => {
          const value = await page
            .getByLabel("Unicode 六点盲文", { exact: true })
            .inputValue();
          return !!value && value !== contracted;
        },
        { timeout: 10000 },
      )
      .toBe(true);
    await page
      .getByLabel("声调策略", { exact: true })
      .selectOption("normative");
    await page.getByLabel("启用已有简写规则", { exact: true }).check();
    await page
      .getByLabel("出版配置", { exact: true })
      .selectOption("book-body");
    await page
      .getByLabel("人工六点页码（逗号分隔，可留空）", { exact: true })
      .fill("⠁");
    await page
      .getByLabel("人工六点页码（逗号分隔，可留空）", { exact: true })
      .press("Tab");
    await expect
      .poll(
        () => page.getByLabel("Unicode 六点盲文", { exact: true }).inputValue(),
        { timeout: 10000 },
      )
      .toContain("⠁");
    await page
      .getByLabel("人工六点页码（逗号分隔，可留空）", { exact: true })
      .fill("");
    await page
      .getByLabel("人工六点页码（逗号分隔，可留空）", { exact: true })
      .press("Tab");
    await page.getByLabel("出版配置", { exact: true }).selectOption("custom");
    await waitSource("天地 ".repeat(1200));
    expect(await page.locator(".word").count()).toBeLessThanOrEqual(30);
    expect(await page.locator(".diagnostic").count()).toBeLessThanOrEqual(30);
    expect(await page.locator(".mapping").count()).toBeLessThanOrEqual(30);
    expect(await page.locator(".hz *").count()).toBeLessThan(1000);
    await page.getByLabel("学科模式", { exact: true }).selectOption("text");
    await waitSource(String.raw`\(x=1\)`);
    expect(await page.locator(".hz").innerText()).not.toContain(
      "font-normalization-profile",
    );
    await page.getByLabel("学科模式", { exact: true }).selectOption("document");
    await waitSource(String.raw`先求\frac{1}{2}，再计算\(x^2+1\)。`);
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"], {
        origin: "http://127.0.0.1:5182",
      });
    await page
      .getByRole("button", { name: "复制 Unicode", exact: true })
      .click();
    expect(
      (await page.evaluate(() => navigator.clipboard.readText())).replace(
        /\r\n/g,
        "\n",
      ),
    ).toBe(
      await page.getByLabel("Unicode 六点盲文", { exact: true }).inputValue(),
    );
    expect(errors).toEqual([]);
    expect(
      requests.every(
        (x) =>
          x.startsWith("http://127.0.0.1:5182/") ||
          x === "http://127.0.0.1:8787/resolve" || x === "http://127.0.0.1:8787/health",
      ),
    ).toBe(true);
    const auditDir =
      process.env.HORIZON_AUDIT_DIR ||
      ".local/browser-artifacts";
    await mkdir(auditDir, { recursive: true });
    await fs.writeFile(
      auditDir + "/task-8-playground-browser.json",
      JSON.stringify(
        {
          requests,
          errors,
          onlineCalls,
          url: page.url(),
          title: await page.title(),
        },
        null,
        2,
      ),
    );
    await page.setViewportSize({ width: 1365, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: auditDir + "/task-8-playground-desktop.png",
    });
    const desktopBraille = await page
      .getByLabel("Unicode 六点盲文", { exact: true })
      .inputValue();
    await page.setViewportSize({ width: 390, height: 844 });
    // Native textarea overflow depends on the platform's braille font. The
    // actual responsive contract is that the complete result remains present
    // and the page itself fits the narrow viewport.
    expect(await page.getByLabel("Unicode 六点盲文", { exact: true }).inputValue()).toBe(desktopBraille);
    await page.screenshot({ path: auditDir + "/task-8-playground-mobile.png" });
    await page.getByLabel('Unicode 六点盲文',{exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:auditDir+'/task-8-playground-mobile-output.png'});
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    await browser?.close();
    await server.close();
  }
}, 90000);
