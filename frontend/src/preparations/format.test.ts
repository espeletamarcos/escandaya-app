import { describe, expect, it } from "vitest";
import { coversText, formatDate, missingText } from "./format";

describe("coversText", () => {
  it.each<[number | null, string]>([
    [40, "40 raciones"],
    [1, "1 ración"],
    [null, "Raciones: falta"],
  ])("%s → %s", (covers, text) => {
    expect(coversText(covers)).toBe(text);
  });
});

describe("missingText", () => {
  it.each<[number, string]>([
    [0, "Completa"],
    [1, "Falta 1 dato"],
    [3, "Faltan 3 datos"],
  ])("%i → %s", (count, text) => {
    expect(missingText(count)).toBe(text);
  });
});

describe("formatDate", () => {
  it("shows the date and time in Spanish, in the given time zone", () => {
    const text = formatDate("2026-11-14T12:30:00Z", "Europe/Madrid");

    expect(text).toContain("14 nov 2026");
    expect(text).toContain("13:30");
  });

  it("follows the time zone: the same moment is 12:30 in UTC", () => {
    expect(formatDate("2026-11-14T12:30:00Z", "UTC")).toContain("12:30");
  });
});
