// Pure search for the admin command palette (⌘K / Ctrl+K), kept apart from
// the component so it can be unit-tested.

export interface Searchable {
  label: string
  /** Extra words that should find the command ("write", "create"…). */
  keywords?: string
}

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Commands whose label or keywords contain every word of the query, ranked:
 * the label starts with the first word, then one of its words does, then the
 * rest. Ties keep the input order (quick actions before pages).
 */
export function filterCommands<T extends Searchable>(commands: readonly T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...commands]
  const ranked: { command: T; rank: number; index: number }[] = []
  commands.forEach((command, index) => {
    const label = fold(command.label)
    const haystack = `${label} ${fold(command.keywords ?? '')}`
    if (!words.every(word => haystack.includes(word))) return
    const first = words[0]
    const rank = label.startsWith(first) ? 0 : label.split(/[^a-z0-9]+/).some(part => part.startsWith(first)) ? 1 : 2
    ranked.push({ command, rank, index })
  })
  return ranked.sort((a, b) => a.rank - b.rank || a.index - b.index).map(entry => entry.command)
}
