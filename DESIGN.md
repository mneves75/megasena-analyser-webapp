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
  headline:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.11
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.01em"
  subhead:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.56
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
  note:
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
  section: "64px"
  section-lg: "80px"
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
  button-ghost:
    backgroundColor: "transparent"
    rounded: "{rounded.none}"
    height: "44px"
    width: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: "8px 12px 8px 40px"
    height: "44px"
  table-head:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    padding: "10px 16px"
  storage-band:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.muted-foreground}"
    padding: "6px 16px"
  bar-track:
    backgroundColor: "{colors.border}"
    height: "6px"
  bar-fill:
    backgroundColor: "{colors.primary}"
    height: "6px"
  number-struck:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.full}"
  number-open:
    backgroundColor: "{colors.card}"
    textColor: "{colors.muted-foreground}"
---

# Design System: Mega-Sena Analyzer

Tokens above are the light theme (`:root` in `app/globals.css`). The dark theme (`.dark`) redefines every colour token; its values are listed under Colors below. Colors are written in the project's own format, HSL channels consumed as `hsl(var(--token))`.

## Overview

**Creative North Star: "The Statistical Yearbook"**

The site is set like the Anuário Estatístico: a cool white page, near-black text and a single printing ink (petrol teal) that marks rules, table-head bands, the bars of the figures and the drawn numbers. Every fact is a ruled table, a ruled list or a figure drawn in that ink, with the source stated once in the page header. Every draw is shown as the full field of sixty with six struck, never as six floating balls.

Density is that of a reference book: ruled rows, tabular figures, condensed numerals, generous section breaks (64px, 80px from `lg`) between tables. There are no cards, no shadows, no rounded containers. State is a mark (struck disc, ring, filled radio), not a new hue. Long tables fold behind a ruled row and open on demand. The one working tool, the bet generator, is set in the same ink and the same ruled rows as the archive.

**Key Characteristics:**
- One ink on a cool white page; everything else is neutral.
- Hairline neutral rules between rows; a heavy 2px ink rule opens and closes each table or list.
- One family (Archivo) with its width axis: 88% for headings, 75% for numerals and table heads.
- Square corners everywhere; the only circle is a mark on the field of sixty.
- One page shell: header, storage band, page and footer share one left edge.
- Figures are plates drawn on the server in the one ink, always beside the same numbers as text.
- One "Fonte: CAIXA Econômica Federal" line per data page, in the page header.
- A "Nota." methodological note carries the randomness disclaimer on every data surface.

## Colors

A single cool-teal ink over cool neutrals; the ink carries meaning, the neutrals carry the page.

### Primary
- **Petrol Ink** (`primary`): rules that open tables and lists, struck numbers on the field of sixty, the bars and columns of every figure, primary buttons, link text, the active nav underline, disclosure chevrons, the brand's six dots, text selection. Measured 6.9:1 as text on the page and 7.2:1 under white text; in dark it goes light (8.9:1 as text, 8.5:1 as a surface under a dark foreground).
- **Ink Wash** (`tint`): the table-head band, the storage-notice band, outline-button and option-row hover. The frequency cartogram shades its cells with the ink itself at 10/20/35% alpha.

### Neutral
- **Cool Page** (`background`): the page ground, the header and the footer.
- **Sheet White** (`card`): table bodies, the budget input and the cells of the number field, a step brighter than the page.
- **Near-Black Text** (`foreground`): body copy, headings, figures; also the baseline, the dashed reference line and the median tick of a plotted figure.
- **Graphite** (`muted-foreground`): terms, captions, source lines, ranks, open numbers on the field, the observed range on the range strip.
- **Hairline** (`border`): row dividers, field grid, breadcrumb rule, the track behind a bar. **Field Edge** (`input`) is the slightly darker stroke for text inputs.
- **Pale Slate** (`muted`, also `secondary` and `accent`): ghost-button hover and loading placeholders only.

