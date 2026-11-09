/**
 * The no-WebGL picture of the contact stage: a paper plane on its dotted trail.
 * Flat: two solid tones and one line colour (`currentColor`, the accent text).
 */
export default function PlaneArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 260" fill="none" className={className}>
      <path
        d="M28 222c58 20 118-6 112-44-5-30 28-52 76-62"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="0.5 13"
        opacity="0.6"
      />
      <g stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
        <path d="M334 44 176 104l62 18z" fill="var(--card)" />
        <path d="M334 44 238 122l26 74z" fill="var(--secondary)" />
        <path d="m238 122 6 34 20 40" />
      </g>
    </svg>
  )
}
