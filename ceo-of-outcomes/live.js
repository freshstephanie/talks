/* live.js: connects this deck to the CEO of Outcomes live room (fresh-ceo-of-outcomes.projectneuland.workers.dev).
   - Every slide change tells the room which slide is up (phones see the slides so far, never ahead).
   - The first vote slide opens Q1 (top 3), the second opens Q2 (when), the last slide closes the vote.
   - The first vote slide builds: QR and small star, then at the first vote the star moves beside the QR, grows and takes the room's shape.
   - Later painted stars (assets/star.png) take the same shape. The star stays as painted up to the first vote and on the Q2 slide.
   - ?live=demo plays made-up votes on the first vote slide, for rehearsal. It never touches the room.
   - The Q2 slide gets live bars in the deck's own style. No counts, percentages or decimals anywhere.
   The room accepts these cues only from talks.freshstrategy.ai and only during the talk window; outside it this
   script does nothing visible. Phone-width screens never cue the room (someone browsing the deck on a phone). */
(function () {
  'use strict';
  var B = 'https://fresh-ceo-of-outcomes.projectneuland.workers.dev/deck', S = window.DECK || [], N = S.length;
  var DRIVE = Math.max(screen.width, screen.height) >= 1000 && !/[?&]live=(off|demo)\b/.test(location.search);
  var DEMO = /[?&]live=demo\b/.test(location.search);
  var votes = [], VOTE = {};
  S.forEach(function (s, i) { if (s.kind === 'vote') votes.push(i + 1); });
  if (votes[0]) VOTE[votes[0]] = 1;
  if (votes[1]) VOTE[votes[1]] = 2;
  var Q2_OPTIONS = ['Now', 'In 2027', 'In 2028', 'Maybe never'];
  var KEY = 'outcomes-deck:star';
  function slideNo() { return Math.min(Math.max(parseInt(location.hash.slice(1), 10) || 1, 1), N); }

  /* ---- tell the room ---- */
  var last = 0;
  function cue(n) {
    if (!DRIVE) return;
    var q = VOTE[n] || (n === N ? 'close' : null);
    fetch(B + '/cue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ n: n, q: q }) }).catch(function () {});
  }
  function check() { var n = slideNo(); if (n !== last) { last = n; cue(n); } }
  var rs = history.replaceState;
  history.replaceState = function () { var r = rs.apply(this, arguments); setTimeout(check, 0); return r; };
  addEventListener('hashchange', check);

  /* ---- the star follows the room ---- */
  var NS = 'http://www.w3.org/2000/svg';
  (function defs() {
    var d = document.createElementNS(NS, 'svg'); d.setAttribute('width', '0'); d.setAttribute('height', '0'); d.style.position = 'absolute';
    d.innerHTML = '<defs><radialGradient id="lsFill"><stop offset="0" stop-color="#F4FFF9"/><stop offset=".45" stop-color="#9CF0CF"/><stop offset="1" stop-color="#88DBBD"/></radialGradient>' +
      '<filter id="lsGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
    document.body.appendChild(d);
  })();
  /* Seven tips set by the vote, seven valleys between them. An outcome with no votes keeps its tip near the centre. */
  function radii(V) {
    var top = Math.max.apply(null, V) || 1, out = [];
    for (var k = 0; k < 7; k++) {
      var a = (V[k] || 0) / top, b = (V[(k + 1) % 7] || 0) / top;
      out.push(.14 + .86 * a, .1 + .28 * Math.min(a, b));
    }
    return out;
  }
  function starPts(cx, cy, r, q) {
    return q.map(function (f, i) {
      var a = -Math.PI / 2 + Math.PI * i / 7;
      return (cx + r * f * Math.cos(a)).toFixed(1) + ',' + (cy + r * f * Math.sin(a)).toFixed(1);
    }).join(' ');
  }
  function slideOf(el) { return [].indexOf.call(document.querySelectorAll('#stage .slide'), el.closest('.slide')) + 1; }
  function reshape(V) {
    document.querySelectorAll('svg image').forEach(function (im) {
      var href = im.getAttribute('href') || im.getAttribute('xlink:href') || '';
      if (!/(^|\/)star\.png$/.test(href) || im.closest('.votestar')) return;
      var n = slideOf(im);
      if (n <= votes[0] || n === votes[1]) return;
      var w = +im.getAttribute('width'), x = +im.getAttribute('x'), y = +im.getAttribute('y');
      var cx = x + w / 2, cy = y + w / 2, r = w / 3.4, g = im._live;
      if (!g) {
        g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'livestar');
        if (im.getAttribute('opacity')) g.setAttribute('opacity', im.getAttribute('opacity'));
        g.innerHTML = '<polygon fill="url(#lsFill)" filter="url(#lsGlow)"/>';
        im.parentNode.insertBefore(g, im.nextSibling); im._live = g;
        im.style.transition = 'opacity .6s';
      }
      g.style.display = V ? '' : 'none';
      im.style.opacity = V ? '0' : '';
      if (V) g.children[0].setAttribute('points', starPts(cx, cy, r, radii(V)));
    });
  }

  /* ---- the first vote slide builds ---- */
  var GROW = { x: 640, y: 650, r: 235, from: [240, 760, 110] }, built = null;
  function grow(V) {
    if (!votes[0]) return;
    if (!built) {
      var sec = document.querySelectorAll('#stage .slide')[votes[0] - 1]; if (!sec) return;
      var r = GROW.r, w = r * 3.4, o = document.createElementNS(NS, 'svg'), labels = '';
      (window.AXES || []).forEach(function (t, i) {
        var a = -Math.PI / 2 + 2 * Math.PI * i / 7, c = Math.cos(a), s = Math.sin(a);
        labels += '<text x="' + (GROW.x + (r + 62) * c).toFixed(1) + '" y="' + (GROW.y + (r + 34) * s + 13).toFixed(1) + '" text-anchor="' + (Math.abs(c) < .3 ? 'middle' : (c > 0 ? 'start' : 'end')) + '">' + t + '</text>';
      });
      o.setAttribute('class', 'votestar'); o.setAttribute('viewBox', '0 0 1920 1080');
      o.innerHTML = '<g class="vs"><image href="assets/star.png" x="' + -w / 2 + '" y="' + -w / 2 + '" width="' + w + '" height="' + w + '"/><polygon fill="url(#lsFill)" filter="url(#lsGlow)"/></g>' + labels;
      sec.appendChild(o);
      var im = sec.querySelector('svg.art image[href$="star.png"]'); if (im) im.style.opacity = '0';
      var cur = [], i; for (i = 0; i < 14; i++) cur.push(i % 2 ? .42 : 1);
      built = { svg: o, poly: o.querySelector('polygon'), cur: cur, to: cur, on: false };
      built.poly.setAttribute('points', starPts(0, 0, r, cur));
      requestAnimationFrame(function () { requestAnimationFrame(function () { o.classList.add('on'); }); });
    }
    built.to = radii(V);
    if (!built.on) { built.on = true; requestAnimationFrame(ease); }
  }
  function ease() {
    var gap = 0;
    built.cur = built.cur.map(function (c, i) { var d = built.to[i] - c; gap = Math.max(gap, Math.abs(d)); return c + d * .05; });
    built.poly.setAttribute('points', starPts(0, 0, GROW.r, built.cur));
    if (gap > .002) requestAnimationFrame(ease); else built.on = false;
  }

  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved) reshape(saved); } catch (e) {}

  /* ---- live bars on the Q2 slide ---- */
  var css = document.createElement('style');
  css.textContent = '.votestar{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;font-family:"Space Grotesk",sans-serif}' +
    '.votestar .vs{transform:translate(' + GROW.from[0] + 'px,' + GROW.from[1] + 'px) scale(' + GROW.from[2] / GROW.r + ');transition:transform 1.6s cubic-bezier(.45,0,.2,1)}' +
    '.votestar.on .vs{transform:translate(' + GROW.x + 'px,' + GROW.y + 'px) scale(1)}' +
    '.votestar image{transition:opacity 1.6s}.votestar.on image{opacity:0}.votestar polygon{opacity:0;transition:opacity 1.6s}.votestar.on polygon{opacity:1}' +
    '.votestar text{font-size:36px;font-weight:500;fill:#F4F1EC;opacity:0;transition:opacity 1s 1.2s}.votestar.on text{opacity:1}' +
    '.livebars{position:absolute;left:90px;top:405px;width:960px;display:grid;gap:16px;font-family:"Space Grotesk",sans-serif}' +
    '.livebars .r{display:grid;grid-template-columns:300px 1fr;align-items:center;gap:30px}.livebars b{font-weight:500;font-size:44px;line-height:1.1;color:#F4F1EC}' +
    '.livebars .t{height:34px;border-radius:17px;background:rgba(244,241,236,.14);overflow:hidden}.livebars .t i{display:block;height:100%;width:0;background:#88DBBD;border-radius:17px;transition:width .8s}';
  document.head.appendChild(css);
  function bars(V) {
    var n = votes[1]; if (!n) return;
    var sec = document.querySelectorAll('#stage .slide')[n - 1]; if (!sec) return;
    var box = sec.querySelector('.livebars');
    if (!box) {
      box = document.createElement('div'); box.className = 'livebars';
      box.innerHTML = Q2_OPTIONS.map(function (o) { return '<div class="r"><b>' + o + '</b><div class="t"><i></i></div></div>'; }).join('');
      sec.appendChild(box);
    }
    box.querySelectorAll('.t i').forEach(function (el, i) { el.style.width = (100 * (V[i] || 0)) + '%'; });
  }

  var stop = false;
  function poll() {
    if (stop) return;
    fetch(B + '/state', { cache: 'no-store' }).then(function (r) {
      if (r.status === 403 || r.status === 404) { stop = true; return null; }   // outside the talk window: go quiet
      return r.json();
    }).then(function (s) {
      if (!s || !s.shape) return;
      if (s.q === 1) {
        reshape(s.shape); try { localStorage.setItem(KEY, JSON.stringify(s.shape)); } catch (e) {}
        if (s.shape.some(function (v) { return v > 0; })) grow(s.shape);
      }
      if (s.q === 2) bars(s.shape);
    }).catch(function () {}).then(function () { if (!stop) setTimeout(poll, 1500); });
  }
  function demo() {
    var tally = [0, 0, 0, 0, 0, 0, 0], weight = [5, 2, 3, 4, 3, 1, 0], wait = 4;
    setInterval(function () {
      if (slideNo() !== votes[0] || wait-- > 0) return;
      var pick = Math.random() * 18, k = 0;
      while (pick > weight[k]) pick -= weight[k++];
      tally[k]++; reshape(tally); grow(tally);
    }, 700);
  }
  check();
  if (DEMO) demo(); else poll();
  window.LIVE_HOOK = { reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} reshape(null); } };
})();
