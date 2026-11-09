import { describe, expect, it } from 'vitest'
import {
  FOLD_SCHEDULE,
  KEEL_CREASE,
  KEEL_OPEN,
  LAYER_GAP,
  PLANE_CREASES,
  SHEET_HALF_HEIGHT,
  SHEET_HALF_WIDTH,
  applyPose,
  composePoses,
  foldAngles,
  foldSheet,
  invertPose,
  planeFacets,
  poseFacets,
  rotationAbout,
  signedArea,
  splitConvex,
  type Point,
  type Vec3,
} from './fold'

const facets = planeFacets()

/** Every facet's corners in 3D, `progress` of the way to the plane. */
function posed(progress: number): Vec3[][] {
  const poses = poseFacets(facets, foldAngles(progress))
  return facets.map((facet, index) => facet.corners.map((corner) => applyPose(poses[index], [corner.x, corner.y, 0])))
}

/** Progress at which the keel crease is folded flat and the wings haven't started. */
const FLAT_IN_HALF = (FOLD_SCHEDULE[KEEL_CREASE][1] + FOLD_SCHEDULE[KEEL_CREASE + 1][0]) / 2

const close = (a: Vec3, b: Vec3, tolerance: number) =>
  Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance && Math.abs(a[2] - b[2]) <= tolerance

function centroid(points: readonly Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length }
}

/** Strictly inside a convex, counter-clockwise polygon. */
function inside(point: Point, polygon: readonly Point[]): boolean {
  return polygon.every((a, i) => {
    const b = polygon[(i + 1) % polygon.length]
    return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) > 1e-6
  })
}

describe('rigid motions', () => {
  it('turns around a line and leaves the line in place', () => {
    const quarter = rotationAbout([1, 0, 0], [0, 0, 1], Math.PI / 2)
    expect(applyPose(quarter, [1, 0, 0])).toEqual([1, 0, 0])
    const turned = applyPose(quarter, [2, 0, 0])
    expect(turned[0]).toBeCloseTo(1)
    expect(turned[1]).toBeCloseTo(1)
  })

  it('composes and inverts', () => {
    const a = rotationAbout([0.3, -1, 0.2], [0, 0.6, 0.8], 1.1)
    const b = rotationAbout([1, 2, 3], [1, 0, 0], -0.4)
    const point: Vec3 = [0.5, -0.25, 2]
    const there = applyPose(composePoses(a, b), point)
    expect(close(there, applyPose(a, applyPose(b, point)), 1e-12)).toBe(true)
    expect(close(applyPose(invertPose(composePoses(a, b)), there), point, 1e-12)).toBe(true)
  })
})

describe('splitConvex', () => {
  const square: Point[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]

  it('cuts along a diagonal into two halves', () => {
    const [left, right] = splitConvex(square, { x: 0, y: 0 }, { x: 1, y: 1 })
    expect(Math.abs(signedArea(left!))).toBeCloseTo(1)
    expect(Math.abs(signedArea(right!))).toBeCloseTo(1)
  })

  it('leaves a polygon whole when the line misses it or runs along its edge', () => {
    const [near, far] = splitConvex(square, { x: 2, y: 0 }, { x: 2, y: 1 })
    expect(near).toEqual(square)
    expect(far).toBeNull()
    const [inner, outer] = splitConvex(square, { x: 0, y: 0 }, { x: 0, y: 1 })
    expect(inner === null || outer === null).toBe(true)
  })
})

describe('cutting the sheet', () => {
  it('tiles the sheet with convex, counter-clockwise facets', () => {
    const total = facets.reduce((sum, facet) => sum + signedArea(facet.corners) / 2, 0)
    expect(total).toBeCloseTo(4 * SHEET_HALF_WIDTH * SHEET_HALF_HEIGHT, 9)
    for (const { corners } of facets) {
      expect(signedArea(corners)).toBeGreaterThan(0)
      corners.forEach((a, i) => {
        const b = corners[(i + 1) % corners.length]
        const c = corners[(i + 2) % corners.length]
        expect((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)).toBeGreaterThan(-1e-9)
      })
    }
  })

  it('gives every facet one hinge slot per crease', () => {
    for (const facet of facets) expect(facet.hinges).toHaveLength(PLANE_CREASES.length)
  })

  it('only lets the last crease stop short of flat', () => {
    const creases = [{ ...PLANE_CREASES[0], angle: 1 }, PLANE_CREASES[1]]
    expect(() => foldSheet(creases)).toThrow()
  })
})

