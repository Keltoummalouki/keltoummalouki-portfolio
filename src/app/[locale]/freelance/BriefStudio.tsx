'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import BriefStage, { type BriefStageCallout, type BriefStageHandle } from '@/components/three/brief-stack/BriefStage'
import {
  EMPTY_BRIEF,
  REQUIRED_BRIEF_FIELDS,
  briefSceneState,
} from '@/features/freelance/brief'
import FreelanceLeadForm, { type BriefReport } from './FreelanceLeadForm'

const INITIAL_REPORT: BriefReport = {
  values: EMPTY_BRIEF,
  scene: briefSceneState({ values: EMPTY_BRIEF, furthestStep: 0, preview: null, phase: 'editing' }),
}

/**
 * The top of the page: the request form beside the 3D model it builds. The form
 * owns the answers and reports them here, so restarting it (new `key`) clears
 * them without tearing down the WebGL scene.
 */
export default function BriefStudio({
  intro,
  bookingUrl,
  alternatives,
}: {
  /** Server-rendered heading and availability. */
  intro: ReactNode
  bookingUrl: string
  /** Server-rendered "prefer email?" line, under the form. */
  alternatives?: ReactNode
}) {
  const t = useTranslations('freelance')
  const stage = useRef<BriefStageHandle>(null)
  const [report, setReport] = useState(INITIAL_REPORT)
  const [attempt, setAttempt] = useState(0)

  const { values, scene } = report
  const callouts = useMemo<BriefStageCallout[]>(() => {
    const scope = [
      values.budget && t(`options.budget.${values.budget}`),
      values.timeline && t(`options.timeline.${values.timeline}`),
    ].filter(Boolean)
    const complete = scene.rings === REQUIRED_BRIEF_FIELDS.length
    return [
      {
        label: t('scene.project'),
        lines: [values.projectType ? t(`options.projectType.${values.projectType}`) : t('scene.pending')],
        filled: !!values.projectType,
      },
      {
        label: t('scene.scope'),
        lines: scope.length > 0 ? scope : [t('scene.pending')],
        filled: scope.length > 0,
      },
      {
        label: t('scene.details'),
        lines: [complete ? t('scene.ready') : t('scene.fields', { done: scene.rings })],
        filled: complete,
      },
    ]
  }, [values.budget, values.timeline, values.projectType, scene.rings, t])

  return (
    // overflow-x-clip: the canvas bleeds past its column, but must never add a sideways
    // scroll on phones. Clip, because `hidden` would break the sticky column.
    <section
      id="request"
      aria-labelledby="freelance-title"
      className="relative scroll-mt-24 overflow-x-clip pb-16 pt-28 lg:pb-24 lg:pt-32"
    >
      <div className="relative container-main grid items-start gap-x-14 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,31rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] xl:gap-x-16">
        <div className="flex min-w-0 flex-col lg:sticky lg:top-24 lg:h-[min(calc(100svh-9.5rem),52rem)]">
          <div className="relative z-10">{intro}</div>
          <BriefStage ref={stage} state={scene} callouts={callouts} className="mt-2 lg:mt-6" />
        </div>

        <div className="relative z-10 @container min-w-0">
          <FreelanceLeadForm
            key={attempt}
            bookingUrl={bookingUrl}
            onReport={setReport}
            onActivity={() => stage.current?.pulse()}
            onRestart={() => setAttempt((count) => count + 1)}
          />
          {alternatives}
        </div>
      </div>
    </section>
  )
}
