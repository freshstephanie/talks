/* Fresh Talks visitor counting: Google Analytics (same property as www.freshstrategy.ai), loaded on every page view.
   No banner on talks.freshstrategy.ai: her ruling 19.10.2026, EU consent risk accepted by her.
   Events: page_view (automatic; /<slug>/ = password page, /<slug>/d/ = locked deck opened),
           file_download (the deck's PDF button), deck_progress (half way, last slide).
   Loaded by: home, 404, public decks (publish_public.py), password pages (tools/encrypt_talk/index.html),
   locked decks (sw.js adds the tag to the decrypted page). */
(function () {
  var GA = 'G-02HHM5QC3D';
  if (window.top !== window || /[?&](presenter|embed|review)\b/.test(location.search)) return;   // presenter window, thumbnails
  if (location.protocol === 'file:') return;
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);   // local test: events go to the console, nothing to Google

  var slug = location.pathname.split('/')[1] || 'home';
  var started = false;
  function start() {
    if (started) return; started = true;
    if (LOCAL) {
      window.gtag = function () { console.log('[ft-analytics]', [].slice.call(arguments)); };
      gtag('config', GA, { talk: slug, page_path: location.pathname });
      return track();
    }
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA, { talk: slug });
    var s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA;
    document.head.appendChild(s);
    track();
  }

  function track() {
    // PDF button (engine/talks.js renders a.ft-pdf); capture phase, because the engine stops the plain download
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a.ft-pdf, a[href$=".pdf"]');
      if (a) gtag('event', 'file_download', { talk: slug, file_name: (a.getAttribute('href') || '').split('/').pop(), link_url: a.href });
    }, true);
    // slide progress: the engine keeps #<n> in the URL; count only main-run slides (parked ones sit in .appendix)
    var sent = {};
    setInterval(function () {
      var m = location.hash.match(/^#(\d+)/), n = document.querySelectorAll('section.slide:not(.appendix section)').length;
      if (!m || n < 2) return;
      var i = +m[1];
      if (i >= Math.ceil(n / 2) && !sent.half) { sent.half = 1; gtag('event', 'deck_progress', { talk: slug, progress: 'half', slides: n }); }
      if (i >= n && !sent.end) { sent.end = 1; gtag('event', 'deck_progress', { talk: slug, progress: 'last slide', slides: n }); }
    }, 1500);
  }

  start();
})();
