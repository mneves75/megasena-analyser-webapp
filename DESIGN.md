---
name: Mega-Sena Analyzer
description: The Mega-Sena's statistical yearbook, set in one printing ink.
colors:
  primary: "hsl(190 86% 24%)"
  primary-foreground: "hsl(0 0% 100%)"
  tint: "hsl(190 45% 93%)"
  background: "hsl(200 25% 98.5%)"
  foreground: "hsl(205 32% 11%)"
  card: "hsl(0 0% 100%)"
  muted: "hsl(195 22% 94%)"
  muted-foreground: "hsl(205 12% 36%)"
  border: "hsl(200 14% 80%)"
  input: "hsl(200 14% 72%)"
  ring: "hsl(190 86% 30%)"
  destructive: "hsl(2 70% 40%)"
  destructive-foreground: "hsl(0 0% 100%)"
typography:
  display:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    fontFeature: "\"tnum\" 1"
  body:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.43
  source:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  none: "0px"
  full: "9999px"
spacing:
  row: "12px"
  cell-y: "10px"
  cell-x: "16px"
  gutter: "16px"
  section: "80px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "hsl(190 86% 24% / 0.85)"
    textColor: "{colors.primary-foreground}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.primary}"
  button-ghost-hover:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
    height: "44px"
  table-head:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    padding: "10px 16px"
  number-struck:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
  number-open:
    backgroundColor: "{colors.card}"
    textColor: "{colors.muted-foreground}"
---

# Design System: Mega-Sena Analyzer

Tokens above are the light theme (`:root` in `app/globals.css`). The dark theme (`.dark`) redefines every token; its values live in `.impeccable/design.json` under `colorMeta.*.dark`. Colors are written in the project's own format, HSL channels consumed as `hsl(var(--token))`.

## Overview

**Creative North Star: "The Statistical Yearbook"**

The site is set like the Anuário Estatístico: a cool white page, near-black text and a single printing ink (petrol teal) that marks rules, table-head bands and the drawn numbers. Every fact is a ruled table or a figure with its source stated underneath. Every draw is shown as the full field of sixty with six struck, never as six floating balls.

Density is that of a reference book: ruled rows, tabular figures, condensed numerals, generous section breaks (80px) between tables. There are no cards, no shadows, no rounded containers. State is a mark (struck disc, ring, filled radio), not a new hue. The one working tool, the bet generator, is set in the same ink and the same ruled rows as the archive.

**Key Characteristics:**
- One ink on a cool white page; everything else is neutral.
- Hairline neutral rules between rows; a heavy 2px ink rule opens and closes each table or list.
- One family (Archivo) with its width axis: 88% for headings, 75% for numerals and table heads.
- Square corners everywhere; the only circle is a mark on the field of sixty.
- A "Fonte: CAIXA Econômica Federal" line under every table and figure.
- A "Nota." methodological note carries the randomness disclaimer on every surface.

## Colors

A single cool-teal ink over cool neutrals; the ink carries meaning, the neutrals carry the page.

### Primary
- **Petrol Ink** (`primary`): rules that open tables and lists, struck numbers on the field of sixty, primary buttons, link text, the active nav underline, the brand's six dots, text selection. Measured 6.9:1 as text on the page and 7.2:1 under white text; in dark it goes light (8.9:1 as text, 8.5:1 as a surface under a dark foreground).
- **Ink Wash** (`tint`): the table-head band, outline-button and option-row hover. The frequency cartogram shades its cells with the ink itself at 10/20/35% alpha.

### Neutral
- **Cool Page** (`background`): the page ground.
- **Sheet White** (`card`): table bodies and the cells of the number field, a step brighter than the page.
- **Near-Black Text** (`foreground`): body copy, headings, figures.
- **Graphite** (`muted-foreground`): terms, captions, source lines, open numbers on the field.
- **Hairline** (`border`): row dividers, field grid, breadcrumb rule. **Field Edge** (`input`) is the slightly darker stroke for text inputs.
- **Pale Slate** (`muted`, also `secondary` and `accent`): ghost-button hover and loading placeholders only.

