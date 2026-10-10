---
name: PokerEstima
description: Real-time planning poker for teams on a call, set in Barcelona's street plaques and Eixample chamfers.
colors:
  terracotta: "#b4512f"
  terracotta-deep: "#8e3b1f"
  terracotta-mist: "#f6dccf"
  panot: "#d9dad6"
  panot-line: "#bfc1bb"
  enamel: "#fbfaf7"
  ink: "#171513"
  ink-soft: "#57524b"
  ink-faint: "#736d64"
  groc: "#f6cf0a"
  vermell: "#c8201b"
  on-color: "#fbfaf7"
  on-groc: "#171513"
  groc-hover: "#ffdc2e"
  night-basalt: "#131518"
  night-joint: "#34373c"
  night-enamel: "#1e1d1b"
  lamplight: "#ece4d6"
  lamplight-rim: "#c9c0b1"
  lamplight-soft: "#b4ab9d"
  lamplight-faint: "#8f877b"
  night-rail: "#6a2b16"
  night-terracotta: "#e57c52"
  lifted-tile: "#f2a27f"
  night-mist: "#4b2416"
  night-groc: "#ecc515"
  night-groc-hover: "#f8d43a"
  night-vermell: "#f4604f"
  night-vermell-fill: "#b81f1a"
  night-vermell-on-groc: "#a5160f"
typography:
  display:
    fontFamily: "Marcellus, Times New Roman, serif"
    fontSize: "clamp(2rem, 5vw, 2.5rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.02em"
  wordmark:
    fontFamily: "Marcellus, Times New Roman, serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.08em"
  headline:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.625rem, 3.4vw, 2.375rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Marcellus, Times New Roman, serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "0.06em"
  body:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
  numeral:
    fontFamily: "Archivo, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 8vw, 5rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
rounded:
  cut-sm: "6px"
  cut: "10px"
  cut-lg: "16px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.5rem"
  "6": "2rem"
  "7": "3rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.enamel}"
    rounded: "{rounded.cut-sm}"
    padding: "0.75rem 1.5rem"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.terracotta-deep}"
  button-signal:
    backgroundColor: "{colors.groc}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cut-sm}"
    padding: "0.75rem 1.5rem"
    height: "48px"
  button-danger:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.vermell}"
    rounded: "{rounded.cut-sm}"
    padding: "0.75rem 1.5rem"
    height: "48px"
  button-danger-hover:
    backgroundColor: "{colors.vermell}"
    textColor: "{colors.enamel}"
  button-quiet:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cut-sm}"
    padding: "0.75rem 1.5rem"
    height: "48px"
  input:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.ink}"
    rounded: "0px"
    padding: "0.75rem 1rem"
    height: "48px"
  plaque:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.cut}"
    padding: "0.75rem 0.75rem 0.75rem 1rem"
  plaque-number-voted:
    backgroundColor: "{colors.groc}"
    textColor: "{colors.ink}"
    size: "2.75rem"
  card:
    backgroundColor: "{colors.enamel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cut}"
  rail:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.enamel}"
    typography: "{typography.wordmark}"
  theme-toggle:
    textColor: "{colors.on-color}"
    rounded: "{rounded.cut-sm}"
    size: "40px"
  theme-toggle-hover:
    backgroundColor: "{colors.on-color}"
    textColor: "{colors.terracotta}"
  rail-dark:
    backgroundColor: "{colors.night-rail}"
    textColor: "{colors.on-color}"
  plaque-dark:
    backgroundColor: "{colors.night-enamel}"
    textColor: "{colors.lamplight}"
    typography: "{typography.title}"
    rounded: "{rounded.cut}"
    padding: "0.75rem 0.75rem 0.75rem 1rem"
  card-dark:
    backgroundColor: "{colors.night-enamel}"
    textColor: "{colors.lamplight}"
    rounded: "{rounded.cut}"
  button-primary-dark:
    backgroundColor: "{colors.lamplight}"
    textColor: "{colors.night-enamel}"
    rounded: "{rounded.cut-sm}"
    padding: "0.75rem 1.5rem"
    height: "48px"
  button-primary-dark-hover:
    backgroundColor: "{colors.lifted-tile}"
  button-signal-dark:
    backgroundColor: "{colors.night-groc}"
    textColor: "{colors.on-groc}"
    rounded: "{rounded.cut-sm}"
    padding: "0.75rem 1.5rem"
    height: "48px"
