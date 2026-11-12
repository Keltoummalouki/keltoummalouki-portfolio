import {
  AmbientLight,
  DirectionalLight,
  DynamicDrawUsage,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshLambertMaterial,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
  type Color,
} from 'three'
import { Spring, readCssColor, roundedRect } from '../kit'
import { VOXEL_ICONS, VOXEL_ICON_KEYS, type VoxelIconKey } from './icons'
import { rasterizeIcon } from './raster'
import { ICON_GRID, cellsFromCoverage, centreCells, planMorph, shapeBounds, sweepDelays, type Point } from './voxels'

// The /about page's chapter companion: the icon of the chapter being read, built
// out of voxels. When the chapter changes, the cubes the new icon shares with the
// old one stay put and the others tumble across, lifting toward the viewer, in a
// sweep that writes the new icon in reading order. Spare cubes sink away behind it;
// missing ones rise from behind. The intro's icon is a hand, and it waves.
//
// One flat accent, as everywhere on the site: matte cubes in --primary under one
// white light, so each face reads as a single tone (front, top and side differ only
// by shading). No glow, no gradient, no reflection.
//
// Vanilla Three.js, loaded once the stage nears the viewport. It draws only while
// something moves: a change of icon, the pointer (it leans toward it), and a slow
// idle sway that settles a few seconds after the visitor stops. In `still` mode
// (reduced motion) it draws one frame per change, the new icon already in place.

export interface VoxelSceneOptions {
  canvas: HTMLCanvasElement
  /** Render one frame per change instead of animating. */
  still: boolean
  /** Sweeps and leans the other way. */
  rtl: boolean
  onReady: () => void
  onContextLost: () => void
}

export interface VoxelScene {
  show: (icon: VoxelIconKey) => void
  setStill: (still: boolean) => void
  dispose: () => void
}

const CAMERA_FOV = 24
/** Half the square the camera keeps in view: the icon (12 cells each way), its lean and the lift. */
const VIEW_HALF = 15.5
const CUBE_SIZE = 0.84
const CUBE_BEVEL = 0.07
/** Resting pose: turned a little so the cubes show a top and a side as well as their faces. */
const BASE_PITCH = 0.22
const BASE_YAW = -0.36

const SWEEP_SECONDS = 0.34
const LEAVE_SWEEP_SECONDS = 0.18
const JITTER_SECONDS = 0.05
/** Toward the viewer on a long trip; a trip this long gets the full lift. */
const LIFT = 3.6
const LIFT_FULL_TRIP = 9
/** The lift lets go this close to the destination. */
const LIFT_UNTIL = 1.3
/** Shorter trips just slide: no lift, no tumble. */
const STAY_DISTANCE = 0.05
/** Cubes rise from, and sink back into, the space behind the icon. */
const SPAWN_DEPTH = -10
const LEAVE_DEPTH = -7

const AWAKE_SECONDS = 5
const SWAY_YAW = 0.07
const SWAY_PITCH = 0.035
const RIPPLE = 0.16
const POINTER_YAW = 0.3
const POINTER_PITCH = 0.2
const WAVE_DELAY_SECONDS = 0.55
const WAVE_SECONDS = 1.7
const WAVE_ROLL = 0.2
const WAVE_CYCLES = 2.5

const MOVE = { stiffness: 120, damping: 15 }
const GROW = { stiffness: 170, damping: 19 }
const RISE = { stiffness: 90, damping: 14 }
const TURN = { stiffness: 70, damping: 12 }
const REST = 0.002
const QUARTER = Math.PI / 2
const AXES = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(-1, 0, 0), new Vector3(0, -1, 0)]

interface Palette {
  dark: boolean
  accent: Color
  key: number
  ambient: number
}

/** Colours follow the theme and the admin-picked primary colour (--primary). */
function readPalette(): Palette {
  const root = document.documentElement
  const dark = root.classList.contains('dark')
  const accent = readCssColor(getComputedStyle(root).getPropertyValue('--primary').trim(), '#2A6AFF')
  return dark ? { dark, accent, key: 2.3, ambient: 2.05 } : { dark, accent, key: 2.2, ambient: 2.15 }
}

