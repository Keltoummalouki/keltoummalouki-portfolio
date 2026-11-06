'use server'

import { revalidatePath } from 'next/cache'
import { revalidatePublicSite } from '@/lib/revalidate-public'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/features/auth/session'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { LOCALES, type Locale } from '@/lib/validation/locale'
import {
  aboutProfileSchema,
  certificationSchema,
  cleanI18nMap,
  designSettingsSchema,
  educationSchema,
  experienceSchema,
  faqItemSchema,
  i18nFromForm,
  languageSchema,
  nullableText,
  serviceSchema,
  skillCategorySchema,
  skillSchema,
  socialLinkSchema,
  textValue,
  translationFromForm,
} from './schema'
import { uploadImageFromForm, uploadPdfFromForm } from './media'
import { serviceSlug } from './services'
import { readSiteProfile } from './site-profile'
import { defaultSocialLabel, normalizeSocialPlatform } from './social-platforms'

function done(path: string): never {
  revalidatePublicSite()
  revalidatePath(path)
  redirect(path)
}

function failed(path: string, reason = 'invalid'): never {
  redirect(`${path}?error=${encodeURIComponent(reason)}`)
}

function idValue(formData: FormData) {
  const id = textValue(formData.get('id'))
  return id.length > 0 ? id : null
}

function isoDateOrNull(value: string) {
  return nullableText(value)
}

function stringListFromForm(formData: FormData, fieldName: string) {
  return Array.from(new Set(
    formData
      .getAll(fieldName)
      .map((value) => textValue(value))
      .filter(Boolean),
  ))
}

async function syncTranslations(
  table: 'experience_translations' | 'education_translations' | 'certification_translations',
  parentKey: 'experience_id' | 'education_id' | 'certification_id',
  parentId: string,
  translations: Record<Locale, Record<string, string>>,
  requiredField: string,
) {
  const supabase = await createServerSupabaseClient()

  for (const locale of LOCALES) {
    const row = translations[locale]
    if (row[requiredField]?.trim()) {
      if (table === 'experience_translations') {
        const { error } = await supabase.from('experience_translations').upsert(
          {
            experience_id: parentId,
            locale,
            role: row.role,
            description: nullableText(row.description ?? ''),
          },
          { onConflict: 'experience_id,locale' },
        )
        if (error) throw error
      } else if (table === 'education_translations') {
        const { error } = await supabase.from('education_translations').upsert(
          {
            education_id: parentId,
            locale,
            degree: row.degree,
            field: nullableText(row.field ?? ''),
            description: nullableText(row.description ?? ''),
          },
          { onConflict: 'education_id,locale' },
        )
        if (error) throw error
      } else {
        const { error } = await supabase.from('certification_translations').upsert(
          {
            certification_id: parentId,
            locale,
            name: row.name,
            description: nullableText(row.description ?? ''),
          },
          { onConflict: 'certification_id,locale' },
        )
        if (error) throw error
      }
    } else {
      if (parentKey === 'experience_id') {
        const { error } = await supabase.from('experience_translations').delete().eq('experience_id', parentId).eq('locale', locale)
        if (error) throw error
      } else if (parentKey === 'education_id') {
        const { error } = await supabase.from('education_translations').delete().eq('education_id', parentId).eq('locale', locale)
        if (error) throw error
      } else {
        const { error } = await supabase.from('certification_translations').delete().eq('certification_id', parentId).eq('locale', locale)
        if (error) throw error
      }
    }
  }
}

