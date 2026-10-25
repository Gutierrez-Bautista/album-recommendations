export function DailyPickSkeleton() {
  return (
    <div role="status" aria-label="Loading today's album">
      <span className="sr-only">Loading today&apos;s album…</span>
      <div aria-hidden="true" className="grid min-w-0 gap-8 motion-safe:animate-pulse md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-10 lg:gap-14">
        <div className="mx-auto w-full max-w-md md:max-w-none">
          <div className="aspect-square rounded-lg bg-zinc-800" />
          <div className="mt-5 h-12 rounded-full bg-zinc-800" />
        </div>
        <div className="min-w-0 md:py-2">
          <div className="h-12 w-5/6 rounded bg-zinc-800" />
          <div className="mt-3 h-7 w-3/5 rounded bg-zinc-800" />
          <div className="mt-3 h-6 w-24 rounded-full bg-zinc-800" />
          <div className="mt-6 h-9 w-full rounded bg-zinc-800" />
          <div className="mt-8 h-5 w-12 rounded bg-zinc-800" />
          <div className="mt-3 flex flex-wrap gap-2">
            {[24, 32, 20, 28, 24].map((width, index) => (
              <div key={index} style={{ width: `${width / 4}rem` }} className="h-9 max-w-full rounded-full bg-zinc-800" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
