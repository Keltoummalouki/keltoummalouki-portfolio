// Pure voxel geometry for the /about page's 3D companion: which cells of Lucide's
// 24×24 grid an icon covers, where those cells sit in the scene, which cube flies
// where when the icon changes, and in what order. No DOM and no three.js, so it is
// unit-tested (voxels.test.ts); the browser-only rasterizing is in raster.ts.

/** Cells per side: one per Lucide unit, so a 2-unit stroke is two cubes thick. */
export const ICON_GRID = 24

/** Share of a cell the stroke must cover for that cell to become a cube. */
export const COVERAGE_THRESHOLD = 0.42

export interface Cell {
  readonly col: number
  readonly row: number
}

export interface Point {
  x: number
  y: number
  z: number
}

export interface Bounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/** The cells (row-major order) whose coverage, 0..1 per cell, reaches the threshold. */
export function cellsFromCoverage(coverage: ArrayLike<number>, size: number, threshold = COVERAGE_THRESHOLD): Cell[] {
  const cells: Cell[] = []
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (coverage[row * size + col] >= threshold) cells.push({ col, row })
    }
  }
  return cells
}

/**
 * Scene positions: one unit per cell, y up, centred on the grid (not on the shape),
 * so Lucide's optical centring is kept and a cell two icons share lands on the
 * same spot in both: its cube can stay put while the rest of the icon changes.
 */
export function centreCells(cells: readonly Cell[], size = ICON_GRID): Point[] {
  const middle = (size - 1) / 2
  return cells.map(({ col, row }) => ({ x: col - middle, y: middle - row, z: 0 }))
}

export function shapeBounds(points: ReadonlyArray<Point>): Bounds {
  const bounds: Bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  for (const { x, y } of points) {
    if (x < bounds.minX) bounds.minX = x
    if (x > bounds.maxX) bounds.maxX = x
    if (y < bounds.minY) bounds.minY = y
    if (y > bounds.maxY) bounds.maxY = y
  }
  return bounds
}

/**
 * Which cube builds which cell of the next shape. `from` holds each cube's current
 * position, or null for a cube that is not part of the shape on screen. The closest
 * pairs are matched first, so cubes already in place stay put and the others take
 * short trips; hidden cubes make up any shortfall. Returns, per cube, the index of
 * its target, or -1 for a cube the new shape does not need. Deterministic: ties go
 * to the lower cube, then the lower target.
 */
export function planMorph(from: ReadonlyArray<Point | null>, targets: ReadonlyArray<Point>): Int32Array {
  const plan = new Int32Array(from.length).fill(-1)
  const count = targets.length
  if (count === 0) return plan

  const visible: number[] = []
  from.forEach((point, index) => {
    if (point) visible.push(index)
  })

  const pairs = visible.length * count
  const distances = new Float64Array(pairs)
  const order = new Uint32Array(pairs)
  let pair = 0
  for (const cube of visible) {
    const a = from[cube] as Point
    for (let target = 0; target < count; target++) {
      const b = targets[target]
      distances[pair] = (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2
      order[pair] = pair
      pair++
    }
  }
  order.sort((p, q) => distances[p] - distances[q] || p - q)

  const taken = new Uint8Array(count)
  let remaining = count
  for (const next of order) {
    if (remaining === 0) break
    const cube = visible[Math.floor(next / count)]
    const target = next % count
    if (plan[cube] !== -1 || taken[target]) continue
    plan[cube] = target
    taken[target] = 1
    remaining--
  }

  let target = 0
  for (let cube = 0; cube < from.length && remaining > 0; cube++) {
    if (from[cube]) continue
    while (taken[target]) target++
    plan[cube] = target
    taken[target] = 1
    remaining--
  }
  return plan
}

/**
 * Start delays (seconds) that sweep across a shape in reading order, mostly from
 * the start edge and a little from the top, so a new icon writes itself instead of
 * popping in. Mirrored on right-to-left pages.
 */
export function sweepDelays(points: ReadonlyArray<Point>, spread: number, rtl = false): Float32Array {
  const delays = new Float32Array(points.length)
  if (points.length === 0) return delays
  const { minX, maxX, minY, maxY } = shapeBounds(points)
  const width = maxX - minX || 1
  const height = maxY - minY || 1
  points.forEach((point, index) => {
    const across = rtl ? (maxX - point.x) / width : (point.x - minX) / width
    const down = (maxY - point.y) / height
    delays[index] = spread * (across * 0.75 + down * 0.25)
  })
  return delays
}
