import { Languages } from 'lucide-react'
import SkillIcon from '@/components/ui/SkillIcon'
import { cn } from '@/lib/utils'
import ProfileSection, { cardClass, chipClass, iconTileClass } from './ProfileSection'

export interface AboutSkillItem {
  name: string
  icon?: string
  imageUrl?: string
}

export interface AboutSkillCategory {
  id: string
  name: string
  skills: AboutSkillItem[]
}

/** Categories in two masonry columns (CSS columns keep reading order: down, then across). */
export function AboutSkills({
  title,
  number,
  lead,
  categories,
}: {
  title: string
  number?: string
  lead: string
  categories: AboutSkillCategory[]
}) {
  if (categories.length === 0) return null
  return (
    <ProfileSection id="skills" number={number} title={title} lead={lead}>
      <div className="-mb-4 columns-1 gap-4 sm:columns-2">
        {categories.map((category) => (
          <div key={category.id} className={cn(cardClass, 'mb-4 break-inside-avoid p-5')}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-[0.9375rem] font-semibold text-foreground">{category.name}</h3>
              <span aria-hidden="true" className="font-mono text-xs tabular-nums text-muted-foreground">
                {String(category.skills.length).padStart(2, '0')}
              </span>
            </div>
            <ul className="mt-3.5 flex flex-wrap gap-1.5">
              {category.skills.map((skill) => (
                <li key={skill.name} className={chipClass}>
                  <span aria-hidden="true" className="inline-flex">
                    <SkillIcon name={skill.name} icon={skill.icon} imageUrl={skill.imageUrl} className="text-primary-text" size={14} />
                  </span>
                  {skill.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ProfileSection>
  )
}

export function AboutLanguages({
  title,
  number,
  languages,
}: {
  title: string
  number?: string
  languages: { name: string; level: string }[]
}) {
  if (languages.length === 0) return null
  return (
    <ProfileSection id="languages" number={number} title={title}>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {languages.map((language) => (
          <li key={language.name} className={cn(cardClass, 'flex items-center gap-3.5 px-4 py-3.5')}>
            <span aria-hidden="true" className={cn(iconTileClass, 'size-10')}>
              <Languages className="size-4.5" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-foreground">{language.name}</span>
              {language.level && <span className="block text-sm text-muted-foreground">{language.level}</span>}
            </span>
          </li>
        ))}
      </ul>
    </ProfileSection>
  )
}

export function AboutSoftSkills({
  title,
  number,
  lead,
  skills,
}: {
  title: string
  number?: string
  lead: string
  skills: AboutSkillItem[]
}) {
  if (skills.length === 0) return null
  return (
    <ProfileSection id="how-i-work" number={number} title={title} lead={lead}>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {skills.map((skill) => (
          <li key={skill.name} className={cn(cardClass, 'flex items-center gap-3.5 px-4 py-3.5 sm:flex-col sm:items-start sm:gap-4 sm:p-5')}>
            <span aria-hidden="true" className={cn(iconTileClass, 'size-10')}>
              <SkillIcon name={skill.name} icon={skill.icon} imageUrl={skill.imageUrl} size={18} />
            </span>
            <span className="font-semibold text-foreground">{skill.name}</span>
          </li>
        ))}
      </ul>
    </ProfileSection>
  )
}