### Alert
- **Error Red** (`destructive`): validation and generation errors only (budget field message, the generator's error rule). Never decorative.

### Named Rules
**The One Ink Rule.** Petrol teal is the only hue. Nothing else gets a color; a second accent is a defect.

**The Dual-Use Rule.** `primary` and `destructive` are each used as text and as a surface. Both uses must hold 4.5:1 in both themes; fix contrast by moving the paired `-foreground`, not by flattening the hue.

**The Semantic Token Rule.** Components use token classes only (`bg-background`, `text-primary`); no raw palette colors or hex in UI code.

## Typography

**Display Font:** Archivo (variable, `wdth` axis), with system-ui fallback
**Body Font:** Archivo
**Label/Mono Font:** none; numerals are Archivo condensed with tabular figures

**Character:** One grotesk, two widths. Headings run at 88% width with -0.01em tracking; numerals and table heads drop to 75% so long rows of figures stay compact.

### Hierarchy
- **Display** (600, 2.25rem rising to 3.75rem at `sm`, 1.15): the home title only.
- **Headline** (600, 2.25rem rising to 3rem, 1.15): page titles (`PageTitle`), and the condensed "Concurso N" figure caption.
- **Title** (600, 1.5rem rising to 1.875rem, 1.15): section headings (`SectionHeading`) and prose `h2`s.
- **Figure** (600, 1.25rem condensed, tabular): values in fact rows, pager details, cartogram numbers.
- **Body** (400, 1rem, 1.6): running text; lead paragraphs at 1.125rem.
- **Label** (600, 0.875rem): table heads (condensed), footer row labels, option-group labels.
- **Source** (400, 0.75rem): "Fonte:" lines, fact notes, the version stamp.

### Named Rules
**The One Family Rule.** Archivo only. Hierarchy comes from size, weight and width, never from a second face.

**The Tabular Figures Rule.** Every table, figure and count uses tabular numerals so columns align.

## Layout

A centered container with 16px side gutters. Home and wide pages use a 5:7 two-column grid at `lg` (title and actions left, the field of sixty right), collapsing to a single column in reading order on phones. Tables live in a horizontal scroller with a 32rem minimum width. Rows are 12px top and bottom; table cells 10px by 16px. Sections are separated by 80px.

Reading measure is capped per role, but not yet one value: 44ch (home lead), 60ch (long-form prose, home paragraphs), 65ch (FAQ answers), 68ch (answer summaries, notes, footer prose).

The sticky header is 3.5rem (`--app-header-height`); sticky sub-navs and anchor scroll offsets read that variable. Section navigation on the statistics page is a sticky, horizontally scrolling strip under the header.

**The Running Head Rule.** The sticky header marks the section (the active item underlined in ink) and the breadcrumb trail names the page. Together they are the running head; do not add a third.

## Elevation & Depth

Flat. No shadows anywhere. Depth is tonal and ruled: the cool page, the brighter sheet under tables and the field, the tinted head band, and the rules. Focus is a 2px ring in `ring` with a 2px offset.

**The No-Box Rule.** Content is separated by rules, not by boxes. No cards, no shadows, no rounded containers.

## Shapes

Square. Buttons, inputs, tables and the field grid have no radius (the configured `--radius` of 2px is never displayed by any class in use). Circles appear only as marks: struck numbers, ringed numbers, radio marks and the brand's six dots.

Rules come in two weights: a 1px neutral hairline between rows, a 2px ink rule at the top (and usually bottom) of every table, fact list, ranked list, option group and the footer.

## Components

### Buttons
- **Shape:** square (0px), minimum height 44px, 600 weight at 0.875rem.
- **Primary:** ink surface, white text; hover drops the ink to 85%.
- **Outline:** 1px ink border, ink text, transparent; hover fills with Ink Wash. Used for the second action and for "Copiar".
- **Ghost:** used for the theme toggle; Pale Slate on hover.
- **Focus:** 2px ring plus 2px offset. Transitions 180ms, out-quint.

### Inputs / Fields
- **Style:** square, 1px Field Edge stroke on Sheet White, 44px tall, ink caret.
- **Focus:** 2px ring with offset.
- **Error:** `aria-invalid` plus a short Error Red line under the field.

### Ruled Lists (FactList, RankedList, TermRows)
Figures as ruled rows between 2px ink rules. `FactList` sets the term left in Graphite and the figure right in condensed 600. Its optional note under the term qualifies the figure ("Edição de 2023, com ..."), set at 0.75rem; it is a table note, not interface help. `RankedList` adds the competition rank and a linked dezena. `TermRows` sets prose definitions against an 11rem term column under a 1px hairline, for reading pages (about, privacy, rights, terms) set in the shared `proseClass` measure.

### Tables
`TableFrame` gives the 2px ink rules and the sheet ground; heads sit on the Ink Wash band in condensed 600; cells are hairline-ruled and tabular. Dezenas in tables are plain condensed figures in fixed 1.5rem slots, not balls. A `SourceLine` follows every table.

### Navigation
Header: brand mark (six ink dots plus name at 88% width), text nav in Graphite, active item in foreground with a 2px ink underline flush to the header rule. Below `lg`, a 44px menu button opens a disclosure list (Escape closes it), with the active item underlined in ink. Breadcrumbs are small Graphite text over a hairline.

### Option Groups (generator)
Radio groups as ruled rows under a 2px ink rule. The mark is an empty 2px ink ring, filled with an ink dot when chosen; hover washes the row with Ink Wash. Keyboard is a roving tabindex.

### The Field of Sixty (NumberField)
The signature. Sixty cells, ten per row like the volante, hairline grid on Sheet White, condensed tabular figures that scale with the cell. Drawn or selected numbers are struck: a filled ink disc with white figures, pressing in from 72% scale over 320ms, staggered 60ms in draw order. A reference number is ringed (2px ink ring). Only struck and ringed cells reach assistive technology.

### Frequency Cartogram (FrequencyGrid)
The same sixty as a linked grid (5 columns on phones, 10 from `sm`), each cell shaded by frequency band in the ink at 0/10/20/35% alpha, with a legend line and a `SourceLine`. Hover inverts the cell to ink.

### Notes and Sources
`RandomnessNote`: a hairline-topped aside beginning with a bold "Nota." and linking to the methodology. `SourceLine`: "Fonte: CAIXA Econômica Federal, concursos 1 a N." at 0.75rem in Graphite.

### Icons and Share Images
Satori cannot read CSS variables, so `app/_lib/brand-image.tsx` mirrors the light tokens as hex. The favicon and Apple icon are the six-dot mark on Sheet White; the site card sets the claim beside the empty field of sixty under a 3px ink rule; a draw's card shows its six numbers as struck ink discs above an ink-ruled outcome line.

### Footer
A colophon: a 2px ink rule, then ruled rows with a 12rem label column (name, resources, legal, responsible gaming, disclaimer) and a final line with copyright and version.

## Do's and Don'ts

### Do:
- **Do** put a `SourceLine` under every table and figure.
- **Do** show a draw as the full field of sixty with the six struck.
- **Do** open every table and list with a 2px ink rule and divide rows with hairlines.
- **Do** set numerals condensed and tabular.
- **Do** carry the "Nota." randomness note on every data surface; the legal pages carry their own disclaimer in the same single ink.
- **Do** keep user-facing copy in pt-BR.
- **Do** use Ink Wash only as a band, a cell shade or a hover, never around prose.

### Don't:
- **Don't** use a second hue; `destructive` is for real errors only.
- **Don't** use shadows, rounded containers or cards.
- **Don't** use side stripes, kickers or eyebrow labels, or pill buttons.
- **Don't** put icons in or beside headings; glyphs appear only as controls (menu, theme, disclosure chevron).
- **Don't** add interface helper text; a fact-row note qualifies a figure, it does not explain the UI.
- **Don't** render drawn numbers as colored balls or chips.
