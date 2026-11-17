# 09 – Tasks

Each screen task ends with a screenshot of the running app at 390 px next to its mockup in `docs/design/`, and the differences fixed or written under the task. All tests pass after every task (09-C9).

## Foundations
- [x] Write a test, then add `frontend/scripts/check-colors.mjs` (fails on hex, `rgb(` or `hsl(` in any stylesheet under `frontend/src` except `index.css`) and run it from `npm run lint` after ESLint. It fails on today's code until the screens are restyled, so it is switched on in the last screen task (09-C1)
- [x] With your go-ahead, add Sofia Sans and Sofia Sans Condensed as variable `woff2` files with `OFL.txt` in `frontend/src/fonts/`, and the `@font-face` rules with `font-display: swap` (09-C2)
  - One file per family, subset by us from the full variable fonts: Google's Latin subsets leave out "≈". How they were built is in `frontend/src/fonts/README.md`.
- [x] Rewrite `index.css`: the tokens from the mockups, the base styles (body, buttons, fields, focus ring, text selection, tabular figures) and `.visually-hidden`; remove the Vite template and its unused images; `viewport-fit=cover` and `color-scheme: light` in `index.html`; the manifest colours in `vite.config.ts` (09-C1, 09-C10)
  - Also shared classes `.panel`, `.button-primary`, `.button-quiet` and `.message-error`, a `theme-color` meta, and a reduced-motion rule. The favicon and the PWA icons stay as they are: a new app icon is out of scope.
- [x] Write tests, then add `ScreenTitle` (the `h1` on the tilted tape) and `EstimatedMark` ("≈" with "estimado" for screen readers) in `frontend/src/ui/` (09-C3, 09-C7)
- [ ] Turn the navigation into the bottom tab bar: fixed, clear of the home indicator, icons, the active tab on its pill; compare with any screen of `docs/design/` (09-C3, 09-C5)

## Screens
- [ ] Access screen (Screens 7): title on tape, the token field and the primary button, the error (09-C3, 09-C7)
- [ ] Record screen at rest and recording (Screens 1 and 2, `1-nueva-ficha`, `2-grabando`): the 148 px record button, "GRABANDO" with the timer and the stop button, the steps panel for recording, transcribing and creating the sheet, the notices and errors (09-C3, 09-C4, 09-C7)
- [ ] Write the 09-C8 tests, then change `SheetForm` to edit by line: the open-line state, closed lines as buttons with `aria-expanded`, "Listo", one line open at a time, focus on open, close, add and delete, and the name, yield and covers in the header opening the same way. No styling yet (09-C8)
- [ ] Style the draft sheet and its open line (Screens 3 and 4, `3-ficha-sin-confirmar`, `4-ficha-linea-abierta`): title on tape, yield and covers, the date, the ingredients panel with "≈" and "FALTA", the open line with its 48 px fields, "Eliminar" and "Listo", the hint, the error and "Confirmar ficha" (09-C3, 09-C4, 09-C7)
- [ ] Saved sheet (Screens 6, `6-ficha-guardada`): "‹ Preparaciones", the read-only sheet with `EstimatedMark`, "Confirmada el …"; update the `SheetView` tests for "≈" (09-C3, 09-C7, 09-C9)
- [ ] Preparations list (Screens 5, `5-preparaciones`): title and count, the panel with green names, covers, date and missing count; loading, error with "Reintentar", empty state and the "Ficha guardada" notice. Switch on the colour check in `npm run lint` (09-C1, 09-C3, 09-C7)

## Checks and finish
- [ ] Run `impeccable detect` on the changed files and an Impeccable audit of every screen; fix what they find (contrast, touch targets, focus, states) or explain each remaining finding here (09-C4, 09-C6)
- [ ] Take screenshots of every screen and state at 390 px into `.impeccable/review/` and run the finish reviewer with the direction contract and the PNGs in `docs/design/`; fix its findings or explain them here (09-C3)
- [ ] Write `DESIGN.md` and `.impeccable/design.json` with the documenter, from the built app (09-C10)
- [ ] Deploy and check on the iPhone, recorded here with the date:
  - Every screen next to its PNG.
  - The fonts come from the app's own origin (network panel), and the system font takes over if they fail.
  - The tab bar is clear of the home indicator; the keyboard does not cover an open line.
  - The app stays light with the iPhone in dark mode.

  (09-C2, 09-C3, 09-C5)
