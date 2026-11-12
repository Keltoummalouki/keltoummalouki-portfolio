import { describe, expect, it } from 'vitest'
import {
  ICON_GRID,
  cellsFromCoverage,
  centreCells,
  planMorph,
  shapeBounds,
  sweepDelays,
  type Point,
} from './voxels'

const point = (x: number, y: number, z = 0): Point => ({ x, y, z })

/** Travel of every cube that has a target. */
function trips(from: ReadonlyArray<Point | null>, targets: Point[], plan: Int32Array) {
  return [...plan].flatMap((target, cube) => {
    if (target < 0) return []
    const start = from[cube]
    return [start ? Math.hypot(start.x - targets[target].x, start.y - targets[target].y) : null]
  })
}

describe('cellsFromCoverage', () => {
  it('keeps the cells at or above the threshold, in reading order', () => {
    // 3×3: a diagonal, one cell just under the threshold.
    const coverage = [1, 0, 0, 0, 0.5, 0.41, 0, 0, 0.42]
    expect(cellsFromCoverage(coverage, 3, 0.42)).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 1 },
      { col: 2, row: 2 },
    ])
  })

  it('returns nothing for an empty grid', () => {
    expect(cellsFromCoverage(new Float32Array(16), 4)).toEqual([])
  })
})

describe('centreCells', () => {
  it('centres on the grid, one unit per cell, y up', () => {
    const [topLeft, bottomRight] = centreCells([
      { col: 0, row: 0 },
      { col: ICON_GRID - 1, row: ICON_GRID - 1 },
    ])
    expect(topLeft).toEqual(point(-11.5, 11.5))
    expect(bottomRight).toEqual(point(11.5, -11.5))
  })

  it('puts a cell two shapes share on the same spot in both', () => {
    const a = centreCells([{ col: 4, row: 7 }, { col: 5, row: 7 }])
    const b = centreCells([{ col: 20, row: 2 }, { col: 4, row: 7 }])
    expect(b[1]).toEqual(a[0])
  })
})

describe('shapeBounds', () => {
  it('spans every point', () => {
    expect(shapeBounds([point(-2, 3), point(4, -1), point(0, 0)])).toEqual({ minX: -2, maxX: 4, minY: -1, maxY: 3 })
  })
})

describe('planMorph', () => {
  it('leaves every cube where it is when the shape does not change', () => {
    const shape = [point(0, 0), point(1, 0), point(5, 5), point(-3, 2)]
    const plan = planMorph(shape, shape)
    expect([...plan]).toEqual([0, 1, 2, 3])
  })

  it('keeps the cubes two shapes share in place and moves only the rest', () => {
    const from = [point(0, 0), point(1, 0), point(2, 0)]
    const targets = [point(2, 0), point(0, 0), point(1, 3)]
    const plan = planMorph(from, targets)
    expect(plan[0]).toBe(1)
    expect(plan[2]).toBe(0)
    expect(plan[1]).toBe(2)
    expect(trips(from, targets, plan)).toEqual([0, 3, 0])
  })

  it('gives every target exactly one cube and releases the cubes left over', () => {
    const from = [point(0, 0), point(9, 9), point(1, 1), point(-9, -9)]
    const targets = [point(1, 1), point(0, 0)]
    const plan = [...planMorph(from, targets)]
    expect(plan.filter((target) => target >= 0).sort()).toEqual([0, 1])
    expect(plan[1]).toBe(-1)
    expect(plan[3]).toBe(-1)
  })

  it('calls on hidden cubes when the new shape needs more', () => {
    const from = [point(0, 0), null, null, null]
    const targets = [point(0, 0), point(4, 0), point(8, 0)]
    const plan = [...planMorph(from, targets)]
    expect(plan[0]).toBe(0)
    expect(plan.slice(1).sort()).toEqual([-1, 1, 2])
    expect(new Set(plan.filter((target) => target >= 0)).size).toBe(3)
  })

  it('never hands one target to two cubes, even with too few cubes', () => {
    const from = [point(0, 0), null]
    const targets = [point(0, 0), point(1, 0), point(2, 0)]
    const plan = [...planMorph(from, targets)]
    expect(plan).toHaveLength(2)
    expect(new Set(plan).size).toBe(2)
    expect(plan.every((target) => target >= 0)).toBe(true)
  })

  it('handles an empty target shape', () => {
    expect([...planMorph([point(0, 0), null], [])]).toEqual([-1, -1])
  })

  it('is deterministic when distances tie', () => {
    const from = [point(-1, 0), point(1, 0)]
    const targets = [point(0, 0), point(0, 0.0)]
    expect([...planMorph(from, targets)]).toEqual([...planMorph(from, targets)])
    expect([...planMorph(from, targets)]).toEqual([0, 1])
  })
})

describe('sweepDelays', () => {
  const shape = [point(-4, 4), point(4, 4), point(-4, -4), point(4, -4)]

  it('starts at the top of the start edge and ends at the far bottom corner', () => {
    const delays = sweepDelays(shape, 0.4)
    expect(delays[0]).toBeCloseTo(0)
    expect(delays[1]).toBeCloseTo(0.3)
    expect(delays[2]).toBeCloseTo(0.1)
    expect(delays[3]).toBeCloseTo(0.4)
  })

  it('starts from the right on right-to-left pages', () => {
    const delays = sweepDelays(shape, 0.4, true)
    expect(delays[1]).toBeCloseTo(0)
    expect(delays[0]).toBeCloseTo(0.3)
  })

  it('copes with a single cube and with no cubes', () => {
    expect([...sweepDelays([point(2, 2)], 0.4)]).toEqual([0])
    expect(sweepDelays([], 0.4)).toHaveLength(0)
  })
})
