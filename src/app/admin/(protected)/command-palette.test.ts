import { describe, expect, it } from 'vitest'
import { filterCommands } from './command-palette'

const commands = [
  { label: 'New project', keywords: 'create add portfolio' },
  { label: 'New article', keywords: 'create write blog post' },
  { label: 'Projects' },
  { label: 'Services & pricing', keywords: 'packages tarifs' },
  { label: 'Freelance leads', keywords: 'clients pipeline' },
  { label: 'Éducation' },
]
const labels = (query: string) => filterCommands(commands, query).map(c => c.label)

describe('command palette search', () => {
  it('returns every command, in order, for an empty query', () => {
    expect(labels('  ')).toEqual(commands.map(c => c.label))
  })
  it('ranks label prefixes first, then word starts, then other matches', () => {
    expect(labels('pro')).toEqual(['Projects', 'New project'])
    expect(labels('lead')).toEqual(['Freelance leads'])
  })
  it('matches keywords and needs every word of the query', () => {
    expect(labels('write')).toEqual(['New article'])
    expect(labels('create blog')).toEqual(['New article'])
    expect(labels('create nothing')).toEqual([])
  })
  it('ignores case and accents', () => {
    expect(labels('EDUC')).toEqual(['Éducation'])
    expect(labels('pricing &')).toEqual(['Services & pricing'])
  })
})
