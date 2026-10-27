// Theme toggle: auto (follow OS) → night → day. Stored as localStorage
// `theme` = 'night' | 'day' (absent = auto); the inline head script applies it
// before first paint. Here: clicks, OS changes in auto, and the u_night tween.
// Also sets the ocean's content-page mode (oceanMode).
(function () {
  'use strict';
  var STORAGE_KEY = 'theme';
  var MODES = ['auto', 'night', 'day'];
  var LABELS = { auto: 'Auto', night: 'Night', day: 'Day' };
  var TWEEN_MS = 900; // --dur-theme
  var root = document.documentElement;
  var darkQuery = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  var mode = readMode();
  var tweenId = 0;
  var tweenTarget = -1;

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
  function tweenNight(target) {
    var ocean = window.__ocean;
    if (tweenId && tweenTarget === target) return; // already heading there
    cancelAnimationFrame(tweenId);
    tweenId = 0;
    if (!ocean || ocean.night === target) return;
    var from = ocean.night;
    // Like CSS reversed transitions, a partial distance takes a partial duration.
    var duration = TWEEN_MS * Math.abs(target - from);
    var start = performance.now();
    tweenTarget = target;
    tweenId = requestAnimationFrame(function step(now) {
      var p = Math.max(0, Math.min(1, (now - start) / duration));
      ocean.night = from + (target - from) * p * p * (3 - 2 * p);
      if (ocean.redraw) ocean.redraw();
      tweenId = p < 1 ? requestAnimationFrame(step) : 0;
    });
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
    if (!event.persisted) return;
    mode = readMode();
    renderToggles();
    applyTheme();
  });

  // Content pages calm the ocean behind the panel: slow waves, half resolution,
  // 15 fps. Re-callable when the page content changes.
  function oceanMode() {
    var ocean = window.__ocean;
    if (!ocean) return;
    var content = !!document.querySelector('.content-surface');
    ocean.speed = content ? 0.15 : 1;
    ocean.res = content ? 0.5 : 1;
    ocean.fps = content ? 15 : 0;
    ocean.resize();
  }

  renderToggles();
  oceanMode();
})();
