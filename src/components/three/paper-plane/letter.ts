import { signaturePoints } from '@/features/inbox/contact-form'
import type { ContactTopic } from '@/features/inbox/schema'
import { SHEET_HALF_HEIGHT, SHEET_HALF_WIDTH } from './fold'

// The letter's face, drawn on a canvas: nothing to fetch, nothing to add to the
// CSP. Wordless on purpose: lines show how much is written, never what, so it
// reads the same in every language. Laid out left to right, mirrored for
// right-to-left pages (the stamp's icon and the check are never mirrored).

/** Logical size of the face, in canvas pixels; A-series proportions like the sheet. */
export const LETTER_WIDTH = 600
export const LETTER_HEIGHT = Math.round(LETTER_WIDTH * Math.SQRT2)

export interface LetterFace {
  /** After sending: a big check instead of the writing. */
  receipt: boolean
  topic: ContactTopic | null
  lines: readonly number[]
  signature: readonly number[]
  reply: number
  replyValid: boolean
  /** Crease guides: ready to fold. */
  ready: boolean
}

export interface LetterColors {
  paper: string
  /** The sheet's hairline edge, so it reads on a page of nearly the same tone. */
  edge: string
  /** Signature, a valid reply-to line. */
  ink: string
  /** The written lines. */
  line: string
  /** Ruling, empty slots. */
  faint: string
  accent: string
  onAccent: string
}

