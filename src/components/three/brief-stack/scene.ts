import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  LatheGeometry,
  LineBasicMaterial,
  LineLoop,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFSoftShadowMap,
  PMREMGenerator,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
  type WebGLRenderTarget,
} from 'three'
import { LOGIC_MODULES, type BriefPhase, type BriefSceneState } from '@/features/freelance/brief'
import {
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  drawBlueprint,
  drawDataTrack,
  drawDot,
  drawFloorGrid,
  drawScreen,
  type BlueprintKind,
  type ScreenColors,
  type ScreenId,
} from './textures'

// A web app in exploded view: interface on top, logic in the middle, data below,
// in one accent colour over neutral greys, with flat faces and no glow or gradient.
// It starts as a blueprint and the visitor's answers build it (see
// BriefSceneState): the project type draws on the screen, the budget lights the
// modules, the timeline sets how fast data moves, and every valid required field
// lights a ring. Sending closes the stack and launches it.
//
// Vanilla Three.js, loaded after hydration. It renders only while on screen, and
// in `still` mode (reduced motion) only when an answer changes, with no movement
// in between. All textures are drawn on canvases, so there is nothing to fetch.

export interface StagePoint {
  x: number
  y: number
}

export interface BriefSceneOptions {
  canvas: HTMLCanvasElement
  /** Render one frame per change instead of animating. */
  still: boolean
  /** Mirrors the composition for right-to-left pages. */
  rtl: boolean
  /** Share of the canvas width the model is moved toward the end side. */
  focusOffset: () => number
  onReady: () => void
  onContextLost: () => void
  /** Each layer's outer corner on the canvas, in CSS pixels, once per rendered frame. */
  onFrame?: (corners: readonly StagePoint[], width: number) => void
}

export interface BriefScene {
  update: (state: BriefSceneState) => void
  /** A keystroke: one bright packet runs up through the stack. */
  pulse: () => void
  setStill: (still: boolean) => void
  dispose: () => void
}

const SLAB_WIDTH = 3.5
const SLAB_DEPTH = (SLAB_WIDTH * SCREEN_HEIGHT) / SCREEN_WIDTH
const SLAB_HEIGHT = 0.1
const SLAB_RADIUS = 0.16
const OPEN_GAP = 1.2
const CLOSED_GAP_TOP = 0.34
const CLOSED_GAP_BOTTOM = 0.66
const BASE_YAW = 0.64
const CAMERA_ELEVATION = 0.5
const CAMERA_FOV = 24
/** The floor hangs below the stack: aiming a little lower centres the whole. */
const LOOK_Y = -0.3
const FLOOR_Y = -1.8
const FLOOR_RADIUS = 2.2
const BUILD_SECONDS = 1
const SCREEN_WIPE_SECONDS = 0.5
const LAUNCH_HEIGHT = 9
const PACKET_COUNT = 30
const DUST_COUNT = 70
const SPARK_COUNT = 90

/** Where the wires join each slab; also the corners of the module grid they pass by. */
const WIRE_X = 1.56
const WIRE_Z = 0.98
const WIRES: readonly (readonly [number, number])[] = [
  [-WIRE_X, -WIRE_Z],
  [WIRE_X, -WIRE_Z],
  [-WIRE_X, WIRE_Z],
  [WIRE_X, WIRE_Z],
]
/** Module nearest to each wire, flashed when a packet passes. */
const WIRE_MODULES = [0, 3, 8, 11]

const MODULE_COLUMNS = 4
const MODULE_ROWS = LOGIC_MODULES / MODULE_COLUMNS
const MODULE_WIDTH = 0.62
const MODULE_DEPTH = 0.44
const MODULE_HEIGHT = 0.15
const MODULE_STEP_X = 0.74
const MODULE_STEP_Z = 0.58

const DISC_RADIUS = 0.62
const DISC_HEIGHT = 0.115
const DISC_GAP = 0.045

class Spring {
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
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut = (t: number) => 1 - (1 - t) ** 3

function approach(value: number, target: number, step: number) {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step)
}

