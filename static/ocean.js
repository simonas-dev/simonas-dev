// Ocean background: WebGL, quality tiers, render loop. Sets `shader-ready`
// (tier settled) or `no-webgl` on <html>.
(function () {
  'use strict';
  if (window.__ocean) return;

  var root = document.documentElement;
  var canvas = document.getElementById('ocean');
  if (!canvas) return;

  var TIERS = [
    { name: 'high', scale: 0.4, raymarch: 12, normal: 16 },
    { name: 'med', scale: 0.375, raymarch: 10, normal: 12 },
    { name: 'low', scale: 0.35, raymarch: 8, normal: 8 }
  ];
  var MAX_BACKING_WIDTH = 1024;
  var NOISE_SCALE = 1.0;
  var GRAIN_HZ = 24;
  var MAX_DT = 0.1;
  var PROBE_WARMUP_FRAMES = 10;
  var PROBE_FRAMES = 30;
  var PROBE_SLOW_MS = 20;
  var PROBE_STATIC_MS = 40; // > 33.3: 30 Hz caps still animate
  var PROBE_BAIL_FRAMES = 10;
  var PROBE_BAIL_MS = 100;
  var GRAIN_STEPS = 16; // grain is fract(.. + u_grainTime * 1.5)
  var SWELL_PERIOD = 8 * Math.PI; // swell is sin(iTime * 0.25)
  var TIER_STORAGE_KEY = 'ocean-tier';
  var STATIC_TIER = 'static';
  var UNIFORM_NAMES = ['iResolution', 'iTime', 'u_waveTime', 'u_grainTime', 'u_night', 'u_noiseScale'];
  // The 38.2% horizon lives in CAMERA_PITCH in ocean.frag.glsl.

  // site.js sets speed/res/fps/paused and tweens night; wake() applies paused.
  var state = window.__ocean = { speed: 1, res: 1, fps: 0, resize: onResize, night: +root.classList.contains('theme-night'), tier: null, wake: wake };

  var gl = null;
  var program = null;
  var quadBuffer = null;
  var started = false;
  var uniforms = {};
  var sourcesPromise = null;
  var sourcesCache = null;
  var tierIndex = 0;
  var isStatic = false;
  var rafId = 0;
  var startTime = 0;
  var lastFrameTime = 0;
  var waveTime = 0;
  var sizeDirty = true;
  var probe = null;
  var revealPending = false;

  function readCachedTier() {
    try { return sessionStorage.getItem(TIER_STORAGE_KEY); } catch (e) { return null; }
  }

  function writeCachedTier(value) {
    try { sessionStorage.setItem(TIER_STORAGE_KEY, value); } catch (e) {}
  }

  function initialTierIndex() {
    var dpr = window.devicePixelRatio || 1;
    var cores = navigator.hardwareConcurrency || 8;
    if ((dpr >= 2 && window.innerWidth <= 900) || cores <= 4) return 1;
    return 0;
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function fallback(reason) {
    stopLoop();
    program = null;
    root.classList.remove('shader-ready');
    root.classList.add('no-webgl');
    if (reason) console.warn('ocean: ' + reason);
  }

  function loadSources() {
    if (!sourcesPromise) {
      sourcesPromise = Promise.all(['/shader/ocean.vert.glsl', '/shader/ocean.frag.glsl'].map(function (url) {
        return fetch(url).then(function (res) {
          if (!res.ok) throw new Error(url + ' ' + res.status);
          return res.text();
        });
      }));
    }
    return sourcesPromise;
  }

  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      console.error('ocean: shader compile failed\n' + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function buildProgram(sources, tier) {
    var defines = '#define ITERS_RAYMARCH ' + tier.raymarch + '\n#define ITERS_NORMAL ' + tier.normal + '\n';
    var vert = compile(gl.VERTEX_SHADER, sources[0]);
    var frag = compile(gl.FRAGMENT_SHADER, defines + sources[1]);
    if (!vert || !frag) {
      if (vert) gl.deleteShader(vert);
      if (frag) gl.deleteShader(frag);
      return false;
    }
    var next = gl.createProgram();
    gl.attachShader(next, vert);
    gl.attachShader(next, frag);
    gl.bindAttribLocation(next, 0, 'a_position');
    gl.linkProgram(next);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(next, gl.LINK_STATUS) && !gl.isContextLost()) {
      console.error('ocean: program link failed\n' + gl.getProgramInfoLog(next));
      gl.deleteProgram(next);
      return false;
    }
    if (program) gl.deleteProgram(program);
    program = next;
    gl.useProgram(program);
    uniforms = {};
    UNIFORM_NAMES.forEach(function (name) {
      uniforms[name] = gl.getUniformLocation(program, name);
    });
    uniforms.u_ripples = gl.getUniformLocation(program, 'u_ripples');
    if (uniforms.u_noiseScale) gl.uniform1f(uniforms.u_noiseScale, NOISE_SCALE);
    state.tier = tier.name;
    sizeDirty = true;
    return true;
  }

  function applySize() {
    var scale = TIERS[tierIndex].scale * (probe ? 1 : state.res);
    var w = Math.max(1, Math.round(canvas.clientWidth * scale));
    var h = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (w > MAX_BACKING_WIDTH) {
      h = Math.max(1, Math.round(h * MAX_BACKING_WIDTH / w));
      w = MAX_BACKING_WIDTH;
    }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    if (uniforms.iResolution) gl.uniform2f(uniforms.iResolution, w, h);
    sizeDirty = false;
  }

  function draw(now) {
    if (sizeDirty) applySize();
    var elapsed = (now - startTime) / 1000;
    var dt = lastFrameTime ? (now - lastFrameTime) / 1000 : 0;
    lastFrameTime = now;
    waveTime += Math.min(dt, MAX_DT) * state.speed;
    if (uniforms.iTime) gl.uniform1f(uniforms.iTime, elapsed % SWELL_PERIOD);
    if (uniforms.u_waveTime) gl.uniform1f(uniforms.u_waveTime, waveTime);
    if (uniforms.u_grainTime) gl.uniform1f(uniforms.u_grainTime, (Math.floor(elapsed * GRAIN_HZ) % GRAIN_STEPS) / GRAIN_HZ);
    if (uniforms.u_night) gl.uniform1f(uniforms.u_night, state.night);
    if (uniforms.u_ripples && state.ripples) gl.uniform4fv(uniforms.u_ripples, state.ripples);
    state.wave = waveTime;
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function median(values) {
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function settleStatic() {
    probe = null;
    isStatic = true;
    writeCachedTier(STATIC_TIER);
    return true;
  }

  // Returns true when the render loop should stop.
  function stepProbe(delta) {
    probe.frames++;
    if (probe.frames <= PROBE_WARMUP_FRAMES) return false;
    probe.deltas.push(delta);
    if (probe.deltas.length === PROBE_BAIL_FRAMES && Math.min.apply(null, probe.deltas) > PROBE_BAIL_MS) {
      return settleStatic();
    }
    if (probe.deltas.length < PROBE_FRAMES) return false;

    var ms = median(probe.deltas);
    if (ms > PROBE_SLOW_MS && tierIndex < TIERS.length - 1 && probe.stepsDown < 2) {
      tierIndex++;
      if (!buildProgram(sourcesCache, TIERS[tierIndex])) {
        fallback('tier rebuild failed');
        return true;
      }
      probe = { frames: 0, deltas: [], stepsDown: probe.stepsDown + 1 };
      return false;
    }
    if (ms > PROBE_STATIC_MS && tierIndex === TIERS.length - 1) return settleStatic();
    probe = null;
    sizeDirty = true;
    writeCachedTier(TIERS[tierIndex].name);
    revealPending = true;
    return false;
  }

  function frame(now) {
    rafId = 0;
    if (state.paused) return;
    // -8 ms: 60 Hz gives 15 fps, not 12. Probe uncapped.
    if (probe || !state.fps || now - lastFrameTime > 1000 / state.fps - 8) {
      var delta = lastFrameTime ? now - lastFrameTime : 0;
      draw(now);
      if (revealPending) {
        revealPending = false;
        root.classList.add('shader-ready');
      }
      if (probe && stepProbe(delta)) {
        if (isStatic) drawStatic();
        return;
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  function drawStatic() {
    stopLoop();
    state.ripples = null; // no ripples in the static tier
    draw(performance.now());
    root.classList.add('shader-ready');
  }

  // Static tier has no loop; site.js redraws per tween tick.
  state.redraw = function () {
    if (isStatic && program && !state.paused && !gl.isContextLost()) drawStatic();
  };

  // site.js writes click ripples: (screen uv xy, state.wave at click, strength) x 10.
  state.ripples = new Float32Array(40);

  function start(sources) {
    if (started) return;
    started = true;
    sourcesCache = sources;
    var cached = readCachedTier();
    isStatic = cached === STATIC_TIER;
    var cachedIndex = -1;
    for (var i = 0; i < TIERS.length; i++) {
      if (TIERS[i].name === cached) cachedIndex = i;
    }
    tierIndex = isStatic ? TIERS.length - 1 : (cachedIndex >= 0 ? cachedIndex : initialTierIndex());

    if (!quadBuffer) {
      quadBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    }

    if (!buildProgram(sources, TIERS[tierIndex])) {
      fallback('shader build failed');
      return;
    }
    startTime = performance.now();
    lastFrameTime = 0;
    if (isStatic) {
      drawStatic();
      return;
    }
    // Cached tier: no probe, reveal on first frame.
    probe = cachedIndex >= 0 ? null : { frames: 0, deltas: [], stepsDown: 0 };
    revealPending = !probe;
    stopLoop();
    rafId = requestAnimationFrame(frame);
  }

  function init() {
    gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      depth: false,
      powerPreference: 'low-power'
    });
    if (!gl) return fallback('WebGL unavailable');
    var highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    if (!highp || highp.precision === 0) return fallback('no highp float in fragment shaders');
    loadSources().then(function (sources) {
      if (gl.isContextLost()) return;
      start(sources);
    }, function (err) {
      fallback('shader fetch failed: ' + err.message);
    });
  }

  function onResize() {
    sizeDirty = true;
    state.redraw();
  }

  if (window.ResizeObserver) {
    new ResizeObserver(onResize).observe(canvas);
  } else {
    window.addEventListener('resize', onResize);
    onResize();
  }

  canvas.addEventListener('webglcontextlost', function (event) {
    event.preventDefault();
    stopLoop();
    program = null;
    quadBuffer = null;
    started = false;
    probe = null;
    revealPending = false;
    root.classList.remove('shader-ready');
  });
  canvas.addEventListener('webglcontextrestored', init);

  // Hidden tab or paused: no frames. On return the gap must not count as a probe frame.
  function wake() {
    if (document.hidden || state.paused) return stopLoop();
    if (isStatic) return state.redraw();
    if (started && program && !isStatic && !rafId && !gl.isContextLost()) {
      lastFrameTime = 0;
      if (probe) probe = { frames: 0, deltas: [], stepsDown: probe.stepsDown };
      rafId = requestAnimationFrame(frame);
    }
  }
  document.addEventListener('visibilitychange', wake);

  init();
})();
