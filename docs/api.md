# 核心接口

包入口 simpletex-braille 同时导出运行时函数和 TypeScript 类型。核心是同步的离线编码/排版库；resolveAmbiguities 为可选异步消歧层，仅在调用方显式提供 provider 时才可能调用外部逻辑。

| 函数 | 返回及用途 |
|---|---|
| convert(source, options?) | UnifiedConversionResult，直接编码并排版 |
| encodeDocument(source, options?) | EncodedDocument，包含 document、atoms、diagnostics、complete、unhandled、metadata |
| reflowExistingAtoms(encoded, publishingOptions?) | UnifiedConversionResult，复用原子重新排版 |
| collectAmbiguities(source, options?) | 当前冒号/多音字候选，保留原文 UTF-16 区间 |
| resolveAmbiguities(source, options?) | Promise，源文本绑定的决策集；可提供 manual/provider/signal |
| convertWithResolutions(source, decisions, options?) | EncodedDocument；后续使用 reflowExistingAtoms 排版 |

UnifiedConversionResult 包含 document、atoms、lines、pages、unicode、brf、diagnostics、complete，并提供 unhandled、metadata、mappings、layoutProfile。unicode / brf 是直接字符串字段，不是 exports 对象。完整类型和参数以生成的声明文件为准。

mode 可选 document（默认混合识别）、text（字面文本）、math、chemistry、physics。columns/rows 控制版心，paragraphIndent 控制缩进；默认 30 列、25 行、缩进 2 格。此默认是编辑策略，不能宣称通用标准版式。recognizeMath/recognizeChemistry 为独立混合识别开关。文档模式默认识别受支持的 Markdown 标题、列表和分隔线标记；recognizeMarkdownMarkers: false 可关闭标记解释，核心与 API 均接受此布尔参数。代码范围采用独立的字面内容策略。text 和显式学科模式始终保留自身输入规则。

所有原文区间采用 UTF-16 半开区间 [start,end)。手工读音和决策绑定原文；编辑原文会使旧决策失效。诊断可同时包含信息、歧义和不支持项。complete 不是全标准支持声明。不支持部分不会取消其余内容的转换：原文、未处理区间和可用盲文仍会返回；未知字母命令还保留“原文命令＋拼写”的盲文说明。下游不能仅因 complete 为 false 就隐藏全部结果。

严格排版失败时，unicode/brf 分页输出可能为空，但 preview 提供已编码内容的未分页预览以及 truncated 标记。编辑器可显示 preview.unicode ?? unicode，让用户继续修改；该预览不能当作已完成排版的出版文件。

fontPolicy 和 symbolPolicy 默认 describe-unmapped，已登记但未声明原生点位的字体/符号使用明确、保留范围的可读说明。review-unmapped 保留待核对标记。未登记语义、中文读音歧义和不完整结构仍会诊断；说明保留输入含义或字形身份，不会自动证明整条公式准确。详见[命令兼容范围](tex-command-compatibility.md)。

数学默认采用 roman-light-normalized 字体策略；保留受支持的显式样式，不承诺原 TeX 字体保真。化学是有界语法，不能做配平、价态或任意 mhchem 校验。详见 [支持范围](standard-coverage.md)。

可选 `wordBoundaries: SourceSpan[]` 接收按原文 UTF-16 排序的自动词界提案。每段必须覆盖完整汉字，不得重叠或跨标点、公式语法；涉及的连续汉字区间须完整分割。它不读取网络，也不替代人工 `overrides`；已有有界重复/后缀规则仍会规范化自动提案。来源绑定、完整覆盖校验、会话取消和可选 `/segment` 接口见[分词说明](segmentation.md)。