/** A CSS colour in any syntax, through the browser's own parser. */
function readCssColor(value: string, fallback: string): Color {
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

const css = (color: Color, alpha = 1) => {
  const { r, g, b } = color.clone().convertLinearToSRGB()
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`
}

interface Palette {
  dark: boolean
  accent: Color
  slab: Color
  module: Color
  disc: Color
  environment: number
  key: number
  hemisphere: [Color, Color, number]
  edgeOpacity: number
  wireOpacity: number
  gridOpacity: number
  dustOpacity: number
  orbitBase: number
  litEmissive: number
  screen: ScreenColors
}

/** Colours follow the theme and the admin-picked primary colour (--primary). */
function readPalette(): Palette {
  const root = document.documentElement
  const accent = readCssColor(getComputedStyle(root).getPropertyValue('--primary').trim(), '#2A6AFF')
  const dark = root.classList.contains('dark')
  if (dark) {
    return {
      dark,
      accent,
      slab: new Color('#1E1E21'),
      module: new Color('#2E2E33'),
      disc: new Color('#2A2A2E'),
      environment: 0.75,
      key: 2.2,
      hemisphere: [new Color('#FFFFFF'), new Color('#000000'), 0.5],
      edgeOpacity: 0.9,
      wireOpacity: 0.8,
      gridOpacity: 0.26,
      dustOpacity: 0.7,
      orbitBase: 0.4,
      litEmissive: 0.55,
      screen: {
        bg: '#0A0A0A',
        panel: '#171717',
        raised: '#262626',
        line: 'rgba(255,255,255,0.07)',
        ink: '#FAFAFA',
        muted: '#6B6B6B',
        accent: css(accent),
        accentSoft: css(accent, 0.3),
      },
    }
  }
  return {
    dark,
    accent,
    slab: new Color('#DCE2EB'),
    module: new Color('#F1F5F9'),
    disc: new Color('#E9EDF3'),
    environment: 0.65,
    key: 1.7,
    hemisphere: [new Color('#FFFFFF'), new Color('#B4BECC'), 0.95],
    edgeOpacity: 0.55,
    wireOpacity: 0.7,
    gridOpacity: 0.24,
    dustOpacity: 0.45,
    orbitBase: 0.45,
    litEmissive: 0.3,
    screen: {
      bg: '#FFFFFF',
      panel: '#F1F5F9',
      raised: '#E2E8F0',
      line: 'rgba(15,23,42,0.07)',
      ink: '#0B0F19',
      muted: '#A1ACBC',
      accent: css(accent),
      accentSoft: css(accent, 0.22),
    },
  }
}

function roundedRect(width: number, depth: number, radius: number): Shape {
  const x = -width / 2
  const y = -depth / 2
  const shape = new Shape()
  shape.moveTo(x + radius, y)
  shape.lineTo(x + width - radius, y)
  shape.absarc(x + width - radius, y + radius, radius, -Math.PI / 2, 0, false)
  shape.lineTo(x + width, y + depth - radius)
  shape.absarc(x + width - radius, y + depth - radius, radius, 0, Math.PI / 2, false)
  shape.lineTo(x + radius, y + depth)
  shape.absarc(x + radius, y + depth - radius, radius, Math.PI / 2, Math.PI, false)
  shape.lineTo(x, y + radius)
  shape.absarc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5, false)
  return shape
}

/** A rounded, bevelled plate centred on the origin, its faces toward ±Y. */
function plateGeometry(width: number, depth: number, height: number, radius: number, bevel: number) {
  const body = height - bevel * 2
  const geometry = new ExtrudeGeometry(roundedRect(width - bevel * 2, depth - bevel * 2, radius), {
    depth: body,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 10,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, -body / 2, 0)
  return geometry
}

/** A rounded rectangle lying flat (facing +Y), with 0..1 UVs for a full-bleed texture. */
function flatRoundedRect(width: number, depth: number, radius: number) {
  const geometry = new ShapeGeometry(roundedRect(width, depth, radius), 10)
  const position = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, (position.getX(i) + width / 2) / width, (position.getY(i) + depth / 2) / depth)
  }
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

function discGeometry(radius: number, height: number) {
  const half = height / 2
  const bevel = 0.022
  const profile = [
    new Vector2(0, -half),
    new Vector2(radius - bevel, -half),
    new Vector2(radius - bevel * 0.3, -half + bevel * 0.3),
    new Vector2(radius, -half + bevel),
    new Vector2(radius, half - bevel),
    new Vector2(radius - bevel * 0.3, half - bevel * 0.3),
    new Vector2(radius - bevel, half),
    new Vector2(0, half),
  ]
  return new LatheGeometry(profile, 56)
}

const SCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** Two pages with a scan line wiping between them, revealed sideways as the layer is built. */
const SCREEN_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D uFrom;
  uniform sampler2D uTo;
  uniform float uMix;
  uniform float uReveal;
  uniform float uMirror;
  uniform vec3 uEdge;
  void main() {
    float across = mix(vUv.x, 1.0 - vUv.x, uMirror);
    if (across > uReveal) discard;
    float front = 1.0 - uMix;
    vec3 color = mix(texture2D(uFrom, vUv).rgb, texture2D(uTo, vUv).rgb, smoothstep(front - 0.004, front + 0.004, vUv.y));
    float moving = step(0.001, uMix) * step(uMix, 0.999);
    color = mix(color, uEdge, step(abs(vUv.y - front), 0.004) * moving);
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`

const ORBIT_VERTEX = SCREEN_VERTEX

/** A faint orbit with a solid arc travelling on it, echoing the one around the home hero. */
const ORBIT_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform float uHead;
  uniform float uBase;
  uniform vec3 uColor;
  void main() {
    float behind = fract(uHead - vUv.x);
    gl_FragColor = vec4(uColor, mix(uBase, 1.0, step(behind, 0.04)));
    #include <colorspace_fragment>
  }
`

interface Layer {
  group: Group
  solids: Group
  blueprint: Mesh<PlaneGeometry, MeshBasicMaterial>
  bar: Mesh<BoxGeometry, MeshBasicMaterial>
  edges: LineLoop<BufferGeometry, LineBasicMaterial>
  slab: MeshStandardMaterial
  pads: MeshStandardMaterial
  clip: Plane
  /** Build progress in time, 0..1. */
  progress: number
  target: number
}

interface Module {
  mesh: Mesh<BufferGeometry, MeshStandardMaterial>
  lit: Spring
  flash: number
  rank: number
  delay: number
  next: number
}

interface Packet {
  wire: number
  /** Position along the stack: 0 at the data layer, 1 at the interface. */
  at: number
  from: number
  to: number
  speed: number
  alive: boolean
  bright: boolean
}

/** Throws when WebGL is unavailable (the caller keeps the drawing). */
export function createBriefScene(options: BriefSceneOptions): BriefScene {
  const { canvas, rtl } = options
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const lowPower = coarse || (navigator.hardwareConcurrency || 8) <= 4
  const maxPixelRatio = lowPower ? 1.5 : 1.75
  const side = rtl ? -1 : 1

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = NeutralToneMapping
  renderer.localClippingEnabled = true
  renderer.shadowMap.enabled = !lowPower
  renderer.shadowMap.type = PCFSoftShadowMap

  const scene = new Scene()
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 1, 60)

  let still = options.still
  let disposed = false
  let palette = readPalette()
  const disposables: { dispose: () => void }[] = [renderer]
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item)
    return item
  }

  const canvasTexture = (source: HTMLCanvasElement, linear = false): CanvasTexture => {
    const texture = new CanvasTexture(source)
    if (!linear) texture.colorSpace = SRGBColorSpace
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    return texture
  }

  // ── Light ────────────────────────────────────────────────────────────────
  let environment: WebGLRenderTarget | null = null
  /** Softboxes in a black room: they draw the highlights along every bevel. */
  const buildEnvironment = () => {
    environment?.dispose()
    const room = new Scene()
    const panel = (color: string, strength: number, position: [number, number, number], size: [number, number, number]) => {
      const mesh = new Mesh(
        new BoxGeometry(...size),
        new MeshBasicMaterial({ color: new Color(color).multiplyScalar(strength), side: DoubleSide }),
      )
      mesh.position.set(...position)
      room.add(mesh)
    }
    room.background = new Color(palette.dark ? '#020202' : '#B4BECC')
    panel('#FFFFFF', palette.dark ? 5 : 5, [0, 9, 0], [12, 0.2, 8])
    panel('#FFFFFF', palette.dark ? 5 : 3, [-9, 2, 2], [0.2, 6, 10])
    panel('#FFFFFF', palette.dark ? 4 : 2, [9, 1, -2], [0.2, 5, 10])
    panel('#FFFFFF', palette.dark ? 3 : 2, [0, 2, 10], [10, 3, 0.2])
    const generator = new PMREMGenerator(renderer)
    environment = generator.fromScene(room, 0.04)
    generator.dispose()
    room.traverse((object) => {
      const mesh = object as Mesh
      if (mesh.isMesh) {
        mesh.geometry.dispose()
        ;(mesh.material as Material).dispose()
      }
    })
    scene.environment = environment.texture
    scene.environmentIntensity = palette.environment
  }

  const key = new DirectionalLight(0xffffff, palette.key)
  key.position.set(side * -3.5, 8, 4.5)
  key.castShadow = !lowPower
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.camera.left = -5
  key.shadow.camera.right = 5
  key.shadow.camera.top = 5
  key.shadow.camera.bottom = -5
  key.shadow.camera.near = 1
  key.shadow.camera.far = 22
  key.shadow.radius = 7
  key.shadow.bias = -0.0006
  scene.add(key)
  const hemisphere = new HemisphereLight(0xffffff, 0x000000, 1)
  scene.add(hemisphere)

  // ── The model ────────────────────────────────────────────────────────────
  const root = new Group()
  const stack = new Group()
  root.rotation.y = BASE_YAW * side
  root.add(stack)
  scene.add(root)

  const plate = track(plateGeometry(SLAB_WIDTH, SLAB_DEPTH, SLAB_HEIGHT, SLAB_RADIUS, 0.022))
  const padGeometry = track(new CylinderGeometry(0.05, 0.05, 0.022, 20))
  const outlineGeometry = track(
    new BufferGeometry().setFromPoints(
      roundedRect(SLAB_WIDTH - 0.018, SLAB_DEPTH - 0.018, SLAB_RADIUS)
        .getPoints(10)
        .map((point) => new Vector3(point.x, SLAB_HEIGHT / 2 + 0.002, -point.y)),
    ),
  )
  const blueprintPlane = track(new PlaneGeometry(SLAB_WIDTH, SLAB_DEPTH))
  const barGeometry = track(new BoxGeometry(0.025, SLAB_HEIGHT * 1.5, SLAB_DEPTH * 1.04))

  const blueprintTextures: Texture[] = []
  const blueprintKinds = new Map<MeshBasicMaterial, BlueprintKind>()

  const makeLayer = (kind: BlueprintKind): Layer => {
    const group = new Group()
    const solids = new Group()
    solids.visible = false
    const clip = new Plane(new Vector3(-side, 0, 0), 100)
    const clipped = <T extends Material>(material: T): T => {
      material.clippingPlanes = [clip]
      material.clipShadows = true
      return track(material)
    }

    // Rough on purpose: each flat face reads as one flat colour.
    const slab = clipped(new MeshStandardMaterial({ roughness: 0.7, metalness: 0.05 }))
    const body = new Mesh(plate, slab)
    body.castShadow = true
    body.receiveShadow = true
    solids.add(body)

    const pads = clipped(new MeshStandardMaterial({ roughness: 0.4 }))
    for (const [x, z] of WIRES) {
      const pad = new Mesh(padGeometry, pads)
      pad.position.set(x, SLAB_HEIGHT / 2 + 0.008, z)
      solids.add(pad)
    }

    const edges = new LineLoop(outlineGeometry, clipped(new LineBasicMaterial({ transparent: true })))
    solids.add(edges)

    const blueprint = new Mesh(
      blueprintPlane,
      track(new MeshBasicMaterial({ transparent: true, depthWrite: false, side: DoubleSide })),
    )
    blueprint.rotation.x = -Math.PI / 2
    blueprintKinds.set(blueprint.material, kind)

    const bar = new Mesh(barGeometry, track(new MeshBasicMaterial({ toneMapped: false, transparent: true })))
    bar.visible = false

    group.add(blueprint, solids, bar)
    stack.add(group)
    return { group, solids, blueprint, bar, edges, slab, pads, clip, progress: 0, target: 0 }
  }

  const interfaceLayer = makeLayer('interface')
  const logicLayer = makeLayer('logic')
  const dataLayer = makeLayer('data')
  const layers = [interfaceLayer, logicLayer, dataLayer]

  // Interface: the screen. Pages are drawn when first shown, then kept.
  const pages = new Map<ScreenId, CanvasTexture>()
  const pageTexture = (id: ScreenId) => {
    let page = pages.get(id)
    if (!page) {
      page = canvasTexture(drawScreen(id, palette.screen, { yaw: BASE_YAW * side, lift: Math.sin(CAMERA_ELEVATION) }))
      pages.set(id, page)
    }
    return page
  }
  const screenMaterial = track(
    new ShaderMaterial({
      vertexShader: SCREEN_VERTEX,
      fragmentShader: SCREEN_FRAGMENT,
      toneMapped: false,
      uniforms: {
        uFrom: { value: pageTexture('blank') },
        uTo: { value: pageTexture('blank') },
        uMix: { value: 1 },
        uReveal: { value: 0 },
        uMirror: { value: rtl ? 1 : 0 },
        uEdge: { value: new Color() },
      },
    }),
  )
  const screen = new Mesh(track(flatRoundedRect(SLAB_WIDTH - 0.13, SLAB_DEPTH - 0.13, SLAB_RADIUS * 0.7)), screenMaterial)
  screen.position.y = SLAB_HEIGHT / 2 + 0.004
  interfaceLayer.solids.add(screen)
  let shownPage: ScreenId = 'blank'

  // Logic: modules that rise and light up as the budget grows, from the centre out.
  const moduleGeometry = track(plateGeometry(MODULE_WIDTH, MODULE_DEPTH, MODULE_HEIGHT, 0.08, 0.022))
  const modules: Module[] = []
  {
    const centre = [(MODULE_COLUMNS - 1) / 2, (MODULE_ROWS - 1) / 2]
    const distance = (index: number) =>
      Math.hypot((index % MODULE_COLUMNS) - centre[0], Math.floor(index / MODULE_COLUMNS) - centre[1])
    const order = Array.from({ length: LOGIC_MODULES }, (_, index) => index).sort((a, b) => distance(a) - distance(b) || a - b)
    for (let index = 0; index < LOGIC_MODULES; index++) {
      const material = new MeshStandardMaterial({ roughness: 0.7, metalness: 0.05 })
      material.clippingPlanes = [logicLayer.clip]
      material.clipShadows = true
      track(material)
      const mesh = new Mesh(moduleGeometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.position.set(
        ((index % MODULE_COLUMNS) - centre[0]) * MODULE_STEP_X,
        SLAB_HEIGHT / 2 + MODULE_HEIGHT / 2,
        (Math.floor(index / MODULE_COLUMNS) - centre[1]) * MODULE_STEP_Z,
      )
      logicLayer.solids.add(mesh)
      modules.push({ mesh, lit: new Spring(0, 150, 16), flash: 0, rank: order.indexOf(index), delay: 0, next: 0 })
    }
  }

  // Data: a stack of drives, one light ring per valid required field, on a turning track.
  const discGeo = track(discGeometry(DISC_RADIUS, DISC_HEIGHT))
  const ringGeo = track(new TorusGeometry(DISC_RADIUS + 0.004, 0.013, 8, 72))
  const discMaterials: MeshStandardMaterial[] = []
  const rings: { material: MeshStandardMaterial; lit: Spring }[] = []
  for (let level = 0; level < 3; level++) {
    const y = SLAB_HEIGHT / 2 + DISC_GAP + DISC_HEIGHT / 2 + level * (DISC_HEIGHT + DISC_GAP)
    const material = new MeshStandardMaterial({ roughness: 0.7, metalness: 0.05 })
    material.clippingPlanes = [dataLayer.clip]
    material.clipShadows = true
    track(material)
    discMaterials.push(material)
    const disc = new Mesh(discGeo, material)
    disc.position.y = y
    disc.castShadow = true
    disc.receiveShadow = true
    dataLayer.solids.add(disc)

    const ringMaterial = new MeshStandardMaterial({ roughness: 0.5 })
    ringMaterial.clippingPlanes = [dataLayer.clip]
    track(ringMaterial)
    const ring = new Mesh(ringGeo, ringMaterial)
    ring.rotation.x = Math.PI / 2
    ring.position.y = y - DISC_HEIGHT / 2 - DISC_GAP / 2
    dataLayer.solids.add(ring)
    rings.push({ material: ringMaterial, lit: new Spring(0, 90, 13) })
  }
  const trackMaterial = track(
    new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, clippingPlanes: [dataLayer.clip] }),
  )
  const dataTrack = new Mesh(track(new PlaneGeometry(2.1, 2.1)), trackMaterial)
  dataTrack.rotation.x = -Math.PI / 2
  dataTrack.position.y = SLAB_HEIGHT / 2 + 0.006
  dataLayer.solids.add(dataTrack)

  // Wires between the layers: unit cylinders stretched to the current gaps.
  const wireGeometry = track(new CylinderGeometry(0.0075, 0.0075, 1, 6))
  const wireUpper = track(new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }))
  const wireLower = track(new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }))
  const wires = WIRES.flatMap(([x, z]) =>
    [wireUpper, wireLower].map((material) => {
      const wire = new Mesh(wireGeometry, material)
      wire.position.set(x, 0, z)
      stack.add(wire)
      return wire
    }),
  )

  // Packets of data on the wires: one draw call, solid dots.
  const packets: Packet[] = Array.from({ length: PACKET_COUNT }, () => ({
    wire: 0,
    at: 0,
    from: 0,
    to: 1,
    speed: 0,
    alive: false,
    bright: false,
  }))
  const packetPositions = new Float32Array(PACKET_COUNT * 3).fill(-999)
  const packetGeometry = track(new BufferGeometry())
  packetGeometry.setAttribute('position', new BufferAttribute(packetPositions, 3))
  const packetMaterial = track(
    new PointsMaterial({ size: 0.075, sizeAttenuation: true, transparent: true, alphaTest: 0.5, toneMapped: false }),
  )
  const packetPoints = new Points(packetGeometry, packetMaterial)
  packetPoints.frustumCulled = false
  stack.add(packetPoints)

  // Orbit
  const orbitMaterial = track(
    new ShaderMaterial({
      vertexShader: ORBIT_VERTEX,
      fragmentShader: ORBIT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms: {
        uHead: { value: 0.1 },
        uBase: { value: 0.4 },
        uColor: { value: new Color() },
      },
    }),
  )
  const orbit = new Mesh(track(new TorusGeometry(2.6, 0.0065, 6, 320)), orbitMaterial)
  orbit.rotation.set(Math.PI / 2 - 0.2, side * 0.2, 0)
  scene.add(orbit)

  // Floor: a round blueprint plate and the launch's shock ring.
  const floor = new Group()
  floor.position.y = FLOOR_Y
  scene.add(floor)
  const gridMaterial = track(new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }))
  const grid = new Mesh(track(new PlaneGeometry(FLOOR_RADIUS * 2, FLOOR_RADIUS * 2)), gridMaterial)
  grid.rotation.x = -Math.PI / 2
  const shockMaterial = track(
    new MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, side: DoubleSide, opacity: 0 }),
  )
  const shock = new Mesh(track(new RingGeometry(0.975, 1, 96)), shockMaterial)
  shock.rotation.x = -Math.PI / 2
  shock.position.y = 0.03
  shock.visible = false
  floor.add(grid, shock)

  // Dust drifting up, and the sparks of the launch.
  const dustPositions = new Float32Array(DUST_COUNT * 3)
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPositions[i * 3] = MathUtils.randFloatSpread(9)
    dustPositions[i * 3 + 1] = MathUtils.randFloatSpread(6)
    dustPositions[i * 3 + 2] = MathUtils.randFloatSpread(7)
  }
  const dustGeometry = track(new BufferGeometry())
  dustGeometry.setAttribute('position', new BufferAttribute(dustPositions, 3))
  const dustMaterial = track(
    new PointsMaterial({ size: 0.028, sizeAttenuation: true, transparent: true, depthWrite: false, toneMapped: false }),
  )
  const dust = new Points(dustGeometry, dustMaterial)
  scene.add(dust)

  const sparkPositions = new Float32Array(SPARK_COUNT * 3).fill(-999)
  const sparkVelocities = new Float32Array(SPARK_COUNT * 3)
  const sparkGeometry = track(new BufferGeometry())
  sparkGeometry.setAttribute('position', new BufferAttribute(sparkPositions, 3))
  const sparkMaterial = track(
    new PointsMaterial({ size: 0.05, sizeAttenuation: true, transparent: true, depthWrite: false, toneMapped: false }),
  )
  const sparks = new Points(sparkGeometry, sparkMaterial)
  sparks.frustumCulled = false
  sparks.visible = false
  scene.add(sparks)
  let sparkLife = 0

  // ── Theme ────────────────────────────────────────────────────────────────
  let dotTexture: CanvasTexture | null = null
  const paint = () => {
    palette = readPalette()
    buildEnvironment()
    key.intensity = palette.key
    hemisphere.color.copy(palette.hemisphere[0])
    hemisphere.groundColor.copy(palette.hemisphere[1])
    hemisphere.intensity = palette.hemisphere[2]

    while (blueprintTextures.length) blueprintTextures.pop()?.dispose()
    for (const layer of layers) {
      layer.slab.color.copy(palette.slab)
      layer.pads.color.copy(palette.accent)
      layer.pads.emissive.copy(palette.accent)
      layer.pads.emissiveIntensity = palette.litEmissive
      layer.edges.material.color.copy(palette.accent)
      layer.edges.material.opacity = palette.edgeOpacity
      layer.bar.material.color.copy(palette.accent)
      const kind = blueprintKinds.get(layer.blueprint.material) ?? 'logic'
      const blueprint = canvasTexture(drawBlueprint(kind, css(palette.accent)))
      blueprintTextures.push(blueprint)
      layer.blueprint.material.map = blueprint
      layer.blueprint.material.needsUpdate = true
    }
    for (const unit of modules) {
      unit.mesh.material.color.copy(palette.module)
      unit.mesh.material.emissive.copy(palette.accent)
    }
    for (const material of discMaterials) material.color.copy(palette.disc)
    for (const ring of rings) {
      ring.material.color.copy(palette.module)
      ring.material.emissive.copy(palette.accent)
    }

    disposeTexture(trackMaterial.map)
    trackMaterial.map = canvasTexture(drawDataTrack(css(palette.accent)))
    trackMaterial.needsUpdate = true

    wireUpper.color.copy(palette.accent)
    wireUpper.opacity = palette.wireOpacity
    wireLower.color.copy(palette.accent)
    wireLower.opacity = palette.wireOpacity

    disposeTexture(dotTexture)
    dotTexture = canvasTexture(drawDot('#FFFFFF'))
    for (const material of [packetMaterial, dustMaterial, sparkMaterial]) {
      material.map = dotTexture
      material.color.copy(palette.accent)
      material.needsUpdate = true
    }
    dustMaterial.opacity = palette.dustOpacity

    orbitMaterial.uniforms.uBase.value = palette.orbitBase
    ;(orbitMaterial.uniforms.uColor.value as Color).copy(palette.accent)
    ;(screenMaterial.uniforms.uEdge.value as Color).copy(palette.accent)

    disposeTexture(gridMaterial.map)
    gridMaterial.map = canvasTexture(drawFloorGrid(css(palette.accent)))
    gridMaterial.opacity = palette.gridOpacity
    gridMaterial.needsUpdate = true

    shockMaterial.color.copy(palette.accent)

    // Screens: redraw in the new colours.
    pages.forEach((page) => page.dispose())
    pages.clear()
    screenMaterial.uniforms.uFrom.value = pageTexture(shownPage)
    screenMaterial.uniforms.uTo.value = pageTexture(shownPage)
    screenMaterial.uniforms.uMix.value = 1
  }

  function disposeTexture(texture: Texture | null) {
    texture?.dispose()
  }

  // ── State ────────────────────────────────────────────────────────────────
  let state: BriefSceneState = { built: 1, screen: null, modules: 0, tempo: 1, rings: 0, phase: 'editing' }
  const gapTop = new Spring(OPEN_GAP, 70, 12)
  const gapBottom = new Spring(OPEN_GAP, 70, 12)
  const spin = new Spring(0, 14, 5)
  const tilt = { x: new Spring(0, 26, 8), y: new Spring(0, 26, 8) }
  let time = 0
  let spawnTimer = 0.2
  let launch = -1
  let orbitHead = 0.1
  let shake = 0
  let pulseCooldown = 0
  let wipe = 1
  let lastWipeTarget: ScreenId = 'blank'
  let dragging = false
  let lastDragX = 0
  let width = 1
  let height = 1

  const launchOffset = (t: number) => {
    if (t < 0.28) return -0.26 * easeOut(t / 0.28)
    if (t < 1) return -0.26 + (LAUNCH_HEIGHT + 0.26) * ((t - 0.28) / 0.72) ** 3
    if (t < 1.25) return LAUNCH_HEIGHT
    if (t < 2.55) return LAUNCH_HEIGHT * (1 - easeOut((t - 1.25) / 1.3))
    return 0
  }

  const takeOff = () => {
    shock.visible = true
    shock.scale.setScalar(0.5)
    shockMaterial.opacity = 1
    sparks.visible = true
    sparkLife = 1.4
    for (let i = 0; i < SPARK_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2
      const reach = 1 + Math.random() * 2.2
      sparkPositions[i * 3] = Math.cos(angle) * Math.random() * 1.6
      sparkPositions[i * 3 + 1] = FLOOR_Y + 0.2 + Math.random() * 0.8
      sparkPositions[i * 3 + 2] = Math.sin(angle) * Math.random() * 1.2
      sparkVelocities[i * 3] = Math.cos(angle) * reach
      sparkVelocities[i * 3 + 1] = 1 + Math.random() * 3.6
      sparkVelocities[i * 3 + 2] = Math.sin(angle) * reach
    }
  }

  const spawnPacket = (bright: boolean) => {
    const packet = packets.find((item) => !item.alive)
    if (!packet) return
    const whole = state.built >= 3
    const low = whole ? 0 : 0.5
    packet.alive = true
    packet.bright = bright
    packet.wire = Math.floor(Math.random() * WIRES.length)
    const rising = bright || Math.random() < 0.5
    packet.from = rising ? low : 1
    packet.to = rising ? 1 : low
    packet.at = packet.from
    packet.speed = (bright ? 1.15 : 0.42) * (whole ? 1 : 0.7)
  }

  const setPage = (id: ScreenId) => {
    if (id === lastWipeTarget) return
    lastWipeTarget = id
    shownPage = id
    screenMaterial.uniforms.uFrom.value = screenMaterial.uniforms.uTo.value
    screenMaterial.uniforms.uTo.value = pageTexture(id)
    wipe = still ? 1 : 0
    screenMaterial.uniforms.uMix.value = wipe
  }

  const applyState = () => {
    const closing = state.phase === 'sending' || state.phase === 'sent'
    gapTop.target = closing ? CLOSED_GAP_TOP : OPEN_GAP
    gapBottom.target = closing ? CLOSED_GAP_BOTTOM : OPEN_GAP
    layers.forEach((layer, index) => {
      layer.target = index < state.built ? 1 : 0
    })
    setPage(state.phase === 'sent' ? 'sent' : (state.screen ?? 'blank'))
    const allLit = state.phase === 'sent'
    for (const unit of modules) {
      const next = allLit || unit.rank < state.modules ? 1 : 0
      if (next !== unit.next) {
        unit.next = next
        unit.delay = unit.rank * 0.035
      }
    }
    rings.forEach((ring, level) => {
      ring.lit.target = allLit || level < state.rings ? 1 : 0
    })
  }

  // ── Frame ────────────────────────────────────────────────────────────────
  const pin = new Vector3()
  const corners = layers.map(() => ({ x: 0, y: 0 }))
  // Just inside the corner: the plate's rounded corner leaves the exact point in the air.
  const pinX = -side * (SLAB_WIDTH / 2 - 0.06)
  const pinZ = -(SLAB_DEPTH / 2 - 0.06)

  const placeLayers = () => {
    const floatTop = still ? 0 : Math.sin(time * 0.85) * 0.04
    const floatBottom = still ? 0 : Math.sin(time * 0.85 + 1.4) * 0.035
    const top = gapTop.value + floatTop
    const bottom = -gapBottom.value + floatBottom
    interfaceLayer.group.position.y = top
    logicLayer.group.position.y = 0
    dataLayer.group.position.y = bottom
    stack.position.y = (gapBottom.value - gapTop.value) / 2

    wires.forEach((wire, index) => {
      const upper = index % 2 === 0
      const from = upper ? SLAB_HEIGHT / 2 : bottom + SLAB_HEIGHT / 2
      const to = upper ? top - SLAB_HEIGHT / 2 : -SLAB_HEIGHT / 2
      wire.position.y = (from + to) / 2
      wire.scale.y = Math.max(0.001, to - from)
    })
  }

  const placeBuild = (layer: Layer, index: number) => {
    const eased = easeInOut(layer.progress)
    const started = layer.progress > 0.0005
    const done = layer.progress > 0.9995
    layer.solids.visible = started
    layer.bar.visible = started && !done
    layer.blueprint.visible = !done
    layer.blueprint.material.opacity = (palette.dark ? 0.8 : 0.7) * (1 - eased)

    const reach = SLAB_WIDTH / 2 + 0.05
    const front = MathUtils.lerp(-reach, reach, eased)
    layer.bar.position.set(side * front, 0, 0)
    layer.bar.material.opacity = Math.min(1, Math.min(eased, 1 - eased) * 12)
    layer.group.updateWorldMatrix(true, false)
    layer.clip.normal.set(-side, 0, 0)
    layer.clip.constant = done ? 100 : front
    if (!done) layer.clip.applyMatrix4(layer.group.matrixWorld)
    if (index === 0) screenMaterial.uniforms.uReveal.value = done ? 2 : (front + SLAB_WIDTH / 2) / SLAB_WIDTH
  }

  const placePackets = () => {
    const top = interfaceLayer.group.position.y - SLAB_HEIGHT / 2
    const bottom = dataLayer.group.position.y + SLAB_HEIGHT / 2
    packets.forEach((packet, index) => {
      const offset = index * 3
      if (!packet.alive) {
        packetPositions[offset + 1] = -999
        return
      }
      const [x, z] = WIRES[packet.wire]
      packetPositions[offset] = x
      packetPositions[offset + 1] = MathUtils.lerp(bottom, top, packet.at)
      packetPositions[offset + 2] = z
    })
    packetGeometry.getAttribute('position').needsUpdate = true
  }

  const placeModules = () => {
    for (const unit of modules) {
      const lit = MathUtils.clamp(unit.lit.value, 0, 1)
      unit.mesh.position.y = SLAB_HEIGHT / 2 + MODULE_HEIGHT / 2 + Math.max(0, unit.lit.value) * 0.07
      unit.mesh.material.color.lerpColors(palette.module, palette.accent, lit)
      unit.mesh.material.emissiveIntensity = lit * palette.litEmissive + unit.flash * palette.litEmissive
    }
    for (const ring of rings) {
      const lit = MathUtils.clamp(ring.lit.value, 0, 1)
      ring.material.color.lerpColors(palette.module, palette.accent, lit)
      ring.material.emissiveIntensity = lit * palette.litEmissive * 1.4
    }
  }

  const reportCorners = () => {
    if (!options.onFrame) return
    layers.forEach((layer, index) => {
      pin.set(pinX, SLAB_HEIGHT / 2, pinZ)
      layer.group.localToWorld(pin)
      pin.project(camera)
      corners[index].x = ((pin.x + 1) / 2) * width
      corners[index].y = ((1 - pin.y) / 2) * height
    })
    options.onFrame(corners, width)
  }

  const render = () => {
    if (disposed) return
    root.updateWorldMatrix(true, true)
    layers.forEach(placeBuild)
    placePackets()
    placeModules()
    renderer.render(scene, camera)
    reportCorners()
  }

  const advance = (dt: number) => {
    time += dt

    if (launch >= 0) {
      const before = launch
      launch += dt
      if (before < 0.28 && launch >= 0.28) takeOff()
      if (launch >= 2.55) launch = -1
    }
    root.position.y = launch >= 0 ? launchOffset(launch) : 0

    gapTop.step(dt)
    gapBottom.step(dt)

    for (const layer of layers) layer.progress = approach(layer.progress, layer.target, dt / BUILD_SECONDS)

    if (wipe < 1) {
      wipe = Math.min(1, wipe + dt / SCREEN_WIPE_SECONDS)
      screenMaterial.uniforms.uMix.value = easeInOut(wipe)
    }

    for (const unit of modules) {
      if (unit.delay > 0) unit.delay -= dt
      if (unit.delay <= 0) unit.lit.target = unit.next
      unit.lit.step(dt)
      unit.flash = Math.max(0, unit.flash - dt * 2.6)
    }
    for (const ring of rings) ring.lit.step(dt)
    const ready = rings.every((ring) => ring.lit.target === 1)
    dataTrack.rotation.z -= dt * (ready ? 0.9 : 0.22) * state.tempo

    // Packets
    pulseCooldown = Math.max(0, pulseCooldown - dt)
    const sending = state.phase === 'sending'
    const interval = (sending ? 0.09 : state.built >= 3 ? 0.42 : state.built === 2 ? 0.7 : 1.1) / state.tempo
    spawnTimer -= dt
    if (spawnTimer <= 0 && launch < 0) {
      spawnPacket(sending)
      spawnTimer = interval
    }
    const rate = state.tempo * (sending ? 2 : 1)
    for (const packet of packets) {
      if (!packet.alive) continue
      const before = packet.at
      const direction = Math.sign(packet.to - packet.from)
      packet.at += direction * packet.speed * rate * dt
      if ((before - 0.5) * (packet.at - 0.5) <= 0) {
        const unit = modules[WIRE_MODULES[packet.wire]]
        unit.flash = Math.max(unit.flash, packet.bright ? 1 : 0.55)
      }
      if ((packet.at - packet.to) * direction >= 0) packet.alive = false
    }

    // Motion of the whole
    if (finePointer || dragging) {
      tilt.x.step(dt)
      tilt.y.step(dt)
    }
    if (!dragging) spin.step(dt)
    root.rotation.y = BASE_YAW * side + spin.value + tilt.y.value + Math.sin(time * 0.3) * 0.055
    root.rotation.x = tilt.x.value + Math.sin(time * 0.42) * 0.012
    if (shake > 0.001) {
      shake = Math.max(0, shake - dt * 1.6)
      stack.position.x = Math.sin(time * 42) * shake * 0.09
    } else {
      stack.position.x = 0
    }
    placeLayers()

    orbitHead += dt * (state.phase === 'sent' ? 0.16 : 0.07)
    orbitMaterial.uniforms.uHead.value = orbitHead % 1

    // Dust
    for (let i = 0; i < DUST_COUNT; i++) {
      const y = i * 3 + 1
      dustPositions[y] += dt * (0.05 + (i % 5) * 0.012)
      if (dustPositions[y] > 3) dustPositions[y] = -3
    }
    dustGeometry.getAttribute('position').needsUpdate = true

    // Launch effects
    if (shock.visible) {
      shock.scale.addScalar(dt * 3.4)
      shockMaterial.opacity = Math.max(0, shockMaterial.opacity - dt * 1.7)
      if (shockMaterial.opacity <= 0) shock.visible = false
    }
    if (sparkLife > 0) {
      sparkLife -= dt
      sparkMaterial.opacity = Math.max(0, Math.min(1, sparkLife))
      for (let i = 0; i < SPARK_COUNT; i++) {
        sparkVelocities[i * 3 + 1] -= dt * 1.4
        sparkPositions[i * 3] += sparkVelocities[i * 3] * dt
        sparkPositions[i * 3 + 1] += sparkVelocities[i * 3 + 1] * dt
        sparkPositions[i * 3 + 2] += sparkVelocities[i * 3 + 2] * dt
      }
      sparkGeometry.getAttribute('position').needsUpdate = true
      if (sparkLife <= 0) sparks.visible = false
    }
  }

  /** Everything at its end state, for reduced motion. */
  const settle = () => {
    root.position.y = 0
    root.rotation.set(0, BASE_YAW * side, 0)
    stack.position.x = 0
    launch = -1
    shock.visible = false
    sparks.visible = false
    sparkLife = 0
    gapTop.snap()
    gapBottom.snap()
    for (const layer of layers) layer.progress = layer.target
    wipe = 1
    screenMaterial.uniforms.uMix.value = 1
    for (const unit of modules) {
      unit.delay = 0
      unit.lit.target = unit.next
      unit.lit.snap()
      unit.flash = 0
    }
    for (const ring of rings) ring.lit.snap()
    for (const packet of packets) packet.alive = false
    placeLayers()
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
    advance(dt)
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
    const halfTan = Math.tan(MathUtils.degToRad(CAMERA_FOV / 2))
    const fitHeight = 2.8
    const fitWidth = 3.3
    const distance = Math.max(fitHeight / halfTan, fitWidth / (halfTan * camera.aspect))
    camera.position.set(0, Math.sin(CAMERA_ELEVATION) * distance, Math.cos(CAMERA_ELEVATION) * distance)
    camera.lookAt(0, LOOK_Y, 0)
    camera.far = distance + 30
    const shift = options.focusOffset() * width * side
    camera.setViewOffset(width, height, -shift, 0, width, height)
    camera.updateProjectionMatrix()
    if (still) {
      settle()
      render()
    }
  }

  // ── Input ────────────────────────────────────────────────────────────────
  const onPointerMove = (event: PointerEvent) => {
    if (!finePointer) return
    const box = canvas.getBoundingClientRect()
    const x = MathUtils.clamp(((event.clientX - box.left) / box.width - 0.5) * 2, -1.4, 1.4)
    const y = MathUtils.clamp(((event.clientY - box.top) / box.height - 0.5) * 2, -1.4, 1.4)
    tilt.y.target = x * 0.11
    tilt.x.target = y * 0.05
  }
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    dragging = true
    lastDragX = event.clientX
    spin.velocity = 0
    canvas.setPointerCapture(event.pointerId)
    canvas.setAttribute('data-dragging', '')
  }
  const onDrag = (event: PointerEvent) => {
    if (!dragging) return
    const delta = event.clientX - lastDragX
    lastDragX = event.clientX
    spin.value += delta * 0.009
    spin.velocity = delta * 0.5
  }
  const onPointerUp = () => {
    if (!dragging) return
    dragging = false
    canvas.removeAttribute('data-dragging')
    // Comes back to face the visitor by the nearest way round.
    const turn = Math.PI * 2
    spin.target = Math.round((spin.value + spin.velocity * 0.3) / turn) * turn
  }

  const addInput = () => {
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onDrag)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
  }
  const removeInput = () => {
    window.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onDrag)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
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
    applyState()
    if (still) {
      settle()
      render()
    }
  })
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })

  const onContextLost = (event: Event) => {
    event.preventDefault()
    options.onContextLost()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)

  paint()
  resize()
  applyState()
  if (!still) addInput()

  // Compile before the first frame, so the first build doesn't stutter.
  for (const layer of layers) layer.solids.visible = true
  renderer.compile(scene, camera)
  for (const layer of layers) layer.solids.visible = false

  if (still) settle()
  placeLayers()
  render()
  options.onReady()
  syncLoop()

  const update = (next: BriefSceneState) => {
    const before = state.phase
    state = next
    applyState()
    if (still) {
      settle()
      render()
      return
    }
    if (next.phase !== before) onPhaseChange(next.phase)
  }

  const onPhaseChange = (phase: BriefPhase) => {
    if (phase === 'failed') shake = 1
    if (phase === 'sent') launch = 0
  }

  return {
    update,
    pulse: () => {
      if (still || pulseCooldown > 0 || state.built < 3) return
      pulseCooldown = 0.07
      spawnPacket(true)
    },
    setStill: (value) => {
      if (value === still) return
      still = value
      if (still) {
        removeInput()
        syncLoop()
        settle()
        render()
      } else {
        addInput()
        syncLoop()
      }
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      syncLoop()
      removeInput()
      visibility.disconnect()
      sizes.disconnect()
      theme.disconnect()
      document.removeEventListener('visibilitychange', syncLoop)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      environment?.dispose()
      pages.forEach((page) => page.dispose())
      blueprintTextures.forEach((texture) => texture.dispose())
      dotTexture?.dispose()
      trackMaterial.map?.dispose()
      gridMaterial.map?.dispose()
      scene.traverse((object: Object3D) => {
        const mesh = object as Mesh
        if (mesh.isMesh) mesh.geometry.dispose()
      })
      for (const item of disposables) item.dispose()
    },
  }
}
