const card = 'rounded-[24px] border border-border bg-card'
const pulse = 'bg-muted motion-safe:animate-pulse'

// Mirrors the dashboard's bento layout (greeting, totals, skyline + profile,
// activity + deck) so nothing jumps when the real page streams in.
export default function DashboardLoading() {
  return (
    <div className="space-y-[18px]" role="status" aria-live="polite">
      <span className="sr-only">Loading your dashboard statistics…</span>
      <div className="flex items-end justify-between gap-6 py-1">
        <div className="space-y-4">
          <div className={`h-3 w-40 rounded-full ${pulse}`} />
          <div className={`h-12 w-72 max-w-full rounded-2xl ${pulse}`} />
          <div className={`h-3 w-80 max-w-full rounded-full ${pulse}`} />
        </div>
        <div className="hidden gap-2.5 sm:flex">
          <div className={`h-11 w-32 rounded-full ${pulse}`} />
          <div className={`h-11 w-36 rounded-full ${pulse}`} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-[18px] xl:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`${card} h-[172px] p-5`}>
            <div className={`size-9 rounded-xl ${pulse}`} />
            <div className={`mt-6 h-9 w-20 rounded-lg ${pulse}`} />
            <div className={`mt-5 h-3 w-28 rounded-full ${pulse}`} />
          </div>
        ))}
      </div>
      <div className="grid gap-[18px] xl:grid-cols-[minmax(0,1fr)_clamp(300px,27%,380px)]">
        <div className={`${card} flex h-[520px] flex-col p-6`}>
          <div className={`h-4 w-44 rounded-full ${pulse}`} />
          <div className={`mx-auto mt-10 h-56 w-3/4 rounded-[40px] ${pulse} opacity-60`} />
          <div className="mt-auto grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map(i => <div key={i} className={`h-16 rounded-2xl ${pulse}`} />)}
          </div>
        </div>
        <div className="grid gap-[18px]">
          <div className={`${card} flex flex-col items-center p-6`}>
            <div className={`size-20 rounded-full ${pulse}`} />
            <div className={`mt-4 h-4 w-36 rounded-full ${pulse}`} />
            <div className={`mt-6 h-12 w-full rounded-2xl ${pulse}`} />
          </div>
          <div className={`${card} flex items-center justify-center p-6`}>
            <div className={`h-24 w-48 rounded-t-full ${pulse}`} />
          </div>
        </div>
      </div>
    </div>
  )
}
