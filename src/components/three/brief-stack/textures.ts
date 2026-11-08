import type { ProjectType } from '@/features/freelance/brief'

// Everything the model shows is drawn here on 2D canvases: no image to load and
// no origin to allow in the CSP. The interface layer's screens are wordless
// wireframes, so they need no translation and read at any size.

export type ScreenId = ProjectType | 'blank' | 'sent'

export interface ScreenColors {
  bg: string
  panel: string
  raised: string
  line: string
  ink: string
  muted: string
  accent: string
  /** The accent at low opacity, for flat tinted areas. */
  accentSoft: string
}

export const SCREEN_WIDTH = 1024
export const SCREEN_HEIGHT = 692

/** How the screen is seen: its turn around the vertical, and sin(camera elevation). */
export interface ScreenView {
  yaw: number
  lift: number
}

type Ctx = CanvasRenderingContext2D

function box(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
  c.fillStyle = fill
  c.fill()
}

function dot(c: Ctx, x: number, y: number, r: number, fill: string) {
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fillStyle = fill
  c.fill()
}

/** A browser window's top bar: every screen is a page of the visitor's future project. */
function windowBar(c: Ctx, k: ScreenColors) {
  box(c, 0, 0, SCREEN_WIDTH, 62, 0, k.panel)
  dot(c, 38, 31, 9, k.muted)
  dot(c, 68, 31, 9, k.muted)
  dot(c, 98, 31, 9, k.muted)
  box(c, 300, 16, 424, 30, 15, k.raised)
}

function webApp(c: Ctx, k: ScreenColors) {
  // Sidebar
  box(c, 0, 62, 188, SCREEN_HEIGHT - 62, 0, k.panel)
  box(c, 28, 92, 40, 40, 12, k.accent)
  box(c, 80, 104, 76, 16, 8, k.muted)
  for (let i = 0; i < 6; i++) {
    const y = 164 + i * 58
    if (i === 0) box(c, 16, y - 12, 156, 44, 14, k.raised)
    dot(c, 42, y + 10, 9, i === 0 ? k.accent : k.muted)
    box(c, 64, y + 3, i % 2 ? 84 : 66, 14, 7, i === 0 ? k.ink : k.muted)
  }

  // Three figures
  for (let i = 0; i < 3; i++) {
    const x = 212 + i * 268
    box(c, x, 86, 252, 118, 18, k.panel)
    box(c, x + 22, 108, 92, 13, 6, k.muted)
    box(c, x + 22, 136, 128, 34, 10, k.ink)
    box(c, x + 176, 134, 54, 38, 12, i === 0 ? k.accent : k.raised)
  }

  // Chart
  box(c, 212, 222, 788, 290, 18, k.panel)
  const points = [0.72, 0.6, 0.66, 0.42, 0.5, 0.3, 0.38, 0.16, 0.24, 0.1]
  const left = 240
  const width = 732
  const top = 252
  const height = 228
  const at = (i: number): [number, number] => [left + (i / (points.length - 1)) * width, top + points[i] * height]
  c.beginPath()
  c.moveTo(...at(0))
  for (let i = 1; i < points.length; i++) c.lineTo(...at(i))
  c.lineTo(left + width, top + height)
  c.lineTo(left, top + height)
  c.closePath()
  c.fillStyle = k.accentSoft
  c.fill()
  c.beginPath()
  c.moveTo(...at(0))
  for (let i = 1; i < points.length; i++) c.lineTo(...at(i))
  c.strokeStyle = k.accent
  c.lineWidth = 7
  c.lineJoin = 'round'
  c.stroke()
  dot(c, ...at(7), 11, k.ink)

  // Table
  box(c, 212, 530, 788, 142, 18, k.panel)
  for (let i = 0; i < 3; i++) {
    const y = 548 + i * 40
    dot(c, 244, y + 12, 11, i === 0 ? k.accent : k.muted)
    box(c, 272, y + 5, 220, 14, 7, k.muted)
    box(c, 528, y + 5, 150, 14, 7, k.line)
    box(c, 880, y, 96, 24, 12, i === 0 ? k.accent : k.raised)
  }
}

