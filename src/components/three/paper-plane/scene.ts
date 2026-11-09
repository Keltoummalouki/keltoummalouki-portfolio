import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  DynamicDrawUsage,
  Euler,
  FrontSide,
  HemisphereLight,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Quaternion,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { ContactPhase, LetterSceneState } from '@/features/inbox/contact-form'
import { Spring, readCssColor } from '../kit'
import { KEEL_OPEN, SHEET_HALF_HEIGHT, SHEET_HALF_WIDTH, applyPose, foldAngles, planeFacets, poseFacets, segment } from './fold'
import { bezier, bezierTangent, easeIn, easeOut, returnPath, takeoffPath, type Path, type V3 } from './flight'
import { LETTER_HEIGHT, LETTER_WIDTH, drawLetter, drawPaper, sameFace, type LetterColors, type LetterFace } from './letter'

// The contact form's letter. It writes itself as the visitor types (stamp, reply-to,
// lines, signature: see letter.ts), folds into a paper plane when the message is
// sent, flies off, comes back and unfolds showing a check. If the server refuses,
// the plane wobbles and unfolds back into the letter, everything still on it.
//
// One flat accent over neutral greys, as everywhere on the site: matte paper lit by
// one white light, so each facet reads as a single tone; a hard-edged floor shadow
// in one solid colour; a dotted trail in the accent. No glow, gradient or reflection.
//
// Vanilla Three.js, loaded once the stage nears the viewport. It draws only while on
// screen; in `still` mode (reduced motion) it draws one frame per change, showing
// each state's end: the letter, the folded plane, the check.

export interface PlaneSceneOptions {
  canvas: HTMLCanvasElement
  /** Render one frame per change instead of animating. */
  still: boolean
  /** Writes and flies right to left. */
  rtl: boolean
  onReady: () => void
  onContextLost: () => void
}

export interface PlaneScene {
  update: (state: LetterSceneState) => void
  /** A keystroke: the letter gives a small nod. */
  nudge: () => void
  setStill: (still: boolean) => void
  dispose: () => void
}

type Act = 'letter' | 'folding' | 'hover' | 'takeoff' | 'away' | 'return' | 'unfolding' | 'shake'

const CAMERA_FOV = 28
const CAMERA_ELEVATION = 0.16
const LOOK_Y = -0.1
/** What the camera must show: the letter and its shadow, and the plane hovering. */
const VIEW_HALF_HEIGHT = 2.15
const VIEW_HALF_WIDTH = 2.1
/** Just under the floating letter, so its shadow reads as its own. */
const FLOOR_Y = -SHEET_HALF_HEIGHT - 0.32
/** The floor shadow's light: from above, falling a little toward the viewer. */
const SHADOW_FALL = new Vector3(0.1, -1, 0.2).normalize()

const SHEET_POSITION = new Vector3(0, 0.04, 0)
/** Leans back a little and turns toward the form beside it. */
const SHEET_TURN = { pitch: -0.1, yaw: 0.2, roll: -0.03 }
const HOVER: V3 = [0.2, 0.32, 0.35]
/** Nose to the far top corner, a little toward the viewer. */
const HOVER_HEADING: V3 = [0.95, 0.22, 0.3]
/** Banked toward the viewer, so the wings show their top instead of an edge. */
const HOVER_BANK = 0.5

const FOLD_SECONDS = 1.8
const UNFOLD_SECONDS = 1.25
const TAKEOFF_SECONDS = 1.05
const AWAY_SECONDS = 0.4
const RETURN_SECONDS = 1.35
const SHAKE_SECONDS = 0.5
const NUDGE_INTERVAL_MS = 70
const TRAIL_DOTS = 64
const TRAIL_LIFE = 0.9
const TRAIL_SPACING = 0.17

