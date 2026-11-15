# 09 – Styling

Status: approved

## Why
The app works, but it still wears the Vite starter template: purple accent, generic layout, small controls and a sheet that is hard to read on the iPhone. The chef should open a tool that looks made for a kitchen, where the sheet reads at a glance and every control is easy to tap. This spec gives the whole app one consistent look before specs 06 and 07 add more screens.

## Scope
- The visual direction chosen on 2026-11-15 ("B · La cinta de carrocero"), as recorded in `PRODUCT.md` and in the direction contract `.impeccable/surfaces/frontend-src-app-tsx.md`. The reference mockups are in `docs/design/` (a PNG and an HTML file per screen), exported from the Design canvas (https://claude.ai/artifact/1EXpL5vayJdSi88sqRBvzu, page "Ronda 2"). The screens are described one by one in Screens, below.
- Design tokens in `frontend/src/index.css` as CSS custom properties: colours, fonts, type scale, spacing, radii and shadows. The Vite template styles are removed. Screen stylesheets use the tokens and no raw colours.
  - Ground: very light steel (`#EDF0F1`), white panels, near-black ink (`#16191D`).
  - Primary: light green `#A9E07F`, always as a fill under dark text (primary buttons, active tab, the ring of the record button, screen-title tape).
  - Green text `#4C9A2A` for preparation names in lists, at 20px bold or larger.
  - Blue `#1D4EB8` with "≈" for estimated values; red `#C42F27` for dates and the "Falta" mark.
- Fonts: Sofia Sans for text and Sofia Sans Condensed for small labels and the title tape, with tabular figures. Served by the app itself, not by a third-party font host.
- Screen titles on a strip of light green masking tape: uppercase condensed, dark text, tilted slightly, torn ends and a soft shadow, so it reads as tape stuck on and not as a highlighter.
- A bottom tab bar with "Nueva ficha" and "Preparaciones", fixed at the bottom, clear of the iPhone home indicator. The active tab sits on a light green pill.
- Every existing screen and state restyled, with no change in behaviour except how the sheet is edited (below):
  - Access screen (no token).
  - Record screen: idle, recording with the timer, transcribing, creating the sheet, and its errors and notices ("No se ha detectado voz", "No parece una preparación").
  - Editable sheet: "Falta" marks, the hint, the error and "Confirmar", with the new way of editing below.
  - Preparations list: loading, error with "Reintentar", empty state, the "Ficha guardada" notice and the list.
  - Saved sheet (read-only) with "Volver".
- Editing the sheet by tapping a line (the one behaviour change in this spec, decided by the owner on 2026-11-15). The draft sheet reads like the saved one: each line shows its name, quantity and unit, with its "≈" and "Falta" marks. Tapping a line opens it in place with its fields (name, quantity, unit, "Estimado", "Eliminar") and a "Listo" button that closes it. The header works the same way: the name, the yield and the covers each open their own fields. Only one line is open at a time: opening another closes the current one and keeps its edits. "Añadir ingrediente" adds a new line already open.
- Section labels ("INGREDIENTES", "CANTIDAD", "IMPORTE") in dark ink: green is kept for titles, names and actions.
- Touch targets of at least 44×44 px everywhere; the record and stop button at least 120 px.
- Visible keyboard focus, themed text selection, and every state styled: hover, pressed, disabled, loading and error.
- The PWA manifest colours (`theme_color`, `background_color`) match the new ground.
- `DESIGN.md` at the repo root, written from the built app at the end, so later specs reuse the same system.
- All user-facing text stays in Spanish. Copy changes only where a mark becomes visual: the estimated mark is shown as "≈" in blue, and screen readers still hear "estimado".

## Screens
Each screen is built to match its mockup in `docs/design/`. Every screen has the tab bar at the bottom ("Nueva ficha", "Preparaciones"), with the active tab on a light green pill, except the access screen. Costs, prices and the "% estimado" share in the mockups are example data: until specs 06 and 07, those places are left out, not filled with placeholders.

1. **Nueva ficha, at rest** (`1-nueva-ficha`). The title "NUEVA FICHA" on its tape at the top left. In the middle, the record button: a light green circle of about 148 px with a microphone and "Grabar". Below it, the hint "Di el nombre, cuánto sale, para cuántas raciones y qué lleva." and a short spoken example.
2. **Grabando** (`2-grabando`). Same title. "GRABANDO" in red with a red dot, the timer large (72 px) under it, and the stop button: a dark circle with a white square and a light green ring. Under the hint, a white panel with the three steps (Grabar, Transcribir, Crear ficha); the current one is bold with its state in red ("Ahora"), the others grey. The transcribing and creating states reuse this panel with the next step marked. The notices ("No se ha detectado voz", "No parece una preparación") and errors appear between the button and the panel.
3. **Ficha sin confirmar** (`3-ficha-sin-confirmar`). The preparation name on its tape. Under it, the yield and covers ("2 kg · ≈ 40 raciones · sin confirmar") and the date in red on the right. One white panel with the heading row (INGREDIENTES, Cantidad) and a line per ingredient: name, quantity with its unit, "≈" in blue when estimated, the "FALTA" mark in red when a value is missing. "Añadir ingrediente" in green closes the panel. Under it, the legend "≈ en azul: estimado. Toca una línea para corregirla." and the full-width light green "Confirmar ficha". The hint for an empty name and the confirm error sit just above the button. The cost block and the "Importe" column of the mockup wait for spec 07.
4. **Ficha, línea abierta** (`4-ficha-linea-abierta`). The same sheet with one line open in place, on a very light green ground: the line itself stays at the top in bold, then the fields (Nombre; Cantidad and Unidad side by side; the "Estimado" checkbox), then "Eliminar" in red on the left and "Listo" in light green on the right. Fields are 48 px tall with their label above. The name, yield and covers in the header open the same way.
5. **Preparaciones** (`5-preparaciones`). The title "PREPARACIONES" on its tape and the count ("5 fichas") on the right. One white panel with a line per preparation, newest first: the name in green (20 px bold), and under it the covers ("≈" in blue when estimated), the date and "1 falta" in red when data is missing. The cost per serving on the right waits for spec 07. The loading state, the error with "Reintentar", the empty state ("Aún no hay preparaciones") and the "Ficha guardada" notice use the same panel and type; they have no mockup of their own.
6. **Ficha guardada** (`6-ficha-guardada`). "‹ Preparaciones" in green at the top left to go back, then the same layout as the draft sheet, read-only: the name on its tape, yield and covers, the date, "Confirmada el …", and the ingredients panel without "Añadir ingrediente" or "Confirmar". The lines are not buttons.
7. **Acceso privado** (no mockup). The title on its tape, the sentence "Para usar Escandaya, abre la app desde tu enlace privado.", the token field and its button styled like the fields and the primary button of screen 4, and the error in red. No tab bar.

## Out of scope
- Showing costs. The mockups have example costs; the real figures arrive with specs 06 and 07, and their layout is designed then on top of these tokens.
- A dark theme. The app stays light even when the iPhone is in dark mode.
- Any other behaviour change: what is saved, the confirm flow, navigation and the API stay as in specs 04 and 05.
- The third tab (Prices) and any new screen.
- A new app icon and splash screen.
- Motion beyond small state transitions (pressed buttons, the recording indicator).
- A desktop layout. On a wide screen the app stays a centred phone-width column.

## Acceptance criteria
Each one must be checkable with a test or a manual check.

- **09-C1**: `index.css` defines the tokens and nothing from the Vite template is left (`--accent: #aa3bff`, `#social`, `.counter`). A check fails if any other stylesheet in `frontend/src` contains a raw colour (hex, `rgb(`, `hsl(`) instead of a token (script run by `make lint`).
- **09-C2**: Sofia Sans and Sofia Sans Condensed load from the app's own origin. Opening the deployed app makes no request to a font host outside it, and if the fonts fail to load the text falls back to the system sans without breaking the layout (manual check in the browser's network panel).
- **09-C3**: Every screen matches its mockup in `docs/design/`: titles on the tilted green tape, preparation names in green text, estimated values in blue with "≈", "Falta" marks in red, the white panels on the steel ground, and the light green primary button. Checked twice:
  - When each screen is built: a screenshot of the running app at 390 px wide is put side by side with its PNG, and every difference is fixed or written down in `tasks.md` (the deferred costs are expected differences).
  - At the end: Impeccable's finish reviewer gets the screenshots of every screen and the PNGs, and its findings are fixed or explained in `tasks.md`; then a manual check on the iPhone.
