import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";
import { LATIN_DOTS } from "../packages/core/src/rules/math-symbols";

type AlphabetFixture = {
  id: string;
  input: { letters?: string };
  expectedDots: string[];
};
const fixtures = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "standards/gf0019.json"), "utf8"),
) as AlphabetFixture[];

for (const fixture of fixtures.filter((f) => typeof f.input.letters === "string"))
  test(`GF 0019 Annex C ${fixture.id}`, () => {
    const actual = [...fixture.input.letters!].map((letter) =>
      LATIN_DOTS[letter.charCodeAt(0) - 97],
    );
    expect(actual).toEqual(fixture.expectedDots);
  });
