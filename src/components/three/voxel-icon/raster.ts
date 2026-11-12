import type { IconNode, IconNodeElement } from './icons'

/** Lucide draws on a 24-unit square with 2-unit round strokes. */
const ICON_UNITS = 24
const STROKE_WIDTH = 2

/**
 * How much of each cell of a size×size grid an icon's strokes cover (0..1,
 * row-major), drawn the way Lucide draws it on a supersampled canvas. Browser only
 * (canvas + Path2D); what to do with the coverage is pure, in voxels.ts.
 */
export function rasterizeIcon(node: IconNode, size: number, supersample = 4): Float32Array {
  const coverage = new Float32Array(size * size)
  const pixels = size * supersample
  const canvas = document.createElement('canvas')
  canvas.width = pixels
  canvas.height = pixels
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return coverage

  const scale = pixels / ICON_UNITS
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.lineWidth = STROKE_WIDTH
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.strokeStyle = '#000'
  for (const element of node) context.stroke(toPath(element))

  const { data } = context.getImageData(0, 0, pixels, pixels)
  for (let y = 0; y < pixels; y++) {
    const row = Math.floor(y / supersample) * size
    for (let x = 0; x < pixels; x++) {
      coverage[row + Math.floor(x / supersample)] += data[(y * pixels + x) * 4 + 3] / 255
    }
  }
  const area = supersample * supersample
  for (let index = 0; index < coverage.length; index++) coverage[index] /= area
  return coverage
}

function toPath(element: IconNodeElement): Path2D {
  switch (element[0]) {
    case 'path':
      return new Path2D(element[1].d)
    case 'circle': {
      const { cx, cy, r } = element[1]
      const path = new Path2D()
      path.arc(Number(cx), Number(cy), Number(r), 0, Math.PI * 2)
      return path
    }
    case 'rect': {
      const { x, y, width, height, rx = '0' } = element[1]
      const path = new Path2D()
      if (typeof path.roundRect === 'function') path.roundRect(Number(x), Number(y), Number(width), Number(height), Number(rx))
      else path.rect(Number(x), Number(y), Number(width), Number(height))
      return path
    }
    case 'line': {
      const { x1, y1, x2, y2 } = element[1]
      const path = new Path2D()
      path.moveTo(Number(x1), Number(y1))
      path.lineTo(Number(x2), Number(y2))
      return path
    }
  }
}
