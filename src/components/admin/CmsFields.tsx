'use client'

import { useId } from 'react'
import { AdminSelectField, DatePickerField } from './AdminFormControls'

const fieldClass = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
const labelClass = 'text-sm font-medium text-foreground'

export function Field({ label, name, defaultValue, type = 'text', placeholder, required }: { label: string; name: string; defaultValue?: string | number | null; type?: string; placeholder?: string; required?: boolean }) {
  const id = useId()
  if (type === 'date') return <DatePickerField id={id} label={label} name={name} defaultValue={defaultValue != null ? String(defaultValue) : ''} required={required} />
  return <div className="space-y-1.5"><label htmlFor={id} className={labelClass}>{label}</label><input id={id} name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue ?? ''} className={fieldClass} /></div>
}
export function TextArea({ label, name, defaultValue, rows = 4, dir, required }: { label: string; name: string; defaultValue?: string | null; rows?: number; dir?: 'ltr' | 'rtl'; required?: boolean }) {
  const id = useId()
  return <div className="space-y-1.5"><label htmlFor={id} className={labelClass}>{label}</label><textarea id={id} name={name} rows={rows} required={required} dir={dir} defaultValue={defaultValue ?? ''} className={fieldClass} /></div>
}
export function StatusSelect({ defaultValue = 'published' }: { defaultValue?: string | null }) {
  const id = useId()
  return <AdminSelectField id={id} label="Status" name="status" options={[{value:'published',label:'Published'},{value:'draft',label:'Draft'},{value:'archived',label:'Archived'}]} defaultValue={defaultValue ?? 'published'} />
}