function website(c: Ctx, k: ScreenColors) {
  // Navigation
  box(c, 44, 92, 44, 44, 13, k.accent)
  for (let i = 0; i < 3; i++) box(c, 560 + i * 104, 106, 80, 16, 8, k.muted)
  box(c, 880, 96, 100, 36, 18, k.accent)

  // Headline, text and buttons
  box(c, 44, 186, 420, 54, 14, k.ink)
  box(c, 44, 254, 330, 54, 14, k.ink)
  box(c, 44, 330, 398, 14, 7, k.muted)
  box(c, 44, 358, 350, 14, 7, k.muted)
  box(c, 44, 406, 170, 54, 27, k.accent)
  box(c, 230, 406, 150, 54, 27, k.raised)

  // Picture
  box(c, 520, 170, 460, 300, 26, k.accent)
  dot(c, 880, 244, 34, 'rgba(255,255,255,0.85)')
  c.beginPath()
  c.moveTo(556, 442)
  c.lineTo(690, 288)
  c.lineTo(778, 386)
  c.lineTo(830, 330)
  c.lineTo(944, 442)
  c.closePath()
  c.fillStyle = 'rgba(255,255,255,0.4)'
  c.fill()

  // Three features
  for (let i = 0; i < 3; i++) {
    const x = 44 + i * 318
    box(c, x, 506, 298, 160, 20, k.panel)
    dot(c, x + 42, 548, 20, k.accent)
    box(c, x + 24, 588, 200, 16, 8, k.ink)
    box(c, x + 24, 618, 240, 12, 6, k.muted)
  }
}

function ecommerce(c: Ctx, k: ScreenColors) {
  // Search and cart
  box(c, 44, 88, 720, 50, 25, k.panel)
  dot(c, 80, 113, 11, k.muted)
  box(c, 106, 106, 200, 14, 7, k.muted)
  box(c, 790, 88, 190, 50, 25, k.accent)
  dot(c, 944, 113, 14, '#FFFFFF')
  box(c, 816, 106, 96, 14, 7, 'rgba(255,255,255,0.9)')

  // Products
  for (let i = 0; i < 6; i++) {
    const tint = i % 2 === 0 ? k.accent : k.muted
    const x = 44 + (i % 3) * 318
    const y = 158 + Math.floor(i / 3) * 262
    box(c, x, y, 298, 246, 20, k.panel)
    box(c, x + 14, y + 14, 270, 128, 14, k.raised)
    if (i % 3 === 0) dot(c, x + 149, y + 78, 40, tint)
    else if (i % 3 === 1) box(c, x + 104, y + 38, 90, 80, 16, tint)
    else {
      c.beginPath()
      c.moveTo(x + 149, y + 34)
      c.lineTo(x + 200, y + 122)
      c.lineTo(x + 98, y + 122)
      c.closePath()
      c.fillStyle = tint
      c.fill()
    }
    box(c, x + 18, y + 158, 180, 15, 7, k.ink)
    box(c, x + 18, y + 192, 92, 28, 8, k.muted)
    box(c, x + 212, y + 186, 68, 40, 20, k.accent)
  }
}

function api(c: Ctx, k: ScreenColors) {
  // Endpoints
  const methods = [k.accent, k.accent, k.muted, k.accent, k.muted]
  box(c, 36, 84, 372, 588, 20, k.panel)
  for (let i = 0; i < 5; i++) {
    const y = 110 + i * 110
    box(c, 56, y, 332, 88, 16, i === 1 ? k.raised : k.panel)
    box(c, 74, y + 28, 78, 32, 10, methods[i])
    box(c, 168, y + 30, 150 + (i % 2) * 44, 14, 7, k.ink)
    box(c, 168, y + 54, 100, 10, 5, k.muted)
  }

  // JSON response
  box(c, 428, 84, 560, 588, 20, k.panel)
  box(c, 452, 108, 116, 38, 12, k.accent)
  box(c, 584, 118, 120, 16, 8, k.muted)
  const rows: [number, number, string, number?, string?][] = [
    [0, 28, k.muted],
    [1, 96, k.muted, 170, k.accent],
    [1, 70, k.muted, 118, k.ink],
    [1, 128, k.muted, 26, k.muted],
    [2, 84, k.muted, 196, k.accent],
    [2, 60, k.muted, 90, k.ink],
    [2, 112, k.muted, 142, k.accent],
    [1, 26, k.muted],
    [1, 96, k.muted, 120, k.ink],
    [0, 28, k.muted],
  ]
  rows.forEach(([indent, keyWidth, keyColor, valueWidth, valueColor], i) => {
    const y = 172 + i * 48
    const x = 462 + indent * 44
    box(c, x, y, keyWidth, 20, 7, keyColor)
    if (valueWidth && valueColor) box(c, x + keyWidth + 16, y, valueWidth, 20, 7, valueColor)
  })
}

