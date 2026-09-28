import type { UnifiedConversionResult } from "../../../packages/core/src/convert";
import type { SourceSpan } from "../../../packages/core/src/model";

export interface AlignedUnit {
  source: string;
  cells: string;
  span: SourceSpan;
  kind: "word" | "formula" | "atom" | "spacing";
  continued: boolean;
}

/** A display-only view of physical cells; the mappings remain the authority. */
export function alignedLines(result: UnifiedConversionResult): AlignedUnit[][] {
  const source = result.document.source;
  const words = result.metadata.chineseWords.filter(word => word.kind === "chinese");
  const formulas = result.document.nodes.filter(node =>
    ["inline-math", "display-math", "bare-math", "chemistry"].includes(node.kind));
  const owners = result.lines.map(line => Array<typeof result.mappings[number] | undefined>(line.length));
  for (const mapping of result.mappings) {
    const row = owners[mapping.line];
    if (!row || mapping.omittedAtWrap) continue;
    for (let column = mapping.column; column < Math.min(row.length, mapping.column + mapping.length); column++)
      row[column] = mapping;
  }
  const seen = new Set<string>();
  return result.lines.map((line, lineIndex) => {
    const units: AlignedUnit[] = [];
    let previousKey = "";
    for (let column = 0; column < line.length; column++) {
      const mapping = owners[lineIndex][column];
      let span = mapping?.span ?? {start: 0, end: 0};
      let kind: AlignedUnit["kind"] = "spacing";
      if (mapping && ["atom", "continuation"].includes(mapping.kind) && span.end > span.start) {
        const formula = formulas.find(node => node.span.start <= span.start && node.span.end >= span.end);
        const word = formula ? undefined : words.find(item => item.span.start <= span.start && item.span.end >= span.end);
        if (formula) { span = formula.span; kind = "formula"; }
        else if (word) { span = word.span; kind = "word"; }
        else kind = "atom";
      }
      const key = kind === "spacing" ? `spacing:${lineIndex}:${column}` : `${kind}:${span.start}:${span.end}`;
      if (key !== previousKey) {
        units.push({ source: kind === "spacing" ? "" : source.slice(span.start, span.end),
          cells: "", span: {...span}, kind, continued: seen.has(key) });
        seen.add(key);
        previousKey = key;
      }
      units.at(-1)!.cells += line[column];
    }
    return units;
  });
}