export async function saveAboutAction(formData: FormData): Promise<void> {
  await requireAdmin()

  const parsed = aboutProfileSchema.safeParse({
    fullName: textValue(formData.get('fullName')),
    avatarUrl: textValue(formData.get('existingAvatarUrl')),
    availabilityStatus: textValue(formData.get('availabilityStatus')),
    cvUrl: textValue(formData.get('existingCvUrl')),
    cvUrlFr: textValue(formData.get('existingCvUrlFr')),
    cvUrlEn: textValue(formData.get('existingCvUrlEn')),
    bookingUrl: textValue(formData.get('bookingUrl')),
    location: i18nFromForm(formData, 'location'),
    headline: i18nFromForm(formData, 'headline'),
    bio: i18nFromForm(formData, 'bio'),
  })
  if (!parsed.success) failed('/admin/about')

  const v = parsed.data
  const supabase = await createServerSupabaseClient()
  let uploadedAvatarUrl: string | undefined
  let uploadedCvUrlFr: string | undefined
  let uploadedCvUrlEn: string | undefined
  try {
    uploadedAvatarUrl = await uploadImageFromForm(supabase, formData, 'avatarFile', 'profile')
    uploadedCvUrlFr = await uploadPdfFromForm(supabase, formData, 'cvFileFr', 'cv')
    uploadedCvUrlEn = await uploadPdfFromForm(supabase, formData, 'cvFileEn', 'cv')
  } catch {
    failed('/admin/about', 'upload')
  }

  const { error: aboutError } = await supabase.from('about_profile').upsert({
    id: true,
    full_name: nullableText(v.fullName ?? ''),
    avatar_url: uploadedAvatarUrl ?? v.avatarUrl,
    headline: cleanI18nMap(v.headline),
    bio: cleanI18nMap(v.bio),
  })
  if (aboutError) failed('/admin/about', 'save')

  const { data: currentSettings } = await supabase.from('site_settings').select('profile').maybeSingle()
  const currentProfile = readSiteProfile(currentSettings?.profile)
  const cvUrlFr = uploadedCvUrlFr ?? v.cvUrlFr
  const cvUrlEn = uploadedCvUrlEn ?? v.cvUrlEn
  const profile = {
    ...currentProfile.raw,
    location: cleanI18nMap(v.location),
    cvUrls: {
      fr: cvUrlFr,
      en: cvUrlEn,
    },
    bookingUrl: v.bookingUrl ?? null,
  }

  const { error: settingsError } = await supabase.from('site_settings').upsert({
    id: true,
    availability_status: v.availabilityStatus,
    cv_url: cvUrlFr || cvUrlEn || v.cvUrl,
    profile,
  })
  if (settingsError) failed('/admin/about', 'settings')

  done('/admin/about')
}

export async function saveDesignSettingsAction(formData: FormData): Promise<void> {
  await requireAdmin()

  const parsed = designSettingsSchema.safeParse({
    primaryColor: textValue(formData.get('primaryColor')),
    accentColor: textValue(formData.get('accentColor')),
    defaultLocale: textValue(formData.get('defaultLocale')),
    defaultTheme: textValue(formData.get('defaultTheme')),
    fontBody: textValue(formData.get('fontBody')),
    fontHeading: textValue(formData.get('fontHeading')),
    cursorStyle: textValue(formData.get('cursorStyle')),
    headerPosition: textValue(formData.get('headerPosition')) || 'bottom',
    navItems: stringListFromForm(formData, 'navItems'),
  })
  if (!parsed.success) failed('/admin/theme')

  const v = parsed.data
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('design_settings').upsert({
    id: true,
    primary_color: nullableText(v.primaryColor ?? ''),
    accent_color: nullableText(v.accentColor ?? ''),
    default_locale: v.defaultLocale,
    default_theme: v.defaultTheme,
    font_body: nullableText(v.fontBody ?? ''),
    font_heading: nullableText(v.fontHeading ?? ''),
    cursor_style: nullableText(v.cursorStyle ?? ''),
    header_position: v.headerPosition,
    nav_items: v.navItems,
  })
  if (error) failed('/admin/theme', 'save')

  done('/admin/theme')
}

export async function saveSocialLinkAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const platform = normalizeSocialPlatform(textValue(formData.get('platform')))
  const existingIcon = textValue(formData.get('existingIcon'))
  const iconPreset = textValue(formData.get('iconPreset'))
  const parsed = socialLinkSchema.safeParse({
    id: textValue(formData.get('id')),
    platform,
    label: textValue(formData.get('label')),
    icon: iconPreset || existingIcon || platform,
    url: textValue(formData.get('url')),
    sortOrder: textValue(formData.get('sortOrder')),
    status: textValue(formData.get('status')),
  })
  if (!parsed.success) failed('/admin/social')

  const v = parsed.data
  const supabase = await createServerSupabaseClient()
  let uploadedIconUrl: string | undefined
  try {
    uploadedIconUrl = await uploadImageFromForm(supabase, formData, 'iconFile', 'social')
  } catch {
    failed('/admin/social', 'upload')
  }

  const icon = uploadedIconUrl ?? nullableText(iconPreset) ?? nullableText(existingIcon) ?? v.platform
  const payload = {
    platform: v.platform,
    label: nullableText(v.label ?? '') ?? defaultSocialLabel(v.platform),
    icon,
    url: v.url,
    sort_order: v.sortOrder,
    status: v.status,
  }
  const id = v.id || null
  const { error } = id
    ? await supabase.from('social_links').update(payload).eq('id', id)
    : await supabase.from('social_links').insert(payload)
  if (error) failed('/admin/social', 'save')
  done('/admin/social')
}

