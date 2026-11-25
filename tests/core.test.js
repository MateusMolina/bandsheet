const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../tabsprint.js');

const inst = (o) => Object.assign({ name: 'g', chords: true, tuning: 'standard', capo: '', shape: '' }, o);
const segsOf = (r) => r.segs.map((g) => [g.c, g.t]);

test('chords recognised', () => {
  for (const t of ['C', 'Am', 'F#m7', 'Bb', 'Cmaj7', 'Dsus4', 'E7#9', 'G/B', 'Am7b5', '(C)', 'C*', 'Cadd9', 'D5', 'A+']) assert.ok(T.isChord(t), t);
});
test('words are not chords', () => {
  for (const t of ['Dad', 'Bad', 'Gone', 'Go', 'Am,I', 'hello', 'Eat', 'Add', 'x2', '|']) assert.ok(!T.isChord(t), t);
});
test('chord lines vs lyric lines', () => {
  assert.ok(T.chordSegments('| C  | Am  | F x2 |'));
  assert.ok(T.chordSegments('Intro: C Am F G'));
  assert.equal(T.chordSegments('I heard there was'), null);
  assert.equal(T.chordSegments('A cold and broken'), null);
});
test('transposition and spelling', () => {
  assert.equal(T.transposeToken('C', -3), 'A');
  assert.equal(T.transposeToken('Am', -3), 'F#m');
  assert.equal(T.transposeToken('E7', -3, false), 'C#7');
  assert.equal(T.transposeToken('(G/B)', 2, false), '(A/C#)');
  assert.equal(T.transposeToken('F', 2, true), 'G');
  assert.equal(T.shapeShift('C', 'A'), -3);
  assert.equal(T.shapeShift('A', 'C'), 3);
});
test('tunings', () => {
  assert.equal(T.tuningOffset(T.parseTuning('baritone-b').notes), -5);
  assert.deepEqual(T.parseTuning('D-A-D-G-B-E').notes, ['D', 'A', 'D', 'G', 'B', 'E']);
  assert.equal(T.tuningOffset(T.parseTuning('drop-d').notes), null);
  assert.throws(() => T.parseTuning('nonsense'));
});

const SHEET = `Capo 1 for the video https://youtu.be/x

[Intro]
C Am

[Verse 1]
  C       Am
I heard there was
[Chorus]
 F   G
Hallelujah
`;

