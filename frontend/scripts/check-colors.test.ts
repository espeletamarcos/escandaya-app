import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkDir, findRawColors } from "./check-colors.mjs";

describe("findRawColors (09-C1)", () => {
  it("finds hex, rgb and hsl colours in declarations, with their line", () => {
    const css = [
      ".a {",
      "  color: #fff;",
      "  background: rgba(0, 0, 0, 0.1);",
      "  border-color: hsl(10 20% 30%);",
      "  box-shadow: 0 1px 2px #16191D80;",
      "}",
    ].join("\n");

    expect(findRawColors(css)).toEqual([
      { line: 2, text: "#fff" },
      { line: 3, text: "rgba(" },
      { line: 4, text: "hsl(" },
      { line: 5, text: "#16191D80" },
    ]);
  });

  it("accepts tokens and colour functions built on them", () => {
    const css = ".a { color: var(--ink); background: color-mix(in srgb, var(--primary) 20%, transparent); }";
    expect(findRawColors(css)).toEqual([]);
  });

  it("ignores id selectors, pseudo-classes, media queries and comments", () => {
    const css = [
      "#add, #root:hover { margin: 0; }",
      "a:focus-visible { outline: 2px solid var(--focus); }",
      "@media (max-width: 1024px) { .a { padding: 0; } }",
      "/* was #aa3bff and rgb(1, 2, 3) */",
      ".b { color: var(--ink); /* not #fff */ }",
    ].join("\n");
    expect(findRawColors(css)).toEqual([]);
  });

  it("finds a colour in a nested rule", () => {
    const css = ".a {\n  &:hover {\n    color: #c42f27;\n  }\n}";
    expect(findRawColors(css)).toEqual([{ line: 3, text: "#c42f27" }]);
  });
});

describe("checkDir (09-C1)", () => {
  it("checks every stylesheet under the folder except index.css", () => {
    const root = mkdtempSync(join(tmpdir(), "check-colors-"));
    mkdirSync(join(root, "screens"));
    writeFileSync(join(root, "index.css"), ":root { --ink: #16191d; }");
    writeFileSync(join(root, "screens", "A.css"), ".a {\n  color: #fff;\n}");
    writeFileSync(join(root, "screens", "B.css"), ".b { color: var(--ink); }");
    writeFileSync(join(root, "screens", "C.tsx"), "const c = '#fff';");

    expect(checkDir(root)).toEqual([{ file: join("screens", "A.css"), line: 2, text: "#fff" }]);
  });
});
