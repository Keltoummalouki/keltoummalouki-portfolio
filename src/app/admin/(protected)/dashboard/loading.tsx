export default function DashboardLoading() {
  return <div className="space-y-6" role="status" aria-live="polite">
    <span className="sr-only">Loading your dashboard statistics…</span>
    <div className="space-y-3 py-2"><div className="h-3 w-44 rounded bg-muted motion-safe:animate-pulse" /><div className="h-9 w-full max-w-sm rounded bg-muted motion-safe:animate-pulse" /><div className="h-3 w-64 rounded bg-muted motion-safe:animate-pulse" /></div>
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[0,1,2,3].map(i=><div key={i} className="h-40 rounded-2xl border border-border bg-card p-5"><div className="h-8 w-8 rounded-lg bg-muted motion-safe:animate-pulse" /><div className="mt-4 h-9 w-16 rounded bg-muted motion-safe:animate-pulse" /><div className="mt-3 h-3 w-24 rounded bg-muted motion-safe:animate-pulse" /></div>)}</div>
    <div className="grid gap-5 md:grid-cols-[2fr_1fr]"><div className="h-80 rounded-2xl border border-border bg-card p-6"><div className="h-5 w-40 rounded bg-muted motion-safe:animate-pulse" /><div className="mt-10 h-44 rounded-xl bg-muted/50 motion-safe:animate-pulse" /></div><div className="flex h-80 items-center justify-center rounded-2xl border border-border bg-card"><div className="size-40 rounded-full border-[16px] border-muted motion-safe:animate-pulse" /></div></div>
    <div className="h-60 rounded-2xl border border-border bg-card motion-safe:animate-pulse" />
  </div>
}
