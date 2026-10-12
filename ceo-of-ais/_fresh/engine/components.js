/* Fresh Talks components - behaviour for the animated pieces. Styles live in theme/fresh.css.
   Everything is scripted and offline: no API, no network. Load after talks.js. */
(function () {
  'use strict';
  const T = window.Talks;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = ms => new Promise(r => setTimeout(r, REDUCED ? Math.min(ms, 60) : ms));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  /* ---------- Setup once ---------- */
  function setup() {
    // word-by-word reveal: wrap each word, keep inner markup (e.g. <span class="em">)
    document.querySelectorAll('[data-anim="words"]').forEach(root => {
      let i = 0;
      const walk = node => [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) return frag.appendChild(document.createTextNode(part));
            const w = document.createElement('span'); w.className = 'w'; w.style.setProperty('--i', i++); w.textContent = part;
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
      walk(root);
    });
    // remember full text of anything that gets typed
    document.querySelectorAll('[data-typing], .run [data-do="type"]').forEach(el => { el.dataset.typeText = el.textContent.trim(); });
    // placeholders: build their label from data attributes
    document.querySelectorAll('.ph').forEach(buildPlaceholder);
    // diagrams: add the link layer
    document.querySelectorAll('.dgm').forEach(setupDiagram);
  }

  /* ---------- Placeholders ---------- */
  const PH = { photo: 'PHOTO NEEDED', screenshot: 'SCREENSHOT NEEDED', article: 'ARTICLE NEEDED', example: 'REAL EXAMPLE NEEDED',
    video: 'VIDEO NEEDED', qr: 'QR URL NEEDED', portrait: 'PORTRAIT NEEDED', document: 'DOCUMENT NEEDED', data: 'DATA NEEDED', quote: 'QUOTE SOURCE NEEDED' };
  function buildPlaceholder(el) {
    if (el.children.length) return;
    const kind = el.dataset.ph || 'photo';
    el.innerHTML = '<div class="ph-dev"><b>[' + (PH[kind] || kind.toUpperCase() + ' NEEDED') + ']</b>' +
      (el.dataset.format ? '<span>' + el.dataset.format + '</span>' : '') +
      (el.dataset.note ? '<em>' + el.dataset.note + '</em>' : '') + '</div>';
  }

  /* ---------- Typing ---------- */
  async function type(el, token, root) {
    const text = el.dataset.typeText || '';
    const speed = parseInt(el.dataset.speed || 32, 10);
    el.textContent = '';
    el.classList.add('is-typing');
    for (let i = 1; i <= text.length; i++) {
      if (root._token !== token) return;
      el.textContent = text.slice(0, i);
      if (!REDUCED) await sleep(speed + (text[i - 1] === ' ' ? speed * .6 : 0) + (/[.,?!]/.test(text[i - 1]) ? 180 : 0));
    }
    el.classList.remove('is-typing');
  }

  /* ---------- Count-up ---------- */
  function fmt(v, el) {
    const dec = parseInt(el.dataset.decimals || 0, 10);
    return v.toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function count(el, token, root) {
    const to = parseFloat(el.dataset.count), from = parseFloat(el.dataset.from || 0);
    const dur = REDUCED ? 1 : parseInt(el.dataset.dur || 1600, 10);
    const t0 = performance.now();
    el.textContent = fmt(from, el);
    return new Promise(res => {
      const tick = now => {
        if (root && root._token !== token) return res();
        const p = Math.min(1, (now - t0) / dur);
        el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - p, 3)), el);
        p < 1 ? requestAnimationFrame(tick) : res();
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- Scripted run: prompt > processing > stages > result > evidence ----------
     <div class="run"> children with data-do="type|show|progress|count|light|pause", optional data-wait="ms". */
  function resetRun(root) {
    root.querySelectorAll('[data-do]').forEach(el => {
      el.classList.remove('is-on', 'is-typing');
      if (el.dataset.do === 'type') el.textContent = '';
      el.querySelectorAll('.bar > i').forEach(b => { b.style.transition = 'none'; b.style.width = '0'; });
    });
  }
  async function playRun(root) {
    const token = {};
    root._token = token;
    root._resume = null;
    resetRun(root);
    for (const el of root.querySelectorAll('[data-do]')) {
      await sleep(parseInt(el.dataset.wait ?? 350, 10));
      if (root._token !== token) return;
      const act = el.dataset.do;
      if (act === 'pause') { await new Promise(r => { root._resume = r; }); root._resume = null; continue; }
      el.classList.add('is-on');
      if (act === 'type') await type(el, token, root);
      else if (act === 'progress') {
        const dur = parseInt(el.dataset.dur || 1600, 10);
        const bars = el.querySelectorAll('.bar > i');
        bars.forEach(b => { void b.offsetWidth; b.style.transition = 'width ' + (REDUCED ? 10 : dur) + 'ms cubic-bezier(.3,.1,.3,1)'; b.style.width = b.dataset.v || '100%'; });
        await sleep(dur);
      } else if (act === 'count') await Promise.all([...el.querySelectorAll('[data-count]')].concat(el.matches('[data-count]') ? [el] : []).map(c => count(c, token, root)));
      else if (act === 'light') await sleep(500);
      else await sleep(250);
    }
    root.classList.add('is-done');
  }
  function stopRun(root) { root._token = null; if (root._resume) root._resume(); root.classList.remove('is-done'); }

  // a paused run consumes the Next key
  T.on('beforeNext', slide => {
    const r = [...slide.querySelectorAll('.run')].find(x => x._resume);
    if (r) { r._resume(); return true; }
    return false;
  });

  /* ---------- Evolving diagram / org / network ----------
     <div class="dgm" data-states="a b c" [data-first-step="1"] [data-enter-from="a"]>
       <div class="node" data-id="x" data-at="a:20,50 b:40,30" [data-in="b c"]>…</div>
       <i class="link" data-from="x" data-to="y" [data-in="b c"] [data-kind="dash"]></i>
       <div class="token" data-at="b:@x c:@y"></div>                       */
  function setupDiagram(d) {
    d._states = d.dataset.states.trim().split(/\s+/);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.classList.add('dgm-links');
    d.prepend(svg);
    d._links = [...d.querySelectorAll('.link')].map(l => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      line.setAttribute('class', 'dgm-link ' + (l.dataset.kind ? 'is-' + l.dataset.kind : ''));
      svg.appendChild(line);
      return { el: l, line };
    });
    d._nodes = [...d.querySelectorAll('.node, .token')];
    d._nodes.forEach(n => {
      n._at = {};
      (n.dataset.at || '').trim().split(/\s+/).filter(Boolean).forEach(pair => { const [st, v] = pair.split(':'); n._at[st] = v; });
    });
    setState(d, d.dataset.enterFrom || d._states[0], true);
  }
  function posOf(d, n, st) {
    // position in a state: explicit, "@node" (sit on a node), or last defined earlier state
    // a state outside data-states (e.g. data-enter-from) uses its own data-at entry, else the first state
    const order = d._states.includes(st) ? d._states.slice(0, d._states.indexOf(st) + 1) : [d._states[0], st];
    for (let k = order.length - 1; k >= 0; k--) {
      const v = n._at[order[k]];
      if (v) {
        if (v[0] === '@') { const t = d.querySelector('.node[data-id="' + v.slice(1) + '"]'); return t ? posOf(d, t, st) : [50, 50]; }
        return v.split(',').map(Number);
      }
    }
    return [50, 50];
  }
  const inState = (el, st) => !el.dataset.in || el.dataset.in.split(/\s+/).includes(st);
  function drawLinks(d) {
    d._links.forEach(({ el, line }) => {
      const a = d.querySelector('[data-id="' + el.dataset.from + '"]'), b = d.querySelector('[data-id="' + el.dataset.to + '"]');
      if (!a || !b || !a._p || !b._p) return;
      line.setAttribute('x1', a._p[0]); line.setAttribute('y1', a._p[1]); line.setAttribute('x2', b._p[0]); line.setAttribute('y2', b._p[1]);
    });
  }
  function setState(d, st, instant) {
    if (d._state === st && !instant) return;
    d._state = st;
    d.dataset.state = st;
    const from = d._nodes.map(n => n._p || posOf(d, n, st));
    const to = d._nodes.map(n => posOf(d, n, st));
    d._nodes.forEach(n => n.classList.toggle('is-out', !inState(n, st)));
    d._links.forEach(({ el, line }) => line.classList.toggle('is-out', !inState(el, st)));
    const apply = p => {
      d._nodes.forEach((n, k) => {
        n._p = [from[k][0] + (to[k][0] - from[k][0]) * p, from[k][1] + (to[k][1] - from[k][1]) * p];
        n.style.left = n._p[0] + '%'; n.style.top = n._p[1] + '%';
      });
      drawLinks(d);
    };
    d._tween = null;                         // cancel any motion still running, including before an instant reset
    if (instant || REDUCED) return apply(1);
    const dur = parseInt(d.dataset.dur || 900, 10), t0 = performance.now(), tok = d._tween = {};
    const tick = now => {
      if (d._tween !== tok) return;
      const p = Math.min(1, (now - t0) / dur);
      apply(ease(p));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  function diagramForStep(d, step) {
    const k = Math.max(0, Math.min(d._states.length - 1, step - (parseInt(d.dataset.firstStep, 10) || 0)));
    return d._states[k];
  }

  /* ---------- Slide lifecycle ---------- */
  T.on('enter', ({ slide }) => {
    // standalone typing and count-ups (not inside a run, not waiting for a step)
    const ready = el => !el.closest('.run') && !el.closest('[data-step]:not(.is-shown)');
    const token = slide._token = {};
    slide.querySelectorAll('[data-typing]').forEach(el => { if (ready(el)) sleep(parseFloat(el.dataset.delay || 0)).then(() => type(el, token, slide)); else el.textContent = ''; });
    slide.querySelectorAll('[data-count]').forEach(el => { if (ready(el)) sleep(parseFloat(el.dataset.delay || 0)).then(() => slide._token === token && count(el, token, slide)); });
    slide.querySelectorAll('.run').forEach(r => { if (!r.closest('[data-step]:not(.is-shown)')) playRun(r); });
    slide.querySelectorAll('.dgm').forEach(d => {
      // data-enter-from: start in the previous slide's state and move, so a diagram evolves across slides
      const target = diagramForStep(d, T.step), from = d.dataset.enterFrom;
      if (from && from !== target && T.step === 0) {
        setState(d, from, true);
        setTimeout(() => { if (T.slides[T.i] === slide) setState(d, diagramForStep(d, T.step)); }, 450);
      }
      else setState(d, target, true);
    });
    slide.querySelectorAll('video').forEach(v => {
      if (v.hasAttribute('autoplay') || v.dataset.play === 'enter') { try { v.currentTime = 0; } catch (e) { /* not loaded */ } v.play().catch(() => {}); }
      if (!v._bound) { v._bound = true; v.addEventListener('click', () => { v.muted = !v.muted; v.closest('.video') && v.closest('.video').classList.toggle('is-sound', !v.muted); }); }
    });
  });

  T.on('leave', ({ slide }) => {
    slide._token = null;
    slide.querySelectorAll('.run').forEach(stopRun);
    slide.querySelectorAll('.dgm').forEach(d => { d._tween = null; });
    slide.querySelectorAll('video').forEach(v => { v.pause(); v.muted = true; });
    slide.querySelectorAll('.video').forEach(v => v.classList.remove('is-sound'));
  });

  T.on('step', ({ slide, step }) => {
    const token = slide._token;
    // things revealed by this step start now
    slide.querySelectorAll('[data-step].is-shown').forEach(host => {
      if (host._played) return;
      host._played = true;
      host.querySelectorAll('[data-typing]').forEach(el => type(el, token, slide));
      if (host.matches('[data-typing]')) type(host, token, slide);
      host.querySelectorAll('[data-count]').forEach(el => count(el, token, slide));
      if (host.matches('[data-count]')) count(host, token, slide);
      host.querySelectorAll('.run').forEach(playRun);
      if (host.matches('.run')) playRun(host);
    });
    slide.querySelectorAll('[data-step]:not(.is-shown)').forEach(h => { h._played = false; });
    slide.querySelectorAll('.dgm').forEach(d => setState(d, diagramForStep(d, step)));
  });
  T.on('enter', ({ slide }) => slide.querySelectorAll('[data-step]').forEach(h => { h._played = h.classList.contains('is-shown'); }));

  // grid thumbnails show finished numbers
  T.on('grid', ({ overlay }) => overlay.querySelectorAll('[data-count]').forEach(el => { el.textContent = fmt(parseFloat(el.dataset.count), el); }));

  setup();
})();
