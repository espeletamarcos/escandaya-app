# Specs

We build with spec-driven development: no feature without an approved spec.

Each spec lives in its own folder, `specs/NN-short-name/`, with three files:

- `spec.md`: what and why, scope, acceptance criteria (`NN-C1`, `NN-C2`...).
- `plan.md`: how we will do it, alternatives, risks. Optional for small specs.
- `tasks.md`: steps of 30-90 minutes, each pointing to the criterion it satisfies.

Start a new spec by copying `specs/_template/`.

## Lifecycle

`not started` -> `draft` -> `approved` -> `in progress` -> `implemented`

A spec is `implemented` when every acceptance criterion has a passing test or a documented manual check. If implementation shows the spec is wrong, update the spec first, then continue with the code.

## Index

| # | Spec | What it leaves working | Status |
|---|---|---|---|
| 01 | Record audio | Press a button on the phone and play back the recording | implemented |
| 02 | Deploy with HTTPS | The app opens from a real phone | implemented |
| 03 | Transcribe a voice note | Audio goes to the backend and the text is shown. Includes minimal protection: a fixed access token in the link and spending caps in the OpenAI and Anthropic consoles | implemented |
| 04 | Recipe sheet from a voice note | Transcribing creates an editable sheet from the LLM's validated output, with its missing data. Nothing is stored | implemented |
| 05 | Save preparations | Confirming the sheet saves it, and saved preparations are listed. Introduces the database on a persistent volume | implemented |
| 06 | Prices by voice | Dictated prices are matched to ingredients | not started |
| 07 | Cost per cover | Cost of each preparation and total for the menu, with confirmed vs estimated share | not started |
| 08 | Access and limits | Daily call cap per token, logging of calls and their cost | not started |
| 09 | Styling | The whole app in one look (direction B, masking tape and light green), tokens in `index.css` and `DESIGN.md` | approved |

## Order

01 -> 02 -> 03 -> 04 -> 05 -> 06 is a chain: each one needs the previous. 07 comes after 05 and 06. 09 goes right after 05, before 06: it is numbered 09 so the spec numbers already in the code stay valid. Only the next spec is written in detail; the rest may change with what we learn.

## Watch list

- Ingredient matching ("tuna" vs "bluefin tuna") may need its own spec.

## After the MVP

Only if the chef keeps using the app for two to three weeks: delivery-note scanner (photo, line extraction, amount validation, and price updates for known ingredients, with a confirmation screen).