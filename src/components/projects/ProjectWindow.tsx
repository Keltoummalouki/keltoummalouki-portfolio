import type { ReactNode } from 'react'
import Image from 'next/image'
import { ArrowUpRight } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import type { ProjectCardData } from '@/features/content/projects.map'
import { isOptimizableImageSrc } from '@/lib/images'
import { cn } from '@/lib/utils'
import styles from './ProjectWindow.module.css'

/**
 * A project shown in a browser window: bar, 16:10 screen (`children`), and the
 * whole frame as a mouse shortcut to the case study. The title and button beside
 * it carry that link for keyboards, so this one is skipped in the tab order.
 */
export default function ProjectWindow({
  host,
  href,
  linkLabel,
  linkProps,
  className,
  children,
}: {
  /** Shown in the address bar. */
  host: string | null
  href: string
  linkLabel: string
  /** Extra attributes for the frame's link (analytics). */
  linkProps?: Record<`data-${string}`, string>
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn(styles.window, className)}>
      <div className={styles.chrome}>
        <span className={styles.dots} aria-hidden="true"><i /><i /><i /></span>
        {host && <span className={styles.host} dir="ltr">{host}</span>}
      </div>
      <div className={styles.screen}>{children}</div>
      <Link href={href} tabIndex={-1} aria-label={linkLabel} className={styles.frameLink} {...linkProps}>
        <span className={styles.open} aria-hidden="true"><ArrowUpRight size={20} /></span>
      </Link>
    </div>
  )
}

/** The cover on its screen, fitted whole. Monogram when there is none. */
export function ProjectCover({ project, alt, sizes, priority = false }: {
  project: Pick<ProjectCardData, 'image' | 'title'>
  alt: string
  sizes: string
  priority?: boolean
}) {
  if (!project.image) {
    return <span className={styles.placeholder} aria-hidden="true">{project.title.slice(0, 2).toUpperCase()}</span>
  }
  return (
    <Image src={project.image} alt={alt} fill sizes={sizes} priority={priority} unoptimized={!isOptimizableImageSrc(project.image)} className={styles.shot} />
  )
}
