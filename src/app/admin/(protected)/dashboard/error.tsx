'use client'
import { RotateCw, ChartNoAxesCombined } from 'lucide-react'
export default function DashboardError({ reset }: { reset: () => void }) {
  return <section className="flex min-h-96 flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
    <ChartNoAxesCombined className="size-9 text-primary" aria-hidden="true" />
    <h1 className="text-2xl font-semibold tracking-tight">Your overview couldn’t load</h1>
    <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">We couldn’t retrieve your workspace statistics. Try again to refresh the dashboard.</p>
    <button className="studio-primary mt-2" onClick={reset}><RotateCw size={16} aria-hidden="true" /> Try again</button>
  </section>
}
