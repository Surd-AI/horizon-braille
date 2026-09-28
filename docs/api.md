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

mode 可选 document（默认混合识别）、text（字面文本）、math、chemistry、physics。columns/rows 控制版心，paragraphIndent 控制缩进；默认 30 列、25 行、缩进 2 格。此默认是编辑策略，不能宣称通用标准版式。recognizeMath/recognizeChemistry 为独立混合识别开关。

所有原文区间采用 UTF-16 半开区间 [start,end)。手工读音和决策绑定原文；编辑原文会使旧决策失效。诊断可同时包含信息、歧义和不支持项。complete 不是全标准支持声明；严格排版失败可保留原子和诊断但返回空输出。下游应检查 complete、diagnostics 与 unhandled，并提供人工复核。

数学默认采用 roman-light-normalized 字体策略；保留受支持的显式样式，不承诺原 TeX 字体保真。化学是有界语法，不能做配平、价态或任意 mhchem 校验。详见 [支持范围](standard-coverage.md)。

可选 `wordBoundaries: SourceSpan[]` 接收按原文 UTF-16 排序的自动词界提案。每段必须覆盖完整汉字，不得重叠或跨标点、公式语法；涉及的连续汉字区间须完整分割。它不读取网络，也不替代人工 `overrides`；已有有界重复/后缀规则仍会规范化自动提案。来源绑定、完整覆盖校验、会话取消和可选 `/segment` 接口见[分词说明](segmentation.md)。
