// The geometry of the project concertina: pure maths, no Three.js, so it can be
// unit-tested. Panels hang in a chain, each hinged to the next. One panel faces
// the viewer, its neighbours fold back beside it, and any panel further along is
// tucked away behind them, so the chain stays the same size however many projects
// it holds. Everything is driven by one number, `focus`: fractional while the fold
// travels between two panels, so a click, a drag and a spring all move the same
// mechanism.

export interface FoldPanel {
  x: number
  z: number
  /** Rotation around the vertical axis. Positive turns the panel's far edge away from the viewer. */
  yaw: number
}

export interface FoldOptions {
  count: number
  /** Which panel faces the viewer. */
  focus: number
  /** Angle of a folded panel, in radians. */
  fold: number
  /** Distance between two hinges. */
  link: number
  /** 0: shut, every panel steep (the fold before it unfolds on scroll). 1: open. */
  open?: number
  /** For each panel, 0..1: how far it is eased open toward the viewer (hover). */
  peek?: readonly number[]
}

/** Angle of every panel while the concertina is shut. */
export const SHUT_YAW = 1.42
/** Past a right angle: the panel doubles back behind the neighbour it hangs from. */
export const TUCK_YAW = 2.35
/** Share of a panel's fold that a full peek takes away. */
export const PEEK_OPENING = 0.08

/**
 * Yaw of a panel `distance` panels away from the focus: 0 at the focus, `fold`
 * beside it, then tucked behind, the far side mirroring the near one. Linear
 * between whole distances, which makes the two panels either side of a moving
 * focus open together, like the pages of a book, and the next one swing out from
 * behind.
 */
export function foldYaw(distance: number, fold: number): number {
  const reach = Math.abs(distance)
  const near = Math.floor(reach)
  const at = (steps: number) => (steps === 0 ? 0 : steps % 2 === 1 ? fold : TUCK_YAW)
  return Math.sign(distance) * (at(near) + (at(near + 1) - at(near)) * (reach - near))
}

/** Every panel's pose, in chain order, with the focused panel's centre at the origin. */
export function layoutFold({ count, focus, fold, link, open = 1, peek }: FoldOptions): FoldPanel[] {
  let edgeX = 0
  let edgeZ = 0
  const panels = Array.from({ length: count }, (_, index): FoldPanel => {
    const folded = foldYaw(index - focus, fold) * (1 - (peek?.[index] ?? 0) * PEEK_OPENING)
    const shut = index % 2 === 0 ? SHUT_YAW : -SHUT_YAW
    const yaw = shut + (folded - shut) * open
    const stepX = Math.cos(yaw) * link
    const stepZ = -Math.sin(yaw) * link
    const panel = { x: edgeX + stepX / 2, z: edgeZ + stepZ / 2, yaw }
    edgeX += stepX
    edgeZ += stepZ
    return panel
  })

  const held = Math.min(Math.max(focus, 0), count - 1)
  const from = Math.floor(held)
  const to = Math.min(count - 1, from + 1)
  const share = held - from
  const originX = panels[from].x + (panels[to].x - panels[from].x) * share
  const originZ = panels[from].z + (panels[to].z - panels[from].z) * share
  return panels.map((panel) => ({ ...panel, x: panel.x - originX, z: panel.z - originZ }))
}

/** Where a panel joins the next one in the chain. */
export function hingeAfter(panel: FoldPanel, link: number): { x: number; z: number } {
  return {
    x: panel.x + (Math.cos(panel.yaw) * link) / 2,
    z: panel.z - (Math.sin(panel.yaw) * link) / 2,
  }
}

export interface Point {
  x: number
  y: number
}

/** A four-cornered shape: top left, top right, bottom right, bottom left. */
export type Quad = readonly [Point, Point, Point, Point]

/**
 * The CSS `matrix3d` that lays a `width` x `height` box (transform-origin 0 0)
 * exactly over `quad`, perspective included. It is how the live demo, a DOM
 * iframe, sits on a panel drawn in WebGL. Null when the corners are degenerate.
 */
export function quadToMatrix3d(width: number, height: number, quad: Quad): string | null {
  const [p0, p1, p2, p3] = quad
  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const dy3 = p0.y - p1.y + p2.y - p3.y
  const denominator = dx1 * dy2 - dx2 * dy1
  if (Math.abs(denominator) < 1e-9 || width <= 0 || height <= 0) return null

  const g = (dx3 * dy2 - dx2 * dy3) / denominator
  const h = (dx1 * dy3 - dx3 * dy1) / denominator
  const a = p1.x - p0.x + g * p1.x
  const b = p3.x - p0.x + h * p3.x
  const d = p1.y - p0.y + g * p1.y
  const e = p3.y - p0.y + h * p3.y

  const values = [
    a / width, d / width, 0, g / width,
    b / height, e / height, 0, h / height,
    0, 0, 1, 0,
    p0.x, p0.y, 0, 1,
  ]
  return `matrix3d(${values.map((value) => Number(value.toFixed(8))).join(',')})`
}