test('parses sections, notes, pairs', () => {
  const s = T.parse(SHEET);
  assert.deepEqual(s.sections.map((x) => x.title), ['Intro', 'Verse 1', 'Chorus']);
  assert.deepEqual(s.notes, ['Capo 1 for the video']);
  assert.deepEqual(s.sections[1].units[0].map((r) => r.kind), ['chords', 'lyric']);
});
test('detects baseline key from last chord', () => {
  assert.equal(T.detectKey(T.parse(SHEET)).name, 'G');
  assert.equal(T.detectKey(T.parse('[V]\nC G\nla\nAm\nla')).name, 'A');
});
test('vox strips chords; empty sections become instrumental', () => {
  const secs = T.applyInstrument(T.parse(SHEET), inst({ name: 'vox', chords: false }), 0);
  assert.ok(!secs.flatMap((s) => s.units.flat()).some((r) => r.kind === 'chords'));
  assert.equal(secs[0].units[0][0].text, '(instrumental)');
});
test('playing other shapes shifts chords, keeps columns', () => {
  const secs = T.applyInstrument(T.parse(SHEET), inst({}), -3);
  assert.deepEqual(segsOf(secs[1].units[0][0]), [[2, 'A'], [10, 'F#m']]);
});
test('headerless sheets: paragraphs become sections', () => {
  const s = T.parse('C   G\nline one\n\nAm  F\nline two\n');
  assert.equal(s.sections.length, 2);
  assert.equal(s.sections[0].title, null);
});
test('ChordPro, UG markup, directives', () => {
  const s = T.parse('{title: T}\n{start_of_chorus}\nHello [C]world [Am]again\n{end_of_chorus}\n[ch]F[/ch] [ch]G[/ch]\n');
  assert.equal(s.title, 'T');
  assert.equal(s.sections[0].title, 'Chorus');
  const u = s.sections[0].units;
  assert.equal(u[0][1].text, 'Hello world again');
  assert.deepEqual(segsOf(u[0][0]), [[6, 'C'], [12, 'Am']]);
  assert.equal(u[1][0].kind, 'chords');
});
test('ASCII tab block stays together', () => {
  const s = T.parse('[Riff]\ne|-----0-----|\nB|---1---1---|\nG|-0-------0-|\nD|-----------|\nA|-----------|\nE|-----------|\n');
  const u = s.sections[0].units[0];
  assert.equal(u.length, 6);
  assert.ok(u.every((r) => r.kind === 'tab'));
});
test('lyrics are not tab or headers', () => {
  const s = T.parse("[Verse]\nIt's a cold - and a broken - hallelujah\nThe Chorus line, said she\n");
  assert.deepEqual(s.sections[0].units.flat().map((r) => r.kind), ['lyric', 'lyric']);
});
test('collapse repeats', () => {
  const s = T.parse('[Chorus]\n C   G\nla la la\n[Verse]\nx\n[Chorus]\n C   G\nla la la\n');
  const secs = T.applyInstrument(s, inst({}), 0, true);
  assert.equal(secs[2].units[0][0].text, '(as Chorus above)');
});
test('title / artist / capo remark heuristics', () => {
  let s = T.parse('Little Lantern\nby The Band\nCapo 2\n\n[Verse]\nC  G\nla la\n');
  assert.deepEqual([s.title, s.artist, s.notes], ['Little Lantern', 'The Band', ['Capo 2']]);
  s = T.parse('No capo for the studio version\n\n[Verse]\nC  G\nla la\n');
  assert.equal(s.title, null);
  assert.deepEqual(s.notes, ['No capo for the studio version']);
});
test('tab block closes its section', () => {
  const s = T.parse('[Riff]\ne|---0---|\nB|---1---|\nG|---0---|\nD|-------|\nA|-------|\nE|-------|\n\nC  G\nsing along\n');
  assert.deepEqual(s.sections.map((x) => x.title), ['Riff', null]);
});
test('booklet imposition', () => {
  assert.deepEqual(T.bookletOrder(4), [[4, 1], [2, 3]]);
  assert.deepEqual(T.bookletOrder(8), [[8, 1], [2, 7], [6, 3], [4, 5]]);
  assert.deepEqual(T.bookletOrder(2), [[null, 1], [2, null]]);
  assert.deepEqual(T.bookletOrder(5)[0], [null, 1]);
});
const detC = { name: 'C', pc: 0, minor: false };
const bl = (o) => Object.assign({ shape: '', capo: 0, key: '' }, o);

test('baseline: shape + capo -> key; or key -> capo', () => {
  let b = T.resolveBaseline(bl({}), detC);
  assert.deepEqual([b.shape, b.capo, b.keyText, b.shapeAuto], ['C', 0, 'C', true]);
  b = T.resolveBaseline(bl({ capo: 1 }), detC);
  assert.deepEqual([b.shape, b.capo, b.keyText], ['C', 1, 'Db']);
  b = T.resolveBaseline(bl({ key: 'A' }), detC); // tab is in C shapes, song sounds in A -> capo 9
  assert.deepEqual([b.shape, b.capo, b.keyText, b.keyMode], ['C', 9, 'A', 'key']);
  b = T.resolveBaseline(bl({ shape: 'G', capo: 2 }), detC); // user overrides detection
  assert.deepEqual([b.shape, b.keyText], ['G', 'A']);
  assert.equal(T.resolveBaseline(bl({}), { name: 'A', pc: 9, minor: true }).keyText, 'Am');
});

test('instrument: capo -> shape, or shape -> capo; all sound in the song key', () => {
  const base = T.resolveBaseline(bl({}), detC); // song sounds in C
  let r = T.resolveInstrument(inst({ capo: 3 }), base); // capo 3 + A shapes = C
  assert.deepEqual([r.shape, r.capo, r.shift], ['A', 3, -3]);
  r = T.resolveInstrument(inst({ shape: 'A' }), base);
  assert.deepEqual([r.shape, r.capo, r.shift, r.capoAuto], ['A', 3, -3, true]);
  r = T.resolveInstrument(inst({}), base); // as written
  assert.deepEqual([r.shape, r.capo, r.shift], ['C', 0, 0]);
  r = T.resolveInstrument(inst({ tuning: 'baritone-b' }), base); // 5 semitones low -> needs F shapes to sound C
  assert.deepEqual([r.shape, r.shift], ['F', 5]);
  r = T.resolveInstrument(inst({ chords: false }), base);
  assert.deepEqual([r.chords, r.shift, r.keyText], [false, 0, 'C']);
  // capo 1 tab (key Db): a guitar on capo 1 plays the tab's own shapes
  const base1 = T.resolveBaseline(bl({ capo: 1 }), detC);
  assert.equal(T.resolveInstrument(inst({ capo: 1 }), base1).shift, 0);
});

