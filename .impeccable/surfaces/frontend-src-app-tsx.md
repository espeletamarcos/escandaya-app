---
version: 1
slug: "frontend-src-app-tsx"
primary_target: "frontend/src/App.tsx"
related_targets: ["frontend/src/screens/RecordScreen.tsx","frontend/src/screens/PreparationsScreen.tsx","frontend/src/screens/PreparationScreen.tsx","frontend/src/sheet/SheetForm.tsx","frontend/src/sheet/SheetView.tsx"]
---

# Surface brief: the app (all screens)

Scope: the whole PWA shell and its screens (record, draft sheet, preparations list, saved sheet). Mode: Operate.
Audience and job: the chef, calm, on an iPhone; dictate a preparation, check and confirm the sheet, find it later and read its cost.
Constraints: PRODUCT.md (light theme, light green primary, Spanish, generous touch targets, estimated vs confirmed always visible).
Reference mockups: Design canvas https://claude.ai/artifact/1EXpL5vayJdSi88sqRBvzu, page "Ronda 2", row B (four artboards). Costs there are example data until specs 06 and 07.
Unresolved: icon for the PWA; whether a third tab (Prices) arrives with spec 06.

## Direction contract

THESIS: every preparation is labelled the way the kitchen labels a container in the cold room: its name on a strip of tape. The screen refuses the generic card-dashboard of costing apps.

OWN-WORLD: very light steel ground (#EDF0F1), white list panels with soft depth, light green tape (#A9E07F) carrying names in condensed uppercase, near-black ink (#16191D), marker blue (#1D4EB8) with "≈" for estimated, marker red (#C42F27) for dates and "FALTA". Sofia Sans for text, Sofia Sans Condensed for tape and labels, tabular figures.

STORY: the chef sees what the sheet says, trusts which numbers are firm and which are estimates, confirms it and finds it again by its tape.

FIRST VIEWPORT: draft sheet: name tape at the top left, yield and covers below, the cost per serving large; one white panel of ingredient rows (name, quantity, amount) with "Añadir ingrediente"; a full-width light green "Confirmar ficha"; a two-tab bottom bar (Nueva ficha, Preparaciones) with the active tab on a green pill.

FORM: masking-tape labelling of mise en place; position 1 of the grounded list, chosen by the owner as Impeccable's pick; seed:1742290cafc64b48. Light green primary pinned by the owner: "quiero que el verde claro sea el color primario".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
