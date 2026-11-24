(function () {
  'use strict';
  const T = window.TabsPrint;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const STORE = 'tabsprint.v1';

  const EXAMPLE = `Little Lantern
by The Example Band
Tuning: Drop D   Capo 2

[Intro]
| Dm  Bb | F  C | x2

[Riff]
e|-----------0-----|
B|---------3---3---|
G|-------2-------2-|
D|-0---0-----------|
A|-----------------|
D|-----------------|

[Verse]
Dm                Bb
Carry the little lantern down the hill
F                 C
Nobody's watching but the whippoorwill
Dm              Bb          Gm7   A7
Every step is lighter than the last

[Chorus]
Bb        F
Shine, shine, shine on me
C/E       Dm
Light the way back home (x2)

[Verse]
Dm                Bb
Morning comes in over the glass
F                 C
Dad says "Gone are the days that pass"

[Chorus]
Bb        F
Shine, shine, shine on me
C/E       Dm
Light the way back home (x2)
`;

  let nextId = 1, nextSong = 1;
  const newGuitar = (n) => ({ id: nextId++, name: n || 'guitar', chords: true, tuning: 'standard', capo: '', shape: '' });
  const newVox = () => ({ id: nextId++, name: 'vox', chords: false, tuning: 'standard', capo: '', shape: '' });
  // a song = one baseline tab + its own instrument configuration
  const newSong = (instruments) => ({
    id: nextSong++, text: '', title: '', artist: '',
    base: { shape: '', capo: 0, key: '' }, // the tab: shape ('' = detect) + capo -> key, or key -> capo
    instruments: instruments || [newGuitar('guitar')],
  });

  const state = {
    mode: 'single',            // 'single' = one song (the default); 'setlist' = several songs in one booklet per instrument
    songs: [newSong()], cur: 0, activeKey: null,
    collapse: false, notes: true, maxFont: 9.5, minFont: 7.5, layout: 'auto', printAll: false,
    editorPreview: true,       // the large editor shows a live preview next to the text
    view: 'sheets',            // preview only: 'sheets' = as printed (booklets imposed for folding), 'read' = pages in reading order
    jamA: null, jamB: null, jamFont: 15,
  };
  const cur = () => state.songs[state.cur];
  /** Which booklet an instrument card stands for: by id in single mode, by (case-insensitive) name in setlist mode. */
  const instKey = (i) => (state.mode === 'setlist' ? 'n:' + (i.name.trim() || 'instrument').toLowerCase() : 'i' + i.id);

  // Only data saved in the old format (instrument.key = what is now "shape") needs migrating.
  function normInstrument(i) {
    if ('key' in i) { i.shape = i.key || ''; delete i.key; if (i.shape || !i.capo) i.capo = ''; }
    i.shape = i.shape || '';
    if (i.capo === undefined || i.capo === null) i.capo = '';
    return i;
  }
  /** Replace the whole app state from a saved/imported object. Returns false if it isn't a usable config. */
  function applyState(s) {
    if (!s || typeof s !== 'object') return false;
    let songs;
    if (Array.isArray(s.songs) && s.songs.length) songs = s.songs;
    else if (Array.isArray(s.instruments) && s.instruments.length) {   // saved before setlists existed: one flat song
      songs = [{ text: s.text, title: s.title, artist: s.artist, base: s.base, instruments: s.instruments, baseKey: s.baseKey }];
      if (s.active) state.activeKey = 'i' + s.active;
    } else return false;
    for (const k of ['mode', 'collapse', 'notes', 'maxFont', 'minFont', 'layout', 'printAll', 'view', 'editorPreview', 'jamA', 'jamB', 'jamFont', 'activeKey']) if (k in s) state[k] = s[k];
    state.songs = songs.map((sg, n) => {
      const base = Object.assign({ shape: '', capo: 0, key: '' }, sg.base || {});
      if (sg.baseKey) base.shape = sg.baseKey;
      const ins = sg.instruments && sg.instruments.length ? sg.instruments : [newGuitar('guitar')];
      return { id: n + 1, text: String(sg.text || ''), title: String(sg.title || ''), artist: String(sg.artist || ''), base, instruments: ins.map(normInstrument) };
    });
    state.cur = Math.max(0, Math.min(state.songs.length - 1, s.cur || 0));
    nextSong = state.songs.length + 1;
    nextId = Math.max(0, ...state.songs.flatMap((sg) => sg.instruments.map((i) => i.id || 0))) + 1;
    return true;
  }
  function load() {
    try { applyState(JSON.parse(localStorage.getItem(STORE) || 'null')); } catch (e) { /* storage unavailable or corrupt: start fresh */ }
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  const noteOptions = (cur, autoLabel) =>
    `<option value="">${esc(autoLabel)}</option>` + T.NOTE_NAMES.map((n) => `<option value="${n}"${n === cur ? ' selected' : ''}>${n}</option>`).join('');
  // set an input's value without disturbing someone who is typing in it
  const setVal = (el, v) => { if ((el.disabled || document.activeElement !== el) && String(el.value) !== String(v)) el.value = v; };

  // ── instrument cards (of the current song) ──
  function tuningOptions(cur) {
    const presets = Object.keys(T.TUNINGS);
    const isPreset = presets.includes(cur);
    return presets.map((k) => `<option value="${k}"${k === cur ? ' selected' : ''}>${k}</option>`).join('') +
      `<option value="custom"${isPreset ? '' : ' selected'}>custom…</option>`;
  }
  function cardHtml(i) {
    const custom = !Object.keys(T.TUNINGS).includes(i.tuning);
    return `<div class="card" data-id="${i.id}">
      <div class="head"><input type="text" class="nm" data-f="name" value="${esc(i.name)}" aria-label="Instrument name">
        <span class="cpg" data-pages></span>
        <button type="button" data-act="rm" title="Remove instrument" aria-label="Remove instrument">×</button></div>
      <label class="chk"><input type="checkbox" data-f="lyricsOnly"${i.chords ? '' : ' checked'}> Lyrics only (strip chords)</label>
      <div class="grid" data-chordfields>
        <label>Tuning <select data-f="tuningSel">${tuningOptions(i.tuning)}</select></label>
        <label>Capo <input type="number" min="0" max="12" data-f="capo" value="${i.capo}" title="Leave empty for auto: computed so the instrument sounds in the song key"></label>
        <label class="full" data-customwrap style="${custom ? '' : 'display:none'}">Tuning notes, low→high
          <input type="text" data-f="tuningCustom" value="${custom ? esc(i.tuning) : ''}" placeholder="B-E-A-D-F#-B"></label>
        <label class="full">Shape
          <select data-f="shape">${noteOptions(i.shape, 'Auto')}</select></label>
      </div>
      <div class="ro" data-ro></div>
    </div>`;
  }
  function renderCards() {
    $('insts').innerHTML = cur().instruments.map(cardHtml).join('');
    syncCards();
  }
  function syncCards() {
    for (const card of $('insts').children) {
      const i = cur().instruments.find((x) => x.id === +card.dataset.id);
      card.querySelector('[data-chordfields]').style.opacity = i.chords ? '' : '.4';
      card.querySelectorAll('[data-chordfields] select, [data-chordfields] input').forEach((el) => { el.disabled = !i.chords; });
    }
  }

  $('insts').addEventListener('input', onCard);
  $('insts').addEventListener('change', onCard);
  $('insts').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act=rm]');
    if (!b) return;
    const id = +b.closest('.card').dataset.id;
    const song = cur();
    if (song.instruments.length === 1 && !confirm('Remove the last instrument?')) return;
    song.instruments = song.instruments.filter((x) => x.id !== id);
    if (state.activeKey === 'i' + id) state.activeKey = null;
    renderCards(); update();
  });
  function onCard(e) {
    const card = e.target.closest('.card');
    const f = e.target.dataset.f;
    if (!card || !f) return;
    const i = cur().instruments.find((x) => x.id === +card.dataset.id);
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (f !== 'name') selectCard(card);      // changing a card's settings selects it (a rename keeps the selection, below)
    if (f === 'name') { const was = instKey(i); i.name = v; if (state.activeKey === was) state.activeKey = instKey(i); }   // the selection follows a rename
    else if (f === 'lyricsOnly') { i.chords = !v; }
    else if (f === 'capo') i.capo = v === '' ? '' : Math.max(0, Math.min(12, parseInt(v, 10) || 0));
    else if (f === 'shape') i.shape = v;
    else if (f === 'tuningSel') {
      const wrap = card.querySelector('[data-customwrap]');
      if (v === 'custom') {
        let c = i.tuning;
        try { c = T.parseTuning(i.tuning).notes.join('-'); } catch (err) { /* keep */ }
        i.tuning = c; wrap.style.display = ''; card.querySelector('[data-f=tuningCustom]').value = c;
      } else { i.tuning = v; wrap.style.display = 'none'; }
    } else if (f === 'tuningCustom') { i.tuning = v; }
    syncCards();
    update();
  }

  // ── per-song derived data ──
  const pcache = new Map();
  function parsedOf(song) {
    const c = pcache.get(song.id);
    if (c && c.text === song.text) return c.s;
    const s = T.parse(song.text);
    pcache.set(song.id, { text: song.text, s });
    return s;
  }
  /** Everything derived from one song's settings: its tab's key/shape/capo and each instrument's. */
  function infoOf(song) {
    const s = parsedOf(song);
    const det = T.detectKey(s);
    const base = T.resolveBaseline(song.base, det);
    const res = new Map(song.instruments.map((i) => [i.id, T.resolveInstrument(i, base)]));
    return { song, s, det, base, res, meta: { title: song.title || s.title || 'Untitled', artist: song.artist || s.artist || '' } };
  }
  const setup = () => infoOf(cur());   // the song being edited (used by jam mode too)
  const partOf = (info, inst) => {
    const r0 = info.res.get(inst.id);
    return {
      sections: T.applyInstrument(info.s, inst, r0.shift, state.collapse),
      meta: { title: info.meta.title, artist: info.meta.artist, instName: inst.name.trim() || 'instrument',
              desc: T.describe(inst, r0, info.base), notes: state.notes ? info.s.notes : [] },
    };
  };

  // ── preview ──
  let timer = null, pendingScroll = false, lastResult = [], lastBySong = new Map();
  function update() { clearTimeout(timer); timer = setTimeout(render, 80); }

  function render() {
    save();
    const setlist = state.mode === 'setlist';
    const mine = setup();
    const { s, det, base, res } = mine;
    const song = cur();
    const infos = setlist ? state.songs.map((sg) => (sg === song ? mine : infoOf(sg))) : [mine];

    // mode chrome
    $('modeSet').checked = setlist;
    $('setlistBox').hidden = !setlist;
    $('baseHead').textContent = setlist ? `Song ${state.cur + 1} — baseline tab` : 'Baseline tab';

    // baseline controls: shape + capo -> key, or key -> capo
    $('baseShape').innerHTML = noteOptions(song.base.shape, `Auto${det ? ` (detected: ${det.name}${det.minor ? ' minor' : ''})` : ''}`);
    $('baseKey').innerHTML = noteOptions(song.base.key, `Computed (${base.keyText})`);
    const bc = $('baseCapo');
    bc.disabled = !!song.base.key; // capo is derived when the key is given directly
    setVal(bc, base.capo);
    $('baseNote').textContent = song.base.key
      ? `Song sounds in ${base.keyText}; the tab's ${base.shape} shapes then need capo ${base.capo}.`
      : `${base.shape} shapes${base.capo ? ` with capo ${base.capo}` : ' with no capo'} sound in ${base.keyText}.`;
    $('title').placeholder = s.title || 'Untitled';
    $('artist').placeholder = s.artist || '';

    // instrument cards: show what is computed
    for (const card of $('insts').children) {
      const i = song.instruments.find((x) => x.id === +card.dataset.id);
      const r0 = res.get(i.id);
      const ro = card.querySelector('[data-ro]');
      const input = card.querySelector('[data-f=tuningCustom]');
      let bad = false;
      if (i.chords) { try { T.parseTuning(i.tuning); } catch (err) { bad = true; } }
      if (input) input.classList.toggle('bad', bad);
      const capoEl = card.querySelector('[data-f=capo]');
      const shapeEl = card.querySelector('[data-f=shape]');
      if (i.chords) {
        shapeEl.options[0].textContent = `Auto (${T.resolveInstrument(Object.assign({}, i, { shape: '' }), base).shape})`;
        setVal(capoEl, i.capo);
        capoEl.placeholder = r0.capoAuto ? `auto ${r0.capo}` : '';
      }
      if (!i.chords) ro.innerHTML = `Lyrics only — chords and tab are left out. Sings in <b>${esc(base.keyText)}</b>.`;
      else if (bad) ro.textContent = 'Unrecognised tuning — use notes like B-E-A-D-F#-B.';
      else ro.innerHTML = `<b>${esc(r0.shape)}</b> shapes${r0.capo ? ` + capo <b>${r0.capo}</b>` : ''} → ` +
        (r0.interval ? `sounds in <b>${esc(r0.keyText)}</b>: <span class="iv">${esc(r0.intervalText)}</span>` : `key <b>${esc(r0.keyText)}</b> (the song key)`) +
        ` · ${r0.shift ? `chords shift <b>${r0.shift > 0 ? '+' : ''}${r0.shift}</b> from the tab` : 'chords as in the tab'}`;
    }

    // books: single mode = one per instrument of this song; setlist = one per instrument *name*, spanning all songs
    const books = [];
    if (!setlist) {
      for (const inst of song.instruments) books.push({ key: 'i' + inst.id, name: inst.name.trim() || 'instrument', items: [{ info: mine, inst, si: 0 }] });
    } else {
      const byKey = new Map();
      infos.forEach((info, si) => {
        for (const inst of info.song.instruments) {
          const nm = inst.name.trim() || 'instrument';
          const k = 'n:' + nm.toLowerCase();
          if (!byKey.has(k)) { const b = { key: k, name: nm, items: [] }; byKey.set(k, b); books.push(b); }
          byKey.get(k).items.push({ info, inst, si });
        }
      });
    }
    const opts = { maxSize: state.maxFont, minSize: state.minFont, layout: state.layout };
    const results = books.map((book) => {
      const items = book.items.filter((it) => it.info.s.sections.length);
      const r = items.length ? T.renderBook(items.map((it) => partOf(it.info, it.inst)), opts)
        : { html: '', pages: 0, sheets: 0, sides: 0, mode: 'flat', size: 0, ranges: [] };
      return { book, items, r };
    });
    const hasContent = results.some((x) => x.r.pages);
    if (!results.some((x) => x.book.key === state.activeKey)) state.activeKey = results[0] && results[0].book.key;
    const act = results.find((x) => x.book.key === state.activeKey);

    $('sheets').innerHTML = results.map((x) => `<div class="grp" data-key="${esc(x.book.key)}"><div class="v-print">${x.r.html}</div><div class="v-read">${x.r.htmlReading || ''}</div></div>`).join('');
    document.body.dataset.view = state.view;
    $('view').value = state.view;
    $('sheets').querySelectorAll('.grp').forEach((g, k) => {
      const active = g.dataset.key === state.activeKey;
      g.classList.toggle('active', active);
      // the first group that will be printed must not get a page break before it (that prints an empty first page)
      g.classList.toggle('pfirst', state.printAll ? k === 0 : active);
    });
    document.body.toggleAttribute('data-all', !!state.printAll);  // persistent: printing never depends on toggling at print time
    $('empty').style.display = hasContent ? 'none' : '';
    $('bar').style.display = hasContent ? '' : 'none';
    // instrument cards: highlight the active one and show its page count
    const resByKey = new Map(results.map((x) => [x.book.key, x]));
    const own = new Set();
    for (const card of $('insts').children) {
      const i = song.instruments.find((x) => x.id === +card.dataset.id);
      const k = instKey(i); own.add(k);
      card.classList.toggle('active', k === state.activeKey);
      const rr = resByKey.get(k);
      card.querySelector('[data-pages]').textContent = rr && rr.r.pages ? `${rr.r.pages} p` : '';
    }
    // setlist: booklets for instrument names this song doesn't have (other songs do) get a small selectable card
    $('ghosts').innerHTML = results.filter((x) => !own.has(x.book.key)).map(({ book, r }) =>
      `<div class="card ghost${book.key === state.activeKey ? ' active' : ''}" data-key="${esc(book.key)}"><div class="head"><b class="nm">${esc(book.name)}</b>` +
      `<span class="cpg">${r.pages ? r.pages + ' p' : ''}</span></div><div class="ro">Not in this song. Select to preview its booklet; configure it in the songs that have it.</div></div>`).join('');

    // info about the active booklet
    const hasTab = (info) => info.s.sections.some((sec) => sec.units.some((u) => u.some((r) => r.kind === 'tab')));
    if (act && act.r.pages) {
      const shifted = act.items.some((it) => hasTab(it.info) && it.inst.chords && it.info.res.get(it.inst.id).shift);
      const warn = shifted ? ' · ASCII tab frets are printed as in the source (not re-fretted)' : '';
      const pg = `${act.r.pages} page${act.r.pages === 1 ? '' : 's'}`;
      const out = act.r.mode === 'booklet'
        ? `booklet: ${act.r.sheets} sheet${act.r.sheets === 1 ? '' : 's'}, ${act.r.sides} sides, duplex flip on short edge`
        : `${act.r.sides} side${act.r.sides === 1 ? '' : 's'}, pages side by side (no folding)`;
      $('info').textContent = `${pg} → ${out} · ${act.r.size.toFixed(1)}pt${warn}`;
    }
    $('foldnote').hidden = !(act && act.r.pages && act.r.mode === 'booklet' && state.view === 'sheets');
    lastResult = results.map(({ book, items, r }) => ({
      key: book.key, name: book.name, songs: items.map((it) => it.info.meta.title),
      pages: r.pages, sheets: r.sheets, sides: r.sides, mode: r.mode, fontPt: +r.size.toFixed(2), ranges: r.ranges,
    }));
    const bySong = new Map();
    if (act) act.items.forEach((it, k) => bySong.set(it.si, act.r.ranges[k]));
    lastBySong = bySong;
    if (setlist) {
      // the song list doubles as the table of contents: each song shows its pages in the active instrument's booklet
      $('songs').innerHTML = state.songs.map((sg, i) => {
        const t = infos[i].s.sections.length ? infos[i].meta.title : (sg.text.trim() ? 'Untitled' : 'Empty song');
        const rg = bySong.get(i);
        const pages = !act || !hasContent ? '' : rg
          ? `<span class="pgrange" title="pages in the ${esc(act.book.name)} booklet">p.${rg.from}${rg.to > rg.from ? '–' + rg.to : ''}</span>`
          : `<span class="pgrange none" title="this song has no instrument called ${esc(act.book.name)}">–</span>`;
        return `<div class="song${i === state.cur ? ' sel' : ''}" data-i="${i}"><span class="n">${i + 1}</span><span class="t">${esc(t)}</span>${pages}` +
          `<span class="sb"><button type="button" data-act="up" title="Move up"${i === 0 ? ' disabled' : ''}>↑</button>` +
          `<button type="button" data-act="down" title="Move down"${i === state.songs.length - 1 ? ' disabled' : ''}>↓</button>` +
          `<button type="button" data-act="del" title="Remove song"${state.songs.length === 1 ? ' disabled' : ''}>×</button></span></div>`;
      }).join('');
    }
    $('jamOpen').disabled = song.instruments.length < 2;
    $('jamOpen').title = song.instruments.length < 2 ? 'Add a second instrument to use jam mode' : 'Show two instruments of this song side by side, scrolling together';
    document.title = hasContent ? `${setlist ? 'Setlist' : mine.meta.title}${state.printAll || !act ? '' : ' - ' + act.book.name}` : 'tabsprint';
    fitPreview();
    if (pendingScroll) { pendingScroll = false; jumpToSong(state.cur); }
  }

  function scrollToSide(side, readSide) {
    const read = state.view === 'read';
    const sh = $('sheets').querySelectorAll(`.grp.active ${read ? '.v-read' : '.v-print'} .sheet`)[read ? readSide : side];
    if (sh) (sh.previousElementSibling || sh).scrollIntoView({ block: 'start' });
  }
  /** Scroll the preview to where song i starts in the active instrument's booklet. */
  function jumpToSong(i) { const rg = lastBySong.get(i); if (rg) scrollToSide(rg.side, rg.readSide); }

  function fitPreview() {
    const avail = $('sheets').parentElement.clientWidth;
    const w = 841.89 * (96 / 72);
    $('sheets').style.zoom = Math.min(1, avail / w).toFixed(3);
  }
  window.addEventListener('resize', fitPreview);

  // Selecting an instrument = making its card the one that is previewed and printed. A card is selected by clicking it
  // anywhere (except its remove button), by focusing a field inside it (so Tab / keyboard use works too) or by editing it.
  function selectCard(card) {
    if (!card) return false;
    let key = card.dataset.key;                                   // ghost cards carry their key
    if (!key) { const i = cur().instruments.find((x) => x.id === +card.dataset.id); if (!i) return false; key = instKey(i); }
    if (key === state.activeKey) return false;
    state.activeKey = key;
    return true;
  }
  $('cardrow').addEventListener('click', (e) => {
    if (e.target.closest('[data-act]')) return;
    if (selectCard(e.target.closest('.card'))) render();
  });
  $('cardrow').addEventListener('focusin', (e) => {
    if (e.target.closest('[data-act]')) return;
    if (selectCard(e.target.closest('.card'))) render();
  });

  // Print just prints what the page already shows (active instrument, or all when the box is ticked).
  $('printOne').addEventListener('click', () => window.print());
  $('printAll').addEventListener('change', (e) => { state.printAll = e.target.checked; update(); });

  // ── setlist: song list ──
  function loadInputs() {
    const song = cur();
    $('src').value = song.text; $('title').value = song.title; $('artist').value = song.artist;
    renderCards();
  }
  function selectSong(i) { state.cur = i; pendingScroll = true; loadInputs(); render(); }
  $('songs').addEventListener('click', (e) => {
    const row = e.target.closest('.song');
    if (!row) return;
    const i = +row.dataset.i;
    const act = e.target.closest('button[data-act]');
    if (!act) { if (i !== state.cur) selectSong(i); else jumpToSong(i); return; }   // clicking the selected song jumps to it again
    const a = act.dataset.act;
    const keep = cur();
    if (a === 'up' || a === 'down') {
      const j = a === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= state.songs.length) return;
      [state.songs[i], state.songs[j]] = [state.songs[j], state.songs[i]];
      state.cur = state.songs.indexOf(keep);
      render();
    } else if (a === 'del') {
      if (state.songs.length === 1) return;
      const sg = state.songs[i];
      if (sg.text.trim() && !confirm(`Remove "${infoOf(sg).meta.title}" from the setlist?`)) return;
      state.songs.splice(i, 1);
      state.cur = sg === keep ? Math.min(i, state.songs.length - 1) : state.songs.indexOf(keep);
      pendingScroll = true;
      loadInputs(); render();
    }
  });
  $('addSong').addEventListener('click', () => {
    // a new song starts with the same instruments (tuning, capo, shape) as the current one, but its own tab
    const copy = cur().instruments.map((i) => Object.assign({}, i, { id: nextId++ }));
    state.songs.splice(state.cur + 1, 0, newSong(copy));
    state.cur += 1;
    loadInputs(); render();
    $('src').focus();
  });
  $('modeSet').addEventListener('change', (e) => { state.mode = e.target.checked ? 'setlist' : 'single'; pendingScroll = true; render(); });

  $('view').addEventListener('change', (e) => { state.view = e.target.value; render(); });

  // ── export / import the complete config (to share a reproducible bug report) ──
  $('exportCfg').addEventListener('click', () => {
    const payload = {
      app: 'tabsprint', format: 1, exportedAt: new Date().toISOString(),
      env: { userAgent: navigator.userAgent, language: navigator.language, viewport: [innerWidth, innerHeight],
             devicePixelRatio: window.devicePixelRatio, colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' },
      state: JSON.parse(JSON.stringify(state)),   // everything: mode, songs (tabs, key/capo, instruments), options, view
      result: lastResult,                          // what the app computed from it (pages, sheets, mode, per-song page ranges)
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `tabsprint-config-${payload.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('importCfg').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const o = JSON.parse(await file.text());
      if (!applyState(o && o.state ? o.state : o)) throw new Error('no songs/instruments found');
    } catch (err) { alert('Could not import: this is not a tabsprint config (' + err.message + ').'); return; }
    pcache.clear(); pendingScroll = false;
    $('layout').value = state.layout; $('printAll').checked = !!state.printAll;
    $('collapse').checked = state.collapse; $('notes').checked = state.notes; $('maxFont').value = state.maxFont; $('minFont').value = state.minFont;
    loadInputs(); render();
  });

  // ── baseline + options wiring (edits the current song) ──
  $('src').addEventListener('input', (e) => { cur().text = e.target.value; update(); });
  $('title').addEventListener('input', (e) => { cur().title = e.target.value; update(); });
  $('artist').addEventListener('input', (e) => { cur().artist = e.target.value; update(); });
  $('baseShape').addEventListener('change', (e) => { cur().base.shape = e.target.value; update(); });
  $('baseKey').addEventListener('change', (e) => { cur().base.key = e.target.value; update(); });
  $('baseCapo').addEventListener('input', (e) => { cur().base.capo = Math.max(0, Math.min(12, parseInt(e.target.value, 10) || 0)); update(); });
  const bind = (id, key, conv) => $(id).addEventListener('input', (e) => { state[key] = conv ? conv(e.target) : e.target.value; update(); });
  bind('collapse', 'collapse', (el) => el.checked);
  bind('notes', 'notes', (el) => el.checked);
  bind('layout', 'layout');
  bind('maxFont', 'maxFont', (el) => Math.max(6, Math.min(14, parseFloat(el.value) || 9.5)));
  bind('minFont', 'minFont', (el) => Math.max(5, Math.min(14, parseFloat(el.value) || 7.5)));
  $('example').addEventListener('click', () => { cur().text = EXAMPLE; $('src').value = EXAMPLE; update(); });
  $('clear').addEventListener('click', () => { cur().text = ''; $('src').value = ''; update(); });
  $('addGuitar').addEventListener('click', () => {
    const song = cur();
    const n = song.instruments.filter((i) => i.chords).length;
    song.instruments.push(newGuitar(n ? 'guitar' + (n + 1) : 'guitar'));
    renderCards(); update();
  });
  $('addVox').addEventListener('click', () => { cur().instruments.push(newVox()); renderCards(); update(); });

  // ── large editor: big text area, per-line "how it is read" gutter, cleanup tools, live preview ──
  const ed = { open: false, inst: null, timer: null };
  const KIND_TAG = { header: 'H', chords: 'C', lyric: 'L', tab: 'T', meta: 'M', blank: '·' };

  function editorGutter() {
    const ta = $('etext');
    const kinds = T.lineKinds(ta.value);
    $('egut').innerHTML = kinds.map((k, i) =>
      `<div class="k-${k.kind}${k.odd ? ' odd' : ''}" title="${k.odd ? 'contains invisible characters; ' : ''}read as ${k.kind}">${k.odd ? '⚠' : ''}${i + 1} <b>${KIND_TAG[k.kind]}</b></div>`).join('');
    $('egut').scrollTop = ta.scrollTop;
    const odd = T.countOdd(ta.value);
    $('toolOdd').classList.toggle('warn', odd > 0);
    const counts = kinds.reduce((a, k) => { a[k.kind] = (a[k.kind] || 0) + 1; return a; }, {});
    $('estatus').textContent = (odd ? `⚠ ${odd} invisible character${odd === 1 ? '' : 's'} — use “Clean invisible characters”. ` : '') +
      `${kinds.length} lines · ${counts.header || 0} headers · ${counts.chords || 0} chord lines · ${counts.lyric || 0} lyric lines`;
    $('estatus').dataset.base = $('estatus').textContent;
  }
  function editorPreview() {
    $('ebody').classList.toggle('nopreview', !state.editorPreview);
    $('ePrevOn').checked = state.editorPreview;
    $('ePrevInst').style.display = state.editorPreview ? '' : 'none';
    if (!state.editorPreview) return;
    const song = cur();
    if (!song.instruments.some((i) => i.id === ed.inst)) ed.inst = (song.instruments.find((i) => i.chords) || song.instruments[0]).id;
    $('ePrevInst').innerHTML = song.instruments.map((i) => `<option value="${i.id}"${i.id === ed.inst ? ' selected' : ''}>${esc(i.name.trim() || 'instrument')}</option>`).join('');
    const info = infoOf(song);
    const inst = song.instruments.find((i) => i.id === ed.inst);
    if (!info.s.sections.length) { $('eprev').innerHTML = '<div class="evinfo">Nothing printable yet.</div>'; return; }
    const r = T.renderBook([partOf(info, inst)], { maxSize: state.maxFont, minSize: state.minFont, layout: 'flat' });
    const w = $('eprev').clientWidth - 20;
    $('eprev').innerHTML = `<div class="evinfo">Preview of “${esc(inst.name.trim() || 'instrument')}” — ${r.pages} A5 page${r.pages === 1 ? '' : 's'}, in reading order</div>` +
      `<div id="eprevin" style="zoom:${Math.min(1, w / (841.89 * 96 / 72)).toFixed(3)}">${r.html}</div>`;
  }
  function editorInput() {
    const song = cur();
    song.text = $('etext').value;
    $('src').value = song.text;
    editorGutter();
    clearTimeout(ed.timer); ed.timer = setTimeout(editorPreview, 150);
    update();
  }
  /** Replace the whole editor text, keeping the browser's native undo (Ctrl/Cmd+Z) working. */
  function setEditorText(text) {
    const ta = $('etext');
    const top = ta.scrollTop;
    ta.focus(); ta.select();
    let done = false;
    try { done = document.execCommand('insertText', false, text); } catch (e) { done = false; }
    if (!done || ta.value !== text) { ta.value = text; ta.dispatchEvent(new Event('input', { bubbles: true })); }
    ta.scrollTop = top; $('egut').scrollTop = top;
  }
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  function runTool(name) {
    const before = $('etext').value;
    let after = before, msg = '';
    if (name === 'odd') {
      const n = T.countOdd(before); after = T.stripInvisible(before);
      msg = n ? `Cleaned ${plural(n, 'invisible/odd character')}.` : 'No invisible characters found.';
    } else if (name === 'trim') {
      let n = 0;
      after = before.split('\n').map((l) => { const t = l.replace(/\s+$/, ''); if (t !== l) n++; return t; }).join('\n');
      msg = n ? `Trimmed the end of ${plural(n, 'line')}.` : 'No trailing spaces.';
    } else if (name === 'blank') {
      after = before.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '') + '\n';
      const n = before.split('\n').length - after.split('\n').length;
      msg = n > 0 ? `Removed ${plural(n, 'blank line')}.` : 'No extra blank lines.';
    } else if (name === 'dedent') {
      const lines = before.split('\n');
      const lead = (l) => l.match(/^ */)[0].length;
      const m = Math.min(...lines.filter((l) => l.trim()).map(lead), Infinity);
      if (m > 0 && m !== Infinity) { after = lines.map((l) => l.slice(Math.min(m, lead(l)))).join('\n'); msg = `Removed an indent of ${plural(m, 'space')}.`; }
      else msg = 'No common indent.';
    }
    if (after !== before) setEditorText(after);
    $('estatus').textContent = msg;   // shown until the next edit refreshes the status line
  }
  function openEditor() {
    ed.open = true;
    const song = cur();
    $('etitle').textContent = `Edit tab — ${infoOf(song).meta.title}`;
    $('etext').value = song.text;
    $('editor').hidden = false; document.body.classList.add('editing');
    editorGutter(); editorPreview();
    $('etext').scrollTop = 0; $('etext').focus();
    $('etext').setSelectionRange(0, 0);
  }
  function closeEditor() {
    ed.open = false;
    $('editor').hidden = true; document.body.classList.remove('editing');
    $('src').value = cur().text;
    render();
  }
  $('expandEdit').addEventListener('click', openEditor);
  $('editorClose').addEventListener('click', closeEditor);
  $('etext').addEventListener('input', editorInput);
  $('etext').addEventListener('scroll', () => { $('egut').scrollTop = $('etext').scrollTop; }, { passive: true });
  $('editor').addEventListener('click', (e) => { const b = e.target.closest('button[data-tool]'); if (b) runTool(b.dataset.tool); });
  $('ePrevOn').addEventListener('change', (e) => { state.editorPreview = e.target.checked; save(); editorPreview(); });
  $('ePrevInst').addEventListener('change', (e) => { ed.inst = +e.target.value; editorPreview(); });
  window.addEventListener('resize', () => { if (ed.open) editorPreview(); });

  // ── jam mode: two instruments, one scroll ──
  const jam = { A: $('jsA'), B: $('jsB'), lock: null };

  function jamPick() {
    const ids = cur().instruments.map((i) => i.id);
    if (!ids.includes(state.jamA)) state.jamA = ids[0];
    if (!ids.includes(state.jamB) || state.jamB === state.jamA) state.jamB = ids.find((x) => x !== state.jamA);
  }
  function renderJam() {
    jamPick();
    const { s, base, res } = setup();
    const opts = cur().instruments.map((i) => [i.id, i.name.trim() || 'instrument']);
    for (const [sel, cur] of [['jamA', state.jamA], ['jamB', state.jamB]])
      $(sel).innerHTML = opts.map(([id, n]) => `<option value="${id}"${id === cur ? ' selected' : ''}>${esc(n)}</option>`).join('');
    for (const [k, id] of [['A', state.jamA], ['B', state.jamB]]) {
      const inst = cur().instruments.find((i) => i.id === id);
      const r0 = res.get(inst.id);
      const secs = T.applyInstrument(s, inst, r0.shift, state.collapse);
      $('jt' + k).innerHTML = `<b>${esc(inst.name.trim() || 'instrument')}</b><div>${esc(T.describe(inst, r0, base))}</div>`;
      jam[k].innerHTML = T.jamHtml(secs);
      jam[k].scrollTop = 0;
    }
    $('jam').style.setProperty('--jf', state.jamFont + 'px');
  }
  function jamPos(el) {
    const secs = [...el.querySelectorAll('.jsec')];
    if (!secs.length) return null;
    const y = el.scrollTop;
    let cur = secs[0];
    for (const sec of secs) { if (sec.offsetTop <= y + 1) cur = sec; else break; }
    return { idx: +cur.dataset.src, f: Math.max(0, Math.min(1, (y - cur.offsetTop) / Math.max(1, cur.offsetHeight))),
             atTop: y <= 1, atEnd: y + el.clientHeight >= el.scrollHeight - 2 };
  }
  function jamSetPos(el, p) {
    const secs = [...el.querySelectorAll('.jsec')];
    let tgt = null;
    for (const sec of secs) { if (+sec.dataset.src <= p.idx) tgt = sec; else break; }
    let y = 0;
    if (p.atTop) y = 0;
    else if (p.atEnd) y = el.scrollHeight;
    else if (tgt) y = tgt.offsetTop + (+tgt.dataset.src === p.idx ? p.f * tgt.offsetHeight : tgt.offsetHeight);
    const before = el.scrollTop;
    el.scrollTop = y;
    return el.scrollTop !== before;
  }
  for (const [me, other] of [['A', 'B'], ['B', 'A']]) {
    jam[me].addEventListener('scroll', () => {
      if (jam.lock === me) { jam.lock = null; return; } // this scroll was caused by syncing, don't echo it
      const p = jamPos(jam[me]);
      if (p && jamSetPos(jam[other], p)) jam.lock = other;
    }, { passive: true });
  }
  function openJam() { $('jam').hidden = false; document.body.classList.add('jamming'); renderJam(); }
  function closeJam() { $('jam').hidden = true; document.body.classList.remove('jamming'); }
  $('jamOpen').addEventListener('click', openJam);
  $('jamClose').addEventListener('click', closeJam);
  document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if (!$('editor').hidden) closeEditor(); else if (!$('jam').hidden) closeJam(); });
  $('jamA').addEventListener('change', (e) => { state.jamA = +e.target.value; if (state.jamB === state.jamA) state.jamB = null; save(); renderJam(); });
  $('jamB').addEventListener('change', (e) => { state.jamB = +e.target.value; if (state.jamA === state.jamB) state.jamA = null; save(); renderJam(); });
  const jamFont = (d) => { state.jamFont = Math.max(10, Math.min(40, state.jamFont + d)); save(); $('jam').style.setProperty('--jf', state.jamFont + 'px'); };
  $('jamMinus').addEventListener('click', () => jamFont(-1));
  $('jamPlus').addEventListener('click', () => jamFont(1));

  // ── init ──
  load();
  $('layout').value = state.layout; $('printAll').checked = !!state.printAll;
  $('collapse').checked = state.collapse; $('notes').checked = state.notes; $('maxFont').value = state.maxFont; $('minFont').value = state.minFont;
  loadInputs();
  render();
})();