/** Stamp icons, in lucide's 24px grid: the same icons as the topic chips. */
const STAMP_ICONS: Record<ContactTopic, string[]> = {
  job: [
    'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
    'M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  ],
  project: ['m16 18 6-6-6-6', 'm8 6-6 6 6 6'],
  other: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
}

const MARGIN = 58
const STAMP_WIDTH = 92
const STAMP_HEIGHT = 112
const BODY_TOP = 252
const LINE_STEP = 54
const BODY_LINES = 7
const COLUMN = LETTER_WIDTH - MARGIN * 2

export function sameFace(a: LetterFace | null, b: LetterFace): boolean {
  if (!a) return false
  const sameList = (x: readonly number[], y: readonly number[]) => x.length === y.length && x.every((v, i) => v === y[i])
  return (
    a.receipt === b.receipt &&
    a.topic === b.topic &&
    a.reply === b.reply &&
    a.replyValid === b.replyValid &&
    a.ready === b.ready &&
    sameList(a.lines, b.lines) &&
    sameList(a.signature, b.signature)
  )
}

/** Sheet coordinates (the fold's units, y up) to canvas pixels. */
function toCanvas(x: number, y: number): [number, number] {
  return [
    ((x + SHEET_HALF_WIDTH) / (2 * SHEET_HALF_WIDTH)) * LETTER_WIDTH,
    ((SHEET_HALF_HEIGHT - y) / (2 * SHEET_HALF_HEIGHT)) * LETTER_HEIGHT,
  ]
}

function stroke(context: CanvasRenderingContext2D, from: [number, number], to: [number, number]) {
  context.beginPath()
  context.moveTo(...from)
  context.lineTo(...to)
  context.stroke()
}

/** Draws `face` on `canvas`, whatever the canvas's resolution. */
export function drawLetter(canvas: HTMLCanvasElement, face: LetterFace, colors: LetterColors, rtl: boolean) {
  const context = canvas.getContext('2d')
  if (!context) return
  const scale = canvas.width / LETTER_WIDTH
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.setLineDash([])
  context.globalAlpha = 1

  drawPaper(canvas, colors.paper, colors.edge)
  context.setTransform(scale, 0, 0, scale, 0, 0)

  /** Mirrors a left-to-right x for right-to-left pages. */
  const at = (x: number) => (rtl ? LETTER_WIDTH - x : x)
  /** A line from `x` (left to right), `width` long. */
  const run = (x: number, y: number, width: number) => stroke(context, [at(x), y], [at(x + width), y])

  // Ruling: the page's own faint lines, under the writing.
  context.strokeStyle = colors.faint
  context.lineWidth = 1.5
  for (let i = 0; i < BODY_LINES; i++) run(MARGIN, BODY_TOP + i * LINE_STEP + 14, COLUMN)

  drawStamp(context, face.topic, colors, rtl ? MARGIN : LETTER_WIDTH - MARGIN - STAMP_WIDTH)

  // Reply-to: a small ring (the address) and its line, as long as what is typed.
  const replyY = MARGIN + 34
  context.lineWidth = 3
  context.strokeStyle = face.replyValid ? colors.ink : colors.line
  context.beginPath()
  context.arc(at(MARGIN + 9), replyY, 8, 0, Math.PI * 2)
  context.stroke()
  context.lineWidth = 8
  if (face.reply === 0) {
    context.strokeStyle = colors.faint
    context.setLineDash([2, 14])
    run(MARGIN + 34, replyY, 170)
    context.setLineDash([])
  } else {
    context.strokeStyle = face.replyValid ? colors.ink : colors.line
    run(MARGIN + 34, replyY, 60 + face.reply * 170)
  }

  if (face.receipt) {
    drawCheck(context, colors.accent)
    return
  }

  // Salutation, then the message's lines.
  context.strokeStyle = colors.line
  context.lineWidth = 10
  run(MARGIN, BODY_TOP - LINE_STEP, 150)
  face.lines.slice(0, BODY_LINES).forEach((share, index) => {
    if (share <= 0) return
    // Full lines vary a little, like text; the last, unfinished one shows its own length.
    const jitter = share >= 1 ? 0.84 + (((index * 37) % 11) / 11) * 0.16 : 1
    run(MARGIN, BODY_TOP + index * LINE_STEP, Math.max(14, share * COLUMN * jitter))
  })

  drawSignature(context, face.signature, colors.ink, rtl)

  if (face.ready) drawCreases(context, colors.accent)
}

/**
 * Plain paper with a hairline edge: the back of the sheet, and the ground the front
 * is written on. The edge follows the sheet's outer border, so it outlines the letter
 * and, once folded, the plane's wingtips and tail.
 */
export function drawPaper(canvas: HTMLCanvasElement, paper: string, edge: string) {
  const context = canvas.getContext('2d')
  if (!context) return
  const scale = canvas.width / LETTER_WIDTH
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.setLineDash([])
  context.globalAlpha = 1
  context.fillStyle = paper
  context.fillRect(0, 0, LETTER_WIDTH, LETTER_HEIGHT)
  context.strokeStyle = edge
  context.lineWidth = 5
  context.strokeRect(2.5, 2.5, LETTER_WIDTH - 5, LETTER_HEIGHT - 5)
}

function drawStamp(context: CanvasRenderingContext2D, topic: ContactTopic | null, colors: LetterColors, x: number) {
  const y = MARGIN
  if (!topic) {
    // An empty spot, waiting for a stamp.
    context.strokeStyle = colors.faint
    context.lineWidth = 3
    context.setLineDash([7, 8])
    context.beginPath()
    context.roundRect(x, y, STAMP_WIDTH, STAMP_HEIGHT, 8)
    context.stroke()
    context.setLineDash([])
    return
  }

  context.fillStyle = colors.accent
  context.fillRect(x, y, STAMP_WIDTH, STAMP_HEIGHT)
  // Perforated edge: bites of paper along every side.
  context.fillStyle = colors.paper
  const bite = 5
  const step = 14
  for (let cx = x + step / 2; cx < x + STAMP_WIDTH; cx += step) {
    for (const cy of [y, y + STAMP_HEIGHT]) {
      context.beginPath()
      context.arc(cx, cy, bite, 0, Math.PI * 2)
      context.fill()
    }
  }
  for (let cy = y + step / 2; cy < y + STAMP_HEIGHT; cy += step) {
    for (const cx of [x, x + STAMP_WIDTH]) {
      context.beginPath()
      context.arc(cx, cy, bite, 0, Math.PI * 2)
      context.fill()
    }
  }

  const size = 50
  context.save()
  context.translate(x + (STAMP_WIDTH - size) / 2, y + (STAMP_HEIGHT - size) / 2)
  context.scale(size / 24, size / 24)
  context.strokeStyle = colors.onAccent
  context.lineWidth = 2
  for (const d of STAMP_ICONS[topic]) context.stroke(new Path2D(d))
  context.restore()
}

function drawSignature(context: CanvasRenderingContext2D, codes: readonly number[], ink: string, rtl: boolean) {
  const points = signaturePoints(codes)
  if (points.length < 2) return
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const minX = Math.min(...xs)
  const spanX = Math.max(...xs) - minX || 1
  const minY = Math.min(...ys)
  const spanY = Math.max(...ys) - minY || 1
  // Grows with the name, up to the width of the signature block.
  const width = Math.min(240, 34 + spanX * 22)
  const height = 74
  const right = LETTER_WIDTH - MARGIN
  const bottom = LETTER_HEIGHT - MARGIN - 18
  const place = ({ x, y }: { x: number; y: number }): [number, number] => {
    const px = right - width + ((x - minX) / spanX) * width
    return [rtl ? LETTER_WIDTH - px : px, bottom - height + ((y - minY) / spanY) * height]
  }

  context.strokeStyle = ink
  context.lineWidth = 3.5
  context.beginPath()
  const placed = points.map(place)
  context.moveTo(...placed[0])
  // Smooth: a quadratic through each point, ending halfway to the next.
  for (let i = 1; i < placed.length - 1; i++) {
    const [x, y] = placed[i]
    const [nx, ny] = placed[i + 1]
    context.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2)
  }
  context.lineTo(...placed[placed.length - 1])
  context.stroke()
}

/** Where the sheet will fold, dashed: the plane's crease pattern. */
function drawCreases(context: CanvasRenderingContext2D, accent: string) {
  const W = SHEET_HALF_WIDTH
  const H = SHEET_HALF_HEIGHT
  const drop = W / Math.tan(Math.PI / 8)
  context.save()
  context.strokeStyle = accent
  context.globalAlpha = 0.55
  context.lineWidth = 3
  context.setLineDash([10, 10])
  stroke(context, toCanvas(0, H), toCanvas(0, -H))
  for (const side of [-1, 1]) {
    stroke(context, toCanvas(0, H), toCanvas(side * W, H - W))
    stroke(context, toCanvas(0, H), toCanvas(side * W, H - drop))
  }
  context.restore()
}

function drawCheck(context: CanvasRenderingContext2D, accent: string) {
  const cx = LETTER_WIDTH / 2
  const cy = LETTER_HEIGHT * 0.55
  const size = 150
  context.strokeStyle = accent
  context.lineWidth = 30
  context.beginPath()
  context.moveTo(cx - size * 0.62, cy + size * 0.02)
  context.lineTo(cx - size * 0.18, cy + size * 0.46)
  context.lineTo(cx + size * 0.68, cy - size * 0.42)
  context.stroke()
}
