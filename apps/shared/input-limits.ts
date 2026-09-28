/** Interactive editor/API bound, counted in Unicode code points, not UTF-16 units. */
export const EDITOR_MAX_CHARACTERS = 5000;
export const EDITOR_INPUT_LIMIT_MESSAGE = `单次最多转换 ${EDITOR_MAX_CHARACTERS} 个字符。原文已保留，请分段转换。`;
export function exceedsEditorInputLimit(source: string): boolean {
  let count = 0;
  for (const _ of source) if (++count > EDITOR_MAX_CHARACTERS) return true;
  return false;
}
