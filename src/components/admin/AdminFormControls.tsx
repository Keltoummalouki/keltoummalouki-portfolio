'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface AdminSelectOption {
  value: string
  label: string
  description?: string
}

const labelClass = 'text-sm font-medium text-foreground'
const triggerClass =
  'admin-field-trigger flex min-h-10 w-full items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-left text-sm text-foreground shadow-xs outline-none transition-colors hover:bg-secondary/60 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) onOutside()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [onOutside])

  return ref
}

export function AdminSelectField({
  id,
  label,
  name,
  options,
  defaultValue,
  value,
  onValueChange,
  placeholder = 'Select…',
  help,
  className,
}: {
  id: string
  label: string
  name?: string
  options: AdminSelectOption[]
  defaultValue?: string | null
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  help?: string
  className?: string
}) {
  const fallback = defaultValue ?? options[0]?.value ?? ''
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState(fallback)
  const selectedValue = isControlled ? value : internalValue

  function handleValueChange(nextValue: string) {
    if (!isControlled) setInternalValue(nextValue)
    onValueChange?.(nextValue)
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={`${id}-trigger`} className={labelClass}>
        {label}
      </label>
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <Select value={selectedValue} onValueChange={handleValueChange}>
        <SelectTrigger id={`${id}-trigger`} className="admin-field-trigger w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent id={`${id}-listbox`}>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value} textValue={option.label}>
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{option.label}</span>
                  {option.description && (
                    <span className="admin-select-hint text-xs text-muted-foreground">{option.description}</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  )
}

export function CheckboxField({
  id,
  label,
  name,
  defaultChecked,
  checked,
  onCheckedChange,
  className,
}: {
  id: string
  label: string
  name?: string
  defaultChecked?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Checkbox
        id={id}
        name={name}
        defaultChecked={defaultChecked}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange?.(next === true)}
      />
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
    </div>
  )
}

function parseIsoDate(value: string | null | undefined) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateLabel(value: string) {
  const date = parseIsoDate(value)
  if (!date) return ''
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export function DatePickerField({
  id,
  label,
  name,
  defaultValue,
  help,
  required,
  className,
}: {
  id?: string
  label: string
  name: string
  defaultValue?: string | null
  help?: string
  required?: boolean
  className?: string
}) {
  const fieldId = id ?? name
  const initialDate = parseIsoDate(defaultValue)
  const [value, setValue] = useState(defaultValue ?? '')
  const [viewDate, setViewDate] = useState(initialDate ?? new Date())
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))
  const selectedDate = parseIsoDate(value)
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay()
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  function moveMonth(delta: number) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1))
  }

  function selectDay(day: number) {
    const next = new Date(viewDate.getFullYear(), viewDate.getMonth(), day)
    setValue(toIsoDate(next))
    setOpen(false)
  }

  function selectToday() {
    const today = new Date()
    setValue(toIsoDate(today))
    setViewDate(today)
    setOpen(false)
  }

  return (
    <div ref={ref} className={cn('relative flex flex-col gap-1.5', className)}>
      <label htmlFor={`${fieldId}-trigger`} className={labelClass}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      <input type="hidden" name={name} value={value} />
      <button
        id={`${fieldId}-trigger`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={triggerClass}
      >
        <span className={cn('inline-flex min-w-0 items-center gap-2 truncate', !value && 'text-muted-foreground')}>
          <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
          {value ? formatDateLabel(value) : 'Pick a date'}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="icon" aria-label="Previous month" onClick={() => moveMonth(-1)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
            <Button type="button" variant="ghost" size="icon" aria-label="Next month" onClick={() => moveMonth(1)}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1 font-medium">
                {day}
              </span>
            ))}
            {cells.map((day, index) =>
              day ? (
                <button
                  key={`${viewDate.getMonth()}-${day}`}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg text-sm text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                    selectedDate?.getFullYear() === viewDate.getFullYear() &&
                      selectedDate.getMonth() === viewDate.getMonth() &&
                      selectedDate.getDate() === day &&
                      'bg-primary text-primary-foreground hover:bg-primary',
                  )}
                >
                  {day}
                </button>
              ) : (
                <span key={`empty-${index}`} aria-hidden="true" />
              ),
            )}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setValue('')}>
              Clear
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={selectToday}>
              Today
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

const COLOR_PRESETS = [
  '#2A6AFF',
  '#2563EB',
  '#7C3AED',
  '#8B5CF6',
  '#06B6D4',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#111827',
]

function normalizeHex(value: string) {
  const trimmed = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toUpperCase()
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed.toUpperCase()}`
  return null
}

export function ColorPickerField({
  label,
  name,
  defaultValue,
  className,
}: {
  label: string
  name: string
  defaultValue: string
  className?: string
}) {
  const initial = normalizeHex(defaultValue) ?? '#2A6AFF'
  const [value, setValue] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [open, setOpen] = useState(false)
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false))

  function apply(nextValue: string) {
    const normalized = normalizeHex(nextValue)
    if (!normalized) {
      setDraft(nextValue)
      return
    }

    setValue(normalized)
    setDraft(normalized)
  }

  return (
    <div ref={ref} className={cn('relative flex flex-col gap-2', className)}>
      <label htmlFor={`${name}-trigger`} className={labelClass}>
        {label}
      </label>
      <input type="hidden" name={name} value={value} />
      <button
        id={`${name}-trigger`}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border bg-background/70 p-2 text-left text-sm shadow-xs transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
          <span className="size-7 rounded-md border border-border" style={{ backgroundColor: value }} />
        </span>
        <span className="font-mono text-sm text-muted-foreground">{value}</span>
        <Palette className="ml-auto size-4 text-muted-foreground" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl">
          <p className="mb-3 text-sm font-semibold text-foreground">Choose color</p>
          <div className="grid grid-cols-5 gap-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Use ${color}`}
                onClick={() => apply(color)}
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl border border-border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  value === color.toUpperCase() && 'ring-2 ring-primary/50',
                )}
                style={{ backgroundColor: color }}
              >
                {value === color.toUpperCase() && <Check className="size-4 text-white drop-shadow" aria-hidden="true" />}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            <label htmlFor={`${name}-hex`} className={labelClass}>
              HEX value
            </label>
            <input
              id={`${name}-hex`}
              value={draft}
              onChange={(event) => apply(event.target.value)}
              placeholder="#2A6AFF"
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
            {!normalizeHex(draft) && <p className="text-xs text-destructive">Use a valid HEX color like #2A6AFF.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
