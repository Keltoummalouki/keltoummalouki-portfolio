import { Color, ExtrudeGeometry, SRGBColorSpace, Shape, ShapeGeometry } from 'three'

// Small building blocks for the public Three.js scenes. Imported only by code
// that is itself loaded with import(), so three.js stays out of the page bundle.

/** Moves toward `target` and keeps its velocity when the target changes, so motion can be interrupted. */
export class Spring {
  value: number
  velocity = 0
  target: number
  constructor(
    value: number,
    private readonly stiffness = 120,
    private readonly damping = 18,
  ) {
    this.value = value
    this.target = value
  }
  step(dt: number) {
    const force = this.stiffness * (this.target - this.value) - this.damping * this.velocity
    this.velocity += force * dt
    this.value += this.velocity * dt
  }
  snap() {
    this.value = this.target
    this.velocity = 0
  }
  atRest(margin = 0.0005) {
    return Math.abs(this.target - this.value) < margin && Math.abs(this.velocity) < margin
  }
}

/** A CSS colour in any syntax, through the browser's own parser. */
export function readCssColor(value: string, fallback: string): Color {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return new Color(fallback)
  context.fillStyle = fallback
  if (value) context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace)
}

export function roundedRect(width: number, height: number, radius: number): Shape {
  const x = -width / 2
  const y = -height / 2
  const shape = new Shape()
  shape.moveTo(x + radius, y)
  shape.lineTo(x + width - radius, y)
  shape.absarc(x + width - radius, y + radius, radius, -Math.PI / 2, 0, false)
  shape.lineTo(x + width, y + height - radius)
  shape.absarc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2, false)
  shape.lineTo(x + radius, y + height)
  shape.absarc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI, false)
  shape.lineTo(x, y + radius)
  shape.absarc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5, false)
  return shape
}

/** A rounded rectangle facing +Z, with 0..1 UVs for a full-bleed texture. */
export function roundedPlane(width: number, height: number, radius: number) {
  const geometry = new ShapeGeometry(roundedRect(width, height, radius), 10)
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) + width / 2) / width, (position.getY(i) + height / 2) / height)
  }
  return geometry
}

/** A rounded, bevelled slab centred on the origin, its faces toward ±Z. */
export function slabGeometry(width: number, height: number, depth: number, radius: number, bevel: number) {
  const body = depth - bevel * 2
  const geometry = new ExtrudeGeometry(roundedRect(width - bevel * 2, height - bevel * 2, radius), {
    depth: body,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 10,
  })
  geometry.translate(0, 0, -body / 2)
  return geometry
}
