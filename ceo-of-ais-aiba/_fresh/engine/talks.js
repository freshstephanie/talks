/* Fresh Talks engine - navigation, fit, steps, notes, grid, presenter view.
   Plain JavaScript, no dependencies, works offline. Components hook in via Talks.on(...). */
(function () {
  'use strict';
  const W = 1600, H = 900;
  const params = new URLSearchParams(location.search);
  const MODE = params.has('presenter') ? 'presenter' : (params.get('embed') || '');   // '', 'presenter', 'follow', 'next'
  const CH = 'fresh-talks:' + location.pathname;
  const BASE = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');   // engine/ folder

  const T = window.Talks = {
    slides: [], i: 0, step: 0,
    handlers: { enter: [], leave: [], step: [], beforeNext: [] },
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); },
    emit(ev, detail) { (this.handlers[ev] || []).forEach(fn => fn(detail)); },
  };

  let deck, canvas, ui, overlay, notesBox, blank, chan, idleTimer;

  function init() {
    deck = document.querySelector('.deck');
    if (!deck) return;
    canvas = document.createElement('div');
    canvas.className = 'deck-canvas';
    T.slides = [...deck.children].filter(el => el.classList.contains('slide'));
    T.slides.forEach((s, n) => {
      canvas.appendChild(s);
      s.dataset.n = n + 1;
      s.insertAdjacentHTML('beforeend', '<i class="ft-cue" aria-hidden="true"></i>');   // >> = slide finished, next click moves on
      s.maxStep = Math.max(0, ...[...s.querySelectorAll('[data-step]')].map(e => parseInt(e.dataset.step, 10) || 0),
        ...[...s.querySelectorAll('[data-on]')].map(e => parseInt(e.dataset.on, 10) || 0),
        ...[...s.querySelectorAll('.dgm[data-states]')].map(e => (parseInt(e.dataset.firstStep, 10) || 0) + e.dataset.states.trim().split(/\s+/).length - 1),
        ...[...s.querySelectorAll('[data-steps]')].map(e => parseInt(e.dataset.steps, 10) || 0));
    });
    deck.appendChild(canvas);
    buildChrome();
    fit();
    window.addEventListener('resize', fit);

    if (MODE === 'presenter') return buildPresenter();
    if (MODE) document.body.classList.add('is-embed');
    else { bindInput(); setInterval(updateDoneCue, 200); }
    openChannel();
    const [n, st] = parseHash();
    go(n, st, 0, true);
    window.addEventListener('hashchange', () => { const [a, b] = parseHash(); if (a !== T.i || b !== T.step) go(a, b, 0, true); });
    reportPlaceholders();
    if (params.has('review')) loadReview();
  }

  function fit() {
    // fit the canvas into the deck area (full window, or what the review panel leaves free)
    const s = Math.min((deck.clientWidth || window.innerWidth) / W, (deck.clientHeight || window.innerHeight) / H);
    canvas.style.setProperty('--scale', s);
  }

  function parseHash() {
    const m = location.hash.match(/^#(\d+)(?:\.(\d+))?/);
    return m ? [Math.max(0, Math.min(T.slides.length - 1, m[1] - 1)), parseInt(m[2] || 0, 10)] : [0, 0];
  }

  /* ---------- Navigation ---------- */
  function go(n, step = 0, dir = 0, force, fromAuto) {
    if (!fromAuto && auto && (n !== T.i || force)) stopAuto();
    n = Math.max(0, Math.min(T.slides.length - 1, n));
    const prev = T.slides[T.i];
    const next = T.slides[n];
    const changed = n !== T.i || force;
    if (changed) {
      if (prev && prev !== next) { prev.classList.remove('is-active'); T.emit('leave', { slide: prev }); }
      next.classList.remove('is-active');
      void next.offsetWidth;                 // restart every animation on revisit
      T.i = n;
      T.step = Math.min(step, next.maxStep);
      applySteps(next, true);
      next.classList.add('is-active');
      T.emit('enter', { slide: next, index: n, dir });
      // data-autostart="1.5" (her ask 13.10): no click on this slide; the build starts by itself after that many seconds
      if (T.step === 0 && next.maxStep > 0 && next.dataset.autostart !== undefined) {
        const s = next;
        stopAuto();
        auto = { s, t: setTimeout(() => {
          if (T.slides[T.i] !== s) return stopAuto();
          auto = null;
          go(T.i, 1, 1, false, true);
          if (T.step < s.maxStep) runAuto(s, autoGaps(s) || [1.8]);
        }, (parseFloat(s.dataset.autostart) || 1.5) * 1000) };
      }
    } else {
      T.step = Math.min(step, next.maxStep);
      applySteps(next);                      // emits 'step' exactly once
    }
    if (!MODE) {
      const h = '#' + (n + 1) + (T.step ? '.' + T.step : '');
      if (location.hash !== h) history.replaceState(null, '', h);
      broadcast();
    }
    changedAt = performance.now();
    updateChrome();
  }

  function applySteps(slide, entering) {
    slide.querySelectorAll('[data-step]').forEach(el => {
      const shown = T.step >= parseInt(el.dataset.step, 10);
      el.classList.toggle('is-shown', shown);
      if (el.dataset.hideAt) el.classList.toggle('is-gone', T.step >= parseInt(el.dataset.hideAt, 10));
    });
    slide.querySelectorAll('[data-on]').forEach(el => el.classList.toggle('is-on', T.step >= parseInt(el.dataset.on, 10)));
    if (!entering) T.emit('step', { slide, step: T.step });
  }

  /* Auto-step (opt-in, 12.10): <main class="deck" data-autostep="1.8"> makes ONE click play all remaining
     steps of a slide on a timer. A click while it runs jumps to the last step; the next click leaves the slide.
     Per slide: data-autostep="2.4" (one gap) or "1.2 3 1.5" (gap before step 2, 3, ...), or "off" (click per step). */
  let auto = null;
  function stopAuto() { if (auto) { clearTimeout(auto.t); auto = null; } }
  function autoGaps(s) {
    const v = s.dataset.autostep || (deck && deck.dataset.autostep);
    if (!v || v === 'off') return null;
    return v.trim().split(/\s+/).map(parseFloat);
  }
  function runAuto(s, gaps) {
    if (T.slides[T.i] !== s || T.step >= s.maxStep) return stopAuto();
    const k = T.step - 1, gap = gaps[Math.min(k, gaps.length - 1)] * 1000;   // gap before the next step
    auto = { s, t: setTimeout(() => { if (T.slides[T.i] !== s) return stopAuto(); go(T.i, T.step + 1, 1, false, true); runAuto(s, gaps); }, gap) };
  }

  /* The >> cue (her ask 12.10): shown next to the page number once the slide has nothing left to play -
     all steps shown, no auto-step or .run sequence pending, no finite animation still running. */
  let changedAt = 0;
  function slideDone(s) {
    if (T.step < s.maxStep || (auto && auto.s === s)) return false;
    if ([...s.querySelectorAll('.run')].some(r => r._resume || (r._token && !r.classList.contains('is-done')))) return false;
    // wall clock since the last slide/step change vs the longest finite animation (the animation clock stalls in hidden tabs)
    const ends = s.getAnimations({ subtree: true }).filter(a => a.playState !== 'finished' && a.effect)
      .map(a => a.effect.getComputedTiming().endTime).filter(isFinite);
    return performance.now() - changedAt >= Math.max(0, ...ends);
  }
  function updateDoneCue() {
    const s = T.slides[T.i]; if (!s) return;
    T.slides.forEach(x => { if (x !== s) x.classList.remove('is-done-cue'); });
    s.classList.toggle('is-done-cue', slideDone(s));
  }

  function next() {
    const s = T.slides[T.i];
    if (T.handlers.beforeNext.some(fn => fn(s) === true)) return;   // a running sequence consumed the click
    if (auto && auto.s === s) return;   // a build is playing: the click is ignored, so it can't skip (her ask 12.10)
    if (T.step < s.maxStep) {
      go(T.i, T.step + 1, 1);
      const gaps = autoGaps(s);
      if (gaps) runAuto(s, gaps);
    }
    else if (T.i < T.slides.length - 1) go(T.i + 1, 0, 1);
  }
  function prev() {
    stopAuto();
    if (T.step > 0) go(T.i, T.step - 1, -1);
    else if (T.i > 0) go(T.i - 1, T.slides[T.i - 1].maxStep, -1);
  }
  T.go = (n, s) => go(n, s || 0, 0);
  T.fit = () => fit();
  T.title = s => title(s);
  T.next = next; T.prev = prev;

  /* ---------- Input ---------- */
  function bindInput() {
    document.addEventListener('keydown', e => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"], .rv-panel'))) return;
      const k = e.key;
      const act = {
        ArrowRight: next, ArrowDown: next, ' ': next, PageDown: next, Enter: next,
        ArrowLeft: prev, ArrowUp: prev, PageUp: prev, Backspace: prev,
        Home: () => go(0), End: () => go(T.slides.length - 1),
        f: fullscreen, g: toggleGrid, b: toggleBlank, '.': toggleBlank, h: () => document.body.classList.toggle('hide-ui'),
        n: () => document.body.classList.toggle('show-notes'), s: openPresenter, p: togglePlaceholders,
        '?': toggleHelp, Escape: closeOverlays, e: loadReview,
      }[k.length === 1 ? k.toLowerCase() : k];
      if (act) { e.preventDefault(); act(); }
    });
    let x0 = null, y0 = null;
    document.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    document.addEventListener('touchend', e => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
      x0 = null;
    });
    const wake = () => {
      document.body.classList.remove('is-idle');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => document.body.classList.add('is-idle'), 2500);
    };
    document.addEventListener('mousemove', wake);
    wake();
  }

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  }
  function toggleBlank() { document.body.classList.toggle('is-blank'); }
  function togglePlaceholders() { document.body.classList.toggle('hide-ph'); }
  function closeOverlays() { overlay.classList.remove('is-open'); document.body.classList.remove('is-blank', 'show-notes'); }

  /* ---------- Chrome ---------- */
  function buildChrome() {
    ui = el('div', 'ft-ui');
    ui.innerHTML = '<span class="ft-ph" hidden></span><button data-a="prev" title="Previous (←)">←</button><span class="ft-count"></span>' +
      '<button data-a="next" title="Next (→)">→</button><button data-a="grid" title="Grid (G)">Grid</button>' +
      '<button data-a="notes" title="Notes (N) · Presenter (S)">Notes</button><button data-a="fs" title="Fullscreen (F)">⤢</button>' +
      '<button data-a="help" title="Keys (?)">?</button>';
    if (!deck.querySelector('.notes')) ui.querySelector('[data-a="notes"]').hidden = true;   // public copies carry no notes
    const home = document.querySelector('meta[name="ft-home"]');   // set by publish_public.py on the online copy
    if (home) {
      const a = el('a', 'ft-home'); a.href = home.content; a.textContent = home.dataset.label || 'All talks';
      ui.prepend(a);
    }
    const pdf = document.querySelector('meta[name="ft-pdf"]');   // opt-in per talk: <meta name="ft-pdf" content="assets/<file>.pdf">
    if (pdf) {
      const a = el('a', 'ft-pdf'); a.href = pdf.content; a.download = ''; a.textContent = '⤓ PDF'; a.title = 'Download the slides as PDF';
      // fetch first: a plain download skips the service worker, so a password-locked copy would get the encrypted 404
      a.addEventListener('click', e => {
        if (location.protocol === 'file:') return;   // offline from disk: the plain download works
        e.preventDefault();
        fetch(a.href).then(r => { if (!r.ok) throw r.status; return r.blob(); }).then(b => {
          const t = el('a', ''); t.href = URL.createObjectURL(b); t.download = a.href.split('/').pop();
          document.body.append(t); t.click(); t.remove(); setTimeout(() => URL.revokeObjectURL(t.href), 60000);
        }).catch(() => window.open(a.href, '_blank'));
      });
      ui.insertBefore(a, ui.querySelector('[data-a="help"]'));
    }
    ui.addEventListener('click', e => {
      const a = e.target.dataset.a;
      ({ prev, next, grid: toggleGrid, notes: () => document.body.classList.toggle('show-notes'), fs: fullscreen, help: toggleHelp }[a] || (() => {}))();
    });
    overlay = el('div', 'ft-overlay');
    overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlays(); });
    notesBox = el('div', 'ft-notes');
    blank = el('div', 'ft-blank');
    blank.addEventListener('click', toggleBlank);
    document.body.append(ui, overlay, notesBox, blank);
  }

  function updateChrome() {
    const s = T.slides[T.i];
    ui.querySelector('.ft-count').textContent = (T.i + 1) + ' / ' + T.slides.length + (s.maxStep ? ' · ' + T.step + '/' + s.maxStep : '');
    const n = s.querySelector('.notes');
    notesBox.innerHTML = '<b>' + (T.i + 1) + '. ' + title(s) + '</b>' + (n ? n.innerHTML : '<p><i>No notes.</i></p>');
    if (overlay.classList.contains('is-open') && overlay.dataset.kind === 'grid') markCurrentTile();
  }

  function title(s) {
    if (s.dataset.title) return s.dataset.title;
    const h = s.querySelector('h1, h2, h3, .t-display, .t-xl, .t-l');
    return h ? h.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) : (s.dataset.type || 'Slide');
  }

  function toggleGrid() {
    if (overlay.classList.contains('is-open') && overlay.dataset.kind === 'grid') return closeOverlays();
    overlay.dataset.kind = 'grid';
    overlay.innerHTML = '';
    const grid = el('div', 'ft-grid');
    T.slides.forEach((s, n) => {
      const tile = el('div', 'ft-tile');
      const thumb = el('div', 'ft-thumb');
      const clone = s.cloneNode(true);
      clone.classList.add('is-static', 'is-active');
      clone.querySelectorAll('.notes').forEach(x => x.remove());
      clone.querySelectorAll('video').forEach(v => { v.removeAttribute('autoplay'); v.preload = 'none'; });
      clone.querySelectorAll('[data-type-text]').forEach(x => { x.textContent = x.dataset.typeText; });
      thumb.appendChild(clone);
      const ph = s.querySelectorAll('.ph').length;
      const meta = el('div', 'ft-meta');
      meta.innerHTML = '<b>' + (n + 1) + '</b><span>' + (s.dataset.type || '') + (s.dataset.tone ? ' · ' + s.dataset.tone : '') + '</span>' +
        (ph ? '<span class="ft-flag">' + ph + ' needed</span>' : '');
      tile.append(thumb, meta);
      tile.addEventListener('click', () => { closeOverlays(); go(n, 0, 0); });
      grid.appendChild(tile);
    });
    overlay.appendChild(grid);
    overlay.classList.add('is-open');
    T.emit('grid', { overlay });
    markCurrentTile();
  }
  function markCurrentTile() {
    overlay.querySelectorAll('.ft-tile').forEach((t, n) => t.classList.toggle('is-current', n === T.i));
    const cur = overlay.querySelector('.is-current');
    cur && cur.scrollIntoView({ block: 'nearest' });
  }

  function toggleHelp() {
    if (overlay.classList.contains('is-open') && overlay.dataset.kind === 'help') return closeOverlays();
    overlay.dataset.kind = 'help';
    overlay.innerHTML = '<div class="ft-help"><h2>Keys</h2>' + [
      ['→ Space', 'next step / slide'], ['←', 'back'], ['Home End', 'first / last'], ['F', 'fullscreen'], ['G', 'grid of all slides'],
      ['B or .', 'blank screen'], ['H', 'hide controls'], ['N', 'notes overlay'], ['S', 'presenter window (notes, next, timer)'],
      ['P', 'hide placeholder labels'], ['E', 'review mode: comments, edits, images, export (source copy only)'], ['Esc', 'close'],
    ].map(([k, v]) => '<p><kbd>' + k + '</kbd>' + v + '</p>').join('') + '<p>Link to a slide: add #12 (or #12.2 for step 2) to the address.</p></div>';
    overlay.classList.add('is-open');
  }

  function reportPlaceholders() {
    const ph = document.querySelectorAll('.deck .ph');
    const badge = ui.querySelector('.ft-ph');
    if (!ph.length) return;
    badge.hidden = false;
    badge.textContent = ph.length + ' asset' + (ph.length > 1 ? 's' : '') + ' needed';
    badge.title = 'Placeholders still in the deck. Press G to see which slides.';
    console.info('[Fresh Talks] placeholders:', [...ph].map(p => (p.closest('.slide').dataset.n) + ': ' + (p.dataset.ph || '') + ' ' + (p.dataset.note || '')));
  }

  /* ---------- Review mode (development only) ----------
     engine/review.js is loaded on demand (E key or ?review). It is not part of packed copies:
     pack_talk.py leaves review.js/review.css out, so in a packed deck E does nothing. */
  function loadReview() {
    if (T.review) return T.review.toggle();
    if (T._reviewLoading || !BASE || /\/_fresh\/engine\/$/.test(BASE)) return;   // packed copy: no review layer, no request
    T._reviewLoading = true;
    const sc = document.createElement('script');
    sc.src = BASE + 'review.js';
    sc.onerror = () => { T._reviewLoading = false; console.info('[Fresh Talks] review mode is not part of this copy'); };
    document.body.appendChild(sc);
  }

  /* ---------- Presenter sync (BroadcastChannel, localStorage fallback for file://) ---------- */
  function openChannel() {
    try { chan = new BroadcastChannel(CH); chan.onmessage = e => onMsg(e.data); } catch (e) { chan = null; }
    window.addEventListener('storage', e => { if (e.key === CH && e.newValue) onMsg(JSON.parse(e.newValue)); });
  }
  function send(msg) {
    msg.t = Date.now();
    chan && chan.postMessage(msg);
    try { localStorage.setItem(CH, JSON.stringify(msg)); } catch (e) { /* storage blocked */ }
  }
  function broadcast() { send({ type: 'state', i: T.i, step: T.step }); }
  let lastKey = '';
  function onMsg(m) {
    if (!m) return;
    const key = m.type + (m.action || m.i + '.' + m.step) + m.t;   // same message can arrive by channel and by storage
    if (key === lastKey) return;
    lastKey = key;
    if (m.type === 'cmd' && !MODE) { ({ next, prev, blank: toggleBlank, sync: broadcast }[m.action] || (() => {}))(); }
    if (m.type === 'state' && (MODE === 'follow' || MODE === 'next')) {
      let i = m.i, st = m.step;
      if (MODE === 'next') { const s = T.slides[i]; if (st < s.maxStep) st++; else { i++; st = 0; } }
      if (i >= T.slides.length) { document.body.style.opacity = .15; return; }
      document.body.style.opacity = 1;
      go(i, st, 0, i !== T.i);
    }
  }
  function openPresenter() {
    window.open(location.pathname + '?presenter' + location.hash, 'fresh-talks-presenter', 'width=1280,height=800');
    setTimeout(broadcast, 800);
  }

  function buildPresenter() {
    document.body.classList.add('is-presenter');
    const base = location.pathname;
    const pv = el('div', 'ft-pv');
    pv.innerHTML = '<div class="ft-pv-bar"><span class="ft-clock">0:00</span><span class="ft-pos"></span><span class="ft-target"></span>' +
      '<button data-a="prev">← Back</button><button data-a="next">Next →</button><button data-a="blank">Blank</button><button data-a="reset">Reset timer</button></div>' +
      '<div class="ft-pv-frames"><iframe class="ft-cur" src="' + base + '?embed=follow"></iframe><iframe class="ft-next" src="' + base + '?embed=next"></iframe></div>' +
      '<div class="ft-pv-notes"></div>';
    document.body.appendChild(pv);
    let start = Date.now();
    setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      pv.querySelector('.ft-clock').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    }, 500);
    pv.addEventListener('click', e => {
      const a = e.target.dataset.a;
      if (a === 'reset') start = Date.now(); else if (a) send({ type: 'cmd', action: a });
    });
    document.addEventListener('keydown', e => {
      const a = { ArrowRight: 'next', ' ': 'next', PageDown: 'next', ArrowLeft: 'prev', PageUp: 'prev', b: 'blank' }[e.key];
      if (a) { e.preventDefault(); send({ type: 'cmd', action: a }); }
    });
    const show = m => {
      if (!m || m.type !== 'state') return;
      const s = T.slides[m.i];
      const n = s.querySelector('.notes');
      pv.querySelector('.ft-pos').textContent = 'Slide ' + (m.i + 1) + ' / ' + T.slides.length + (s.maxStep ? ' · step ' + m.step + '/' + s.maxStep : '') + ' · ' + title(s);
      pv.querySelector('.ft-target').textContent = s.dataset.time ? 'target ' + s.dataset.time : '';
      pv.querySelector('.ft-pv-notes').innerHTML = '<h4>Notes</h4>' + (n ? n.innerHTML : '<p><i>No notes.</i></p>');
    };
    try { chan = new BroadcastChannel(CH); chan.onmessage = e => show(e.data); } catch (e) { /* fallback below */ }
    window.addEventListener('storage', e => { if (e.key === CH && e.newValue) show(JSON.parse(e.newValue)); });
    try { show(JSON.parse(localStorage.getItem(CH))); } catch (e) { /* none yet */ }
    send({ type: 'cmd', action: 'sync' });
  }

  function el(tag, cls) { const e = document.createElement(tag); e.className = cls; return e; }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