---

# Design System: PokerEstima

## Overview

**Creative North Star: "Placa del Xamfrà"**

Every player is a Barcelona corner street plaque, the enamel sign mounted on the 45° chamfer of an Eixample block. Their name is set in carved capitals, and their vote lands in the box where a real plaque carries its district number. The rest of the screen is the street around it: panot-cement grey ground, a terracotta band taken from the rooftops at golden hour, and the Senyera's yellow and red kept for specific jobs.

The system is minimal on purpose. It is used in a narrow window beside a video call, so there are no glass panels, gradients or decorative containers. Type, one terracotta rail and ink rims do the organising. Pieces feel tactile: cards lift when you point at them, and plaques stamp their numbers in when the votes are revealed. Character comes from geometry and lettering, not ornament.

It replaces an earlier midnight-indigo glass-and-gradient look completely. Nothing from that look carries forward.

**Key Characteristics:**
- 45° bevelled corners (the xamfrà) on plaques, cards, buttons and sheets; never rounded.
- Enamel faces with ink rims; plaques and sheets carry a double rim like a real street sign.
- One committed terracotta rail at the top of every page.
- Carved roman capitals for names and titles; a plain grotesque for everything operated, numerals included.
- State shown by line form (dashed, solid, struck through, dotted) as well as colour.

## Colors

The panot pavement and the enamel plaque form a stone-and-ink base. Terracotta owns the top band, and the two Senyera colours each have one job.

### Primary
- **Eixample Terracotta** (terracotta): the rail across the top of every page, the theme colour, focus outlines, the selected card's rim and number, and split blocks. **Deep Roof Tile** (terracotta-deep) is its pressed and hover variant and the "Facilitator" tag. **Terracotta Mist** (terracotta-mist) is only for the input focus halo.

### Secondary
- **Senyera Groc** (groc): means "voted / act now". Used for the filled number box of a player who has voted, the Reveal and New round buttons, the low-time countdown, and text selection.
- **Senyera Vermell** (vermell): means "ending". Used for the End session button, the error toast, field errors, and the countdown digits under two minutes.

### Neutral
- **Panot Grey** (panot): the page ground, the cool grey of Barcelona's cement pavement tiles. It is not cream.
- **Panot Joint** (panot-line): 1px dividers under section heads and between the average and the split.
- **Enamel** (enamel): every face, including plaques, cards, inputs, sheets and the countdown, plus text on terracotta.
- **Carbon Ink** (ink): rims, body text and the primary button.
- **Weathered Ink** (ink-soft): secondary text and plaque state lines.
- **Faded Ink** (ink-faint): placeholders, the waiting number box's dashed rim, and optional-field hints.

### Named Rules
**The Colour Has a Job Rule.** Yellow means "voted / act now" and red means "ending". Neither is ever decoration. Any colour that isn't the rail, a state or a selection is stone or ink.

**The No-Cream Rule.** The ground is cool cement grey (panot). Warming it toward cream turns the world into the generic terracotta-on-cream Mediterranean look; the earlier #dedad2 already tripped the cream detector, so stay at or cooler than #d9dad6.

