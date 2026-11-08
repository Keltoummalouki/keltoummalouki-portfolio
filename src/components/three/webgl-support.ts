/** Skip 3D scenes where they would cost the visitor (data saver, very low memory). */
export function wantsWebGL(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number }
  if (nav.connection?.saveData) return false
  return nav.deviceMemory === undefined || nav.deviceMemory >= 2
}