/** A cube with chamfered edges, so neighbours read apart where their faces meet. */
function cubeGeometry(size: number, bevel: number) {
  const body = size - bevel * 2
  const geometry = new ExtrudeGeometry(roundedRect(body, body, 0.04), {
    depth: body,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 2,
  })
  geometry.translate(0, 0, -body / 2)
  return geometry
}

/** Small deterministic generator: the same visit tumbles the same way. */
function random(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Throws when WebGL is unavailable (the caller keeps the drawing). */
export function createVoxelScene(options: VoxelSceneOptions): VoxelScene {
  const { canvas, rtl } = options
  const side = rtl ? -1 : 1
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  const lowPower = coarse || (navigator.hardwareConcurrency || 8) <= 4
  const maxPixelRatio = lowPower ? 1.5 : 1.75
  const next = random(0x6b6d)

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 1, 200)
  const halfTan = Math.tan(MathUtils.degToRad(CAMERA_FOV / 2))

  let still = options.still
  let disposed = false
  let palette = readPalette()
  const disposables: { dispose: () => void }[] = [renderer]
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item)
    return item
  }

  // One white light from the top of the start side, and a soft fill.
  const key = new DirectionalLight(0xffffff, palette.key)
  key.position.set(-3 * side, 8, 5)
  const fill = new AmbientLight(0xffffff, palette.ambient)
  scene.add(key, fill)

  // ── Shapes ─────────────────────────────────────────────────────────────────
  // Every icon, rasterized once onto the 24×24 grid: one cube per covered cell.
  const shapes = new Map<VoxelIconKey, Point[]>()
  for (const icon of VOXEL_ICON_KEYS) {
    shapes.set(icon, centreCells(cellsFromCoverage(rasterizeIcon(VOXEL_ICONS[icon], ICON_GRID), ICON_GRID)))
  }
  const count = Math.max(1, ...[...shapes.values()].map((shape) => shape.length))

  // ── Cubes ──────────────────────────────────────────────────────────────────
  const material = track(new MeshLambertMaterial({ color: palette.accent, flatShading: true }))
  const cubes = new InstancedMesh(track(cubeGeometry(CUBE_SIZE, CUBE_BEVEL)), material, count)
  cubes.instanceMatrix.setUsage(DynamicDrawUsage)
  cubes.frustumCulled = false
  // lean (yaw, pitch) → wave (rolls around the wrist) → offset (undoes the pivot) → cubes
  const lean = new Group()
  const wave = new Group()
  const offset = new Group()
  lean.add(wave)
  wave.add(offset)
  offset.add(cubes)
  scene.add(lean)

  // Per cube, as flat arrays: where it is, where it is going, and what is next.
  const position = new Float32Array(count * 3)
  const velocity = new Float32Array(count * 3)
  const goal = new Float32Array(count * 3)
  const queued = new Float32Array(count * 3)
  const queuedScale = new Float32Array(count)
  /** Seconds before the queued trip starts; negative when nothing is queued. */
  const wait = new Float32Array(count).fill(-1)
  const scale = new Float32Array(count)
  const scaleVelocity = new Float32Array(count)
  const scaleGoal = new Float32Array(count)
  const lift = new Float32Array(count)
  const liftVelocity = new Float32Array(count)
  const liftAmount = new Float32Array(count)
  const spin = new Float32Array(count)
  const spinVelocity = new Float32Array(count)
  const spinGoal = new Float32Array(count)
  const spinAxis = new Uint8Array(count)
  for (let cube = 0; cube < count; cube++) position[cube * 3 + 2] = SPAWN_DEPTH

  const leanYaw = new Spring(0, 26, 8)
  const leanPitch = new Spring(0, 26, 8)

  // ── State ──────────────────────────────────────────────────────────────────
  let shown: VoxelIconKey | null = null
  let time = 0
  let energy = 0
  let awakeUntil = 0
  let restless = false
  let waveAt = Infinity
  const clock = () => performance.now() / 1000

  const trip = (cube: number) => {
    const i = cube * 3
    return Math.hypot(goal[i] - position[i], goal[i + 1] - position[i + 1], goal[i + 2] - position[i + 2])
  }

  /** Starts a cube's queued trip. */
  const launch = (cube: number) => {
    const i = cube * 3
    wait[cube] = -1
    const appearing = queuedScale[cube] > 0 && scaleGoal[cube] === 0 && scale[cube] < 0.02
    if (appearing) {
      // Rises from behind the cell it is going to.
      position[i] = queued[i]
      position[i + 1] = queued[i + 1]
      position[i + 2] = SPAWN_DEPTH
      velocity.fill(0, i, i + 3)
    }
    if (queuedScale[cube] > 0) {
      goal[i] = queued[i]
      goal[i + 1] = queued[i + 1]
      goal[i + 2] = queued[i + 2]
    } else {
      // Leaving: sinks back from wherever it is when its turn comes.
      goal[i] = position[i]
      goal[i + 1] = position[i + 1]
      goal[i + 2] = LEAVE_DEPTH
    }
    scaleGoal[cube] = queuedScale[cube]

    const distance = trip(cube)
    const flies = !appearing && queuedScale[cube] > 0 && distance > LIFT_UNTIL
    liftAmount[cube] = flies ? LIFT * Math.min(1, distance / LIFT_FULL_TRIP) : 0
    if (!flies) return
    // A tumble of one or two quarter turns. A new axis only from rest: switching
    // axes mid-turn would snap the cube's orientation.
    if (Math.abs(spinGoal[cube] - spin[cube]) < 0.01 && Math.abs(spinVelocity[cube]) < 0.01) {
      spin[cube] = 0
      spinGoal[cube] = 0
      spinVelocity[cube] = 0
      spinAxis[cube] = Math.floor(next() * AXES.length)
    }
    spinGoal[cube] += QUARTER * (next() < 0.7 ? 1 : 2)
  }

  /** Sends a cube to `target` (or away, when null) after `delay` seconds. */
  const schedule = (cube: number, target: Point | null, delay: number) => {
    const i = cube * 3
    if (target) {
      queued[i] = target.x
      queued[i + 1] = target.y
      queued[i + 2] = target.z
    }
    queuedScale[cube] = target ? 1 : 0
    wait[cube] = delay
    if (delay <= 0) launch(cube)
  }

  /** A cube on screen, or committed to being there. */
  const present = (cube: number) => scale[cube] > 0.05 || (wait[cube] < 0 && scaleGoal[cube] > 0)

  const snapAll = () => {
    for (let cube = 0; cube < count; cube++) {
      if (wait[cube] >= 0) launch(cube)
      const i = cube * 3
      position[i] = goal[i]
      position[i + 1] = goal[i + 1]
      position[i + 2] = goal[i + 2]
      velocity.fill(0, i, i + 3)
      scale[cube] = scaleGoal[cube]
      scaleVelocity[cube] = 0
      lift[cube] = 0
      liftVelocity[cube] = 0
      liftAmount[cube] = 0
      spin[cube] = 0
      spinGoal[cube] = 0
      spinVelocity[cube] = 0
    }
    waveAt = Infinity
  }

  const pointAt = (cube: number): Point => ({ x: position[cube * 3], y: position[cube * 3 + 1], z: position[cube * 3 + 2] })

  const morph = (icon: VoxelIconKey) => {
    const targets = shapes.get(icon) ?? []
    const from = Array.from({ length: count }, (_, cube) => (present(cube) ? pointAt(cube) : null))
    const plan = planMorph(from, targets)
    const arrive = sweepDelays(targets, SWEEP_SECONDS, rtl)

    const leaving: number[] = []
    for (let cube = 0; cube < count; cube++) {
      const target = plan[cube]
      if (target >= 0) {
        const point = targets[target]
        const start = from[cube]
        const stays = start !== null && Math.hypot(start.x - point.x, start.y - point.y, start.z - point.z) < STAY_DISTANCE
        schedule(cube, point, stays || still ? 0 : arrive[target] + next() * JITTER_SECONDS)
      } else if (from[cube]) {
        leaving.push(cube)
      } else {
        // Hidden and not needed: cancel any appearance it was waiting for.
        wait[cube] = -1
        scaleGoal[cube] = 0
      }
    }
    const leave = sweepDelays(leaving.map(pointAt), LEAVE_SWEEP_SECONDS, rtl)
    leaving.forEach((cube, index) => schedule(cube, null, still ? 0 : leave[index]))

    // The hand waves from the wrist once it has formed.
    if (icon === 'hand' && targets.length > 0) {
      const { minY } = shapeBounds(targets)
      wave.position.set(0, minY, 0)
      offset.position.set(0, -minY, 0)
      waveAt = still ? Infinity : time + SWEEP_SECONDS + WAVE_DELAY_SECONDS
    } else {
      waveAt = Infinity
    }
    restless = true
  }

  // ── Frame ──────────────────────────────────────────────────────────────────
  const stepSpring = (
    values: Float32Array,
    velocities: Float32Array,
    index: number,
    target: number,
    spring: { stiffness: number; damping: number },
    dt: number,
  ) => {
    const v = velocities[index] + (spring.stiffness * (target - values[index]) - spring.damping * velocities[index]) * dt
    velocities[index] = v
    values[index] += v * dt
    if (Math.abs(target - values[index]) < REST && Math.abs(v) < REST) {
      values[index] = target
      velocities[index] = 0
      return false
    }
    return true
  }

  const advance = (dt: number) => {
    time += dt
    let moving = false
    for (let cube = 0; cube < count; cube++) {
      if (wait[cube] >= 0) {
        wait[cube] -= dt
        moving = true
        if (wait[cube] < 0) launch(cube)
      }
      const i = cube * 3
      for (let axis = 0; axis < 3; axis++) {
        if (stepSpring(position, velocity, i + axis, goal[i + axis], MOVE, dt)) moving = true
      }
      const liftTarget = trip(cube) > LIFT_UNTIL ? liftAmount[cube] : 0
      if (stepSpring(lift, liftVelocity, cube, liftTarget, RISE, dt)) moving = true
      if (stepSpring(scale, scaleVelocity, cube, scaleGoal[cube], GROW, dt)) moving = true
      if (stepSpring(spin, spinVelocity, cube, spinGoal[cube], TURN, dt)) moving = true
      else if (spinGoal[cube] !== 0) {
        // At rest on a quarter turn: the same orientation as none, for a cube.
        spin[cube] = 0
        spinGoal[cube] = 0
      }
    }
    for (const spring of [leanYaw, leanPitch]) {
      if (spring.atRest()) spring.snap()
      else {
        spring.step(dt)
        moving = true
      }
    }
    energy += ((clock() < awakeUntil ? 1 : 0) - energy) * Math.min(1, dt * 1.6)
    if (energy < 0.002) energy = 0
    // A wave that is due or under way keeps the loop going; one that is over is cleared.
    if (time >= waveAt + WAVE_SECONDS) waveAt = Infinity
    restless = moving || Number.isFinite(waveAt)
  }

  const matrix = new Matrix4()
  const zero = new Matrix4().makeScale(0, 0, 0)
  const translation = new Vector3()
  const turn = new Quaternion()
  const size = new Vector3()

  const place = () => {
    for (let cube = 0; cube < count; cube++) {
      const s = scale[cube]
      if (s < 0.001) {
        cubes.setMatrixAt(cube, zero)
        continue
      }
      const i = cube * 3
      const ripple = energy * RIPPLE * Math.sin(time * 1.7 + goal[i] * 0.42 + goal[i + 1] * 0.28)
      translation.set(position[i], position[i + 1], position[i + 2] + lift[cube] + ripple)
      turn.setFromAxisAngle(AXES[spinAxis[cube]], spin[cube])
      size.setScalar(s)
      cubes.setMatrixAt(cube, matrix.compose(translation, turn, size))
    }
    cubes.instanceMatrix.needsUpdate = true

    const sway = energy
    lean.rotation.set(
      BASE_PITCH + leanPitch.value + sway * SWAY_PITCH * Math.sin(time * 0.8 + 1),
      (BASE_YAW + sway * SWAY_YAW * Math.sin(time * 0.6)) * side + leanYaw.value,
      0,
      'YXZ',
    )
    const u = (time - waveAt) / WAVE_SECONDS
    wave.rotation.z = u >= 0 && u < 1 ? WAVE_ROLL * side * Math.sin(u * Math.PI * 2 * WAVE_CYCLES) * (1 - u) ** 1.5 : 0
  }

  const render = () => {
    if (disposed) return
    place()
    renderer.render(scene, camera)
  }

  // ── Loop ───────────────────────────────────────────────────────────────────
  let frame = 0
  let last = 0
  let onScreen = true
  const wanted = () => restless || energy > 0 || clock() < awakeUntil
  const syncLoop = () => {
    const run = !still && !disposed && onScreen && !document.hidden && wanted()
    if (run && !frame) {
      last = performance.now()
      frame = requestAnimationFrame(loop)
    } else if (!run && frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
  }
  const loop = (now: number) => {
    frame = 0
    // Never negative: a frame's timestamp can predate the clock reading that started the loop.
    const dt = MathUtils.clamp((now - last) / 1000, 0, 0.05)
    last = now
    advance(dt)
    render()
    syncLoop()
  }
  const wake = () => {
    if (still || disposed) return
    awakeUntil = clock() + AWAKE_SECONDS
    syncLoop()
  }

  const resize = () => {
    const box = canvas.getBoundingClientRect()
    const width = Math.max(1, box.width)
    const height = Math.max(1, box.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    const distance = Math.max(VIEW_HALF / halfTan, VIEW_HALF / (halfTan * camera.aspect))
    camera.position.set(0, 0, distance)
    camera.far = distance + 60
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    render()
  }

  const paint = () => {
    palette = readPalette()
    material.color.copy(palette.accent)
    key.intensity = palette.key
    fill.intensity = palette.ambient
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  const onPointerMove = (event: PointerEvent) => {
    if (!finePointer || still) return
    const box = canvas.getBoundingClientRect()
    const x = (event.clientX - (box.left + box.width / 2)) / (window.innerWidth / 2)
    const y = (event.clientY - (box.top + box.height / 2)) / (window.innerHeight / 2)
    leanYaw.target = MathUtils.clamp(x, -1, 1) * POINTER_YAW
    leanPitch.target = MathUtils.clamp(y, -1, 1) * POINTER_PITCH
    wake()
  }
  const onScroll = () => wake()

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
    render()
  })
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })

  const onContextLost = (event: Event) => {
    event.preventDefault()
    options.onContextLost()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })

  paint()
  resize()
  renderer.compile(scene, camera)
  render()
  options.onReady()

  return {
    show: (icon) => {
      if (disposed || icon === shown) return
      shown = icon
      morph(icon)
      if (still) {
        snapAll()
        render()
        return
      }
      wake()
    },
    setStill: (value) => {
      if (value === still) return
      still = value
      if (still) {
        leanYaw.target = 0
        leanPitch.target = 0
        leanYaw.snap()
        leanPitch.snap()
        energy = 0
        awakeUntil = 0
        snapAll()
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
      window.removeEventListener('scroll', onScroll)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      cubes.dispose()
      for (const item of disposables) item.dispose()
    },
  }
}