**The Fixed-Text Rule.** Text on groc is always `--on-groc` (#171513) and text on the rail or a vermell fill is always `--on-color` (#fbfaf7), in both themes. Rims use `--line`, not `--ink`, so the dark theme can soften them.

### Dark theme: "Nit a l'Eixample"

The same street after dark, composed rather than inverted. It follows `prefers-color-scheme` unless the rail toggle has set a theme. The choice is stored in `localStorage` (`pokerestima-theme`) and applied by an inline script in `<head>` before first paint. A choice that matches the system is forgotten, so the page follows the system again. The toggle is a 40px bevelled plate with an `--on-color` rim (36px at ≤480px). It shows a moon in light and a sun in dark.

These are the `night-*` and `lamplight*` keys in the frontmatter.

| Role | Light | Dark | Name in dark |
|---|---|---|---|
| `--panot` (ground) | #d9dad6 | #131518 | Night basalt, still cool, never brown |
| `--panot-line` | #bfc1bb | #34373c | Wet joint |
| `--enamel` (faces) | #fbfaf7 | #1e1d1b | Dark vitreous enamel, one step above the ground |
| `--ink` (text) | #171513 | #ece4d6 | Lamplight |
| `--line` (rims) | = ink | #c9c0b1 | Dimmed lamplight, so double rims don't buzz |
| `--ink-soft` / `--ink-faint` | #57524b / #736d64 | #b4ab9d / #8f877b | 7.4:1 / 4.75:1 on faces |
| `--rail` | = terracotta | #6a2b16 | Fired-clay roof at night |
| `--terracotta` | #b4512f | #e57c52 | Selected rim, focus, split blocks, corner index |
| `--terracotta-deep` | #8e3b1f | #f2a27f | Becomes the *lifted* tile: role tags, hover fills |
| `--groc` | #f6cf0a | #ecc515 | Slightly lowered to avoid glare |
| `--vermell` | #c8201b | #f4604f | Text and rims on dark faces |
| `--vermell-fill` | = vermell | #b81f1a | Fills with light text (danger hover, error toast) |
| `--vermell-on-groc` | = vermell | #a5160f | Low-time countdown digits |

Shadows go black and deeper (`--drop-hover`, `--drop-selected`, `--shadow-toast`, `--shadow-dialog`). The dialog backdrop is `rgb(6 7 8 / 0.72)`. The primary button and toasts become lamplight faces with dark text. `color-scheme` switches with the theme, so native controls and scrollbars follow. The `theme-color` meta is #b4512f in light and #6a2b16 in dark.

## Typography

**Carved Font:** Marcellus (with Times New Roman, serif), self-hosted from `public/fonts/`
**UI Font:** Archivo, variable 400–700 (with Segoe UI, system-ui, sans-serif), self-hosted from `public/fonts/`

**Character:** Marcellus brings the flared, incised capitals of a stone or enamel street sign. Archivo is a sober workhorse grotesque that keeps the operating surface legible beside a video call.

### Hierarchy
- **Display** (Marcellus 400, clamp(2rem, 5vw, 2.5rem), 1.1, uppercase): sheet titles on the create and join pages ("Open a room", "Join the room").
- **Wordmark** (Marcellus 400, 1.5rem, 0.08em, uppercase): "POKERESTIMA" in the rail; 1.25rem at ≤480px.
- **Headline** (Archivo 700, clamp(1.625rem, 3.4vw, 2.375rem), 1.15, -0.02em): the task title, the largest text in a room.
- **Title** (Marcellus 400, 1.125rem, 0.06em, uppercase): player names on plaques; 1rem at ≤760px.
- **Body** (Archivo 400, 1rem, 1.5): descriptions and ledes, with descriptions capped at 70ch and `pre-wrap`.
- **Label** (Archivo 700, 0.875rem, 0.08em, uppercase): section heads ("At the table", "Your estimate", "The split"), which are the headings themselves. Field labels are Archivo 600 at 0.875rem in sentence case.
- **Numeral** (Archivo 700, tabular): the average (clamp(3.25rem, 8vw, 5rem), -0.04em), card numbers (container-scaled, up to 2.5rem), plaque values, split values and the countdown.

### Named Rules
**The Legible Figure Rule.** Numbers are always Archivo bold with tabular figures. Marcellus's "1" reads as "I", so 100 looks like "IOO". Carved capitals are for words only.

**The Carved Caps Rule.** Marcellus is only ever set in uppercase with positive tracking (0.02–0.08em). It never sets running text.

## Layout

There is one centred column, max 1040px with 1.25rem gutters, under a full-bleed terracotta rail. The rail holds the flag and wordmark on the left, the tagline, and a countdown plaque on the right. In the room, sections are spaced 3rem apart (2rem at ≤760px), and each opens with a label head over a 1px panot-joint rule.

- **Task row:** title and description on the left; the invite field and Copy button in a 280–360px column on the right, bottom-aligned.
- **Table:** plaques in an auto-fill grid (min 168px; 124px at ≤760px).
- **Deck:** one row of ten cards above 860px so the actions stay in the first screen; two rows of five below 860px. Card type scales with container query units.
- **Actions:** facilitator only (Reveal / New round, End), right-aligned under the deck. Players have no action row: tapping a card is the vote. At ≤760px the actions become a bar pinned to the bottom of the screen (panot ground, panot-joint top rule, safe-area padding). Reveal fills the row and End sits compact beside it, always within thumb reach.
- **After reveal:** the split sits directly under the table, above the folded deck, in the DOM as well as visually, so the result leads for everyone, screen readers included. On a live reveal, once the plaque stamps land (700ms), the page glides the split into view only if it is mostly off-screen (`scroll-margin` keeps it clear of the facilitator bar). Rejoins never scroll.
- **Narrow (≤760px):** the task block flattens (`display: contents`) and items are reordered so the order is task, table, results, deck, actions, then invite. Getting to a vote comes before inviting. At ≤480px the countdown and theme toggle join the wordmark row and the tagline is hidden; at ≤400px the rail gaps, wordmark (1.125rem) and countdown tighten so all three fit at 360px. The rail is 52px tall there (`--rail-h`).
- **Create and join:** a single 540px sheet, centred.

## Elevation & Depth

The system is flat at rest. Depth comes from ink rims (inset shadows, so they follow the bevel) rather than shadows. Only things you can pick up float: a hovered or selected card lifts and casts a soft warm drop shadow. Toasts carry a single ambient shadow.

### Shadow Vocabulary
- **Card hover** (`filter: drop-shadow(0 8px 10px rgb(70 32 14 / 0.18))` with `translateY(-4px)`): a pointer is over a card.
- **Card selected** (`filter: drop-shadow(0 14px 14px rgb(70 32 14 / 0.3))` with `translateY(-10px)`): the card currently in hand.
- **Toast** (`box-shadow: 0 10px 24px -8px rgb(23 21 19 / 0.45)`): transient messages.

### Named Rules
**The Rim, Not Shadow, Rule.** Containers are defined by a 2px ink rim, and plaques and sheets add a second 1px rim inset by 6–8px of enamel. Never add a 1px border under a wide soft shadow.

## Shapes

The form language is the Eixample chamfer: 45° bevelled corners, built with `border-radius` plus `corner-shape: bevel` inside `@supports`. Browsers without `corner-shape` fall back to **square** corners, never rounded ones.

- **cut-sm** (6px): buttons, the countdown and toasts.
- **cut** (10px): plaques, cards and split blocks (split blocks use 3px).
- **cut-lg** (16px): create and join sheets.
- **Inputs:** square, with a 2px ink border.
- **Plaque number boxes:** square.
- **Flag:** a plain rectangle with a 2px enamel keyline.

## Components

### Plaques (signature)
Each player's corner street plaque.
- **Face:** enamel with a double ink rim (2px outer, 1px inner at 6px).
- **Name:** across the plaque's full width in carved capitals, like the street name on a real sign. It wraps only between words (break-word, hyphens break naturally), clamps to two lines with an ellipsis, and carries the full name as a `title`. Names are capped at 40 characters (input `maxlength` and a server check).
- **Your plaque:** a 3px terracotta outer rim (the same colour that marks your card) plus "· You" in deep roof tile on the state line.
- **State line:** below the name. The facilitator also gets a "Facilitator" tag on its own line in deep roof tile.
- **Number box (2.75rem square, bottom-right, beside the state line):**
  - waiting: dashed faded-ink rim, empty
  - voted: solid ink rim with a groc fill
  - revealed: the value in Archivo bold. It stamps in (`scale(1.7) rotate(-8deg)` to rest, 520ms expo-out), staggered 70ms per plaque from left to right.
  - offline: the plaque drops to 55% opacity, the name is struck through and the box rim is dotted.
- **After reveal:** players who didn't vote read "Didn't vote".

### Cards (deck)
A white playing card with a 3:4 bevelled face and a 2px ink rim.
- **Content:** the number at the top in Archivo bold, with a small emoji (one glyph per card; 100 is 💀 alone) and an uppercase label under it, and a terracotta corner index. The corner index hides when the card is narrower than 84px; the label hides at ≤480px.
- **Hover:** lifts 4px.
- **One tap is the vote:** tapping a card sends it at once; tapping another changes it until the reveal. The status line beside "Your estimate" reads "Sending…", then "Sent · 13 points · tap another card to change", or a red "Not sent" if the server refuses or times out.
- **Voted** (`aria-pressed="true"`): lifts 10px, with a 4px terracotta rim, a terracotta number and a short terracotta bar near the bottom. While sending, the bar pulses.
- **Keyboard:** toggle buttons with a roving focus; arrow keys move focus only, Enter or Space votes. Anywhere outside a text field, typing a card's number votes (multi-digit values wait 600ms for the next digit). A hint under the deck shows only where `(hover: hover) and (pointer: fine)`, with keys set as small enamel `<kbd>` caps with an ink rim.
- **After reveal:** cards are `disabled` and the deck folds to its heading line, which reads "You voted 8 points. Waiting for the facilitator." (or "You didn't vote."). New round unfolds it.

### Buttons
- **Shape:** bevelled 6px, at least 48px tall, Archivo 600.
- **Primary:** ink face with enamel text (Start the room, Take a seat). Hover turns it deep roof tile.
- **Signal:** groc face with a 2px ink rim (Reveal votes, New round). Reveal carries a live voted count ("Reveal votes · 3/5"), and its accessible name reads "Reveal votes, 3 of 5 voted".
- **Danger:** enamel face with a 2px vermell rim and vermell text. Hover floods it vermell (End session).
- **Quiet:** enamel face with an ink rim. Hover inverts it (Copy link, which reads "Copied" for 2s).
- **All buttons:** press nudges 1px down; disabled is 45% opacity.

### Inputs / Fields
- **Style:** enamel, square, with a 2px ink border and 48px minimum height.
- **Focus:** the border turns terracotta, plus a 3px terracotta-mist halo.
- **Error:** vermell 600 text with a warning icon below the field.
- **Labels:** sentence case, with "optional" in faded ink.

### Rail & Countdown
- **Rail:** the full-width terracotta band. It holds a flag with an enamel keyline, the POKERESTIMA wordmark linking to `/play`, and the tagline in enamel. Focus rings inside the rail are `--on-color`, because a terracotta ring would vanish into it.
- **Theme toggle:** the last item in the rail, a 40px bevelled plate (36px at ≤480px) with a 2px `--on-color` rim and a 20px stroked icon: a moon in light, a sun in dark (the theme it switches to). Hover fills it `--on-color` with the icon in the rail colour. Its accessible name reads "Switch to dark theme" or "Switch to light theme".
- **Countdown:** an enamel plaque with an ink rim, showing "Closes in" plus tabular mm:ss. Under 2 minutes the face turns groc and the digits vermell. It counts down to the room's real expiry from the server (corrected for local clock skew), so late joiners and reloads see the true time; at 0:00 the label reads "Closing" until the server closes the room.

### Results (the split)
- **Average:** a large Archivo numeral beside the split, separated by a panot-joint rule, with "Nearest card 8" under it (the deck value closest to the average; ties go to the larger card). They stay side by side down to 360px so a full table's result fits above the facilitator bar; below 360px they stack.
- **Split rows:** the value, a small emoji, then **one 22px bevelled block per vote** and a ×count. The bar length *is* the count. The most-voted rows use ink blocks; the others use terracotta.

### Closing-soon prompt
The facilitator's one chance to add time.
- **When:** only for the facilitator, only in the room's last 2 minutes, and only if the room hasn't been extended.
- **Look:** a groc strip with an ink rim, bevelled 6px: "The room closes soon." plus a compact quiet button, "Add 5 minutes". On desktop it sits at the left of the action row; on narrow screens it stacks above Reveal in the facilitator bar.
- **After:** everyone's countdown jumps forward and players get a toast, "The room has 5 more minutes".

### Links in the task
Plain URLs in the description become links that open in a new tab: ink text with a 2px terracotta underline at a 0.2em offset, turning deep roof tile on hover. They wrap anywhere so long URLs never overflow.

### Confirmation dialog
Used only for ending the session, the one action that can't be undone.
- **Element:** a native `<dialog>` opened with `showModal()`, so focus is trapped and Esc cancels. Browsers without it fall back to `confirm()`. It sets `margin: auto` because the global reset removes the browser's centring.
- **Look:** an enamel sheet with the plaque double rim, bevelled 16px, over a 55% ink backdrop, rising in over 320ms.
- **Content:** a carved-caps title ("End this session?"), one plain sentence on the consequence, then "Keep the room" (quiet, focused first) and "End for everyone" (danger). On narrow screens the buttons stack with "Keep the room" at the bottom.

### Toasts
Ink plaques (bevelled 6px) just under the rail (`--rail-h` + 0.75rem): top-right on desktop, top-centre at ≤760px, so they never cover the wordmark, the countdown or the facilitator bar. The toasts carry their own `role=status` / `role=alert`; the container is not a live region, so nothing is announced twice. A separate visually hidden status region announces the reveal ("Votes revealed. Average 7.2, nearest card 8. 3 for 5, 1 for 8, 1 for 13."). Errors are vermell with a warning icon. They are plain text, without emoji.

## Do's and Don'ts

### Do:
- **Do** bevel every plaque, card, button and sheet with `corner-shape: bevel` behind `@supports`, and let unsupported browsers fall back to square.
- **Do** show state by line form as well as colour: dashed for waiting, solid yellow for voted, struck through and dotted for offline.
- **Do** set numerals in Archivo bold with tabular figures, and words on plaques and titles in Marcellus uppercase.
- **Do** keep the terracotta rail as the one committed colour field on every page.
- **Do** keep the whole deck in the first screen at 390×844 and in a 420px window beside a call.
- **Do** compose the dark theme by remapping roles (`--panot`, `--enamel`, `--ink`, `--line`, `--rail`), never by inverting; text on groc stays `--on-groc` and text on the rail or a vermell fill stays `--on-color` in both themes.
- **Do** honour `prefers-reduced-motion`. All lifts, stamps and rises collapse to near-instant.

### Don't:
- **Don't** round corners, and don't use pills.
- **Don't** use gradients, glass, blur or gradient text. This world replaced exactly that look.
- **Don't** use yellow or red decoratively. Yellow is "voted / act now" and red is "ending", nothing else.
- **Don't** warm the panot ground toward cream.
- **Don't** set numbers in Marcellus.
- **Don't** put emoji in chrome (buttons, headings, toasts). Emoji live only on cards, as the card's meaning.
- **Don't** reintroduce the ad sidebar or any side column that narrows the room.
