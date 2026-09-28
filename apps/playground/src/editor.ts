import { createSession, API } from "./client";
import { normalizeSyllable } from "../../../packages/core/src/rules/chinese";
import { alignedLines } from "./alignment";
import type { ChineseOverride } from "../../../packages/core/src/language/chinese";
import type { SourceSpan } from "../../../packages/core/src/model";
import registry from "../../../standards/registry.json";
import coverage from "../../../standards/coverage.json";
import "./styles.css";
export const examples = [
  ["中文", "春天来了，我们一起学习。"],
  ["裸 LaTeX", String.raw`\frac{1}{2}+\sqrt{3}`],
  ["中文与裸公式", String.raw`先求\frac{1}{2}，再计算x^2+1。`],
  ["四种定界符", String.raw`甲\(x=1\)乙\[y=2\]丙$z=3$丁$$w=4$$尾`],
  ["公式中的中文", String.raw`\frac{中文}{\text{中文 条件}}`],
  ["化学反应", String.raw`反应\ce{2H2 + O2 ->[点燃] 2H2O}结束。`],
  [
    "多段与恢复",
    String.raw`第一段\frac{1` + "\n\n后续正文完整保留。\n第三行。",
  ],
] as const;
const labels: Record<string, string> = {
  manual: "人工",
  proposal: "词典分词建议",
  dictionary: "词典",
  heuristic: "规则提示",
  api: "API",
  time: "时刻",
  ratio: "比值",
  punctuation: "正文冒号",
  mapping: "映射（编码待核验）",
  unknown: "未确定",
};
const statusLabels: Record<string, string> = {
  verified: "已有核验样例",
  "implemented-unverified": "已实现，待核验",
  uncovered: "待补充规则",
  "not-applicable": "不适用",
};
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = "",
  cls = "",
) {
  const e = document.createElement(tag);
  e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function button(text: string, fn: () => void) {
  const b = el("button", text);
  b.type = "button";
  b.onclick = fn;
  return b;
}
function download(
  name: string,
  text: string,
  type = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export interface EditorOptions {
  source?: string;
  compact?: boolean;
  onResult?: (result: unknown) => void;
}
export function mountEditor(host: HTMLElement, options: EditorOptions = {}) {
  let userKey = "", onlineReady = false, serverConfigured = false, keySupported = false;
  let keyVersion = 0, autoTimer: ReturnType<typeof setTimeout> | undefined;
  let autoKey = "", disposed = false;
  const session = createSession({ userToken: () => userKey });
  const root = el("section", "", "hz" + (options.compact ? " compact" : ""));
  host.append(root);
  let selected: SourceSpan = { start: 0, end: 0 },
    diagnosticPage = 0,
    wordPage = 0,
    ambiguityPage = 0,
    mappingPage = 0,
    alignmentPage = 0;
  // Textarea normalizes CRLF to LF. Core/manual positions remain original UTF-16.
  let sourceToView: number[] = [0],
    viewToSource: number[] = [0];
  const heading = el("header");
  heading.append(
    el("p", "HORIZON · 在线辅助编辑", "eyebrow"),
    el("h1", options.compact ? "公式与混排盲文" : "统一盲文编辑器"),
    el(
      "p",
      "中文、数学、化学与物理，共用同一转换内核。原文与人工修订保留可追溯区间。",
    ),
  );
  root.append(heading);
  const previewNote = el("aside", "", "preview-note");
  previewNote.append(
    el("strong", "开源算法预览 · 结果仅供参考"),
    el("p", "这里演示中文、数学、化学等内容的盲文转换与校对流程。正式使用前请核对适用标准和具体语境；你也可以基于 Apache-2.0 开源核心，开发自己的编辑器、无障碍工具或业务应用。"),
  );
  const coreLink = el("a", "查看开源核心与使用说明 →");
  coreLink.href = "https://github.com/Surd-AI/horizon-braille";
  coreLink.target = "_blank";
  coreLink.rel = "noopener noreferrer";
  previewNote.append(coreLink);
  root.append(previewNote);
  const state = el("p", "准备本地转换…", "status");
  state.setAttribute("role", "status");
  state.setAttribute("aria-live", "polite");
  root.append(state);
  const error = el("p", "", "error");
  error.setAttribute("role", "alert");
  root.append(error);
  const toolbar = el("div", "", "toolbar");
  root.append(toolbar);
  const field = (parent: HTMLElement, title: string, input: HTMLElement) => {
    const label = el("label", title);
    input.setAttribute("aria-label", title);
    label.append(input);
    parent.append(label);
    return input;
  };
  const select = (
    parent: HTMLElement,
    title: string,
    items: readonly (readonly [string, string])[],
  ) => {
    const s = el("select");
    for (const [value, label] of items) {
      const o = el("option", label);
      o.value = value;
      s.append(o);
    }
    field(parent, title, s);
    return s;
  };
  const mode = select(toolbar, "学科模式", [
    ["document", "自动混排"],
    ["text", "纯正文（不识别公式）"],
    ["math", "数学"],
    ["chemistry", "化学"],
    ["physics", "物理"],
  ]);
  mode.onchange = () => {
    void session.setOptions({ mode: mode.value as any });
  };
  const samples = select(toolbar, "示例", [
    ["", "选择一个示例"],
    ...examples.map(([name], i) => [String(i), name] as const),
  ]);
  samples.onchange = () => {
    if (samples.value !== "") {
      setSource(examples[Number(samples.value)][1]);
      samples.value = "";
    }
  };
  const workspace = el("div", "", "workspace");
  const sourcePanel = el("section");
  sourcePanel.append(el("h2", "输入与修订"));
  const sourceFold = el("details");
  if (options.compact) {
    sourceFold.append(el("summary", "展开原文与学科模式"), sourcePanel);
    sourcePanel.append(toolbar);
    workspace.append(sourceFold);
  } else workspace.append(sourcePanel);
  root.append(workspace);
  const input = el("textarea");
  input.rows = options.compact ? 6 : 12;
  input.spellcheck = false;
  input.maxLength = 100000;
  input.setAttribute("aria-label", "原文输入");
  field(sourcePanel, "原文输入", input);
  const policy = el("details");
  policy.append(
    el("summary", "混排识别、字体与校对说明"),
    el(
      "p",
      String.raw`自动识别中文、完整裸公式与 \(...\)、\[...\]、$...$、$$...$$。不折叠反斜杠，不猜任意代码；a+b 等意图不清时请指定学科或加定界符。纯正文模式逐字保留公式符号及换行。`,
    ),
    el(
      "p",
      "数学默认采用 Roman-light normalized 字体规范化配置，保留已支持的显式样式；不保证 TeX 原字体，不凭字体推断变量、常量或单位。默认缩进 2 格是编辑选择。",
    ),
    el(
      "p",
      "转换结果带有原文对照、诊断和完整状态，便于检查多音字、符号含义和复杂排版。规则核验记录可在标准资料中逐条查看；软件输出不等于官方标准认证。",
    ),
  );
  root.append(policy);
  const layoutPanel = el("fieldset");
  layoutPanel.append(el("legend", "排版与导出"));
  if (options.compact) {
    const fold = el("details");
    fold.append(el("summary", "展开出版、声调与高级排版"), layoutPanel);
    root.append(fold);
  } else root.append(layoutPanel);
  const layoutFields = el("div", "", "toolbar");
  layoutPanel.append(layoutFields);
  const number = (title: string, value: number) => {
    const n = el("input");
    n.type = "number";
    n.value = String(value);
    n.min = "1";
    n.max = "1000";
    field(layoutFields, title, n);
    return n;
  };
  const columns = number("每行方数", 30),
    rows = number("每页正文行数", 25),
    indent = number("段首缩进", 2);
  indent.min = "0";
  const profile = select(layoutFields, "出版配置", [
    ["custom", "自定义"],
    ["book-body", "书籍正文 · 30 × 25"],
  ]);
  const footer = el("input");
  footer.placeholder = "例如：⠼⠁,⠼⠃";
  field(layoutFields, "人工六点页码（逗号分隔，可留空）", footer);
  const duplex = el("input");
  duplex.type = "checkbox";
  field(layoutFields, "双面页码位置", duplex);
  const applyLayout = () => {
    session.setLayout({
      columns: Number(columns.value),
      rows: Number(rows.value),
      paragraphIndent: Number(indent.value),
      profile: profile.value as any,
      pageNumbers: footer.value
        ? {
            labels: footer.value.split(/[,，]/).map((x) => x.trim()),
            duplex: duplex.checked,
          }
        : undefined,
    });
  };
  for (const n of [columns, rows, indent, footer, duplex])
    n.onchange = applyLayout;
  profile.onchange = () => {
    if (profile.value === "book-body") {
      columns.value = "30";
      rows.value = "25";
    }
    applyLayout();
  };
  const tone = select(layoutFields, "声调策略", [
    ["normative", "规则省调（已有规则）"],
    ["full", "全部标调（轻声除外）"],
  ]);
  tone.onchange = () =>
    void session.setOptions({
      chinese: { ...session.options.chinese, tones: tone.value as any },
    });
  const contractions = el("input");
  contractions.type = "checkbox";
  contractions.checked = true;
  field(layoutFields, "启用已有简写规则", contractions);
  contractions.onchange = () =>
    void session.setOptions({
      chinese: {
        ...session.options.chinese,
        contractions: contractions.checked,
      },
    });
  const time = select(layoutFields, "时刻冒号", [
    ["normalize-hours-minutes", "明确展开为“时、分”（非独立国标规则）"],
    ["preserve", "保留并提示待处理"],
  ]);
  time.onchange = () =>
    void session.setOptions({ timePolicy: time.value as any });
  const online = el("details");
  online.open = true;
  online.append(el("summary", "SurdAI 智能消歧 · 默认开启"));
  const onlineStatus = el(
    "p",
    "正在检查本机安全转发服务…",
  );
  online.append(onlineStatus);
  const keyInput = el("input");
  keyInput.type = "password";
  keyInput.autocomplete = "off";
  keyInput.placeholder = "sx_live_…";
  keyInput.setAttribute("aria-label", "SurdAI API Key");
  field(online, "SurdAI API Key（仅本次页面使用）", keyInput);
  const accountHelp = el("p", "没有 Key？先在 SurdAI 注册账号，再到工作台创建调用令牌。", "account-help");
  const registerLink = el("a", "注册 SurdAI 账号");
  registerLink.href = "https://surdai.com/zh/register";
  registerLink.target = "_blank";
  registerLink.rel = "noopener noreferrer";
  const tokenLink = el("a", "创建 API Key");
  tokenLink.href = "https://surdai.com/zh/platform/keys";
  tokenLink.target = "_blank";
  tokenLink.rel = "noopener noreferrer";
  const accountLinks = el("span", "", "account-links");
  accountLinks.append(registerLink, tokenLink);
  accountHelp.append(accountLinks);
  online.append(accountHelp);
  keyInput.oninput = () => {
    userKey = keyInput.value.trim();
    keyVersion++;
    onlineReady = serverConfigured || (keySupported && !!userKey);
    if (keySupported && userKey) onlineStatus.textContent = "使用本页 Key 自动判断；只经本机服务转发，不保存 Key。";
    else if (keySupported && !serverConfigured) onlineStatus.textContent = "请输入 SurdAI API Key，随后自动判断。";
    autoKey = "";
    scheduleAuto();
  };
  const checkService = async () => {
    try {
      const r = await fetch(API + "/health");
      if (!r.ok) throw Error();
      const data = await r.json();
      if (disposed) return;
      serverConfigured = !!data.configured;
      keySupported = !!data.userKeySupported;
      onlineReady = serverConfigured || (keySupported && !!userKey);
      onlineStatus.textContent = userKey && keySupported
        ? "使用本页 Key 自动判断；只经本机服务转发，不保存 Key。"
        : data.configured
        ? "已连接 SurdAI：输入稳定后自动判断，仍可人工修订。"
        : data.userKeySupported
          ? "本机转发服务已就绪。输入 Key 后自动在线判断；Key 不会保存在页面。"
          : "本机服务需要更新后才能使用页面输入的 Key。";
      scheduleAuto();
    } catch {
      if (disposed) return;
      onlineReady = false;
      onlineStatus.textContent = "本机转发服务未启动；当前结果仅供离线预览。请先运行 npm run start:api。";
    }
  };
  const check = button("重试连接", () => void checkService());
  const resolve = button("重新智能判断", () => void session.resolveOnline()),
    cancel = button("取消在线请求", () => session.cancelOnline());
  online.append(check, resolve, cancel);
  root.insertBefore(online, workspace);
  function scheduleAuto() {
    if (autoTimer) clearTimeout(autoTimer);
    if (!onlineReady || session.busy || session.onlineBusy || !session.result ||
      !session.ambiguities.length || !session.source.trim()) return;
    const key = JSON.stringify([session.source, session.options.mode, session.options.recognizeMath,
      session.options.recognizeChemistry, session.options.timePolicy, keyVersion]);
    if (key === autoKey) return;
    autoTimer = setTimeout(() => {
      autoTimer = undefined;
      if (disposed || session.busy || session.onlineBusy) return;
      autoKey = key;
      void session.resolveOnline();
    }, 650);
  }
  const manual = el("details");
  manual.open = !options.compact;
  manual.append(el("summary", "人工分词与注音"));
  root.append(manual);
  manual.append(
    el(
      "p",
      "选择原文中的连续汉字，或填写 UTF-16 起止位置。每字一个数字声调拼音，空格分隔；用 | 划分词边界。例如：zhong1 guo2 | ren2。支持轻声 0/5、ü/v/u:。修改原文将清空人工区间与既有消歧决定。",
    ),
  );
  const manualFields = el("div", "", "toolbar");
  manual.append(manualFields);
  const start = el("input"),
    end = el("input");
  for (const n of [start, end]) {
    n.type = "number";
    n.min = "0";
    n.value = "0";
  }
  field(manualFields, "修订起点", start);
  field(manualFields, "修订终点（不含）", end);
  const reading = el("input");
  field(manual, "拼音与分词", reading);
  const retain = el("input");
  retain.type = "checkbox";
  field(manual, "这次修订保留声调", retain);
  const manualFeedback = el("p");
  manualFeedback.setAttribute("role", "status");
  manual.append(manualFeedback);
  manual.append(
    button("应用人工修订", () => {
      const a = Number(start.value),
        b = Number(end.value),
        raw = session.source.slice(a, b),
        groups = reading.value
          .trim()
          .split("|")
          .map((g) =>
            g
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .map((s) => s.toLowerCase().replace(/0$/, "5")),
          );
      if (
        !Number.isInteger(a) ||
        !Number.isInteger(b) ||
        a < 0 ||
        b > session.source.length ||
        a >= b ||
        !/^\p{Script=Han}+$/u.test(raw) ||
        groups.some((g) => !g.length) ||
        groups.flat().length !== [...raw].length ||
        groups.flat().some((s) => !normalizeSyllable(s))
      ) {
        manualFeedback.textContent =
          "修订无效：请选择完整连续汉字，并为每字填写一个有效拼音（声调 0–5）。";
        reading.setAttribute("aria-invalid", "true");
        return;
      }
      let cursor = a;
      const chars = [...raw];
      let at = 0;
      const added: ChineseOverride[] = groups.map((readings) => {
        const length = chars.slice(at, at + readings.length).join("").length;
        at += readings.length;
        const o = {
          start: cursor,
          end: cursor + length,
          readings,
          retainTones: readings.map(() => retain.checked),
        };
        cursor += length;
        return o;
      });
      const kept = (session.options.overrides ?? []).filter(
        (o) => o.end <= a || o.start >= b,
      );
      reading.removeAttribute("aria-invalid");
      manualFeedback.textContent =
        "已应用人工修订；跨公式结构的区间如不适用，将在诊断中明确提示。";
      void session.setOptions({ overrides: [...kept, ...added] });
    }),
    button("清空人工修订", () => {
      reading.value = "";
      manualFeedback.textContent = "人工修订已清空。";
      void session.setOptions({ overrides: [] });
    }),
  );
  const words = el("div");
  manual.append(words);
  const ambiguities = el("details");
  ambiguities.open = !options.compact;
  ambiguities.append(el("summary", "歧义候选与决定来源"));
  const choices = el("div");
  ambiguities.append(choices);
  root.append(ambiguities);
  const results = el("section");
  results.append(el("h2", "转换结果"));
  if (options.compact) workspace.prepend(results);
  else workspace.append(results);
  const comparison = el("div", "", "aligned-preview");
  comparison.setAttribute("aria-label", "中盲文逐词对照");
  const comparisonToolbar = el("div", "", "toolbar");
  const comparisonPosition = el("span", "中盲文逐词对照");
  const previousAlignment = button("上一组", () => { alignmentPage--; render(); });
  const nextAlignment = button("下一组", () => { alignmentPage++; render(); });
  comparisonToolbar.append(comparisonPosition, previousAlignment, nextAlignment);
  results.append(comparisonToolbar, comparison);
  const output = el("textarea");
  output.wrap = "off";
  output.readOnly = true;
  output.rows = 4;
  output.className = "braille";
  field(results, "Unicode 六点盲文", output);
  const brf = el("textarea");
  brf.wrap = "off";
  brf.readOnly = true;
  brf.rows = 2;
  field(results, "BRF ASCII", brf);
  if (options.compact) results.append(columns.parentElement!);
  const exports = el("div", "", "toolbar");
  results.append(exports);
  const exportButtons: HTMLButtonElement[] = [];
  for (const [label, key, suffix] of [
    ["Unicode", "unicode", "txt"],
    ["BRF", "brf", "brf"],
  ] as const) {
    const copy = button("复制 " + label, async () => {
      try {
        await navigator.clipboard.writeText(session.result?.[key] ?? "");
        copy.textContent = "已复制 " + label;
      } catch {
        copy.textContent = "复制受限，请选中结果或下载";
      }
    });
    const save = button("下载 " + label, () =>
      download("horizon." + suffix, session.result?.[key] ?? ""),
    );
    exports.append(copy, save);
    exportButtons.push(copy, save);
  }
  exports.append(
    button("下载诊断与覆盖 JSON", () =>
      download(
        "horizon-audit.json",
        JSON.stringify(
          {
            coverage,
            registry,
            result: session.result,
            decisions: session.decisions,
          },
          null,
          2,
        ),
        "application/json",
      ),
    ),
  );
  const mapping = el("details");
  mapping.append(el("summary", "原文 ↔ 盲文位置与规则"));
  const selectedText = el("p");
  mapping.append(selectedText);
  const cells = el("div");
  mapping.append(cells);
  root.append(mapping);
  const diagnostics = el("details");
  diagnostics.open = true;
  diagnostics.append(el("summary", "诊断与未完整处理项"));
  const issues = el("div");
  diagnostics.append(issues);
  root.append(diagnostics);
  const pageList = <T>(
    container: HTMLElement,
    items: T[],
    page: number,
    setPage: (n: number) => void,
    render: (item: T) => HTMLElement,
  ) => {
    container.replaceChildren();
    const max = Math.max(1, Math.ceil(items.length / 30));
    page = Math.min(page, max - 1);
    const nav = el("div", "", "toolbar");
    const navigate = (n: number, direction: 0 | 1) => {
      setPage(n);
      const buttons =
        container.querySelectorAll<HTMLButtonElement>(".toolbar > button");
      const target = buttons[direction];
      (target?.disabled ? buttons[1 - direction] : target)?.focus();
    };
    const prev = button("上一页", () => navigate(page - 1, 0));
    prev.disabled = page === 0;
    const next = button("下一页", () => navigate(page + 1, 1));
    next.disabled = page + 1 >= max;
    nav.append(
      prev,
      el("span", `第 ${page + 1}/${max} 页，共 ${items.length} 项`),
      next,
    );
    container.append(nav);
    for (const item of items.slice(page * 30, (page + 1) * 30))
      container.append(render(item));
  };
  const focusSpan = (span: SourceSpan) => {
    selected = span;
    if (options.compact) sourceFold.open = true;
    input.focus();
    input.setSelectionRange(
      sourceToView[span.start] ?? input.value.length,
      sourceToView[span.end] ?? input.value.length,
    );
    fillSelection();
    mapping.open = true;
    renderMappings();
  };
  const fillSelection = () => {
    selected = {
      start: viewToSource[input.selectionStart] ?? session.source.length,
      end: viewToSource[input.selectionEnd] ?? session.source.length,
    };
    start.value = String(selected.start);
    end.value = String(selected.end);
    const syllables =
      session.result?.metadata.chineseWords
        .flatMap((w) => w.syllables)
        .filter(
          (s) => s.span.start >= selected.start && s.span.end <= selected.end,
        ) ?? [];
    if (
      syllables.length &&
      syllables.map((s) => s.raw).join("") ===
        session.source.slice(selected.start, selected.end)
    )
      reading.value = syllables.map((s) => s.reading).join(" ");
  };
  const renderMappings = () => {
    const r = session.result;
    selectedText.textContent = `所选原文 [${selected.start}, ${selected.end})：${session.source.slice(selected.start, Math.min(selected.end, selected.start + 160))}`;
    const mappings = r?.mappings ?? [];
    pageList(
      cells,
      mappings,
      mappingPage,
      (n) => {
        mappingPage = n;
        renderMappings();
      },
      (m) => {
        const text =
          r!.pages[m.page]?.[m.row]?.slice(m.column, m.column + m.length) ?? "";
        const b = button(
          `第${m.page + 1}页 ${m.row + 1}行 ${m.column + 1}格 · ${text || "（控制/省略）"} · ${m.kind} · 原文[${m.span.start},${m.span.end})`,
          () => focusSpan(m.span),
        );
        b.className = "mapping";
        const active =
          m.span.start < selected.end && m.span.end > selected.start;
        b.classList.toggle("selected", active);
        b.setAttribute("aria-pressed", String(active));
        const atom = m.atomIndex === null ? undefined : r!.atoms[m.atomIndex];
        if (atom) {
          const rule = registry.find((x) => x.id === atom.ruleId);
          b.title = `${atom.ruleId} · ${rule ? (statusLabels[rule.status] ?? rule.status) : "结构/占位或未登记规则"}`;
          b.append(el("small", " · " + b.title));
        }
        return b;
      },
    );
  };
  input.onselect = () => {
    fillSelection();
    const i =
      session.result?.mappings.findIndex(
        (m) => m.span.start < selected.end && m.span.end > selected.start,
      ) ?? -1;
    if (i >= 0) mappingPage = Math.floor(i / 30);
    renderMappings();
  };
  const render = () => {
    const r = session.result;
    root.dataset.semanticRevision = String(session.semanticRevision);
    root.dataset.layoutRevision = String(session.layoutRevision);
    root.dataset.resultSource = r?.document.source ?? "";
    state.textContent = session.busy
      ? "正在本地转换…"
      : session.onlineBusy
        ? "正在请求在线消歧；仍可编辑与调整排版。"
        : r
          ? `${r.complete ? "当前输入转换完整" : "当前输入尚未完整处理"} · 语义${session.encoded?.complete ? "完整" : "待修订"} · 排版${r.diagnostics.some((d) => d.code.startsWith("layout-") && d.severity === "error") ? "失败" : "可用"} · ${r.pages.length} 页 · ${r.layoutProfile.columns} 方/行`
          : "暂无结果";
    error.textContent = session.error;
    resolve.disabled = session.busy || session.onlineBusy || !r;
    cancel.disabled = !session.onlineBusy;
    output.value = r?.unicode ?? "";
    brf.value = r?.brf ?? "";
    comparison.replaceChildren();
    const aligned = r ? alignedLines(r) : [];
    const pageCount = Math.max(1, Math.ceil(aligned.length / 10));
    alignmentPage = Math.max(0, Math.min(alignmentPage, pageCount - 1));
    comparisonPosition.textContent = `中盲文逐词对照 · ${alignmentPage + 1}/${pageCount} 组`;
    previousAlignment.disabled = alignmentPage === 0;
    nextAlignment.disabled = alignmentPage >= pageCount - 1;
    for (const line of aligned.slice(alignmentPage * 10, (alignmentPage + 1) * 10)) {
      const row = el("div", "", "aligned-preview-row");
      for (const unit of line) {
        const tile = el("button", "", `aligned-preview-unit kind-${unit.kind}`);
        tile.type = "button";
        tile.style.setProperty("--cells", String(unit.cells.length));
        tile.dataset.sourceStart = String(unit.span.start);
        tile.dataset.sourceEnd = String(unit.span.end);
        tile.title = `${unit.source || "排版空方"} · 原文 [${unit.span.start}, ${unit.span.end})`;
        tile.setAttribute("aria-label", tile.title);
        tile.append(el("small", unit.continued && unit.source ? `${unit.source}（续）` : unit.source || " "),
          el("span", unit.cells, "aligned-preview-cells"));
        tile.onclick = () => focusSpan(unit.span);
        row.append(tile);
      }
      comparison.append(row);
    }
    for (const b of exportButtons) b.disabled = !r || !r.unicode;
    pageList(
      words,
      r?.metadata.chineseWords.filter((w) => w.kind === "chinese") ?? [],
      wordPage,
      (n) => {
        wordPage = n;
        render();
      },
      (w) => {
        const b = button(
          `${w.raw} · ${w.syllables.map((s) => s.reading).join(" ")} · ${labels[w.source]} · ${w.syllables.map((s) => labels[s.resolutionSource ?? s.source]).join("/")}`,
          () => {
            focusSpan(w.span);
            manual.open = true;
            reading.focus();
          },
        );
        b.className = "word";
        return b;
      },
    );
    pageList(
      choices,
      session.ambiguities,
      ambiguityPage,
      (n) => {
        ambiguityPage = n;
        render();
      },
      (a) => {
        const row = el("div", "", "choice");
        row.append(
          button(
            `${a.kind === "colon" ? "冒号" : "多音字"} [${a.span.start},${a.span.end}) ${session.source.slice(a.span.start, a.span.end)}`,
            () => focusSpan(a.span),
          ),
        );
        const current = session.decisions?.resolutions.find(
          (x) => x.id === a.id,
        );
        const s = select(row, `候选 ${a.span.start}`, [
          ["", "待人工选择"],
          ...a.candidates.map((c) => [c.id, labels[c.id] ?? c.id] as const),
        ]);
        s.value = current?.choice ?? "";
        s.dataset.ambiguity = a.id;
        s.onchange = async () => {
          if (!s.value) return;
          const focused = document.activeElement === s,
            source = session.source;
          await session.choose(a.id, s.value);
          if (
            focused &&
            document.activeElement === document.body &&
            source === session.source
          )
            root
              .querySelector<HTMLElement>(
                `[data-ambiguity="${CSS.escape(a.id)}"]`,
              )
              ?.focus();
        };
        row.append(
          el(
            "span",
            current
              ? `来源：${labels[current.source]}${current.confidence === undefined ? "" : ` / 置信度 ${current.confidence}`}`
              : "来源：未确定",
          ),
        );
        return row;
      },
    );
    pageList(
      issues,
      r?.diagnostics ?? [],
      diagnosticPage,
      (n) => {
        diagnosticPage = n;
        render();
      },
      (d) => {
        const row = el("div", "", "diagnostic " + d.severity);
        row.append(
          button(
            `${d.severity === "error" ? "错误" : d.severity === "warning" ? "待核验" : "说明"} · ${d.code} · [${d.span.start},${d.span.end})`,
            () => focusSpan(d.span),
          ),
          el("p", d.message),
        );
        if (d.ruleId) row.append(el("small", "规则：" + d.ruleId));
        return row;
      },
    );
    renderMappings();
    if (r) options.onResult?.(r);
    scheduleAuto();
  };
  session.onChange = render;
  function setSource(source: string) {
    input.value = source;
    sourceToView = [];
    viewToSource = [0];
    let view = 0;
    for (let i = 0; i < source.length; i++) {
      sourceToView[i] = view;
      if (source[i] === "\r" && source[i + 1] === "\n")
        sourceToView[++i] = view;
      viewToSource[++view] = i + 1;
    }
    sourceToView[source.length] = view;
    selected = { start: 0, end: 0 };
    diagnosticPage = wordPage = ambiguityPage = mappingPage = 0;
    alignmentPage = 0;
    reading.value = "";
    manualFeedback.textContent = "";
    void session.setSource(source);
  }
  input.oninput = () => setSource(input.value);
  setSource(options.source ?? examples[2][1]);
  void checkService();
  return {
    setSource,
    dispose() {
      disposed = true;
      if (autoTimer) clearTimeout(autoTimer);
      userKey = "";
      keyInput.value = "";
      session.dispose();
      root.remove();
    },
    session,
  };
}
