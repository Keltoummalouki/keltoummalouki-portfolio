import { describe, expect, it } from 'vitest'
import {
  aboutProfileSchema,
  cleanI18nMap,
  designSettingsSchema,
  educationSchema,
  experienceSchema,
  languageSchema,
  mediaUploadSchema,
  serviceSchema,
  skillSchema,
} from './schema'

describe('cms schema helpers', () => {
  it('keeps only non-empty localized strings in i18n maps', () => {
    expect(cleanI18nMap({ fr: 'Bonjour', en: '', ar: 'مرحبا' })).toEqual({
      fr: 'Bonjour',
      ar: 'مرحبا',
    })
  })

  it('requires French about copy', () => {
    const result = aboutProfileSchema.safeParse({
      fullName: 'Keltoum',
      avatarUrl: '',
      availabilityStatus: 'available',
      cvUrl: '/cv.pdf',
      cvUrlFr: '/cv-fr.pdf',
      cvUrlEn: '/cv-en.pdf',
      location: { fr: 'Casablanca', en: 'Casablanca', ar: 'الدار البيضاء' },
      headline: { fr: '', en: 'Hello', ar: '' },
      bio: { fr: 'Bio française', en: '', ar: '' },
    })

    expect(result.success).toBe(false)
  })

  it('accepts safe design settings only', () => {
    expect(
      designSettingsSchema.safeParse({
        primaryColor: '#2563EB',
        accentColor: '#8B5CF6',
        defaultLocale: 'fr',
        defaultTheme: 'dark',
        fontBody: 'manrope',
        fontHeading: 'playfair',
        cursorStyle: 'ring',
        headerPosition: 'right',
        navItems: ['about', 'blog', 'freelance', 'contact'],
      }).success,
    ).toBe(true)

    expect(
      designSettingsSchema.safeParse({
        primaryColor: 'url(javascript:alert(1))',
        accentColor: '#8B5CF6',
        defaultLocale: 'fr',
        defaultTheme: 'dark',
        headerPosition: 'floating',
        navItems: ['about'],
      }).success,
    ).toBe(false)

    expect(
      designSettingsSchema.safeParse({
        primaryColor: '#2563EB',
        accentColor: '#8B5CF6',
        defaultLocale: 'fr',
        defaultTheme: 'dark',
        headerPosition: 'top',
        navItems: ['about'],
      }).success,
    ).toBe(false)
  })

  it('accepts known media kinds', () => {
    expect(mediaUploadSchema.safeParse({ kind: 'profile', alt: { fr: '', en: '', ar: '' } }).success).toBe(true)
    expect(mediaUploadSchema.safeParse({ kind: 'cv', alt: { fr: '', en: '', ar: '' } }).success).toBe(true)
    expect(mediaUploadSchema.safeParse({ kind: 'skill', alt: { fr: '', en: '', ar: '' } }).success).toBe(true)
    expect(mediaUploadSchema.safeParse({ kind: 'script', alt: { fr: '', en: '', ar: '' } }).success).toBe(false)
  })

  it('validates translated language entries', () => {
    expect(
      languageSchema.safeParse({
        id: '',
        name: { fr: 'Français', en: 'French', ar: 'الفرنسية' },
        level: { fr: 'B1', en: 'B1', ar: 'B1' },
        icon: 'globe',
        sortOrder: '1',
        status: 'published',
      }).success,
    ).toBe(true)

    expect(
      languageSchema.safeParse({
        id: '',
        name: { fr: '', en: 'English', ar: 'الإنجليزية' },
        level: { fr: 'A2', en: 'A2', ar: 'A2' },
        sortOrder: '2',
        status: 'published',
      }).success,
    ).toBe(false)
  })

  it('defaults skills to technical and accepts soft skills', () => {
    const technical = skillSchema.safeParse({
      id: '',
      categoryId: '',
      name: 'Next.js',
      imageUrl: '',
      sortOrder: '0',
      status: 'published',
    })
    expect(technical.success).toBe(true)
    if (technical.success) expect(technical.data.skillType).toBe('technical')

    const soft = skillSchema.safeParse({
      id: '',
      skillType: 'soft',
      name: 'Teamwork',
      imageUrl: '',
      sortOrder: '1',
      status: 'published',
    })
    expect(soft.success).toBe(true)
    if (soft.success) expect(soft.data.skillType).toBe('soft')

    expect(
      skillSchema.safeParse({ skillType: 'physical', name: 'x', imageUrl: '', status: 'published' }).success,
    ).toBe(false)
  })

  it('accepts direct-upload image urls on dynamic content schemas', () => {
    expect(
      skillSchema.safeParse({
        id: '',
        categoryId: '',
        name: 'Next.js',
        level: '4',
        icon: 'Next.js',
        imageUrl: 'https://example.com/next.png',
        sortOrder: '0',
        status: 'published',
      }).success,
    ).toBe(true)

    expect(
      experienceSchema.safeParse({
        id: '',
        company: 'DabaDoc',
        location: 'Casablanca',
        startDate: '2024-01-01',
        endDate: '',
        isCurrent: true,
        url: 'https://example.com',
        imageUrl: '/images/company.png',
        sortOrder: '0',
        status: 'published',
        translations: {
          fr: { role: 'Développeuse', description: '' },
          en: { role: '', description: '' },
          ar: { role: '', description: '' },
        },
      }).success,
    ).toBe(true)

    expect(
      educationSchema.safeParse({
        id: '',
        institution: 'YouCode',
        location: 'Safi',
        startDate: '2022-01-01',
        endDate: '',
        imageUrl: '',
        sortOrder: '0',
        status: 'published',
        translations: {
          fr: { degree: 'Développement web', field: '', description: '' },
          en: { degree: '', field: '', description: '' },
          ar: { degree: '', field: '', description: '' },
        },
      }).success,
    ).toBe(true)
  })
})

