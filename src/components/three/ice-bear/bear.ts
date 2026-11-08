import type { ReliefBump } from './relief'

// The hero mascot: public/images/ice-bear.webp, a cut-out with an alpha
// channel. Every coordinate below was measured on that 830×1390 file; replace
// them together if the picture changes.

export const ICE_BEAR = {
  src: '/images/ice-bear.webp',
  width: 830,
  height: 1390,
} as const

export const ICE_BEAR_ASPECT = ICE_BEAR.width / ICE_BEAR.height

const u = (x: number) => x / ICE_BEAR.width
/** Texture v: 0 at the bottom of the picture. */
const v = (y: number) => 1 - y / ICE_BEAR.height

/** Box around both sunglasses lenses (uv: x0, y0, x1, y1). */
export const LENS_BOX: [number, number, number, number] = [u(398), v(278), u(702), v(158)]

/** Centre of the coffee cup's lid, where the steam starts (uv). */
export const CUP_LID: [number, number] = [u(657), v(552)]

/** Parts that stick out of the body, in image coordinates (y down). */
export const RELIEF_BUMPS: readonly ReliefBump[] = [
  { x: u(632), y: 300 / ICE_BEAR.height, rx: 0.13, ry: 0.085, height: 0.35 }, // snout
  { x: u(420), y: 230 / ICE_BEAR.height, rx: 0.34, ry: 0.15, height: 0.15 }, // head
  { x: u(690), y: 700 / ICE_BEAR.height, rx: 0.17, ry: 0.15, height: 0.55 }, // cup + paw
  { x: u(215), y: 790 / ICE_BEAR.height, rx: 0.15, ry: 0.2, height: 0.3 }, // arm over the laptop
  { x: u(455), y: 1000 / ICE_BEAR.height, rx: 0.35, ry: 0.22, height: 0.18 }, // belly
]