- **09-C4**: Interactive elements (buttons, tabs, inputs, selects, checkboxes with their label, list rows) are at least 44×44 px, and the record button is at least 120 px (frontend tests on the computed sizes where possible, and manual check).
- **09-C5**: The bottom tab bar stays at the bottom while the content scrolls, shows which section is active, and is not covered by the home indicator on the iPhone (manual check).
- **09-C6**: Text contrast is at least 4.5:1, or 3:1 for text of 20px bold or larger. Impeccable's detector (`impeccable detect`) and audit report no open findings, or each remaining one is explained in `tasks.md` (manual check plus the detector's output).
- **09-C7**: Every state listed in Scope is styled and reachable, keyboard focus is visible, and the estimated mark is read as "estimado" by screen readers (frontend tests for the accessible text, manual check for the rest).
- **09-C8**: Editing by tapping a line works (frontend tests):
  - Each line of the draft sheet is a button that names what it opens (for example "Editar Atún rojo, lomo") and says whether it is open.
  - Tapping it shows its fields and moves focus to the first one; "Listo" closes it and returns focus to the line.
  - Opening a second line closes the first and keeps its edits; the "Falta" marks update as values change, open or closed.
  - "Añadir ingrediente" adds a line already open with its name field focused; "Eliminar" removes the line.
  - The name, the yield and the covers open their own fields the same way.
  - "Confirmar" sends the same sheet as before, with or without a line open.
- **09-C9**: Nothing else changes in behaviour: the backend tests and the frontend tests for recording, the list, the saved sheet and navigation pass, changed only where the estimated mark becomes "≈" and where the sheet form is now opened line by line (`make test` and the frontend tests).
- **09-C10**: `DESIGN.md` exists and describes the built tokens, type, components and the tape rule; the manifest colours match the ground (review of the files).

## Edge cases
- A long preparation name on the title tape wraps onto a second line and the tape grows with it; it never overflows the screen.
- Long ingredient names wrap inside their row without pushing the quantity off screen.
- A sheet with many ingredients scrolls, and the "Confirmar" button and the tab bar stay reachable.
- The iOS keyboard open over the editable sheet: the field being edited stays visible and the tab bar does not cover it.
- The iPhone in dark mode: the app stays light and readable.
- Larger text in Safari (page zoom): the layout reflows without overlapping.
- The fonts fail to load (offline, blocked): the system font is used and nothing breaks.
- Several marks at once on one value (estimated and missing): both are readable and do not overlap.
- A line open with its name emptied: it shows "Falta" and "Confirmar" stays disabled, as today, whether the line is open or closed.
- Deleting the line that is open closes it, and focus moves to the next line, or to "Añadir ingrediente" if it was the last.
- A line with every value missing (a new ingredient left empty) still reads as a line in the closed sheet, with its "Falta" marks, so it can be found and opened again.
- A failed "Confirmar" keeps the edits and the line that was open, so the chef can retry or keep correcting.
