import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dailyPickFixture } from '@/tests/fixtures/daily-pick'
import { createDailyPickClient } from './daily-pick-client'

const date = dailyPickFixture.pickDate

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

// Requests are deliberately mocked, including responses that ignore AbortSignal.
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => { fetchMock.mockReset() })

async function settle() {
  // Both Response.json and the async request continuation must complete.
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

describe('daily pick browser client', () => {
  it('starts with a stable loading snapshot without requesting a server-local date', () => {
    const client = createDailyPickClient(fetchMock)
    expect(client.getSnapshot()).toEqual({ status: 'loading', date: null })
    expect(client.getServerSnapshot()).toBe(client.getServerSnapshot())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches the requested local date without caching and publishes a valid 200 response', async () => {
    fetchMock.mockResolvedValue(Response.json(dailyPickFixture))
    const client = createDailyPickClient(fetchMock)
    const listener = vi.fn()
    client.subscribe(listener)
    client.load(date)

    expect(client.getSnapshot()).toEqual({ status: 'loading', date })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`/api/daily-pick?date=${date}`, {
      cache: 'no-store', signal: expect.any(AbortSignal),
    })
    await settle()
    expect(client.getSnapshot()).toEqual({ status: 'success', date, pick: dailyPickFixture })
    expect(listener).toHaveBeenCalledTimes(2)
    expect(client.getServerSnapshot()).toEqual({ status: 'loading', date: null })
  })

  it('distinguishes a missing pick from server errors', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }))
    const client = createDailyPickClient(fetchMock)
    client.load(date)
    await settle()
    expect(client.getSnapshot()).toEqual({ status: 'not-found', date })
  })

  it.each([400, 500, 502, 204, 201])('maps HTTP %i to a generic error without exposing the body', async (status) => {
    fetchMock.mockResolvedValue(new Response(status === 204 ? null : 'private server details', { status }))
    const client = createDailyPickClient(fetchMock)
    client.load(date)
    await settle()
    expect(client.getSnapshot()).toEqual({ status: 'error', date })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('maps a network failure to a generic error without automatically retrying', async () => {
    fetchMock.mockRejectedValue(new Error('private network details'))
    const client = createDailyPickClient(fetchMock)
    client.load(date)
    await settle()
    expect(client.getSnapshot()).toEqual({ status: 'error', date })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it.each([
    null,
    {},
    { pickDate: date, album: {} },
    { ...dailyPickFixture, album: { ...dailyPickFixture.album, durationMs: '48' } },
    { ...dailyPickFixture, album: { ...dailyPickFixture.album, spotifyId: '../wrong/path' } },
    { ...dailyPickFixture, album: { ...dailyPickFixture.album, coverUrl: 'https://untrusted.test/image' } },
    { ...dailyPickFixture, album: { ...dailyPickFixture.album, coverUrl: 'https://i.scdn.co/image/cover?unexpected=query' } },
    { ...dailyPickFixture, album: { ...dailyPickFixture.album, artists: [] } },
    { ...dailyPickFixture, album: { ...dailyPickFixture.album, tagCategories: [{ name: 'Mood' }] } },
  ])('rejects an unexpected successful response shape (%j)', async (payload) => {
    fetchMock.mockResolvedValue(Response.json(payload))
    const client = createDailyPickClient(fetchMock)
    client.load(date)
    await settle()
    expect(client.getSnapshot()).toEqual({ status: 'error', date })
  })

  it('accepts cover images matching the existing Next image host allowlist', async () => {
    const pick = {
      ...dailyPickFixture,
      album: { ...dailyPickFixture.album, coverUrl: 'https://i.scdn.co/image/album-cover' },
    }
    fetchMock.mockResolvedValue(Response.json(pick))
    const client = createDailyPickClient(fetchMock)
    client.load(date)
    await settle()
    expect(client.getSnapshot()).toEqual({ status: 'success', date, pick })
  })

  it('rejects invalid JSON and successful data for a different date', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not json', { status: 200 }))
    fetchMock.mockResolvedValueOnce(Response.json({ ...dailyPickFixture, pickDate: '2026-10-24' }))
    const client = createDailyPickClient(fetchMock)
    client.load(date)
    await settle()
    expect(client.getSnapshot()).toEqual({ status: 'error', date })
    client.retry()
    await settle()
    expect(client.getSnapshot()).toEqual({ status: 'error', date })
  })

  it('retries both errors and not-found responses without reloading the page', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }))
    fetchMock.mockResolvedValueOnce(Response.json(dailyPickFixture))
    const client = createDailyPickClient(fetchMock)
    client.load(date)
    await settle()
    expect(client.getSnapshot().status).toBe('error')
    client.retry()
    expect(client.getSnapshot()).toEqual({ status: 'loading', date })
    await settle()
    expect(client.getSnapshot().status).toBe('not-found')
    client.retry()
    await settle()
    expect(client.getSnapshot()).toEqual({ status: 'success', date, pick: dailyPickFixture })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('avoids duplicate date loads and repeated retries while a request is pending', async () => {
    const pending = deferred<Response>()
    fetchMock.mockReturnValue(pending.promise)
    const client = createDailyPickClient(fetchMock)
    client.load(date)
    client.load(date)
    client.retry()
    client.retry()
    expect(fetchMock).toHaveBeenCalledOnce()
    pending.resolve(Response.json(dailyPickFixture))
    await settle()
    client.load(date)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('clears the previous album immediately on a local date change, including a new-day 404', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(dailyPickFixture))
    const pending = deferred<Response>()
    fetchMock.mockReturnValueOnce(pending.promise)
    const client = createDailyPickClient(fetchMock)
    client.load(date)
    await settle()
    expect(client.getSnapshot().status).toBe('success')

    client.load('2026-10-26')
    expect(client.getSnapshot()).toEqual({ status: 'loading', date: '2026-10-26' })
    pending.resolve(new Response(null, { status: 404 }))
    await settle()
    expect(client.getSnapshot()).toEqual({ status: 'not-found', date: '2026-10-26' })
  })

  it.each(['resolve', 'reject'] as const)(
    'ignores an old response that %ss after the newer date has loaded',
    async (completion) => {
      const pending = deferred<Response>()
      fetchMock.mockReturnValueOnce(pending.promise)
      const nextPick = { ...dailyPickFixture, pickDate: '2026-10-26' }
      fetchMock.mockResolvedValueOnce(Response.json(nextPick))
      const client = createDailyPickClient(fetchMock)
      client.load(date)
      const oldSignal = fetchMock.mock.calls[0][1]?.signal
      client.load('2026-10-26')
      expect(oldSignal?.aborted).toBe(true)
      await settle()

      if (completion === 'resolve') pending.resolve(Response.json(dailyPickFixture))
      else pending.reject(new Error('old request failed'))
      await settle()
      expect(client.getSnapshot()).toEqual({ status: 'success', date: '2026-10-26', pick: nextPick })
    },
  )

  it('ignores stale JSON parsing completion after the selected date changes', async () => {
    const parsing = deferred<unknown>()
    const oldResponse = new Response(null, { status: 200 })
    vi.spyOn(oldResponse, 'json').mockReturnValue(parsing.promise)
    fetchMock.mockResolvedValueOnce(oldResponse)
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }))
    const client = createDailyPickClient(fetchMock)
    client.load(date)
    await settle()
    client.load('2026-10-26')
    await settle()
    parsing.resolve(dailyPickFixture)
    await settle()
    expect(client.getSnapshot()).toEqual({ status: 'error', date: '2026-10-26' })
  })

  it('cancels pending requests, removes subscribers, and supports effect setup replay', async () => {
    const pending = deferred<Response>()
    fetchMock.mockReturnValueOnce(pending.promise)
    fetchMock.mockResolvedValueOnce(Response.json(dailyPickFixture))
    const client = createDailyPickClient(fetchMock)
    const listener = vi.fn()
    const unsubscribe = client.subscribe(listener)
    client.load(date)
    unsubscribe()
    client.cancel()
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true)

    client.load(date)
    await settle()
    pending.resolve(Response.json(dailyPickFixture))
    await settle()
    expect(listener).toHaveBeenCalledOnce()
    expect(client.getSnapshot()).toEqual({ status: 'success', date, pick: dailyPickFixture })
  })
})