test('setting both shape and capo may land in another key; interval vs song key', () => {
  const base = T.resolveBaseline(bl({}), detC); // song in C
  let r = T.resolveInstrument(inst({ shape: 'G' }), base); // only shape: capo computed to stay in C
  assert.deepEqual([r.capo, r.interval, r.capoAuto], [5, 0, true]);
  r = T.resolveInstrument(inst({ shape: 'G', capo: 0 }), base); // G shapes, no capo: sounds in G, a fifth up
  assert.deepEqual([r.keyText, r.interval, r.shift, r.capoAuto], ['G', 7, -5, false]);
  assert.match(r.intervalText, /perfect 5th above the song key \(\+7, = perfect 4th below\)/);
  r = T.resolveInstrument(inst({ shape: 'C', capo: 7 }), base); // same shapes as the tab, capo 7: also G
  assert.deepEqual([r.keyText, r.interval, r.shift], ['G', 7, 0]);
  r = T.resolveInstrument(inst({ capo: 2 }), base); // only capo: shape computed, stays in C
  assert.deepEqual([r.interval, r.shapeAuto, r.shape], [0, true, 'Bb']);
  assert.match(T.describe(inst({ shape: 'G', capo: 0 }), T.resolveInstrument(inst({ shape: 'G', capo: 0 }), base), base), /sounds in G: perfect 5th above the song key C \(\+7, = perfect 4th below\)/);
});
test('describe states shape, capo and key', () => {
  const base = T.resolveBaseline(bl({}), detC);
  const g = inst({ tuning: 'baritone-b' });
  const d = T.describe(g, T.resolveInstrument(g, base), base);
  assert.match(d, /5 semitones below standard.*no capo.*F shapes \(tab's C played as F\).*key C/);
  assert.match(T.describe(inst({ chords: false }), T.resolveInstrument(inst({ chords: false }), base), base), /sings in C/);
});
test('renders sheets for a real-ish song', () => {
  const song = T.parse(SHEET);
  const r = T.renderInstrument(T.applyInstrument(song, inst({}), 0), { title: 'T', artist: 'A', instName: 'g', desc: 'd', notes: song.notes }, { layout: 'booklet' });
  assert.equal(r.sheets, 1);
  assert.match(r.html, /class="sheet"/);
  assert.match(r.html, /fold/);
});

test('flat order and layout auto-selection', () => {
  assert.deepEqual(T.flatOrder(1), [[1, null]]);
  assert.deepEqual(T.flatOrder(3), [[1, 2], [3, null]]);
  const song = T.parse(SHEET);
  const meta = { title: 'T', artist: '', instName: 'g', desc: 'd', notes: [] };
  const secs = T.applyInstrument(song, inst({}), 0);
  const auto = T.renderInstrument(secs, meta);
  assert.equal(auto.mode, 'flat');
  assert.equal(auto.sides, 1);
  assert.ok(!auto.html.includes('class="fold"'));
  const book = T.renderInstrument(secs, meta, { layout: 'booklet' });
  assert.equal(book.mode, 'booklet');
  assert.ok(book.html.includes('class="fold"'));
});
test('a long song becomes a booklet with no blank side', () => {
  const body = Array.from({ length: 40 }, (_, i) => `[Verse ${i + 1}]\n C   G\nline a ${i}\n Am  F\nline b ${i}\n`).join('\n');
  const song = T.parse(body);
  const r = T.renderInstrument(T.applyInstrument(song, inst({}), 0), { title: 'T', artist: '', instName: 'g', desc: 'd', notes: [] });
  assert.equal(r.mode, 'booklet');
  assert.equal(r.sides, r.sheets * 2);
  assert.ok(r.pages >= 3);
});
test('jam html keeps section ids for alignment', () => {
  const song = T.parse('[Intro]\nC G\n\n[Verse]\n C   G\nhello there\n');
  const vox = T.applyInstrument(song, inst({ name: 'vox', chords: false }), 0);
  const gtr = T.applyInstrument(song, inst({}), 0);
  assert.deepEqual(vox.map((s) => s.idx), [0, 1]);
  const html = T.jamHtml(gtr);
  assert.match(html, /data-src="1"/);
  assert.match(html, /<b>C<\/b>/);
  assert.ok(!/<b>/.test(T.jamHtml(vox)));
});

test('a long instrument description wraps inside the page instead of running off it', () => {
  const song = T.parse(SHEET);
  const meta = { title: 'T', artist: '', instName: 'g', desc: 'x'.repeat(10) + ' ' + 'word '.repeat(40).trim(), notes: [] };
  const r = T.renderInstrument(T.applyInstrument(song, inst({}), 0), meta, { layout: 'flat' });
  const lines = [...r.html.matchAll(/class="ds"[^>]*>([^<]*)</g)].map((m) => m[1]);
  assert.ok(lines.length > 1);
  assert.ok(lines.every((l) => l.length <= 95), lines.map((l) => l.length).join(','));
});

test('setlist book: songs back to back, continuous page numbers, title block per song, ranges', () => {
  const mk = (title, n) => {
    const song = T.parse(Array.from({ length: n }, (_, i) => `[Verse ${i + 1}]\n C   G\nline ${i}\n Am  F\nline b ${i}\n`).join('\n'));
    return { sections: T.applyInstrument(song, inst({}), 0), meta: { title, artist: '', instName: 'g', desc: 'd', notes: [] } };
  };
  const a = mk('Alpha', 3), b = mk('Beta', 3);
  const single = T.renderBook([a], { layout: 'booklet' });
  const book = T.renderBook([a, b], { layout: 'booklet' });
  assert.equal(book.ranges.length, 2);
  assert.equal(book.ranges[0].from, 1);
  assert.equal(book.ranges[1].from, book.ranges[0].to + 1);
  assert.equal(book.pages, book.ranges[1].to);
  assert.ok(book.pages > single.pages);
  // each song gets its own title block; page numbers are global
  assert.equal([...book.html.matchAll(/class="tt"/g)].length, 2);
  assert.match(book.html, new RegExp(`class="pn"[^>]*>${book.ranges[1].from}<`));
  // booklet imposition covers every page exactly once
  const nums = [...book.html.matchAll(/class="pn"[^>]*>(\d+)</g)].map((m) => +m[1]).sort((x, y) => x - y);
  assert.deepEqual(nums, Array.from({ length: book.pages }, (_, i) => i + 1));
  assert.ok(book.ranges.every((r) => Number.isInteger(r.side)));
  // renderInstrument is the one-song case
  assert.equal(T.renderInstrument(a.sections, a.meta, { layout: 'booklet' }).pages, single.pages);
});

test('captions state their pages; reading-order view is in page order; booklet sheets are imposed', () => {
  const mk = (title, n) => {
    const song = T.parse(Array.from({ length: n }, (_, i) => `[Verse ${i + 1}]\n C   G\nline ${i}\n Am  F\nline b ${i}\n`).join('\n'));
    return { sections: T.applyInstrument(song, inst({}), 0), meta: { title, artist: '', instName: 'g', desc: 'd', notes: [] } };
  };
  const book = T.renderBook([mk('Long', 30), mk('Short', 2)], { layout: 'booklet' });
  assert.equal(book.mode, 'booklet');
  // the book's last page (or a blank pad) sits left of page 1 on the front of sheet 1
  const lastOnFront = book.pages % 4 === 0 ? book.pages : '–';
  assert.ok(book.html.includes(`Sheet 1 · front — pages ${lastOnFront} | 1<`));
  const reading = [...book.htmlReading.matchAll(/class="cap">Pages (\d+)/g)].map((m) => +m[1]);
  assert.deepEqual(reading, Array.from({ length: Math.ceil(book.pages / 2) }, (_, i) => 2 * i + 1));
  assert.ok(!book.htmlReading.includes('class="fold"'));
  const nums = [...book.htmlReading.matchAll(/class="pn"[^>]*>(\d+)</g)].map((m) => +m[1]);
  assert.deepEqual(nums, Array.from({ length: book.pages }, (_, i) => i + 1));
  assert.equal(book.ranges[1].readSide, (book.ranges[1].from - 1) >> 1);
  const flat = T.renderBook([mk('Tiny', 1)]);
  assert.equal(flat.mode, 'flat');
  assert.equal(flat.htmlReading, flat.html);
});

test('minimum font size: wide lines wrap instead of shrinking the text further', () => {
  const wide = 'word '.repeat(30).trim(); // 149 columns: 2 rows at 7.5pt (79 cols), 3 rows at 9.5pt (62 cols)
  const song = T.parse(Array.from({ length: 6 }, (_, i) => `[Verse ${i}]\n C        G\n${wide}\n Am       F\n${wide}\n`).join('\n'));
  const meta = { title: 'T', artist: '', instName: 'g', desc: 'd', notes: [] };
  const secs = T.applyInstrument(song, inst({}), 0);
  const small = T.layout(secs, meta, 9.5, false);                 // default minimum 7.5
  const big = T.layout(secs, meta, 9.5, false, 9.5);              // minimum 9.5 -> text stays big, lines wrap
  assert.equal(small.size, 7.5);
  assert.equal(big.size, 9.5);
  assert.ok(big.pages.length > small.pages.length);
  const rows = (L) => L.pages.flat().filter((p) => p.row.kind === 'lyric').length;
  assert.ok(rows(big) > rows(small));                             // more lyric rows = wrapped
  assert.equal(T.layout(secs, meta, 8, false, 12).size, 8);       // min is capped at max
  assert.ok(T.layout(secs, meta, 9.5, false, 5).size >= 5);       // lower minimums are allowed (size still follows the width)
  const r = T.renderBook([{ sections: secs, meta }], { minSize: 9.5 });
  assert.equal(r.size, 9.5);
});

test('blank lines inside a section never print the text "undefined"', () => {
  const song = T.parse('[Verse]\n C   G\nline one\n\n Am  F\nline two\n');
  assert.ok(song.sections[0].units.some((u) => u[0].kind === 'gap'));
  const r = T.renderInstrument(T.applyInstrument(song, inst({}), 0), { title: 'T', artist: '', instName: 'g', desc: 'd', notes: [] });
  assert.ok(!/undefined/.test(r.html));
  assert.ok(!/undefined/.test(r.htmlReading));
});
test('wrapping keeps every chord inside the line and adds no empty chord rows', () => {
  const lyric = "I hope you didn't catch a tan, I hope you found the right man who'll fix it for ya"; // 82 chars
  const song = T.parse(`[V]\n${' '.repeat(8)}Cmaj7${' '.repeat(53)}Dm7\n${lyric}\n`);
  const secs = T.applyInstrument(song, inst({}), 0);
  const L = T.layout(secs, { title: 'T', artist: '', instName: 'g', desc: 'd', notes: [] }, 9.5, false, 9.5);
  const cols = Math.floor(357.3 / (0.6 * 9.5));
  const rows = L.pages.flat().map((p) => p.row).filter((r) => r.kind === 'chords' || r.kind === 'lyric');
  for (const r of rows) {
    if (r.kind === 'chords') {
      assert.ok(r.segs.length > 0, 'empty chord row');
      assert.ok(Math.max(...r.segs.map((g) => g.c + g.t.length)) <= cols, 'chord hangs past the line: ' + JSON.stringify(r.segs));
    } else assert.ok(r.text.length <= cols);
  }
  const lyrics = rows.filter((r) => r.kind === 'lyric').map((r) => r.text).join(' ');
  assert.equal(lyrics.replace(/\s+/g, ' '), lyric);               // no words lost or duplicated
  assert.equal(rows.filter((r) => r.kind === 'chords').flatMap((r) => r.segs.map((g) => g.t)).join(','), 'Cmaj7,Dm7');
});

test('invisible characters from web copy/paste (zero-width spaces etc.) do not break parsing', () => {
  const Z = '\u200b';
  const clean = '[Verse I]\n\nDm           C                   F\nI was scared of dentists and the dark\nDm                      C\nI was scared of pretty girl\n\n[Bridge]\n\nDm   C   F\nOoh, ooh ooh\n';
  // zero-width space at the start of every line but the first few (as in a real copied page)
  const dirty = clean.split('\n').map((l, i) => (i < 3 ? l : Z + l)).join('\n');
  const a = T.parse(clean), b = T.parse(dirty);
  assert.deepEqual(b.sections.map((x) => x.title), ['Verse I', 'Bridge']);
  assert.equal(JSON.stringify(b.sections), JSON.stringify(a.sections));   // identical result, columns included
  assert.equal(b.sections.flatMap((x) => x.units.flat()).filter((r) => r.kind === 'chords').length, 3);
  // other invisibles / exotic spaces: BOM, soft hyphen, LRM, no-break / thin / ideographic spaces
  const c = T.parse('\ufeff[Chorus]\n\u200eAm\u2009 F\u00a0 G\nHal\u00adlelujah\u00a0now\u3000ok\n');
  assert.equal(c.sections[0].title, 'Chorus');
  assert.deepEqual(c.sections[0].units[0].map((r) => r.kind), ['chords', 'lyric']);
  assert.equal(c.sections[0].units[0][1].text, 'Hallelujah now ok');
});

test('editor helpers: lineKinds mirrors the parser and flags invisible characters', () => {
  const text = '[Verse]\n\nC   G\n\u200bI was scared\n\u200bAm  F\ne|---0---|\nCapo 2\n';
  const k = T.lineKinds(text);
  assert.equal(k.length, text.split('\n').length);
  assert.deepEqual(k.map((x) => x.kind), ['header', 'blank', 'chords', 'lyric', 'chords', 'tab', 'meta', 'blank']);
  assert.deepEqual(k.map((x) => x.odd), [false, false, false, true, true, false, false, false]);
  assert.equal(T.countOdd(text), 2);
  assert.equal(T.countOdd(T.stripInvisible(text)), 0);
  assert.equal(T.stripInvisible('a\u200bb\u00a0c'), 'ab c');
  assert.equal(T.lineKinds('')[0].kind, 'blank');
});

test('share links round-trip the config and parse their hash', async () => {
  const st = { songs: [{ text: 'C  G\nhéllo ♯ wörld\n'.repeat(50), title: 'T', artist: 'A', base: { shape: '', capo: 2, key: '' }, instruments: [inst({ id: 1, name: 'vox' })], junk: 1 }],
    cur: 0, collapse: false, notes: true, maxFont: 9.5, minFont: 7.5, layout: 'auto', printAll: false, view: 'sheets', jamA: 5 };
  const snap = T.shareSnapshot(st);
  assert.equal(snap.jamA, undefined);
  const enc = await T.encodeShare(snap);
  assert.match(enc, /^[zr][A-Za-z0-9_-]+$/);
  assert.deepEqual(await T.decodeShare(enc), JSON.parse(JSON.stringify(snap)));
  const h = T.buildHash({ s: enc, v: 'read', n: 2, i: 'guitar 1' });
  assert.deepEqual(T.parseHash('#' + h), { s: enc, v: 'read', n: 2, i: 'guitar 1' });
  assert.deepEqual(T.parseHash(''), { s: null, v: null, n: null, i: null });
});

test('jamHtml wraps long lines to the pane width, chords staying over their words', () => {
  const secs = T.applyInstrument(T.parse('[Verse]\nC           G\nHello there my dear old friend of mine\n'), inst({}), 0, false);
  const flat = T.jamHtml(secs);
  const wrapped = T.jamHtml(secs, 20);
  const lines = (h) => (h.match(/class="jl/g) || []).length;
  assert.equal(lines(flat), 2);
  assert.ok(lines(wrapped) > 2);
  for (const m of wrapped.matchAll(/<div class="jl[^"]*">([^<]*(?:<(?:b|em)>[^<]*<\/(?:b|em)>[^<]*)*)<\/div>/g)) assert.ok(m[1].replace(/<[^>]+>/g, '').length <= 20, m[1]);
});

test('A4 portrait layout: one page per sheet, wider text area, no folding', () => {
  const song = T.applyInstrument(T.parse('T\n\n[Verse]\n' + 'C  G\nHello there my dear old friend of mine\n'.repeat(80)), inst({}), 0);
  const meta = { title: 'T', artist: '', instName: 'g', desc: 'd', notes: [] };
  const a4 = T.renderInstrument(song, meta, { layout: 'a4' });
  const flat = T.renderInstrument(song, meta, { layout: 'flat' });
  assert.equal(a4.mode, 'a4');
  assert.equal(a4.sides, a4.pages);
  assert.equal(a4.sheets, a4.pages);
  assert.equal((a4.html.match(/<section class="sheet a4">/g) || []).length, a4.pages);
  assert.ok(!a4.html.includes('class="fold"'));
  assert.ok(a4.pages < flat.pages);                 // taller pages hold more
  assert.equal(a4.htmlReading, a4.html);
  assert.equal(a4.ranges[0].side, 0);
});
