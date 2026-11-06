/* live.js: connects this deck to the CEO of Outcomes live room (fresh-ceo-of-outcomes.projectneuland.workers.dev).
   - Every slide change tells the room which slide is up (phones see the slides so far, never ahead).
   - The first vote slide opens Q1 (top 3), the second opens Q2 (when), the last slide closes the vote.
   - Every painted star (assets/star.png) gets a live star on top, shaped by the room's Q1 result.
   - The Q2 slide gets live bars in the deck's own style. No counts, percentages or decimals anywhere.
   The room accepts these cues only from talks.freshstrategy.ai and only during the talk window; outside it this
   script does nothing visible. Phone-width screens never cue the room (someone browsing the deck on a phone). */
(function () {
  'use strict';
  var B = 'https://fresh-ceo-of-outcomes.projectneuland.workers.dev/deck', S = window.DECK || [], N = S.length;
  var DRIVE = Math.max(screen.width, screen.height) >= 1000 && !/[?&]live=off\b/.test(location.search);
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
  function starPts(cx, cy, r, fn) {
    var out = [];
    for (var i = 0; i < 14; i++) {
      var a = -Math.PI / 2 + Math.PI * i / 7, q = i % 2 ? r * .42 : r * fn(i / 2);
      out.push((cx + q * Math.cos(a)).toFixed(1) + ',' + (cy + q * Math.sin(a)).toFixed(1));
    }
    return out.join(' ');
  }
  function reshape(V) {
    document.querySelectorAll('svg image').forEach(function (im) {
      var href = im.getAttribute('href') || im.getAttribute('xlink:href') || '';
      if (!/(^|\/)star\.png$/.test(href)) return;
      var w = +im.getAttribute('width'), x = +im.getAttribute('x'), y = +im.getAttribute('y');
      var cx = x + w / 2, cy = y + w / 2, r = w / 3.4, g = im._live;
      if (!g) {
        g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'livestar');
        if (im.getAttribute('opacity')) g.setAttribute('opacity', im.getAttribute('opacity'));
        g.innerHTML = '<polygon fill="none" stroke="#88DBBD" stroke-opacity=".5" stroke-width="' + Math.max(1.5, r / 40).toFixed(1) + '"/><polygon fill="url(#lsFill)" filter="url(#lsGlow)" style="transition:all .6s"/>';
        im.parentNode.insertBefore(g, im.nextSibling); im._live = g;
        im.style.transition = 'opacity .6s';
      }
      g.style.display = V ? '' : 'none';
      im.style.opacity = V ? '.22' : '';
      if (!V) return;
      g.children[0].setAttribute('points', starPts(cx, cy, r, function () { return 1; }));
      g.children[1].setAttribute('points', starPts(cx, cy, r, function (k) { return .42 + .58 * (.1 + .9 * (V[k] || 0)); }));
    });
  }
  try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved) reshape(saved); } catch (e) {}

  /* ---- live bars on the Q2 slide ---- */
  var css = document.createElement('style');
  css.textContent = '.livebars{position:absolute;left:90px;top:405px;width:960px;display:grid;gap:16px;font-family:"Space Grotesk",sans-serif}' +
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
      if (s.q === 1) { reshape(s.shape); try { localStorage.setItem(KEY, JSON.stringify(s.shape)); } catch (e) {} }
      if (s.q === 2) bars(s.shape);
    }).catch(function () {}).then(function () { if (!stop) setTimeout(poll, 1500); });
  }
  check();
  poll();
  window.LIVE_HOOK = { reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} reshape(null); } };
})();
