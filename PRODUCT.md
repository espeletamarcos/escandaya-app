# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The chef of a tasting-menu restaurant, the first user. The same person dictates the preparations and reviews the costs. They usually dictate in calm moments in the kitchen, not in the middle of service, and look at the costs calmly afterwards.

The design is not closed to à la carte kitchens, which may come later.

## Product Purpose

Escandaya turns a voice note into a recipe sheet (escandallo) and its cost: the chef dictates a preparation ("hago 2 kilos de tartar para unas 40 raciones, lleva..."), the app fills in the ingredients and quantities, the chef corrects and confirms it, then dictates prices and sees the cost per preparation and per cover.

The MVP must answer two questions:

1. Is dictating sheets fast enough that the chef does it without being asked?
2. Does the cost per cover tell the chef something useful they did not know?

Success: a real preparation from the menu goes from a voice note to a cost per cover the chef recognises as reasonable, on their phone, without help; the menu is loaded in one or two short sessions; they still use it after two weeks without being reminded.

## Positioning

The first restaurant does no costing today: the cost per cover is a gut feeling. Escandaya does not compete with costing software or spreadsheets; it competes with not doing it at all. The mechanism is talking instead of typing: a minute of dictation produces a sheet, and the numbers say honestly how much of them is confirmed and how much is estimated.

## Operating Context

- An iPhone, with the app installed as a PWA from a private link that carries an access token. No accounts or passwords.
- Dictation through a record button; transcription and structuring take several seconds (about 11 s for structuring), with visible progress states (Grabando…, Transcribiendo…, Creando ficha…).
- Reviewing and correcting the sheet by hand before confirming it.
- Kitchen vocabulary in Spanish: preparación, ficha, ingrediente, cantidad, rendimiento, raciones, estimado, coste por ración.

## Capabilities and Constraints

Working today (specs 01–05): record a voice note, transcribe it, get an editable sheet with its missing data marked, confirm and save it, list saved preparations and open one.

Planned (specs 06–08): prices by voice matched to ingredients; cost per preparation and per cover for the menu, with the confirmed vs estimated share; a daily call cap per token. The scope plans three screens in a bottom navigation (Menu, Recipe sheet, Prices); a fourth for the cost breakdown only if needed.

Constraints:

- Mobile first; the iPhone is the reference device.
- All logic, costs and validation live in the backend; the frontend only displays and sends.
- The interface is Spanish only.
- Data the chef does not know exactly is marked as estimated and refined later; missing data is shown on the sheet, never hidden or invented.
- Out of scope for now: offline mode, accounts and roles, several restaurants, native store apps.

## Brand Commitments

- Name: Escandaya. Manifest description: "Escandallos por voz con coste por ración".
- Voice: Spanish from Spain, addressing the user as tú ("Inténtalo de nuevo").
- Stated by the owner (2026-11-15): light theme only; the feel is minimalist, with details that show care. The current look (the Vite starter template) is rejected; it reads as a template.
- The current icons in `frontend/public/` are not confirmed as brand assets.

## Evidence on Hand

- Real voice notes tested on the owner's iPhone (spec 04, 2026-11-11) and a real sheet saved and reopened after deploys (spec 05).
- Test fixtures use a sample preparation, "Tartar de atún".
- No testimonials, other restaurants, cost figures or usage data exist yet; future work must not invent them.

## Product Principles

1. **Dictating beats typing.** The record button is the fastest path; never make the chef fill a form before they can talk.
2. **Honest numbers.** Estimated and confirmed are always distinguishable, and missing data is visible.
3. **The sheet is the product.** Ingredients, quantities and costs must read at a glance.
4. **One calm task per screen.** A tool the chef opens for a minute, not a dashboard to study.
5. **Not locked to tasting menus.** Neutral terms that also fit an à la carte kitchen.

## Accessibility & Inclusion

The owner reports that controls are too small to tap comfortably on the iPhone and that the sheet is hard to read: touch targets must be generous and the sheet's text and figures easy to scan.