const WORLD_UP = new Vector3(0, 1, 0)
/** Toward the viewer. */
const FACING = new Vector3(0, 0, 1)
// The folded plane's own axes: forward is the sheet's top edge; up runs from the keel
// to the wings, between the two halves of the opened body; the wings span the third.
const LOCAL_UP = new Vector3(Math.cos(KEEL_OPEN / 2), 0, Math.sin(KEEL_OPEN / 2))
const LOCAL_FORWARD = new Vector3(0, 1, 0)
const LOCAL_SPAN = new Vector3().crossVectors(LOCAL_UP, LOCAL_FORWARD)
const FROM_LOCAL = new Matrix4().makeBasis(LOCAL_UP, LOCAL_FORWARD, LOCAL_SPAN).transpose()

interface Palette {
  dark: boolean
  accent: Color
  paperBack: Color
  shadow: Color
  background: Color
  key: number
  hemisphere: [Color, Color, number]
  letter: LetterColors
}

/** Colours follow the theme and the admin-picked primary colour (--primary). */
function readPalette(): Palette {
  const root = document.documentElement
  const style = getComputedStyle(root)
  const read = (name: string) => style.getPropertyValue(name).trim()
  const dark = root.classList.contains('dark')
  const accent = readCssColor(read('--primary'), '#2A6AFF')
  const background = readCssColor(read('--background'), dark ? '#000000' : '#F8FAFC')
  const letter = (paper: string, edge: string, line: string, faint: string): LetterColors => ({
    paper,
    edge,
    ink: read('--foreground') || (dark ? '#FAFAFA' : '#0B0F19'),
    line,
    faint,
    accent: accent.getStyle(),
    onAccent: read('--primary-foreground') || '#FFFFFF',
  })
  if (dark) {
    return {
      dark,
      accent,
      paperBack: new Color('#232327'),
      shadow: new Color('#1A1A1D'),
      background,
      key: 2.7,
      hemisphere: [new Color('#FFFFFF'), new Color('#303036'), 1.6],
      letter: letter('#2C2C31', '#47474F', '#9A9AA3', '#44444C'),
    }
  }
  return {
    dark,
    accent,
    paperBack: new Color('#E6EBF2'),
    shadow: new Color('#E2E8F0'),
    background,
    key: 2,
    hemisphere: [new Color('#FFFFFF'), new Color('#CBD5E1'), 1.95],
    letter: letter('#FFFFFF', '#CFD8E3', '#94A3B8', '#E2E8F0'),
  }
}

