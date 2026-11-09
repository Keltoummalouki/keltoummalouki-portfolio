import { describe, expect, it } from 'vitest'
import { bezier, bezierTangent, easeIn, easeOut, pathLength, returnPath, takeoffPath, type V3 } from './flight'

const hover: V3 = [0.2, 0.3, 0.3]

describe('flight paths', () => {
  it('leaves from the hover point and ends far away, up and past the forward side', () => {
    const path = takeoffPath(hover, 1)
    expect(bezier(path, 0)).toEqual(hover)
    const end = bezier(path, 1)
    expect(end[0]).toBeGreaterThan(hover[0] + 5)
    expect(end[1]).toBeGreaterThan(hover[1] + 2)
    expect(end[2]).toBeLessThan(hover[2])
  })

  it('comes back from the other side and lands exactly where it left', () => {
    const path = returnPath(hover, 1)
    expect(bezier(path, 0)[0]).toBeLessThan(hover[0] - 5)
    const end = bezier(path, 1)
    end.forEach((value, i) => expect(value).toBeCloseTo(hover[i], 12))
  })

  it('leaves nose first and lands already on its hover heading, so neither end needs a turn', () => {
    const heading: V3 = [0.95, 0.22, 0.3]
    const unit = (v: V3) => v.map((c) => c / Math.hypot(...v)) as V3
    const out = unit(bezierTangent(takeoffPath(hover, 1), 0))
    expect(out[0]).toBeGreaterThan(0.8)
    const arrival = unit(bezierTangent(returnPath(hover, 1, heading), 1))
    unit(heading).forEach((value, i) => expect(arrival[i]).toBeCloseTo(value, 9))
  })

  it('mirrors for right-to-left pages', () => {
    const ltr = bezier(takeoffPath([0, 0, 0], 1), 0.6)
    const rtl = bezier(takeoffPath([0, 0, 0], -1), 0.6)
    expect(rtl[0]).toBeCloseTo(-ltr[0])
    expect(rtl[1]).toBeCloseTo(ltr[1])
    expect(rtl[2]).toBeCloseTo(ltr[2])
  })

  it('always has a direction of travel', () => {
    for (const path of [takeoffPath(hover, 1), returnPath(hover, -1)]) {
      for (let t = 0; t <= 1; t += 0.05) expect(Math.hypot(...bezierTangent(path, t))).toBeGreaterThan(0.1)
    }
  })

  it('measures a path', () => {
    const straight = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]] as const
    expect(pathLength(straight as unknown as Parameters<typeof pathLength>[0])).toBeCloseTo(3, 6)
  })
})

describe('easing', () => {
  it('runs from 0 to 1', () => {
    for (const ease of [easeIn, easeOut]) {
      expect(ease(0)).toBe(0)
      expect(ease(1)).toBe(1)
    }
    expect(easeIn(0.5)).toBeLessThan(0.5)
    expect(easeOut(0.5)).toBeGreaterThan(0.5)
  })
})
