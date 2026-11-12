import type { VoxelIconKey } from '@/components/three/voxel-icon/icons'

// The /about page as chapters: the intro, then one per <h2> section, in page order.
// The chapter list (AboutRail), the section headers and the 3D companion all read
// from here, so a chapter always has the same number and icon everywhere. Pure and
// client-safe; tested in chapters.test.ts.

export const ABOUT_CHAPTER_IDS = [
  'profile',
  'at-a-glance',
  'what-i-do',
  'experience',
  'education',
  'skills',
  'certifications',
  'github',
  'languages',
  'how-i-work',
  'faq',
  'contact',
] as const

export type AboutChapterId = (typeof ABOUT_CHAPTER_IDS)[number]

export const CHAPTER_ICONS: Record<AboutChapterId, VoxelIconKey> = {
  profile: 'hand',
  'at-a-glance': 'idCard',
  'what-i-do': 'code',
  experience: 'briefcase',
  education: 'graduationCap',
  skills: 'layers',
  certifications: 'award',
  github: 'gitBranch',
  languages: 'languages',
  'how-i-work': 'usersRound',
  faq: 'circleHelp',
  contact: 'send',
}

/** The intro has no section id of its own: its chapter starts at the top of <main>. */
export const PROFILE_TARGET = 'main-content'

export interface AboutChapter {
  id: AboutChapterId
  /** Id of the element the link jumps to and the scrollspy measures. */
  target: string
  label: string
  /** Two digits, counting only the chapters shown: `01`, `02`… */
  number: string
  icon: VoxelIconKey
}

export type AboutChapterEntry = { id: AboutChapterId; label: string }

/**
 * The chapters for the sections that render. Pass `false` for a section that
 * renders nothing (an empty CMS collection), so the numbers stay consecutive.
 * Entries come out in page order, once each.
 */
export function buildAboutChapters(entries: ReadonlyArray<AboutChapterEntry | false | null | undefined>): AboutChapter[] {
  const seen = new Set<AboutChapterId>()
  return entries
    .filter((entry): entry is AboutChapterEntry => {
      if (!entry || seen.has(entry.id)) return false
      seen.add(entry.id)
      return true
    })
    .sort((a, b) => ABOUT_CHAPTER_IDS.indexOf(a.id) - ABOUT_CHAPTER_IDS.indexOf(b.id))
    .map((entry, index) => ({
      id: entry.id,
      target: entry.id === 'profile' ? PROFILE_TARGET : entry.id,
      label: entry.label,
      number: String(index + 1).padStart(2, '0'),
      icon: CHAPTER_ICONS[entry.id],
    }))
}

/**
 * The chapter being read: the last one whose top has crossed the reading line
 * (px from the top of the viewport), or the first while none has. At the very
 * bottom of the page it is the last chapter, which may be too short to ever reach
 * the line. A missing element can be passed as `Infinity`.
 */
export function activeChapterIndex(tops: readonly number[], line: number, atEnd: boolean): number {
  if (tops.length === 0) return -1
  if (atEnd) return tops.length - 1
  let active = 0
  tops.forEach((top, index) => {
    if (top <= line) active = index
  })
  return active
}

/** Where the reading line sits: past the sticky offsets, and no higher than 30% down the screen. */
export function readingLine(scrollMarginTop: number, viewportHeight: number): number {
  return Math.max(scrollMarginTop + 8, viewportHeight * 0.3)
}
