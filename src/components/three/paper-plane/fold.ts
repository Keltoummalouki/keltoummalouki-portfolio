// The paper plane's folds: pure geometry, no Three.js, so it can be unit-tested.
//
// A sheet (A-series proportions, its top edge toward +y) is folded one crease at
// a time, the way a dart is folded by hand: the top corners to the centre line,
// the new edges to the centre line again, in half, then a wing down each side.
// Each crease is drawn on the flat sheet left by the creases before it.
//
// `foldSheet` cuts the sheet into convex facets along every crease and records,
// for each facet, the hinges it turns around. `poseFacets` then turns each facet
// around its hinges in order, by any angles: partial angles are the animation,
// and reversing them unfolds. A hinge follows the facet's earlier turns, so the
// angles of earlier creases need not be at their final values either.
//
// Layers never share a plane: a crease turns around an axis lifted a hair above
// the paper it carries, so a folded flap lands just on top of what it covers,
// like real paper with a thickness.

export interface Point {
  x: number
  y: number
}

export type Vec3 = [number, number, number]

/** A rigid motion: rotate by `r` (3×3, row-major), then move by `t`. */
export interface Pose {
  r: number[]
  t: Vec3
}

export interface Crease {
  /** Two points on the crease, on the flat sheet left by the earlier creases. */
  from: Point
  to: Point
  /** Any point on the side that turns. */
  turning: Point
  /** Final angle, in radians. Every crease but the last folds flat (π). */
  angle: number
  /** The way the turning side lifts: +1 toward the viewer (+z), -1 away. */
  lift: 1 | -1
  /** What this earlier crease turned lifts the other way: the wings, opening on each side of the body. */
  oppositeFor?: number
}

export interface Hinge {
  /** A point on the crease, in the facet's own sheet coordinates. */
  point: Vec3
  /** The crease's direction, oriented so that a positive angle lifts the facet its crease's way. */
  axis: Vec3
}

export interface Facet {
  /** Corners on the flat sheet, counter-clockwise seen from +z (the letter's side). */
  corners: Point[]
  /** One per crease: how this facet turns around it, or null where it stays put. */
  hinges: (Hinge | null)[]
}

export const SHEET_HALF_WIDTH = 1
export const SHEET_HALF_HEIGHT = Math.SQRT2
/** How far apart stacked layers sit: a paper's thickness, in sheet units. */
export const LAYER_GAP = 0.0012
/** Depth of the body at the tail, under the wings. */
export const KEEL_DEPTH = 0.42
export const WING_ANGLE = Math.PI / 2 - 0.12
/** The body opens by this much at the end, so the plane rides on a V rather than a blade. */
export const KEEL_OPEN = 0.3
/** The crease that folds the plane in half. */
export const KEEL_CREASE = 4

const W = SHEET_HALF_WIDTH
const H = SHEET_HALF_HEIGHT
/** tan(22.5°) is what lays the 45° edge left by the first creases onto the centre line. */
const EDGE_DROP = W / Math.tan(Math.PI / 8)

export const PLANE_CREASES: readonly Crease[] = [
  // The top corners to the centre line.
  { from: { x: 0, y: H }, to: { x: -W, y: H - W }, turning: { x: -W, y: H }, angle: Math.PI, lift: 1 },
  { from: { x: 0, y: H }, to: { x: W, y: H - W }, turning: { x: W, y: H }, angle: Math.PI, lift: 1 },
  // The new slanted edges to the centre line, flaps and all.
  { from: { x: 0, y: H }, to: { x: -W, y: H - EDGE_DROP }, turning: { x: -W, y: 0 }, angle: Math.PI, lift: 1 },
  { from: { x: 0, y: H }, to: { x: W, y: H - EDGE_DROP }, turning: { x: W, y: 0 }, angle: Math.PI, lift: 1 },
  // In half, toward the viewer: the flaps end up inside.
  { from: { x: 0, y: -H }, to: { x: 0, y: H }, turning: { x: -W, y: 0 }, angle: Math.PI, lift: 1 },
  // A wing down each side of the body, from the nose to the tail.
  {
    from: { x: 0, y: H },
    to: { x: KEEL_DEPTH, y: -H },
    turning: { x: W, y: -H },
    angle: WING_ANGLE,
    lift: -1,
    oppositeFor: KEEL_CREASE,
  },
]

/** When each crease turns, as a share of the whole fold. Corners and edges go in pairs, a beat apart. */
export const FOLD_SCHEDULE: readonly (readonly [number, number])[] = [
  [0, 0.2],
  [0.05, 0.25],
  [0.27, 0.47],
  [0.32, 0.52],
  [0.55, 0.77],
  [0.8, 1],
]
const KEEL_OPEN_SCHEDULE = [0.86, 1] as const

