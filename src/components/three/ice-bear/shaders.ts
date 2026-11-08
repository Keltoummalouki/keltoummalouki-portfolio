// GLSL for the Ice Bear hero. Written GLSL 1-style: three.js adds the WebGL 2
// compatibility defines for ShaderMaterial. Colours stay in display (sRGB)
// space end to end (raw textures, no output conversion) so the canvas matches
// the CSS palette and the server-rendered picture exactly. Every fragment
// shader outputs premultiplied alpha.

/**
 * Shared by the bear surface and its particles: when each texel freezes
 * during the intro (feet first) and thaws away on scroll (head first). Using
 * the same keys keeps the snow and the solid bear in sync.
 */
const KEYS = /* glsl */ `
float iceHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float iceNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 s = f * f * (3.0 - 2.0 * f);
  float a = iceHash(i);
  float b = iceHash(i + vec2(1.0, 0.0));
  float c = iceHash(i + vec2(0.0, 1.0));
  float d = iceHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}
float iceFbm(vec2 p) {
  return iceNoise(p) * 0.6 + iceNoise(p * 2.13 + 17.1) * 0.3 + iceNoise(p * 4.37 + 3.7) * 0.1;
}
float keyFreeze(vec2 uv) {
  return clamp(uv.y * 0.62 + iceFbm(uv * vec2(5.0, 8.4)) * 0.38, 0.0, 1.0);
}
float keyThaw(vec2 uv) {
  return clamp((1.0 - uv.y) * 0.55 + iceFbm(uv * vec2(5.0, 8.4) + 9.7) * 0.45, 0.0, 1.0);
}
`

export const bearVertex = /* glsl */ `
uniform sampler2D uRelief;
uniform float uDepth;
uniform float uAspect;
uniform vec4 uPoke; // xy: uv, z: strength, w: seconds since the poke

varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vec4 relief = texture2D(uRelief, uv);
  vNormal = relief.rgb * 2.0 - 1.0;

  // Poke: a damped ripple spreading from the touched point.
  vec2 q = (uv - uPoke.xy) * vec2(uAspect, 1.0);
  float r = length(q);
  float wave = uPoke.z * sin(r * 34.0 - uPoke.w * 16.0) * exp(-r * 4.0) * exp(-uPoke.w * 2.6)
    * smoothstep(0.0, 0.04, uPoke.w);

  vec3 p = position;
  p.z += relief.a * uDepth * (1.0 + wave * 0.6);
  p.xy += (r > 1e-4 ? q / r : vec2(0.0)) * wave * 0.012;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

export const bearFragment = /* glsl */ `
${KEYS}
uniform sampler2D uMap;
uniform float uOpacity;
uniform float uFreeze;
uniform float uThaw;
uniform vec2 uLight;
uniform vec3 uRimA;
uniform vec3 uRimB;
uniform vec3 uIce;
uniform float uRim;
uniform float uFrost;
uniform float uGlint;
uniform vec4 uLens;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vec4 tex = texture2D(uMap, vUv); // premultiplied on upload: clean filtered edges
  if (tex.a < 0.003) discard;
  float frozen = uFreeze - keyFreeze(vUv);
  float thawed = uThaw - keyThaw(vUv);
  if (frozen < 0.0 || thawed > 0.0) discard;

  vec3 color = tex.rgb / tex.a;
  vec3 n = normalize(vNormal);

  // Relight towards the pointer, then a coloured rim on the lit side.
  vec3 light = normalize(vec3(uLight, 0.85));
  color *= 0.95 + 0.1 * dot(n, light);
  vec2 side = n.xy / max(length(n.xy), 1e-3);
  float facing = max(dot(side, normalize(uLight + vec2(1e-4))), 0.0) * smoothstep(0.0, 0.3, length(uLight));
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.0) * facing;
  color += mix(uRimA, uRimB, vUv.y) * rim * uRim;

  // Sunglasses: a reflection that follows the pointer, plus a passing glint.
  float inLens = step(uLens.x, vUv.x) * step(vUv.x, uLens.z) * step(uLens.y, vUv.y) * step(vUv.y, uLens.w);
  float lens = inLens * (1.0 - smoothstep(0.1, 0.24, dot(color, vec3(0.299, 0.587, 0.114))));
  vec2 spotAt = vec2(mix(uLens.x, uLens.z, 0.5 + uLight.x * 0.4), mix(uLens.y, uLens.w, 0.5 + uLight.y * 0.35));
  vec2 d = (vUv - spotAt) * vec2(14.0, 26.0);
  float spot = exp(-dot(d, d));
  float glint = exp(-pow((vUv.x * 0.8 + vUv.y - uGlint) * 45.0, 2.0));
  color += vec3(0.85, 0.92, 1.0) * lens * (spot * 0.45 + glint * 0.9);

  // Frost sweep, and glowing fronts where the bear freezes or thaws.
  color += uIce * exp(-pow((vUv.y - uFrost) * 8.0, 2.0)) * 0.35;
  float edge = max(1.0 - smoothstep(0.0, 0.03, frozen), 1.0 - smoothstep(0.0, 0.03, -thawed));
  color = mix(color, uIce * 1.25, edge * 0.9);

  float alpha = tex.a * uOpacity;
  gl_FragColor = vec4(color * alpha, alpha);
}
`

export const particleVertex = /* glsl */ `
${KEYS}
attribute vec2 aUv;
attribute vec3 aColor;
attribute vec2 aTarget;
attribute vec4 aTargetColor;
attribute vec4 aSeed;

