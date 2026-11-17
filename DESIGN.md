---
name: Escandaya
description: Escandallos por voz con coste por ración. A phone-first PWA labelled the way a kitchen labels its containers.
colors:
  ground: "#EDF0F1"
  panel: "#FFFFFF"
  ink: "#16191D"
  ink-2: "#4D555C"
  rule: "#E1E5E8"
  rule-strong: "#D5DADD"
  field-border: "#828B92"
  idle: "#C9D0D4"
  primary: "#A9E07F"
  primary-hover: "#9FD873"
  primary-pressed: "#93CF66"
  on-primary: "#13240F"
  primary-wash: "#F3F9EC"
  green-text: "#4C9A2A"
  green-action: "#2D6A27"
  estimated: "#1D4EB8"
  marker-red: "#C42F27"
  danger: "#B8261E"
  missing-bg: "#F6DAD6"
  missing-ink: "#9E231C"
  disabled-bg: "#DDE2E4"
  disabled-ink: "#4D555C"
  focus: "#1D4EB8"
  on-dark: "#FFFFFF"
typography:
  display:
    fontFamily: "Sofia Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "72px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tnum, lnum"
  headline:
    fontFamily: "Sofia Sans Condensed, Sofia Sans, Arial Narrow, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.02em"
  headline-long:
    fontFamily: "Sofia Sans Condensed, Sofia Sans, Arial Narrow, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.02em"
  title:
    fontFamily: "Sofia Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  button:
    fontFamily: "Sofia Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 800
  lead:
    fontFamily: "Sofia Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "Sofia Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum, lnum"
  small:
    fontFamily: "Sofia Sans, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  section-label:
    fontFamily: "Sofia Sans Condensed, Sofia Sans, Arial Narrow, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 800
    letterSpacing: "0.04em"
  label:
    fontFamily: "Sofia Sans Condensed, Sofia Sans, Arial Narrow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
  mark:
    fontFamily: "Sofia Sans Condensed, Sofia Sans, Arial Narrow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "0.04em"
rounded:
  field: "8px"
  panel: "10px"
  pill: "14px"
  round: "50%"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "9": "36px"
  "12": "48px"
  gutter: "20px"
  panel-inset: "12px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.panel}"
    padding: "0 20px"
    height: "56px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
  button-primary-disabled:
    backgroundColor: "{colors.disabled-bg}"
    textColor: "{colors.disabled-ink}"
  button-primary-compact:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.panel}"
    height: "48px"
    width: "120px"
  button-quiet:
    textColor: "{colors.green-action}"
    rounded: "{rounded.field}"
    padding: "0 12px"
    height: "44px"
  button-quiet-pressed:
    backgroundColor: "{colors.primary-wash}"
    textColor: "{colors.green-action}"
  button-delete:
    textColor: "{colors.danger}"
    rounded: "{rounded.field}"
    padding: "0 8px"
    height: "48px"
  field:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.lead}"
    rounded: "{rounded.field}"
    padding: "0 12px"
    height: "48px"
  field-label:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
  title-tape:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    padding: "8px 18px 6px"
  title-tape-long:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.ink}"
    typography: "{typography.headline-long}"
    width: "90%"
  tab-bar:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    height: "64px"
  tab-active-pill:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    padding: "2px 16px"
  record-button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.round}"
    size: "148px"
  record-button-again:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.round}"
    size: "120px"
  stop-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.round}"
    size: "132px"
  record-button-compact:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    padding: "0 16px 0 12px"
    height: "44px"
  list-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    padding: "14px 16px"
    height: "76px"
  list-row-name:
    textColor: "{colors.green-text}"
    typography: "{typography.title}"
  sheet-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "14px 16px"
    height: "52px"
  sheet-row-open:
    backgroundColor: "{colors.primary-wash}"
    textColor: "{colors.ink}"
    padding: "0 16px 16px"
  missing-mark:
    backgroundColor: "{colors.missing-bg}"
    textColor: "{colors.missing-ink}"
    typography: "{typography.mark}"
    padding: "2px 8px"
  estimated-value:
    textColor: "{colors.estimated}"
  step-row:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-2}"
    padding: "0 16px"
    height: "52px"
  step-row-now:
    textColor: "{colors.ink}"
