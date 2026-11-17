// Fails when a stylesheet under src/ uses a raw colour instead of a token (09-C1).
// Only index.css may define colours: it holds the tokens. Run by `npm run lint`.
//
//   node scripts/check-colors.mjs [folder]   (default: src)

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ALLOWED = "index.css";
const COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/gi;
// A declaration's value: after a colon, up to ";" or "}". A selector such as
// "a:hover {" or a media query ends in "{", so it never matches.
const DECLARATION = /:([^;{}]*)(?=[;}])/g;

/** Comments replaced by spaces, so positions (and line numbers) stay the same. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

/** The raw colours in a stylesheet's declarations, with the line of each. */
export function findRawColors(css) {
  const clean = stripComments(css);
  const found = [];
  for (const declaration of clean.matchAll(DECLARATION)) {
    const valueStart = declaration.index + 1;
    for (const color of declaration[1].matchAll(COLOR)) {
      found.push({ line: lineAt(clean, valueStart + color.index), text: color[0] });
    }
  }
  return found;
}

function stylesheets(dir) {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

/** Every raw colour in the stylesheets under `dir`, except in its index.css. */
export function checkDir(dir) {
  return stylesheets(dir)
    .map((path) => relative(dir, path))
    .filter((file) => file !== ALLOWED)
    .flatMap((file) =>
      findRawColors(readFileSync(join(dir, file), "utf8")).map((color) => ({ file, ...color })),
    );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] ?? join(fileURLToPath(new URL("..", import.meta.url)), "src");
  const problems = checkDir(dir);
  for (const { file, line, text } of problems) {
    console.error(`${join(relative(process.cwd(), dir), file)}:${line}  raw colour ${text}: use a token from index.css`);
  }
  if (problems.length > 0) {
    console.error(`\n${problems.length} raw colour(s) outside index.css (09-C1).`);
    process.exit(1);
  }
}
