// The plane's flight: pure maths, no Three.js, so it can be unit-tested. Paths
// are cubic Béziers in world units (y up, the camera toward +z); `side` mirrors
// them for right-to-left pages, where "forward" is to the left.

export type V3 = [number, number, number]
export type Path = readonly [V3, V3, V3, V3]

export function bezier([a, b, c, d]: Path, t: number): V3 {
  const u = 1 - t
  const w0 = u * u * u
  const w1 = 3 * u * u * t
  const w2 = 3 * u * t * t
  const w3 = t * t * t
  return [
    w0 * a[0] + w1 * b[0] + w2 * c[0] + w3 * d[0],
    w0 * a[1] + w1 * b[1] + w2 * c[1] + w3 * d[1],
    w0 * a[2] + w1 * b[2] + w2 * c[2] + w3 * d[2],
  ]
}

/** The direction of travel (not normalized). */
export function bezierTangent([a, b, c, d]: Path, t: number): V3 {
  const u = 1 - t
  const w0 = 3 * u * u
  const w1 = 6 * u * t
  const w2 = 3 * t * t
  return [0, 1, 2].map((i) => w0 * (b[i] - a[i]) + w1 * (c[i] - b[i]) + w2 * (d[i] - c[i])) as V3
}

export const easeIn = (t: number) => t * t * t
export const easeOut = (t: number) => 1 - (1 - t) ** 3

/** Out: straight ahead with a small dip toward the viewer, then up and away past the far top corner. */
export function takeoffPath(from: V3, side: 1 | -1): Path {
  const [x, y, z] = from
  return [from, [x + 1 * side, y - 0.2, z + 0.35], [x + 2.8 * side, y + 0.5, z - 0.3], [x + 7.5 * side, y + 3.4, z - 5]]
}

/**
 * Back: in from the near side, high, then a glide down to where it left, arriving
 * along `heading` (the hover heading), so it settles without a turn.
 */
export function returnPath(to: V3, side: 1 | -1, heading: V3 = [0.95, 0.22, 0.3]): Path {
  const [x, y, z] = to
  const [hx, hy, hz] = heading
  const reach = 1.1 / Math.hypot(hx, hy, hz)
  return [
    [x - 7.5 * side, y + 2.6, z - 3.5],
    [x - 3.4 * side, y - 0.9, z + 1.4],
    [x - hx * reach * side, y - hy * reach, z - hz * reach],
    to,
  ]
}

/** How far along a path the plane travels in `seconds`, for spacing its trail by distance. */
export function pathLength(path: Path, steps = 48): number {
  let length = 0
  let previous = bezier(path, 0)
  for (let i = 1; i <= steps; i++) {
    const point = bezier(path, i / steps)
    length += Math.hypot(point[0] - previous[0], point[1] - previous[1], point[2] - previous[2])
    previous = point
  }
  return length
}
