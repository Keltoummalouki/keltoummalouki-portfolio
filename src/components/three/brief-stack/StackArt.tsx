const COS = Math.cos(Math.PI / 6)
const CENTRE_X = 320
const CENTRE_Y = 240
const WIDTH = 260
const DEPTH = 176
const THICKNESS = 9
const LAYER_GAP = 116

/** Isometric point: x and z on the floor, y up. */
function iso(x: number, z: number, y: number): [number, number] {
  return [CENTRE_X + (x - z) * COS, CENTRE_Y + (x + z) * 0.5 - y]
}

const points = (...corners: [number, number][]) => corners.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

/** A flat rectangle on the floor plane at height y. */
function plate(x: number, z: number, width: number, depth: number, y: number) {
  return points(iso(x, z, y), iso(x + width, z, y), iso(x + width, z + depth, y), iso(x, z + depth, y))
}

function Slab({ y }: { y: number }) {
  const x = -WIDTH / 2
  const z = -DEPTH / 2
  const front = points(
    iso(x, z + DEPTH, y),
    iso(x + WIDTH, z + DEPTH, y),
    iso(x + WIDTH, z, y),
    iso(x + WIDTH, z, y - THICKNESS),
    iso(x + WIDTH, z + DEPTH, y - THICKNESS),
    iso(x, z + DEPTH, y - THICKNESS),
  )
  return (
    <g strokeLinejoin="round">
      <polygon points={front} fill="var(--secondary)" stroke="currentColor" strokeOpacity="0.5" />
      <polygon points={plate(x, z, WIDTH, DEPTH, y)} fill="var(--card)" stroke="currentColor" strokeWidth="1.25" />
    </g>
  )
}

/**
 * The 3D model as a drawing: what shows without WebGL (no-JS, data saver, old
 * devices) and while the scene loads, so the space is never empty.
 */
export default function StackArt({ className }: { className?: string }) {
  const wires = [
    [-WIDTH / 2 + 16, -DEPTH / 2 + 16],
    [WIDTH / 2 - 16, -DEPTH / 2 + 16],
    [-WIDTH / 2 + 16, DEPTH / 2 - 16],
    [WIDTH / 2 - 16, DEPTH / 2 - 16],
  ] as const

  const screenX = -WIDTH / 2 + 9
  const screenZ = -DEPTH / 2 + 9
  const screenWidth = WIDTH - 18
  const screenDepth = DEPTH - 18

  const [discX, discY] = iso(0, 0, -LAYER_GAP)

  return (
    <svg viewBox="0 0 640 480" fill="none" className={className} aria-hidden="true">
      {/* The orbit from the home hero. */}
      <ellipse
        cx={CENTRE_X}
        cy={CENTRE_Y + 8}
        rx="300"
        ry="108"
        transform={`rotate(-9 ${CENTRE_X} ${CENTRE_Y})`}
        stroke="currentColor"
        strokeOpacity="0.28"
      />

      {/* Data: drives on a plate. */}
      <Slab y={-LAYER_GAP} />
      {[0, 1, 2].map((level) => {
        const y = discY - 10 - level * 15
        return (
          <g key={level}>
            <ellipse cx={discX} cy={y + 8} rx="58" ry="33" fill="var(--secondary)" stroke="currentColor" strokeOpacity="0.5" />
            <ellipse cx={discX} cy={y} rx="58" ry="33" fill="var(--card)" stroke="currentColor" strokeWidth="1.25" />
          </g>
        )
      })}

      {/* Logic: a grid of modules. */}
      <Slab y={0} />
      {Array.from({ length: 12 }, (_, index) => {
        const column = index % 4
        const row = Math.floor(index / 4)
        return (
          <polygon
            key={index}
            points={plate(-WIDTH / 2 + 26 + column * 54, -DEPTH / 2 + 22 + row * 46, 46, 38, 4)}
            fill={index === 5 || index === 6 ? 'color-mix(in oklab, var(--primary) 55%, var(--card))' : 'var(--secondary)'}
            stroke="currentColor"
            strokeOpacity="0.7"
            strokeLinejoin="round"
          />
        )
      })}

      {/* Wires between the layers. */}
      {wires.map(([x, z]) => {
        const [lineX] = iso(x, z, 0)
        const [, top] = iso(x, z, LAYER_GAP - THICKNESS)
        const [, bottom] = iso(x, z, -LAYER_GAP)
        return <line key={`${x}${z}`} x1={lineX} x2={lineX} y1={top} y2={bottom} stroke="currentColor" strokeOpacity="0.45" />
      })}

      {/* Interface: a browser window. */}
      <Slab y={LAYER_GAP} />
      <polygon
        points={plate(screenX, screenZ, screenWidth, screenDepth, LAYER_GAP)}
        fill="color-mix(in oklab, var(--primary) 9%, var(--card))"
        stroke="currentColor"
        strokeOpacity="0.5"
        strokeLinejoin="round"
      />
      <polygon points={plate(screenX, screenZ, screenWidth, 20, LAYER_GAP)} fill="var(--secondary)" />
      <polygon
        points={plate(screenX + 18, screenZ + 36, 96, 46, LAYER_GAP)}
        fill="var(--primary)"
        fillOpacity="0.85"
      />
      <polygon points={plate(screenX + 18, screenZ + 96, 96, 54, LAYER_GAP)} fill="var(--secondary)" />
      <polygon points={plate(screenX + 132, screenZ + 36, 92, 114, LAYER_GAP)} fill="var(--secondary)" />
    </svg>
  )
}
