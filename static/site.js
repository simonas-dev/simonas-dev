// Theme toggle: auto (follow OS) → night → day. Stored as localStorage
// `theme` = 'night' | 'day' (absent = auto); the inline head script applies it
// before first paint. Here: clicks, OS changes in auto, and the u_night tween.
// Also sets the ocean's content-page mode (oceanMode) and wires htmx page swaps.
(function () {
  'use strict';
  var STORAGE_KEY = 'theme';
  var MODES = ['auto', 'night', 'day'];
  var LABELS = { auto: 'Auto', night: 'Night', day: 'Day' };
  var TWEEN_MS = 900; // --dur-theme
  var root = document.documentElement;
  var darkQuery = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  var mode = readMode();
  var reduceQuery = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  var REDUCED_SPEED = 0.3; // wave speed factor under reduced motion; grain keeps its rate
  var SPEED_TWEEN_MS = 600;

  function readMode() {
    var value = null;
    try { value = localStorage.getItem(STORAGE_KEY); } catch (e) { /* storage unavailable */ }
    return value === 'night' || value === 'day' ? value : 'auto';
  }

  function writeMode() {
    try {
      if (mode === 'auto') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, mode);
    } catch (e) { /* storage unavailable; mode lives for this page only */ }
  }

  function renderToggles() {
    var buttons = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].disabled = false;
      buttons[i].textContent = LABELS[mode];
      buttons[i].setAttribute('aria-label', 'Theme: ' + LABELS[mode]);
    }
  }

  // Smoothstep on linear time equals the CSS cubic-bezier(1/3, 0, 2/3, 1).
  // Tweens a numeric __ocean field (night, speed); ms <= 0 sets it at once.
  var tweens = {}; // field -> { id, target } while running
  function tween(field, target, ms) {
    var ocean = window.__ocean;
    var running = tweens[field];
    if (running && running.target === target) return; // already heading there
    if (running) cancelAnimationFrame(running.id);
    tweens[field] = null;
    if (!ocean || ocean[field] === target) return;
    var from = ocean[field];
    // The static tier redraws on night changes only; speed has no frame to show.
    var redraw = field === 'night' && ocean.redraw;
    if (!(ms > 0)) {
      ocean[field] = target;
      if (redraw) redraw();
      return;
    }
    var start = performance.now();
    var current = tweens[field] = { target: target, id: 0 };
    current.id = requestAnimationFrame(function step(now) {
      var p = Math.max(0, Math.min(1, (now - start) / ms));
      ocean[field] = p < 1 ? from + (target - from) * p * p * (3 - 2 * p) : target;
      if (redraw) redraw();
      if (p < 1) current.id = requestAnimationFrame(step);
      else tweens[field] = null;
    });
  }

  function tweenNight(target) {
    var ocean = window.__ocean;
    // Like CSS reversed transitions, a partial distance takes a partial duration.
    tween('night', target, ocean ? TWEEN_MS * Math.abs(target - ocean.night) : 0);
  }

  function applyTheme() {
    var night = mode === 'night' || (mode === 'auto' && !!darkQuery && darkQuery.matches);
    root.classList.toggle('theme-night', night);
    tweenNight(night ? 1 : 0);
  }

  // Delegated so swapped-in toggles keep working.
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target.closest || !target.closest('.theme-toggle')) return;
    mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    writeMode();
    renderToggles();
    applyTheme();
  });

  if (darkQuery) {
    var onSchemeChange = function () { if (mode === 'auto') applyTheme(); };
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSchemeChange);
    else darkQuery.addListener(onSchemeChange);
  }

  // Back/forward cache: another page may have changed the theme meanwhile.
  window.addEventListener('pageshow', function (event) {
    clearNav();
    if (!event.persisted) return;
    mode = readMode();
    renderToggles();
    applyTheme();
  });

  // Content pages calm the ocean behind the panel: slow waves, half resolution,
  // 15 fps. Reduced motion slows the waves further. Re-callable when the page
  // content changes; `animate` eases the speed change (page swaps).
  function oceanMode(animate) {
    var ocean = window.__ocean;
    if (!ocean) return;
    var content = !!document.querySelector('.content-surface');
    var reduced = !!reduceQuery && reduceQuery.matches;
    tween('speed', (content ? 0.15 : 1) * (reduced ? REDUCED_SPEED : 1), animate && !reduced ? SPEED_TWEEN_MS : 0);
    ocean.res = content ? 0.5 : 1;
    ocean.fps = content ? 15 : 0;
    if (content && ocean.ripples) ocean.ripples.fill(0);
    ocean.resize();
  }

  if (reduceQuery) {
    var onMotionChange = function () { oceanMode(false); };
    if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', onMotionChange);
    else reduceQuery.addListener(onMotionChange);
  }

  // Click ripples on the home sea. The shader projects the point onto the water
  // (clicks on the sky miss it); uv matches its cameraRay: y up, height = 2.
  var rippleCount = 0;
  document.addEventListener('pointerdown', function (event) {
    var ocean = window.__ocean;
    var canvas = document.getElementById('ocean');
    if (event.button !== 0 || !ocean || !ocean.ripples || !canvas || !root.classList.contains('shader-ready') ||
        (reduceQuery && reduceQuery.matches) || document.querySelector('.content-surface') ||
        (event.target.closest && event.target.closest('a, button, summary, details, input, header, footer, .content-surface'))) return;
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    var i = (rippleCount++ % 10) * 4;
    ocean.ripples.set([(2 * x - rect.width) / rect.height, (rect.height - 2 * y) / rect.height, ocean.wave || 0, 1], i);
  });

  // aria-current on the nav links (header sits outside the swapped div.page).
  function markCurrentNav() {
    var links = document.querySelectorAll('header.chrome nav a');
    for (var i = 0; i < links.length; i++) {
      if (links[i].pathname === location.pathname) links[i].setAttribute('aria-current', 'page');
      else links[i].removeAttribute('aria-current');
    }
  }

  // htmx boosted navigation (attributes on <body>, history element div.page).
  // Anything htmx can't swap cleanly becomes a full page load.
  // One navigation at a time: htmx picks the swap target (div.page) at request
  // time and unlocks the link at response time, before the delayed (swap:220ms)
  // swap. A second navigation in that window would swap into a detached
  // div.page yet still push its URL and title, so it waits for settle instead.
  var navXhr = null; // the boosted request in flight or awaiting its swap
  var navSwapPending = false; // its response was accepted; the swap timer runs
  var queuedNav = null; // the latest navigation requested meanwhile: { link, url }
  var droppedXhr = null; // a request overtaken by back/forward; its response is ignored

  function clearNav() {
    navXhr = null;
    navSwapPending = false;
    queuedNav = null;
  }

  function fullNav(url) {
    clearNav();
    location.assign(url);
  }

  function runQueuedNav() {
    var next = queuedNav;
    queuedNav = null;
    if (!next || next.url.href === location.href) return;
    if (next.link.isConnected) next.link.click();
    else fullNav(next.url.href);
  }

  function closeMenu() {
    var menu = document.querySelector('.menu');
    if (menu) menu.open = false;
  }

  function afterPageChange() {
    oceanMode(true);
    markCurrentNav();
    closeMenu();
  }

  document.addEventListener('htmx:beforeRequest', function (event) {
    var link = event.detail.elt;
    var url = new URL(link.href || event.detail.pathInfo.requestPath, location.href);
    var lastSegment = url.pathname.split('/').pop();
    var fileExtension = /\.([^.]+)$/.exec(lastSegment);
    // Downloads and non-page files (e.g. feeds) must not be fetched as XHR.
    if ((fileExtension && fileExtension[1] !== 'html') || link.hasAttribute('download') ||
        (link.target && link.target !== '_self')) {
      event.preventDefault();
      // Not fullNav: a download doesn't unload the page, so keep any pending nav state.
      location.assign(url.href);
      return;
    }
    if (navXhr) {
      event.preventDefault();
      // htmx may replay an older click it queued itself; keep only the newest.
      var trigger = event.detail.requestConfig && event.detail.requestConfig.triggeringEvent;
      var stamp = trigger ? trigger.timeStamp : performance.now();
      if (!queuedNav || stamp >= queuedNav.stamp) queuedNav = { link: link, url: url, stamp: stamp };
      return;
    }
    navXhr = event.detail.xhr;
    closeMenu();
  });

  // Back/forward while a navigation is pending: htmx restores the entry (only
  // its own {htmx: true} entries), so the pending response must not swap over
  // it. A request still in flight is dropped when it responds; a swap already
  // scheduled can't be cancelled, so load the restored entry fresh with history
  // writes disabled (the stale swap can't push). Handled here rather than in
  // htmx:historyRestore, which doesn't fire on a cache miss.
  window.addEventListener('popstate', function (event) {
    if (!navXhr || !(event.state && event.state.htmx)) return;
    var swapPending = navSwapPending;
    droppedXhr = navXhr;
    clearNav();
    if (swapPending) {
      htmx.config.historyEnabled = false;
      location.reload();
    }
  });

  // Non-2xx responses are left to htmx:responseError. Successful responses must
  // be one of our pages (alias redirect pages and other HTML lack div.page).
  document.addEventListener('htmx:beforeSwap', function (event) {
    var detail = event.detail;
    if (detail.xhr === droppedXhr) {
      detail.shouldSwap = false;
      detail.isError = false;
      return;
    }
    if (detail.isError || !detail.boosted) return;
    var type = detail.xhr.getResponseHeader('Content-Type') || '';
    if (type.indexOf('text/html') === -1 || detail.serverResponse.indexOf('hx-history-elt') === -1) {
      detail.shouldSwap = false;
      var anchor = detail.pathInfo.anchor;
      fullNav(detail.xhr.responseURL ? detail.xhr.responseURL + (anchor ? '#' + anchor : '') : detail.pathInfo.requestPath);
      return;
    }
    if (detail.shouldSwap && detail.xhr === navXhr) navSwapPending = true;
  });

  // A response that won't swap (and isn't an error, which full-loads) ends the navigation.
  document.addEventListener('htmx:afterRequest', function (event) {
    if (event.detail.xhr === navXhr && !navSwapPending) navXhr = null;
  });

  ['htmx:responseError', 'htmx:sendError', 'htmx:targetError', 'htmx:timeout', 'htmx:onLoadError'].forEach(function (name) {
    document.addEventListener(name, function (event) {
      var detail = event.detail;
      if (detail.xhr && detail.xhr === droppedXhr) return;
      fullNav((detail.elt && detail.elt.href) || (detail.pathInfo && detail.pathInfo.requestPath) || location.href);
    });
  });

  // Defensive: refreshOnHistoryMiss reloads on a cache miss instead of fetching.
  document.addEventListener('htmx:historyCacheMissLoadError', function () {
    location.reload();
  });

  // Resolve the new content's hidden .htmx-added style now; otherwise the
  // browser may never compute it before htmx drops the class at settle, and the
  // content pops in without the fade.
  document.addEventListener('htmx:afterSwap', function (event) {
    var content = event.detail.boosted && document.querySelector('#main > *');
    if (content) void getComputedStyle(content).opacity;
  });

  document.addEventListener('htmx:afterSettle', function (event) {
    if (!event.detail.boosted) return;
    afterPageChange();
    var main = document.getElementById('main');
    if (main) main.focus({ preventScroll: true });
    if (event.detail.xhr !== navXhr) return; // afterSettle fires once per swapped node
    navXhr = null;
    navSwapPending = false;
    runQueuedNav();
  });

  document.addEventListener('htmx:historyRestore', afterPageChange);

  renderToggles();
  oceanMode(false);
})();