### Alert
- **Error Red** (`destructive`): validation and generation errors only (budget field message, the generator's error rule). Never decorative.

### Dark theme

`.dark` in `app/globals.css`. Same roles, same single hue; the ink goes light and its foreground goes dark.

| Token | Dark value |
| --- | --- |
| `primary` | `hsl(186 58% 56%)` |
| `primary-foreground` | `hsl(195 60% 8%)` |
| `tint` | `hsl(190 40% 15%)` |
| `background` | `hsl(200 24% 7%)` |
| `foreground` | `hsl(190 14% 93%)` |
| `card` | `hsl(200 20% 10%)` |
| `muted` (also `secondary`, `accent`) | `hsl(200 18% 14%)` |
| `muted-foreground` | `hsl(195 10% 68%)` |
| `border` | `hsl(200 14% 24%)` |
| `input` | `hsl(200 14% 32%)` |
| `ring` | `hsl(186 58% 56%)` |
| `destructive` | `hsl(2 70% 66%)` |
| `destructive-foreground` | `hsl(0 50% 10%)` |

### Named Rules
**The One Ink Rule.** Petrol teal is the only hue. Nothing else gets a color; a second accent is a defect. A deviation reads by its sign (a true minus, "p.p."), not by red and green.

**The Dual-Use Rule.** `primary` and `destructive` are each used as text and as a surface. Both uses must hold 4.5:1 in both themes; fix contrast by moving the paired `-foreground`, not by flattening the hue.

**The Semantic Token Rule.** Components use token classes only (`bg-background`, `text-primary`, `fill-primary`, `stroke-foreground`); no raw palette colors or hex in UI code.

## Typography

**Display Font:** Archivo (variable, `wdth` axis), with system-ui fallback
**Body Font:** Archivo
**Label/Mono Font:** none; numerals are Archivo condensed with tabular figures

**Character:** One grotesk, two widths. Headings run at 88% width with -0.01em tracking; numerals and table heads drop to 75% so long rows of figures stay compact.

### Hierarchy

Exactly three heading levels. Nothing is set larger than the page title.

- **Headline** (600, 2.25rem rising to 3rem at `sm`, balanced; `text-balance text-4xl font-semibold sm:text-5xl`): the page title, one `h1` per page (`PageTitle`). The home hero, the error and not-found states and the loading placeholder use the same size; there is no larger display size.
- **Title** (600, 1.5rem rising to 1.875rem at `sm`; `text-balance text-2xl font-semibold sm:text-3xl`): section headings, `h2` (`SectionHeading`); prose `h2`s on the reading pages stay at 1.5rem over a hairline.
- **Subhead** (600, 1.125rem; `text-lg font-semibold`): subsections, `h3`: the two halves of a paired section, a figure's own heading, the generator's two panels.
- **Figure** (600, 1.25rem condensed, tabular): values in fact rows, pager details, cartogram numbers. The one headline figure of a block (the sena prize, the selected budget) steps up to 1.5rem.
- **Body** (400, 1rem, 1.6): running text. The answer summary under a page title is 1.125rem at 1.625.
- **Label** (600, 0.875rem): table heads (condensed), footer row labels, option-group labels. Table cells, source lines and notes are the same size at 400.
- **Note** (400, 0.75rem): fact-row notes, the detail under a column label, a figure's reference caption, the storage notice's folded text, the version stamp.

### Named Rules
**The One Family Rule.** Archivo only. Hierarchy comes from size, weight and width, never from a second face.

**The Three Levels Rule.** Page title, section heading, subsection. A fourth level means the page needs another section, not another size.

**The Tabular Figures Rule.** Every table, figure and count uses tabular numerals so columns align.

## Layout

One page shell (the `page` utility): full width up to 72rem, centred, 16px side padding. The header bar, the storage band, `main` and the footer all sit on it, so every left edge on the site aligns. `main` adds 32px above the content (40px from `sm`) and 64px below.

One section rhythm: sections of a page are 64px apart, 80px from `lg`. Inside a section, heading and content are 16px apart; a subsection heading sits 8px above its list or figure.

One reading measure: 68ch for every block of running text (answer summaries, notes, section paragraphs, FAQ answers, footer prose, error descriptions, long-form pages). Fact lists and figures with few categories are capped at 48rem so a short list never stretches across the shell; the sixty-column frequency plot runs the full width.

Two-column editorial blocks use one proportion, 5fr to 7fr from `lg`: the draw block (heading and facts left, the field of sixty right), facts beside their figure on the statistics page, the home's prose beside its FAQ. Paired ranked lists split evenly from `md` or `lg`; the generator form is one third to two thirds from `lg`. Everything stacks in reading order on phones.

Tables fit the phone instead of scrolling: columns that carry little are dropped below `sm` (date and prize in a draws table, share and rank in the numbers table), parenthetical detail inside a cell is dropped the same way, and the row of dezenas never wraps. The frame still scrolls sideways if a table is wider than the screen. Rows are 12px top and bottom; table cells 10px by 16px.

The sticky header is 3.5rem (`--app-header-height`); sticky sub-navs and anchor scroll offsets read that variable. Section navigation on the statistics page is a sticky, horizontally scrolling strip under the header, with the section in view underlined in ink.

**The Shared Edge Rule.** Anything full-width (header, band, footer) puts its content on the `page` shell. No surface sets its own container width or side padding.

**The Running Head Rule.** The sticky header marks the section (the active item underlined in ink) and the breadcrumb trail names the page. Together they are the running head; do not add a third.

## Elevation & Depth

Flat. No shadows anywhere. Depth is tonal and ruled: the cool page, the brighter sheet under tables and the field, the tinted head band, and the rules.

Focus is the one ring: 2px in `ring`, offset 2px from the page (`focus-ring`). Full-width rows and cells whose edge touches a rule draw it inside the element instead (`focus-ring-inset`): nav items, option rows, disclosure summaries, cartogram cells. On a tinted or sheet ground the offset takes that ground's colour.

**The No-Box Rule.** Content is separated by rules, not by boxes. No cards, no shadows, no rounded containers.

## Shapes

Square. Buttons, inputs, tables, the field grid and the bars and columns of figures have no radius: the configured `--radius` is 2px, and the two steps derived from it that the build uses resolve to zero or less, so the browser draws 0px. Circles appear only as marks: struck numbers, ringed numbers, radio marks and the brand's six dots.

Rules come in two weights: a 1px neutral hairline between rows, a 2px ink rule at the top (and usually bottom) of every table, fact list, ranked list, option group, the draw block and the footer. A plotted figure stands on a 1px foreground baseline.

## Components

### Buttons
- **Shape:** square (0px), minimum height 44px, 600 weight at 0.875rem.
- **Primary:** ink surface, white text; hover drops the ink to 85%.
- **Outline:** 1px ink border, ink text, transparent; hover fills with Ink Wash. Used for the second action, "Copiar", unselected presets and pager steps.
- **Ghost:** no surface at rest; Pale Slate on hover. Used for the theme toggle.
- **Sizes:** default (8px 16px), small (8px 12px), large (12px 24px, 1rem text) for the page's main action, and a 44px square for an icon control.
- **Focus:** the shared ring. Transitions 180ms, out-quint. Disabled is 50% opacity.

These three variants and four sizes are all there is; a new look for a button is a new decision, not a class.

### Inputs / Fields
- **Style:** square, 1px Field Edge stroke on Sheet White, 44px tall, ink caret, tabular 1.125rem figures; the currency prefix sits inside the left edge in Graphite.
- **Focus:** the shared ring.
- **Error:** `aria-invalid` plus a short Error Red line under the field.

### Ruled Lists (FactList, RankedList, TermRows)
Figures as ruled rows between 2px ink rules. `FactList` sets the term left in Graphite and the figure right in condensed 600. Its optional note under the term qualifies the figure ("Edição de 2023, com ..."), set at 0.75rem; it is a table note, not interface help. `RankedList` sets the competition rank, a linked dezena and the measure; given a maximum it also draws each row's bar, on one grid for the whole list so every bar starts at the same origin and lists that share a maximum compare bar for bar. `TermRows` sets prose definitions against an 11rem term column under a 1px hairline, for reading pages (about, privacy, rights, terms) set in the shared `proseClass` measure.

### Tables
`TableFrame` gives the 2px ink rules and the sheet ground. It is a named region in the tab order, so a table wider than the screen can be scrolled from the keyboard, and it takes the shared focus ring. Heads sit on the Ink Wash band in condensed 600; cells are hairline-ruled and tabular. Measure columns (counts, shares, prizes, delays) are right-aligned, head and body; names and links stay left. Columns marked wide are shown from `sm` only. Dezenas in tables are plain condensed figures in fixed 1.5rem slots on one line, not balls. Every table is named, by a caption (visible or for assistive technology) or by the subsection heading above it.

### Figures (Bar, Columns, range strip)
The yearbook's plates, drawn on the server as SVG in the one ink.
- **Bar:** a 6px track in Hairline with the value in ink, drawn against the largest value in its column. It sits in a ranked row or a table cell beside the number it draws, and is hidden from assistive technology.
- **Columns:** a distribution as ink columns rising from a zero baseline, 160px tall (192px from `sm`). An optional dashed foreground line marks an expected value and is explained in the caption under the plot. The plot is one image with a text label that states its reading; category labels and their figures are HTML under the plot.
- **Range strip:** one inline figure on the statistics page for the sum of the six dezenas: a hairline for the possible range, a Graphite line for the observed one, an ink bar from P5 to P95, an ink box from P25 to P75 and a foreground tick at the median, with the two ends labelled underneath.

Geometry lives in SVG attributes and colour comes only from token classes (`fill-primary`, `fill-border`, `stroke-foreground`). No `style` attribute, no client JavaScript, no text inside the SVG. Shapes stretch with their box; labels keep their size.

### Disclosures
The native `<details>` element as a ruled row: the label in 600 on a row at least 44px tall, an ink chevron at the right that turns over 200ms when open. Used for the home FAQ, for "Tabela completa" under a figure, for the three appendix tables under "Tabelas complementares" on the statistics page, for the generator's note and for the storage notice's detail. Adjacent rows share one hairline.

### Navigation
Header: brand mark (six ink dots plus name at 88% width), text nav in Graphite, active item in foreground with a 2px ink underline flush to the header rule. Below `lg`, a 44px menu button opens a disclosure list (Escape closes it), with the active item underlined in ink. Breadcrumbs are small Graphite text over a hairline. `Pager` sets previous and next under a 2px ink rule, each a small Graphite label over a condensed figure.

### Option Groups (generator)
Radio groups as ruled rows under a 2px ink rule. The mark is an empty 2px ink ring, filled with an ink dot when chosen; hover washes the row with Ink Wash. Each row is the option's name over one line that defines it. Keyboard is a roving tabindex.

### Generator
Budget on the left third, the two option groups on the right two thirds from `lg`. The six budget presets sit in one row of six at every width, condensed, the chosen one filled in ink. The chosen budget is restated as a ruled figure. Nothing is drawn below the form before the first generation: no empty field, no placeholder. Results arrive as a fact list and ruled rows of bets (position, dezenas, type, cost, strategy, "Copiar"), twenty per page.

### The Field of Sixty (NumberField)
The signature. Sixty cells, ten per row like the volante, hairline grid on Sheet White, condensed tabular figures that scale with the cell. Drawn numbers are struck: a filled ink disc with white figures, pressing in from 72% scale over 320ms, staggered 60ms in draw order. A reference number is ringed (2px ink ring). Struck numbers may link to their number page. Only struck and ringed cells reach assistive technology.

### The Draw Block (LatestDrawFigure)
One composition for a draw wherever it appears: under a 2px ink rule, the heading and facts on the left and the field of sixty on the right (5fr to 7fr from `lg`, stacked below). The caller passes the heading, so the block is the hero under the `h1` on the home and on a draw's own page, and a section under an `h2` on the dashboard, the results index and the Mega da Virada page. On the home the two actions follow the field on phones and sit at the foot of the left column from `lg`.

### Frequency Cartogram (FrequencyGrid)
The same sixty as a linked grid (5 columns on phones, 10 from `sm`), each cell shaded by frequency band in the ink at 0/10/20/35% alpha, with one caption line explaining the shade. Hover inverts the cell to ink.

### Notes and Sources
`RandomnessNote`: a hairline-topped aside beginning with a bold "Nota." and linking to the methodology. The source is stated once per data page, in the page header, in Graphite at 0.875rem: "Fonte: CAIXA Econômica Federal, concursos 1 a N." (`SourceLine`), or the same sentence extended with the archive's freshness ("Dados até o concurso N ...") on archive pages. Tables and figures below it do not repeat it; the generator and the reading pages, which show no archive data, carry none.

### Storage Notice
One line in the document flow between the header and the page, on an Ink Wash band over a hairline: the statement, a chevron and a small primary button. The key-by-key text and its two links fold inside a native disclosure. It pushes the page down; it never covers it.

### States (error, not found, loading)
Error and not-found pages are one left-aligned state on the page shell: the title at page-title size, one sentence in Graphite, then the actions (primary first, outline second). The loading placeholder is shaped like the pages it stands for: the title, the draw block (three bars beside a sixty-cell grid) and five ruled rows between ink rules, pulsing in Pale Slate.

### Icons and Share Images
Satori cannot read CSS variables, so `app/_lib/brand-image.tsx` mirrors the light tokens as hex. The image renderers (that file and the draw's `opengraph-image.tsx`) are the only place inline styles are written: they produce a PNG, not HTML. The favicon and Apple icon are the six-dot mark on the page ground; the site card sets the claim beside the empty field of sixty under a 3px ink rule; a draw's card shows its six numbers as struck ink discs above an ink-ruled outcome line.

### Footer
A colophon on the page shell under a 2px ink rule: three hairline-ruled rows. First the two link lists (resources, legal) side by side from `sm`; then responsible gaming; then the disclaimer, closed by a line with copyright and version. Row labels are 600 at 0.875rem and are not headings, so the footer adds nothing to a page's outline.

## Do's and Don'ts

### Do:
- **Do** state the source once per data page, in the page header.
- **Do** show a draw as the full field of sixty with the six struck, in the draw block.
- **Do** open every table and list with a 2px ink rule and divide rows with hairlines.
- **Do** set numerals condensed and tabular, and right-align measure columns.
- **Do** put every full-width surface on the `page` shell, space sections 64px (80px from `lg`) and cap running text at 68ch.
- **Do** keep to three heading levels.
- **Do** draw bars and columns from zero, as server-rendered SVG, with the same numbers as text or a table beside the figure.
- **Do** drop a low-value column below `sm` before letting a table scroll sideways.
- **Do** fold a full table behind a native `<details>` row when a figure already tells it.
- **Do** carry the "Nota." randomness note on every data surface; the legal pages carry their own disclaimer in the same single ink.
- **Do** keep user-facing copy in pt-BR.
- **Do** use Ink Wash only as a band, a cell shade or a hover, never as a box around prose.
- **Do** use the shared focus ring, inset where an element's edge touches a rule.

### Don't:
- **Don't** use a second hue; `destructive` is for real errors only.
- **Don't** use shadows, rounded containers or cards.
- **Don't** use side stripes, kickers or eyebrow labels, or pill buttons.
- **Don't** put icons in or beside headings; icons appear only as controls (menu, theme, disclosure chevron).
- **Don't** add interface helper text; a fact-row note qualifies a figure and an option row defines its option, neither explains the UI.
- **Don't** render drawn numbers as colored balls or chips.
- **Don't** add a chart library; a figure is a few SVG shapes drawn on the server.
- **Don't** write inline styles in page HTML; the CSP has no `style-src-attr` exception, so geometry goes in SVG attributes and everything else in classes. Share images rendered to PNG are the only exception.
- **Don't** put text inside an SVG or ship client JavaScript to draw a figure.
- **Don't** repeat the source line under each table or figure.
- **Don't** add a button variant or a heading size beside the ones recorded here.
