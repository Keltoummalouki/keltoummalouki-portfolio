import { describe, expect, it } from 'vitest'
import {
  BRIEF_STEPS,
  EMPTY_BRIEF,
  LOGIC_MODULES,
  briefSceneState,
  firstName,
  invalidBriefFields,
  isBriefFieldInvalid,
  withPackageLine,
  withStarter,
  withoutPackageLine,
  type BriefValues,
} from './brief'
import { BUDGET_RANGES, TIMELINES, leadFormSchema } from './schema'

const complete: BriefValues = {
  ...EMPTY_BRIEF,
  details: 'A booking site for a small clinic.',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
}

const scene = (values: BriefValues, overrides: Partial<Parameters<typeof briefSceneState>[0]> = {}) =>
  briefSceneState({ values, furthestStep: 0, preview: null, phase: 'editing', ...overrides })

describe('invalidBriefFields', () => {
  it('lists every required field of an empty form, in page order', () => {
    expect(invalidBriefFields(EMPTY_BRIEF)).toEqual(['details', 'name', 'email'])
  })

  it('accepts what the server accepts, with every optional answer left empty', () => {
    expect(invalidBriefFields(complete)).toEqual([])
    expect(leadFormSchema.safeParse(complete).success).toBe(true)
  })

  it('follows the server rules on length and email format', () => {
    expect(invalidBriefFields({ ...complete, details: 'Too short' })).toEqual(['details'])
    expect(invalidBriefFields({ ...complete, name: 'A' })).toEqual(['name'])
    expect(invalidBriefFields({ ...complete, email: 'not-an-email' })).toEqual(['email'])
  })

  it('checks one field at a time for validation on blur', () => {
    const halfDone = { ...EMPTY_BRIEF, name: 'Ada Lovelace' }
    expect(isBriefFieldInvalid('name', halfDone)).toBe(false)
    expect(isBriefFieldInvalid('email', halfDone)).toBe(true)
  })
})

describe('briefSceneState', () => {
  it('starts with the interface layer only, all dark, at normal speed', () => {
    expect(scene(EMPTY_BRIEF)).toEqual({ built: 1, screen: null, modules: 0, tempo: 1, rings: 0, phase: 'editing' })
  })

  it('builds one layer per step reached and keeps them when going back', () => {
    expect(scene(EMPTY_BRIEF, { furthestStep: 1 }).built).toBe(2)
    expect(scene(EMPTY_BRIEF, { furthestStep: 2 }).built).toBe(BRIEF_STEPS.length)
    expect(scene(EMPTY_BRIEF, { furthestStep: 99 }).built).toBe(BRIEF_STEPS.length)
  })

  it('completes the stack as soon as the request is on its way', () => {
    expect(scene(EMPTY_BRIEF, { phase: 'sending' }).built).toBe(BRIEF_STEPS.length)
    expect(scene(EMPTY_BRIEF, { phase: 'sent' }).built).toBe(BRIEF_STEPS.length)
    expect(scene(EMPTY_BRIEF, { phase: 'failed' }).built).toBe(1)
  })

  it('shows the option under the pointer, then falls back to the chosen one', () => {
    const chosen = { ...EMPTY_BRIEF, projectType: 'website' as const }
    expect(scene(chosen).screen).toBe('website')
    expect(scene(chosen, { preview: 'api' }).screen).toBe('api')
  })

  it('lights more modules as the budget grows, within the available modules', () => {
    const lit = (budget: BriefValues['budget']) => scene({ ...EMPTY_BRIEF, budget }).modules
    expect(lit('lt_1k')).toBeLessThan(lit('1k_5k'))
    expect(lit('1k_5k')).toBeLessThan(lit('5k_15k'))
    expect(lit('5k_15k')).toBeLessThan(lit('gt_15k'))
    expect(lit('gt_15k')).toBe(LOGIC_MODULES)
    for (const budget of BUDGET_RANGES) expect(lit(budget)).toBeGreaterThan(0)
  })

  it('moves data faster for a tighter deadline', () => {
    const tempo = (timeline: BriefValues['timeline']) => scene({ ...EMPTY_BRIEF, timeline }).tempo
    const speeds = TIMELINES.map(tempo)
    expect(speeds).toEqual([...speeds].sort((a, b) => b - a))
    expect(tempo('asap')).toBeGreaterThan(tempo(''))
    expect(tempo('flexible')).toBeLessThan(tempo(''))
  })

  it('lights one ring per valid required field', () => {
    expect(scene(EMPTY_BRIEF).rings).toBe(0)
    expect(scene({ ...EMPTY_BRIEF, name: 'Ada Lovelace' }).rings).toBe(1)
    expect(scene(complete).rings).toBe(3)
  })
})

describe('package line', () => {
  it('goes on top of what was typed', () => {
    expect(withPackageLine('My project', 'Package: API')).toBe('Package: API\nMy project')
  })

  it('leaves the cursor on a fresh line of an empty field', () => {
    expect(withPackageLine('', 'Package: API')).toBe('Package: API\n')
  })

  it('replaces the previous package instead of stacking them', () => {
    const first = withPackageLine('My project', 'Package: API')
    expect(withPackageLine(first, 'Package: Web', 'Package: API')).toBe('Package: Web\nMy project')
  })

  it('comes off without touching the rest', () => {
    expect(withoutPackageLine('Package: API\nMy project', 'Package: API')).toBe('My project')
    expect(withoutPackageLine('Package: API\n', 'Package: API')).toBe('')
  })

  it('leaves the text alone once the visitor has rewritten the line', () => {
    expect(withoutPackageLine('Actually, an app', 'Package: API')).toBe('Actually, an app')
  })
})

describe('withStarter', () => {
  it('drops the chip’s ellipsis and leaves the cursor after a space', () => {
    expect(withStarter('', 'The main goal is…')).toBe('The main goal is ')
  })

  it('starts a new line after existing text', () => {
    expect(withStarter('A shop.\n\n', 'For reference:')).toBe('A shop.\nFor reference: ')
  })
})

describe('firstName', () => {
  it('takes the first word and ignores extra spaces', () => {
    expect(firstName('  Ada   Lovelace ')).toBe('Ada')
  })
})
