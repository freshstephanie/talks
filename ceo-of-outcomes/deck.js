/* Draws slides.js. Right arrow or space = next, left = back, F = fullscreen,
   B = blank, P = play or stop the song hook. */
(function () {
  var S = window.DECK, TOTAL = 16, stage = document.getElementById('stage');
  var P0 = [90, 74], P1 = [960, 14], P2 = [1830, 74], uid = 0;
  var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  var part = function (s) { return s.act.split(' · ')[0]; };
    var COL = { mint: ['#E2F8EF', '#88DBBD', '#2F7A6B'], coral: ['#FFDCD4', '#F37375', '#8E2F3C'], blue: ['#DDF4F7', '#77C8D6', '#2B6E80'] };
  var ARROW = '<svg viewBox="0 0 110 60"><path d="M0 30H96M76 10l22 20-22 20" fill="none" stroke="#88DBBD" stroke-width="6"/></svg>';

  function point(n) {
    var t = (n - 1) / (TOTAL - 1), u = 1 - t;
    return [u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0], u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1]];
  }
  function line(to) {
    var o = [];
    for (var i = 0; i <= 60; i++) { o.push(point(1 + (to - 1) * i / 60).map(function (v) { return v.toFixed(1); }).join(',')); }
    return o.join(' ');
  }
  var parts = [], num = [], k = 0;
  S.forEach(function (s, i) {
    if (!s.same) { k++; }
    num[i] = k;
    if (!parts.length || parts[parts.length - 1].name !== part(s)) { parts.push({ name: part(s), start: k }); }
  });
  /* After the vote the chosen star waits at the end of the arc; on 13 and 14 Destination lights up again. */
  function goal(n) {
    if (n < 4) { return ''; }
    var back = n >= 13;
    return star(P2[0], P2[1], back ? 34 : 24, back ? '' : ' opacity=".8"') +
      (back ? '<text x="' + (P2[0] - 40) + '" y="' + (P2[1] - 22) + '" fill="#88DBBD" text-anchor="end">DESTINATION</text>' : '');
  }
  function orbit(n) {
    var cur = part(S.filter(function (s, i) { return num[i] === n; })[0]), marks = parts.map(function (p, i) {
      var xy = point(p.start), c = p.name === cur ? '#F4F1EC' : '#857D90';
      return '<line x1="' + xy[0] + '" y1="' + (xy[1] - 8) + '" x2="' + xy[0] + '" y2="' + (xy[1] + 8) + '" stroke="' + c + '" stroke-width="2"/>' +
        '<text x="' + xy[0] + '" y="' + (xy[1] + 40) + '" fill="' + c + '" text-anchor="' + (i ? 'middle' : 'start') + '">' + p.name.toUpperCase() + '</text>';
    }).join(''), d = point(n);
    return '<svg class="orbit" viewBox="0 0 1920 130"><polyline points="' + line(TOTAL) + '" fill="none" stroke="#4A4257" stroke-width="2"/>' +
      '<polyline points="' + line(n) + '" fill="none" stroke="#F4F1EC" stroke-width="2"/>' + marks + goal(n) + '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="9" fill="#88DBBD"/></svg>';
  }
  function stars(i) {
    var o = '', x = 7 + i * 13;
    for (var n = 0; n < 110; n++) {
      x = (x * 16807) % 2147483647; var a = x % 1920;
      x = (x * 16807) % 2147483647; var b = x % 1080;
      x = (x * 16807) % 2147483647;
      o += '<circle cx="' + a + '" cy="' + b + '" r="' + (1 + x % 3 * .6) + '" fill="#F4F1EC" fill-opacity="' + (.15 + (x % 5) * .1) + '"/>';
    }
    return o;
  }
  function planet(cx, cy, r, name, ring, tilt) {
    var c = COL[name], id = 'p' + (++uid), a = tilt || -18, t = 'translate(' + cx + ' ' + cy + ') rotate(' + a + ')', o = '';
    var ell = function (x) { return '<ellipse rx="' + r * 1.5 + '" ry="' + r * .3 + '" fill="none" stroke="' + COL[ring][1] + '" stroke-width="' + 2 + '" ' + x + '/>'; };
    o += '<defs><radialGradient id="' + id + '" cx="30%" cy="28%" r="85%"><stop offset="0" stop-color="' + c[0] + '"/><stop offset=".22" stop-color="' + c[1] + '"/>' +
      '<stop offset=".62" stop-color="' + c[2] + '"/><stop offset="1" stop-color="#1C1A22"/></radialGradient>' +
      '<radialGradient id="' + id + 'g"><stop offset="0" stop-color="#F37375" stop-opacity=".42"/><stop offset=".45" stop-color="#F37375" stop-opacity=".12"/><stop offset="1" stop-color="#F37375" stop-opacity="0"/></radialGradient>' +
      '<clipPath id="' + id + 'c"><circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/></clipPath>' +
      '<clipPath id="' + id + 'f"><rect x="' + -r * 2 + '" y="0" width="' + r * 4 + '" height="' + r + '"/></clipPath></defs>';
    /* A tiny coral light on the ring, one lap in 24s, behind the planet on the far half. The large planets get a longer trail. */
    var moon = function (front) {
      var big = r > 200, len = big ? 28 : 9, gap = big ? .05 : .09, x = r * 1.5, y = r * .3, g = '';
      var d = 'M' + x + ' 0A' + x + ' ' + y + ' 0 1 1 ' + -x + ' 0A' + x + ' ' + y + ' 0 1 1 ' + x + ' 0';
      var ride = function (dot, begin) {
        var b = '" dur="24s" begin="' + begin.toFixed(2) + 's" repeatCount="indefinite"';
        return '<g opacity="' + (front ? 1 : 0) + '"><animate attributeName="opacity" values="' + (front ? '1;0;0' : '0;1;1') + '" keyTimes="0;.5;1" calcMode="discrete' + b + '/>' +
          dot + '<animateMotion path="' + d + b + '/></g>';
      };
      for (var k = len; k >= 1; k--) {
        var f = 1 - k / (len + 1);
        g += ride(big ? '<circle r="' + (1 + 3.8 * f).toFixed(2) + '" fill="#FFB7AF" fill-opacity="' + (.55 * f).toFixed(3) + '"/>' :
          '<circle r="' + (5.6 - k * .42).toFixed(2) + '" fill="#F37375" fill-opacity="' + (.34 - k * .034).toFixed(3) + '"/>', -1 + k * gap);
      }
      return '<g transform="' + t + '">' + g + ride('<circle r="26" fill="url(#' + id + 'g)"/><circle r="6.5" fill="#FFD2CB"/><circle r="3.6" fill="#FFF8F5"/>', -1) + '</g>';
    };
    if (ring) { o += '<g transform="' + t + '">' + ell('stroke-opacity=".5"') + '</g>' + moon(false); }
    o += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="url(#' + id + ')"/><g clip-path="url(#' + id + 'c)">';
    [-.45, -.1, .3].forEach(function (q, i) {
      o += '<ellipse cx="' + cx + '" cy="' + (cy + r * q) + '" rx="' + r * 1.2 + '" ry="' + r * (.05 + i * .02) + '" fill="#fff" fill-opacity=".08" transform="rotate(' + a + ' ' + cx + ' ' + cy + ')"/>';
    });
    o += '</g>';
    if (ring) { o += '<g transform="' + t + '">' + ell('clip-path="url(#' + id + 'f)"') + '</g>'; o += moon(true); }
    return o;
  }
  /* The strategic star: the same painting everywhere, assets/star.png from tools/make_star.py. Its tip sits at 1/1.7 of the half width. */
  function star(cx, cy, r, extra) {
    var w = r * 3.4;
    return '<image href="assets/star.png" x="' + (cx - w / 2).toFixed(1) + '" y="' + (cy - w / 2).toFixed(1) + '" width="' + w + '" height="' + w + '"' + (extra || '') + '/>';
  }
  var svg = function (i, inner) { return '<svg class="art" viewBox="0 0 1920 1080">' + stars(i) + inner + '</svg>'; };

  function sunArt() {
    var sun = [290, 400], tgt = [1560, 560], o = '', xs = [520, 690, 860, 1030, 1200], ym = 800;
    xs.forEach(function (x) { o += '<line x1="' + sun[0] + '" y1="' + sun[1] + '" x2="' + x + '" y2="' + ym + '" stroke="#F4F1EC" stroke-opacity=".28" stroke-width="3"/>'; });
    xs.forEach(function (x) { o += '<line x1="' + x + '" y1="' + ym + '" x2="' + tgt[0] + '" y2="' + tgt[1] + '" stroke="#88DBBD" stroke-opacity=".9" stroke-width="5"/>'; });
    xs.forEach(function (x) {
      var a = [sun[0] - x, sun[1] - ym], b = [tgt[0] - x, tgt[1] - ym], la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
      var n = Math.atan2(a[1] / la + b[1] / lb, a[0] / la + b[0] / lb) * 180 / Math.PI + 90;
      o += '<rect x="' + (x - 58) + '" y="' + (ym - 7) + '" width="116" height="14" rx="4" fill="#F4F1EC" transform="rotate(' + n.toFixed(1) + ' ' + x + ' ' + ym + ')"/>';
    });
    return o + '<circle cx="' + sun[0] + '" cy="' + sun[1] + '" r="150" fill="#F4F1EC" fill-opacity=".1"/><circle cx="' + sun[0] + '" cy="' + sun[1] + '" r="86" fill="#F4F1EC"/>' + star(tgt[0], tgt[1], 118);
  }
  function outcomes() {
    var cx = 960, cy = 610, o = '';
    window.AXES.forEach(function (n, i) {
      var a = -Math.PI / 2 + 2 * Math.PI * i / 7, c = Math.cos(a), s = Math.sin(a);
      o += '<text x="' + (cx + 330 * c) + '" y="' + (cy + 270 * s + 16) + '" fill="#F4F1EC" font-size="50" font-weight="500" font-family="Space Grotesk" text-anchor="' +
        (Math.abs(c) < .3 ? 'middle' : (c > 0 ? 'start' : 'end')) + '">' + n + '</text>';
    });
    return star(cx, cy, 190) + o;
  }

  /* Slide 8: a figure-eight orbit round two planets inside the field of human-set authority. opsPath is shared with the animation below. */
  var OPS = { cx: 1390, cy: 505, tilt: -8, a: 398, ys: 1.32, n: 1800, lap: 20000 };
  function opsPath() {
    var fine = [], len = [0], pts = [], j = 0, i, u, q;
    for (i = 0; i < 7200; i++) { u = Math.PI / 2 + i / 7200 * 2 * Math.PI; q = 1 + Math.pow(Math.sin(u), 2); fine.push([OPS.a * Math.cos(u) / q, OPS.ys * OPS.a * Math.sin(u) * Math.cos(u) / q]); }
    for (i = 1; i < fine.length; i++) { len.push(len[i - 1] + Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1])); }
    for (i = 0; i < OPS.n; i++) { while (len[j] < i / OPS.n * len[len.length - 1]) { j++; } pts.push(fine[j]); }
    return pts;
  }
  function opsRot(x, y) { var r = OPS.tilt * Math.PI / 180, c = Math.cos(r), n = Math.sin(r); return [OPS.cx + x * c - y * n, OPS.cy + x * n + y * c]; }
  function opsOrbit() {
    var pts = opsPath(), ymax = Math.max.apply(null, pts.map(function (p) { return p[1]; })), back = '', front = '', bands = '', o = '', RX = 462, RY = 318, GAP = .56;
    var ax = Math.sin(GAP) * RX, ay = OPS.cy - Math.cos(GAP) * RY, sys = 'translate(' + OPS.cx + ' ' + OPS.cy + ') rotate(' + OPS.tilt + ')';
    [.93, 1.07].forEach(function (k) {
      var d = ''; for (var i = 0; i < OPS.n; i += 6) { d += (i ? 'L' : 'M') + (pts[i][0] * k).toFixed(1) + ' ' + (pts[i][1] * k).toFixed(1); }
      bands += '<path d="' + d + 'Z" fill="none" stroke="#F4F1EC" stroke-opacity=".1" stroke-width="1.5"/>';
    });
    for (var i = 0; i < OPS.n; i += 5) {
      var a = pts[i], b = pts[(i + 6) % OPS.n], z = (a[1] / ymax + 1) / 2;
      var l = '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" stroke="' + (a[0] < 0 ? '#88DBBD' : '#F37375') + '" stroke-width="' + (2.2 + 2.8 * z).toFixed(2) + '" stroke-opacity="' + (.48 + .47 * z).toFixed(2) + '" stroke-linecap="round"/>';
      if (z < .5) { back += l; } else { front += l; }
    }
    o += '<defs><radialGradient id="opsf"><stop offset="0" stop-color="#88DBBD" stop-opacity=".06"/><stop offset=".8" stop-color="#88DBBD" stop-opacity=".04"/><stop offset="1" stop-color="#F4F1EC" stop-opacity=".09"/></radialGradient>' +
      '<filter id="opss" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.2"/></filter>' +
      '<radialGradient id="opsh"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".28" stop-color="#F4F1EC" stop-opacity=".45"/><stop offset="1" stop-color="#F4F1EC" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="opsm" cx="34%" cy="30%" r="80%"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#E2F8EF"/><stop offset="1" stop-color="#88DBBD"/></radialGradient></defs>';
    o += '<g transform="rotate(' + OPS.tilt + ' ' + OPS.cx + ' ' + OPS.cy + ')"><ellipse cx="' + OPS.cx + '" cy="' + OPS.cy + '" rx="' + RX + '" ry="' + RY + '" fill="url(#opsf)"/>' +
      '<path d="M' + (OPS.cx + ax).toFixed(1) + ' ' + ay.toFixed(1) + 'A' + RX + ' ' + RY + ' 0 1 1 ' + (OPS.cx - ax).toFixed(1) + ' ' + ay.toFixed(1) + '" fill="none" stroke="#F4F1EC" stroke-opacity=".45" stroke-width="2.5" filter="url(#opss)"/>' +
      '<path id="opsc" d="M' + (OPS.cx - RX) + ' ' + OPS.cy + 'A' + RX + ' ' + RY + ' 0 0 1 ' + (OPS.cx + RX) + ' ' + OPS.cy + '" fill="none"/>' +
      '<text class="opsauth"><textPath href="#opsc" startOffset="50%" text-anchor="middle">HUMAN-SET AUTHORITY</textPath></text></g>';
    o += '<g transform="' + sys + '">' + bands + back + '</g>';
    var r = opsRot(-OPS.a * .6, 0), m = opsRot(OPS.a * .6, 0);
    o += planet(r[0], r[1], 118, 'mint') + planet(m[0], m[1], 118, 'coral', null, -18);
    o += '<g transform="' + sys + '">' + front + '<g class="opstrail"></g><g class="opsobj"><circle r="40" fill="url(#opsh)"/><circle r="11" fill="url(#opsm)"/></g></g>';
    o += '<text class="opsbody" x="' + r[0].toFixed(1) + '" y="' + r[1].toFixed(1) + '">RUN</text><text class="opsbody" x="' + m[0].toFixed(1) + '" y="' + m[1].toFixed(1) + '">IMPROVE</text>';
    [['Finance Ops', .125, -1, 48], ['Payment Ops', .375, 1, 58], ['Learning Ops', .625, -1, -48], ['Strategy Ops', .875, 1, -58]].forEach(function (w) {
      var p = pts[Math.round(w[1] * OPS.n) % OPS.n], q = opsRot(p[0] + w[3], p[1] + w[2] * 46);
      o += '<text class="opw" data-f="' + w[1] + '" x="' + q[0].toFixed(1) + '" y="' + q[1].toFixed(1) + '" fill="' + (p[0] < 0 ? '#BFEBDB' : '#FAB9BA') + '">' + w[0] + '</text>';
    });
    return '<svg class="art" viewBox="0 0 1920 1080">' + o + '</svg>';
  }
  var KIND = {
    title: function (s, i) {
      return svg(i, planet(1540, 520, 370, 'mint', 'coral')) + '<div class="ai">' + esc(s.was) + '<i></i></div><div class="title step" data-step="1">' + s.title.map(function (t) { return '<div>' + esc(t) + '</div>'; }).join('') + '</div>' +
        '<div class="by"><b>' + esc(s.names) + '</b><div>' + esc(s.event) + '</div></div><img class="logo" src="logo.png" alt="Fresh Strategy">';
    },
    statement: function (s, i) {
      var p = s.small ? planet(1730, 250, 120, s.planet, 'mint') : planet(1650, 560, 300, s.planet, 'coral', -22);
      if (s.head) {
        return svg(i, p) + '<div class="demohead"><div>' + esc(s.head[0]) + '</div><div class="key">' + esc(s.head[1]) + '</div></div><div class="demoline">' + s.lines.map(function (l, n) {
          return '<span class="' + (n === s.key ? 'key' : 'dim') + (n ? ' step" data-step="' + n : '') + '">' + esc(l) + '</span>';
        }).join(' ') + '</div>';
      }
      return svg(i, p) + '<div class="stack' + (s.xl ? ' xl' : '') + '">' + s.lines.map(function (l, n) {
        return '<div class="' + (n === s.key ? 'key' : (s.dim ? 'dim' : '')) + (s.reveal && n ? ' step" data-step="' + n : '') + '">' + esc(l) + '</div>';
      }).join('') + '</div>';
    },
    html: function (s, i) { return (s.plain ? '' : svg(i, '')) + s.html; },
    wants: function (s, i) { return svg(i, outcomes()) + '<h2>' + esc(s.head) + '</h2>'; },
    vote: function (s, i) {
      return svg(i, star(240, 760, 110)) + '<h2 style="right:800px">' + esc(s.head) + '</h2>' + (s.question ? '<div class="q">' + esc(s.question) + '</div>' : '') + '<div class="qr"><img src="' + s.qr + '" alt="QR code"><span>' + esc(s.url) + '</span></div>';
    },
    horizon: function (s) {
      return '<div class="sky step" data-step="1"></div><div class="htitle">' + esc(s.head) + '</div><div class="hline"><div>' + esc(s.lines[0]) + '</div><div class="key">' + esc(s.lines[1]) + '</div></div>';
    },
    question: function (s) {
      var p = s.line[0].split(', ');
      return '<div class="sky dim"></div><div class="sky bright"></div><div class="ask"><span class="l1">' + esc(p[0]) + ',</span> <span class="step" data-step="1">' + esc(p[1]) + '<em>' + esc(s.line[1]) + '</em></span></div>';
    },
    song: function (s, i) {
      return svg(i, '') + '<video class="video" src="assets/song_loop.mp4#t=2" muted loop playsinline preload="auto"></video>' +
        '<div class="right lab">' + esc(s.act) + '</div><div class="right h">' + esc(s.head) + '</div>' +
        '<div class="way a"><h3>' + esc(s.left.label) + '</h3><p>' + esc(s.left.text) + '</p></div><div class="way b"><h3>' + esc(s.right.label) + '</h3><p>' + esc(s.right.text) + '</p></div>';
    },
    assemble: function (s, i) {
      return svg(i, '') + '<h2>' + esc(s.head) + '</h2><div class="ident"><div class="stepname">Identify</div><p>' + esc(s.identify) + '</p></div>' +
        '<div class="arrow">' + ARROW + '</div><div class="team step" data-step="1"><div class="stepname">Assemble</div><div class="names">' +
        s.team.map(function (t) { return '<div><div class="w">' + esc(t.word) + '</div><div class="t">' + esc(t.text) + '</div></div>'; }).join('') + '</div></div>';
    },
    split: function (s, i) {
      return svg(i, '') + '<div class="half"></div><h2>' + esc(s.head) + '</h2><div class="side l"><h3>' + esc(s.left.label) + '</h3><p>' + esc(s.left.text) + '</p></div>' +
        '<div class="side r"><h3>' + esc(s.right.label) + '</h3><p>' + esc(s.right.text) + '</p></div>';
    },
    process: function (s, i) {
      return svg(i, '') + '<h2>' + esc(s.head) + '</h2><div class="proc">' + s.steps.map(function (t, n) {
        return '<div class="' + (n === s.steps.length - 1 ? 'last' : '') + '"><div class="w">' + esc(t.word) + '</div><div class="t">' + esc(t.text) + '</div></div>';
      }).join('') + '</div><svg class="loop" viewBox="0 0 1920 300"><path d="M1640 30 C1640 190 1500 210 1300 210 H560 C340 210 140 190 140 50" fill="none" stroke="#88DBBD" stroke-width="5"/>' +
        '<path d="M116 76l24-30 24 30" fill="none" stroke="#88DBBD" stroke-width="5"/><text x="960" y="190" fill="#88DBBD" text-anchor="middle" paint-order="stroke" stroke="#1C1A22" stroke-width="10">' + esc(s.loop) + '</text></svg>';
    },
    stop: function (s, i) {
      return svg(i, planet(1730, 230, 110, 'blue', 'coral')) + '<div class="stop"><div class="lead">' + esc(s.lead) + '</div><div class="big" style="position:static">' + esc(s.line) + '</div></div>';
    },
    blocks: function (s, i) {
      var b = s.blocks.map(function (x) { return '<div class="block"><div class="w">' + esc(x.word) + '</div>' + x.lines.map(function (l) { return '<div class="t">' + esc(l) + '</div>'; }).join('') + '</div>'; });
      return svg(i, '') + '<h2>' + esc(s.head) + '</h2><div class="blocks">' + b[0] + ARROW + b[1] + '</div><div class="answer">' + esc(s.answer) + '</div>';
    },
    sun: function (s, i) { return svg(i, sunArt()) + '<h2 style="right:auto">' + esc(s.head) + '</h2><div class="caption">' + esc(s.caption) + '</div>'; },
    org: function (s, i) {
      return svg(i, star(960, 490, 130)) + '<h2>' + esc(s.head) + '</h2><div class="answer top">' + esc(s.answer) + '</div><div class="orgrow">' + s.blocks.map(function (b, n) { return '<div class="step" data-step="' + (n + 1) + '">' + esc(b) + '</div>'; }).join('') + '</div>';
    },
    invite: function (s, i) {
      return svg(i, planet(1640, 560, 180, 'mint', 'coral')) + '<div class="inv">' + esc(s.line) + '</div><div class="invsub">' + esc(s.sub) + '</div><div class="codes">' +
        s.codes.map(function (c) { return '<div class="code"><img src="' + c.img + '" alt="QR code"><span>' + esc(c.label) + '</span></div>'; }).join('') + '</div>';
    },
    ops: function (s) {
      return '<div class="sky" style="background-image:url(\'assets/art_8.jpg\')"></div><div class="opstitle"><div>' + esc(s.lines[0]) + '</div><div>' + esc(s.lines[1]) + '</div></div>' + opsOrbit();
    },
    close: function (s, i) {
      return svg(i, star(960, 270, 90)) + '<div class="final"><div>' + esc(s.lines[0]) + '</div><div class="key">' + esc(s.lines[1]) + '</div></div>';
    }
  };

  S.forEach(function (s, i) {
    var el = document.createElement('section'), n = num[i];
    el.className = 'slide';
    var noLabel = s.kind === 'title' || s.kind === 'html';
    el.innerHTML = KIND[s.kind](s, n) + (noLabel ? '' : '<div class="label">' + esc(s.act) + '</div>') + (s.kind === 'title' || s.noarc ? '' : orbit(n));
    if (s.tw || s.kind === 'horizon' || s.kind === 'question') {
      var sk = el.querySelectorAll('.sky'), tw = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), x = 11 + i * 17, c = '';
      for (var q = 0; q < 42; q++) {
        x = (x * 16807) % 2147483647; var ax = 700 + x % 1220;
        x = (x * 16807) % 2147483647; var ay = x % 900;
        x = (x * 16807) % 2147483647;
        c += '<circle class="tw" cx="' + ax + '" cy="' + ay + '" r="' + (1.6 + x % 3 * .7) + '" fill="' + ['#F4F1EC', '#88DBBD', '#77C8D6'][x % 3] + '" style="animation-delay:-' + (x % 70) / 10 + 's"/>';
      }
      tw.setAttribute('class', 'art'); tw.setAttribute('viewBox', '0 0 1920 1080'); tw.innerHTML = c;
      sk[sk.length - 1].after(tw);
    }
    stage.appendChild(el);
  });

  var els = stage.querySelectorAll('.slide'), cur = 0, step = 0, notes = document.getElementById('notes'), hook = document.getElementById('hook');
  /* Slide 8: the moon laps the orbit, restarting at the crossing on each arrival. Each word surfaces just before it and fades behind it. */
  (function () {
    var obj = stage.querySelector('.opsobj'); if (!obj) { return; }
    var slide = obj.closest('.slide'), pts = opsPath(), N = pts.length, ymax = Math.max.apply(null, pts.map(function (p) { return p[1]; }));
    var trail = slide.querySelector('.opstrail'), words = slide.querySelectorAll('.opw'), dots = [], t0 = null, TL = 70;
    var sm = function (t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
    for (var k = 0; k < TL; k++) { var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', 7 * (1 - k / TL) + 1.2); trail.appendChild(c); dots.push(c); }
    function place(i) {
      var p = pts[i], z = (p[1] / ymax + 1) / 2;
      obj.setAttribute('transform', 'translate(' + p[0] + ' ' + p[1] + ') scale(' + (.72 + .5 * z) + ')');
      dots.forEach(function (c, n) { var m = (i - n * 3 + N * 9) % N, q = pts[m]; c.setAttribute('cx', q[0]); c.setAttribute('cy', q[1]); c.setAttribute('fill', q[0] < 0 ? '#88DBBD' : '#F37375'); c.setAttribute('opacity', .7 * (1 - n / TL)); });
      words.forEach(function (w) { var d = i / N - +w.dataset.f; if (d < -.5) { d += 1; } if (d > .5) { d -= 1; } w.style.opacity = (.9 * (d < 0 ? sm(1 + d / .07) : sm(1 - d / .17))).toFixed(3); });
    }
    place(0);
    requestAnimationFrame(function tick(now) {
      if (slide.classList.contains('on')) { if (t0 === null) { t0 = now; } place(Math.floor(Math.max(0, now - t0) / OPS.lap % 1 * N)); } else { t0 = null; }
      requestAnimationFrame(tick);
    });
  })();
  function maxStep(i) {
    var m = 0;
    els[i].querySelectorAll('.step').forEach(function (e) { m = Math.max(m, +e.dataset.step); });
    return m;
  }
  function stopHook() { hook.pause(); hook.hidden = true; hook.removeAttribute('style'); }
  var was = -1;
  function show() {
    stopHook();
    if (cur !== was) { els[cur].classList.remove('arrive'); void els[cur].offsetWidth; els[cur].classList.add('arrive'); was = cur; }
    els.forEach(function (e, i) {
      e.classList.toggle('on', i === cur);
      var v = e.querySelector('.video');
      if (v) { if (i === cur) { v.play().catch(function () {}); } else { v.pause(); } }
    });
    els[cur].classList.toggle('played', step >= 1);
    els[cur].classList.toggle('done', step >= maxStep(cur) && maxStep(cur) > 0);
    els[cur].querySelectorAll('.step').forEach(function (e) { e.classList.toggle('hide', +e.dataset.step > step); });
    var fv = els[cur].querySelector('.fullvid');
    if (fv) { if (step >= 1) { fv.currentTime = 0; fv.play().catch(function () {}); hook.currentTime = 0; hook.play().catch(function () {}); } else { fv.pause(); } }
    history.replaceState(null, '', '#' + (cur + 1));
  }
  function go(d) {
    if (d > 0) {
      if (step < maxStep(cur)) { step++; } else if (cur < S.length - 1) { cur++; step = 0; }
    } else if (step > 0) { step--; } else if (cur > 0) { cur--; step = maxStep(cur); }
    show();
  }
  function fit() { stage.style.transform = 'translate(-50%,-50%) scale(' + Math.min(innerWidth / 1920, innerHeight / 1080) + ')'; }
  function toggleHook() {
    if (S[cur].kind !== 'song') { return; }
    if (!hook.paused) { stopHook(); return; }
    hook.hidden = false; hook.currentTime = 0;
    hook.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#000';
    hook.play();
  }
  hook.addEventListener('ended', function () { stopHook(); var v = els[cur].querySelector('.fullvid'); if (v) { v.pause(); v.classList.add('hide'); } });
  addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(-1); }
    if (e.key === 'f') { document.documentElement.requestFullscreen(); }
    if (e.key === 'b') { stage.style.visibility = stage.style.visibility ? '' : 'hidden'; }
    if (e.key === 'p') { toggleHook(); }
  });
  addEventListener('click', function (e) { if (e.target.closest('a,#ctl,#grid')) { return; } go(e.clientX < innerWidth * .3 ? -1 : 1); });
  var grid = document.getElementById('grid'), ctl = document.getElementById('ctl'), idle;
  S.forEach(function (s, i) {
    var b = document.createElement('button');
    b.setAttribute('aria-label', 'Go to slide ' + num[i]);
    b.innerHTML = '<img src="assets/thumbs/f' + ('0' + (i + 1)).slice(-2) + '.jpg" alt="" loading="lazy">';
    b.addEventListener('click', function () { cur = i; step = 0; toggleGrid(); show(); });
    grid.appendChild(b);
  });
  function toggleGrid() {
    grid.hidden = !grid.hidden;
    if (!grid.hidden) { stopHook(); grid.querySelectorAll('button').forEach(function (b, i) { b.classList.toggle('now', i === cur); }); }
  }
  function wake() { ctl.classList.remove('idle'); clearTimeout(idle); idle = setTimeout(function () { ctl.classList.add('idle'); }, 3000); }
  document.getElementById('c-prev').addEventListener('click', function () { go(-1); });
  document.getElementById('c-next').addEventListener('click', function () { go(1); });
  document.getElementById('c-grid').addEventListener('click', toggleGrid);
  addEventListener('mousemove', wake); addEventListener('touchstart', wake, { passive: true });
  addEventListener('keydown', function (e) { if (e.key === 'g') { toggleGrid(); } if (e.key === 'Escape' && !grid.hidden) { toggleGrid(); } });
  wake();
  /* The Milky Way drifts on one shared clock, so moving between slides 5-8 never jumps. */
  var skies = stage.querySelectorAll('.sky:not(.nodrift)');
  (function drift() {
    var t = performance.now() / 1000, k = 1.05 + .025 * Math.sin(t / 19), dx = 16 * Math.sin(t / 27), dy = 9 * Math.cos(t / 23), v = 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px) scale(' + k.toFixed(4) + ')';
    skies.forEach(function (e) { e.style.transform = v; });
    requestAnimationFrame(drift);
  })();
  addEventListener('resize', fit);
  cur = Math.min(Math.max((parseInt(location.hash.slice(1), 10) || 1) - 1, 0), S.length - 1);
  fit();
  show();
})();
