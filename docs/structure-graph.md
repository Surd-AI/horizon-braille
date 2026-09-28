# 显式结构图子集

`encodeStructureGraph` 是独立的、有限范围的二维结构输入接口。调用方必须提供原图中每个原子的元素、行列坐标和键的连接；转换器不会从普通文本或 `\ce{...}` 猜测这些信息。

```ts
import { encodeStructureGraph } from "simpletex-braille";

const result = encodeStructureGraph({
  atoms: [
    { id: "left", element: "H", row: 1, column: 1 },
    { id: "center", element: "O", row: 1, column: 2 },
    { id: "right", element: "H", row: 1, column: 3 },
  ],
  bonds: [
    { from: "left", to: "center", order: 1 },
    { from: "center", to: "right", order: 1 },
  ],
});
if (!result.complete) throw new Error(result.reason);
console.log(result.cells, result.traversal);
```

当前仅接受单行、相邻坐标、无环且无分支的水平直链，最多 9 个原子，坐标均为 1–9。位置标记参考 GB/T 18028—2010 §8.4.1、§8.4.2.9；单、双、三水平键使用已实现的符号。断开、环、分支、斜键、竖键、重叠、未知元素和无效坐标会返回 `complete:false`、空 `cells` 与原因。

该 API 尚未接入普通文档解析或出版排版。它不支持标准中完整的空间结构式与自动图形识别，也不意味着 §8.4.2.9 已全面验证。调用方应保留原图并核对输出。