export async function deleteSocialLinkAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = idValue(formData)
  if (!id) failed('/admin/social')
  const supabase = await createServerSupabaseClient()
  await supabase.from('social_links').delete().eq('id', id)
  done('/admin/social')
}

export async function saveSkillCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const parsed = skillCategorySchema.safeParse({
    id: textValue(formData.get('id')),
    slug: textValue(formData.get('slug')),
    name: i18nFromForm(formData, 'name'),
    sortOrder: textValue(formData.get('sortOrder')),
    status: textValue(formData.get('status')),
  })
  if (!parsed.success) failed('/admin/skills')
  const v = parsed.data
  const payload = { slug: v.slug, name: cleanI18nMap(v.name), sort_order: v.sortOrder, status: v.status }
  const supabase = await createServerSupabaseClient()
  const { error } = v.id
    ? await supabase.from('skill_categories').update(payload).eq('id', v.id)
    : await supabase.from('skill_categories').insert(payload)
  if (error) failed('/admin/skills', 'category')
  done('/admin/skills')
}

export async function deleteSkillCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = idValue(formData)
  if (!id) failed('/admin/skills')
  const supabase = await createServerSupabaseClient()
  await supabase.from('skill_categories').delete().eq('id', id)
  done('/admin/skills')
}

export async function saveSkillAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const parsed = skillSchema.safeParse({
    id: textValue(formData.get('id')),
    skillType: textValue(formData.get('skillType')) || 'technical',
    categoryId: textValue(formData.get('categoryId')),
    name: textValue(formData.get('name')),
    level: textValue(formData.get('level')),
    icon: textValue(formData.get('icon')),
    imageUrl: textValue(formData.get('imageUrl')),
    sortOrder: textValue(formData.get('sortOrder')),
    status: textValue(formData.get('status')),
  })
  if (!parsed.success) failed('/admin/skills')
  const v = parsed.data
  const isTechnical = v.skillType === 'technical'
  const supabase = await createServerSupabaseClient()

  // Category and image/logo only apply to technical skills; soft skills are
  // standalone and never carry a category or image.
  let uploadedImageUrl: string | undefined
  if (isTechnical) {
    try {
      uploadedImageUrl = await uploadImageFromForm(supabase, formData, 'imageFile', 'skill')
    } catch {
      failed('/admin/skills', 'upload')
    }
  }
  const payload = {
    skill_type: v.skillType,
    category_id: isTechnical ? v.categoryId || null : null,
    name: v.name,
    level: isTechnical && typeof v.level === 'number' ? v.level : null,
    icon: nullableText(v.icon ?? ''),
    image_url: isTechnical ? uploadedImageUrl ?? v.imageUrl : null,
    sort_order: v.sortOrder,
    status: v.status,
  }
  const { error } = v.id ? await supabase.from('skills').update(payload).eq('id', v.id) : await supabase.from('skills').insert(payload)
  if (error) failed('/admin/skills', 'skill')
  done('/admin/skills')
}

export async function deleteSkillAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = idValue(formData)
  if (!id) failed('/admin/skills')
  const supabase = await createServerSupabaseClient()
  await supabase.from('skills').delete().eq('id', id)
  done('/admin/skills')
}

export async function saveLanguageAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const parsed = languageSchema.safeParse({
    id: textValue(formData.get('id')),
    name: i18nFromForm(formData, 'name'),
    level: i18nFromForm(formData, 'level'),
    icon: textValue(formData.get('icon')),
    sortOrder: textValue(formData.get('sortOrder')),
    status: textValue(formData.get('status')),
  })
  if (!parsed.success) failed('/admin/languages')

  const v = parsed.data
  const payload = {
    name: cleanI18nMap(v.name),
    level: cleanI18nMap(v.level),
    icon: nullableText(v.icon ?? ''),
    sort_order: v.sortOrder,
    status: v.status,
  }
  const supabase = await createServerSupabaseClient()
  const { error } = v.id
    ? await supabase.from('languages').update(payload).eq('id', v.id)
    : await supabase.from('languages').insert(payload)
  if (error) failed('/admin/languages', 'save')

  done('/admin/languages')
}

export async function deleteLanguageAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = idValue(formData)
  if (!id) failed('/admin/languages')
  const supabase = await createServerSupabaseClient()
  await supabase.from('languages').delete().eq('id', id)
  done('/admin/languages')
}

