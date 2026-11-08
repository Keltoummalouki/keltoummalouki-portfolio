// Shared class strings for the numbered "showcase" sections (projects, reviews).
// Pills and icon buttons are 44px tall (touch targets); transitions list their
// properties explicitly and use the `ease-fluid` token.

/** Glass card surface. */
export const surface = 'rounded-2xl border border-border bg-card/80 backdrop-blur-xl'

/** Secondary pill link/button ("View all projects", "Write a review"). */
export const pillOutline =
  'group/pill inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border bg-card/60 px-5 text-sm font-semibold text-foreground backdrop-blur transition-[border-color,background-color,scale] duration-200 ease-fluid hover:border-primary/50 hover:bg-primary/10 active:scale-[0.98]'

/** Primary pill, in the site's one flat colour. */
export const pillPrimary =
  'group/pill inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-[background-color,scale] duration-200 ease-fluid hover:bg-primary/90 active:scale-[0.98]'

/** Round icon-only control (carousel arrows, card links). Needs an aria-label or sr-only text. */
export const iconButton =
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card/70 text-foreground transition-[border-color,background-color,color,scale,opacity] duration-200 ease-fluid hover:border-primary/50 hover:bg-primary/10 hover:text-primary-text active:scale-95 disabled:pointer-events-none disabled:opacity-40'

/** Arrow that nudges toward the reading direction on pill hover. */
export const pillArrow =
  'size-4 transition-transform duration-200 ease-fluid group-hover/pill:translate-x-0.5 rtl:rotate-180 rtl:group-hover/pill:-translate-x-0.5'
