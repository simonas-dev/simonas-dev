// Dark theme only (html.theme-night is fixed in base.html). This file sets the
// ocean's content-page mode (oceanMode), plays the Digital Sun video (videoMode,
// full page and faint in the home sky) and wires htmx page swaps.
(function () {
  'use strict';
  var root = document.documentElement;
  var reduceQuery = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  var REDUCED_SPEED = 0.3; // wave speed factor under reduced motion; grain keeps its rate
  var SPEED_TWEEN_MS = 600;

  // Smoothstep on linear time equals the CSS cubic-bezier(1/3, 0, 2/3, 1).
  // Tweens a numeric __ocean field (speed); ms <= 0 sets it at once.
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

  // Back/forward cache: restart the video of the restored page.
  window.addEventListener('pageshow', function (event) {
    clearNav();
    if (event.persisted) videoMode();
  });

  // Safety net (iOS swipe-back, throttled frames): once the page has settled,
  // make sure the current page's video is the one asked to play.
  function retryVideo() {
    var current = document.querySelector('.video-page video, .sky-video video');
    if (current && (current !== video || current.paused)) videoMode();
  }

  // Content pages calm the ocean behind the panel: slow waves, half resolution,
  // 15 fps. Reduced motion slows the waves further. The Digital Sun page covers
  // the ocean, so it stops rendering there. Re-callable when the page content
  // changes; `animate` eases the speed change (page swaps).
  function oceanMode(animate) {
    var ocean = window.__ocean;
    if (!ocean) return;
    ocean.paused = !!document.querySelector('.video-page');
    if (ocean.wake) ocean.wake();
    var content = !!document.querySelector('.content-surface');
    var reduced = !!reduceQuery && reduceQuery.matches;
    tween('speed', (content ? 0.15 : 1) * (reduced ? REDUCED_SPEED : 1), animate && !reduced ? SPEED_TWEEN_MS : 0);
    ocean.res = content ? 0.5 : 1;
    ocean.fps = content ? 15 : 0;
    if (content && ocean.ripples) ocean.ripples.fill(0);
    ocean.resize();
  }

  // Digital Sun video (full page, and faint in the home sky): a muted loop
  // started from here, never by markup (no autoplay,
  // preload="none"), so reduced motion and Save-Data / 2g fetch no video and
  // keep the poster. Paused while the tab is hidden; released once swapped out.
  var video = null; // the current page's video (Digital Sun page, or faint on home), once seen

  function videoAllowed() {
    var connection = navigator.connection;
    return !(reduceQuery && reduceQuery.matches) &&
      !(connection && (connection.saveData || /2g/.test(connection.effectiveType || '')));
  }

  function pauseVideo() {
    if (!video) return;
    video.pause();
    video.classList.remove('playing');
  }

  // A swapped-out video keeps its decoder until collected; drop its media now.
  function releaseDetachedVideo() {
    if (!video || video.isConnected) return;
    pauseVideo();
    while (video.firstChild) video.removeChild(video.firstChild);
    video.removeAttribute('src');
    video.load();
    video = null;
  }

  // html.video-ok (set in <head> before first paint) hides the poster so the
  // video fades in from black; .video-failed on the container brings it back.
  function posterFallback(on) {
    if (video && video.parentElement) video.parentElement.classList.toggle('video-failed', on);
  }

  function videoMode() {
    releaseDetachedVideo();
    root.classList.toggle('video-ok', videoAllowed());
    video = document.querySelector('.video-page video, .sky-video video');
    if (!video) return;
    if (document.hidden || !videoAllowed()) return pauseVideo();
    video.muted = true;
    var playing = video.play();
    if (playing && playing.catch) playing.catch(function () { posterFallback(true); /* blocked: show the poster */ });
  }

  // The <source> the browser would pick now: first whose media matches and
  // whose type plays (the resource selection algorithm, minus network errors).
  var probeVideo = null;
  function pickSource(sources) {
    probeVideo = probeVideo || document.createElement('video');
    for (var i = 0; i < sources.length; i++) {
      var media = sources[i].getAttribute('media');
      if (media && !matchMedia(media).matches) continue;
      if (!probeVideo.canPlayType(sources[i].getAttribute('type') || '')) continue;
      return sources[i];
    }
    return null;
  }

  // <source media> is evaluated only when a video loads (unlike <picture> and
  // CSS @media), so a rotation or resize across a breakpoint would keep the
  // old encode under the new framing. Reload the video when its pick changes,
  // keeping the loop position.
  function refreshVideoSource() {
    if (!video || !video.isConnected || !video.currentSrc) return; // not loaded yet: play() picks fresh
    var pick = pickSource(video.querySelectorAll('source'));
    if (!pick || pick.src === video.currentSrc) return;
    var t = video.currentTime;
    pauseVideo();
    video.load();
    video.addEventListener('loadedmetadata', function () {
      try { video.currentTime = t % (video.duration || Infinity); } catch (e) {}
    }, { once: true });
    videoMode();
  }

  var sourceTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(sourceTimer);
    sourceTimer = setTimeout(refreshVideoSource, 300);
  });

  // Warm the HTTP cache with the file the Digital Sun page will play, so the
  // link opens straight into the loop. Picks like the browser does: the first
  // <source> in #sun-sources (home only) whose media matches and type plays.
  // Once per page view, on idle, or sooner on hover/focus of the link; same
  // gates as playback (reduced motion, Save-Data, 2g fetch nothing). The body
  // is streamed and dropped, so nothing is held in memory.
  var sunWarmed = false;
  function warmSunVideo() {
    var list = document.getElementById('sun-sources');
    if (sunWarmed || !list || !window.fetch || document.hidden || !videoAllowed()) return;
    var source = pickSource(list.content.querySelectorAll('source'));
    if (source) {
      sunWarmed = true;
      fetch(source.src, { priority: 'low', credentials: 'same-origin' }).then(function (response) {
        if (!response.ok || !response.body) return;
        var reader = response.body.getReader();
        (function drain() { reader.read().then(function (r) { if (!r.done) drain(); }, function () {}); })();
      }, function () { sunWarmed = false; });
    }
  }

  function scheduleSunWarm() {
    if (sunWarmed || !document.getElementById('sun-sources')) return;
    if (window.requestIdleCallback) requestIdleCallback(warmSunVideo, { timeout: 4000 });
    else setTimeout(warmSunVideo, 2000);
  }

  ['pointerenter', 'focusin', 'touchstart'].forEach(function (type) {
    document.addEventListener(type, function (event) {
      var link = event.target.closest && event.target.closest('a[href="/digital-sun/"]');
      if (link) warmSunVideo();
    }, { capture: true, passive: true });
  });

  document.addEventListener('error', function (event) {
    if (video && event.target.parentElement === video) posterFallback(true);
  }, true);

  // Media events don't bubble; capture them. The video fades in over the poster.
  document.addEventListener('playing', function (event) {
    if (event.target !== video) return;
    video.classList.add('playing');
    posterFallback(false); // e.g. started by a tap after Low Power Mode blocked autoplay
  }, true);

  document.addEventListener('visibilitychange', videoMode);
  // Last resort: a tap is a user gesture, which lets iOS start any video.
  document.addEventListener('touchend', retryVideo, { passive: true });
  window.addEventListener('popstate', function () { setTimeout(retryVideo, 2000); });

  if (reduceQuery) {
    var onMotionChange = function () { oceanMode(false); videoMode(); };
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
        (reduceQuery && reduceQuery.matches) || document.querySelector('.content-surface, .video-page') ||
        (event.target.closest && event.target.closest('a, button, summary, details, input, header, footer, .content-surface'))) return;
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    var i = (rippleCount++ % 10) * 4;
    ocean.ripples.set([(2 * x - rect.width) / rect.height, (rect.height - 2 * y) / rect.height, ocean.wave || 0, 1], i);
  });

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

  function afterPageChange() {
    lastPath = location.pathname;
    oceanMode(true);
    videoMode();
    scheduleSunWarm();
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
    // Freeze at request time, so the canvas is painted a frame or more before
    // the crossfade snapshots the page (made at swap time, it can miss one).
    if (document.startViewTransition && (location.pathname === SUN_PATH) !== (url.pathname === SUN_PATH)) freezeSunFrame();
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
  // Home <-> Digital Sun: a slow whole-page crossfade (View Transitions) instead
  // of the quick fade-out/fade-in, so the sea and the black video page overlap.
  // Applies to link navs and back/forward; elsewhere, and without View
  // Transitions support, the normal swap fade stays. html.sun-crossfade turns
  // off the per-page fade (it would fade twice) and sets the duration.
  var SUN_PATH = '/digital-sun/';
  var lastPath = location.pathname;
  // The class comes off once the crossfade has finished.
  var crossfadeTimer = 0;
  // Starting a crossfade: Safari's view-transition snapshot drops <video>
  // layers (and, for a frame, the masked home sky layer as a whole), so the sun
  // was replaced by its (different) poster on Digital Sun, or vanished from the
  // home sky. Paint what is on screen onto a plain canvas instead, which Safari
  // snapshots reliably. It goes with the old page.
  function drawCover(ctx, v, r) { // object-fit: cover of v into rect r
    var scale = Math.max(r.width / v.videoWidth, r.height / v.videoHeight);
    var sw = r.width / scale, sh = r.height / scale;
    ctx.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, r.left, r.top, r.width, r.height);
  }

  function freezeSunFrame() {
    if (document.querySelector('.video-freeze')) return;
    var v = document.querySelector('.video-page video, .sky-video video');
    if (!v || !v.classList.contains('playing') || v.readyState < 2 || !v.videoWidth) return;
    var layer = v.parentNode; // fixed, inset 0
    var box = layer.getBoundingClientRect();
    var r = v.getBoundingClientRect();
    var rect = { left: r.left - box.left, top: r.top - box.top, width: r.width, height: r.height };
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var c = document.createElement('canvas');
    c.className = 'video-freeze';
    c.setAttribute('aria-hidden', 'true');
    c.width = Math.round(box.width * dpr);
    c.height = Math.round(box.height * dpr);
    var ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    var sky = layer.classList.contains('sky-video');
    try {
      drawCover(ctx, v, rect);
      if (sky) bakeSkyLayer(ctx, layer, v, rect, box.width, box.height);
    } catch (e) { return; }
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none';
    if (sky) {
      // Outside the masked, translucent layer (all of it is baked in), which
      // is hidden meanwhile so the sun isn't drawn twice.
      c.style.zIndex = '0';
      layer.insertAdjacentElement('afterend', c);
      root.classList.add('sky-frozen');
    } else {
      v.insertAdjacentElement('afterend', c);
    }
  }

  // The home sky layer's CSS (styles.css, .sky-video): opacity and the two
  // intersected masks, the horizon fade and the round orb. --frame-h is the
  // video frame's on-screen height under object-fit: cover.
  function bakeSkyLayer(ctx, layer, v, rect, w, h) {
    var cs = getComputedStyle(layer);
    var horizon = parseFloat(cs.getPropertyValue('--sky-horizon')) / 100;
    var haze = parseFloat(cs.getPropertyValue('--sky-haze')) / 100;
    var frameH = v.videoHeight * Math.max(rect.width / v.videoWidth, rect.height / v.videoHeight);
    ctx.globalCompositeOperation = 'destination-in';
    var line = ctx.createLinearGradient(0, h, 0, 0); // to top
    line.addColorStop(horizon - haze, 'rgba(0,0,0,0)');
    line.addColorStop(horizon - 0.005, 'rgba(0,0,0,1)');
    ctx.fillStyle = line;
    ctx.fillRect(0, 0, w, h);
    var cx = w / 2, cy = h / 2 + frameH * 0.06;
    var orb = ctx.createRadialGradient(cx, cy, 0, cx, cy, frameH * 0.18);
    orb.addColorStop(0, 'rgba(0,0,0,1)');
    orb.addColorStop(0.165 / 0.18, 'rgba(0,0,0,1)');
    orb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = orb;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,' + parseFloat(cs.opacity) + ')';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  // Safari can snapshot the page in the very frame the canvas was added, before
  // it is drawn (the poster then flashes for a frame): swap a few frames later.
  var FREEZE_LEAD_MS = 50;
  function freezeLead() {
    return document.querySelector('.video-freeze') ? 'swap:' + FREEZE_LEAD_MS + 'ms ' : '';
  }

  function unfreezeSunFrame() {
    var c = document.querySelector('.video-freeze');
    if (c) c.parentNode.removeChild(c);
    root.classList.remove('sky-frozen');
  }

  function sunCrossfade(toPath) {
    var on = !!document.startViewTransition && (lastPath === SUN_PATH) !== (toPath === SUN_PATH);
    if (on) freezeSunFrame();
    clearTimeout(crossfadeTimer);
    root.classList.toggle('sun-crossfade', on);
    // Arrived on Digital Sun by the crossfade: keep its poster until the video
    // plays (Safari starts it only after the transition), see styles.css.
    root.classList.toggle('sun-arrived', on && toPath === SUN_PATH);
    if (on) {
      var ms = parseFloat(getComputedStyle(root).getPropertyValue('--sun-crossfade')) || 1400;
      crossfadeTimer = setTimeout(function () {
        root.classList.remove('sun-crossfade');
        videoMode(); // iOS may defer play() on the page painted only as a transition snapshot
      }, ms + 300);
    }
    return on;
  }

  document.addEventListener('htmx:historyCacheHit', function (event) {
    if (sunCrossfade(location.pathname)) {
      event.detail.swapSpec.transition = true;
      if (document.querySelector('.video-freeze')) event.detail.swapSpec.swapDelay = FREEZE_LEAD_MS;
    }
  });

  document.addEventListener('htmx:beforeSwap', function (event) {
    var detail = event.detail;
    if (detail.shouldSwap && detail.xhr !== droppedXhr) {
      var to = new URL(detail.xhr.responseURL || detail.pathInfo.requestPath, location.href).pathname;
      // No swap delay: the old page must still be fully visible when it's snapshotted.
      // No swap delay (the old page must still be fully visible when it's
      // snapshotted; the swap fade is off during the crossfade), except a few
      // frames for a just-made frozen sun frame to reach the screen first.
      if (sunCrossfade(to)) detail.swapOverride = 'outerHTML ' + freezeLead() + 'transition:true show:window:top';
    }
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
    if (detail.shouldSwap) pauseVideo();
  });

  // Snapshots (link navs and back/forward) must not keep .playing: a restored
  // copy would show the empty video over its poster until it plays.
  // The frozen frame stays out of the snapshot: taken out while htmx copies the
  // page, put back before the next frame.
  document.addEventListener('htmx:beforeHistorySave', function () {
    pauseVideo();
    var c = document.querySelector('.video-freeze');
    if (!c) return;
    var parent = c.parentNode, next = c.nextSibling;
    parent.removeChild(c);
    Promise.resolve().then(function () { if (parent.isConnected) parent.insertBefore(c, next); });
  });

  // A response that won't swap (and isn't an error, which full-loads) ends the navigation.
  document.addEventListener('htmx:afterRequest', function (event) {
    if (event.detail.xhr === navXhr && !navSwapPending) {
      navXhr = null;
      unfreezeSunFrame(); // still on this page: let the video show again
    }
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
    root.classList.remove('sky-frozen'); // the frozen sky left with the old page
    releaseDetachedVideo();
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

  // A restore inside a view transition swaps a frame or more after this event
  // (in the transition's update callback): wait for the new #main first.
  document.addEventListener('htmx:historyRestore', function () {
    if (!root.classList.contains('sun-crossfade')) return afterPageChange();
    var before = document.getElementById('main');
    var frames = 0;
    (function check() {
      if (document.getElementById('main') !== before || ++frames > 120) afterPageChange();
      else requestAnimationFrame(check);
    })();
  });

  oceanMode(false);
  videoMode();
  scheduleSunWarm();
})();