// ── Rigid motions ──────────────────────────────────────────────────────────────

export const IDENTITY: Pose = { r: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] }

export function rotateVector(pose: Pose, [x, y, z]: Vec3): Vec3 {
  const r = pose.r
  return [r[0] * x + r[1] * y + r[2] * z, r[3] * x + r[4] * y + r[5] * z, r[6] * x + r[7] * y + r[8] * z]
}

export function applyPose(pose: Pose, v: Vec3): Vec3 {
  const [x, y, z] = rotateVector(pose, v)
  return [x + pose.t[0], y + pose.t[1], z + pose.t[2]]
}

/** `a` after `b`. */
export function composePoses(a: Pose, b: Pose): Pose {
  const r = new Array<number>(9)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      r[row * 3 + col] = a.r[row * 3] * b.r[col] + a.r[row * 3 + 1] * b.r[3 + col] + a.r[row * 3 + 2] * b.r[6 + col]
    }
  }
  return { r, t: applyPose(a, b.t) }
}

export function invertPose(pose: Pose): Pose {
  const r = pose.r
  const transposed = [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]]
  const t = rotateVector({ r: transposed, t: [0, 0, 0] }, pose.t)
  return { r: transposed, t: [-t[0], -t[1], -t[2]] }
}

/** A turn by `angle` around the line through `point` along the unit vector `axis` (right-hand rule). */
export function rotationAbout(point: Vec3, axis: Vec3, angle: number): Pose {
  const [x, y, z] = axis
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const k = 1 - c
  const r = [
    c + x * x * k, x * y * k - z * s, x * z * k + y * s,
    y * x * k + z * s, c + y * y * k, y * z * k - x * s,
    z * x * k - y * s, z * y * k + x * s, c + z * z * k,
  ]
  const turned = rotateVector({ r, t: [0, 0, 0] }, point)
  return { r, t: [point[0] - turned[0], point[1] - turned[1], point[2] - turned[2]] }
}

// ── Polygons ───────────────────────────────────────────────────────────────────

const EPSILON = 1e-9

/** Twice the signed area: positive when counter-clockwise. */
export function signedArea(points: readonly Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return sum
}

/** Which side of the line through `from` and `to` a point lies on (scaled distance; 0 on the line). */
function sideOf(from: Point, to: Point, point: Point): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return (dx * (point.y - from.y) - dy * (point.x - from.x)) / Math.hypot(dx, dy)
}

/** Cuts a convex polygon along a line: [the positive side, the negative side]; null where nothing is left. */
export function splitConvex(polygon: readonly Point[], from: Point, to: Point): [Point[] | null, Point[] | null] {
  const positive: Point[] = []
  const negative: Point[] = []
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const sa = sideOf(from, to, a)
    const sb = sideOf(from, to, b)
    if (sa >= -EPSILON) positive.push(a)
    if (sa <= EPSILON) negative.push(a)
    if ((sa > EPSILON && sb < -EPSILON) || (sa < -EPSILON && sb > EPSILON)) {
      const t = sa / (sa - sb)
      const cut = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      positive.push(cut)
      negative.push(cut)
    }
  }
  const keep = (piece: Point[]) => (piece.length >= 3 && Math.abs(signedArea(piece)) > 1e-10 ? piece : null)
  return [keep(positive), keep(negative)]
}

// ── Folding ────────────────────────────────────────────────────────────────────

interface Building {
  corners: Point[]
  /** Where the facet lies once every crease so far is folded flat. */
  flat: Pose
  hinges: (Hinge | null)[]
}

/**
 * Cuts the sheet along every crease and works out each facet's hinges. Throws on
 * a crease that doesn't fold flat unless it is the last one: every crease is
 * drawn on a flat sheet.
 */
