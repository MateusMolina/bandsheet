# Bandsheet

One setlist, a part for every player. A single static page: paste chord sheets / tabs from anywhere, add the instruments of the band, and
each player gets their part in the right key, on their phone through a link or as a compact **A4 booklet** (two A5 pages per landscape side,
dashed fold line, saddle-stitch page order). Nothing is uploaded: a share link carries the whole setup in its URL.

*(Formerly called tabsprint. Songs saved in the browser under the old name still load.)*

**Use it:** open `index.html` in any browser. No server, no install, works offline.

Vocabulary: **shape** = the chord shapes being fingered (named like a key: "A shapes"), **capo** = capo fret,
**key** = how the song sounds. Always: **key = shape + capo** (plus the tuning's offset from standard).

1. Paste the baseline tab. Its **shape** is auto-detected from the chords (editable). Then either set the tab's **capo**
   (the key is computed) or set the **key** directly (the capo is computed).
2. Add instruments with **+ Instrument** in the **fixed bar along the bottom**. Each instrument is a compact **card** there (name, summary, page count); click a
   card to select it and open its settings as a popover above the bar. The popover closes when focus leaves it (click elsewhere, Tab away), and the card stays
   selected. The selected card is the one shown in the centre, printed and jammed. The centre is a live **reader** of the selected instrument (chords already
   shifted for it, A−/A+ for the text size, scroll position kept while you edit the tab); **⤢ Full screen** shows just this instrument filling the screen (Esc
   or *Back* returns; it is the same view a share link opens). On a phone (touch screen, narrow) the app opens in this full-screen view by default; *Back* reaches the editor. Naming an instrument `vox`, `vocals`, `voice`, `singer` or `lyrics` turns on *Lyrics only* by itself.
   All of them play the same song, so each sounds in the song key; you fix one side and the other is computed:
   - **Lyrics only** — strips chords and tab (vocals).
   - **Tuning** — preset (standard, drop-d, dadgad, baritone-b, ukulele…) or notes like `B-E-A-D-F#-B`. A lower/higher tuning
     changes which shapes you need.
   - **Capo** → the shape is computed, or choose a **Shape** → the capo is computed (leave the other field empty = auto).
   - Set **both** shape and capo to play in a different key than the song, e.g. a fifth up. The card (and the printed header)
     then shows the resulting key and its interval to the song key, such as "perfect 5th above the song key (+7, = perfect 4th below)".
   - **Reference** (checkbox in a card's settings; one per song; marked ★): to play the song in another key. There are two keys: the **song key**
     is the tab's own (set with the baseline's shape and capo or key; the reference never changes it) and the **reference key** is the key the other instruments
     are compared to. It is the song key unless an instrument is the reference: then it is how *that* instrument sounds (its shape/capo; empty ones default to the
     tab's own, so marking it changes nothing by itself), and every other instrument, and a vocal's "sings in", follow the reference key. The reference's own card
     shows how far it is from the song key. Lyrics-only instruments can't be the reference.
   - The tab's chords are shifted from the tab's shape to the instrument's shape (columns stay aligned); each card shows the
     shape, capo, key and shift.
3. **Print…** (button above the instruments, or Esc to leave) opens the **print view**: the printing options on the left (layout, font sizes,
   repeated sections, remarks), a preview of the printed sheets on the right, the instrument to print (or tick *all instruments in one PDF*),
   the *View* switch and, in a setlist, a jump-to-song menu. Then **Print / save PDF**; Ctrl/Cmd+P prints the same sheets.
   Layout is *Auto* by default: songs of 3+ pages become a saddle-stitch booklet (A4 landscape, two A5 pages per side,
   dashed fold line; print **duplex, flip on the short edge**, then fold). Songs of 1–2 pages are printed as plain pages
   side by side, with no folding and no blank halves. You can force either layout in the print view.
   **A4 portrait** (Layout option) prints one full A4 page per sheet instead (no folding, no two-per-page); the page itself asks for portrait paper.
   Print dialog: A4 landscape (portrait for that layout), 100% scale, no margins, no headers/footers. "Save as PDF" gives a file.
4. **Jam mode** (needs 2+ instruments): splits the screen in two, one instrument per half, scrolling together. Panes are aligned
   by song section, so a lyrics-only pane stays level with a chord pane even though their lengths differ. Esc closes it; A−/A+ resize the text.

5. **Setlist** (the row of song tabs at the top; there is always one, with one song to start): each song is a **tab** with its own baseline tab,
   key/capo and **its own instrument setup**; click a tab to edit that song's tab and instruments below, **+ Song** adds one (it starts with
   the current song's instruments, so you only change what differs), ← → reorder and × remove (on the selected tab). One booklet is made per instrument *name*
   (`guitar1`, `vox`…): it holds, in setlist order, every song that has an instrument of that name, each starting on a new page with its own
   title block and continuous page numbers. Each tab shows the song's pages in the selected instrument's booklet (a dash if the song has no
   instrument of that name); the print view's jump menu goes to a song in the preview. Renaming an instrument renames it in every song (so it
   stays one booklet); tuning, capo and shape stay per song. The whole book is imposed together, so it needs only as many sheets as the total
   page count requires. Jam mode, the reader link and the instrument cards act on the currently selected song.

6. **View** (print view, preview only): *Printed sheets* shows exactly what prints. For a booklet that means pages **imposed for folding**, so a
   sheet's pages are not in reading order, e.g. the front of sheet 1 of a 4-page book is `pages 4 | 1` (page 4 is the back cover). Every
   caption states its pages. *Reading order* shows the same pages as a book (1 | 2, 3 | 4 …). Printing is always the imposed version.
7. **Export config / Import config** (header): downloads everything (songs with their tabs, key/capo, instruments, options, view)
   plus the browser details and what the app computed from it (pages, sheets, per-song page ranges) as one `.json` file. Attach it to a
   bug report; Import loads it back (also on another machine) to reproduce exactly what you saw. Note that it contains the tab text you pasted.

8. **Font size** (Print view, left): the text is sized so ~97% of the lines fit the page width, between a **max** (default 9.5pt) and a **min**
   (default 7.5pt). At the minimum, lines that are still too wide **wrap** (chords stay above the right words) instead of shrinking the text
   further. Raise the min for readability, e.g. for a song with very long lines; lower it to squeeze more onto a page.

9. **Edit larger** (under the tab box): opens a full-screen editor with a big text area and a live preview of the printed pages beside it
   (pick the instrument; switch it off for full width). The gutter shows how each line is read (`H` header, `C` chords, `L` lyrics,
   `T` tab, `M` note, `·` blank) and flags `⚠` lines containing invisible characters, so you can see why a line is not being recognised.
   Tools: *Clean invisible characters*, *Trim line ends*, *Collapse blank lines*, *Remove common indent*. They keep the browser's
   normal undo (⌘Z / Ctrl+Z). Esc or *Done* closes it.

10. **Copy link** (header): copies a permalink with *everything* (songs, tabs, instruments, options) in the URL hash, so the site stays static and nothing
    is uploaded. Open it in any browser to get the same setup (if the browser already holds other tabs, it asks before replacing them). It is a
    snapshot, not live sync: edit, then share a new link. A warning shows when a link is long (8 KB+). In **Jam mode**, each pane has a **Link** button
    that copies a link opening **only that instrument**, full width, made for a phone (song picker if the setlist has several; *Edit* leaves the reader).

Settings persist in the browser's localStorage.

## What the parser understands

Section headers (`[Verse 1]`, `Chorus:`, `(Bridge)`, `{start_of_chorus}`), chord-over-lyric lines, chord-only lines with
`|`, `x2`, `N.C.`, `Intro:` labels, slash/extended chords, ChordPro (`Hel[C]lo`), Ultimate-Guitar `[ch]` markup, ASCII tab
blocks (kept intact), `Capo`/`Tuning`/`Key` remarks (URLs dropped), a title / `by Artist` header, and header-less sheets
(blank lines separate stanzas). Invisible characters that web pages hide in copied text (zero-width spaces, BOMs, soft hyphens, odd spaces) are stripped first. Chords are matched against a whitelist of suffixes, so lyrics like "Dad says Gone are the
days" aren't mistaken for chords.

## Limits

* ASCII-tab fret numbers are printed as in the source (not re-fretted for other tunings or transpositions).
* A lone `A` lyric line, or a lyric made only of chord-like words (`A E`), is read as chords.
* Chord alignment relies on a monospace font (Courier New by default).

## Dev

**After editing `app.js` or `bandsheet.js`, run `npm run stamp`.** The host (GitHub Pages behind a CDN) caches scripts for hours but
`index.html` for only minutes, so without a version in the script URLs a browser can mix a new page with an old script and half-work
(buttons silently dead). `stamp` writes a content hash into the `<script src="app.js?v=…">` URLs; `npm test` fails if it is stale.

`bandsheet.js` is the dependency-free core (parser, transposition, layout, booklet imposition, HTML output) and also runs
under Node; `app.js` is the UI. `npm test` (or `node --test tests/`) runs the core tests.