/** Throws when WebGL is unavailable (the caller keeps the drawing). */
export function createPlaneScene(options: PlaneSceneOptions): PlaneScene {
  const { canvas, rtl } = options
  const side = rtl ? -1 : 1
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const lowPower = coarse || (navigator.hardwareConcurrency || 8) <= 4
  const maxPixelRatio = lowPower ? 1.5 : 1.75

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

  // One white light from the top corner the letter faces away from.
  const key = new DirectionalLight(0xffffff, palette.key)
  key.position.set(-3 * side, 5, 6)
  const hemisphere = new HemisphereLight(0xffffff, 0x000000, 1)
  scene.add(key, hemisphere)

  // ── The paper ──────────────────────────────────────────────────────────────
  // Every facet's triangles in one buffer, recomputed on the CPU each frame (a few
  // hundred vertices). The front carries the letter; the back is plain paper.
  const facets = planeFacets()
  const triangles = facets.flatMap((facet, index) =>
    facet.corners.slice(1, -1).map((corner, i) => ({ facet: index, corners: [facet.corners[0], corner, facet.corners[i + 2]] })),
  )
  const vertexCount = triangles.length * 3
  const vertexFacet = new Uint16Array(vertexCount)
  const vertexSheet = new Float32Array(vertexCount * 2)
  const uvs = new Float32Array(vertexCount * 2)
  triangles.forEach((triangle, t) =>
    triangle.corners.forEach((corner, c) => {
      const v = t * 3 + c
      vertexFacet[v] = triangle.facet
      vertexSheet[v * 2] = corner.x
      vertexSheet[v * 2 + 1] = corner.y
      uvs[v * 2] = (corner.x + SHEET_HALF_WIDTH) / (2 * SHEET_HALF_WIDTH)
      uvs[v * 2 + 1] = (corner.y + SHEET_HALF_HEIGHT) / (2 * SHEET_HALF_HEIGHT)
    }),
  )

  const positions = new Float32Array(vertexCount * 3)
  const paperGeometry = track(new BufferGeometry())
  const positionAttribute = new BufferAttribute(positions, 3)
  positionAttribute.setUsage(DynamicDrawUsage)
  paperGeometry.setAttribute('position', positionAttribute)
  paperGeometry.setAttribute('uv', new BufferAttribute(uvs, 2))

  const faceScale = lowPower ? 0.75 : 1
  const faceCanvas = document.createElement('canvas')
  faceCanvas.width = Math.round(LETTER_WIDTH * faceScale)
  faceCanvas.height = Math.round(LETTER_HEIGHT * faceScale)
  const faceTexture = track(new CanvasTexture(faceCanvas))
  faceTexture.colorSpace = SRGBColorSpace
  faceTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())

  // The back is plain paper with the same hairline edge; it needs far fewer pixels.
  const backCanvas = document.createElement('canvas')
  backCanvas.width = Math.round(LETTER_WIDTH * 0.4)
  backCanvas.height = Math.round(LETTER_HEIGHT * 0.4)
  const backTexture = track(new CanvasTexture(backCanvas))
  backTexture.colorSpace = SRGBColorSpace

  const frontMaterial = track(new MeshLambertMaterial({ map: faceTexture, side: FrontSide, flatShading: true }))
  const backMaterial = track(new MeshLambertMaterial({ map: backTexture, side: BackSide, flatShading: true }))
  const front = new Mesh(paperGeometry, frontMaterial)
  const back = new Mesh(paperGeometry, backMaterial)
  // Positions are written in world space; the bounds change every frame.
  front.frustumCulled = false
  back.frustumCulled = false
  scene.add(front, back)

  // The floor shadow: the paper's own triangles, flattened onto the floor in one
  // solid colour, so overlapping parts merge instead of getting darker.
  const shadowPositions = new Float32Array(vertexCount * 3)
  const shadowGeometry = track(new BufferGeometry())
  const shadowAttribute = new BufferAttribute(shadowPositions, 3)
  shadowAttribute.setUsage(DynamicDrawUsage)
  shadowGeometry.setAttribute('position', shadowAttribute)
  const shadowMaterial = track(new MeshBasicMaterial({ side: DoubleSide, depthWrite: false }))
  const shadow = new Mesh(shadowGeometry, shadowMaterial)
  shadow.frustumCulled = false
  shadow.renderOrder = -1
  scene.add(shadow)

  // The trail: dots dropped behind the plane, each shrinking away.
  const trailMaterial = track(new MeshBasicMaterial())
  const trail = new InstancedMesh(track(new CircleGeometry(0.05, 14)), trailMaterial, TRAIL_DOTS)
  trail.instanceMatrix.setUsage(DynamicDrawUsage)
  trail.frustumCulled = false
  scene.add(trail)
  const dots = Array.from({ length: TRAIL_DOTS }, () => ({ position: new Vector3(), age: Infinity }))
  let nextDot = 0
  let sinceDot = 0
  const lastTail = new Vector3()
  let tailKnown = false

  // ── Poses ──────────────────────────────────────────────────────────────────
  const sheetQuaternion = new Quaternion().setFromEuler(
    new Euler(SHEET_TURN.pitch, SHEET_TURN.yaw * side, SHEET_TURN.roll * side, 'YXZ'),
  )
  const hoverPosition = new Vector3(HOVER[0] * side, HOVER[1], HOVER[2])
  const scratchMatrix = new Matrix4()
  const scratchUp = new Vector3()
  const scratchSpan = new Vector3()

  /** The plane's orientation for a heading, banked by `roll` around it. */
  const attitude = (heading: Vector3, roll: number, target: Quaternion) => {
    const forward = heading.clone().normalize()
    scratchUp.copy(WORLD_UP).addScaledVector(forward, -WORLD_UP.dot(forward)).normalize()
    if (roll) scratchUp.applyAxisAngle(forward, roll)
    scratchSpan.crossVectors(scratchUp, forward)
    scratchMatrix.makeBasis(scratchUp, forward, scratchSpan).multiply(FROM_LOCAL)
    return target.setFromRotationMatrix(scratchMatrix)
  }
  const hoverHeading: V3 = [HOVER_HEADING[0] * side, HOVER_HEADING[1], HOVER_HEADING[2]]
  const hoverQuaternion = attitude(new Vector3(...hoverHeading), HOVER_BANK * side, new Quaternion())

  // The folded plane's centre (area-weighted): the point it hovers and flies by.
  const centroid = (() => {
    const poses = poseFacets(facets, foldAngles(1))
    const sum = new Vector3()
    let total = 0
    const a = new Vector3()
    const b = new Vector3()
    const c = new Vector3()
    for (const triangle of triangles) {
      const pose = poses[triangle.facet]
      const [p, q, r] = triangle.corners.map((corner) => applyPose(pose, [corner.x, corner.y, 0]))
      a.set(...p)
      b.set(...q)
      c.set(...r)
      const area = new Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).length() / 2
      sum.addScaledVector(a.add(b).add(c).divideScalar(3), area)
      total += area
    }
    return sum.divideScalar(total || 1)
  })()

  const takeoff: Path = takeoffPath([HOVER[0] * side, HOVER[1], HOVER[2]], side)
  const landing: Path = returnPath([HOVER[0] * side, HOVER[1], HOVER[2]], side, HOVER_HEADING)

  // ── State ──────────────────────────────────────────────────────────────────
  let act: Act = 'letter'
  let phase: ContactPhase = 'editing'
  let fold = 0
  let flight = 0
  let timer = 0
  let time = 0
  let launchQueued = false
  /** The face shows the check (the message went through). */
  let receipt = false
  let latest: LetterSceneState | null = null
  let paintedFace: LetterFace | null = null
  let faceDirty = true
  let lastNudge = 0

  const tiltYaw = new Spring(0, 26, 8)
  const tiltPitch = new Spring(0, 26, 8)
  const nod = new Spring(0, 150, 13)
  const stamp = new Spring(0, 170, 12)
  const lift = new Spring(0, 90, 11)
  const springs = [tiltYaw, tiltPitch, nod, stamp, lift]

  // ── Painting ───────────────────────────────────────────────────────────────
  const currentFace = (): LetterFace => ({
    receipt,
    topic: latest?.topic ?? null,
    lines: latest?.lines ?? [],
    signature: latest?.signature ?? [],
    reply: latest?.reply ?? 0,
    replyValid: latest?.replyValid ?? false,
    ready: latest?.ready ?? false,
  })

  const paintFace = () => {
    const face = currentFace()
    if (!faceDirty && sameFace(paintedFace, face)) return
    drawLetter(faceCanvas, face, palette.letter, rtl)
    faceTexture.needsUpdate = true
    paintedFace = face
    faceDirty = false
  }

  const paint = () => {
    palette = readPalette()
    key.intensity = palette.key
    hemisphere.color.copy(palette.hemisphere[0])
    hemisphere.groundColor.copy(palette.hemisphere[1])
    hemisphere.intensity = palette.hemisphere[2]
    drawPaper(backCanvas, palette.paperBack.getStyle(), palette.letter.edge)
    backTexture.needsUpdate = true
    trailMaterial.color.copy(palette.accent)
    faceDirty = true
  }

  // ── Frame ──────────────────────────────────────────────────────────────────
  const position = new Vector3()
  const quaternion = new Quaternion()
  const flightQuaternion = new Quaternion()
  const extra = new Quaternion()
  const pivot = new Vector3()
  const heading = new Vector3()
  const groupMatrix = new Matrix4()
  const pivotMatrix = new Matrix4()
  const unitScale = new Vector3(1, 1, 1)
  const point = new Vector3()
  const forwardWorld = new Vector3()
  const euler = new Euler()

  const flying = () => act === 'takeoff' || act === 'return'

  /** Where the paper is and how it is turned, for this frame. */
  const place = () => {
    // The sheet keeps facing the viewer through the first folds and most of the half
    // fold, then turns into the plane's attitude while the wings come down.
    const blend = MathUtils.smoothstep(fold, 0.66, 1)
    position.lerpVectors(SHEET_POSITION, hoverPosition, blend)
    quaternion.slerpQuaternions(sheetQuaternion, hoverQuaternion, blend)
    pivot.copy(centroid).multiplyScalar(-blend)

    if (flying()) {
      const path = act === 'takeoff' ? takeoff : landing
      const t = act === 'takeoff' ? easeIn(flight) : easeOut(flight)
      position.set(...bezier(path, t))
      heading.set(...bezierTangent(path, t))
      const bank = (act === 'takeoff' ? 0.45 : -0.4) * side * Math.sin(Math.PI * flight)
      attitude(heading, bank, flightQuaternion)
      // Turns into its heading as it leaves, and back to the hover attitude as it lands.
      const into = act === 'takeoff' ? segment(flight, 0, 0.3) : 1 - segment(flight, 0.72, 1)
      quaternion.slerpQuaternions(hoverQuaternion, flightQuaternion, MathUtils.smootherstep(into, 0, 1))
      pivot.copy(centroid).negate()
    }

    if (!still) {
      // The letter floats; the plane bobs, waiting for the server.
      const floating = 1 - blend
      position.y += 0.045 * Math.sin(time * 0.9) * floating
      if (act === 'hover' || act === 'folding' || act === 'shake' || act === 'unfolding') {
        position.y += 0.05 * Math.sin(time * 2.3) * blend
      }
      extra.setFromEuler(euler.set(0, 0.035 * Math.sin(time * 0.55) * floating, 0.012 * Math.sin(time * 0.75) * floating))
      quaternion.premultiply(extra)
      forwardWorld.copy(LOCAL_FORWARD).applyQuaternion(quaternion)
      const wobble = act === 'shake' ? 0.3 * Math.sin(timer * 40) * (1 - timer / SHAKE_SECONDS) : 0
      const roll = (act === 'hover' ? 0.04 * Math.sin(time * 1.7) : 0) + wobble
      if (roll) quaternion.premultiply(extra.setFromAxisAngle(forwardWorld, roll * blend))
      // Refused before it became a plane: the sheet shakes its head instead.
      if (wobble && blend < 1) quaternion.premultiply(extra.setFromAxisAngle(FACING, wobble * 0.5 * (1 - blend)))
    }

    // Small reactions: a nod per keystroke, a dip for the stamp, a lift when ready.
    position.y += lift.value * 0.07 - stamp.value * 0.05
    extra.setFromEuler(euler.set(tiltPitch.value + nod.value * 0.05 + stamp.value * 0.06, tiltYaw.value, 0))
    quaternion.premultiply(extra)

    groupMatrix.compose(position, quaternion, unitScale).multiply(pivotMatrix.makeTranslation(pivot))

    const poses = poseFacets(facets, foldAngles(fold))
    for (let v = 0; v < vertexCount; v++) {
      const [x, y, z] = applyPose(poses[vertexFacet[v]], [vertexSheet[v * 2], vertexSheet[v * 2 + 1], 0])
      point.set(x, y, z).applyMatrix4(groupMatrix)
      positions[v * 3] = point.x
      positions[v * 3 + 1] = point.y
      positions[v * 3 + 2] = point.z
      const reach = (FLOOR_Y - point.y) / SHADOW_FALL.y
      shadowPositions[v * 3] = point.x + SHADOW_FALL.x * reach
      shadowPositions[v * 3 + 1] = FLOOR_Y
      shadowPositions[v * 3 + 2] = point.z + SHADOW_FALL.z * reach
    }
    positionAttribute.needsUpdate = true
    shadowAttribute.needsUpdate = true

    // The shadow thins into the floor as the plane climbs away.
    const fade = MathUtils.smoothstep(position.y - FLOOR_Y, 2.6, 4.6)
    shadowMaterial.color.lerpColors(palette.shadow, palette.background, fade)

    const hidden = act === 'away'
    front.visible = !hidden
    back.visible = !hidden
    shadow.visible = !hidden
  }

  // ── Trail ──────────────────────────────────────────────────────────────────
  const tail = new Vector3()
  const dotMatrix = new Matrix4()
  const dotScale = new Vector3()

  const dropDots = () => {
    if (!flying()) {
      tailKnown = false
      return
    }
    tail.set(centroid.x, -SHEET_HALF_HEIGHT + 0.15, centroid.z).applyMatrix4(groupMatrix)
    if (!tailKnown) {
      lastTail.copy(tail)
      tailKnown = true
      return
    }
    sinceDot += tail.distanceTo(lastTail)
    lastTail.copy(tail)
    if (sinceDot < TRAIL_SPACING) return
    sinceDot = 0
    const dot = dots[nextDot]
    dot.position.copy(tail)
    dot.age = 0
    nextDot = (nextDot + 1) % TRAIL_DOTS
  }

  const placeDots = (dt: number) => {
    let any = false
    dots.forEach((dot, index) => {
      dot.age += dt
      const size = still ? 0 : Math.max(0, 1 - dot.age / TRAIL_LIFE)
      if (size > 0) any = true
      dotScale.setScalar(size)
      dotMatrix.compose(dot.position, camera.quaternion, dotScale)
      trail.setMatrixAt(index, dotMatrix)
    })
    trail.instanceMatrix.needsUpdate = true
    trail.visible = any
  }

  const render = (dt = 0) => {
    if (disposed) return
    paintFace()
    place()
    dropDots()
    placeDots(dt)
    renderer.render(scene, camera)
  }

  // ── Acts ───────────────────────────────────────────────────────────────────
  const startFold = (launch: boolean) => {
    act = 'folding'
    launchQueued = launch
  }

  const startTakeoff = () => {
    act = 'takeoff'
    flight = 0
    launchQueued = false
    sinceDot = 0
    tailKnown = false
  }

  /** Reduced motion: each state's end, at once. */
  const settle = () => {
    flight = 0
    timer = 0
    launchQueued = false
    if (phase === 'sending') {
      act = 'hover'
      fold = 1
    } else {
      act = 'letter'
      fold = 0
      receipt = phase === 'sent'
    }
    springs.forEach((spring) => {
      spring.target = 0
      spring.snap()
    })
    faceDirty = true
  }

  const advance = (dt: number) => {
    time += dt
    switch (act) {
      case 'folding':
        fold = Math.min(1, fold + dt / FOLD_SECONDS)
        if (fold >= 1) {
          if (launchQueued || phase === 'sent') startTakeoff()
          else act = 'hover'
        }
        break
      case 'unfolding':
        fold = Math.max(0, fold - dt / UNFOLD_SECONDS)
        if (fold <= 0) act = 'letter'
        break
      case 'shake':
        timer += dt
        if (timer >= SHAKE_SECONDS) act = 'unfolding'
        break
      case 'takeoff':
        flight = Math.min(1, flight + dt / TAKEOFF_SECONDS)
        if (flight >= 1) {
          act = 'away'
          timer = 0
          // Out of sight: the letter it comes back as shows the check.
          receipt = phase === 'sent'
        }
        break
      case 'away':
        timer += dt
        if (timer >= AWAY_SECONDS) {
          act = 'return'
          flight = 0
          tailKnown = false
        }
        break
      case 'return':
        flight = Math.min(1, flight + dt / RETURN_SECONDS)
        if (flight >= 1) act = 'unfolding'
        break
      case 'hover':
      case 'letter':
        break
    }
    for (const spring of springs) {
      if (spring.atRest()) spring.snap()
      else spring.step(dt)
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  const onPointerMove = (event: PointerEvent) => {
    if (!finePointer || still) return
    const box = canvas.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width
    const y = (event.clientY - box.top) / box.height
    tiltYaw.target = MathUtils.clamp((x - 0.5) * 2, -1.4, 1.4) * 0.09
    tiltPitch.target = MathUtils.clamp((y - 0.5) * 2, -1.4, 1.4) * 0.05
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  let frame = 0
  let last = 0
  let onScreen = true
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop)
    // Never negative: a frame's timestamp can predate the clock reading that started the loop.
    const dt = MathUtils.clamp((now - last) / 1000, 0, 0.05)
    last = now
    advance(dt)
    render(dt)
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
    const width = Math.max(1, box.width)
    const height = Math.max(1, box.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    const distance = Math.max(VIEW_HALF_HEIGHT / halfTan, VIEW_HALF_WIDTH / (halfTan * camera.aspect))
    camera.position.set(0, LOOK_Y + Math.sin(CAMERA_ELEVATION) * distance, Math.cos(CAMERA_ELEVATION) * distance)
    camera.far = distance + 40
    camera.lookAt(0, LOOK_Y, 0)
    camera.updateProjectionMatrix()
    render()
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
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
  window.addEventListener('pointermove', onPointerMove, { passive: true })

  paint()
  resize()
  renderer.compile(scene, camera)
  render()
  options.onReady()
  syncLoop()

  return {
    update: (state) => {
      const previous = latest
      latest = state
      const changedPhase = state.phase !== phase
      phase = state.phase

      if (still) {
        if (changedPhase) settle()
        render()
        return
      }

      if (act === 'letter' && phase === 'editing') {
        // The stamp lands; the letter lifts a little once it is ready to fold.
        if (state.topic && state.topic !== previous?.topic) stamp.velocity += 2.4
        if (state.ready && previous && !previous.ready) lift.velocity += 1.8
      }
      if (!changedPhase) return

      switch (phase) {
        case 'sending':
          if (act === 'letter' || act === 'unfolding' || act === 'shake') startFold(false)
          break
        case 'sent':
          if (act === 'letter' || act === 'unfolding' || act === 'shake') startFold(true)
          else if (act === 'folding') launchQueued = true
          else if (act === 'hover') startTakeoff()
          break
        case 'failed':
          if (act === 'folding' || act === 'hover') {
            act = 'shake'
            timer = 0
            launchQueued = false
          }
          break
        case 'editing':
          // "Send another": a fresh letter. Mid-flight, the plane comes back as one.
          receipt = false
          if (act === 'folding' || act === 'hover') act = 'unfolding'
          break
      }
    },
    nudge: () => {
      if (still || act !== 'letter') return
      const now = performance.now()
      if (now - lastNudge < NUDGE_INTERVAL_MS) return
      lastNudge = now
      nod.velocity += 1.3
    },
    setStill: (value) => {
      if (value === still) return
      still = value
      if (still) {
        tiltYaw.target = 0
        tiltPitch.target = 0
        settle()
        render()
      }
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
      canvas.removeEventListener('webglcontextlost', onContextLost)
      trail.dispose()
      for (const item of disposables) item.dispose()
    },
  }
}