describe('folding', () => {
  it('starts as the flat letter', () => {
    posed(0).forEach((corners, index) => {
      corners.forEach((corner, j) => {
        const { x, y } = facets[index].corners[j]
        expect(close(corner, [x, y, 0], 1e-12)).toBe(true)
      })
    })
  })

  it('never tears the paper: shared corners stay together, all the way', () => {
    // Up to a few paper thicknesses at a hinge, where a layer turns around a lifted axis.
    const tolerance = 32 * LAYER_GAP
    const shared: [number, number, number, number][] = []
    facets.forEach((a, i) =>
      facets.forEach((b, j) => {
        if (j <= i) return
        a.corners.forEach((ca, k) =>
          b.corners.forEach((cb, l) => {
            if (Math.abs(ca.x - cb.x) < 1e-7 && Math.abs(ca.y - cb.y) < 1e-7) shared.push([i, k, j, l])
          }),
        )
      }),
    )
    expect(shared.length).toBeGreaterThan(20)
    for (let progress = 0; progress <= 1.0001; progress += 0.05) {
      const corners = posed(progress)
      for (const [i, k, j, l] of shared) expect(close(corners[i][k], corners[j][l], tolerance)).toBe(true)
    }
  })

  it('stacks layers instead of merging them', () => {
    const corners = posed(FLAT_IN_HALF)
    const flat = corners.map((points) => points.map(([x, y]) => ({ x, y })))
    const heights = corners.map((points) => points[0][2])
    corners.forEach((points, index) => points.forEach(([, , z]) => expect(z).toBeCloseTo(heights[index], 9)))

    let overlaps = 0
    flat.forEach((a, i) =>
      flat.forEach((b, j) => {
        if (i === j || !inside(centroid(a), b)) return
        overlaps++
        expect(Math.abs(heights[i] - heights[j])).toBeGreaterThan(LAYER_GAP * 0.99)
      }),
    )
    expect(overlaps).toBeGreaterThan(0)
  })

  it('folds the flaps inside the body: the half that turned lies on top of the other', () => {
    const heights = posed(FLAT_IN_HALF).map((points) => points[0][2])
    const turned = facets.map((facet) => facet.hinges[KEEL_CREASE] !== null)
    const top = heights.filter((_, index) => turned[index])
    const bottom = heights.filter((_, index) => !turned[index])
    expect(Math.min(...top)).toBeGreaterThan(Math.max(...bottom))
  })

  it('ends as a plane: as long as the sheet, narrow, with a wing on each side', () => {
    const points = posed(1).flat()
    const span = (axis: 0 | 1 | 2) => [Math.min(...points.map((p) => p[axis])), Math.max(...points.map((p) => p[axis]))]
    const [minX, maxX] = span(0)
    const [minY, maxY] = span(1)
    const [minZ, maxZ] = span(2)
    // The wing hinge runs at a slant, so the wingtips swing a little aft as they fold.
    expect(maxY - minY).toBeGreaterThan(2 * SHEET_HALF_HEIGHT - 0.01)
    expect(maxY - minY).toBeLessThan(2 * SHEET_HALF_HEIGHT + 0.12)
    expect(maxX - minX).toBeLessThan(0.75)
    expect(maxZ).toBeGreaterThan(0.4)
    expect(minZ).toBeLessThan(-0.4)
  })
})

describe('timing', () => {
  it('runs from the flat sheet to the folded plane', () => {
    expect(foldAngles(0).every((angle) => angle === 0)).toBe(true)
    const final = foldAngles(1)
    PLANE_CREASES.forEach((crease, index) => {
      expect(final[index]).toBeCloseTo(index === KEEL_CREASE ? crease.angle - KEEL_OPEN : crease.angle)
    })
  })

  it('turns each crease only once the creases it is drawn over are down', () => {
    const ends = (index: number) => FOLD_SCHEDULE[index][1]
    const starts = (index: number) => FOLD_SCHEDULE[index][0]
    expect(starts(2)).toBeGreaterThanOrEqual(ends(0))
    expect(starts(3)).toBeGreaterThanOrEqual(ends(1))
    expect(starts(4)).toBeGreaterThanOrEqual(Math.max(ends(2), ends(3)))
    expect(starts(5)).toBeGreaterThanOrEqual(ends(4))
  })

  it('never turns a crease backwards on the way to the plane, except the keel opening at the end', () => {
    let previous = foldAngles(0)
    for (let progress = 0.01; progress <= 1.0001; progress += 0.01) {
      const angles = foldAngles(progress)
      angles.forEach((angle, index) => {
        if (index === KEEL_CREASE && progress > 0.85) return
        expect(angle).toBeGreaterThanOrEqual(previous[index] - 1e-12)
      })
      previous = angles
    }
  })
})
