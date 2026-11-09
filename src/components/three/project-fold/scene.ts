import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Raycaster,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three'
import { Spring, readCssColor, roundedPlane, slabGeometry } from '../kit'
import { CHROME_HEIGHT, FACE_HEIGHT, FACE_WIDTH, drawFace, type FaceColors } from './face'
import { hingeAfter, layoutFold, type Quad } from './layout'

// The featured projects as a concertina of paper-flat screens, each hinged to
// the next. The panel in focus faces the visitor, its neighbours fold back beside
// it and the rest tuck away behind, lit by one light so each face reads as a
// single flat tone. A click, a drag or the list beside it all move the same
// `focus` spring, so the chain travels as one object. One flat accent marks the
// open panel; there are no glows, gradients or reflections.
//
// Vanilla Three.js, loaded after hydration. It draws a frame only when something
// moved, and only while on screen. In `still` mode (reduced motion) it draws one
// frame per change. The DOM window underneath stays the no-WebGL experience.

export interface FoldPanelInput {
  number: string
  host: string | null
  monogram: string
  cover: { src: string; srcSet?: string; sizes?: string } | null
}

export interface FoldSceneOptions {
  canvas: HTMLCanvasElement
  panels: readonly FoldPanelInput[]
  active: number
  /** Render one frame per change instead of animating. */
  still: boolean
  /** Runs the chain right to left. Pictures are never mirrored. */
  rtl: boolean
  onReady: () => void
  onContextLost: () => void
  /** A click on a folded panel, or a drag that reached another one. */
  onSelect: (index: number) => void
  /** A click on the panel in focus. `newTab` for a ctrl/cmd or middle click. */
  onOpen: (index: number, newTab: boolean) => void
  onHover: (index: number | null) => void
  /** The focused panel's screen in canvas CSS pixels, on each frame while it rests; null once it moves. */
  onRest?: (screen: Quad | null) => void
}

export interface FoldScene {
  setActive: (index: number) => void
  setPeek: (index: number | null) => void
  /** How far the concertina has unfolded, 0..1 (follows the scroll). */
  setOpen: (progress: number) => void
  setStill: (still: boolean) => void
  dispose: () => void
}

const PANEL_WIDTH = 3.2
const PANEL_HEIGHT = (PANEL_WIDTH * FACE_HEIGHT) / FACE_WIDTH
const PANEL_DEPTH = 0.07
const PANEL_RADIUS = 0.09
/** The slab shows around the face as a thin frame: it carries the accent. */
const FRAME_WIDTH = 0.02
const HINGE_GAP = 0.03
const LINK = PANEL_WIDTH + HINGE_GAP
const FOLD = 1.16
/** cos(fold), near enough: where a panel counts as fully folded. */
const FOLDED_COS = 0.4
/**
 * How much a tucked panel sinks. Further back reads higher on screen, so at full
 * height its top would show over the panels in front of it; it drops out of sight
 * as it tucks, and is only drawn while it can be seen.
 */
const TUCK_SINK = 0.25
/** The panels stand on the floor. */
const FLOOR_Y = -PANEL_HEIGHT / 2 - 0.012
/** Where a panel's flat shadow reaches on the floor, toward the viewer and away from the light. */
const SHADOW_X = 0.12
const SHADOW_Z = 0.85
const CAMERA_FOV = 24
const CAMERA_ELEVATION = 0.19
const LOOK_Y = -0.14
/**
 * What the camera must show: half the height, and half the width around the
 * focused panel. Wide enough to keep a neighbour's far edge in view at rest, so
 * nothing ends on the canvas border; on a phone the screen's edge can cut it.
 */
const VIEW_HALF_HEIGHT = 1.5
const VIEW_HALF_WIDTH = 2.33
const VIEW_HALF_WIDTH_NARROW = 2
const NARROW_CANVAS = 560
/** Shifts the focused panel away from the side where the rest of the chain lies. */
const BALANCE = 0.2
const DRAG_THRESHOLD = 8
const REST_DISTANCE = 0.004