function consulting(c: Ctx, k: ScreenColors) {
  // A system on a whiteboard: boxes joined by arrows, one of them flagged.
  box(c, 36, 84, 580, 588, 22, k.panel)
  const nodes: [number, number, string][] = [
    [66, 128, k.raised],
    [338, 128, k.raised],
    [202, 322, k.accent],
    [66, 516, k.raised],
    [338, 516, k.raised],
  ]
  c.strokeStyle = k.muted
  c.lineWidth = 6
  c.lineCap = 'round'
  const link = (a: number, b: number) => {
    c.beginPath()
    c.moveTo(nodes[a][0] + 110, nodes[a][1] + 60)
    c.lineTo(nodes[b][0] + 110, nodes[b][1] + 60)
    c.stroke()
  }
  link(0, 2)
  link(1, 2)
  link(2, 3)
  link(2, 4)
  nodes.forEach(([x, y, fill], i) => {
    box(c, x, y, 220, 120, 20, fill)
    box(c, x + 26, y + 36, 140, 16, 8, i === 2 ? '#FFFFFF' : k.ink)
    box(c, x + 26, y + 68, 100, 12, 6, i === 2 ? 'rgba(255,255,255,0.7)' : k.muted)
  })

  // Checklist
  box(c, 636, 84, 352, 588, 22, k.panel)
  box(c, 664, 116, 190, 22, 11, k.ink)
  for (let i = 0; i < 5; i++) {
    const y = 172 + i * 94
    const done = i < 3
    box(c, 664, y, 54, 54, 16, done ? k.accent : k.raised)
    if (done) {
      c.beginPath()
      c.moveTo(678, y + 28)
      c.lineTo(688, y + 38)
      c.lineTo(705, y + 17)
      c.strokeStyle = '#FFFFFF'
      c.lineWidth = 7
      c.lineJoin = 'round'
      c.stroke()
    }
    box(c, 736, y + 8, 212 - (i % 2) * 40, 14, 7, done ? k.ink : k.muted)
    box(c, 736, y + 34, 120, 10, 5, k.muted)
  }
}

function dashedFrame(c: Ctx, x: number, y: number, w: number, h: number, r: number, stroke: string) {
  c.save()
  c.beginPath()
  c.roundRect(x, y, w, h, r)
  c.setLineDash([18, 14])
  c.lineWidth = 4
  c.strokeStyle = stroke
  c.stroke()
  c.restore()
}

function blueprintGrid(c: Ctx, k: ScreenColors) {
  c.strokeStyle = k.line
  c.lineWidth = 2
  for (let x = 0; x <= SCREEN_WIDTH; x += 64) {
    c.beginPath()
    c.moveTo(x, 62)
    c.lineTo(x, SCREEN_HEIGHT)
    c.stroke()
  }
  for (let y = 62; y <= SCREEN_HEIGHT; y += 64) {
    c.beginPath()
    c.moveTo(0, y)
    c.lineTo(SCREEN_WIDTH, y)
    c.stroke()
  }
}

/**
 * Draws with (0, 0) at a point of the screen and axes that look straight and
 * upright from the camera, undoing the screen's turn and foreshortening. A symbol
 * meant to be read would otherwise lie skewed on the tilted plate (a check turns
 * into an "L"). The inverse of (x, z) -> (x cos + z sin, (z cos - x sin) lift).
 */
