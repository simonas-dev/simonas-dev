// Ocean background. Raymarcher ported from afl_ext "Very fast procedural
// ocean" (MIT, https://www.shadertoy.com/view/MdXyzX); greyscale film-grain
// post pass per PLAN.md "Shader notes".
// ocean.js prepends `#define ITERS_RAYMARCH n` and `#define ITERS_NORMAL n`.
precision highp float;

uniform vec2 iResolution;  // backing-store size in pixels
uniform float iTime;       // seconds since start
uniform float u_waveTime;  // accumulated wave time (speed-scaled)
uniform float u_grainTime; // stepped at 24 Hz
uniform float u_night;     // 0 = day, 1 = night
uniform float u_noiseScale;
uniform vec4 u_ripples[10]; // click: screen uv xy, u_waveTime at click, strength (0 = unused)

#define MAX_WAVE_ITERS 36
#define RAYMARCH_STEPS 64
#define WATER_DEPTH 0.75
#define PI 3.14159265
#define NIGHT_DIM 0.32
#define PEAK 0.6          // crest sharpness: lower = rounder swell

// Fixed camera. Screen horizon (ray.y == 0) sits at
//   horizonFromBottom = 0.5 + 0.5 * CAMERA_FOCAL * tan(CAMERA_PITCH)
// of the viewport height, independent of aspect ratio and camera height.
const float CAMERA_HEIGHT = 1.25; // above the mean water plane
const float CAMERA_PITCH = -0.1561; // radians, negative = looking up
const float CAMERA_FOCAL = 1.5;   // focal length in half-viewport-heights
const float CAMERA_DRIFT = 0.08;  // origin drift per unit of u_waveTime
const float CAMERA_SWELL = 0.015; // height swell amplitude (iTime)


vec2 wavedx(vec2 p, vec2 d, float freq, float t) {
  float x = dot(d, p) * freq + t;
  float wave = exp(PEAK * (sin(x) - 1.0));
  return vec2(wave, -PEAK * wave * cos(x));    // height, derivative
}

float getwaves(vec2 p, int iters) {
  float iter = 0.0, freq = 1.0, tw = 0.9, w = 1.0, sum = 0.0, sumw = 0.0;
  for (int i = 0; i < MAX_WAVE_ITERS; i++) {
    if (i >= iters) break;
    vec2 d = vec2(sin(iter), cos(iter));
    vec2 r = wavedx(p, d, freq, u_waveTime * tw);
    p += d * r.y * w * 0.2;                      // drag
    sum += r.x * w; sumw += w;
    w *= 0.76; freq *= 1.18; tw *= 1.07; iter += 1232.399963;
  }
  return sum / sumw;
}

// Distance along the ray between the two water planes where it meets the waves.
float raymarchwater(vec3 camera, vec3 start, vec3 end, float depth) {
  vec3 pos = start;
  vec3 dir = normalize(end - start);
  for (int i = 0; i < RAYMARCH_STEPS; i++) {
    float height = getwaves(pos.xz, ITERS_RAYMARCH) * depth - depth;
    if (height + 0.01 > pos.y) {
      return distance(pos, camera);
    }
    pos += dir * (pos.y - height);
  }
  return distance(start, camera);
}

vec3 waterNormal(vec2 pos, float e, float depth) {
  vec2 ex = vec2(e, 0.0);
  float H = getwaves(pos, ITERS_NORMAL) * depth;
  vec3 a = vec3(pos.x, H, pos.y);
  return normalize(cross(
    a - vec3(pos.x - e, getwaves(pos - ex.xy, ITERS_NORMAL) * depth, pos.y),
    a - vec3(pos.x, getwaves(pos + ex.yx, ITERS_NORMAL) * depth, pos.y + e)
  ));
}

float intersectPlane(vec3 origin, vec3 dir, vec3 point, vec3 normal) {
  return clamp(dot(point - origin, normal) / dot(dir, normal), -1.0, 9991999.0);
}

// Simple sky: a plain vertical gradient. No sun or moon lobe (owner: no bright
// spot in the sky; the faint Digital Sun video on home is the only "sun").
vec3 sky(vec3 dir) {
  float up = clamp(dir.y, 0.0, 1.0);
  return mix(vec3(0.86), vec3(0.6), pow(up, 0.6));
}

vec3 cameraRay(vec2 fragCoord) {
  vec2 uv = (fragCoord * 2.0 - iResolution) / iResolution.y;
  vec3 d = normalize(vec3(uv, CAMERA_FOCAL));
  float c = cos(CAMERA_PITCH), s = sin(CAMERA_PITCH);
  return vec3(d.x, d.y * c - d.z * s, d.y * s + d.z * c);
}