uniform sampler2D uRelief;
uniform mat4 uBear;
uniform float uAspect;
uniform float uDepth;
uniform float uScale;
uniform vec4 uPortrait;
uniform float uHasPortrait;
uniform float uTime;
uniform float uFreeze;
uniform float uThaw;
uniform float uStorm;
uniform float uHandoff;
uniform float uReveal;
uniform vec3 uSnow;
uniform float uPixelRatio;
uniform float uBearDot;
uniform float uPortraitDot;

varying vec3 vColor;
varying float vAlpha;
varying float vSoft;

void main() {
  float kF = keyFreeze(aUv);
  float kT = keyThaw(aUv);
  float relief = texture2D(uRelief, aUv).a;
  vec3 bear = (uBear * vec4((aUv.x - 0.5) * uAspect, aUv.y - 0.5, relief * uDepth, 1.0)).xyz;
  vec3 centre = (uBear * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

  // 1. Intro: a snow vortex; each flake lands as the freeze front reaches its texel.
  float fly = clamp((uFreeze - kF) / 0.32 + 1.0, 0.0, 1.0);
  float flyE = 1.0 - pow(1.0 - fly, 3.0);
  float angle = aSeed.x * 6.2831853 + uTime * (0.55 + aSeed.y * 0.9) + (1.0 - flyE) * 2.0;
  float radius = uScale * (0.22 + aSeed.y * 0.48);
  vec3 storm = centre + vec3(
    cos(angle) * radius,
    (aSeed.z - 0.5) * uScale * 1.25 + sin(uTime * 0.7 + aSeed.w * 6.2831853) * uScale * 0.04,
    sin(angle) * radius
  );
  vec3 p = mix(storm, bear, flyE);

  // 2. Scroll: flakes blow off as the thaw front passes their texel.
  float blow = clamp((uThaw - kT) / 0.4, 0.0, 1.0);
  vec3 wind = vec3((aSeed.x - 0.5) * 0.7 * blow, (0.2 + aSeed.y * 0.45) * blow * blow, (aSeed.z - 0.5) * 0.8 * blow);
  wind += vec3(
    sin(p.y * 0.011 + uTime * 1.3 + aSeed.w * 6.0),
    cos(p.x * 0.009 + uTime * 1.1 + aSeed.x * 6.0),
    sin(p.x * 0.007 + uTime * 0.9)
  ) * 0.06 * blow;
  p += wind * uScale;

  // 3. Hand-off: the snow streams into the profile portrait (a curved path).
  float h = clamp((uHandoff - aSeed.w * 0.3) / 0.7, 0.0, 1.0) * smoothstep(0.0, 0.6, blow) * uHasPortrait;
  float hE = h * h * (3.0 - 2.0 * h);
  vec3 target = vec3(uPortrait.xy + (aTarget - 0.5) * uPortrait.zw, 0.0);
  vec3 ctrl = mix(p, target, 0.5) + vec3((aSeed.x - 0.5) * 0.6, 0.1 + aSeed.y * 0.35, (aSeed.z - 0.5) * 0.6) * uScale;
  p = mix(mix(p, ctrl, hE), mix(ctrl, target, hE), hE);

  // Colour: icy in the air, the bear's colours on the bear, the portrait's at the end.
  float airborne = max(1.0 - flyE, blow) * (1.0 - hE);
  vColor = mix(mix(aColor, uSnow, airborne * 0.8), aTargetColor.rgb, hE);

  // Hidden while the solid surface shows this texel.
  float landed = smoothstep(kF, kF + 0.07, uFreeze);
  float released = smoothstep(kT - 0.01, kT + 0.02, uThaw);
  float alpha = max(1.0 - landed, released) * mix(uStorm, 1.0, step(0.001, fly));
  alpha *= mix(1.0, 0.7 + 0.3 * sin(uTime * 3.0 + aSeed.x * 40.0), airborne);
  alpha *= mix(1.0, aTargetColor.a, hE) * (1.0 - uReveal);
  alpha *= mix(1.0 - uHandoff, 1.0, uHasPortrait); // no portrait: the snow just melts away

  float size = mix(mix(uBearDot, 1.4 + aSeed.z * aSeed.z * 5.0, airborne), uPortraitDot, hE);
  vSoft = airborne;
  vAlpha = alpha;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  gl_PointSize = max(size * uPixelRatio, 1.0);
}
`

export const particleFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying float vSoft;

void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float shape = mix(1.0 - smoothstep(0.7, 1.0, r), exp(-r * r * 4.0), vSoft);
  float alpha = shape * vAlpha;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(vColor * alpha, alpha);
}
`

export const ringVertex = /* glsl */ `
uniform mat4 uLocal; // the ring's transform inside the tilting group
uniform float uPlaneZ; // mid-depth of the bear, same space

varying float vS;
varying float vDepth;
varying vec3 vViewNormal;

void main() {
  vS = uv.x; // 0 → 1 around the ring (the torus repeats its seam vertex, so no wrap glitch)
  vDepth = (uLocal * vec4(position, 1.0)).z - uPlaneZ;
  vViewNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const ringFragment = /* glsl */ `
uniform float uTime;
uniform float uSide;
uniform float uOpacity;
uniform float uDraw;
uniform vec3 uColorA;
uniform vec3 uColorB;

varying float vS;
varying float vDepth;
varying vec3 vViewNormal;

void main() {
  // Each half is drawn on its own side of the bear: behind first, in front last.
  if (vDepth * uSide < 0.0 || vS > uDraw) discard;
  float core = pow(abs(vViewNormal.z), 2.0);
  float tail = pow(1.0 - fract(fract(uTime * 0.06) - vS), 8.0);
  float tail2 = pow(1.0 - fract(fract(uTime * 0.035 + 0.45) - vS), 14.0) * 0.7;
  vec3 color = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vS * 12.5663706 + uTime * 0.3));
  color = mix(color, vec3(1.0), clamp(tail * tail + tail2 * 0.5, 0.0, 1.0) * 0.7);
  float alpha = clamp(core * (0.3 + tail * 1.4 + tail2), 0.0, 1.0) * uOpacity;
  gl_FragColor = vec4(color * alpha, alpha);
}
`

export const steamVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const steamFragment = /* glsl */ `
${KEYS}
uniform float uTime;
uniform float uOpacity;
uniform vec3 uColor;

