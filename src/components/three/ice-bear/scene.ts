import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Points,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Texture,
  TorusGeometry,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  type ShaderMaterialParameters,
} from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { animate } from 'animejs'
import { getLenisInstance } from '@/lib/motion/smooth-scroll'
import { CUP_LID, ICE_BEAR_ASPECT, LENS_BOX, RELIEF_BUMPS } from './bear'
import { buildRelief, packRelief } from './relief'
import {
  colorArch,
  pairByHeight,
  sampleArch,
  sampleSilhouette,
  seededRandom,
  type PixelSource,
} from './sampling'
import * as glsl from './shaders'

// The hero's Ice Bear, in WebGL: a cut-out picture given a soft relief (so it
// tilts and catches light like a 3D figure), an orbit ring that passes behind
// and in front of him, coffee steam, and ~18k snow particles that build him in
// a snowstorm, then blow off on scroll and stream into the profile portrait.
//
// One fixed, full-viewport canvas (pointer-events: none) under the hero text.
// World units are CSS pixels and the camera is orthographic, so a DOM box maps
// straight onto the scene: the bear is drawn exactly over the server-rendered
// picture's box, and the snow lands exactly on the portrait's box.

export interface IceBearSceneOptions {
  canvas: HTMLCanvasElement
  /** The hero section: the ambient snow covers it, the scroll story starts at its top. */
  hero: HTMLElement
  /** The box the bear is drawn into (the server-rendered picture's box). */
  anchor: HTMLElement
  /** The decoded cut-out for the texture: a standalone Image, not a srcset <img>. */
  image: HTMLImageElement
  /** Build him in a snowstorm (off when the static picture is already on screen). */
  intro: boolean
  /** First frame is on the canvas: the static picture can go. */
  onReady: () => void
  /** Intro finished (his caption can appear). */
  onIntroDone: () => void
  onContextLost: () => void
}

export interface IceBearScene {
  /** Pokes him at (u, v) on the picture (v = 0 at the feet). */
  poke: (u: number, v: number) => void
  dispose: () => void
}

/** Relief depth, in bear heights. */
const DEPTH = 0.16
const RELIEF_WIDTH = 150
const SAMPLE_WIDTH = 220
const PORTRAIT_SAMPLE_WIDTH = 160
const AMBIENT_COUNT = 240
const BURST_COUNT = 160
/** Share of an arch's box (4:5) that the arch covers. */
const archCoverage = (aspect: number) => 1 - (1 - Math.PI / 4) / (2 * aspect)

type Rgb = [number, number, number]

function parseCssColor(value: string): Rgb | null {
  const v = value.trim()
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v)
  if (short) return [short[1], short[2], short[3]].map((c) => parseInt(c + c, 16) / 255) as Rgb
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(v)
  if (long) return [long[1], long[2], long[3]].map((c) => parseInt(c, 16) / 255) as Rgb
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v)
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((c) => Number(c) / 255) as Rgb
  return null
}

const hex = (value: string): Rgb => parseCssColor(value) ?? [1, 1, 1]
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as Rgb

interface Palette {
  rimA: Rgb
  rimB: Rgb
  rim: number
  ice: Rgb
  snow: Rgb
  ringA: Rgb
  ringB: Rgb
  ambient: Rgb
  ambientOpacity: number
  steam: Rgb
  steamOpacity: number
}

/** Colours follow the theme and the admin-picked primary colour (--primary). */
function readPalette(): Palette {
  const root = document.documentElement
  const primary = parseCssColor(getComputedStyle(root).getPropertyValue('--primary')) ?? hex('#2A6AFF')
  const white: Rgb = [1, 1, 1]
  if (root.classList.contains('dark')) {
    return {
      rimA: mix(primary, white, 0.35),
      rimB: mix(primary, white, 0.35),
      rim: 0.7,
      ice: hex('#CFE8FF'),
      snow: hex('#EAF4FF'),
      ringA: mix(primary, white, 0.2),
      ringB: mix(primary, white, 0.2),
      ambient: hex('#DCEBFF'),
      ambientOpacity: 0.85,
      steam: white,
      steamOpacity: 0.9,
    }
  }
  return {
    rimA: primary,
    rimB: primary,
    rim: 0.5,
    ice: mix(primary, white, 0.3),
    snow: primary,
    ringA: primary,
    ringB: primary,
    ambient: primary,
    ambientOpacity: 0.45,
    steam: hex('#94A3B8'),
    steamOpacity: 0.7,
  }
}

