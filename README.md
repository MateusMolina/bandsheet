# tabsprint

A single static page: paste a chord sheet / tab from anywhere, add instruments, and print a compact
**A4 booklet** (two A5 pages per landscape side, dashed fold line, saddle-stitch page order) for each one.

**Use it:** open `index.html` in any browser. No server, no install, works offline.

Vocabulary: **shape** = the chord shapes being fingered (named like a key: "A shapes"), **capo** = capo fret,
**key** = how the song sounds. Always: **key = shape + capo** (plus the tuning's offset from standard).

1. Paste the baseline tab. Its **shape** is auto-detected from the chords (editable). Then either set the tab's **capo**
   (the key is computed) or set the **key** directly (the capo is computed).
2. Add instruments. All of them play the same song, so each sounds in the song key; you fix one side and the other is computed:
   - **Lyrics only** — strips chords and tab (vocals).
   - **Tuning** — preset (standard, drop-d, dadgad, baritone-b, ukulele…) or notes like `B-E-A-D-F#-B`. A lower/higher tuning
     changes which shapes you need.
   - **Capo** → the shape is computed, or choose a **Shape** → the capo is computed (leave the other field empty = auto).
   - Set **both** shape and capo to play in a different key than the song, e.g. a fifth up. The card (and the printed header)
     then shows the resulting key and its interval to the song key, such as "perfect 5th above the song key (+7, = perfect 4th below)".
   - The tab's chords are shifted from the tab's shape to the instrument's shape (columns stay aligned); each card shows the
     shape, capo, key and shift.
3. Pick an instrument tab to preview it, then **Print / save PDF**. Tick *all instruments in one PDF* to print every one.
   Layout is *Auto* by default: songs of 3+ pages become a saddle-stitch booklet (A4 landscape, two A5 pages per side,
   dashed fold line; print **duplex, flip on the short edge**, then fold). Songs of 1–2 pages are printed as plain pages
   side by side, with no folding and no blank halves. You can force either layout in Options.
   Print dialog: A4 landscape, 100% scale, no margins, no headers/footers. "Save as PDF" gives a file.
4. **Jam mode** (needs 2+ instruments): splits the screen in two, one instrument per half, scrolling together. Panes are aligned
   by song section, so a lyrics-only pane stays level with a chord pane even though their lengths differ. Esc closes it; A−/A+ resize the text.

Settings persist in the browser's localStorage.

## What the parser understands

Section headers (`[Verse 1]`, `Chorus:`, `(Bridge)`, `{start_of_chorus}`), chord-over-lyric lines, chord-only lines with
`|`, `x2`, `N.C.`, `Intro:` labels, slash/extended chords, ChordPro (`Hel[C]lo`), Ultimate-Guitar `[ch]` markup, ASCII tab
blocks (kept intact), `Capo`/`Tuning`/`Key` remarks (URLs dropped), a title / `by Artist` header, and header-less sheets
(blank lines separate stanzas). Chords are matched against a whitelist of suffixes, so lyrics like "Dad says Gone are the
days" aren't mistaken for chords.

## Limits

* ASCII-tab fret numbers are printed as in the source (not re-fretted for other tunings or transpositions).
* A lone `A` lyric line, or a lyric made only of chord-like words (`A E`), is read as chords.
* Chord alignment relies on a monospace font (Courier New by default).

## Dev

`tabsprint.js` is the dependency-free core (parser, transposition, layout, booklet imposition, HTML output) and also runs
under Node; `app.js` is the UI. `npm test` (or `node --test tests/`) runs the core tests.
