// Turns a flat cut-out (an image with an alpha channel) into a soft relief: a
// height map that is 0 on the silhouette and rises like a stuffed pillow
// towards the inside, plus a few hand-placed bumps (snout, cup, arm) so those
// parts stand out when the picture is tilted. Pure functions: unit-tested in
// Node, run once in the browser on a small copy of the image.

/** An elliptical bulge, in image coordinates (0..1, y pointing down). */
export interface ReliefBump {
  x: number
  y: number
  rx: number
  ry: number
  /** Extra height at the centre, relative to the pillow's plateau (1). */
  height: number
}

export interface ReliefOptions {
  /** Alpha (0–255) at or above which a pixel counts as inside. */
  threshold?: number
  /** Distance from the edge, in pixels, over which the surface rounds off. */
  radius: number
  bumps?: readonly ReliefBump[]
  /** Box-blur radius in pixels, applied twice (smooths the medial-axis crease). */
  blur?: number
}

/**
 * Chamfer distance (in pixels, 1 / √2 steps) from every inside pixel to the
 * nearest outside one. The image border counts as outside.
 */
export function distanceToEdge(mask: Uint8Array, width: number, height: number): Float32Array {
  const dist = new Float32Array(width * height)
  for (let i = 0; i < dist.length; i++) dist[i] = mask[i] ? Number.POSITIVE_INFINITY : 0
  const diagonal = Math.SQRT2

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (dist[i] === 0) continue
      let d = dist[i]
      d = Math.min(d, (x > 0 ? dist[i - 1] : 0) + 1)
      d = Math.min(d, (y > 0 ? dist[i - width] : 0) + 1)
      d = Math.min(d, (x > 0 && y > 0 ? dist[i - width - 1] : 0) + diagonal)
      d = Math.min(d, (x < width - 1 && y > 0 ? dist[i - width + 1] : 0) + diagonal)
      dist[i] = d
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x
      if (dist[i] === 0) continue
      let d = dist[i]
      d = Math.min(d, (x < width - 1 ? dist[i + 1] : 0) + 1)
      d = Math.min(d, (y < height - 1 ? dist[i + width] : 0) + 1)
      d = Math.min(d, (x < width - 1 && y < height - 1 ? dist[i + width + 1] : 0) + diagonal)
      d = Math.min(d, (x > 0 && y < height - 1 ? dist[i + width - 1] : 0) + diagonal)
      dist[i] = d
    }
  }
  return dist
}

/** Separable box blur, in place. */
function boxBlur(values: Float32Array, width: number, height: number, radius: number) {
  if (radius < 1) return
  const tmp = new Float32Array(values.length)
  const span = radius * 2 + 1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(width - 1, Math.max(0, x + k))
        sum += values[y * width + xx]
      }
      tmp[y * width + x] = sum / span
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(height - 1, Math.max(0, y + k))
        sum += tmp[yy * width + x]
      }
      values[y * width + x] = sum / span
    }
  }
}

/**
 * Height map (row-major, top row first) normalised to a maximum of 1. Pixels
 * outside the silhouette stay at (or, after blurring, very near) 0.
 */
export function buildRelief(
  alpha: ArrayLike<number>,
  width: number,
  height: number,
  { threshold = 128, radius, bumps = [], blur = 2 }: ReliefOptions,
): Float32Array {
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i++) mask[i] = alpha[i] >= threshold ? 1 : 0
  const dist = distanceToEdge(mask, width, height)
  const relief = new Float32Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (!mask[i]) continue
      // Quarter-circle profile: steep at the silhouette, flat once `radius` in.
      const t = Math.min(dist[i] / radius, 1)
      let h = Math.sqrt(1 - (1 - t) * (1 - t))
      const u = (x + 0.5) / width
      const v = (y + 0.5) / height
      for (const bump of bumps) {
        const dx = (u - bump.x) / bump.rx
        const dy = (v - bump.y) / bump.ry
        const e = dx * dx + dy * dy
        // Scaled by t so a bump never lifts the silhouette itself.
        if (e < 1) h += bump.height * (1 - e) * (1 - e) * t
      }
      relief[i] = h
    }
  }

  boxBlur(relief, width, height, blur)
  boxBlur(relief, width, height, blur)

  let max = 0
  for (let i = 0; i < relief.length; i++) max = Math.max(max, relief[i])
  if (max > 0) for (let i = 0; i < relief.length; i++) relief[i] /= max
  return relief
}

/**
 * Packs a relief into RGBA bytes for a WebGL texture, bottom row first (so
 * texture v = 0 is the bottom of the picture): rgb = the surface normal
 * encoded 0..1 (x right, y up, z towards the viewer), a = height.
 * `strength` converts height steps into slope (bigger = steeper normals).
 */
export function packRelief(relief: Float32Array, width: number, height: number, strength: number): Uint8Array {
  const out = new Uint8Array(width * height * 4)
  const at = (x: number, y: number) =>
    relief[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Central differences; image rows grow downwards, so "up" is y - 1.
      let nx = (at(x - 1, y) - at(x + 1, y)) * strength
      let ny = (at(x, y + 1) - at(x, y - 1)) * strength
      let nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      nz /= len
      const o = ((height - 1 - y) * width + x) * 4
      out[o] = Math.round((nx * 0.5 + 0.5) * 255)
      out[o + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      out[o + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      out[o + 3] = Math.round(Math.min(1, Math.max(0, relief[y * width + x])) * 255)
    }
  }
  return out
}
