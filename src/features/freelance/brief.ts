import {
  leadFormSchema,
  type BUDGET_RANGES,
  type CONTACT_PREFERENCES,
  type PROJECT_TYPES,
  type TIMELINES,
} from './schema'

// Logic of the guided request form and of the 3D model it builds, free of React
// and Three.js so it can be unit-tested. Validation reuses the server's schema,
// so the browser and the Server Action can never disagree.

export type ProjectType = (typeof PROJECT_TYPES)[number]
export type BudgetRange = (typeof BUDGET_RANGES)[number]
export type Timeline = (typeof TIMELINES)[number]
export type ContactPreference = (typeof CONTACT_PREFERENCES)[number]

export interface BriefValues {
  projectType: ProjectType | ''
  budget: BudgetRange | ''
  timeline: Timeline | ''
  contactPreference: ContactPreference | ''
  details: string
  name: string
  email: string
  company: string
}

export const EMPTY_BRIEF: BriefValues = {
  projectType: '',
  budget: '',
  timeline: '',
  contactPreference: '',
  details: '',
  name: '',
  email: '',
  company: '',
}

/** Sent by a package's button to the form, which adds the package to the request. */
export const PACKAGE_EVENT = 'freelance:package'
export type PackageEventDetail = { title: string }

/** The form's steps, in order. Only the last one holds required fields. */
export const BRIEF_STEPS = ['project', 'scope', 'details'] as const
export type BriefStep = (typeof BRIEF_STEPS)[number]
export const LAST_BRIEF_STEP = BRIEF_STEPS.length - 1

/** Required fields, in the order they appear on the page. */
export const REQUIRED_BRIEF_FIELDS = ['details', 'name', 'email'] as const
export type RequiredBriefField = (typeof REQUIRED_BRIEF_FIELDS)[number]

/** The required fields that don't pass the server's rules yet, in page order. */
export function invalidBriefFields(values: BriefValues): RequiredBriefField[] {
  const result = leadFormSchema.safeParse(values)
  if (result.success) return []
  const invalid = new Set(result.error.issues.map((issue) => issue.path[0]))
  return REQUIRED_BRIEF_FIELDS.filter((field) => invalid.has(field))
}

/** A single required field's verdict, for validating when it loses focus. */
export function isBriefFieldInvalid(field: RequiredBriefField, values: BriefValues): boolean {
  return invalidBriefFields(values).includes(field)
}

/** Number of logic modules on the model's middle layer. */
export const LOGIC_MODULES = 12

/** More budget, more modules lit. "Not sure yet" sits in the lower middle. */
const MODULES_BY_BUDGET: Record<BudgetRange, number> = {
  lt_1k: 3,
  '1k_5k': 6,
  '5k_15k': 9,
  gt_15k: LOGIC_MODULES,
  unsure: 5,
}

/** A tighter deadline makes the data move faster through the model. */
const TEMPO_BY_TIMELINE: Record<Timeline, number> = {
  asap: 1.9,
  '1_3_months': 1.25,
  '3_6_months': 0.85,
  flexible: 0.6,
}

export type BriefPhase = 'editing' | 'sending' | 'sent' | 'failed'

/** Everything the 3D model shows. */
export interface BriefSceneState {
  /** Layers built so far: 1 is the interface, 3 the whole stack. */
  built: number
  /** What the interface layer displays; null while nothing is chosen. */
  screen: ProjectType | null
  /** Logic modules lit, up to LOGIC_MODULES. */
  modules: number
  /** Speed of the data moving between layers (1 = normal). */
  tempo: number
  /** Rings lit on the data layer: one per valid required field. */
  rings: number
  phase: BriefPhase
}

export function briefSceneState({
  values,
  furthestStep,
  preview,
  phase,
}: {
  values: BriefValues
  /** The furthest step reached: going back doesn't take a layer apart. */
  furthestStep: number
  /** Option under the pointer, shown before it is chosen. */
  preview: ProjectType | null
  phase: BriefPhase
}): BriefSceneState {
  const closing = phase === 'sending' || phase === 'sent'
  return {
    built: closing ? BRIEF_STEPS.length : Math.min(furthestStep + 1, BRIEF_STEPS.length),
    screen: preview ?? (values.projectType || null),
    modules: values.budget ? MODULES_BY_BUDGET[values.budget] : 0,
    tempo: values.timeline ? TEMPO_BY_TIMELINE[values.timeline] : 1,
    rings: REQUIRED_BRIEF_FIELDS.length - invalidBriefFields(values).length,
    phase,
  }
}

/** Removes a package line added earlier; anything the visitor typed stays. */
export function withoutPackageLine(details: string, line: string): string {
  return details.startsWith(line) ? details.slice(line.length).replace(/^\n/, '') : details
}

/** Puts "Package: X" on top of the details, in place of a previously chosen package. */
export function withPackageLine(details: string, line: string, previous: string | null = null): string {
  const rest = previous ? withoutPackageLine(details, previous) : details
  return `${line}\n${rest}`
}

/** Adds a sentence starter on its own line, ready to finish. Its "…" is only for the chip. */
export function withStarter(details: string, starter: string): string {
  const text = starter.replace(/…$/, '').trimEnd()
  const before = details.trimEnd()
  return `${before ? `${before}\n` : ''}${text} `
}

/** First word of a full name, for a friendlier thank-you. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}
