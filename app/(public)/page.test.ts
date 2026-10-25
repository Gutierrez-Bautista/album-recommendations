import { Children, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sessionMock } = vi.hoisted(() => ({ sessionMock: vi.fn() }))
vi.mock('@/lib/auth-guards', () => ({ getCurrentSession: sessionMock }))
vi.mock('@/lib/auth-client', () => ({
  authClient: { signOut: vi.fn(), deleteUser: vi.fn() },
}))

import Home from './page'
import { DailyPick } from './_components/daily-pick'

const privateSession = {
  session: { id: 'private-session-id', token: 'private-session-token' },
  user: {
    id: 'private-user-id',
    name: 'Private User Name',
    email: 'private-user@example.test',
    image: 'https://example.test/avatar.jpg',
  },
}

function expectRecommendationHeader(markup: string) {
  expect(markup).toContain('Today&#x27;s Album')
  expect(markup).toContain('Next album in')
  expect(markup).toContain('--:--:--')
  expect(markup).not.toContain('<footer')
  expect(markup).not.toContain('Your account')
  expect(markup).not.toContain('Daily Album')
}

function dailyPickProps(page: Awaited<ReturnType<typeof Home>>) {
  const children = Children.toArray(page.props.children)
  expect(children).toHaveLength(1)
  const pick = children[0]
  if (!isValidElement<{ account?: { image: string | null } | null }>(pick)) {
    throw new Error('Expected the home page to contain the recommendation')
  }
  expect(pick.type).toBe(DailyPick)
  return pick.props
}

beforeEach(() => sessionMock.mockReset())

describe('public home', () => {
  it('provides the daily recommendation and sign in to guests', async () => {
    sessionMock.mockResolvedValue(null)
    const page = await Home()
    const markup = renderToStaticMarkup(page)
    expectRecommendationHeader(markup)
    expect(markup).toContain('href="/login"')
    expect(markup).toContain('Sign in')
    expect(markup).not.toContain('Account menu')
    expect(dailyPickProps(page)).toEqual({ account: null })
  })

  it.each([privateSession.user.image, null, undefined])(
    'passes only the avatar and keeps the authenticated account menu for image %s',
    async (image) => {
      sessionMock.mockResolvedValue({
        ...privateSession,
        user: { ...privateSession.user, image },
      })
      const page = await Home()
      const markup = renderToStaticMarkup(page)

      expectRecommendationHeader(markup)
      expect(markup).toContain('Account menu')
      expect(markup).not.toContain('href="/login"')
      expect(markup).not.toContain('Sign in')
      expect(dailyPickProps(page)).toEqual({ account: { image: image ?? null } })
      for (const privateValue of [
        privateSession.session.id,
        privateSession.session.token,
        privateSession.user.id,
        privateSession.user.name,
        privateSession.user.email,
      ]) {
        expect(markup).not.toContain(privateValue)
        expect(JSON.stringify(dailyPickProps(page))).not.toContain(privateValue)
      }
    },
  )
})