const FACE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** The picture, one flat tone per panel; exact when flat, so it matches the live demo laid over it. */
const FACE_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uMap;
  uniform float uLit;
  uniform vec3 uShade;
  void main() {
    gl_FragColor = vec4(mix(uShade, texture2D(uMap, vUv).rgb, uLit), 1.0);
    #include <colorspace_fragment>
  }
`

interface Palette {
  dark: boolean
  accent: Color
  /** What a panel's picture falls off toward as it folds. */
  shade: Color
  /** Brightness of a fully folded panel, turned away from the light and toward it. */
  litAway: number
  litToward: number
  body: Color
  hinge: Color
  shadow: Color
  key: number
  hemisphere: [Color, Color, number]
  face: FaceColors
}

/** Colours follow the theme and the admin-picked primary colour (--primary). */
function readPalette(): Palette {
  const root = document.documentElement
  const style = getComputedStyle(root)
  const read = (name: string) => style.getPropertyValue(name).trim()
  const accent = readCssColor(read('--primary'), '#2563EB')
  const dark = root.classList.contains('dark')
  const face: FaceColors = {
    bar: read('--secondary'),
    line: read('--border'),
    screen: read('--background'),
    pill: read('--background'),
    pillText: read('--muted-foreground'),
    monogram: read('--primary-text'),
  }
  if (dark) {
    return {
      dark,
      accent,
      shade: new Color('#050506'),
      litAway: 0.3,
      litToward: 0.55,
      body: new Color('#3A3A40'),
      hinge: new Color('#55555C'),
      shadow: new Color('#161618'),
      key: 2.4,
      hemisphere: [new Color('#FFFFFF'), new Color('#303036'), 1.2],
      face,
    }
  }
  return {
    dark,
    accent,
    shade: new Color('#C8D1DD'),
    litAway: 0.5,
    litToward: 0.8,
    body: new Color('#D3DAE4'),
    hinge: new Color('#A7B2C2'),
    shadow: new Color('#E2E8F0'),
    key: 1.7,
    hemisphere: [new Color('#FFFFFF'), new Color('#CBD5E1'), 1.7],
    face,
  }
}

interface Panel {
  group: Group
  body: Mesh
  bodyMaterial: MeshLambertMaterial
  faceMaterial: ShaderMaterial
  canvas: HTMLCanvasElement
  texture: CanvasTexture
  cover: HTMLImageElement | null
  peek: Spring
}

function rubberBand(value: number, low: number, high: number) {
  if (value < low) return low + (value - low) * 0.25
  if (value > high) return high + (value - high) * 0.25
  return value
}

function loadImage(source: NonNullable<FoldPanelInput['cover']>): Promise<HTMLImageElement> {
  const image = new Image()
  // Same URLs as the DOM window's <img>, so the browser reuses what it already has.
  image.crossOrigin = 'anonymous'
  image.decoding = 'async'
  if (source.srcSet) image.srcset = source.srcSet
  if (source.sizes) image.sizes = source.sizes
  image.src = source.src
  return image.decode().then(() => image)
}

/** Throws when WebGL is unavailable (the caller keeps the DOM window). */
export function createFoldScene(options: FoldSceneOptions): FoldScene {
  const { canvas, rtl } = options
  const count = options.panels.length
  const lastIndex = count - 1
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const lowPower = coarse || (navigator.hardwareConcurrency || 8) <= 4
  const maxPixelRatio = lowPower ? 1.5 : 1.75
  const side = rtl ? -1 : 1
  const fontFamily = getComputedStyle(document.body).fontFamily || 'sans-serif'

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 1, 60)
  const halfTan = Math.tan(MathUtils.degToRad(CAMERA_FOV / 2))

  let still = options.still
  let disposed = false
  let palette = readPalette()
  const disposables: { dispose: () => void }[] = [renderer]
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item)
    return item
  }

  // One white light, from the side the chain starts on, so the pleats alternate.
  const key = new DirectionalLight(0xffffff, palette.key)
  key.position.set(side * -3.5, 6, 6)
  const hemisphere = new HemisphereLight(0xffffff, 0x000000, 1)
  scene.add(key, hemisphere)

  // ── The chain ────────────────────────────────────────────────────────────
  const rig = new Group()
  scene.add(rig)

  const slab = track(slabGeometry(PANEL_WIDTH, PANEL_HEIGHT, PANEL_DEPTH, PANEL_RADIUS, 0.012))
  const faceWidth = PANEL_WIDTH - FRAME_WIDTH * 2
  const faceHeight = PANEL_HEIGHT - FRAME_WIDTH * 2
  const faceGeometry = track(roundedPlane(faceWidth, faceHeight, PANEL_RADIUS - FRAME_WIDTH / 2))

  const faceScale = lowPower ? 0.75 : 1
  const panels: Panel[] = options.panels.map((_, index) => {
    const group = new Group()
    const bodyMaterial = track(new MeshLambertMaterial())
    const body = new Mesh(slab, bodyMaterial)
    body.userData.index = index
    group.add(body)

    const faceCanvas = document.createElement('canvas')
    faceCanvas.width = Math.round(FACE_WIDTH * faceScale)
    faceCanvas.height = Math.round(FACE_HEIGHT * faceScale)
    const texture = track(new CanvasTexture(faceCanvas))
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())

    const faceMaterial = track(
      new ShaderMaterial({
        vertexShader: FACE_VERTEX,
        fragmentShader: FACE_FRAGMENT,
        uniforms: {
          uMap: { value: texture },
          uLit: { value: 1 },
          uShade: { value: new Color() },
        },
      }),
    )
    const face = new Mesh(faceGeometry, faceMaterial)
    face.position.z = PANEL_DEPTH / 2 + 0.0015
    group.add(face)
    rig.add(group)

    return { group, body, bodyMaterial, faceMaterial, canvas: faceCanvas, texture, cover: null, peek: new Spring(0, 90, 14) }
  })
  const bodies: Object3D[] = panels.map((panel) => panel.body)

  // A thin line where two screens meet.
  const hingeGeometry = track(new CylinderGeometry(0.012, 0.012, PANEL_HEIGHT * 0.94, 6))
  const hinges = Array.from({ length: Math.max(0, lastIndex) }, () => {
    const hinge = new Mesh(hingeGeometry, track(new MeshBasicMaterial()))
    rig.add(hinge)
    return hinge
  })

  // Flat, hard-edged shadows on the floor: one quad per panel, one solid colour,
  // so where they overlap they merge instead of getting darker.
  const shadowPositions = new Float32Array(count * 4 * 3)
  const shadowGeometry = track(new BufferGeometry())
  const shadowAttribute = new BufferAttribute(shadowPositions, 3)
  shadowAttribute.setUsage(DynamicDrawUsage)
  shadowGeometry.setAttribute('position', shadowAttribute)
  shadowGeometry.setIndex(
    Array.from({ length: count }, (_, index) => {
      const first = index * 4
      return [first, first + 1, first + 2, first, first + 2, first + 3]
    }).flat(),
  )
  const shadowMaterial = track(new MeshBasicMaterial({ side: DoubleSide, depthWrite: false }))
  const shadows = new Mesh(shadowGeometry, shadowMaterial)
  shadows.frustumCulled = false
  shadows.renderOrder = -1
  rig.add(shadows)

  // ── State ────────────────────────────────────────────────────────────────
  let active = MathUtils.clamp(options.active, 0, lastIndex)
  const focus = new Spring(active, 58, 11)
  const openness = new Spring(still ? 1 : 0, 34, 10)
  const tiltYaw = new Spring(0, 26, 8)
  const tiltHeight = new Spring(0, 26, 8)
  let openKnown = false
  let width = 1
  let height = 1
  let distance = 10
  let peeked: number | null = null
  let hovered: number | null = null
  let hoverPoint: { x: number; y: number } | null = null
  let resting = false
  /** Something changed outside the springs (texture, theme, drag): draw the next frame. */
  let dirty = true
  const peeks = panels.map(() => 0)

  // ── Painting ─────────────────────────────────────────────────────────────
  const paintFace = (index: number) => {
    const panel = panels[index]
    const { number, host, monogram } = options.panels[index]
    drawFace(panel.canvas, { number, host, monogram, cover: panel.cover }, palette.face, fontFamily)
    panel.texture.needsUpdate = true
    dirty = true
  }

  const paint = () => {
    palette = readPalette()
    key.intensity = palette.key
    hemisphere.color.copy(palette.hemisphere[0])
    hemisphere.groundColor.copy(palette.hemisphere[1])
    hemisphere.intensity = palette.hemisphere[2]
    shadowMaterial.color.copy(palette.shadow)
    panels.forEach((panel, index) => {
      ;(panel.faceMaterial.uniforms.uShade.value as Color).copy(palette.shade)
      paintFace(index)
    })
  }

  /** Covers load nearest-first, so what the visitor sees next is ready first. */
  const loadCovers = async () => {
    const order = options.panels
      .map((_, index) => index)
      .sort((a, b) => Math.abs(a - active) - Math.abs(b - active))
    for (const index of order) {
      const source = options.panels[index].cover
      if (!source) continue
      try {
        const cover = await loadImage(source)
        if (disposed) return
        panels[index].cover = cover
        paintFace(index)
        if (still) render()
      } catch {
        // The panel keeps its monogram.
      }
    }
  }

  // ── Frame ────────────────────────────────────────────────────────────────
  const place = () => {
    const open = MathUtils.clamp(openness.value, 0, 1)
    panels.forEach((panel, index) => {
      peeks[index] = MathUtils.clamp(panel.peek.value, 0, 1)
    })
    const poses = layoutFold({ count, focus: focus.value, fold: FOLD, link: LINK, open, peek: peeks })
    const balance = -((lastIndex / 2 - focus.value) * BALANCE) * side

    poses.forEach((pose, index) => {
      const panel = panels[index]
      const x = pose.x * side + balance
      const yaw = pose.yaw * side
      // 0 beside the focus, 1 tucked away. Keeps its feet on the floor as it sinks.
      const tucked = MathUtils.smoothstep(Math.abs(index - focus.value), 1.3, 2) * open
      const sink = tucked * TUCK_SINK
      panel.group.visible = tucked < 0.999
      panel.group.position.set(x, (-sink * PANEL_HEIGHT) / 2, pose.z)
      panel.group.scale.y = 1 - sink
      panel.group.rotation.y = yaw

      // One flat tone per face, from its angle to the light; exact when flat.
      const flat = MathUtils.smoothstep(Math.cos(pose.yaw), FOLDED_COS, 1)
      const folded = pose.yaw > 0 ? palette.litAway : palette.litToward
      panel.faceMaterial.uniforms.uLit.value = MathUtils.lerp(MathUtils.lerp(folded, 1, flat), 1, peeks[index] * 0.5)

      // The accent travels with the focus: it marks the open panel's frame.
      const closeness = MathUtils.clamp(1 - Math.abs(index - focus.value), 0, 1)
      panel.bodyMaterial.color.lerpColors(palette.body, palette.accent, closeness * closeness * open)

      const halfX = (Math.cos(yaw) * PANEL_WIDTH) / 2
      const halfZ = (-Math.sin(yaw) * PANEL_WIDTH) / 2
      const reachX = SHADOW_X * side * (1 - tucked)
      const reachZ = SHADOW_Z * (1 - tucked)
      shadowPositions.set(
        [
          x - halfX, FLOOR_Y, pose.z - halfZ,
          x + halfX, FLOOR_Y, pose.z + halfZ,
          x + halfX + reachX, FLOOR_Y, pose.z + halfZ + reachZ,
          x - halfX + reachX, FLOOR_Y, pose.z - halfZ + reachZ,
        ],
        index * 12,
      )
    })
    shadowAttribute.needsUpdate = true

    hinges.forEach((hinge, index) => {
      const at = hingeAfter(poses[index], LINK)
      hinge.position.set(at.x * side + balance, 0, at.z)
      // Joins the open panel's frame: same accent on the hinges beside it.
      const closeness = MathUtils.clamp(1 - Math.min(Math.abs(index - focus.value), Math.abs(index + 1 - focus.value)), 0, 1)
      ;(hinge.material as MeshBasicMaterial).color.lerpColors(palette.hinge, palette.accent, closeness * open)
    })
    rig.rotation.y = tiltYaw.value

    camera.position.set(
      0,
      LOOK_Y + Math.sin(CAMERA_ELEVATION) * distance + tiltHeight.value * 0.2,
      Math.cos(CAMERA_ELEVATION) * distance,
    )
    camera.lookAt(0, LOOK_Y, 0)
  }

  const corner = new Vector3()
  const screenCorners: readonly [number, number][] = (() => {
    const left = -faceWidth / 2
    const right = faceWidth / 2
    const bottom = -faceHeight / 2
    const top = faceHeight / 2 - (CHROME_HEIGHT / FACE_HEIGHT) * faceHeight
    return [[left, top], [right, top], [right, bottom], [left, bottom]]
  })()

  /** Tells the page where the focused screen is once it rests, for the live demo. */
  const reportRest = () => {
    if (!options.onRest) return
    const atRest =
      !dragging &&
      openness.value > 0.995 &&
      Math.abs(focus.value - active) < REST_DISTANCE &&
      Math.abs(focus.velocity) < 0.02
    if (!atRest) {
      if (resting) options.onRest(null)
      resting = false
      return
    }
    resting = true
    const group = panels[active].group
    const quad = screenCorners.map(([x, y]) => {
      corner.set(x, y, PANEL_DEPTH / 2 + 0.0015)
      group.localToWorld(corner)
      corner.project(camera)
      return { x: ((corner.x + 1) / 2) * width, y: ((1 - corner.y) / 2) * height }
    }) as unknown as Quad
    options.onRest(quad)
  }

  const render = () => {
    if (disposed) return
    place()
    renderer.render(scene, camera)
    reportRest()
  }

  const springs = () => [openness, tiltYaw, tiltHeight, ...panels.map((panel) => panel.peek)]

  const advance = (dt: number) => {
    let moved = dirty
    const step = (spring: Spring) => {
      if (spring.atRest()) {
        spring.snap()
        return
      }
      spring.step(dt)
      moved = true
    }
    if (dragging) moved = true
    else step(focus)
    springs().forEach(step)
    if (hoverPoint) {
      setHovered(pick(hoverPoint.x, hoverPoint.y))
      hoverPoint = null
    }
    return moved
  }

  /** Everything at its end state, for reduced motion. */
  const settle = () => {
    focus.target = active
    focus.snap()
    openness.target = 1
    tiltYaw.target = 0
    tiltHeight.target = 0
    springs().forEach((spring) => spring.snap())
  }

  // ── Input ────────────────────────────────────────────────────────────────
  const raycaster = new Raycaster()
  const pointerNdc = new Vector2()

  const pick = (clientX: number, clientY: number): number | null => {
    const box = canvas.getBoundingClientRect()
    pointerNdc.set(((clientX - box.left) / box.width) * 2 - 1, -((clientY - box.top) / box.height) * 2 + 1)
    raycaster.setFromCamera(pointerNdc, camera)
    // The raycaster doesn't skip hidden objects: a tucked panel must not catch the pointer.
    const hit = raycaster.intersectObjects(bodies, false).find(({ object }) => object.parent?.visible)
    return hit ? (hit.object.userData.index as number) : null
  }

  const updateCursor = () => {
    if (dragging) canvas.style.cursor = 'grabbing'
    else if (hovered !== null) canvas.style.cursor = 'pointer'
    else canvas.style.cursor = !still && count > 1 ? 'grab' : 'default'
  }

  const setHovered = (index: number | null) => {
    if (index === hovered) return
    hovered = index
    updateCursor()
    options.onHover(index)
  }

  const select = (index: number) => {
    focus.target = index
    if (index === active) return
    active = index
    options.onSelect(index)
  }

  let press: { id: number; x: number; y: number; focus: number; moved: boolean } | null = null
  let dragging = false
  let dragX = 0
  let dragTime = 0

  const onPress = (event: PointerEvent) => {
    if (event.button !== 0) return
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, focus: focus.value, moved: false }
  }

  const onPressMove = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return
    const dx = event.clientX - press.x
    const dy = event.clientY - press.y
    if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) press.moved = true
    if (!dragging) {
      if (still || count < 2 || Math.abs(dx) < DRAG_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return
      dragging = true
      dragX = event.clientX
      dragTime = event.timeStamp
      focus.velocity = 0
      canvas.setPointerCapture(event.pointerId)
      setHovered(null)
      updateCursor()
    }
    const pixelsPerStep = (height / (2 * halfTan * distance)) * PANEL_WIDTH * 0.9
    focus.value = rubberBand(press.focus - (side * dx) / pixelsPerStep, 0, lastIndex)
    const seconds = Math.max(0.001, (event.timeStamp - dragTime) / 1000)
    focus.velocity = (-(side * (event.clientX - dragX)) / pixelsPerStep) / seconds
    dragX = event.clientX
    dragTime = event.timeStamp
    select(MathUtils.clamp(Math.round(focus.value), 0, lastIndex))
  }

  const onRelease = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return
    const { moved } = press
    press = null
    if (dragging) {
      dragging = false
      updateCursor()
      focus.velocity = MathUtils.clamp(focus.velocity, -4, 4)
      select(MathUtils.clamp(Math.round(focus.value + focus.velocity * 0.14), 0, lastIndex))
      return
    }
    if (moved) return
    const index = pick(event.clientX, event.clientY)
    if (index === null) return
    if (index === active) {
      options.onOpen(index, event.ctrlKey || event.metaKey)
      return
    }
    select(index)
    if (still) {
      settle()
      render()
    }
  }

  const onPressCancel = (event: PointerEvent) => {
    if (!press || event.pointerId !== press.id) return
    press = null
    if (dragging) {
      dragging = false
      focus.target = active
      updateCursor()
    }
  }

  const onAuxClick = (event: MouseEvent) => {
    if (event.button === 1 && pick(event.clientX, event.clientY) === active) options.onOpen(active, true)
  }

  const onPointerMove = (event: PointerEvent) => {
    if (!finePointer) return
    const box = canvas.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width
    const y = (event.clientY - box.top) / box.height
    tiltYaw.target = still ? 0 : MathUtils.clamp((x - 0.5) * 2, -1.4, 1.4) * 0.05
    tiltHeight.target = still ? 0 : MathUtils.clamp((y - 0.5) * 2, -1.4, 1.4)
    if (dragging) return
    if (x < 0 || x > 1 || y < 0 || y > 1) {
      hoverPoint = null
      setHovered(null)
    } else if (still) {
      setHovered(pick(event.clientX, event.clientY))
    } else {
      // Checked once per frame, on the next `advance`.
      hoverPoint = { x: event.clientX, y: event.clientY }
    }
  }

  const onLeave = () => {
    hoverPoint = null
    setHovered(null)
  }

  // ── Loop ─────────────────────────────────────────────────────────────────
  let frame = 0
  let last = 0
  let onScreen = true
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop)
    // Never negative: a frame's timestamp can predate the clock reading that started the loop.
    const dt = MathUtils.clamp((now - last) / 1000, 0, 0.05)
    last = now
    if (!advance(dt)) return
    dirty = false
    render()
  }
  const syncLoop = () => {
    const run = !still && !disposed && onScreen && !document.hidden
    if (run && !frame) {
      last = performance.now()
      frame = requestAnimationFrame(loop)
    } else if (!run && frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  }

  const resize = () => {
    const box = canvas.getBoundingClientRect()
    width = Math.max(1, box.width)
    height = Math.max(1, box.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    const halfWidth = width < NARROW_CANVAS ? VIEW_HALF_WIDTH_NARROW : VIEW_HALF_WIDTH
    distance = Math.max(VIEW_HALF_HEIGHT / halfTan, halfWidth / (halfTan * camera.aspect))
    camera.far = distance + 30
    camera.updateProjectionMatrix()
    if (still) settle()
    render()
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = entry?.isIntersecting ?? true
    syncLoop()
  })
  visibility.observe(canvas)
  document.addEventListener('visibilitychange', syncLoop)

  const sizes = new ResizeObserver(resize)
  sizes.observe(canvas)

  // The theme is a class on <html>; the primary colour can follow visitor preferences.
  let paintedPrimary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
  const theme = new MutationObserver(() => {
    const dark = document.documentElement.classList.contains('dark')
    const primary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
    if (dark === palette.dark && primary === paintedPrimary) return
    paintedPrimary = primary
    paint()
    if (still) render()
  })
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })

  const onContextLost = (event: Event) => {
    event.preventDefault()
    options.onContextLost()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('pointerdown', onPress)
  canvas.addEventListener('pointermove', onPressMove)
  canvas.addEventListener('pointerup', onRelease)
  canvas.addEventListener('pointercancel', onPressCancel)
  canvas.addEventListener('pointerleave', onLeave)
  canvas.addEventListener('auxclick', onAuxClick)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  // The wheel moves the page under a still pointer: what it was over may be gone.
  window.addEventListener('scroll', onLeave, { passive: true })

  paint()
  resize()
  updateCursor()
  renderer.compile(scene, camera)
  render()
  options.onReady()
  syncLoop()
  void loadCovers()

  return {
    setActive: (index) => {
      active = MathUtils.clamp(index, 0, lastIndex)
      focus.target = active
      if (still) {
        settle()
        render()
      }
    },
    setPeek: (index) => {
      if (index === peeked) return
      peeked = index
      panels.forEach((panel, panelIndex) => {
        panel.peek.target = panelIndex === index && index !== active ? 1 : 0
      })
      if (still) {
        settle()
        render()
      }
    },
    setOpen: (progress) => {
      if (still) return
      const next = MathUtils.clamp(progress, 0, 1)
      // Already scrolled past on load: open at once instead of playing it off screen.
      if (!openKnown) openness.value = next
      openKnown = true
      openness.target = next
    },
    setStill: (value) => {
      if (value === still) return
      still = value
      if (still) {
        settle()
        render()
      }
      updateCursor()
      syncLoop()
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      syncLoop()
      visibility.disconnect()
      sizes.disconnect()
      theme.disconnect()
      document.removeEventListener('visibilitychange', syncLoop)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onLeave)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('pointerdown', onPress)
      canvas.removeEventListener('pointermove', onPressMove)
      canvas.removeEventListener('pointerup', onRelease)
      canvas.removeEventListener('pointercancel', onPressCancel)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('auxclick', onAuxClick)
      for (const item of disposables) item.dispose()
    },
  }
}
