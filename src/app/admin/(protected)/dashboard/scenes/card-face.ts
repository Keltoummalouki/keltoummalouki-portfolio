// Artwork for the 3D "latest work" cards, painted on a 2D canvas and used as a
// texture. Everything is drawn locally (no fonts or images fetched), so the
// strict CSP needs no new origin.

export type CardVariant = 'brand' | 'ink' | 'pearl'

export interface CardFace {
  title: string
  status: string
  /** "PROJECT" or "ARTICLE". */
  label: string
  /** e.g. "Nov 2026" (may be empty). */
  date: string
  index: number
  variant: CardVariant
}

// Flat colours only (no gradients), matching the rest of the studio.
const THEMES: Record<CardVariant, { fill: string; text: string; muted: string; line: string; grain: string; pill: string }> = {
  brand: { fill: '#2563eb', text: '#ffffff', muted: 'rgba(255,255,255,.76)', line: 'rgba(255,255,255,.34)', grain: 'rgba(255,255,255,.04)', pill: 'rgba(255,255,255,.16)' },
  ink: { fill: '#141416', text: '#fafafa', muted: 'rgba(250,250,250,.64)', line: 'rgba(255,255,255,.2)', grain: 'rgba(255,255,255,.035)', pill: 'rgba(255,255,255,.1)' },
  pearl: { fill: '#f4f3ef', text: '#18181b', muted: 'rgba(24,24,27,.62)', line: 'rgba(24,24,27,.18)', grain: 'rgba(0,0,0,.035)', pill: 'rgba(24,24,27,.07)' },
}
const STATUS_DOT: Record<string, string> = { published: '#22c55e', draft: '#f59e0b', archived: '#a1a1aa' }

/** Shortens `text` with an ellipsis until it fits `max` pixels. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

/** Word-wraps into at most `maxLines` lines; the last one is ellipsised if needed. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i]
    if (line && ctx.measureText(next).width > max) {
      lines.push(line)
      if (lines.length === maxLines - 1) {
        line = words.slice(i).join(' ')
        break
      }
      line = words[i]
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.map(l => fit(ctx, l, max))
}

export function drawCardFace(canvas: HTMLCanvasElement, face: CardFace, family: string) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: w, height: h } = canvas
  const theme = THEMES[face.variant]
  const pad = 84
  ctx.save()
  ctx.clearRect(0, 0, w, h)

  // A flat base colour with a fine grain.
  ctx.fillStyle = theme.fill
  ctx.fillRect(0, 0, w, h)
  let seed = 1234 + face.index * 77
  const next = () => (seed = (seed * 16807) % 2147483647)
  ctx.fillStyle = theme.grain
  for (let i = 0; i < 2200; i++) ctx.fillRect(next() % w, next() % h, 2, 2)

  // Monogram and studio name.
  ctx.textBaseline = 'middle'
  ctx.strokeStyle = theme.line
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.roundRect(pad, 76, 84, 64, 18)
  ctx.stroke()
  ctx.fillStyle = theme.text
  ctx.font = `800 32px ${family}`
  ctx.textAlign = 'center'
  ctx.fillText('KM', pad + 42, 109)
  ctx.textAlign = 'left'
  ctx.font = `700 19px ${family}`
  ctx.letterSpacing = '6px'
  ctx.fillStyle = theme.muted
  ctx.fillText('PORTFOLIO STUDIO', pad + 108, 109)

  // Status pill.
  const status = face.status.toUpperCase()
  ctx.font = `800 18px ${family}`
  ctx.letterSpacing = '4px'
  const pillW = ctx.measureText(status).width + 66
  const pillX = w - pad - pillW
  ctx.fillStyle = theme.pill
  ctx.beginPath()
  ctx.roundRect(pillX, 85, pillW, 46, 23)
  ctx.fill()
  ctx.fillStyle = STATUS_DOT[face.status] ?? theme.muted
  ctx.beginPath()
  ctx.arc(pillX + 26, 108, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = theme.text
  ctx.fillText(status, pillX + 42, 109)

  // The chip and contactless waves: it reads as a card at a glance.
  const chipX = pad
  const chipY = 196
  ctx.fillStyle = '#f4c152'
  ctx.beginPath()
  ctx.roundRect(chipX, chipY, 112, 86, 16)
  ctx.fill()
  ctx.strokeStyle = 'rgba(110,70,15,.42)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(chipX, chipY + 30)
  ctx.lineTo(chipX + 112, chipY + 30)
  ctx.moveTo(chipX, chipY + 56)
  ctx.lineTo(chipX + 112, chipY + 56)
  ctx.moveTo(chipX + 40, chipY)
  ctx.lineTo(chipX + 40, chipY + 86)
  ctx.moveTo(chipX + 72, chipY)
  ctx.lineTo(chipX + 72, chipY + 86)
  ctx.stroke()
  ctx.strokeStyle = theme.muted
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.arc(chipX + 150, chipY + 43, 14 + i * 14, -Math.PI / 4, Math.PI / 4)
    ctx.stroke()
  }

  // Title: up to two lines.
  ctx.letterSpacing = '0px'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = theme.text
  ctx.font = `800 62px ${family}`
  const lines = wrap(ctx, face.title, w - pad * 2, 2)
  const top = lines.length > 1 ? 418 : 470
  lines.forEach((line, i) => ctx.fillText(line, pad, top + i * 72))

  // Footer: type, number and date, and a two-circle mark.
  ctx.font = `700 21px ${family}`
  ctx.letterSpacing = '5px'
  ctx.fillStyle = theme.muted
  const number = String(face.index + 1).padStart(2, '0')
  ctx.fillText(fit(ctx, `${face.label} ${number}${face.date ? `  ·  ${face.date.toUpperCase()}` : ''}`, w - pad * 2 - 170), pad, h - 72)
  ctx.globalAlpha = 0.92
  ctx.fillStyle = '#60a5fa'
  ctx.beginPath()
  ctx.arc(w - pad - 76, h - 80, 34, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = face.variant === 'pearl' ? 'multiply' : 'screen'
  ctx.fillStyle = '#c084fc'
  ctx.beginPath()
  ctx.arc(w - pad - 30, h - 80, 34, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
