# 09 – Plan

## Approach
Plain CSS, as today, on top of one set of tokens. `index.css` holds the tokens (custom properties), the `@font-face` rules, the base elements (body, buttons, fields, focus ring, text selection) and a few shared classes; each screen keeps its own stylesheet and uses only the tokens. We build bottom-up: the colour check, the fonts and the tokens first, then the shared pieces (screen title on tape, estimated mark, tab bar), then one screen at a time in the order of the mockups, and Impeccable's checks at the end.

- **Tokens.** Colours (`--ground`, `--panel`, `--ink`, `--ink-2`, `--rule`, `--primary` #A9E07F, `--on-primary`, `--green-text` #4C9A2A, `--green-action` #2D6A27, `--estimated` #1D4EB8, `--missing`/`--date` #C42F27 and its pale ground, `--tape-shadow`), type (two families, a size scale from 13 to 72 px, weights), spacing on a 4 px step, radii (8 and 10 px) and the two panel shadows. Values come from the mockups in `docs/design/*.html`.
- **Fonts.** Sofia Sans and Sofia Sans Condensed as variable `woff2` files (Latin and Latin Extended) in `frontend/src/fonts/`, with their OFL licence, loaded by `@font-face` with `font-display: swap`. Vite bundles and hashes them, so they come from the app's own origin. No new npm dependency.
- **Colour check.** A small Node script, `frontend/scripts/check-colors.mjs`, fails when a stylesheet other than `index.css` contains a hex, `rgb(` or `hsl(` colour. `npm run lint` runs it after ESLint, so `make lint` and CI catch it.
- **Shared pieces.**
  - `ScreenTitle`: the `h1` on the tilted light green tape (rotation, torn ends with `clip-path`, soft shadow), wrapping to two lines for long names.
  - `EstimatedMark`: "≈" in blue with a visually hidden "estimado", used by the draft sheet, the saved sheet and the list.
  - The tab bar in `App`: fixed to the bottom, padded with `env(safe-area-inset-bottom)` (with `viewport-fit=cover` in `index.html`), icons as inline SVG, the active tab on a pill from `aria-current="page"`.
- **Editing by line.** `SheetForm` keeps its reducer (`sheetEditor.ts`) and gains one piece of state: which line is open (`"name"`, `"yield"`, `"covers"`, an ingredient id, or none). A closed line is a `button` with `aria-expanded` and a name such as "Editar Lima"; an open line shows the same fields as today plus "Listo". Focus moves with refs: to the first field when a line opens, back to its button when it closes, to the next line (or "Añadir ingrediente") after "Eliminar". The edits and the "Falta" marks keep coming from the reducer, so what "Confirmar" sends does not change.
- **Comparing with the mockups.** Each screen task ends with a screenshot of the running app at 390 px (the in-app browser, or headless Chrome as used for `docs/design/`) saved in `.impeccable/review/`, put next to its PNG; differences are fixed or noted in `tasks.md`.
- **Impeccable at the end.** `impeccable detect` on the changed files, an audit, then the finish reviewer (`impeccable-finish-reviewer`) with the direction contract, the screenshots and the PNGs. After its fixes, the documenter (`impeccable-documenter`) writes `DESIGN.md` and `.impeccable/design.json` from the built app.

## Alternatives considered
- Fonts from the Google Fonts CDN: one line, but a request to a third party on every cold start, and the craft rules ask for self-hosted faces. Discarded.
- Fonts through `@fontsource-variable/*`: tidy, but two new dependencies for two files. Discarded; the files and their licence are committed instead.
- Tailwind or CSS modules: a new toolchain and a rewrite of every class for a six-screen app. Plain CSS with tokens matches the project.
- Stylelint for the colour rule: a new dependency and its config for one rule. A 30-line script does it.
- Editing a line in a bottom sheet or a modal: hides the rest of the sheet and is heavier to make accessible. The mockup opens the line in place.
- Showing costs as "—" placeholders now: the spec leaves them out until 07, so the layout is not built around fake numbers.

## Files touched
- `frontend/index.html`: `viewport-fit=cover`, `color-scheme`.
- `frontend/vite.config.ts`: manifest `theme_color` and `background_color`.
- `frontend/package.json`: the `lint` script also runs the colour check.
- `frontend/scripts/check-colors.mjs` and its test.
- `frontend/src/fonts/` (new): the four `woff2` files and `OFL.txt`.
- `frontend/src/index.css`: rewritten (tokens, fonts, base, shared classes). `frontend/src/App.css` and `App.tsx`: the tab bar.
- `frontend/src/ui/ScreenTitle.tsx`, `frontend/src/ui/EstimatedMark.tsx` (new) and their tests.
- `frontend/src/screens/*.css` and `*.tsx`: Access, Record, Preparations, Preparation.
- `frontend/src/sheet/SheetForm.tsx`, `SheetForm.css`, `SheetForm.test.tsx`: editing by line. `SheetView.tsx` and its test: the estimated mark.
- `frontend/src/assets/`: the unused Vite template images removed.
- `DESIGN.md`, `.impeccable/design.json` (new, at the end).
- `specs/09-styling/tasks.md`, `specs/README.md`.

## Risks
- The tilted tape with `clip-path` on a two-line name can look odd or cut letters. Mitigation: test with the longest real names and fall back to no torn ends on wrapped titles if needed.
- `#4C9A2A` on white is only about 3.5:1: fine for 20 px bold names, not for small text. The token is only used at that size; the detector and the audit check it.
- Rewriting the sheet form tests is the largest change. Mitigation: write the 09-C8 tests first and keep the reducer and its tests untouched.
- iOS Safari and the keyboard: the fixed tab bar can cover the field being edited. Mitigation: hide the tab bar while a field has focus, or make sure the open line scrolls into view; checked on the iPhone.
- `transform` on the title changes its painted box, not its layout box; the tape must not overlap the line below. Checked in each screenshot.
- The fonts are not precached by the service worker (it caches JS, CSS and HTML by default), so the first load without network shows the system font. Accepted: offline is out of scope.