describe('serviceSchema', () => {
  const base = {
    id: '',
    title: { fr: 'Site vitrine', en: '', ar: '' },
    description: { fr: '', en: '', ar: '' },
    includes: { fr: 'Design\nSEO', en: '', ar: '' },
    sortOrder: '1',
    status: 'published',
  }

  it('reads an empty price as "quote on request"', () => {
    const parsed = serviceSchema.parse({ ...base, priceFrom: '' })
    expect(parsed.priceFrom).toBeNull()
  })

  it('accepts whole, non-negative euro prices only', () => {
    expect(serviceSchema.parse({ ...base, priceFrom: '1500' }).priceFrom).toBe(1500)
    expect(serviceSchema.safeParse({ ...base, priceFrom: '-10' }).success).toBe(false)
    expect(serviceSchema.safeParse({ ...base, priceFrom: '99.5' }).success).toBe(false)
    expect(serviceSchema.safeParse({ ...base, priceFrom: 'abc' }).success).toBe(false)
  })

  it('requires a French package name', () => {
    expect(serviceSchema.safeParse({ ...base, title: { fr: '', en: 'Website', ar: '' }, priceFrom: '' }).success).toBe(false)
  })
})

describe('aboutProfileSchema booking link', () => {
  const about = {
    fullName: 'Keltoum',
    avatarUrl: '',
    availabilityStatus: 'available',
    cvUrl: '/cv.pdf',
    cvUrlFr: '/cv-fr.pdf',
    cvUrlEn: '/cv-en.pdf',
    location: { fr: 'Casablanca', en: '', ar: '' },
    headline: { fr: 'Développeuse', en: '', ar: '' },
    bio: { fr: 'Bio', en: '', ar: '' },
  }

  it('accepts an https link or nothing', () => {
    expect(aboutProfileSchema.parse({ ...about, bookingUrl: 'https://cal.com/keltoum/30min' }).bookingUrl).toBe(
      'https://cal.com/keltoum/30min',
    )
    expect(aboutProfileSchema.parse({ ...about, bookingUrl: '' }).bookingUrl).toBeNull()
  })

  it('rejects links that are not https', () => {
    expect(aboutProfileSchema.safeParse({ ...about, bookingUrl: 'http://cal.com/keltoum' }).success).toBe(false)
    expect(aboutProfileSchema.safeParse({ ...about, bookingUrl: 'javascript:alert(1)' }).success).toBe(false)
  })
})