// Night stars: sparse hashed cells on the sky, no twinkle. A cell is ~2 backing
// px at the smallest render scale (low tier, content res, phone height); stars
// fade out near the horizon.
const float STAR_CELL = 0.02;
vec3 stars(vec3 dir) {
  if (u_night <= 0.0) return vec3(0.0);
  vec2 p = dir.xy / max(dir.z, 0.1) / STAR_CELL;
  vec2 cell = floor(p);
  float h = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
  if (h > 0.03) return vec3(0.0);
  vec2 centre = 0.25 + 0.5 * fract(vec2(h * 71.3, h * 113.9) * 37.0);
  float star = (1.0 - smoothstep(0.0, 0.45, length(p - cell - centre))) * (0.4 + 20.0 * h);
  return vec3(0.15 * star * u_night * smoothstep(0.03, 0.2, dir.y));
}

// Click ripples: each click's camera ray (from the camera position at click
// time) meets the mean water surface (~0.4 WATER_DEPTH below the top plane:
// exp(PEAK * (sin - 1)) averages ~0.6) at the ring centre. Returns a normal offset.
const float RIPPLE_LIFE = 3.5;  // in u_waveTime
vec3 rippleNormal(vec2 p) {
  vec3 n = vec3(0.0);
  for (int i = 0; i < 10; i++) {
    vec4 r = u_ripples[i];
    float age = u_waveTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > RIPPLE_LIFE) continue;
    vec3 ray = cameraRay((r.xy * iResolution.y + iResolution) * 0.5);
    if (ray.y >= -0.01) continue;
    vec3 origin = vec3(r.z * CAMERA_DRIFT, CAMERA_HEIGHT, 1.0);
    float far = intersectPlane(origin, ray, vec3(0.0, -0.4 * WATER_DEPTH, 0.0), vec3(0.0, 1.0, 0.0));
    vec2 d = p - (origin + ray * far).xz;
    float s = max(far, 3.0) / 5.0; // larger rings further out, against aliasing
    float x = (length(d) - age * 0.45 * s) / s; // distance behind the front
    float life = 1.0 - age / RIPPLE_LIFE;
    float a = 0.3 * r.w * life * smoothstep(0.0, 0.3, age) * smoothstep(0.04, 0.15, -ray.y);
    n.xz += normalize(d + 1e-4) * a * exp(-x * x / 0.06) * sin(x * 12.566);
  }
  return n;
}

float gaussian(float z, float mu, float sigma) {
  float t = (z - mu) / sigma;
  return exp(-0.5 * t * t) / (sigma * sqrt(2.0 * PI));
}

vec3 post(vec3 color, vec2 uv) {
  float gray = dot(color, vec3(0.299, 0.587, 0.114));
  // Night: dim the scene so light ink (#e8e6e1) stays readable on the sky.
  gray *= mix(1.0, NIGHT_DIM, u_night);
  float n = fract(sin(dot(uv * u_noiseScale, vec2(12.9898, 78.233))) * 43758.5453 + u_grainTime * 1.5);
  n = gaussian(n, 0.0, mix(0.75, 0.6, u_night));
  gray = clamp(gray + n * (1.0 - gray) * mix(0.4, 0.065, u_night), 0.0, 1.0);
  vec3 dark  = mix(vec3(0.62, 0.615, 0.60), vec3(0.05), u_night);
  vec3 light = mix(vec3(0.980, 0.976, 0.965), vec3(1.00), u_night);
  return mix(dark, light, gray);
}

void main() {
  vec3 ray = cameraRay(gl_FragCoord.xy);
  vec3 color;
  if (ray.y >= -1e-4) { // near-horizon rays as sky: plane hits there divide by ~0
    color = sky(ray) + stars(ray);
  } else {
    vec3 origin = vec3(u_waveTime * CAMERA_DRIFT,
                       CAMERA_HEIGHT + CAMERA_SWELL * sin(iTime * 0.25), 1.0);
    vec3 up = vec3(0.0, 1.0, 0.0);
    float highHit = intersectPlane(origin, ray, vec3(0.0), up);
    float lowHit = intersectPlane(origin, ray, vec3(0.0, -WATER_DEPTH, 0.0), up);
    float dist = raymarchwater(origin, origin + ray * highHit, origin + ray * lowHit, WATER_DEPTH);
    vec3 hit = origin + ray * dist;

    // Normal epsilon ~ pixel footprint on the water: grows with distance and, at
    // grazing angles, by 1/|ray.y| (footprint stretches along the view ray).
    float eps = 0.01 + dist * 3.0 / (CAMERA_FOCAL * iResolution.y * max(-ray.y, 0.03));
    vec3 N = waterNormal(hit.xz, eps, WATER_DEPTH);
    N = mix(N, up, 0.8 * min(1.0, sqrt(dist * 0.01) * 1.1));
    N += rippleNormal(hit.xz); // zero without ripples: day frames unchanged
    float fresnel = 0.04 + 0.96 * pow(1.0 - max(0.0, dot(-N, ray)), 5.0);
    vec3 R = reflect(ray, N);
    R.y = abs(R.y);
    vec3 scattering = vec3(0.0293, 0.0698, 0.1717) * 0.1
                    * (0.2 + (hit.y + WATER_DEPTH) / WATER_DEPTH);
    color = fresnel * sky(R) + scattering;
  }
  gl_FragColor = vec4(post(color, gl_FragCoord.xy), 1.0);
}
