import 'server-only'
import { cache } from 'react'
import type { Tables } from '@/lib/supabase/database.types'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createPublicSupabaseClient } from '@/lib/supabase/public'
import type { Locale } from '@/lib/validation/locale'
import { pickI18n, type I18nMap } from '@/features/content/i18n-json'
import { readSiteProfile } from './site-profile'
import { defaultSocialLabel, normalizeSocialPlatform } from './social-platforms'
import { normalizeNavItems, type HeaderPosition, type NavItemKey } from './design-options'
import { resolveLanguages, type PublicLanguage } from './languages'
import { ABOUT_FALLBACK } from './fallbacks'

type AboutRow = Tables<'about_profile'>
type SiteSettingsRow = Tables<'site_settings'>
type DesignRow = Tables<'design_settings'>
type SocialRow = Tables<'social_links'>
type SkillCategoryRow = Tables<'skill_categories'>
type SkillRow = Tables<'skills'>
type ExperienceRow = Tables<'experiences'> & { experience_translations?: Tables<'experience_translations'>[] }
type EducationRow = Tables<'education'> & { education_translations?: Tables<'education_translations'>[] }
type CertificationRow = Tables<'certifications'> & { certification_translations?: Tables<'certification_translations'>[] }
type MediaRow = Tables<'media_assets'>
type LanguageRow = Tables<'languages'>

export interface PublicAbout {
  fullName: string
  avatarUrl: string
  headline: string
  bio: string
  cvUrl: string
  availabilityStatus: string
  location: string
  /** https booking page (Cal.com, Calendly…); empty when not set. */
  bookingUrl?: string
}

export interface PublicSocialLink {
  id: string
  platform: string
  label: string
  url: string
  icon: string
}

export interface PublicSkill {
  id: string
  name: string
  icon: string
  imageUrl: string
  level: number | null
}

export interface PublicSkillCategory {
  id: string
  name: string
  skills: PublicSkill[]
}

export interface PublicExperience {
  id: string
  company: string
  location: string
  date: string
  role: string
  description: string
  url: string
  imageUrl: string
  technologies: string[]
  isCurrent: boolean
}

export interface PublicEducation {
  id: string
  institution: string
  location: string
  date: string
  degree: string
  field: string
  description: string
  imageUrl: string
}

export interface PublicCertification {
  id: string
  issuer: string
  issueDate: string
  credentialUrl: string
  imageUrl: string
  name: string
  description: string
}

export interface PublicDesignSettings {
  primaryColor: string
  defaultTheme: 'light' | 'dark' | 'system'
  fontBody: string
  fontHeading: string
  cursorStyle: string
  headerPosition: HeaderPosition
  navItems: NavItemKey[]
}

export interface PublicCmsContent {
  about?: PublicAbout
  socialLinks: PublicSocialLink[]
  skillCategories: PublicSkillCategory[]
  softSkills: PublicSkill[]
  experiences: PublicExperience[]
  education: PublicEducation[]
  certifications: PublicCertification[]
  languages: PublicLanguage[]
  design?: PublicDesignSettings
}

export interface AdminCmsData {
  about: AboutRow | null
  siteSettings: SiteSettingsRow | null
  design: DesignRow | null
  socialLinks: SocialRow[]
  skillCategories: SkillCategoryRow[]
  skills: SkillRow[]
  experiences: ExperienceRow[]
  education: EducationRow[]
  certifications: CertificationRow[]
  languages: LanguageRow[]
  mediaAssets: MediaRow[]
}

function dateRange(start: string | null, end: string | null, current = false) {
  if (!start && !end) return ''
  const from = start ? start.slice(0, 4) : ''
  const to = current ? 'Present' : end ? end.slice(0, 4) : ''
  return [from, to].filter(Boolean).join(' — ')
}

function pickByLocale<T extends { locale: string }>(rows: readonly T[], locale: Locale): T | undefined {
  return rows.find((row) => row.locale === locale) ?? rows.find((row) => row.locale === 'fr') ?? rows[0]
}

function mapAbout(row: AboutRow | null, site: SiteSettingsRow | null, locale: Locale): PublicAbout | undefined {
  if (!row) return undefined
  const profile = readSiteProfile(site?.profile)
  const cvUrl =
    locale === 'en'
      ? profile.cvUrlEn || profile.cvUrlFr || site?.cv_url || ''
      : profile.cvUrlFr || profile.cvUrlEn || site?.cv_url || ''

  return {
    fullName: row.full_name ?? '',
    avatarUrl: row.avatar_url ?? '',
    headline: pickI18n(row.headline as I18nMap, locale),
    bio: pickI18n(row.bio as I18nMap, locale),
    cvUrl,
    availabilityStatus: site?.availability_status ?? 'available',
    location: pickI18n(profile.location as I18nMap, locale) || pickI18n(site?.location as I18nMap, locale),
    bookingUrl: profile.bookingUrl,
  }
}