export async function saveFaqItemAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const parsed = faqItemSchema.safeParse({
    id: textValue(formData.get('id')),
    question: i18nFromForm(formData, 'question'),
    answer: i18nFromForm(formData, 'answer'),
    sortOrder: textValue(formData.get('sortOrder')),
    status: textValue(formData.get('status')),
  })
  if (!parsed.success) failed('/admin/faq')

  const v = parsed.data
  const payload = {
    question: cleanI18nMap(v.question),
    answer: cleanI18nMap(v.answer),
    sort_order: v.sortOrder,
    status: v.status,
  }
  const supabase = await createServerSupabaseClient()
  const { error } = v.id
    ? await supabase.from('faq_items').update(payload).eq('id', v.id)
    : await supabase.from('faq_items').insert(payload)
  if (error) failed('/admin/faq', 'save')

  done('/admin/faq')
}

export async function deleteFaqItemAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = idValue(formData)
  if (!id) failed('/admin/faq')
  const supabase = await createServerSupabaseClient()
  await supabase.from('faq_items').delete().eq('id', id)
  done('/admin/faq')
}

export async function saveServiceAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const parsed = serviceSchema.safeParse({
    id: textValue(formData.get('id')),
    title: i18nFromForm(formData, 'title'),
    description: i18nFromForm(formData, 'description'),
    includes: i18nFromForm(formData, 'includes'),
    priceFrom: textValue(formData.get('priceFrom')),
    sortOrder: textValue(formData.get('sortOrder')),
    status: textValue(formData.get('status')),
  })
  if (!parsed.success) failed('/admin/services')

  const v = parsed.data
  const payload = {
    title: cleanI18nMap(v.title),
    description: cleanI18nMap(v.description),
    includes: cleanI18nMap(v.includes),
    price_from: v.priceFrom,
    sort_order: v.sortOrder,
    status: v.status,
  }
  const supabase = await createServerSupabaseClient()
  if (v.id) {
    const { error } = await supabase.from('services').update(payload).eq('id', v.id)
    if (error) failed('/admin/services', 'save')
  } else {
    const slug = serviceSlug(v.title.en || v.title.fr)
    const first = await supabase.from('services').insert({ ...payload, slug })
    // The slug only identifies the row: on a clash, retry once with a unique suffix.
    const { error } =
      first.error?.code === '23505'
        ? await supabase.from('services').insert({ ...payload, slug: `${slug}-${Date.now().toString(36)}` })
        : first
    if (error) failed('/admin/services', 'save')
  }

  done('/admin/services')
}

export async function deleteServiceAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = idValue(formData)
  if (!id) failed('/admin/services')
  const supabase = await createServerSupabaseClient()
  await supabase.from('services').delete().eq('id', id)
  done('/admin/services')
}

export async function saveExperienceAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const translations = {
    fr: translationFromForm(formData, 'fr', ['role', 'description']),
    en: translationFromForm(formData, 'en', ['role', 'description']),
    ar: translationFromForm(formData, 'ar', ['role', 'description']),
  }
  const parsed = experienceSchema.safeParse({
    id: textValue(formData.get('id')),
    company: textValue(formData.get('company')),
    location: textValue(formData.get('location')),
    startDate: textValue(formData.get('startDate')),
    endDate: textValue(formData.get('endDate')),
    isCurrent: formData.get('isCurrent') === 'on',
    url: textValue(formData.get('url')),
    imageUrl: textValue(formData.get('imageUrl')),
    technologies: stringListFromForm(formData, 'technologies'),
    sortOrder: textValue(formData.get('sortOrder')),
    status: textValue(formData.get('status')),
    translations,
  })
  if (!parsed.success) failed('/admin/experience')
  const v = parsed.data
  const supabase = await createServerSupabaseClient()
  let uploadedImageUrl: string | undefined
  try {
    uploadedImageUrl = await uploadImageFromForm(supabase, formData, 'imageFile', 'experience')
  } catch {
    failed('/admin/experience', 'upload')
  }
  const payload = {
    company: nullableText(v.company ?? ''),
    location: nullableText(v.location ?? ''),
    start_date: isoDateOrNull(v.startDate ?? ''),
    end_date: v.isCurrent ? null : isoDateOrNull(v.endDate ?? ''),
    is_current: v.isCurrent,
    url: v.url,
    image_url: uploadedImageUrl ?? v.imageUrl,
    technologies: v.technologies,
    sort_order: v.sortOrder,
    status: v.status,
  }
  const id = v.id || null
  const { data, error } = id
    ? await supabase.from('experiences').update(payload).eq('id', id).select('id').single()
    : await supabase.from('experiences').insert(payload).select('id').single()
  if (error || !data) failed('/admin/experience', 'save')
  try {
    await syncTranslations('experience_translations', 'experience_id', data.id, v.translations, 'role')
  } catch {
    failed('/admin/experience', 'translations')
  }
  done('/admin/experience')
}

