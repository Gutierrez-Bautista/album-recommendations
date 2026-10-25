'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { AccountMenu } from './account-menu'
import { DailyPickAlbum } from './daily-pick-album'
import { createDailyPickClient, type DailyPickState } from './daily-pick-client'
import { DailyPickCountdown } from './daily-pick-countdown'
import { DailyPickSkeleton } from './daily-pick-skeleton'

export function DailyPickContent({ state, onRetry }: { state: DailyPickState, onRetry: () => void }) {
  if (state.status === 'loading') return <DailyPickSkeleton />

  if (state.status === 'success') {
    return (
      <>
        <p role="status" className="sr-only">Today&apos;s album is {state.pick.album.name}.</p>
        <DailyPickAlbum album={state.pick.album} />
      </>
    )
  }

  const notFound = state.status === 'not-found'
  return (
    <div className="flex min-h-80 flex-col items-start justify-center py-10">
      <div role={notFound ? 'status' : 'alert'}>
        <h2 className="text-xl font-semibold">{notFound ? 'Today’s album is on its way' : 'Unable to load today’s album'}</h2>
        <p className="mt-3 max-w-lg text-zinc-400">
          {notFound
            ? 'The recommendation for your day is not available yet. Please try again shortly.'
            : 'Something went wrong while loading your recommendation. Please try again.'}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 cursor-pointer rounded-full bg-(--app-primary) px-6 py-2.5 font-semibold text-white transition hover:bg-(--app-primary-hover) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--app-primary-light)"
      >
        Try again
      </button>
    </div>
  )
}

export function DailyPick({ account = null }: { account?: { image: string | null } | null }) {
  const [client] = useState(createDailyPickClient)
  const state = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getServerSnapshot)

  useEffect(() => () => client.cancel(), [client])

  return (
    <section aria-labelledby="daily-pick-heading" className="min-w-0">
      <header className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 min-[420px]:flex min-[420px]:flex-wrap min-[420px]:justify-between min-[420px]:gap-5 sm:mb-10">
        <div className="contents min-[420px]:block">
          <h1 id="daily-pick-heading" className="col-start-1 row-start-1 self-center text-2xl font-semibold tracking-tight sm:text-3xl">Today&apos;s Album</h1>
          <p className="col-start-1 row-start-2 text-sm text-zinc-400 min-[420px]:mt-2">A daily pick from our curated collection.</p>
        </div>
        <div className="contents min-[420px]:ml-auto min-[420px]:flex min-[420px]:shrink-0 min-[420px]:flex-col-reverse min-[420px]:items-center min-[420px]:gap-4 sm:flex-row sm:gap-5">
          <div className="col-start-2 row-start-2 justify-self-end text-right min-[420px]:text-left sm:text-right">
            <DailyPickCountdown onDateChange={client.load} />
          </div>
          <div className="col-start-2 row-start-1 justify-self-end">
            {account ? <AccountMenu image={account.image} /> : (
              <Link href="/login" className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-(--app-primary) px-4 py-2 text-sm font-semibold whitespace-nowrap transition hover:bg-(--app-primary-hover) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--app-primary-light)">Sign in</Link>
            )}
          </div>
        </div>
      </header>
      <DailyPickContent state={state} onRetry={client.retry} />
    </section>
  )
}
