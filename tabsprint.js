/* tabsprint core: parse pasted chord sheets, apply per-instrument settings, lay out A5 pages,
 * impose them as an A4-landscape booklet, and emit HTML sheets. No dependencies. */
(function (root) {
  'use strict';

  // ───────────────────────────── chords ─────────────────────────────
  const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const MAJOR_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']; // flat majors…
  const MINOR_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']; // …sharp minors
  const NOTE_NAMES = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const mod = (a, n) => ((a % n) + n) % n;

  // root + whitelist of quality pieces + optional slash bass, so words ("Dad", "Gone") are not chords
  const CHORD_RE = /^([A-G][#b]?)((?:maj|min|dim|aug|sus|add|m|M|\+|°|ø|-|\d+|[#b]\d+|\([#b+-]?\d+\))*)(?:\/([A-G][#b]?))?$/;

  function pc(note) {
    let v = NOTE_PC[note[0]];
    if (note.endsWith('#')) v += 1;
    else if (note.endsWith('b')) v -= 1;
    return mod(v, 12);
  }

  function parseChordToken(tok) {
    const m = /^(\(?)(.+?)(\)?[*.,;:]?)$/.exec(tok);
    if (!m) return null;
    if (CHORD_RE.test(tok)) return ['', tok, ''];
    if (CHORD_RE.test(m[2])) return [m[1], m[2], m[3]];
    return null;
  }
  const isChord = (tok) => parseChordToken(tok) !== null;

  function noteName(p, minor, flats) {
    if (flats === null || flats === undefined) return (minor ? MINOR_NAMES : MAJOR_NAMES)[mod(p, 12)];
    return (flats ? FLATS : SHARPS)[mod(p, 12)];
  }
  function prefersFlats(tonicPc, minor) {
    return (minor ? [2, 7, 0, 5, 10, 3] : [5, 10, 3, 8, 1]).includes(tonicPc);
  }
  function chordMinor(qual) { return qual.startsWith('m') && !qual.startsWith('maj'); }

  /** Guess the key from the last chord (songs usually end on the tonic). */
  function songTonic(cores) {
    for (let i = cores.length - 1; i >= 0; i--) {
      const m = CHORD_RE.exec(cores[i]);
      if (m) return { pc: pc(m[1]), minor: chordMinor(m[2] || '') };
    }
    return null;
  }

  function transposeChord(core, semis, flats) {
    const m = CHORD_RE.exec(core);
    if (!m || mod(semis, 12) === 0) return core;
    const qual = m[2] || '';
    let out = noteName(pc(m[1]) + semis, chordMinor(qual), flats) + qual;
    if (m[3]) out += '/' + noteName(pc(m[3]) + semis, false, flats);
    return out;
  }
  function transposeToken(tok, semis, flats) {
    const p = parseChordToken(tok);
    return p ? p[0] + transposeChord(p[1], semis, flats) + p[2] : tok;
  }

  /** Shift (−6…+6) that turns a chord rooted on `from` into one rooted on `to`. */
  function shapeShift(from, to) {
    const d = mod(pc(to) - pc(from), 12);
    return d > 6 ? d - 12 : d;
  }

  const STANDARD = ['E', 'A', 'D', 'G', 'B', 'E'];
  const TUNINGS = {
    standard: STANDARD,
    'drop-d': ['D', 'A', 'D', 'G', 'B', 'E'],
    dadgad: ['D', 'A', 'D', 'G', 'A', 'D'],
    'open-g': ['D', 'G', 'D', 'G', 'B', 'D'],
    'open-d': ['D', 'A', 'D', 'F#', 'A', 'D'],
    'half-step-down': ['Eb', 'Ab', 'Db', 'Gb', 'Bb', 'Eb'],
    'baritone-b': ['B', 'E', 'A', 'D', 'F#', 'B'],
    'baritone-a': ['A', 'D', 'G', 'C', 'E', 'A'],
    ukulele: ['G', 'C', 'E', 'A'],
    bass: ['E', 'A', 'D', 'G'],
  };

  /** -> { name, notes } ; throws on garbage. Accepts a preset key or notes like "B-E-A-D-F#-B". */
  function parseTuning(spec) {
    const key = String(spec).trim().toLowerCase().replace(/[_ ]/g, '-');
    if (TUNINGS[key]) return { name: key, notes: TUNINGS[key] };
    const notes = String(spec).trim().split(/[\s-]+/).filter(Boolean).map((n) => n[0].toUpperCase() + n.slice(1));
    if (notes.length >= 3 && notes.every((n) => /^[A-G][#b]?$/.test(n))) return { name: notes.join(' '), notes };
    throw new Error('unknown tuning: ' + spec);
  }
  /** Semitones from standard if the tuning is a uniform shift of it, else null. */
  function tuningOffset(notes) {
    if (notes.length !== 6) return null;
    const diffs = new Set(notes.map((n, i) => mod(pc(n) - pc(STANDARD[i]) + 6, 12) - 6));
    return diffs.size === 1 ? [...diffs][0] : null;
  }

  // ───────────────────────────── parser ─────────────────────────────
  const WB = '(?![\\p{L}\\p{N}_])'; // unicode-aware \b
  const SW =
    'intro|verse|chorus|pre[- ]?chorus|post[- ]?chorus|bridge|outro|solo|guitar solo|interlude|' +
    'refrain|hook|instrumental|tag|coda|break|ending|riff|turnaround|part|middle 8|vamp|' +
    'strophe|estrofe|refrão|refrao|coro|ponte|final';
  const HEADER_RE = new RegExp('^(?:' + SW + ')' + WB + '.*$', 'iu');
  const LABEL_FILLER_RE = new RegExp('^(?:' + SW + ')\\d*:?$', 'iu');
  const FILLER_RE = /^(?:\|+:?|:?\|+|\/+|-+|~+|\*+|\.{2,}|%|\(?x\d+\)?|\(?\d+x\)?|N\.?C\.?|\(?repeat.*|\(?riff\)?|\(?tacet\)?)$/i;
  const META_RE = /^(?:capo|tuning|tuned|key|tempo|bpm|strumming|strum pattern|time signature|difficulty)\b(?:\s*[:=#]|\s+\d|\s+of\b|\s+(?:on|at)\b)/i;
  const TITLE_RE = /^(title|song)\s*[:-]\s*(.+)$/i;
  const ARTIST_RE = /^(artist|by|band)\s*[:-]\s*(.+)$/i;
  const BY_RE = /^by\s+(.{2,60})$/i;
  const TOKEN_RE = /\|+:?|:?\|+|[^\s|]+/g;
  const INLINE_CHORD_RE = /\[([^\]\s]+)\]/g;
  const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
  const DECOR_RE = /^[\s\-=_*~#.]{3,}$/;
  const TAB_LABEL_RE = /^\s*[A-Ga-g][#b]?\s*[|:][-\d\w|/\\~^()<>.:=*\s]*$/;
  const TAB_CHARS_RE = /^[-\d|/\\~^()<>.:=*hpbrsvxtHPBRSVXT\s]+$/;

  function expandTabs(l, n = 4) {
    let out = '';
    for (const ch of l) out += ch === '\t' ? ' '.repeat(n - (out.length % n)) : ch;
    return out;
  }
  // Text copied from web pages is full of characters you can't see: zero-width spaces (often at the start of every line),
  // BOMs, soft hyphens, bidi marks. They are not whitespace to JS, so they break chord/header detection. Remove them (they
  // take no room, so removing them keeps the visual alignment); turn exotic spaces into plain spaces.
  const INVISIBLE_RE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff\u00ad\u180e]/g;
  const EXOTIC_SPACE_RE = /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g;
  function preprocess(text) {
    return text
      .replace(INVISIBLE_RE, '').replace(EXOTIC_SPACE_RE, ' ').replace(/\u2028|\u2029/g, '\n')
      .replace(/\r\n?/g, '\n').replace(/\u266d/g, 'b').replace(/\u266f/g, '#')
      .replace(/\[\/?(?:ch|tab|chord)\]/gi, '') // ultimate-guitar markup
      .replace(/<\/?(?:pre|b|i|span)[^>]*>/gi, '') // stray html from copy/paste
      .split('\n').map((l) => expandTabs(l).replace(/\s+$/, '')).join('\n');
  }

  function chordSegments(line) {
    const segs = [];
    let n = 0;
    for (const m of line.matchAll(TOKEN_RE)) {
      const t = m[0];
      if (isChord(t)) { segs.push({ c: m.index, t, ch: true }); n++; }
      else if (FILLER_RE.test(t) || LABEL_FILLER_RE.test(t)) segs.push({ c: m.index, t, ch: false });
      else return null;
    }
    return n ? segs : null;
  }

  function isTabLine(line) {
    const s = line.trim();
    const dashes = (s.match(/-/g) || []).length;
    if (dashes < 3 || (DECOR_RE.test(s) && !s.includes('|'))) return false;
    if (TAB_LABEL_RE.test(s) && TAB_CHARS_RE.test(s.slice(1).replace(/^[#b ]+/, ''))) return true;
    return s.includes('|') && dashes >= 4 && TAB_CHARS_RE.test(s);
  }

  const stripChars = (s, chars) => {
    let a = 0, b = s.length;
    while (a < b && chars.includes(s[a])) a++;
    while (b > a && chars.includes(s[b - 1])) b--;
    return s.slice(a, b);
  };
  const titleCase = (s) => s.replace(/\p{L}[\p{L}\p{N}']*/gu, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

  function headerTitle(line) {
    const s = line.trim();
    if (!s || s.length > 48) return null;
    let m = /^\{\s*(?:start_of_|so)([a-z]+)\s*(?::\s*(.*?))?\s*\}$/i.exec(s);
    if (m) {
      const kind = { c: 'chorus', v: 'verse', b: 'bridge' }[m[1].toLowerCase()] || m[1];
      return titleCase((m[2] || kind).trim());
    }
    const bracketed = /^[[(*{<].*[\])*}>]:?$/.test(s);
    let inner = stripChars(s, '[](){}<>*# \t').replace(/:+$/, '');
    inner = stripChars(inner, '[](){}<>* \t');
    if (!inner || isChord(inner)) return null;
    if (bracketed && !chordSegments(inner)) return inner;
    if (HEADER_RE.test(inner) && (s.endsWith(':') || inner.split(/\s+/).length <= 3) && !chordSegments(s)) {
      return inner.replace(/:+$/, '');
    }
    return null;
  }

  function classify(line) {
    const s = line.trim();
    if (!s) return ['blank'];
    if (DECOR_RE.test(s)) return ['skip'];
    if (/^\{\s*(?:end_of|eo)[a-z_]*\s*\}$/i.test(s)) return ['skip'];
    let m = /^\{\s*(title|t|subtitle|st|artist|capo|key|tuning|comment|c)\s*:\s*(.*?)\s*\}$/i.exec(s);
    if (m) {
      const k = m[1].toLowerCase();
      if (k === 'title' || k === 't') return ['title', m[2]];
      if (k === 'artist' || k === 'subtitle' || k === 'st') return ['artist', m[2]];
      return ['note', ((k === 'c' || k === 'comment' ? '' : titleCase(k)) + ' ' + m[2]).trim()];
    }
    const h = headerTitle(line);
    if (h !== null) return ['header', h];
    if (isTabLine(line)) return ['tab', line];
    const segs = chordSegments(line);
    if (segs) return ['chords', segs];
    if ((m = TITLE_RE.exec(s))) return ['title', m[2]];
    if ((m = ARTIST_RE.exec(s)) && s.length < 80) return ['artist', m[2]];
    if (META_RE.test(s)) return ['note', s];
    const inl = [...line.matchAll(INLINE_CHORD_RE)];
    if (inl.length && inl.every((x) => isChord(x[1]))) return ['chordpro', line];
    return ['lyric', line];
  }

  function chordproSplit(line) {
    const segs = [];
    let out = '', pos = 0;
    for (const m of line.matchAll(INLINE_CHORD_RE)) {
      out += line.slice(pos, m.index);
      segs.push({ c: out.length, t: m[1], ch: true });
      pos = m.index + m[0].length;
    }
    return [segs, out + line.slice(pos)];
  }
  const cleanNote = (s) => s.replace(URL_RE, '').replace(/\s+/g, ' ').replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g, '');

  const row = (kind, extra) => Object.assign({ kind }, extra);

  /** text -> { title, artist, notes[], sections:[{title, units:[[row…]]}] } */
  function parse(text) {
    const song = { title: null, artist: null, notes: [], sections: [] };
    const lines = preprocess(text).split('\n');
    const items = lines.map((l) => [l, classify(l)]);
    const hasHeaders = items.some(([, c]) => c[0] === 'header');
    const sections = [];
    let cur = null;
    const start = (title) => { cur = { title, units: [] }; sections.push(cur); };
    const add = (unit) => { if (!cur) start(null); cur.units.push(unit); };
    const n = items.length;
    let seenHeader = false, seenContent = false, lastWasTab = false;
    let i = 0;
    while (i < n) {
      const [line, [kind, val]] = items[i];
      if (kind === 'lyric' && !seenContent) {
        const nxt = i + 1 < n ? items[i + 1][1][0] : 'blank';
        if (song.title === null && line.trim().length <= 60 && !line.match(URL_RE) && !/\bcapo\b|\btuning\b/i.test(line) &&
            (nxt === 'blank' || (nxt === 'lyric' && BY_RE.test(items[i + 1][0].trim())))) {
          song.title = line.trim(); i++; continue;
        }
        if (BY_RE.test(line.trim())) { song.artist = song.artist || BY_RE.exec(line.trim())[1]; i++; continue; }
      }
      if (!['blank', 'skip', 'title', 'artist', 'note'].includes(kind)) {
        seenContent = true;
        if (lastWasTab && kind !== 'tab' && kind !== 'header') cur = null; // a tab block owns its section
        if (kind !== 'tab') lastWasTab = false;
      }
      if (kind === 'skip') i++;
      else if (kind === 'title') { song.title = song.title || val; i++; }
      else if (kind === 'artist') { song.artist = song.artist || val; i++; }
      else if (kind === 'note') { const t = cleanNote(val); if (t) song.notes.push(t); i++; }
      else if (kind === 'blank') {
        if (hasHeaders) {
          if (cur && cur.units.length && cur.units[cur.units.length - 1][0].kind !== 'gap') cur.units.push([row('gap')]);
        } else if (cur && cur.units.length) cur = null; // paragraph break => new headerless section
        i++;
      } else if (kind === 'header') { seenHeader = true; start(val); i++; }
      else if (kind === 'tab') {
        lastWasTab = true;
        const block = [];
        while (i < n && items[i][1][0] === 'tab') { block.push(row('tab', { text: items[i][0].trimEnd() })); i++; }
        add(block);
      } else if (kind === 'chords') {
        const r = row('chords', { segs: val });
        if (i + 1 < n && items[i + 1][1][0] === 'lyric') { add([r, row('lyric', { text: items[i + 1][0].trimEnd() })]); i += 2; }
        else { add([r]); i++; }
      } else if (kind === 'chordpro') {
        const [segs, lyric] = chordproSplit(line);
        add(lyric.trim() ? [row('chords', { segs }), row('lyric', { text: lyric.trimEnd() })] : [row('chords', { segs })]);
        i++;
      } else { // lyric
        if (hasHeaders && !seenHeader && !sections.length) { const t = cleanNote(line); if (t) song.notes.push(t); }
        else add([row('lyric', { text: line.trimEnd() })]);
        i++;
      }
    }
    for (const s of sections) while (s.units.length && s.units[s.units.length - 1][0].kind === 'gap') s.units.pop();
    song.sections = sections.filter((s) => s.units.length || s.title);
    return song;
  }

  /** Name of the key the baseline tab appears to be in (from its last chord), e.g. "C" or "Am"-> "A". */
  function detectKey(song) {
    const cores = [];
    for (const s of song.sections) for (const u of s.units) for (const r of u)
      for (const g of r.segs || []) if (g.ch) { const p = parseChordToken(g.t); if (p) cores.push(p[1]); }
    const t = songTonic(cores);
    return t ? { name: noteName(t.pc, t.minor, null), pc: t.pc, minor: t.minor } : null;
  }

  // ───────────────────────────── setup: key / shape / capo ─────────────────────────────
  // Vocabulary:  shape = chord shapes being fingered (named by a key, e.g. "A shapes")
  //              capo  = capo fret
  //              key   = how the song sounds.   key = shape + capo (+ the tuning's offset from standard)
  // Baseline tab: give shape (auto-detected) + capo -> key is computed, or give the key -> capo is computed.
  // Every instrument plays the same song, so it sounds in the song key: give capo -> shape is computed,
  // or give shape -> capo is computed. Chords are shifted from the tab's shape to the instrument's shape.
  const clampCapo = (v) => Math.max(0, Math.min(12, parseInt(v, 10) || 0));
  const roundTrip = (n) => mod(n + 6, 12) - 6; // -6..+5

  function tuningShift(inst) {
    try { return tuningOffset(parseTuning(inst.tuning || 'standard').notes) || 0; } catch (e) { return 0; }
  }
  const keyLabel = (name, minor) => name + (minor ? 'm' : '');

  /** baseline: { shape:''|note, capo:int, key:''|note }; det: detectKey() result or null. */
  function resolveBaseline(baseline, det) {
    const minor = det ? det.minor : false;
    const shape = baseline.shape || (det ? det.name : 'C');
    const shapePc = pc(shape);
    let capo, keyPc, keyName, keyMode;
    if (baseline.key) { keyPc = pc(baseline.key); capo = mod(keyPc - shapePc, 12); keyName = baseline.key; keyMode = 'key'; }
    else { capo = clampCapo(baseline.capo); keyPc = mod(shapePc + capo, 12); keyName = noteName(keyPc, minor, null); keyMode = 'capo'; }
    return { shape, shapePc, shapeAuto: !baseline.shape, capo, keyPc, keyName, keyMode, minor, keyText: keyLabel(keyName, minor) };
  }

  const INTERVALS = ['same key', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd', 'perfect 4th', 'tritone',
    'perfect 5th', 'minor 6th', 'major 6th', 'minor 7th', 'major 7th'];
  /** Interval from the song key up to the instrument's key (0..11 semitones), in words. */
  function intervalText(iv) {
    if (!iv) return '';
    return `${INTERVALS[iv]} above the song key (+${iv}` + (iv > 6 ? `, = ${INTERVALS[12 - iv]} below` : '') + ')';
  }
  const isSet = (v) => v !== '' && v !== null && v !== undefined;

  /** Per instrument: { chords, shape, shapeAuto, capo, capoAuto, shift, tuningOff, keyText, interval, intervalText }.
   *  Shape and capo can each be set or left auto. One set -> the other is computed so it sounds in the song key.
   *  Both set -> free choice: the instrument may sound in another key (interval shown). Neither -> capo 0. */
  function resolveInstrument(inst, base) {
    if (!inst.chords) return { chords: false, shift: 0, keyText: base.keyText, interval: 0, intervalText: '' };
    const off = tuningShift(inst);
    let shapePc, capo, capoAuto = false, shapeAuto = false;
    if (inst.shape) {
      shapePc = pc(inst.shape);
      if (isSet(inst.capo)) capo = clampCapo(inst.capo);
      else { capo = mod(base.keyPc - shapePc - off, 12); capoAuto = true; }
    } else {
      capo = isSet(inst.capo) ? clampCapo(inst.capo) : 0;
      capoAuto = !isSet(inst.capo);
      shapePc = mod(base.keyPc - capo - off, 12);
      shapeAuto = true;
    }
    const keyPc = mod(shapePc + capo + off, 12);
    const interval = mod(keyPc - base.keyPc, 12);
    return {
      chords: true, shape: inst.shape || noteName(shapePc, base.minor, null), shapeAuto, capo, capoAuto,
      shift: roundTrip(shapePc - base.shapePc), tuningOff: off,
      keyText: keyLabel(interval ? noteName(keyPc, base.minor, null) : base.keyName, base.minor), interval, intervalText: intervalText(interval),
    };
  }

  function describe(inst, r, base) {
    if (!inst.chords) return `lyrics only · sings in ${base.keyText}`;
    const parts = [];
    try {
      const t = parseTuning(inst.tuning || 'standard');
      const o = tuningOffset(t.notes);
      let x = `${t.name} tuning (${t.notes.join(' ')})`;
      if (o) x += `, ${Math.abs(o)} semitone${Math.abs(o) === 1 ? '' : 's'} ${o < 0 ? 'below' : 'above'} standard`;
      parts.push(x);
    } catch (e) { /* invalid tuning: omit */ }
    parts.push(r.capo ? `capo ${r.capo}` : 'no capo');
    parts.push(r.shift ? `${r.shape} shapes (tab's ${base.shape} played as ${r.shape})` : `${r.shape} shapes (as written)`);
    parts.push(r.interval ? `sounds in ${r.keyText}: ${r.intervalText.replace('the song key', 'the song key ' + base.keyText)}` : `key ${base.keyText}`);
    return parts.join(' · ');
  }

  function relayout(segs) {
    const out = [];
    let end = -1;
    for (const g of segs) {
      const c = out.length ? Math.max(g.c, end + 1) : g.c;
      out.push({ c, t: g.t, ch: g.ch });
      end = c + g.t.length;
    }
    return out;
  }

  function spelling(song, shift) {
    const cores = [];
    for (const s of song.sections) for (const u of s.units) for (const r of u)
      for (const g of r.segs || []) if (g.ch) { const p = parseChordToken(g.t); if (p) cores.push(p[1]); }
    const t = songTonic(cores);
    return t ? prefersFlats(mod(t.pc + shift, 12), t.minor) : null;
  }

  /** Apply instrument to a parsed song -> sections ready for layout. */
  function applyInstrument(song, inst, shift, collapse) {
    shift = inst.chords ? shift : 0;
    const flats = shift ? spelling(song, shift) : null;
    const out = [];
    const seen = new Map();
    for (const [idx, sec] of song.sections.entries()) {
      let units = [];
      for (const unit of sec.units) {
        const rows = [];
        for (const r of unit) {
          if (r.kind === 'chords') {
            if (!inst.chords) continue;
            rows.push(row('chords', { segs: relayout(r.segs.map((g) => ({ c: g.c, t: g.ch ? transposeToken(g.t, shift, flats) : g.t, ch: g.ch }))) }));
          } else if (r.kind === 'tab') { if (inst.chords) rows.push(r); }
          else rows.push(r);
        }
        if (rows.length && !(rows.length === 1 && rows[0].kind === 'gap' && !units.length)) units.push(rows);
      }
      if (!units.length && sec.title) units = [[row('note', { text: '(instrumental)' })]];
      if (!units.length) continue;
      if (collapse && sec.title) {
        const sig = JSON.stringify(units.flat().map((r) => [r.kind, r.text, (r.segs || []).map((g) => [g.c, g.t])]));
        const realRows = units.filter((u) => u[0].kind !== 'gap').reduce((a, u) => a + u.length, 0);
        if (seen.has(sig) && realRows >= 2) units = [[row('note', { text: `(as ${seen.get(sig)} above)` })]];
        else if (!seen.has(sig)) seen.set(sig, sec.title);
      }
      out.push({ title: sec.title, units, idx });
    }
    return out;
  }

  // ───────────────────────────── layout (pt) ─────────────────────────────
  const MM = 72 / 25.4;
  const SHEET_W = 841.89, SHEET_H = 588; // A4 landscape; height kept a few pt under the page so a sheet never spills onto an extra page
  const PW = SHEET_W / 2, PH = 595.28; // one A5 page
  const TOP = 13 * MM, BOTTOM = 11 * MM, INNER = 12 * MM, OUTER = 8 * MM;
  const MIN_SIZE = 7.5, MAX_SIZE = 9.5, PAIR_GAP = 0.3;
  const CONTENT_W = PW - INNER - OUTER;

  const rowHeight = (kind, lh) => (kind === 'header' ? lh * 1.3 : kind === 'gap' ? lh * 0.45 : lh);
  const unitHeight = (u, lh) =>
    u.reduce((a, r) => a + rowHeight(r.kind, lh), 0) +
    (u[u.length - 1].kind === 'lyric' && u.some((r) => r.kind === 'chords') ? PAIR_GAP * lh : 0);

  function wrapPair(segs, lyric, cols) {
    const width = (sg, ly) => Math.max(ly === null ? 0 : ly.length, ...sg.map((g) => g.c + g.t.length), 0);
    const out = [];
    for (let guard = 0; width(segs, lyric) > cols && guard < 50; guard++) {
      if (lyric === null) { // chord-only line: break between tokens
        let brk = segs.findIndex((g) => g.c + g.t.length > cols);
        if (brk < 0) brk = segs.length;
        brk = Math.max(brk, 1);
        const rest = segs.slice(brk);
        if (!rest.length) break;
        const shift = rest[0].c;
        out.push([segs.slice(0, brk), null]);
        segs = rest.map((g) => ({ c: g.c - shift, t: g.t, ch: g.ch }));
        continue;
      }
      // a chord that starts before the break must also end inside the line, so break before any chord that would hang over
      let limit = cols;
      for (const g of segs) if (g.c < cols && g.c + g.t.length > cols) limit = Math.min(limit, g.c);
      let b = lyric.lastIndexOf(' ', limit);
      if (b <= 0) b = lyric.lastIndexOf(' ', cols);
      if (b <= 0) b = cols;
      const first = segs.filter((g) => g.c < b);
      const rest = segs.filter((g) => g.c >= b);
      const skip = lyric[b] === ' ' ? 1 : 0;
      out.push([first, lyric.slice(0, b)]);
      lyric = lyric.slice(b + skip);
      segs = rest.map((g) => ({ c: Math.max(g.c - b - skip, 0), t: g.t, ch: g.ch }));
      if (!lyric && !segs.length) return out;
    }
    out.push([segs, lyric]);
    return out;
  }

  function wrapUnit(unit, cols) {
    if (unit.every((r) => r.kind === 'tab')) {
      const w = Math.max(...unit.map((r) => r.text.length));
      if (w <= cols) return unit;
      const out = [];
      for (let s = 0; s < w; s += cols) for (const r of unit) out.push(row('tab', { text: r.text.slice(s, s + cols) }));
      return out;
    }
    if (unit[0].kind === 'chords') {
      const out = [];
      for (const [sg, ly] of wrapPair(unit[0].segs, unit.length > 1 ? unit[1].text : null, cols)) {
        if (sg.length || ly === null) out.push(row('chords', { segs: sg })); // a wrapped piece with no chords is lyrics only
        if (ly !== null) out.push(row('lyric', { text: ly }));
      }
      return out;
    }
    const out = [];
    for (const r of unit) {
      if ((r.kind === 'lyric' || r.kind === 'note') && r.text.length > cols)
        for (const [, ly] of wrapPair([], r.text, cols)) out.push(row(r.kind, { text: ly }));
      else out.push(r);
    }
    return out;
  }

  function targetCols(sections) {
    const ws = [];
    for (const s of sections) for (const u of s.units) for (const r of u) {
      if (r.kind === 'chords') ws.push(Math.max(0, ...r.segs.map((g) => g.c + g.t.length)));
      else if (r.kind === 'lyric' || r.kind === 'tab') ws.push(r.text.length);
    }
    if (!ws.length) return 1;
    ws.sort((a, b) => a - b);
    return Math.max(ws[Math.min(ws.length - 1, Math.floor(ws.length * 0.97))], 1);
  }

  function wrapWords(text, maxChars) {
    const out = [];
    let cur = '';
    for (const w of text.split(/\s+/)) {
      if (cur && (cur + ' ' + w).length > maxChars) { out.push(cur); cur = w; }
      else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) out.push(cur);
    return out;
  }

  function titleBlock(title, artist, instName, desc, notes) {
    const lines = [
      { text: title, cls: 'tt', size: 15, adv: 18 },
      { text: (artist ? artist + ' — ' : '') + instName, cls: 'st', size: 9.5, adv: 12 },
    ];
    for (const part of wrapWords(desc, Math.floor(CONTENT_W / (0.5 * 7.5)))) lines.push({ text: part, cls: 'ds', size: 7.5, adv: 10 });
    for (const n of notes) for (const part of wrapWords(n, Math.floor(CONTENT_W / (0.5 * 7.5)))) lines.push({ text: part, cls: 'nt', size: 7.5, adv: 9.5 });
    return lines;
  }

  function paginate(sections, tbHeight, lh, cols, usable) {
    const pages = [[]];
    let y = tbHeight, first = true;
    const newPage = () => { pages.push([]); y = 0; };
    for (const sec of sections) {
      const units = sec.units.map((u) => wrapUnit(u, cols));
      if (sec.title) units[0] = [row('header', { text: sec.title })].concat(units[0]);
      const heights = units.map((u) => unitHeight(u, lh));
      const total = heights.reduce((a, b) => a + b, 0);
      let lead = (pages[pages.length - 1].length || y > 0) && !first ? lh * 0.6 : 0;
      first = false;
      if (y + lead + total > usable && total <= usable && pages[pages.length - 1].length) newPage();
      units.forEach((u, k) => {
        const h = heights[k];
        const cur = () => pages[pages.length - 1];
        if (u[0].kind === 'gap' && (!cur().length || y === 0)) return;
        if (y + lead + h > usable && cur().length) { newPage(); lead = 0; }
        if (!cur().length) lead = 0;
        y += lead; lead = 0;
        let used = 0;
        for (const r of u) { cur().push({ row: r, y }); const rh = rowHeight(r.kind, lh); y += rh; used += rh; }
        y += h - used;
      });
    }
    return pages;
  }

  /** The font is sized so ~97% of the lines fit the page width, but never below minSize (default MIN_SIZE):
   *  at the minimum, wider lines wrap instead of shrinking the text further. minSize is capped at maxSize. */
  function layout(sections, meta, maxSize, fit, minSize) {
    const lo = Math.min(minSize || MIN_SIZE, maxSize);
    const base = Math.min(maxSize, CONTENT_W / (0.6 * targetCols(sections)));
    const size0 = Math.max(lo, base);
    const run = (sz) => {
      const cols = Math.floor(CONTENT_W / (0.6 * sz));
      const lh = sz * 1.22;
      const tb = titleBlock(meta.title, meta.artist, meta.instName, meta.desc, meta.notes);
      const tbH = tb.reduce((a, l) => a + l.adv, 0) + 4;
      return { pages: paginate(sections, tbH, lh, cols, PH - TOP - BOTTOM), size: sz, lh, tb };
    };
    let res = run(size0);
    if (fit && res.pages.length % 4 === 1 && res.pages.length > 1) { // pull a lone stray page back onto the sheet
      for (let s = size0 - 0.25; s >= lo; s -= 0.25) {
        const cand = run(s);
        if (cand.pages.length < res.pages.length) { res = cand; break; }
      }
    }
    return res;
  }

  /** Saddle-stitch imposition: [left,right] 1-based page numbers per sheet side (null = blank). */
  function bookletOrder(n) {
    const total = Math.max(4, Math.ceil(n / 4) * 4);
    const sides = [];
    for (let i = 0; i < total / 4; i++) { sides.push([total - 2 * i, 2 * i + 1]); sides.push([2 * i + 2, total - 2 * i - 1]); }
    return sides.map(([a, b]) => [a <= n ? a : null, b <= n ? b : null]);
  }

  /** Plain spreads: pages side by side, 1|2, 3|4 … (no folding). */
  function flatOrder(n) {
    const sides = [];
    for (let i = 1; i <= Math.max(n, 1); i += 2) sides.push([i, i + 1 <= n ? i + 1 : null]);
    return sides;
  }

  // ───────────────────────────── HTML output ─────────────────────────────
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const f = (x) => Math.round(x * 100) / 100;

  /** localNo: page within its song (1 = title block); globalNo: number printed on the page. */
  function pageHtml(L, localNo, meta, side, globalNo) {
    const odd = side === 'R'; // right-hand page: gutter (inner margin) on the left
    const left = odd ? INNER : OUTER;
    const right = odd ? OUTER : INNER;
    const sz = L.size, lh = L.lh;
    let h = '';
    if (localNo === 1) {
      let y = TOP;
      for (const l of L.tb) { h += `<div class="${l.cls}" style="left:${f(left)}pt;top:${f(y)}pt;font-size:${l.size}pt">${esc(l.text)}</div>`; y += l.adv; }
    } else {
      h += `<div class="rh" style="left:${f(left)}pt;top:${f(8 * MM)}pt">${esc(meta.title + ' — ' + meta.instName)}</div>`;
    }
    h += `<div class="pn" style="${odd ? 'right' : 'left'}:${f(OUTER)}pt">${globalNo}</div>`;
    for (const p of L.pages[localNo - 1]) {
      const r = p.row, top = f(TOP + p.y);
      if (r.kind === 'gap') continue; // spacing only; has no text to draw
      const common = `top:${top}pt;height:${f(lh)}pt;line-height:${f(lh)}pt;font-size:${f(sz)}pt`;
      if (r.kind === 'chords') {
        h += `<div class="ln" style="${common};left:${f(left)}pt">` +
          r.segs.map((g) => `<span class="${g.ch ? 'ch' : 'fl'}" style="left:${g.c}ch">${esc(g.t)}</span>`).join('') + '</div>';
      } else if (r.kind === 'header') {
        h += `<div class="hd" style="top:${top}pt;left:${f(left)}pt;right:${f(right)}pt;font-size:${f(sz * 0.95)}pt;line-height:${f(lh)}pt"><b>${esc(r.text.toUpperCase())}</b><i></i></div>`;
      } else {
        const cls = r.kind === 'note' ? 'nl' : 'tx';
        h += `<div class="ln ${cls}" style="${common};left:${f(left)}pt">${esc(r.text)}</div>`;
      }
    }
    return h;
  }

  /** One booklet from one or more songs laid out back to back (each song starts on a new page, with its own
   *  title block; page numbers run through the whole book). parts: [{ sections, meta }].
   *  -> { html, pages, sides, sheets, mode, size, ranges:[{title, from, to, side}] } */
  function renderBook(parts, opts) {
    opts = opts || {};
    const want = opts.layout || 'auto'; // auto: booklet for 3+ pages, plain side-by-side spreads for 1–2
    const fit = !opts.noFit && want !== 'flat' && parts.length === 1;
    const refs = [], ranges = [];
    let size = 0;
    for (const p of parts) {
      const L = layout(p.sections, p.meta, opts.maxSize || MAX_SIZE, fit, opts.minSize);
      ranges.push({ title: p.meta.title, from: refs.length + 1, to: refs.length + L.pages.length });
      L.pages.forEach((_, i) => refs.push({ L, meta: p.meta, local: i + 1 }));
      size = size ? Math.min(size, L.size) : L.size;
    }
    const n = refs.length;
    const mode = want === 'flat' || (want === 'auto' && n <= 2) ? 'flat' : 'booklet';
    const sides = mode === 'flat' ? flatOrder(n) : bookletOrder(n);
    const sideOf = {};
    sides.forEach(([a, b], k) => { if (a) sideOf[a] = k; if (b) sideOf[b] = k; });
    ranges.forEach((r) => { r.side = sideOf[r.from] || 0; });
    const lab = (x) => (x ? x : '–');
    const build = (list, capOf, fold) => {
      let html = '';
      list.forEach(([a, b], k) => {
        html += `<div class="cap">${capOf(k, a, b)}</div><section class="sheet">`;
        for (const [pn, x, side] of [[a, 0, 'L'], [b, PW, 'R']]) {
          if (pn) { const ref = refs[pn - 1]; html += `<div class="pg" style="left:${f(x)}pt">${pageHtml(ref.L, ref.local, ref.meta, side, pn)}</div>`; }
        }
        html += (fold ? '<div class="fold"></div>' : '') + '</section>';
      });
      return html;
    };
    // what gets printed: a flat spread per side, or booklet sheets imposed for folding (pages are NOT in reading order)
    const html = mode === 'flat'
      ? build(sides, (k, a, b) => `Side ${k + 1} — pages ${lab(a)} | ${lab(b)}`, false)
      : build(sides, (k, a, b) => `Sheet ${(k >> 1) + 1} · ${k % 2 ? 'back' : 'front'} — pages ${lab(a)} | ${lab(b)}`, true);
    // the same pages in reading order, for previewing only
    const htmlReading = mode === 'flat' ? html
      : build(flatOrder(n), (k, a, b) => `Pages ${a}${b ? ' | ' + b : ''}`, false);
    ranges.forEach((r) => { r.readSide = (r.from - 1) >> 1; });
    return { html, htmlReading, pages: n, sides: sides.length, sheets: mode === 'flat' ? sides.length : sides.length / 2, mode, size, ranges };
  }
  const renderInstrument = (sections, meta, opts) => renderBook([{ sections, meta }], opts);

  /** Scrollable, unpaginated view of one instrument's sections for jam mode. */
  function jamHtml(sections) {
    return sections.map((sec) => {
      let h = `<div class="jsec" data-src="${sec.idx}">`;
      if (sec.title) h += `<div class="jhd">${esc(sec.title)}</div>`;
      for (const u of sec.units) {
        if (u[0].kind === 'gap') { h += '<div class="jgap"></div>'; continue; }
        h += '<div class="junit">' + u.map((r) => {
          if (r.kind === 'chords') {
            let line = '', pos = 0;
            for (const g of r.segs) {
              if (g.c > pos) { line += ' '.repeat(g.c - pos); pos = g.c; }
              line += g.ch ? `<b>${esc(g.t)}</b>` : `<em>${esc(g.t)}</em>`;
              pos += g.t.length;
            }
            return `<div class="jl">${line}</div>`;
          }
          return `<div class="jl${r.kind === 'note' ? ' jn' : ''}">${esc(r.text)}</div>`;
        }).join('') + '</div>';
      }
      return h + '</div>';
    }).join('');
  }

  const api = {
    // chords
    isChord, parseChordToken, transposeToken, transposeChord, shapeShift, parseTuning, tuningOffset, TUNINGS, NOTE_NAMES,
    // parsing / instruments
    parse, chordSegments, detectKey, applyInstrument, resolveBaseline, resolveInstrument, describe,
    // layout / output
    bookletOrder, flatOrder, renderInstrument, renderBook, jamHtml, layout, constants: { SHEET_W, SHEET_H, PW, PH, MAX_SIZE },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TabsPrint = api;
})(typeof window !== 'undefined' ? window : globalThis);
