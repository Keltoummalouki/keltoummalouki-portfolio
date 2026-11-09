// A panel's face, drawn on a 2D canvas: the browser bar and the project's cover,
// matching the DOM window it stands in for. Nothing here touches Three.js.

export const FACE_WIDTH = 1280
export const CHROME_HEIGHT = 72
/** The 16:10 screen under the bar, same shape as the live demo it can hold. */
export const SCREEN_HEIGHT = 800
export const FACE_HEIGHT = CHROME_HEIGHT + SCREEN_HEIGHT

export interface FaceColors {
  bar: string
  line: string
  screen: string
  pill: string
  pillText: string
  monogram: string
}

export interface FaceContent {
  /** The project's number, as in the list beside the model. */
  number: string
  host: string | null
  /** Shown instead of the cover while it loads, and for a project without one. */
  monogram: string
  cover: HTMLImageElement | null
}

/** Fills with `color`, or `fallback` when the browser can't parse it. */
function setFill(context: CanvasRenderingContext2D, color: string, fallback: string) {
  context.fillStyle = fallback
  if (color) context.fillStyle = color
}

function drawBar(context: CanvasRenderingContext2D, content: FaceContent, colors: FaceColors, font: string) {
  setFill(context, colors.bar, '#171717')
  context.fillRect(0, 0, FACE_WIDTH, CHROME_HEIGHT)
  setFill(context, colors.line, 'rgba(255,255,255,.1)')
  context.fillRect(0, CHROME_HEIGHT - 2, FACE_WIDTH, 2)

  // Neutral, like the DOM window's: one accent on the page, and this isn't it.
  setFill(context, colors.pillText, '#A3A3A3')
  context.globalAlpha = 0.45
  for (let index = 0; index < 3; index++) {
    context.beginPath()
    context.arc(38 + index * 28, CHROME_HEIGHT / 2, 8, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1

  context.textBaseline = 'middle'
  context.direction = 'ltr'
  setFill(context, colors.pillText, '#A3A3A3')
  context.font = `600 26px ${font}`
  context.textAlign = 'right'
  context.fillText(content.number, FACE_WIDTH - 36, CHROME_HEIGHT / 2 + 1)

  if (!content.host) return
  context.font = `500 24px ${font}`
  const pillWidth = Math.min(FACE_WIDTH * 0.5, context.measureText(content.host).width + 56)
  context.beginPath()
  context.roundRect((FACE_WIDTH - pillWidth) / 2, CHROME_HEIGHT / 2 - 21, pillWidth, 42, 21)
  setFill(context, colors.pill, '#000000')
  context.fill()
  setFill(context, colors.pillText, '#A3A3A3')
  context.textAlign = 'center'
  context.fillText(content.host, FACE_WIDTH / 2, CHROME_HEIGHT / 2 + 1, pillWidth - 40)
}

/** Fitted whole, like the DOM window's cover; odd shapes leave flat bands of the screen colour. */
function drawCover(context: CanvasRenderingContext2D, cover: HTMLImageElement) {
  const scale = Math.min(FACE_WIDTH / cover.naturalWidth, SCREEN_HEIGHT / cover.naturalHeight)
  const width = cover.naturalWidth * scale
  const height = cover.naturalHeight * scale
  context.imageSmoothingQuality = 'high'
  context.drawImage(cover, (FACE_WIDTH - width) / 2, CHROME_HEIGHT + (SCREEN_HEIGHT - height) / 2, width, height)
}

function drawMonogram(context: CanvasRenderingContext2D, monogram: string, colors: FaceColors, font: string) {
  setFill(context, colors.monogram, '#7CA1F3')
  context.font = `700 220px ${font}`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(monogram, FACE_WIDTH / 2, CHROME_HEIGHT + SCREEN_HEIGHT / 2)
}

/** Paints the face on `canvas`, whose width sets the texture's resolution. */
export function drawFace(canvas: HTMLCanvasElement, content: FaceContent, colors: FaceColors, font: string) {
  const context = canvas.getContext('2d')
  if (!context) return
  const scale = canvas.width / FACE_WIDTH
  context.setTransform(scale, 0, 0, scale, 0, 0)
  setFill(context, colors.screen, '#000000')
  context.fillRect(0, 0, FACE_WIDTH, FACE_HEIGHT)
  if (content.cover) drawCover(context, content.cover)
  else drawMonogram(context, content.monogram, colors, font)
  drawBar(context, content, colors, font)
}
