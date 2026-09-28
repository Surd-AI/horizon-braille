import { convert } from "simpletex-braille";

const result = convert("中国", { mode: "text" });
console.log(result);
