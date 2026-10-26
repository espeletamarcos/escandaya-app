# Escandaya: MVP scope

## What it is and what we want to learn

A mobile PWA: the cook dictates each preparation by voice and the app generates the recipe sheet and the cost breakdown, with the cost per preparation and per cover. First user: a tasting-menu restaurant; the design is not closed to à la carte kitchens.

The MVP must answer two questions:

1. Is dictating recipe sheets fast enough that the cook does it without being asked?
2. Does the cost per cover tell the cook something useful they did not know?

## What the user does

Six actions, all from the phone:

1. **Opens the app** from a private link with a token. No accounts or passwords.
2. **Dictates a preparation** with an audio button: "I make 2 kilos of tartare for about 40 covers, it has...".
3. **Sees the recipe sheet** fill in with ingredients and quantities. Missing data is marked on the sheet.
4. **Corrects by speaking**: "no, it's 300 grams".
5. **Dictates prices**: "tuna, 38 euros a kilo".
6. **Sees the cost breakdown**: cost per preparation and per cover, with the share that is confirmed versus estimated.

Data the cook does not know exactly is marked as estimated and refined later.

## Screens

Three screens in a bottom navigation, designed mobile-first.

| Screen | What it shows |
| --- | --- |
| Menu | Preparations by course, the cost of each one and the total per cover with the estimated % |
| Recipe sheet | Record button, the sheet filling in, what is missing and the cost of that preparation |
| Prices | Ingredients with their price and a button to dictate prices |

If the cost breakdown needs more detail, it is split from the Menu into a fourth screen.

## Specs

The MVP is split into eight end-to-end specs, ordered by risk. See `specs/README.md` for the list and the status of each one. Only the next spec is written in detail; the rest may change with what we learn.

## Out of scope

- Delivery-note scanner and archive for audits (the next step if the MVP works).
- Manual editing of fields, unless testing shows it is needed.
- Smart grouped questions about missing data.
- Sign-up with accounts, multiple restaurants and roles.
- Reusable base preparations, allergens, purchasing and price alerts.
- Selling price and food cost % per dish (the data model leaves the door open).
- Offline mode and a native app in the stores.

## Definition of done

A real preparation from the menu goes from a voice note to a cost per cover that the cook recognises as reasonable, on their phone, in the kitchen and without help. Estimate: 75-105 hours.

Success criteria after handing it over:

- The menu is loaded in one or two short sessions without feeling like a chore.
- The cost per cover matches what the cook expected, or reveals something they did not know.
- They are still using it after two weeks without being reminded.

If these hold, the next step is the delivery-note scanner so prices update on their own.