function mapDesign(row: DesignRow | null): PublicDesignSettings | undefined {
  if (!row) return undefined
  const design = row as DesignRow & {
    header_position?: HeaderPosition | null
    nav_items?: unknown
  }
  return {
    primaryColor: row.primary_color ?? '',
    defaultTheme: row.default_theme as PublicDesignSettings['defaultTheme'],
    fontBody: row.font_body ?? '',
    fontHeading: row.font_heading ?? '',
    cursorStyle: row.cursor_style ?? '',
    headerPosition: design.header_position === 'left' || design.header_position === 'right' ? design.header_position : 'bottom',
    navItems: normalizeNavItems(design.nav_items),
  }
}

function mapExperiences(rows: ExperienceRow[], locale: Locale): PublicExperience[] {
  return rows
    .map((row) => {
      const translation = pickByLocale(row.experience_translations ?? [], locale)
      if (!translation) return null
      return {
        id: row.id,
        company: row.company ?? '',
        location: row.location ?? '',
        date: dateRange(row.start_date, row.end_date, row.is_current),
        role: translation.role,
        description: translation.description ?? '',
        url: row.url ?? '',
        imageUrl: row.image_url ?? '',
        technologies: Array.isArray(row.technologies) ? row.technologies : [],
        isCurrent: Boolean(row.is_current),
      }
    })
    .filter((item): item is PublicExperience => Boolean(item))
}

function mapEducation(rows: EducationRow[], locale: Locale): PublicEducation[] {
  return rows
    .map((row) => {
      const translation = pickByLocale(row.education_translations ?? [], locale)
      if (!translation) return null
      return {
        id: row.id,
        institution: row.institution ?? '',
        location: row.location ?? '',
        date: dateRange(row.start_date, row.end_date),
        degree: translation.degree,
        field: translation.field ?? '',
        description: translation.description ?? '',
        imageUrl: row.image_url ?? '',
      }
    })
    .filter((item): item is PublicEducation => Boolean(item))
}

function mapCertifications(rows: CertificationRow[], locale: Locale): PublicCertification[] {
  return rows
    .map((row) => {
      const translation = pickByLocale(row.certification_translations ?? [], locale)
      if (!translation) return null
      return {
        id: row.id,
        issuer: row.issuer ?? '',
        issueDate: row.issue_date ?? '',
        credentialUrl: row.credential_url ?? '',
        imageUrl: row.image_url ?? '',
        name: translation.name,
        description: translation.description ?? '',
      }
    })
    .filter((item): item is PublicCertification => Boolean(item))
}

/**
 * Never throws: when Supabase fails or is not configured (a CI build has no
 * keys), the result is the same as an empty database, so pages render their
 * built-in fallbacks.
 */
export async function getPublishedCmsContent(locale: Locale): Promise<PublicCmsContent> {
  try {
    return await loadPublishedCmsContent(locale)
  } catch (err) {
    console.error('getPublishedCmsContent failed:', err)
    return {
      about: mapAbout(null, null, locale),
      design: mapDesign(null),
      socialLinks: [],
      skillCategories: [],
      softSkills: [],
      experiences: [],
      education: [],
      certifications: [],
      languages: resolveLanguages([], locale),
    }
  }
}

