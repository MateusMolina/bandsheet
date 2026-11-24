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

  let nextId = 1;
  const newGuitar = (n) => ({ id: nextId++, name: n || 'guitar', chords: true, tuning: 'standard', capo: '', shape: '' });
  const newVox = () => ({ id: nextId++, name: 'vox', chords: false, tuning: 'standard', capo: '', shape: '' });

  const state = {
    text: '', title: '', artist: '',
    base: { shape: '', capo: 0, key: '' }, // the tab: shape ('' = detect) + capo -> key, or key -> capo
    collapse: false, notes: true, maxFont: 9.5, layout: 'auto', printAll: false,
    jamA: null, jamB: null, jamFont: 15,
    instruments: [newGuitar('guitar')], active: null,
  };

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (s && Array.isArray(s.instruments) && s.instruments.length) {
        Object.assign(state, s);
        // migrate settings saved by earlier versions (baseKey/"play in key" were really shapes)
        state.base = Object.assign({ shape: '', capo: 0, key: '' }, s.base || {});
        if (s.baseKey) { state.base.shape = s.baseKey; delete state.baseKey; }
        for (const i of state.instruments) {
          if ('key' in i) { i.shape = i.key || ''; delete i.key; }
          i.shape = i.shape || '';
          // capo is now '' (auto) or a number; before, a chosen shape always derived the capo and 0 meant "none"
          if (i.shape || !i.capo) i.capo = '';
        }
        nextId = Math.max(0, ...state.instruments.map((i) => i.id)) + 1;
      }
    } catch (e) { /* storage unavailable or corrupt: start fresh */ }
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  const noteOptions = (cur, autoLabel) =>
    `<option value="">${esc(autoLabel)}</option>` + T.NOTE_NAMES.map((n) => `<option value="${n}"${n === cur ? ' selected' : ''}>${n}</option>`).join('');
  // set an input's value without disturbing someone who is typing in it
  const setVal = (el, v) => { if ((el.disabled || document.activeElement !== el) && String(el.value) !== String(v)) el.value = v; };

  // ── instrument cards ──
  function tuningOptions(cur) {
    const presets = Object.keys(T.TUNINGS);
    const isPreset = presets.includes(cur);
    return presets.map((k) => `<option value="${k}"${k === cur ? ' selected' : ''}>${k}</option>`).join('') +
      `<option value="custom"${isPreset ? '' : ' selected'}>custom…</option>`;
  }
  function cardHtml(i) {
    const custom = !Object.keys(T.TUNINGS).includes(i.tuning);
    return `<div class="card" data-id="${i.id}">
      <div class="row"><input type="text" class="nm" data-f="name" value="${esc(i.name)}" aria-label="Instrument name">
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
    $('insts').innerHTML = state.instruments.map(cardHtml).join('');
    syncCards();
  }
  function syncCards() {
    for (const card of $('insts').children) {
      const i = state.instruments.find((x) => x.id === +card.dataset.id);
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
    if (state.instruments.length === 1 && !confirm('Remove the last instrument?')) return;
    state.instruments = state.instruments.filter((x) => x.id !== id);
    if (state.active === id) state.active = null;
    renderCards(); update();
  });
  function onCard(e) {
    const card = e.target.closest('.card');
    const f = e.target.dataset.f;
    if (!card || !f) return;
    const i = state.instruments.find((x) => x.id === +card.dataset.id);
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (f === 'name') i.name = v;
    else if (f === 'lyricsOnly') { i.chords = !v; }
    else if (f === 'capo') i.capo = v === '' ? '' : Math.max(0, Math.min(12, parseInt(v, 10) || 0));
    else if (f === 'shape') i.shape = v;
    else if (f === 'tuningSel') {
      const wrap = card.querySelector('[data-customwrap]');
      if (v === 'custom') {
        let cur = i.tuning;
        try { cur = T.parseTuning(i.tuning).notes.join('-'); } catch (err) { /* keep */ }
        i.tuning = cur; wrap.style.display = ''; card.querySelector('[data-f=tuningCustom]').value = cur;
      } else { i.tuning = v; wrap.style.display = 'none'; }
    } else if (f === 'tuningCustom') { i.tuning = v; }
    syncCards();
    update();
  }

  // ── preview ──
  let parsedFor = null, parsed = null;
  function song() {
    if (parsedFor !== state.text) { parsed = T.parse(state.text); parsedFor = state.text; }
    return parsed;
  }
  let timer = null;
  function update() { clearTimeout(timer); timer = setTimeout(render, 80); }

  /** Everything derived from the settings: the tab's key/shape/capo and each instrument's. */
  function setup() {
    const s = song();
    const det = T.detectKey(s);
    const base = T.resolveBaseline(state.base, det);
    const res = new Map(state.instruments.map((i) => [i.id, T.resolveInstrument(i, base)]));
    return { s, det, base, res };
  }

  function render() {
    save();
    const { s, det, base, res } = setup();
    const hasContent = s.sections.length > 0;

    // baseline controls: shape + capo -> key, or key -> capo
    $('baseShape').innerHTML = noteOptions(state.base.shape, `Auto${det ? ` (detected: ${det.name}${det.minor ? ' minor' : ''})` : ''}`);
    $('baseKey').innerHTML = noteOptions(state.base.key, `Computed (${base.keyText})`);
    const bc = $('baseCapo');
    bc.disabled = !!state.base.key; // capo is derived when the key is given directly
    setVal(bc, base.capo);
    $('baseNote').textContent = state.base.key
      ? `Song sounds in ${base.keyText}; the tab's ${base.shape} shapes then need capo ${base.capo}.`
      : `${base.shape} shapes${base.capo ? ` with capo ${base.capo}` : ' with no capo'} sound in ${base.keyText}.`;
    $('title').placeholder = s.title || 'Untitled';
    $('artist').placeholder = s.artist || '';

    const meta0 = { title: state.title || s.title || 'Untitled', artist: state.artist || s.artist || '' };
    const hasTab = s.sections.some((sec) => sec.units.some((u) => u.some((r) => r.kind === 'tab')));
    let sheetsHtml = '';
    const results = [];
    for (const inst of state.instruments) {
      const name = inst.name.trim() || 'instrument';
      const r0 = res.get(inst.id);
      const secs = T.applyInstrument(s, inst, r0.shift, state.collapse);
      const r = hasContent ? T.renderInstrument(secs, {
        title: meta0.title, artist: meta0.artist, instName: name,
        desc: T.describe(inst, r0, base), notes: state.notes ? s.notes : [],
      }, { maxSize: state.maxFont, layout: state.layout }) : { html: '', pages: 0, sheets: 0, sides: 0, mode: 'flat', size: 0 };
      results.push({ inst, name, r });
      sheetsHtml += `<div class="grp" data-id="${inst.id}">${r.html}</div>`;
    }
    if (!state.instruments.some((i) => i.id === state.active)) state.active = state.instruments[0] && state.instruments[0].id;

    // instrument cards: show what is computed
    for (const card of $('insts').children) {
      const i = state.instruments.find((x) => x.id === +card.dataset.id);
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

    $('sheets').innerHTML = sheetsHtml;
    $('sheets').querySelectorAll('.grp').forEach((g, k) => {
      g.classList.toggle('active', +g.dataset.id === state.active);
      // the first group that will be printed must not get a page break before it (that prints an empty first page)
      g.classList.toggle('pfirst', state.printAll ? k === 0 : +g.dataset.id === state.active);
    });
    document.body.toggleAttribute('data-all', !!state.printAll);  // persistent: printing never depends on toggling at print time
    $('empty').style.display = hasContent ? 'none' : '';
    $('bar').style.display = hasContent ? '' : 'none';
    $('tabs').innerHTML = results.map(({ inst, name, r }) =>
      `<button type="button" data-id="${inst.id}" class="${inst.id === state.active ? 'active' : ''}">${esc(name)}${hasContent ? ` · ${r.pages} p` : ''}</button>`).join('');
    const act = results.find((x) => x.inst.id === state.active);
    if (act && hasContent) {
      const warn = hasTab && act.inst.chords && res.get(act.inst.id).shift ? ' · ASCII tab frets are printed as in the source (not re-fretted)' : '';
      const pg = `${act.r.pages} page${act.r.pages === 1 ? '' : 's'}`;
      const out = act.r.mode === 'booklet'
        ? `booklet: ${act.r.sheets} sheet${act.r.sheets === 1 ? '' : 's'}, ${act.r.sides} sides, duplex flip on short edge`
        : `${act.r.sides} side${act.r.sides === 1 ? '' : 's'}, pages side by side (no folding)`;
      $('info').textContent = `${pg} → ${out} · ${act.r.size.toFixed(1)}pt${warn}`;
    }
    $('jamOpen').disabled = state.instruments.length < 2;
    $('jamOpen').title = state.instruments.length < 2 ? 'Add a second instrument to use jam mode' : 'Show two instruments side by side, scrolling together';
    document.title = hasContent ? (state.printAll ? meta0.title : `${meta0.title} - ${(act && act.name) || ''}`) : 'tabsprint';
    fitPreview();
  }

  function fitPreview() {
    const avail = $('sheets').parentElement.clientWidth;
    const w = 841.89 * (96 / 72);
    $('sheets').style.zoom = Math.min(1, avail / w).toFixed(3);
  }
  window.addEventListener('resize', fitPreview);

  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) { state.active = +b.dataset.id; render(); }
  });

  // Print just prints what the page already shows (active instrument, or all when the box is ticked).
  $('printOne').addEventListener('click', () => window.print());
  $('printAll').addEventListener('change', (e) => { state.printAll = e.target.checked; update(); });

  // ── baseline + options wiring ──
  const bind = (id, key, conv) => $(id).addEventListener('input', (e) => {
    state[key] = conv ? conv(e.target) : e.target.value;
    update();
  });
  bind('src', 'text'); bind('title', 'title'); bind('artist', 'artist');
  bind('collapse', 'collapse', (el) => el.checked);
  bind('notes', 'notes', (el) => el.checked);
  bind('layout', 'layout');
  bind('maxFont', 'maxFont', (el) => Math.max(6, Math.min(14, parseFloat(el.value) || 9.5)));
  $('baseShape').addEventListener('change', (e) => { state.base.shape = e.target.value; update(); });
  $('baseKey').addEventListener('change', (e) => { state.base.key = e.target.value; update(); });
  $('baseCapo').addEventListener('input', (e) => { state.base.capo = Math.max(0, Math.min(12, parseInt(e.target.value, 10) || 0)); update(); });
  $('example').addEventListener('click', () => { state.text = EXAMPLE; $('src').value = EXAMPLE; update(); });
  $('clear').addEventListener('click', () => { state.text = ''; $('src').value = ''; update(); });
  $('addGuitar').addEventListener('click', () => {
    const n = state.instruments.filter((i) => i.chords).length;
    state.instruments.push(newGuitar(n ? 'guitar' + (n + 1) : 'guitar'));
    renderCards(); update();
  });
  $('addVox').addEventListener('click', () => { state.instruments.push(newVox()); renderCards(); update(); });

  // ── jam mode: two instruments, one scroll ──
  const jam = { A: $('jsA'), B: $('jsB'), lock: null };

  function jamPick() {
    const ids = state.instruments.map((i) => i.id);
    if (!ids.includes(state.jamA)) state.jamA = ids[0];
    if (!ids.includes(state.jamB) || state.jamB === state.jamA) state.jamB = ids.find((x) => x !== state.jamA);
  }
  function renderJam() {
    jamPick();
    const { s, base, res } = setup();
    const opts = state.instruments.map((i) => [i.id, i.name.trim() || 'instrument']);
    for (const [sel, cur] of [['jamA', state.jamA], ['jamB', state.jamB]])
      $(sel).innerHTML = opts.map(([id, n]) => `<option value="${id}"${id === cur ? ' selected' : ''}>${esc(n)}</option>`).join('');
    for (const [k, id] of [['A', state.jamA], ['B', state.jamB]]) {
      const inst = state.instruments.find((i) => i.id === id);
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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('jam').hidden) closeJam(); });
  $('jamA').addEventListener('change', (e) => { state.jamA = +e.target.value; if (state.jamB === state.jamA) state.jamB = null; save(); renderJam(); });
  $('jamB').addEventListener('change', (e) => { state.jamB = +e.target.value; if (state.jamA === state.jamB) state.jamA = null; save(); renderJam(); });
  const jamFont = (d) => { state.jamFont = Math.max(10, Math.min(40, state.jamFont + d)); save(); $('jam').style.setProperty('--jf', state.jamFont + 'px'); };
  $('jamMinus').addEventListener('click', () => jamFont(-1));
  $('jamPlus').addEventListener('click', () => jamFont(1));

  // ── init ──
  load();
  $('src').value = state.text; $('title').value = state.title; $('artist').value = state.artist;
  $('layout').value = state.layout; $('printAll').checked = !!state.printAll;
  $('collapse').checked = state.collapse; $('notes').checked = state.notes; $('maxFont').value = state.maxFont;
  renderCards();
  render();
})();