---

# Design System: Escandaya

## Overview

**Creative North Star: "La cinta de carrocero"** (masking tape on the cold-room container)

Every screen is labelled the way a kitchen labels a container in the cold room: the title on a strip of light green masking tape stuck on slightly crooked, the date in red marker, estimates in blue marker. Everything else is quiet: a very light steel ground, white panels with soft depth, near-black ink, large plain type. The app is a tool the chef opens for a minute on an iPhone, so one calm task fills each screen and the controls are big.

Density is low and the rhythm is vertical: a title, one or two lines of meta, one white panel of rows, one full-width action. Colour is rationed and every colour means something. Light green is the only primary and always sits under dark text. Blue means "estimated" and nothing else in the content. Red means a date, a recording, or something missing. A reader should be able to tell firm numbers from estimates and gaps at a glance, without reading a legend.

The owner rejected the generic card dashboard of costing apps and the Vite starter look. The app is light only, and stays light when the phone is in dark mode.

**Key Characteristics:**
- Screen titles on a tilted, torn, shadowed strip of light green tape, never a flat band.
- Steel ground, white panels, near-black ink; colour only where it carries meaning.
- Light green as a fill under dark text; green as text only at name size.
- Marker blue with "≈" for estimated; marker red for dates, recording and "FALTA".
- Sofia Sans for reading, Sofia Sans Condensed uppercase for labels and the tape; tabular figures everywhere.
- Generous touch targets (44 px minimum, 48 px fields, 56 px primary button, 120 px or more for record).
- A centred phone-width column on any screen; a fixed two-tab bottom bar.

## Colors

A steel-and-paper neutral base with one light green accent and two marker colours, each with a single job.

### Primary
- **Tape Green** (`primary`): the fill of the title tape, the primary button, the active tab pill, the record button and the ring of the stop button. Always under dark text (`ink` or `on-primary`). Hover darkens to `primary-hover`, pressed to `primary-pressed`.
- **Kitchen-Dark Green Ink** (`on-primary`): the text and icons on a Tape Green fill.
- **Green Wash** (`primary-wash`): the ground of an open sheet line and the open header editor, and the pressed state of quiet buttons, rows and tabs. (Text selection uses Tape Green under Ink.)

### Secondary
- **Name Green** (`green-text`): preparation names in the list, at 20 px extra-bold or larger only (about 3.5:1 on white, which passes only at that size). Also the outline and border of a focused text field or select (a non-text use, 3:1 is enough).
- **Action Green** (`green-action`): small green text that must pass 4.5:1: quiet buttons ("Añadir ingrediente", "‹ Preparaciones", "Reintentar"), the check icon of "Ficha guardada" and of the spent "Transcribir y crear ficha", and the filled mark of a done step.

### Tertiary
- **Marker Blue** (`estimated`): an estimated value, always preceded by "≈" and followed by a hidden "(estimado)" for screen readers. Also the "≈ en azul" legend and the "≈" after the "Estimado" checkbox.
- **Focus Blue** (`focus`, same value as Marker Blue): the keyboard focus ring and the checkbox accent. It is a separate token so the focus colour can change without touching the estimated meaning.
- **Marker Red** (`marker-red`): the date on a sheet ("17 NOV"), "GRABANDO" and its dot, the current step's mark and "Ahora", missing values in the list ("Raciones: falta", "Falta 1 dato"), error messages and an invalid field's border.
- **Delete Red** (`danger`): the "Eliminar" text button.
- **Missing Sticker** (`missing-bg` ground, `missing-ink` text): the "FALTA" mark.

