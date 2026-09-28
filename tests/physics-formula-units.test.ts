import { describe, expect, it } from "vitest";
import { encodePhysics } from "../packages/core/src/rules/physics";

const cells = (input: string) =>
  encodePhysics(input, { unit: true }).atoms.map((atom) => atom.cells).join("");

describe("GB/T18028 §7.2.3–7.2.4 physics formula versus unit product", () => {
  it("does not turn whitespace between quantity variables into a unit product", () => {
    expect(cells("F = m a")).toBe(cells("F=ma"));
    expect(cells("F = m a")).not.toContain("⠄");
  });

  it("preserves the explicit product dot between recognized units", () => {
    expect(cells("m s")).toContain("⠄");
    expect(cells("kg m/s^2")).toContain("⠄");
    expect(cells("1 J = 1 N m")).toContain("⠄");
    expect(cells("m/s")).not.toContain("⠄");
  });

  it("does not multiply a measured value by its adjacent unit", () => {
    expect(cells("3 m")).toBe(cells("3m"));
    expect(cells("5 kg")).toBe(cells("5kg"));
  });
});
