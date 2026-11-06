'use client'

import { useActionState, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import TurnstileWidget from '@/components/ui/TurnstileWidget'
import { submitFreelanceLeadAction } from '@/features/freelance/actions'
import {
  BUDGET_RANGES,
  CONTACT_PREFERENCES,
  PROJECT_TYPES,
  TIMELINES,
  type LeadSubmitState,
} from '@/features/freelance/schema'
import { trackEvent } from '@/lib/analytics/events'

const field =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-[invalid=true]:border-destructive'
const labelClass = 'text-sm font-medium text-foreground'
const EMPTY_SELECT_VALUE = '__empty__'

export default function FreelanceLeadForm() {
  const t = useTranslations('freelance')
  const [state, formAction, pending] = useActionState<LeadSubmitState, FormData>(
    submitFreelanceLeadAction,
    {},
  )
  const [token, setToken] = useState<string | null>(null)
  const [selectValues, setSelectValues] = useState<Record<string, string>>({})

  const err = (key: string) => state.errors?.[key]
  const formError =
    state.error === 'rate_limited' ? t('form.errorRateLimited') : t('form.errorGeneric')

  const updateSelectValue = (name: string, value: string) => {
    setSelectValues((current) => ({
      ...current,
      [name]: value === EMPTY_SELECT_VALUE ? '' : value,
    }))
  }

  // Conversion: the request was accepted. Project type only, never what was typed.
  // The form is replaced by the success message, so this runs once per request.
  const projectType = selectValues.projectType || 'unspecified'
  useEffect(() => {
    if (state.ok) trackEvent('lead-form-sent', { type: projectType })
  }, [state.ok, projectType])

  if (state.ok) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center"
      >
        <CheckCircle className="text-emerald-500" />
        <p className="font-medium text-foreground">{t('form.success')}</p>
      </div>
    )
  }

  const selectGroup = (
    name: string,
    label: string,
    options: readonly string[],
    optionGroup: string,
  ) => {
    const value = selectValues[name] ?? ''

    return (
      <div className="space-y-1.5">
        <label htmlFor={name} className={labelClass}>{label}</label>
        <input type="hidden" name={name} value={value} />
        <Select value={value} onValueChange={(nextValue) => updateSelectValue(name, nextValue)}>
          <SelectTrigger id={name} className={field}>
            <SelectValue placeholder={t('form.selectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={EMPTY_SELECT_VALUE}>{t('form.selectPlaceholder')}</SelectItem>
              {options.map((optionValue) => (
                <SelectItem key={optionValue} value={optionValue}>
                  {t(`options.${optionGroup}.${optionValue}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && state.error !== 'invalid' && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="name" className={labelClass}>
            {t('form.name')} <span className="text-destructive">*</span>
          </label>
          <input id="name" name="name" autoComplete="name" required
            aria-invalid={err('name') ? true : undefined} className={field} />
          {err('name') && <p className="text-xs text-destructive">{t('form.errors.nameRequired')}</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className={labelClass}>
            {t('form.email')} <span className="text-destructive">*</span>
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required
            aria-invalid={err('email') ? true : undefined} className={field} />
          {err('email') && <p className="text-xs text-destructive">{t('form.errors.emailInvalid')}</p>}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="company" className={labelClass}>{t('form.company')}</label>
          <input id="company" name="company" autoComplete="organization" className={field} />
        </div>

        {selectGroup('projectType', t('form.projectType'), PROJECT_TYPES, 'projectType')}
        {selectGroup('budget', t('form.budget'), BUDGET_RANGES, 'budget')}
        {selectGroup('timeline', t('form.timeline'), TIMELINES, 'timeline')}
        {selectGroup('contactPreference', t('form.contactPreference'), CONTACT_PREFERENCES, 'contactPreference')}

        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="details" className={labelClass}>
            {t('form.details')} <span className="text-destructive">*</span>
          </label>
          <textarea id="details" name="details" rows={6} required
            placeholder={t('form.detailsPlaceholder')}
            aria-invalid={err('details') ? true : undefined} className={field} />
          {err('details') && <p className="text-xs text-destructive">{t('form.errors.detailsRequired')}</p>}
        </div>
      </div>

      <TurnstileWidget onToken={setToken} />
      <input type="hidden" name="turnstileToken" value={token ?? ''} />

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? t('form.sending') : t('form.submit')}
      </Button>
    </form>
  )
}
