import { describe, expect, it } from 'vitest'
import { TUCK_YAW, foldYaw, hingeAfter, layoutFold, quadToMatrix3d, type Quad } from './layout'

const FOLD = 1
const LINK = 3

describe('foldYaw', () => {
  it('leaves the focused panel flat', () => {
    expect(foldYaw(0, FOLD)).toBeCloseTo(0)
  })

  it('folds the neighbours back and tucks the rest behind, on both sides', () => {
    expect(foldYaw(1, FOLD)).toBeCloseTo(FOLD)
    expect(foldYaw(2, FOLD)).toBeCloseTo(TUCK_YAW)
    expect(foldYaw(3, FOLD)).toBeCloseTo(FOLD)
    expect(foldYaw(-1, FOLD)).toBeCloseTo(-FOLD)
    expect(foldYaw(-2, FOLD)).toBeCloseTo(-TUCK_YAW)
  })

  it('moves continuously as the focus travels, through flat at the focus', () => {
    expect(foldYaw(0.5, FOLD)).toBeCloseTo(FOLD / 2)
    expect(foldYaw(-0.5, FOLD)).toBeCloseTo(-FOLD / 2)
    expect(foldYaw(1.5, FOLD)).toBeCloseTo((FOLD + TUCK_YAW) / 2)
    expect(foldYaw(0.01, FOLD)).toBeCloseTo(0.01)
    expect(foldYaw(-0.01, FOLD)).toBeCloseTo(-0.01)
  })
})

describe('layoutFold', () => {
  it('centres the focused panel, facing the viewer', () => {
    for (const focus of [0, 1, 2]) {
      const panel = layoutFold({ count: 3, focus, fold: FOLD, link: LINK })[focus]
      expect(panel.x).toBeCloseTo(0)
      expect(panel.z).toBeCloseTo(0)
      expect(panel.yaw).toBeCloseTo(0)
    }
  })

  it('keeps the chain joined at every hinge, at any point of a move', () => {
    for (const options of [
      { focus: 0 },
      { focus: 0.37 },
      { focus: 1.5 },
      { focus: 2 },
      { focus: 1, open: 0.4 },
      { focus: 1, open: 0 },
      { focus: 0, peek: [0, 1, 0, 0.5] },
    ]) {
      const panels = layoutFold({ count: 4, fold: FOLD, link: LINK, ...options })
      for (let index = 0; index < panels.length - 1; index++) {
        const hinge = hingeAfter(panels[index], LINK)
        const next = panels[index + 1]
        expect(next.x - (Math.cos(next.yaw) * LINK) / 2).toBeCloseTo(hinge.x)
        expect(next.z + (Math.sin(next.yaw) * LINK) / 2).toBeCloseTo(hinge.z)
      }
    }
  })

  it('folds the neighbours back, behind the focused panel', () => {
    const [left, centre, right] = layoutFold({ count: 3, focus: 1, fold: FOLD, link: LINK })
    expect(left.z).toBeLessThan(centre.z)
    expect(right.z).toBeLessThan(centre.z)
    expect(left.x).toBeLessThan(centre.x)
    expect(right.x).toBeGreaterThan(centre.x)
  })

  it('keeps the chain the same width however many projects it holds', () => {
    const reach = (count: number) =>
      Math.max(...layoutFold({ count, focus: 0, fold: FOLD, link: LINK }).map((panel) => Math.abs(panel.x)))
    expect(reach(8)).toBeCloseTo(reach(3))
  })

  it('is shut at open 0 and leaves no panel flat', () => {
    for (const panel of layoutFold({ count: 3, focus: 1, fold: FOLD, link: LINK, open: 0 })) {
      expect(Math.abs(panel.yaw)).toBeGreaterThan(1.3)
    }
  })

  it('eases a peeked panel toward the viewer without moving the focused one', () => {
    const rest = layoutFold({ count: 3, focus: 0, fold: FOLD, link: LINK })
    const peeked = layoutFold({ count: 3, focus: 0, fold: FOLD, link: LINK, peek: [0, 1, 0] })
    expect(Math.abs(peeked[1].yaw)).toBeLessThan(Math.abs(rest[1].yaw))
    expect(peeked[0].x).toBeCloseTo(rest[0].x)
    expect(peeked[0].yaw).toBeCloseTo(rest[0].yaw)
  })

  it('handles a single panel, and a focus overshooting the ends', () => {
    expect(layoutFold({ count: 1, focus: 0, fold: FOLD, link: LINK })[0]).toEqual({ x: 0, z: 0, yaw: 0 })
    for (const focus of [-0.2, 2.2]) {
      for (const panel of layoutFold({ count: 3, focus, fold: FOLD, link: LINK })) {
        expect(Number.isFinite(panel.x)).toBe(true)
        expect(Number.isFinite(panel.z)).toBe(true)
      }
    }
  })
})

describe('quadToMatrix3d', () => {
  /** Applies a CSS matrix3d (column-major) to a point of the box. */
  const apply = (matrix: string, x: number, y: number) => {
    const m = matrix.slice('matrix3d('.length, -1).split(',').map(Number)
    const w = m[3] * x + m[7] * y + m[15]
    return { x: (m[0] * x + m[4] * y + m[12]) / w, y: (m[1] * x + m[5] * y + m[13]) / w }
  }

  const expectMaps = (quad: Quad) => {
    const matrix = quadToMatrix3d(1440, 900, quad)
    expect(matrix).not.toBeNull()
    const corners = [[0, 0], [1440, 0], [1440, 900], [0, 900]] as const
    corners.forEach(([x, y], index) => {
      const mapped = apply(matrix!, x, y)
      expect(mapped.x).toBeCloseTo(quad[index].x, 2)
      expect(mapped.y).toBeCloseTo(quad[index].y, 2)
    })
  }

  it('maps each corner of the box onto the quad', () => {
    expectMaps([{ x: 10, y: 20 }, { x: 610, y: 20 }, { x: 610, y: 395 }, { x: 10, y: 395 }])
  })

  it('handles perspective', () => {
    expectMaps([{ x: 12, y: 30 }, { x: 590, y: 12 }, { x: 604, y: 402 }, { x: 4, y: 370 }])
  })

  it('refuses degenerate corners', () => {
    const point = { x: 5, y: 5 }
    expect(quadToMatrix3d(1440, 900, [point, point, point, point])).toBeNull()
  })
})
