import { describe, expect, it } from 'vitest'
import { buildRelief, distanceToEdge, packRelief } from './relief'

/** A w×h alpha map with an opaque rectangle [x0, x1) × [y0, y1). */
function rectAlpha(w: number, h: number, x0: number, y0: number, x1: number, y1: number) {
  const alpha = new Uint8Array(w * h)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) alpha[y * w + x] = 255
  return alpha
}

describe('distanceToEdge', () => {
  it('is 0 outside and grows by one pixel per step inwards', () => {
    const w = 9
    const mask = rectAlpha(w, 9, 1, 1, 8, 8).map((a) => (a ? 1 : 0))
    const dist = distanceToEdge(Uint8Array.from(mask), w, 9)
    expect(dist[0]).toBe(0)
    expect(dist[1 * w + 1]).toBe(1) // corner pixel of the square, next to the outside
    expect(dist[4 * w + 1]).toBe(1) // middle of the left edge
    expect(dist[4 * w + 2]).toBe(2)
    expect(dist[4 * w + 4]).toBe(4) // centre: four steps from any side
  })

  it('treats the image border as outside', () => {
    const mask = new Uint8Array(5 * 5).fill(1)
    const dist = distanceToEdge(mask, 5, 5)
    expect(dist[0]).toBe(1)
    expect(dist[2 * 5 + 2]).toBe(3)
  })
})

describe('buildRelief', () => {
  const w = 40
  const h = 40
  const alpha = rectAlpha(w, h, 5, 5, 35, 35)

  it('is normalised to 1, peaks inside and stays ~0 outside', () => {
    const relief = buildRelief(alpha, w, h, { radius: 8, blur: 1 })
    const max = Math.max(...relief)
    expect(max).toBeCloseTo(1, 5)
    expect(relief[0]).toBe(0)
    expect(relief[20 * w + 20]).toBeGreaterThan(0.9)
    // Rounded edge: lower near the silhouette than at the centre.
    expect(relief[20 * w + 6]).toBeLessThan(relief[20 * w + 20])
  })

  it('raises the surface under a bump', () => {
    const flat = buildRelief(alpha, w, h, { radius: 4, blur: 0 })
    const bumped = buildRelief(alpha, w, h, {
      radius: 4,
      blur: 0,
      bumps: [{ x: 0.3, y: 0.5, rx: 0.12, ry: 0.12, height: 1 }],
    })
    const at = (r: Float32Array, x: number, y: number) => r[y * w + x]
    // After normalisation the bump is the peak and the opposite side is lower.
    expect(at(bumped, 12, 20)).toBeCloseTo(1, 2)
    expect(at(bumped, 28, 20)).toBeLessThan(at(flat, 28, 20))
  })
})

describe('packRelief', () => {
  it('encodes a flat area as a normal facing the viewer, bottom row first', () => {
    const w = 3
    const h = 2
    // Top row 0.25, bottom row 1 (flat within each row).
    const relief = Float32Array.from([0.25, 0.25, 0.25, 1, 1, 1])
    const packed = packRelief(relief, w, h, 0)
    // strength 0 → normal (0, 0, 1) → bytes (128, 128, 255)
    expect(Array.from(packed.slice(0, 4))).toEqual([128, 128, 255, 255]) // bottom row comes first
    expect(packed[(1 * w + 0) * 4 + 3]).toBe(64) // top row height 0.25
  })

  it('tilts the normal away from the slope', () => {
    // Height rising to the right: the surface faces left (nx < 0).
    const relief = Float32Array.from([0, 0.5, 1])
    const packed = packRelief(relief, 3, 1, 1)
    expect(packed[1 * 4]).toBeLessThan(128)
    expect(packed[1 * 4 + 1]).toBe(128)
  })
})