export function foldSheet(creases: readonly Crease[] = PLANE_CREASES, layerGap = LAYER_GAP): Facet[] {
  let facets: Building[] = [
    {
      corners: [
        { x: -W, y: -H },
        { x: W, y: -H },
        { x: W, y: H },
        { x: -W, y: H },
      ],
      flat: IDENTITY,
      hinges: [],
    },
  ]

  creases.forEach((crease, index) => {
    const flatFold = Math.abs(crease.angle - Math.PI) < 1e-9
    if (!flatFold && index !== creases.length - 1) throw new Error('Only the last crease may stop short of flat')

    const turningSign = Math.sign(sideOf(crease.from, crease.to, crease.turning))
    const pieces: { corners: Point[]; source: Building; z: number; turns: boolean }[] = []
    for (const facet of facets) {
      const placed = facet.corners.map((corner) => applyPose(facet.flat, [corner.x, corner.y, 0]))
      const z = placed[0][2]
      const back = invertPose(facet.flat)
      const [positive, negative] = splitConvex(
        placed.map(([x, y]) => ({ x, y })),
        crease.from,
        crease.to,
      )
      for (const [piece, sign] of [
        [positive, 1],
        [negative, -1],
      ] as const) {
        if (!piece) continue
        let corners = piece.map(({ x, y }) => {
          const [u, v] = applyPose(back, [x, y, z])
          return { x: u, y: v }
        })
        if (signedArea(corners) < 0) corners = corners.reverse()
        pieces.push({ corners, source: facet, z, turns: sign === turningSign })
      }
    }

    const liftOf = (source: Building) =>
      crease.oppositeFor !== undefined && source.hinges[crease.oppositeFor] ? -crease.lift : crease.lift
    // A flat fold turns around an axis a hair beyond the layers it carries, so they land
    // stacked on top of the paper they cover (in this plane, nothing under the landing
    // spot is thicker than what turns: fold.test.ts checks it). The last fold hinges each
    // side at its outer layer.
    const heightFor = (lift: number) => {
      const group = pieces.filter((piece) => piece.turns && liftOf(piece.source) === lift).map((piece) => piece.z)
      if (group.length === 0) return 0
      const gap = flatFold ? layerGap : 0
      return lift > 0 ? Math.max(...group) + gap : Math.min(...group) - gap
    }
    const heights = new Map([1, -1].map((lift) => [lift, heightFor(lift)]))

    const dx = crease.to.x - crease.from.x
    const dy = crease.to.y - crease.from.y
    const length = Math.hypot(dx, dy)

    facets = pieces.map(({ corners, source, turns }) => {
      if (!turns) return { corners, flat: source.flat, hinges: [...source.hinges, null] }
      const lift = liftOf(source)
      const point: Vec3 = [crease.from.x, crease.from.y, heights.get(lift) ?? 0]
      let axis: Vec3 = [dx / length, dy / length, 0]
      // A positive turn must lift the turning side toward `lift`.
      const reach = { x: crease.turning.x - crease.from.x, y: crease.turning.y - crease.from.y }
      if (Math.sign(axis[0] * reach.y - axis[1] * reach.x) !== lift) axis = [-axis[0], -axis[1], 0]
      const back = invertPose(source.flat)
      const hinge: Hinge = { point: applyPose(back, point), axis: rotateVector(back, axis) }
      const flat = flatFold ? composePoses(rotationAbout(point, axis, Math.PI), source.flat) : source.flat
      return { corners, flat, hinges: [...source.hinges, hinge] }
    })
  })

  return facets.map(({ corners, hinges }) => ({ corners, hinges }))
}

/** Where each facet is, with each crease turned by its angle. */
export function poseFacets(facets: readonly Facet[], angles: readonly number[]): Pose[] {
  return facets.map((facet) => {
    let pose = IDENTITY
    facet.hinges.forEach((hinge, index) => {
      const angle = angles[index] ?? 0
      if (!hinge || angle === 0) return
      const point = applyPose(pose, hinge.point)
      const axis = rotateVector(pose, hinge.axis)
      pose = composePoses(rotationAbout(point, axis, angle), pose)
    })
    return pose
  })
}

// ── Timing ─────────────────────────────────────────────────────────────────────

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** How far through [start, end] `value` is, 0..1. */
export function segment(value: number, start: number, end: number): number {
  return clamp01((value - start) / (end - start))
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** Every crease's angle at `progress` (0: the flat letter, 1: the plane). Decreasing it unfolds. */
export function foldAngles(progress: number, creases: readonly Crease[] = PLANE_CREASES): number[] {
  const p = clamp01(progress)
  return creases.map((crease, index) => {
    const [start, end] = FOLD_SCHEDULE[index] ?? [0, 1]
    let angle = crease.angle * easeInOut(segment(p, start, end))
    if (index === KEEL_CREASE) angle -= KEEL_OPEN * easeInOut(segment(p, KEEL_OPEN_SCHEDULE[0], KEEL_OPEN_SCHEDULE[1]))
    return angle
  })
}

let plane: Facet[] | null = null

/** The plane's facets, cut once. */
export function planeFacets(): Facet[] {
  plane ??= foldSheet(PLANE_CREASES)
  return plane
}