async function loadPublishedCmsContent(locale: Locale): Promise<PublicCmsContent> {
  const supabase = createPublicSupabaseClient()
  const [
    about,
    siteSettings,
    design,
    socialLinks,
    skillCategories,
    skills,
    experiences,
    education,
    certifications,
    languages,
  ] = await Promise.all([
    supabase.from('about_profile').select('*').maybeSingle(),
    supabase.from('site_settings').select('*').maybeSingle(),
    supabase.from('design_settings').select('*').maybeSingle(),
    supabase.from('social_links').select('*').eq('status', 'published').order('sort_order'),
    supabase.from('skill_categories').select('*').eq('status', 'published').order('sort_order'),
    supabase.from('skills').select('*').eq('status', 'published').order('sort_order'),
    supabase
      .from('experiences')
      .select('*, experience_translations(*)')
      .eq('status', 'published')
      .order('sort_order'),
    supabase
      .from('education')
      .select('*, education_translations(*)')
      .eq('status', 'published')
      .order('sort_order'),
    supabase
      .from('certifications')
      .select('*, certification_translations(*)')
      .eq('status', 'published')
      .order('sort_order'),
    supabase.from('languages').select('*').eq('status', 'published').order('sort_order'),
  ])

  const categoryRows = skillCategories.data ?? []
  const skillRows = skills.data ?? []
  const technicalSkillRows = skillRows.filter((skill) => skill.skill_type !== 'soft')
  const mapPublicSkill = (skill: SkillRow): PublicSkill => ({
    id: skill.id,
    name: skill.name,
    icon: skill.icon ?? '',
    imageUrl: skill.image_url ?? '',
    level: skill.level,
  })
  const mappedSkillCategories = categoryRows
    .map((category) => ({
      id: category.id,
      name: pickI18n(category.name as I18nMap, locale) || category.slug,
      skills: technicalSkillRows
        .filter((skill) => skill.category_id === category.id)
        .map(mapPublicSkill),
    }))
    .filter((category) => category.skills.length > 0)
  const uncategorizedTechnicalSkills = technicalSkillRows.filter((skill) => !skill.category_id)

  return {
    about: mapAbout(about.data ?? null, siteSettings.data ?? null, locale),
    design: mapDesign(design.data ?? null),
    socialLinks: (socialLinks.data ?? []).map((row) => ({
      id: row.id,
      platform: normalizeSocialPlatform(row.platform),
      label: row.label ?? defaultSocialLabel(row.platform),
      url: row.url,
      icon: row.icon ?? normalizeSocialPlatform(row.platform),
    })),
    skillCategories: [
      ...mappedSkillCategories,
      ...(uncategorizedTechnicalSkills.length
        ? [
            {
              id: 'uncategorized-technical-skills',
              name: locale === 'fr' ? 'Autres compétences' : locale === 'ar' ? 'مهارات أخرى' : 'Other skills',
              skills: uncategorizedTechnicalSkills.map(mapPublicSkill),
            },
          ]
        : []),
    ],
    softSkills: skillRows
      .filter((skill) => skill.skill_type === 'soft')
      .map(mapPublicSkill),
    experiences: mapExperiences((experiences.data ?? []) as ExperienceRow[], locale),
    education: mapEducation((education.data ?? []) as EducationRow[], locale),
    certifications: mapCertifications((certifications.data ?? []) as CertificationRow[], locale),
    languages: resolveLanguages((languages.data ?? []) as LanguageRow[], locale),
  }
}

/** Lightweight design-settings fetch for theming all public pages (layout-level). */
export async function getPublishedDesignSettings(): Promise<PublicDesignSettings | undefined> {
  try {
    const supabase = createPublicSupabaseClient()
    const { data, error } = await supabase.from('design_settings').select('*').maybeSingle()
    if (error) throw error
    return mapDesign(data ?? null)
  } catch (err) {
    console.error('getPublishedDesignSettings failed:', err)
    return undefined
  }
}

export interface AdminProfileSummary {
  fullName: string
  avatarUrl: string
}

/**
 * Name and photo for the admin sidebar, greeting and profile card (admin RLS
 * context). Falls back to the built-in profile and never throws, so the
 * dashboard renders even before the profile is filled in. Cached per request:
 * the layout and the dashboard page share one query.
 */
export const getAdminProfileSummary = cache(async function getAdminProfileSummary(): Promise<AdminProfileSummary> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.from('about_profile').select('full_name, avatar_url').maybeSingle()
    // PostgREST errors are plain objects: wrap so the log shows the message.
    if (error) throw new Error(error.message)
    return {
      fullName: data?.full_name || ABOUT_FALLBACK.fullName,
      avatarUrl: data?.avatar_url || ABOUT_FALLBACK.avatarUrl,
    }
  } catch (err) {
    console.error('getAdminProfileSummary failed:', err instanceof Error ? err.message : err)
    return { fullName: ABOUT_FALLBACK.fullName, avatarUrl: ABOUT_FALLBACK.avatarUrl }
  }
})

export async function getAdminCmsData(): Promise<AdminCmsData> {
  const supabase = await createServerSupabaseClient()
  const [about, siteSettings, design, socialLinks, skillCategories, skills, experiences, education, certifications, languages, mediaAssets] =
    await Promise.all([
      supabase.from('about_profile').select('*').maybeSingle(),
      supabase.from('site_settings').select('*').maybeSingle(),
      supabase.from('design_settings').select('*').maybeSingle(),
      supabase.from('social_links').select('*').order('sort_order'),
      supabase.from('skill_categories').select('*').order('sort_order'),
      supabase.from('skills').select('*').order('sort_order'),
      supabase.from('experiences').select('*, experience_translations(*)').order('sort_order'),
      supabase.from('education').select('*, education_translations(*)').order('sort_order'),
      supabase.from('certifications').select('*, certification_translations(*)').order('sort_order'),
      supabase.from('languages').select('*').order('sort_order'),
      supabase.from('media_assets').select('*').order('created_at', { ascending: false }),
    ])

  return {
    about: about.data ?? null,
    siteSettings: siteSettings.data ?? null,
    design: design.data ?? null,
    socialLinks: socialLinks.data ?? [],
    skillCategories: skillCategories.data ?? [],
    skills: skills.data ?? [],
    experiences: (experiences.data ?? []) as ExperienceRow[],
    education: (education.data ?? []) as EducationRow[],
    certifications: (certifications.data ?? []) as CertificationRow[],
    languages: (languages.data ?? []) as LanguageRow[],
    mediaAssets: mediaAssets.data ?? [],
  }
}
