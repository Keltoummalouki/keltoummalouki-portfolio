import { describe, expect, it } from 'vitest'
import { VOXEL_ICON_KEYS } from '@/components/three/voxel-icon/icons'
import {
  ABOUT_CHAPTER_IDS,
  CHAPTER_ICONS,
  PROFILE_TARGET,
  activeChapterIndex,
  buildAboutChapters,
  readingLine,
} from './chapters'

describe('buildAboutChapters', () => {
  it('numbers the chapters shown and skips empty sections', () => {
    const chapters = buildAboutChapters([
      { id: 'profile', label: 'Profile' },
      { id: 'at-a-glance', label: 'At a glance' },
      false,
      { id: 'experience', label: 'Experience' },
      null,
      { id: 'contact', label: 'Let’s work together' },
    ])
    expect(chapters.map((chapter) => `${chapter.number} ${chapter.id}`)).toEqual([
      '01 profile',
      '02 at-a-glance',
      '03 experience',
      '04 contact',
    ])
  })

  it('points the intro at <main> and every other chapter at its section id', () => {
    const [profile, faq] = buildAboutChapters([
      { id: 'profile', label: 'Profile' },
      { id: 'faq', label: 'FAQ' },
    ])
    expect(profile.target).toBe(PROFILE_TARGET)
    expect(faq.target).toBe('faq')
  })

  it('keeps page order and drops duplicates', () => {
    const chapters = buildAboutChapters([
      { id: 'faq', label: 'FAQ' },
      { id: 'profile', label: 'Profile' },
      { id: 'faq', label: 'FAQ again' },
    ])
    expect(chapters.map((chapter) => chapter.label)).toEqual(['Profile', 'FAQ'])
  })

  it('gives each chapter its own voxel icon', () => {
    const icons = ABOUT_CHAPTER_IDS.map((id) => CHAPTER_ICONS[id])
    expect(new Set(icons).size).toBe(ABOUT_CHAPTER_IDS.length)
    for (const icon of icons) expect(VOXEL_ICON_KEYS).toContain(icon)
  })
})

describe('activeChapterIndex', () => {
  const line = 200

  it('is the first chapter before any section reaches the line', () => {
    expect(activeChapterIndex([-40, 600, 1400], line, false)).toBe(0)
  })

  it('is the last chapter whose top has crossed the line', () => {
    expect(activeChapterIndex([-900, -300, 150, 700], line, false)).toBe(2)
    expect(activeChapterIndex([-900, -300, 200, 700], line, false)).toBe(2)
  })

  it('skips sections that are missing', () => {
    expect(activeChapterIndex([-900, Infinity, 100], line, false)).toBe(2)
  })

  it('is the last chapter at the bottom of the page', () => {
    expect(activeChapterIndex([-2000, -900, 500], line, true)).toBe(2)
  })

  it('has nothing to pick from an empty page', () => {
    expect(activeChapterIndex([], line, false)).toBe(-1)
  })
})

describe('readingLine', () => {
  it('sits below the sticky offset on a short screen', () => {
    expect(readingLine(160, 500)).toBe(168)
  })

  it('sits 30% down a tall screen', () => {
    expect(readingLine(112, 1000)).toBe(300)
  })
})
