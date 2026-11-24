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
