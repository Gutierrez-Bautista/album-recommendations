import { z } from 'zod'
import type { DailyPickDetails } from '@/lib/daily-pick/queries'

const namedItemSchema = z.object({ id: z.string(), name: z.string() })

function isSpotifyCoverUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'i.scdn.co' &&
      url.port === '' && url.username === '' && url.password === '' && url.search === '' &&
      url.pathname.startsWith('/image/')
  } catch {
    return false
  }
}

const dailyPickSchema: z.ZodType<DailyPickDetails> = z.object({
  pickDate: z.string(),
  album: z.object({
    id: z.string(),
    spotifyId: z.string().regex(/^[a-zA-Z0-9]{22}$/),
    name: z.string(),
    coverUrl: z.string().refine(isSpotifyCoverUrl).nullable(),
    spotifyAlbumType: z.enum(['album', 'single', 'compilation']),
    releaseKind: z.enum(['album', 'single', 'ep', 'compilation']).nullable(),
    releaseDateRaw: z.string(),
    totalTracks: z.number().int().nonnegative(),
    durationMs: z.number().nonnegative().nullable(),
    hasSpotifyMarkedExplicitTracks: z.boolean(),
    artists: z.array(namedItemSchema).min(1),
    tagCategories: z.array(z.object({
      id: z.string(),
      key: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      tags: z.array(namedItemSchema),
    })),
  }),
})

export type DailyPickState =
  | { status: 'loading', date: string | null }
  | { status: 'success', date: string, pick: DailyPickDetails }
  | { status: 'not-found' | 'error', date: string }

const INITIAL_STATE: DailyPickState = { status: 'loading', date: null }

export function createDailyPickClient(fetcher: typeof fetch = (...args) => fetch(...args)) {
  let state = INITIAL_STATE
  let selectedDate: string | null = null
  let requestVersion = 0
  let activeRequest: AbortController | null = null
  const listeners = new Set<() => void>()

  function publish(next: DailyPickState) {
    state = next
    listeners.forEach((listener) => listener())
  }

  async function request(date: string) {
    const version = ++requestVersion
    activeRequest?.abort()
    const controller = new AbortController()
    activeRequest = controller
    // Clear the previous pick synchronously when its local date expires.
    publish({ status: 'loading', date })

    try {
      const response = await fetcher(`/api/daily-pick?date=${encodeURIComponent(date)}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      let next: DailyPickState
      if (response.status === 404) {
        next = { status: 'not-found', date }
      } else if (response.status === 200) {
        const result = dailyPickSchema.safeParse(await response.json())
        next = result.success && result.data.pickDate === date
          ? { status: 'success', date, pick: result.data }
          : { status: 'error', date }
      } else {
        next = { status: 'error', date }
      }

      if (!controller.signal.aborted && version === requestVersion) publish(next)
    } catch {
      if (!controller.signal.aborted && version === requestVersion) {
        publish({ status: 'error', date })
      }
    } finally {
      if (version === requestVersion) activeRequest = null
    }
  }

  const load = (date: string) => {
    if (date === selectedDate) return
    selectedDate = date
    void request(date)
  }

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => INITIAL_STATE,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    load,
    retry: () => {
      if (state.status === 'loading' || selectedDate === null) return
      void request(selectedDate)
    },
    cancel: () => {
      ++requestVersion
      activeRequest?.abort()
      activeRequest = null
      // Allow a repeated effect setup to restart a canceled initial request.
      selectedDate = null
    },
  }
}