function readPixels(source: CanvasImageSource, width: number, height: number): PixelSource {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('2D canvas unavailable')
  context.drawImage(source, 0, 0, width, height)
  return { data: context.getImageData(0, 0, width, height).data, width, height }
}

/** Transparent, premultiplied, never depth-tested: draw order is set by renderOrder. */
const material = (parameters: ShaderMaterialParameters) =>
  new ShaderMaterial({ transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false, ...parameters })

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Throws when WebGL is unavailable (the caller keeps the static picture). */
export function createIceBearScene(options: IceBearSceneOptions): IceBearScene {
  const { canvas, hero, anchor, image } = options
  gsap.registerPlugin(ScrollTrigger)

  const coarse = window.matchMedia('(pointer: coarse)').matches
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const lowPower = coarse || (navigator.hardwareConcurrency || 8) <= 4
  const particleCount = lowPower ? 9000 : 18000
  const maxPixelRatio = lowPower ? 1.5 : 1.75

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: !lowPower, premultipliedAlpha: true })
  renderer.setClearColor(0x000000, 0)
  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 1, 6000)
  camera.position.z = 3000

  let disposed = false
  const disposables: { dispose: () => void }[] = [renderer]
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item)
    return item
  }
  const random = seededRandom(1337)

  // ── Textures: the picture, and its relief (normals + height) ───────────────
  const map = track(new Texture(image))
  map.premultiplyAlpha = true
  map.minFilter = LinearMipmapLinearFilter
  map.magFilter = LinearFilter
  map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  map.needsUpdate = true

  const reliefHeight = Math.round(RELIEF_WIDTH / ICE_BEAR_ASPECT)
  const reliefPixels = readPixels(image, RELIEF_WIDTH, reliefHeight)
  const alpha = new Uint8Array(RELIEF_WIDTH * reliefHeight)
  for (let i = 0; i < alpha.length; i++) alpha[i] = reliefPixels.data[i * 4 + 3]
  const relief = buildRelief(alpha, RELIEF_WIDTH, reliefHeight, {
    radius: RELIEF_WIDTH * 0.2,
    bumps: RELIEF_BUMPS,
    blur: 2,
  })
  const reliefTexture = track(
    new DataTexture(packRelief(relief, RELIEF_WIDTH, reliefHeight, 16), RELIEF_WIDTH, reliefHeight, RGBAFormat, UnsignedByteType),
  )
  reliefTexture.minFilter = LinearFilter
  reliefTexture.magFilter = LinearFilter
  reliefTexture.needsUpdate = true

  const shared = {
    uRelief: { value: reliefTexture },
    uDepth: { value: DEPTH },
    uAspect: { value: ICE_BEAR_ASPECT },
    uTime: { value: 0 },
    uFreeze: { value: options.intro ? -0.35 : 1.1 },
    uThaw: { value: -0.1 },
    uPixelRatio: { value: 1 },
    uScale: { value: 1 },
  }

  // ── The bear: groups pivot him (tilt at the centre, squash at the feet) ────
  const root = new Group()
  const tilt = new Group()
  const squash = new Group()
  const breath = new Group()
  const body = new Group()
  squash.position.y = -0.5
  body.position.y = 0.5
  root.add(tilt)
  tilt.add(squash)
  squash.add(breath)
  breath.add(body)
  scene.add(root)

  const bearUniforms = {
    uMap: { value: map },
    uRelief: shared.uRelief,
    uDepth: shared.uDepth,
    uAspect: shared.uAspect,
    uFreeze: shared.uFreeze,
    uThaw: shared.uThaw,
    uPoke: { value: new Vector4(0.5, 0.5, 0, 10) },
    uOpacity: { value: 1 },
    uLight: { value: new Vector2() },
    uRimA: { value: new Vector3() },
    uRimB: { value: new Vector3() },
    uIce: { value: new Vector3() },
    uRim: { value: 0.7 },
    uFrost: { value: -1 },
    uGlint: { value: -1 },
    uLens: { value: new Vector4(...LENS_BOX) },
  }
  const bear = new Mesh(
    track(new PlaneGeometry(ICE_BEAR_ASPECT, 1, lowPower ? 60 : 96, lowPower ? 100 : 160)),
    track(material({ vertexShader: glsl.bearVertex, fragmentShader: glsl.bearFragment, uniforms: bearUniforms })),
  )
  bear.renderOrder = 2
  bear.frustumCulled = false
  body.add(bear)

  // Coffee steam, rising from the lid and drifting off to the right.
  const steamUniforms = { uTime: shared.uTime, uOpacity: { value: 0 }, uColor: { value: new Vector3(1, 1, 1) } }
  const steamSize = 0.26
  const steam = new Mesh(
    track(new PlaneGeometry(steamSize, steamSize)),
    track(material({ vertexShader: glsl.steamVertex, fragmentShader: glsl.steamFragment, uniforms: steamUniforms })),
  )
  steam.position.set((CUP_LID[0] - 0.5) * ICE_BEAR_ASPECT + 0.06, CUP_LID[1] - 0.5 + steamSize / 2, DEPTH + 0.01)
  steam.renderOrder = 3
  steam.frustumCulled = false
  body.add(steam)

  // ── Orbit ring: one torus, drawn twice (the half behind him, then in front) ─
  const ring = new Group()
  ring.position.set(0.02, -0.04, 0)
  // Seen slightly from above: the far side passes behind his head, the near side over his legs.
  ring.rotation.set(-1.22, 0.16, -0.34)
  ring.scale.setScalar(0.6)
  tilt.add(ring)
  const ringShared = {
    uTime: shared.uTime,
    uOpacity: { value: 1 },
    uDraw: { value: options.intro ? 0 : 1 },
    uColorA: { value: new Vector3() },
    uColorB: { value: new Vector3() },
    uLocal: { value: ring.matrix },
    uPlaneZ: { value: DEPTH * 0.5 },
  }
  const ringGeometry = track(new TorusGeometry(1, 0.0065, 6, 360))
  for (const side of [-1, 1]) {
    const half = new Mesh(
      ringGeometry,
      track(material({
        vertexShader: glsl.ringVertex,
        fragmentShader: glsl.ringFragment,
        uniforms: { ...ringShared, uSide: { value: side } },
      })),
    )
    half.renderOrder = side < 0 ? 1 : 4
    half.frustumCulled = false
    ring.add(half)
  }

  // ── Snow particles: bear texel ↔ portrait point, paired top to bottom ──────
  const sampleHeight = Math.round(SAMPLE_WIDTH / ICE_BEAR_ASPECT)
  const bearPixels = readPixels(image, SAMPLE_WIDTH, sampleHeight)
  let opaque = 0
  for (let i = 3; i < bearPixels.data.length; i += 4) if (bearPixels.data[i] >= 160) opaque++
  const silhouetteShare = opaque / (SAMPLE_WIDTH * sampleHeight)
  const { uv: bearUv, color: bearColor } = sampleSilhouette(bearPixels, particleCount, random)

  const destination = document.querySelector<HTMLElement>('[data-portrait-destination]')
  const destinationImage = destination?.querySelector('img') ?? null
  const destinationBox = destination?.getBoundingClientRect()
  const archAspect = destinationBox && destinationBox.width > 0 ? destinationBox.height / destinationBox.width : 1.25
  const targetUv = pairByHeight(bearUv, sampleArch(particleCount, archAspect, random), random)
  const targetColor = new BufferAttribute(colorArch(targetUv, 1 / archAspect, null), 4)

  const particleGeometry = track(new BufferGeometry())
  particleGeometry.setAttribute('position', new BufferAttribute(new Float32Array(particleCount * 3), 3))
  particleGeometry.setAttribute('aUv', new BufferAttribute(bearUv, 2))
  particleGeometry.setAttribute('aColor', new BufferAttribute(bearColor, 3))
  particleGeometry.setAttribute('aTarget', new BufferAttribute(targetUv, 2))
  particleGeometry.setAttribute('aTargetColor', targetColor)
  particleGeometry.setAttribute('aSeed', new BufferAttribute(Float32Array.from({ length: particleCount * 4 }, random), 4))
  const particleUniforms = {
    uRelief: shared.uRelief,
    uBear: { value: bear.matrixWorld },
    uAspect: shared.uAspect,
    uDepth: shared.uDepth,
    uScale: shared.uScale,
    uPortrait: { value: new Vector4() },
    uHasPortrait: { value: destination ? 1 : 0 },
    uTime: shared.uTime,
    uFreeze: shared.uFreeze,
    uThaw: shared.uThaw,
    uStorm: { value: options.intro ? 0 : 1 },
    uHandoff: { value: 0 },
    uReveal: { value: 0 },
    uSnow: { value: new Vector3() },
    uPixelRatio: shared.uPixelRatio,
    uBearDot: { value: 3 },
    uPortraitDot: { value: 4 },
  }
  const particles = new Points(
    particleGeometry,
    track(material({ vertexShader: glsl.particleVertex, fragmentShader: glsl.particleFragment, uniforms: particleUniforms })),
  )
  particles.renderOrder = 5
  particles.frustumCulled = false
  scene.add(particles)

  // ── Ambient snow over the hero, and the burst when he is poked ─────────────
  const ambientGeometry = track(new BufferGeometry())
  ambientGeometry.setAttribute('position', new BufferAttribute(new Float32Array(AMBIENT_COUNT * 3), 3))
  ambientGeometry.setAttribute('aSeed', new BufferAttribute(Float32Array.from({ length: AMBIENT_COUNT * 4 }, random), 4))
  const ambientUniforms = {
    uView: { value: new Vector2(1, 1) },
    uOffset: { value: new Vector2() },
    uPointer: { value: new Vector2() },
    uTime: shared.uTime,
    uPixelRatio: shared.uPixelRatio,
    uOpacity: { value: 1 },
    uColor: { value: new Vector3() },
  }
  const ambient = new Points(
    ambientGeometry,
    track(material({ vertexShader: glsl.ambientVertex, fragmentShader: glsl.dotFragment, uniforms: ambientUniforms })),
  )
  ambient.renderOrder = 0
  ambient.frustumCulled = false
  scene.add(ambient)

  const burstDirections = new Float32Array(BURST_COUNT * 4)
  for (let i = 0; i < BURST_COUNT; i++) {
    const theta = random() * Math.PI * 2
    const phi = Math.acos(random() * 2 - 1)
    burstDirections[i * 4] = Math.sin(phi) * Math.cos(theta)
    burstDirections[i * 4 + 1] = Math.abs(Math.cos(phi)) * 0.8 + 0.2
    burstDirections[i * 4 + 2] = Math.sin(phi) * Math.sin(theta)
    burstDirections[i * 4 + 3] = 0.4 + random() * 0.6
  }
  const burstGeometry = track(new BufferGeometry())
  burstGeometry.setAttribute('position', new BufferAttribute(new Float32Array(BURST_COUNT * 3), 3))
  burstGeometry.setAttribute('aDir', new BufferAttribute(burstDirections, 4))
  const burstUniforms = {
    uOrigin: { value: new Vector3() },
    uAge: { value: 99 },
    uScale: shared.uScale,
    uPixelRatio: shared.uPixelRatio,
    uColor: { value: new Vector3() },
  }
  const burst = new Points(
    burstGeometry,
    track(material({ vertexShader: glsl.burstVertex, fragmentShader: glsl.dotFragment, uniforms: burstUniforms })),
  )
  burst.renderOrder = 6
  burst.frustumCulled = false
  burst.visible = false
  scene.add(burst)

  // ── Theme ──────────────────────────────────────────────────────────────────
  let palette = readPalette()
  const applyTheme = () => {
    palette = readPalette()
    bearUniforms.uRimA.value.fromArray(palette.rimA)
    bearUniforms.uRimB.value.fromArray(palette.rimB)
    bearUniforms.uIce.value.fromArray(palette.ice)
    bearUniforms.uRim.value = palette.rim
    particleUniforms.uSnow.value.fromArray(palette.snow)
    burstUniforms.uColor.value.fromArray(palette.snow)
    ringShared.uColorA.value.fromArray(palette.ringA)
    ringShared.uColorB.value.fromArray(palette.ringB)
    ambientUniforms.uColor.value.fromArray(palette.ambient)
    ambientUniforms.uOpacity.value = palette.ambientOpacity
    steamUniforms.uColor.value.fromArray(palette.steam)
  }
  applyTheme()
  const themeObserver = new MutationObserver(applyTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  // ── Scroll story: thaw → stream into the portrait → the real photo ─────────
  const story = { handoff: 0, reveal: 0, ring: 1, spread: 1 }
  const range = { start: 0, end: 1 }
  const measureRange = () => {
    const scrollY = window.scrollY
    const heroBox = hero.getBoundingClientRect()
    range.start = heroBox.top + scrollY + Math.min(80, window.innerHeight * 0.08)
    let end = range.start + heroBox.height * 0.8
    if (destination) {
      const box = destination.getBoundingClientRect()
      // Ends when the portrait sits in the middle of the screen.
      end = box.top + scrollY - Math.max(110, (window.innerHeight - box.height) / 2)
    }
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight - 1
    range.end = Math.max(range.start + 200, Math.min(end, maxScroll))
  }
  measureRange()
  const storyTimeline = gsap
    .timeline({ paused: true, defaults: { ease: 'none' } })
    .fromTo(shared.uThaw, { value: -0.1 }, { value: 1.5, duration: 0.5 }, 0.02)
    .fromTo(story, { handoff: 0 }, { handoff: 1, duration: 0.58 }, 0.26)
    .fromTo(story, { reveal: 0 }, { reveal: 1, duration: 0.12 }, 0.86)
    .fromTo(story, { ring: 1, spread: 1 }, { ring: 0, spread: 1.4, duration: 0.3 }, 0)
  const trigger = ScrollTrigger.create({
    start: () => range.start,
    end: () => range.end,
    // Lenis already smooths wheel scrolling; touch scrolling gets a little lag.
    scrub: getLenisInstance() ? true : 0.6,
    animation: storyTimeline,
    onRefreshInit: measureRange,
  })

  // The portrait (and its floating notes) appear only once the snow has formed it.
  const details = Array.from(document.querySelectorAll<HTMLElement>('[data-portrait-detail]'))
  const detailReveal = details.length
    ? animate(details, { opacity: [0, 1], translateY: [14, 0], duration: 1000, autoplay: false, ease: 'outCubic' })
    : null
  const destinationOpacity = destination?.style.opacity ?? ''
  let shownReveal = -1
  const applyReveal = (value: number) => {
    if (Math.abs(value - shownReveal) < 0.002) return
    shownReveal = value
    if (destination) destination.style.opacity = value >= 1 ? destinationOpacity : String(value)
    detailReveal?.seek(value * 1000)
  }
  applyReveal(story.reveal)

  // The snow takes the portrait's colours, read once from the page's own <img>.
  let portraitColours: 'idle' | 'waiting' | 'done' = 'idle'
  const colourPortrait = () => {
    if (portraitColours === 'done' || !destinationImage || disposed) return
    if (!destinationImage.complete || !destinationImage.naturalWidth) {
      if (portraitColours === 'idle') {
        portraitColours = 'waiting'
        destinationImage.addEventListener('load', colourPortrait, { once: true })
      }
      return
    }
    portraitColours = 'done'
    try {
      const height = Math.max(1, Math.round((PORTRAIT_SAMPLE_WIDTH * destinationImage.naturalHeight) / destinationImage.naturalWidth))
      const pixels = readPixels(destinationImage, PORTRAIT_SAMPLE_WIDTH, height)
      targetColor.copyArray(colorArch(targetUv, 1 / archAspect, pixels))
      targetColor.needsUpdate = true
    } catch {
      // A cross-origin photo can't be read back: keep the frosty gradient.
    }
  }

  // ── Intro, idle glint, poke ────────────────────────────────────────────────
  const glintLoop = gsap.fromTo(
    bearUniforms.uGlint,
    { value: 1.0 },
    { value: 1.9, duration: 0.8, ease: 'power2.inOut', repeat: -1, repeatDelay: 6.5, paused: true, immediateRender: false },
  )
  const intro = gsap.timeline({ paused: true })
  if (options.intro) {
    intro
      .to(particleUniforms.uStorm, { value: 1, duration: 0.6, ease: 'power1.out' }, 0)
      .to(shared.uFreeze, { value: 1.1, duration: 2.5, ease: 'power1.inOut' }, 0.2)
      .to(ringShared.uDraw, { value: 1, duration: 1.8, ease: 'power3.inOut' }, 0.5)
      .fromTo(bearUniforms.uFrost, { value: -0.3 }, { value: 1.3, duration: 1, ease: 'sine.inOut' }, 2.5)
      .call(() => options.onIntroDone(), undefined, 2.6)
      .fromTo(bearUniforms.uGlint, { value: 1.0 }, { value: 1.9, duration: 0.7, ease: 'power2.inOut' }, 3.0)
  } else {
    intro
      .fromTo(bearUniforms.uFrost, { value: -0.3 }, { value: 1.3, duration: 1, ease: 'sine.inOut' }, 0.1)
      .call(() => options.onIntroDone(), undefined, 0.2)
      .fromTo(bearUniforms.uGlint, { value: 1.0 }, { value: 1.9, duration: 0.7, ease: 'power2.inOut' }, 0.6)
  }
  intro.call(() => void glintLoop.play(), undefined, '+=5')

  let pokeTime = -10
  const poke = (u: number, v: number) => {
    if (disposed) return
    pokeTime = shared.uTime.value
    bearUniforms.uPoke.value.set(u, v, 1, 0)
    gsap.fromTo(squash.scale, { x: 1.07, y: 0.9 }, { x: 1, y: 1, duration: 1.2, ease: 'elastic.out(1, 0.32)', overwrite: 'auto' })
    gsap.fromTo(bearUniforms.uFrost, { value: -0.3 }, { value: 1.3, duration: 0.9, ease: 'sine.inOut', overwrite: 'auto' })
    root.updateMatrixWorld(true)
    burstUniforms.uOrigin.value.copy(bear.localToWorld(new Vector3((u - 0.5) * ICE_BEAR_ASPECT, v - 0.5, DEPTH)))
  }

  // ── Input, visibility, resizing ────────────────────────────────────────────
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  let lean = 0
  let viewWidth = 0
  let viewHeight = 0
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    const box = anchor.getBoundingClientRect()
    pointer.tx = gsap.utils.clamp(-1, 1, (event.clientX - (box.left + box.width / 2)) / (window.innerWidth * 0.45))
    pointer.ty = gsap.utils.clamp(-1, 1, (event.clientY - (box.top + box.height / 2)) / (window.innerHeight * 0.45))
  }
  const onPointerLeave = () => {
    pointer.tx = 0
    pointer.ty = 0
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  document.documentElement.addEventListener('pointerleave', onPointerLeave)

  let heroVisible = true
  const visibility = new IntersectionObserver(([entry]) => {
    heroVisible = entry.isIntersecting
  })
  visibility.observe(hero)

  let refreshQueued = 0
  const queueRefresh = () => {
    if (refreshQueued) return
    refreshQueued = requestAnimationFrame(() => {
      refreshQueued = 0
      ScrollTrigger.refresh()
    })
  }
  const resizeObserver = new ResizeObserver(queueRefresh)
  resizeObserver.observe(hero)
  if (destination) resizeObserver.observe(destination)
  document.fonts?.ready.then(() => {
    if (!disposed) queueRefresh()
  })

  const onContextLost = (event: Event) => {
    event.preventDefault()
    options.onContextLost()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  const resize = () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (!width || !height) return false
    if (width === viewWidth && height === viewHeight) return true
    viewWidth = width
    viewHeight = height
    const ratio = Math.min(window.devicePixelRatio || 1, maxPixelRatio)
    renderer.setPixelRatio(ratio)
    renderer.setSize(width, height, false)
    shared.uPixelRatio.value = ratio
    camera.left = -width / 2
    camera.right = width / 2
    camera.top = height / 2
    camera.bottom = -height / 2
    camera.updateProjectionMatrix()
    return true
  }

  // ── Frame loop (GSAP's ticker, which also drives Lenis and ScrollTrigger) ──
  let shown = false
  let ready = false
  const show = (visible: boolean) => {
    if (visible === shown) return
    shown = visible
    canvas.toggleAttribute('data-active', visible)
  }

  const tick = (_time: number, deltaMs: number) => {
    if (disposed) return
    const dt = Math.min(deltaMs, 50) / 1000
    shared.uTime.value += dt
    const t = shared.uTime.value
    // DOM side of the story first: it must settle even on frames that draw nothing.
    applyReveal(story.reveal)
    // The timeline's own progress (it lags the scroll position when scrub smooths it).
    const progress = storyTimeline.progress()
    if (!(heroVisible || (progress > 0 && progress < 1)) || !resize()) {
      show(false)
      return
    }

    // Sit exactly on the picture's box.
    const box = anchor.getBoundingClientRect()
    root.position.set(box.left + box.width / 2 - viewWidth / 2, viewHeight / 2 - (box.top + box.height / 2), 0)
    root.scale.setScalar(box.height)
    shared.uScale.value = box.height

    // Turn towards the pointer (touch screens: a slow idle sway), lean with scroll speed.
    const targetX = finePointer ? pointer.tx : Math.sin(t * 0.45) * 0.55
    const targetY = finePointer ? pointer.ty : Math.sin(t * 0.31) * 0.25
    const ease = 1 - Math.exp(-dt * 3.2)
    pointer.x += (targetX - pointer.x) * ease
    pointer.y += (targetY - pointer.y) * ease
    lean += (gsap.utils.clamp(-0.18, 0.18, (getLenisInstance()?.velocity ?? 0) * 0.004) - lean) * ease
    tilt.rotation.set(pointer.y * 0.16 + lean, pointer.x * 0.34, 0)
    tilt.position.y = Math.sin(t * 0.9) * 0.008
    breath.scale.set(1 - Math.sin(t * 1.7) * 0.002, 1 + Math.sin(t * 1.7) * 0.006, 1)
    bearUniforms.uLight.value.set(pointer.x, -pointer.y)

    const sincePoke = t - pokeTime
    bearUniforms.uPoke.value.w = sincePoke
    burstUniforms.uAge.value = sincePoke
    burst.visible = sincePoke < 1.2

    // Scroll story.
    const freeze = shared.uFreeze.value
    const thaw = shared.uThaw.value
    particleUniforms.uHandoff.value = story.handoff
    particleUniforms.uReveal.value = story.reveal
    if (destination && story.handoff > 0) {
      colourPortrait()
      const d = destination.getBoundingClientRect()
      particleUniforms.uPortrait.value.set(d.left + d.width / 2 - viewWidth / 2, viewHeight / 2 - (d.top + d.height / 2), d.width, d.height)
      particleUniforms.uPortraitDot.value = Math.sqrt((archCoverage(archAspect) * d.width * d.height) / particleCount) * 1.45
    }
    particleUniforms.uBearDot.value = Math.sqrt((silhouetteShare * ICE_BEAR_ASPECT * box.height * box.height) / particleCount) * 1.5

    ringShared.uOpacity.value = story.ring
    ring.scale.setScalar(0.6 * story.spread)
    steamUniforms.uOpacity.value = palette.steamOpacity * clamp01((freeze - 0.75) / 0.3) * clamp01(1 - (thaw - 0.2) / 0.2)

    // Draw only what can be seen.
    bear.visible = freeze > -0.05 && thaw < 1.05
    particles.visible = (freeze < 1.1 || thaw > -0.05) && story.reveal < 1
    ring.visible = story.ring > 0.001 && ringShared.uDraw.value > 0.001
    steam.visible = steamUniforms.uOpacity.value > 0.001
    ambient.visible = heroVisible

    const heroBox = hero.getBoundingClientRect()
    ambientUniforms.uView.value.set(heroBox.width, heroBox.height)
    ambientUniforms.uOffset.value.set(
      heroBox.left + heroBox.width / 2 - viewWidth / 2,
      viewHeight / 2 - (heroBox.top + heroBox.height / 2),
    )
    ambientUniforms.uPointer.value.set(pointer.x, -pointer.y)

    root.updateMatrixWorld(true)
    renderer.render(scene, camera)
    show(true)
    if (!ready) {
      ready = true
      options.onReady()
      intro.play()
    }
  }
  gsap.ticker.add(tick)

  const dispose = () => {
    if (disposed) return
    disposed = true
    gsap.ticker.remove(tick)
    intro.kill()
    glintLoop.kill()
    trigger.kill()
    storyTimeline.kill()
    gsap.killTweensOf([squash.scale, bearUniforms.uFrost])
    if (refreshQueued) cancelAnimationFrame(refreshQueued)
    resizeObserver.disconnect()
    visibility.disconnect()
    themeObserver.disconnect()
    window.removeEventListener('pointermove', onPointerMove)
    document.documentElement.removeEventListener('pointerleave', onPointerLeave)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    destinationImage?.removeEventListener('load', colourPortrait)
    detailReveal?.revert()
    if (destination) destination.style.opacity = destinationOpacity
    show(false)
    for (const item of disposables) item.dispose()
  }

  return { poke, dispose }
}
