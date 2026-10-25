import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { dailyPickFixture } from '@/tests/fixtures/daily-pick'
import { DailyPick, DailyPickContent } from './daily-pick'
import type { DailyPickState } from './daily-pick-client'

vi.mock('@/lib/auth-guards', () => ({ getCurrentSession: vi.fn() }))
vi.mock('@/lib/auth-client', () => ({
  authClient: { signOut: vi.fn(), deleteUser: vi.fn() },
}))

function renderContent(state: DailyPickState) {
  return renderToStaticMarkup(createElement(DailyPickContent, { state, onRetry: () => undefined }))
}

describe('DailyPick presentation states', () => {
  it('renders a deterministic loading skeleton and countdown placeholder before hydration', () => {
    const markup = renderToStaticMarkup(createElement(DailyPick))
    expect(markup).toContain('Today&#x27;s Album')
    expect(markup).toContain('Next album in')
    expect(markup).toContain('--:--:--')
    expect(markup).toContain('Loading today&#x27;s album')
    expect(markup).toContain('aspect-square')
    expect(markup).not.toContain('aria-live')
    expect(markup).not.toContain('Example Album')
    expect(markup).toContain('href="/login"')
    expect(markup).toContain('Sign in')
    expect(markup).not.toContain('Account menu')
    expect(markup).not.toContain('Your account')
    expect(markup).not.toContain('Daily Album')
    expect(markup).not.toContain('<footer')
  })

  it.each(['https://example.test/avatar.jpg', null])(
    'keeps the title and countdown beside the signed-in account menu for image %s',
    (image) => {
      const markup = renderToStaticMarkup(createElement(DailyPick, { account: { image } }))

      expect(markup).toContain('Today&#x27;s Album')
      expect(markup).toContain('Next album in')
      expect(markup).toContain('--:--:--')
      expect(markup).toContain('Account menu')
      expect(markup).not.toContain('href="/login"')
      expect(markup).not.toContain('Sign in')
      expect(markup).not.toContain('<footer')
      expect(markup).not.toContain('Your account')
      expect(markup).not.toContain('Daily Album')
      expect(markup).toContain('Loading today&#x27;s album')
    },
  )

  it.each([null, { image: null }])('keeps a single account control and countdown across header layouts (%j)', (account) => {
    const markup = renderToStaticMarkup(createElement(DailyPick, { account }))
    const header = markup.match(/<header[\s\S]*?<\/header>/)?.[0] ?? ''
    const headerClass = header.match(/^<header class="([^"]*)"/)?.[1] ?? ''

    expect(header.match(/Next album in/g)).toHaveLength(1)
    expect(header.match(/id="daily-pick-heading"/g)).toHaveLength(1)
    expect(header.match(account ? /aria-label="Account menu"/g : /href="\/login"/g)).toHaveLength(1)
    expect(header).toContain('A daily pick from our curated collection.')
    expect(header).toContain('text-2xl')
    expect(header).toContain('sm:text-3xl')
    expect(headerClass).not.toContain('min-h-')
    expect(header).not.toContain('aria-live')
  })

  it('renders a successful recommendation', () => {
    const markup = renderContent({ status: 'success', date: dailyPickFixture.pickDate, pick: dailyPickFixture })
    expect(markup).toContain('Example Album')
    expect(markup).not.toContain('Try again')
  })

  it('distinguishes a missing pick from an internal error and supplies retry', () => {
    const markup = renderContent({ status: 'not-found', date: '2026-10-25' })
    expect(markup).toContain('not available yet')
    expect(markup).toContain('role="status"')
    expect(markup).toContain('Try again')
    expect(markup).not.toContain('role="alert"')
  })

  it('renders a sanitized error with retry', () => {
    const markup = renderContent({ status: 'error', date: '2026-10-25' })
    expect(markup).toContain('role="alert"')
    expect(markup).toContain('Something went wrong')
    expect(markup).toContain('Try again')
    expect(markup).not.toContain('Example Album')
  })
})
