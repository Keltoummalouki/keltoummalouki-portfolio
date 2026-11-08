import { describe, expect, it } from 'vitest'
import {
  archFade,
  colorArch,
  coverUv,
  insideArch,
  pairByHeight,
  sampleArch,
  sampleSilhouette,
  seededRandom,
} from './sampling'

/** 10×10 RGBA image: opaque red in the left half, transparent elsewhere. */
function halfImage() {
  const w = 10
  const h = 10
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < 5; x++) {
      const o = (y * w + x) * 4
      data[o] = 255
      data[o + 3] = 255
    }
  }
  return { data, width: w, height: h }
}

describe('seededRandom', () => {
  it('is reproducible and stays in [0, 1)', () => {
    const a = seededRandom(7)
    const b = seededRandom(7)
    for (let i = 0; i < 100; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('sampleSilhouette', () => {
  it('only picks opaque pixels and reads their colour', () => {
    const { uv, color } = sampleSilhouette(halfImage(), 200, seededRandom(1))
    for (let k = 0; k < 200; k++) {
      expect(uv[k * 2]).toBeLessThanOrEqual(0.5)
      expect(color[k * 3]).toBe(1)
      expect(color[k * 3 + 2]).toBe(0)
    }
  })

  it('spreads points over the whole silhouette (top and bottom halves)', () => {
    const { uv } = sampleSilhouette(halfImage(), 100, seededRandom(2))
    const top = Array.from({ length: 100 }, (_, k) => uv[k * 2 + 1]).filter((v) => v > 0.5).length
    expect(top).toBeGreaterThan(35)
    expect(top).toBeLessThan(65)
  })

  it('returns zeros when nothing is opaque', () => {
    const empty = { data: new Uint8ClampedArray(16), width: 2, height: 2 }
    const { uv } = sampleSilhouette(empty, 3, seededRandom(1))
    expect(Array.from(uv)).toEqual([0, 0, 0, 0, 0, 0])
  })
})

describe('insideArch', () => {
  it('cuts the top corners off and keeps the rectangle below', () => {
    const aspect = 1.25 // 4:5 portrait
    expect(insideArch(0.02, 0.02, aspect)).toBe(false) // top-left corner
    expect(insideArch(0.5, 0.01, aspect)).toBe(true) // top of the half-disc
    expect(insideArch(0.02, 0.9, aspect)).toBe(true) // bottom-left
    expect(insideArch(1.2, 0.5, aspect)).toBe(false)
  })
})

describe('sampleArch', () => {
  it('returns the requested number of points, all inside the arch', () => {
    const uv = sampleArch(500, 1.25, seededRandom(3))
    expect(uv.length).toBe(1000)
    for (let k = 0; k < 500; k++) {
      expect(insideArch(uv[k * 2], 1 - uv[k * 2 + 1], 1.25)).toBe(true)
    }
  })
})

describe('coverUv', () => {
  it('crops the sides of a wider image', () => {
    // 2:1 image in a 1:1 box: only the middle half is visible.
    expect(coverUv(0, 0.3, 1, 2)).toEqual([0.25, 0.3])
    expect(coverUv(1, 0.3, 1, 2)).toEqual([0.75, 0.3])
  })

  it('crops the top and bottom of a taller image', () => {
    // 1:2 image in a 1:1 box.
    expect(coverUv(0.4, 0, 1, 0.5)).toEqual([0.4, 0.25])
    expect(coverUv(0.4, 1, 1, 0.5)).toEqual([0.4, 0.75])
  })
})

describe('archFade', () => {
  it('is opaque down to 72% and fades to 0 at the bottom', () => {
    expect(archFade(0.5)).toBe(1)
    expect(archFade(0.86)).toBeCloseTo(0.5, 5)
    expect(archFade(1)).toBe(0)
  })
})

describe('colorArch', () => {
  it('reads the portrait through the cover crop and carries the fade in alpha', () => {
    const image = halfImage() // red left half, black (transparent) right half
    const uv = Float32Array.from([0.1, 0.5, 0.9, 0.5, 0.1, 0])
    const color = colorArch(uv, 1, image)
    expect(Array.from(color.slice(0, 4))).toEqual([1, 0, 0, 1])
    expect(color[4]).toBe(0) // right half is black
    expect(color[11]).toBe(0) // bottom edge (v = 0) is fully faded
  })

  it('falls back to a frosty gradient without an image', () => {
    const color = colorArch(Float32Array.from([0.5, 1]), 0.8, null)
    expect(color[2]).toBeCloseTo(1, 5) // blue channel at the top
  })
})

describe('pairByHeight', () => {
  it('matches the highest source with the highest target', () => {
    const source = Float32Array.from([0, 0.1, 0, 0.9, 0, 0.5])
    const target = Float32Array.from([1, 0.2, 2, 0.8, 3, 0.4])
    const paired = pairByHeight(source, target, seededRandom(1), 0)
    expect(Array.from(paired)).toEqual([1, 0.2, 2, 0.8, 3, 0.4].map((v) => Math.fround(v)))
    const reversed = Float32Array.from([0, 0.9, 0, 0.5, 0, 0.1])
    const paired2 = pairByHeight(reversed, target, seededRandom(1), 0)
    expect(Array.from(paired2)).toEqual([2, 0.8, 3, 0.4, 1, 0.2].map((v) => Math.fround(v)))
  })
})
