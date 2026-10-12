/* Fresh Talks take-home page. Reads the JSON in <script id="talk" type="application/json"> and fills the page.
   Every section is optional: leave a field out and its section disappears. No network needed. */
(function () {
  'use strict';
  const cfg = JSON.parse(document.getElementById('talk').textContent);
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const show = (sel, on) => { $(sel).hidden = !on; return on; };

  document.title = cfg.title + (cfg.event ? ' - ' + cfg.event : '') + ' | Fresh Strategy';
  $('.th-label').textContent = [cfg.event, cfg.date].filter(Boolean).join(' · ');
  $('h1').textContent = cfg.headline || cfg.title;
  $('.th-lede').textContent = cfg.lede || '';

  // the one action: prompt (copy), checklist or exercise
  const a = cfg.action || {};
  if (show('#action', !!a.type)) {
    $('#action h2').textContent = a.heading || 'Try this';
    const body = $('#action .action');
    if (a.type === 'prompt') {
      body.innerHTML = '<pre>' + esc(a.text) + '</pre><button class="btn copy block" type="button">Copy prompt</button>';
      body.querySelector('.copy').addEventListener('click', e => copy(a.text, e.target));
    } else if (a.type === 'checklist') {
      body.innerHTML = '<ol>' + a.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ol>';
    } else {
      body.innerHTML = '<p>' + esc(a.text) + '</p>';
    }
    if (a.hint) body.insertAdjacentHTML('beforeend', '<p class="hint">' + esc(a.hint) + '</p>');
  }

  // "send me your result": the reason to message
  const ask = cfg.ask;
  if (show('#ask', !!ask)) {
    $('#ask h2').textContent = ask.heading;
    $('#ask p').textContent = ask.text || '';
    $('#ask .btn').textContent = ask.button || 'Message me on LinkedIn';
    $('#ask .btn').href = ask.url;
  }

  if (show('#video', !!cfg.video)) {
    const v = cfg.video;
    $('#video h2').textContent = v.heading || 'Watch';
    $('#video .video').innerHTML = v.src ? '<video src="' + esc(v.src) + '" controls playsinline preload="metadata"' + (v.poster ? ' poster="' + esc(v.poster) + '"' : '') + '></video>'
      : '<iframe src="' + esc(v.embed) + '" allow="fullscreen" loading="lazy" title="' + esc(v.heading || 'Video') + '"></iframe>';
  }

  const list = (id, items, heading) => {
    if (!show(id, items && items.length)) return;
    $(id + ' h2').textContent = heading;
    $(id + ' .links').innerHTML = items.map(l => '<li><a href="' + esc(l.url) + '"' + (l.download ? ' download' : '') + '><b>' + esc(l.label) + '</b><span' +
      (l.download && !l.size ? ' data-size="' + esc(l.url) + '"' : '') + '>' + esc(l.size || l.note || '') + '</span></a></li>').join('');
  };
  list('#slides', cfg.slides ? [{ label: cfg.slides.label || 'View the slides', url: cfg.slides.url, note: cfg.slides.note || '' }] : [], 'The slides');
  list('#downloads', cfg.downloads, 'Downloads');
  list('#next', cfg.next, cfg.nextHeading || 'Go further');

  // real file sizes when the page is served (never a guessed number)
  document.querySelectorAll('[data-size]').forEach(el => {
    fetch(el.dataset.size, { method: 'HEAD' }).then(r => {
      const b = +r.headers.get('content-length');
      if (b) el.textContent = b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
    }).catch(() => {});
  });

  const f = cfg.footer || {};
  $('footer').innerHTML = '<b>' + esc(f.name || 'Stéphanie Kioutsoukis') + '</b> · Fresh Strategy<br><a href="mailto:' + esc(f.email || 'stephanie@freshstrategy.ai') + '">' +
    esc(f.email || 'stephanie@freshstrategy.ai') + '</a> · <a href="https://www.freshstrategy.ai">freshstrategy.ai</a>';

  function copy(text, btn) {
    const done = () => { btn.textContent = 'Copied'; btn.classList.add('is-done'); setTimeout(() => { btn.textContent = 'Copy prompt'; btn.classList.remove('is-done'); }, 2500); };
    if (!(navigator.clipboard && window.isSecureContext)) return fallback(text, done);
    let settled = false;
    const finish = ok => { if (settled) return; settled = true; ok ? done() : fallback(text, done); };
    navigator.clipboard.writeText(text).then(() => finish(true), () => finish(false));
    setTimeout(() => finish(false), 1200);   // some browsers leave the promise hanging without a user permission

  }
  function fallback(text, done) {   // older phones and plain http
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    try { document.execCommand('copy'); done(); } catch (e) { /* user can still select the text */ }
    ta.remove();
  }
})();