function facingViewer(c: Ctx, x: number, y: number, view: ScreenView, draw: () => void) {
  const cos = Math.cos(view.yaw)
  const sin = Math.sin(view.yaw)
  c.save()
  c.transform(cos, sin, -sin / view.lift, cos / view.lift, x, y)
  draw()
  c.restore()
}

/** Nothing chosen yet: an empty blueprint waiting for its first answer. */
function blank(c: Ctx, k: ScreenColors, view: ScreenView) {
  blueprintGrid(c, k)
  dashedFrame(c, 112, 132, 800, 470, 28, k.accentSoft)
  // A pointer waiting for the first choice.
  facingViewer(c, SCREEN_WIDTH / 2, 372, view, () => {
    dot(c, 0, 0, 62, k.accent)
    c.beginPath()
    c.moveTo(-18, -32)
    c.lineTo(-18, 22)
    c.lineTo(-4, 9)
    c.lineTo(6, 32)
    c.lineTo(18, 27)
    c.lineTo(8, 4)
    c.lineTo(27, 3)
    c.closePath()
    c.fillStyle = '#FFFFFF'
    c.fill()
  })
}

/** "Something else": a loose sketch with a question mark, still open. */
function other(c: Ctx, k: ScreenColors, view: ScreenView) {
  blueprintGrid(c, k)
  dashedFrame(c, 60, 104, 400, 250, 24, k.accentSoft)
  dashedFrame(c, 60, 384, 400, 260, 24, k.muted)
  dashedFrame(c, 500, 104, 460, 540, 24, k.accentSoft)
  box(c, 96, 150, 200, 20, 10, k.muted)
  box(c, 96, 190, 300, 14, 7, k.line)
  box(c, 96, 440, 260, 20, 10, k.muted)
  box(c, 96, 480, 190, 14, 7, k.line)
  facingViewer(c, 730, 372, view, () => {
    dot(c, 0, 0, 70, k.accent)
    c.font = '700 84px system-ui, sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillStyle = '#FFFFFF'
    c.fillText('?', 0, 5)
  })
}

/** The request is on its way. */
function sent(c: Ctx, k: ScreenColors, view: ScreenView) {
  facingViewer(c, SCREEN_WIDTH / 2, 372, view, () => {
    dot(c, 0, 0, 108, k.accent)
    c.beginPath()
    c.moveTo(-48, 4)
    c.lineTo(-13, 40)
    c.lineTo(52, -38)
    c.strokeStyle = '#FFFFFF'
    c.lineWidth = 20
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.stroke()
  })
  const confetti = [k.accent, k.muted]
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * Math.PI * 2
    const reach = 210 + (i % 3) * 56
    c.save()
    c.translate(SCREEN_WIDTH / 2 + Math.cos(angle) * reach * 1.45, 372 + Math.sin(angle) * reach * 0.86)
    c.rotate(angle)
    box(c, -18, -6, 36, 12, 6, confetti[i % confetti.length])
    c.restore()
  }
}

const SCREENS: Record<ScreenId, (c: Ctx, k: ScreenColors, view: ScreenView) => void> = {
  blank,
  web_app: webApp,
  website,
  ecommerce,
  api,
  consulting,
  other,
  sent,
}

function newCanvas(width: number, height: number): [HTMLCanvasElement, Ctx] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas unavailable')
  return [canvas, context]
}

export function drawScreen(id: ScreenId, colors: ScreenColors, view: ScreenView): HTMLCanvasElement {
  const [canvas, c] = newCanvas(SCREEN_WIDTH, SCREEN_HEIGHT)
  box(c, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, 0, colors.bg)
  windowBar(c, colors)
  SCREENS[id](c, colors, view)
  return canvas
}

export type BlueprintKind = 'interface' | 'logic' | 'data'

/**
 * A layer's technical drawing, shown until the layer is built: its outline,
 * corner marks, and what will stand on it. Same proportions as the screen.
 */
