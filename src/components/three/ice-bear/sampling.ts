// Where the snow particles live: points spread over the bear's silhouette (the
// hero) and over the arch-shaped portrait in the profile section (where the
// snow lands). Pure functions, unit-tested; uv coordinates use v = 0 at the
// bottom, like WebGL textures.

export interface PixelSource {
  /** RGBA bytes, row-major, top row first (ImageData layout). */
  data: ArrayLike<number>
  width: number
  height: number
}

export type Random = () => number

/** Deterministic PRNG (mulberry32), so a layout can be reproduced. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Picks `count` points evenly spread over the pixels whose alpha is at least
 * `threshold`: stratified along scanline order, jittered inside each pixel.
 * Returns uv pairs and the rgb colour (0..1) found there.
 */
export function sampleSilhouette(
  source: PixelSource,
  count: number,
  random: Random,
  threshold = 160,
): { uv: Float32Array; color: Float32Array } {
  const { data, width, height } = source
  const candidates: number[] = []
  for (let i = 0; i < width * height; i++) if (data[i * 4 + 3] >= threshold) candidates.push(i)

  const uv = new Float32Array(count * 2)
  const color = new Float32Array(count * 3)
  if (!candidates.length) return { uv, color }

  const step = candidates.length / count
  for (let k = 0; k < count; k++) {
    const pick = candidates[Math.min(candidates.length - 1, Math.floor((k + random()) * step))]
    const x = pick % width
    const y = (pick - x) / width
    uv[k * 2] = (x + random()) / width
    uv[k * 2 + 1] = 1 - (y + random()) / height
    color[k * 3] = data[pick * 4] / 255
    color[k * 3 + 1] = data[pick * 4 + 1] / 255
    color[k * 3 + 2] = data[pick * 4 + 2] / 255
  }
  return { uv, color }
}

/**
 * True when a point lies inside an arch: a box whose top is a half-disc as
 * wide as the box (CSS `rounded-t-full`). `fromTop` is 0 at the top edge,
 * `aspect` is height / width.
 */
export function insideArch(u: number, fromTop: number, aspect: number): boolean {
  if (u < 0 || u > 1 || fromTop < 0 || fromTop > 1) return false
  const y = fromTop * aspect // in box widths
  if (y >= 0.5) return true
  const dx = u - 0.5
  const dy = y - 0.5
  return dx * dx + dy * dy <= 0.25
}

/**
 * Picks `count` points spread evenly inside an arch-shaped box (jittered grid,
 * topped up with random picks). Returns uv pairs (v = 0 at the bottom).
 */
export function sampleArch(count: number, aspect: number, random: Random): Float32Array {
  const uv = new Float32Array(count * 2)
  if (count <= 0) return uv
  // The arch covers 1 - (1 - π/4) / (2·aspect) of its box.
  const coverage = 1 - (1 - Math.PI / 4) / (2 * aspect)
  const cells = count / coverage
  const cols = Math.max(1, Math.round(Math.sqrt(cells / aspect)))
  const rows = Math.max(1, Math.round(cells / cols))

  const inside: number[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = (c + random()) / cols
      const fromTop = (r + random()) / rows
      if (insideArch(u, fromTop, aspect)) inside.push(u, fromTop)
    }
  }
  while (inside.length < count * 2) {
    const u = random()
    const fromTop = random()
    if (insideArch(u, fromTop, aspect)) inside.push(u, fromTop)
  }

  // Stratified pick over the (row-ordered) cells keeps the spread even.
  const available = inside.length / 2
  const step = available / count
  for (let k = 0; k < count; k++) {
    const i = Math.min(available - 1, Math.floor((k + random()) * step))
    uv[k * 2] = inside[i * 2]
    uv[k * 2 + 1] = 1 - inside[i * 2 + 1]
  }
  return uv
}

/**
 * The image coordinates shown at (u, fromTop) of a box by `object-fit: cover`
 * (centred). Aspects are width / height.
 */
export function coverUv(u: number, fromTop: number, boxAspect: number, imageAspect: number): [number, number] {
  if (imageAspect > boxAspect) {
    const visible = boxAspect / imageAspect
    return [0.5 + (u - 0.5) * visible, fromTop]
  }
  const visible = imageAspect / boxAspect
  return [u, 0.5 + (fromTop - 0.5) * visible]
}

/** Opacity of the portrait's bottom fade (`black 72%` → transparent). */
export function archFade(fromTop: number, fadeStart = 0.72): number {
  if (fromTop <= fadeStart) return 1
  return Math.max(0, 1 - (fromTop - fadeStart) / (1 - fadeStart))
}

/**
 * Colour (rgba, 0..1) for every arch point: read from the portrait through the
 * cover crop when `image` is given, otherwise a frosty gradient. Alpha carries
 * the bottom fade.
 */
export function colorArch(
  uv: Float32Array,
  boxAspect: number,
  image?: PixelSource | null,
): Float32Array {
  const count = uv.length / 2
  const color = new Float32Array(count * 4)
  for (let k = 0; k < count; k++) {
    const u = uv[k * 2]
    const fromTop = 1 - uv[k * 2 + 1]
    let r: number
    let g: number
    let b: number
    if (image && image.width > 0 && image.height > 0) {
      const [iu, iv] = coverUv(u, fromTop, boxAspect, image.width / image.height)
      const x = Math.min(image.width - 1, Math.max(0, Math.floor(iu * image.width)))
      const y = Math.min(image.height - 1, Math.max(0, Math.floor(iv * image.height)))
      const o = (y * image.width + x) * 4
      r = image.data[o] / 255
      g = image.data[o + 1] / 255
      b = image.data[o + 2] / 255
    } else {
      // Ice white at the top melting into the portrait's charcoal backdrop.
      const t = fromTop
      r = 0.9 - 0.71 * t
      g = 0.95 - 0.77 * t
      b = 1.0 - 0.79 * t
    }
    color[k * 4] = r
    color[k * 4 + 1] = g
    color[k * 4 + 2] = b
    color[k * 4 + 3] = archFade(fromTop)
  }
  return color
}

/**
 * Rank pairing on height: the k-th highest source point is matched with the
 * k-th highest target point, so the stream keeps its vertical order (the
 * bear's head flows into the top of the portrait). `jitter` (in v units)
 * loosens the bands. Returns the target uvs reordered to follow the sources.
 */
export function pairByHeight(
  sourceUv: Float32Array,
  targetUv: Float32Array,
  random: Random,
  jitter = 0.06,
): Float32Array {
  const count = Math.min(sourceUv.length, targetUv.length) / 2
  const order = (uv: Float32Array) => {
    const keys = new Float32Array(count)
    for (let i = 0; i < count; i++) keys[i] = uv[i * 2 + 1] + (random() - 0.5) * jitter
    return Array.from({ length: count }, (_, i) => i).sort((a, b) => keys[b] - keys[a])
  }
  const sources = order(sourceUv)
  const targets = order(targetUv)
  const paired = new Float32Array(count * 2)
  for (let k = 0; k < count; k++) {
    paired[sources[k] * 2] = targetUv[targets[k] * 2]
    paired[sources[k] * 2 + 1] = targetUv[targets[k] * 2 + 1]
  }
  return paired
}
