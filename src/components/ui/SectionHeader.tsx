'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  /** id for the <h2>, so the section can reference it with aria-labelledby. */
  id?: string
  eyebrow: string
  title: string
  subtitle?: string
  centered?: boolean
  className?: string
}

export default function SectionHeader({ id, eyebrow, title, subtitle, centered = true, className }: SectionHeaderProps) {
  return (
    <div className={cn(centered && 'text-center', 'mb-14 md:mb-20', className)}>
      <motion.span
        data-section-eyebrow
        className="inline-block px-4 py-1.5 rounded-full bg-secondary border border-border text-sm font-medium text-primary-text mb-4"
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        {eyebrow}
      </motion.span>

      <motion.h2
        id={id}
        className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 tracking-tight text-foreground"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {title}
      </motion.h2>

      <motion.div
        className={cn(
          'h-1 w-16 bg-primary rounded-full mb-5',
          centered ? 'mx-auto origin-center' : 'origin-left rtl:origin-right'
        )}
        initial={{ opacity: 0, scaleX: 0 }}
        whileInView={{ opacity: 1, scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
      />

      {subtitle && (
        <motion.p
          className={cn('text-lg text-muted-foreground max-w-2xl text-pretty', centered && 'mx-auto')}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  )
}
