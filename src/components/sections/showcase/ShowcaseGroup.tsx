import type { ReactNode } from 'react'

/**
 * Shared backdrop + rhythm for the numbered sections (projects, reviews): one
 * container, hairline dividers between rows, and a static layer of glowing
 * light lines (decorative SVG, painted once, no animation; md+ only, since a
 * phone-height column stretches the curves across the text).
 */
export default function ShowcaseGroup({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden bg-background">
      <FlowLines />
      <div className="relative container-main divide-y divide-border/70 py-6 md:py-10">{children}</div>
    </div>
  )
}

const LINES = [
  { d: 'M-80 260 C 260 120, 520 420, 820 280 S 1260 140, 1520 230', width: 1.25 },
  { d: 'M-80 330 C 300 230, 560 470, 860 340 S 1300 230, 1520 300', width: 0.75 },
  { d: 'M-80 1180 C 240 1320, 600 1040, 900 1160 S 1280 1320, 1520 1180', width: 1.25 },
  { d: 'M-80 1960 C 320 1820, 640 2100, 960 1960 S 1300 1840, 1520 1920', width: 1 },
]

function FlowLines() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,transparent,black_6%,black_94%,transparent)]"
    >
      <div className="absolute inset-x-0 top-0 h-[40rem] bg-[radial-gradient(55%_45%_at_50%_0%,var(--glow-color),transparent_70%)] opacity-60" />
      <svg
        className="absolute inset-0 hidden h-full w-full opacity-35 md:block dark:opacity-70"
        viewBox="0 0 1440 2400"
        preserveAspectRatio="none"
        fill="none"
      >
        <defs>
          <linearGradient id="showcase-line" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="0.3" stopColor="var(--primary)" />
            <stop offset="0.7" stopColor="#8B5CF6" />
            <stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
          </linearGradient>
          <filter id="showcase-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {LINES.map((line) => (
          <g key={line.d}>
            <path
              d={line.d}
              stroke="url(#showcase-line)"
              strokeWidth={line.width * 5}
              strokeOpacity={0.35}
              filter="url(#showcase-glow)"
              vectorEffect="non-scaling-stroke"
            />
            <path d={line.d} stroke="url(#showcase-line)" strokeWidth={line.width} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
    </div>
  )
}