export function drawBlueprint(kind: BlueprintKind, color: string): HTMLCanvasElement {
  const [canvas, c] = newCanvas(1024, 692)
  c.strokeStyle = color
  c.fillStyle = color
  c.lineWidth = 4

  c.save()
  c.globalAlpha = 0.09
  c.beginPath()
  c.roundRect(20, 20, 984, 652, 48)
  c.fill()
  c.restore()

  c.beginPath()
  c.roundRect(20, 20, 984, 652, 48)
  c.stroke()

  c.save()
  c.globalAlpha = 0.55
  c.setLineDash([14, 12])
  c.beginPath()
  c.roundRect(52, 52, 920, 588, 28)
  c.stroke()
  c.restore()

  // Corner marks
  c.lineWidth = 3
  for (const [x, y] of [[92, 92], [932, 92], [92, 600], [932, 600]]) {
    c.beginPath()
    c.moveTo(x - 18, y)
    c.lineTo(x + 18, y)
    c.moveTo(x, y - 18)
    c.lineTo(x, y + 18)
    c.stroke()
  }

  c.lineWidth = 4
  if (kind === 'interface') {
    c.beginPath()
    c.moveTo(52, 126)
    c.lineTo(972, 126)
    c.stroke()
    c.save()
    c.globalAlpha = 0.55
    c.strokeRect(140, 190, 330, 170)
    c.strokeRect(540, 190, 340, 380)
    c.strokeRect(140, 410, 330, 160)
    c.restore()
  } else if (kind === 'logic') {
    // Same footprint as the modules that will stand here.
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        c.beginPath()
        c.roundRect(97.5 + col * 216, 111.5 + row * 170, 181, 129, 24)
        c.stroke()
      }
    }
  } else {
    // The drives' footprint and the track around them.
    for (const radius of [90, 181, 283]) {
      c.beginPath()
      c.arc(512, 346, radius, 0, Math.PI * 2)
      c.stroke()
    }
    c.save()
    c.globalAlpha = 0.55
    c.beginPath()
    c.moveTo(190, 346)
    c.lineTo(834, 346)
    c.moveTo(512, 40)
    c.lineTo(512, 652)
    c.stroke()
    c.restore()
  }
  return canvas
}

/** A solid round dot (packets, dust, sparks). */
export function drawDot(color: string, size = 64): HTMLCanvasElement {
  const [canvas, c] = newCanvas(size, size)
  dot(c, size / 2, size / 2, size / 2 - 1, color)
  return canvas
}

/** Blueprint floor: a round plate of fine lines with a crisp edge. */
export function drawFloorGrid(color: string): HTMLCanvasElement {
  const size = 1024
  const middle = size / 2
  const radius = middle - 3
  const [canvas, c] = newCanvas(size, size)
  c.strokeStyle = color
  c.save()
  c.beginPath()
  c.arc(middle, middle, radius, 0, Math.PI * 2)
  c.clip()
  const cells = 14
  c.lineWidth = 2
  for (let i = 0; i <= cells; i++) {
    const at = Math.round((i / cells) * size)
    c.beginPath()
    c.moveTo(at, 0)
    c.lineTo(at, size)
    c.moveTo(0, at)
    c.lineTo(size, at)
    c.stroke()
  }
  c.restore()
  c.lineWidth = 5
  c.beginPath()
  c.arc(middle, middle, radius, 0, Math.PI * 2)
  c.stroke()
  return canvas
}

/** Dashes around a circle: the data layer's slowly turning track. */
export function drawDataTrack(color: string): HTMLCanvasElement {
  const size = 512
  const [canvas, c] = newCanvas(size, size)
  const middle = size / 2
  c.strokeStyle = color
  c.lineCap = 'round'
  const ring = (radius: number, dashes: number, width: number, alpha: number) => {
    c.globalAlpha = alpha
    c.lineWidth = width
    for (let i = 0; i < dashes; i++) {
      const start = (i / dashes) * Math.PI * 2
      c.beginPath()
      c.arc(middle, middle, radius, start, start + (Math.PI * 2) / dashes / 2)
      c.stroke()
    }
  }
  ring(236, 36, 6, 1)
  ring(206, 72, 3, 0.55)
  return canvas
}