varying vec2 vUv;

void main() {
  float t = uTime * 0.4;
  float y = vUv.y;
  float a = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    // Three wisps leaving the lid, curling and drifting right as they rise.
    float x = vUv.x - (0.2 + fi * 0.1) - y * 0.12 - y * y * 0.4;
    x += sin(y * 7.0 - t * 3.0 + fi * 2.1) * 0.05 * y;
    x += (iceNoise(vec2(y * 4.0 - t * 2.0, fi * 7.0)) - 0.5) * 0.16 * y;
    float w = 0.03 + y * 0.06;
    a += exp(-x * x / (w * w)) * (0.5 + 0.5 * iceNoise(vec2(vUv.x * 9.0, y * 6.0 - t * 4.0 + fi)));
  }
  float fade = smoothstep(0.0, 0.12, y) * (1.0 - smoothstep(0.4, 1.0, y));
  float alpha = clamp(a * fade * 0.3, 0.0, 1.0) * uOpacity;
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`

export const ambientVertex = /* glsl */ `
attribute vec4 aSeed;
uniform vec2 uView;
uniform vec2 uOffset;
uniform vec2 uPointer;
uniform float uTime;
uniform float uPixelRatio;
uniform float uOpacity;

varying float vAlpha;

void main() {
  float depth = aSeed.z;
  float y = fract(aSeed.y - uTime * (0.006 + depth * 0.012));
  float x = aSeed.x + sin(uTime * 0.3 + aSeed.w * 6.2831853) * 0.01;
  vec2 p = (vec2(x, y) - 0.5) * uView + uOffset + uPointer * (6.0 + depth * 26.0);
  float twinkle = 0.55 + 0.45 * sin(uTime * (1.0 + aSeed.w * 2.0) + aSeed.w * 30.0);
  vAlpha = (0.25 + 0.75 * depth) * twinkle * uOpacity;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, -200.0, 1.0);
  gl_PointSize = (0.8 + depth * 2.2) * uPixelRatio;
}
`

export const burstVertex = /* glsl */ `
attribute vec4 aDir; // xyz: direction, w: speed
uniform vec3 uOrigin;
uniform float uAge;
uniform float uScale;
uniform float uPixelRatio;

varying float vAlpha;

void main() {
  float t = uAge;
  vec3 p = uOrigin + aDir.xyz * aDir.w * uScale * 0.32 * (1.0 - exp(-t * 3.2));
  p.y -= uScale * 0.1 * t * t;
  vAlpha = clamp(1.0 - t / 1.1, 0.0, 1.0) * step(0.0, t);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  gl_PointSize = max((2.5 + aDir.w * 5.0) * (1.0 - t * 0.45) * uPixelRatio, 1.0);
}
`

/** Soft round dot in a uniform colour (ambient snow, poke burst). */
export const dotFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;

void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float alpha = exp(-r * r * 3.5) * vAlpha;
  if (alpha < 0.004) discard;
  gl_FragColor = vec4(uColor * alpha, alpha);
}
`