### Neutral
- **Steel Ground** (`ground`): the page, the browser chrome (`theme-color`) and the PWA manifest's `theme_color` and `background_color`.
- **Panel White** (`panel`): panels, the tab bar, fields.
- **Ink** (`ink`): body text, titles, the stop button's disc.
- **Ink Grey** (`ink-2`): secondary text: meta lines, hints, field labels, column headers, inactive tabs and steps, placeholders, "Sin nombre".
- **Rule** (`rule`): the 1 px divider between rows inside a panel. **Rule Strong** (`rule-strong`): the 1 px line on top of the tab bar.
- **Field Border** (`field-border`): the 1 px border of fields, chosen for 3:1 on white, the wash and the ground (the mockup's lighter grey failed).
- **Idle** (`idle`): the empty ring of a step not reached yet.
- **Disabled** (`disabled-bg`, `disabled-ink`): a disabled primary button.
- **On Dark** (`on-dark`): the white square in the stop button and the check inside a done step.

### Named Rules
**The Fill-Not-Ink Rule.** Tape Green is a fill under dark text, never a text colour and never a ground for white text. Green as text is Name Green at 20 px extra-bold or larger, or Action Green below that.

**The Marker Rule.** Blue appears in content only as an estimated value with its "≈", read as "(estimado)". Red appears only for a date, a live recording, something missing, or an error. No decorative blue or red, and no blue links.

**The One Stylesheet Rule.** Raw colours (hex, `rgb(`, `hsl(`) live only in `frontend/src/index.css`. Every other stylesheet uses the custom properties; `frontend/scripts/check-colors.mjs` fails `npm run lint` (and so `make lint` and CI) otherwise. A new colour is a new token in `index.css` first.

## Typography

**Display Font:** Sofia Sans Condensed (with Sofia Sans, Arial Narrow, system-ui) for the tape and labels
**Body Font:** Sofia Sans (with system-ui, -apple-system, Segoe UI, Roboto)

**Character:** a sturdy, friendly grotesque for reading, and its condensed cut, uppercase and heavy, for anything that is a label stuck on something. Both are variable fonts (weight 1 to 1000), self-hosted from `frontend/src/fonts/` (OFL), subset to Latin, Latin Extended, "≈" and "×", with `font-display: swap`; the system sans takes over if they fail. `font-synthesis: none`.

### Hierarchy
- **Display** (800, 72 px, line-height 1, -0.03em): the recording timer only. The limit beside it (" / 2:00") is 20 px bold Ink Grey.
- **Headline** (Condensed 800, 30 px, line-height 1.1, 0.02em, uppercase): the screen title on its tape. **Headline Long** (24 px) for titles over 24 characters.
- **Title** (800, 20 px, line-height 1.2, -0.01em): preparation names in the list (in Name Green), the "No se ha podido comprobar el acceso" problem line.
- **Button** (800, 17 px): primary buttons. The record button's "Grabar" is 18 px; inside the outline and compact record buttons it is 16 px.
- **Lead** (17 px, line-height 1.45): the access lead, the record hint, field text (17 px, so iOS Safari does not zoom), loading lines, the sheet meta line (weight 600), empty-state and notice titles (weight 800).
- **Body** (400, 16 px, line-height 1.4): sheet rows, panel text, quiet buttons (weight 700).
- **Meta** (15 px): the spoken example under the record hint, the spent "Transcribir y crear ficha" line.
- **Small** (14 px): list meta, the legend, the hint, the confirm error, "Sin confirmar", "Confirmada el …", the count ("5 fichas"), "Ahora".
- **Section Label** (Condensed 800, 15 px, 0.04em, uppercase): panel headings ("INGREDIENTES", "GRABACIÓN") and the sheet date in Marker Red; "GRABANDO" uses the same style at 16 px.
- **Label** (Condensed 700, 13 px, sentence case): field labels above fields ("Nombre", "Cantidad", "Unidad", "Enlace o código de acceso") and column headers ("Cantidad"), in Ink Grey. Tab labels are 13 px Sofia Sans 600, 800 when active.
- **Mark** (Condensed 800, 13 px, 0.04em, uppercase): the "FALTA" sticker.

Weights in use: 400, 600, 700, 800. No 300 or 900.

### Named Rules
**The Tabular Figures Rule.** The body sets `font-variant-numeric: tabular-nums lining-nums`, so quantities, dates and the timer align in columns. Never switch it off for numbers.

**The Uppercase-Is-A-Label Rule.** Uppercase Condensed is for things stuck on: the tape, panel headings, the date, "GRABANDO", "FALTA". Field labels and column headers stay sentence case, Condensed bold, Ink Grey. Body text and names are never uppercase.

## Layout

A single column, phone first. `#root` is at most 480 px wide and centred, so on a tablet or desktop the app stays a phone-width column on the steel ground; the fixed tab bar is capped at the same width. There is no desktop layout and no breakpoint besides that cap.

Spacing is on a 4 px step (4, 8, 12, 16, 20, 24, 36, 48). Text sits 20 px from the screen edge (the gutter); panels sit 12 px from the edge (the panel inset), so their inner text (16 px padding) lines up with the gutter text above. Screen tops start 24 px down; between the title and the first panel, 24 px. Rows inside panels are 52 px minimum with 14 px top and bottom padding; list rows 76 px.

The tab bar is 64 px plus `env(safe-area-inset-bottom)` (with `viewport-fit=cover`); content has that much bottom padding plus 24 px, so the last control is never under the bar. While a text field or select has focus, the bar is hidden (the iOS keyboard is up).

The record screen centres its stage: the 148 px button 60 px below the title, the hint under it at most 300 px wide, centred. Once a sheet exists it comes first, and the recording moves into a "Grabación" panel under it.

Not built yet (specs 06 and 07): the mockups in `docs/design/` place the cost per serving under the sheet's meta line, large (54 px, 800, -0.03em) with "por ración" under it and, on the right, "Total" and the "% estimado" share in blue; an "Importe" column to the right of "Cantidad" in the ingredients panel; and the cost per serving at the right of each list row (22 px, 800, "≈" in blue when estimated). Those figures are example data; their exact tokens are decided with those specs.

### Named Rules
**The Phone Column Rule.** Every screen is designed at 390 px and checked at 320 px; on wider screens the column stops at 480 px. Nothing spans the full desktop width.

**The One-Task Rule.** A screen has one title, at most one primary button, and its content in one or two panels. No grids of cards.

## Elevation & Depth

Mostly flat paper on steel, with three soft lifts. Panels float a little; the tape and the record button a little more. Shadows are diffuse and tinted with the ink colour; there are no hard offsets.

### Shadow Vocabulary
- **Panel** (`box-shadow: 0 1px 2px rgb(22 25 29 / 0.06), 0 4px 12px rgb(22 25 29 / 0.05)`): every white panel, and the outline record button.
- **Tape** (`filter: drop-shadow(0 1px 1px rgb(22 25 29 / 0.14)) drop-shadow(0 3px 6px rgb(22 25 29 / 0.1))`): on the title `h1`, so it follows the torn edges cut on the tape inside it.
- **Record** (`box-shadow: 0 2px 4px rgb(22 25 29 / 0.12), 0 12px 28px rgb(45 106 39 / 0.25)`): the record and stop buttons, with a green glow.
- **Bar** (`box-shadow: 0 -1px 0 var(--rule-strong)`): the line on top of the tab bar.

### Named Rules
**The Filter-Not-Box Rule.** Anything cut by `clip-path` gets its shadow from a `drop-shadow` filter on its parent; a `box-shadow` would be clipped away.

## Shapes

Gently rounded rectangles, one round disc, and one torn strip.

- Fields, quiet buttons, "Eliminar": 8 px.
- Panels, primary buttons, focus rings on tabs: 10 px. A panel's last row ("Añadir ingrediente") rounds its bottom corners to match.
- The active tab pill and the compact record button: 14 px.
- The record and stop buttons and the step marks: full circles. The stop square inside is 34 px with 4 px corners.
- Borders are 1 px: Rule between rows, Field Border on fields. Rings are inset box-shadows: 6 px Tape Green on the outline record button, 8 px on the stop button, 2 px on the compact record button.
- The tape: a polygon `clip-path` with nicks at both ends and a slight wave on the long edges, rotated -1.5° around its left centre.

## Components

### Title Tape (signature)
The screen's `h1` (`ScreenTitle`), the one place the world shows itself.
- **Look:** Tape Green fill, Ink text, Headline type uppercase, padding 8 px 18 px 6 px, `rotate(-1.5deg)` from the left centre, torn ends by `clip-path`, Tape shadow as a filter on the `h1`.
- **Long names:** over 24 characters (`isLongTitle`) the `h1` gets `long`: 24 px type and the tape stops at 90% of the width, so it stays a strip and not a slab. The tape wraps and grows with the name; words break only when one cannot fit a line.
- **As a button:** on the draft sheet the tape is the button that opens the name. The focus ring goes inside (`box-shadow: inset 0 0 0 3px` Focus Blue), as the torn edges would clip an outline. An empty name reads "Sin nombre" in Ink Grey with its "FALTA".
- **Copy in use:** "NUEVA FICHA", "PREPARACIONES", "ACCESO PRIVADO", "ESCANDAYA" (checking and unavailable screens), the preparation's name.

### Navigation (tab bar)
- Fixed to the bottom, white, Bar shadow on top, two equal tabs: "Nueva ficha" (microphone) and "Preparaciones" (list). 64 px tall plus the safe area.
- Each tab: a 24 px line icon over a 13 px label, Ink Grey, weight 600.
- Active (`aria-current="page"`): label in Ink at 800; the icon sits on a Tape Green pill (14 px radius, 2 px 16 px padding) in `on-primary`. Pressed: the pill area takes the Green Wash.
- Focus ring inset (offset -4 px, 10 px radius). Placed after the content in the DOM so focus order follows the screen. No tab bar on the access and session screens.

### Buttons
- **Primary:** Tape Green, `on-primary` text, 17 px 800, 56 px tall, 10 px radius, usually full width ("Confirmar ficha", "Transcribir y crear ficha", "Entrar", "Reintentar" on the unavailable screen). Hover (pointer devices only) `primary-hover`; pressed `primary-pressed` and `scale(0.98)`; disabled `disabled-bg` with `disabled-ink`. Transitions 120 ms `cubic-bezier(0.2, 0, 0, 1)`.
- **Compact primary ("Listo"):** the same button, 48 px tall, at least 120 px wide, 16 px text, pushed to the right.
- **Quiet:** no fill, Action Green 16 px 700, 44 px tall, 12 px padding, optional 18 to 20 px icon with an 8 px gap ("‹ Preparaciones" with a chevron icon, "Reintentar", and "Añadir ingrediente" as a full-width 52 px panel row with a plus). Pressed: Green Wash.
- **Delete ("Eliminar"):** no fill, Delete Red 700, 48 px tall. Pressed: Missing Sticker ground.
- **Focus:** a 2 px Focus Blue outline, 2 px offset, on everything; inset (-2 px) on full-width rows inside panels.

### Record and stop
- **At rest:** a 148 px Tape Green disc, Record shadow, a 44 px microphone over "Grabar" (18 px 800). Pressed: `scale(0.97)`. Focus offset 6 px.
- **Recording (stop):** a 132 px Ink disc with an 8 px inset Tape Green ring and a white 34 px square; spoken name "Parar", `aria-pressed="true"`. Above it, "GRABANDO" in Marker Red with a 10 px red dot blinking at 1.6 s (still with reduced motion) and the 72 px timer (`role="timer"`, outside any live region).
- **After stopping:** 120 px, white with a 6 px inset Tape Green ring and Panel shadow, 36 px icon, 16 px label; "Transcribir y crear ficha" leads as the full-width primary button under the player.
- **Under a sheet (compact):** a 44 px pill with a 2 px inset ring, icon and "Grabar" side by side, inside the "Grabación" panel with the player, the spent step as a grey 15 px line with an Action Green check, and "Si grabas de nuevo, esta ficha se descarta."

### Steps panel
A white panel listing "Grabar", "Transcribir", "Crear ficha", one 52 px row each, divided by Rule, inside a polite live region.
- Next: a 22 px Idle ring, Ink Grey text.
- Now: a Marker Red ring with an 8 px red dot, the text in Ink 800 ("Grabando…", "Transcribiendo…", "Creando ficha…"), "Ahora" in red 14 px bold on the right.
- Done: an Action Green filled disc with a white check, plus a hidden "(hecho)".

### Cards / Containers (panels and rows)
- **Panel:** white, 10 px radius, Panel shadow, no border, inset 12 px from the screen edge. Contents clip to the radius.
- **Panel heading row:** "INGREDIENTES" (Section Label, Ink) with "Cantidad" (Label, Ink Grey) right-aligned, 14 px 16 px 10 px padding.
- **Sheet row:** name left (wraps anywhere), amount right (at least 68 px, no wrap, tabular), 52 px minimum, 1 px Rule on top. On the draft sheet each row is a full-width button named "Editar <name> <amount>" with `aria-expanded`; pressed: Green Wash. On the saved sheet rows are plain text.
- **List row:** a 76 px button, the name in Name Green (Title), under it Small Ink Grey meta "40 raciones · 14 nov 2026, 11:42 · Completa", with missing parts ("Raciones: falta", "Falta 1 dato") in Marker Red bold.
- **Notices in panels:** "No se ha detectado voz" / "No parece una preparación" and the empty list ("Aún no hay preparaciones", "Graba la primera en «Nueva ficha».") are a panel with a 17 px 800 Ink title and an Ink Grey line on what to do.

### Inputs / Fields
- **Style:** white, 1 px Field Border, 8 px radius, 48 px tall, 12 px side padding, 17 px Ink text, Ink Grey placeholder. The select has no native chrome and a 16 px chevron on the right.
- **Label:** above the field, 4 px gap, Label type (Condensed 13 px bold, sentence case, Ink Grey).
- **Focus:** a 2 px Name Green outline at 1 px offset, and the border turns Name Green.
- **Invalid (`aria-invalid="true"`):** the border turns Marker Red, and the "FALTA" mark under the field is linked to it by id.
- **Checkbox ("Estimado"):** 24 px, Focus Blue accent, inside a 48 px label row that toggles it, followed by a blue "≈" drawn by CSS and not read out.
- Quantity and unit sit side by side: the quantity fills, the unit is 112 px.

### Open line (line-by-line editor, signature)
Only one line is open at a time. The open row keeps its name in 800 at the top as a heading, takes the Green Wash ground, and shows its fields under it (12 px gaps, 16 px side and bottom padding): "Nombre"; "Cantidad" and "Unidad"; "Estimado"; then "Eliminar" on the left and "Listo" on the right. While a line is open its "FALTA" marks appear only under its fields, never in the row too. The header's name, yield and covers open the same editor in a Green Wash box with a 10 px radius; an open yield or covers value is underlined 2 px in Tape Green. Opening moves focus to the first field; "Listo" returns it to the row; "Eliminar" moves it to the next row or to "Añadir ingrediente". Short header values grow their tap area to 44 px around the text without moving it.

### Sheet header
The tape, then the meta line: yield · covers in Lead 600 (each a 44 px-tall control on the draft, "·" between them), and the date on the right in Marker Red Section Label ("17 NOV"). Under it, Small Ink Grey "Sin confirmar" (draft) or "Confirmada el 14 nov 2026, 11:42" (saved). Under the panel: the legend "≈ en azul: estimado. Toca una línea para corregirla." (14 px Ink Grey, the "≈ en azul" bold in blue), the hint for an empty name, the error, and the full-width "Confirmar ficha" 24 px below.

### Marks
- **Estimated:** `EstimatedMark` renders "≈ " (hidden from screen readers), the value, and a visually hidden "(estimado)", in Marker Blue.
- **FALTA:** a 13 px Condensed 800 uppercase sticker, Missing Sticker colours, 2 px 8 px padding, no radius. Variants by copy: "FALTA", "falta la cantidad", "falta la unidad" (shown uppercase). When both an estimate and a gap apply, the gap wins on that value.

### Messages and states
- **Error:** Marker Red text at 600 (`message-error`), with `role="alert"`; on the record screen centred under the button.
- **Loading:** a panel with a 17 px Ink Grey line ("Cargando…"); access check: "Comprobando acceso…" with `role="status"`.
- **Load failure:** a panel with the red message and a quiet "Reintentar" under it, aligned to the text.
- **Success notice:** "Ficha guardada" as a bold line with an Action Green check above the list, `role="status"`.

### Icons
Inline SVG line icons on a 24 px grid, `currentColor`, 1.75 stroke (2 to 2.25 at 18 to 20 px), round caps and joins, `aria-hidden`: microphone, list, plus, back chevron, check. The text next to each icon names the control.

## Do's and Don'ts

### Do:
- **Do** put every screen's title in `ScreenTitle` on the tape, with the copy in sentence case in the code (the stylesheet uppercases it).
- **Do** use Tape Green only as a fill under Ink or `on-primary`: primary button, active tab pill, record button and ring, tape, open-line wash (`primary-wash`).
- **Do** show every estimated value with `EstimatedMark` ("≈" in Marker Blue, read as "(estimado)"), including future costs and prices.
- **Do** mark missing data with the "FALTA" sticker or red text; never hide it or show a placeholder number.
- **Do** keep every interactive element at least 44 × 44 px, fields 48 px, primary buttons 56 px, and the record and stop button at least 120 px.
- **Do** keep a visible focus: the 2 px Focus Blue outline, inset inside panels and on the tape, Name Green on text fields; move focus to where content appears and back when it closes.
- **Do** announce state changes through `role="status"`, `role="alert"` or a polite live region, and keep ticking values such as the timer out of them.
- **Do** add new colours, sizes and spacing as tokens in `frontend/src/index.css` first; run `npm run lint`.
- **Do** build new lists and sheets from the white panel with 52 px divided rows, inset 12 px, text at the 20 px gutter.
- **Do** keep all copy in Spanish from Spain, addressing the chef as tú.

### Don't:
- **Don't** put the title on a flat green band or a highlighter stroke; the tape is tilted -1.5°, torn by `clip-path` and shadowed by a filter.
- **Don't** set green text below 20 px extra-bold in Name Green; use Action Green for smaller green text.
- **Don't** put white text on Tape Green, or use Tape Green as a text colour.
- **Don't** use blue for links, decoration or anything but estimates (and the focus ring and checkbox accent); don't use red except for dates, recording, missing data and errors.
- **Don't** write a raw colour in any stylesheet other than `index.css`; the lint fails.
- **Don't** add a dark theme or `prefers-color-scheme` rules; the app is light only (`color-scheme: light`).
- **Don't** load fonts from a font host; add glyphs to the self-hosted subset instead (see `frontend/src/fonts/README.md`).
- **Don't** lay out a desktop grid or cards side by side; on wide screens the app stays the 480 px column.
- **Don't** open a modal or bottom sheet to edit a line; edit in place on the Green Wash.
- **Don't** show a second "FALTA" in a row while its line is open; the marks sit under the fields.
- **Don't** add small uppercase kickers above titles; uppercase Condensed is for panel headings, dates and marks only.