export async function deleteExperienceAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = idValue(formData)
  if (!id) failed('/admin/experience')
  const supabase = await createServerSupabaseClient()
  await supabase.from('experiences').delete().eq('id', id)
  done('/admin/experience')
}

export async function saveEducationAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const translations = {
    fr: translationFromForm(formData, 'fr', ['degree', 'field', 'description']),
    en: translationFromForm(formData, 'en', ['degree', 'field', 'description']),
    ar: translationFromForm(formData, 'ar', ['degree', 'field', 'description']),
  }
  const parsed = educationSchema.safeParse({
    id: textValue(formData.get('id')),
    institution: textValue(formData.get('institution')),
    location: textValue(formData.get('location')),
    startDate: textValue(formData.get('startDate')),
    endDate: textValue(formData.get('endDate')),
    imageUrl: textValue(formData.get('imageUrl')),
    sortOrder: textValue(formData.get('sortOrder')),
    status: textValue(formData.get('status')),
    translations,
  })
  if (!parsed.success) failed('/admin/education')
  const v = parsed.data
  const supabase = await createServerSupabaseClient()
  let uploadedImageUrl: string | undefined
  try {
    uploadedImageUrl = await uploadImageFromForm(supabase, formData, 'imageFile', 'education')
  } catch {
    failed('/admin/education', 'upload')
  }
  const payload = {
    institution: nullableText(v.institution ?? ''),
    location: nullableText(v.location ?? ''),
    start_date: isoDateOrNull(v.startDate ?? ''),
    end_date: isoDateOrNull(v.endDate ?? ''),
    image_url: uploadedImageUrl ?? v.imageUrl,
    sort_order: v.sortOrder,
    status: v.status,
  }
  const id = v.id || null
  const { data, error } = id
    ? await supabase.from('education').update(payload).eq('id', id).select('id').single()
    : await supabase.from('education').insert(payload).select('id').single()
  if (error || !data) failed('/admin/education', 'save')
  try {
    await syncTranslations('education_translations', 'education_id', data.id, v.translations, 'degree')
  } catch {
    failed('/admin/education', 'translations')
  }
  done('/admin/education')
}

export async function deleteEducationAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = idValue(formData)
  if (!id) failed('/admin/education')
  const supabase = await createServerSupabaseClient()
  await supabase.from('education').delete().eq('id', id)
  done('/admin/education')
}

export async function saveCertificationAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const translations = {
    fr: translationFromForm(formData, 'fr', ['name', 'description']),
    en: translationFromForm(formData, 'en', ['name', 'description']),
    ar: translationFromForm(formData, 'ar', ['name', 'description']),
  }
  const parsed = certificationSchema.safeParse({
    id: textValue(formData.get('id')),
    issuer: textValue(formData.get('issuer')),
    issueDate: textValue(formData.get('issueDate')),
    credentialUrl: textValue(formData.get('credentialUrl')),
    imageUrl: textValue(formData.get('imageUrl')),
    sortOrder: textValue(formData.get('sortOrder')),
    status: textValue(formData.get('status')),
    translations,
  })
  if (!parsed.success) failed('/admin/certifications')
  const v = parsed.data
  const supabase = await createServerSupabaseClient()
  let uploadedImageUrl: string | undefined
  try {
    uploadedImageUrl = await uploadImageFromForm(supabase, formData, 'imageFile', 'certification')
  } catch {
    failed('/admin/certifications', 'upload')
  }
  const payload = {
    issuer: nullableText(v.issuer ?? ''),
    issue_date: isoDateOrNull(v.issueDate ?? ''),
    credential_url: v.credentialUrl,
    image_url: uploadedImageUrl ?? v.imageUrl,
    sort_order: v.sortOrder,
    status: v.status,
  }
  const id = v.id || null
  const { data, error } = id
    ? await supabase.from('certifications').update(payload).eq('id', id).select('id').single()
    : await supabase.from('certifications').insert(payload).select('id').single()
  if (error || !data) failed('/admin/certifications', 'save')
  try {
    await syncTranslations('certification_translations', 'certification_id', data.id, v.translations, 'name')
  } catch {
    failed('/admin/certifications', 'translations')
  }
  done('/admin/certifications')
}

export async function deleteCertificationAction(formData: FormData): Promise<void> {
  await requireAdmin()
  const id = idValue(formData)
  if (!id) failed('/admin/certifications')
  const supabase = await createServerSupabaseClient()
  await supabase.from('certifications').delete().eq('id', id)
  done('/admin/certifications')
}
