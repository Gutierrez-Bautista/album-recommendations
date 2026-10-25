import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getCurrentSessionMock,
  hasCurrentLegalAcceptanceMock,
  cookiesMock,
  getCookieMock,
  setCookieMock,
  redirectMock,
  refreshMock,
  childRenderMock,
  fetchMock,
  legalVersions,
} = vi.hoisted(() => ({
  getCurrentSessionMock: vi.fn(),
  hasCurrentLegalAcceptanceMock: vi.fn(),
  cookiesMock: vi.fn(),
  getCookieMock: vi.fn(),
  setCookieMock: vi.fn(),
  redirectMock: vi.fn(),
  refreshMock: vi.fn(),
  childRenderMock: vi.fn(),
  fetchMock: vi.fn(),
  legalVersions: {
    terms: 'terms-current' as string | undefined,
    privacy: 'privacy-current' as string | undefined,
  },
}))

vi.mock('@/lib/auth-guards', () => ({
  getCurrentSession: getCurrentSessionMock,
  hasCurrentLegalAcceptance: hasCurrentLegalAcceptanceMock,
}))
vi.mock('@/lib/legal', () => ({
  get CURRENT_TERMS_VERSION() { return legalVersions.terms },
  get CURRENT_PRIVACY_VERSION() { return legalVersions.privacy },
}))
vi.mock('next/headers', () => ({ cookies: cookiesMock }))
vi.mock('next/navigation', () => ({ redirect: redirectMock }))
vi.mock('next/cache', () => ({ refresh: refreshMock }))
vi.mock('./_components/guests-terms-modal', () => ({
  default: () => createElement('section', { 'aria-label': 'Guest legal acceptance' }, 'Accept terms first'),
}))

import PublicLayout from './layout'
import { setGuestLegalAcceptanceCookie } from './actions'

const currentAcceptance = {
  termsVersion: 'terms-current',
  privacyVersion: 'privacy-current',
}
const signedInSession = { user: { id: 'signed-in-user' } }

function RecommendationSentinel() {
  childRenderMock()
  // Simulate the child starting its recommendation request, using a mocked transport.
  void fetch('/api/daily-pick?date=2026-10-25')
  return createElement('div', {}, 'Private recommendation subtree')
}

async function renderLayout() {
  const children = createElement(RecommendationSentinel)
  const result = await PublicLayout({ children, params: Promise.resolve({}) })
  return renderToStaticMarkup(result)
}

function expectGuestGate(markup: string) {
  expect(markup).toContain('Guest legal acceptance')
  expect(markup).not.toContain('Private recommendation subtree')
  expect(childRenderMock).not.toHaveBeenCalled()
  expect(fetchMock).not.toHaveBeenCalled()
  expect(hasCurrentLegalAcceptanceMock).not.toHaveBeenCalled()
  expect(redirectMock).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.resetAllMocks()
  legalVersions.terms = currentAcceptance.termsVersion
  legalVersions.privacy = currentAcceptance.privacyVersion
  getCurrentSessionMock.mockResolvedValue(null)
  hasCurrentLegalAcceptanceMock.mockResolvedValue(false)
  cookiesMock.mockResolvedValue({ get: getCookieMock, set: setCookieMock })
  getCookieMock.mockReturnValue(undefined)
  redirectMock.mockImplementation((destination: string) => {
    throw new Error(`Redirected to ${destination}`)
  })
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

describe('public layout legal gate', () => {
  it('returns only the legal prompt when a guest has no acceptance cookie', async () => {
    expectGuestGate(await renderLayout())
    expect(getCookieMock).toHaveBeenCalledExactlyOnceWith('legalAcceptance')
  })

  it.each([
    '', '{', 'undefined', 'null', 'true', 'false', '0', '"accepted"', '[]',
    '[{"termsVersion":"terms-current","privacyVersion":"privacy-current"}]',
    '{}',
    JSON.stringify({ termsVersion: 'terms-current' }),
    JSON.stringify({ privacyVersion: 'privacy-current' }),
    JSON.stringify({ termsVersion: 1, privacyVersion: 'privacy-current' }),
    JSON.stringify({ termsVersion: 'terms-current', privacyVersion: null }),
    JSON.stringify({ termsVersion: 'terms-old', privacyVersion: 'privacy-current' }),
    JSON.stringify({ termsVersion: 'terms-current', privacyVersion: 'privacy-old' }),
  ])('does not render or request recommendation data for invalid guest cookie %s', async (value) => {
    getCookieMock.mockReturnValue({ value })
    expectGuestGate(await renderLayout())
  })

  it.each([
    { terms: undefined, privacy: 'privacy-current' },
    { terms: 'terms-current', privacy: undefined },
    { terms: undefined, privacy: undefined },
    { terms: '', privacy: 'privacy-current' },
    { terms: 'terms-current', privacy: '' },
    { terms: '   ', privacy: 'privacy-current' },
    { terms: 'terms-current', privacy: '\t' },
  ])('fails closed for missing or blank configured versions: %j', async (versions) => {
    legalVersions.terms = versions.terms
    legalVersions.privacy = versions.privacy
    getCookieMock.mockReturnValue({ value: JSON.stringify({
      termsVersion: versions.terms,
      privacyVersion: versions.privacy,
    }) })

    expectGuestGate(await renderLayout())
  })

  it.each([
    currentAcceptance,
    { ...currentAcceptance, acceptedAt: '2026-10-25T12:00:00.000Z' },
  ])('renders children for current guest versions without requiring acceptedAt: %j', async (acceptance) => {
    getCookieMock.mockReturnValue({ value: JSON.stringify(acceptance) })

    const markup = await renderLayout()

    expect(markup).toContain('Private recommendation subtree')
    expect(markup).not.toContain('Guest legal acceptance')
    expect(childRenderMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/daily-pick?date=2026-10-25')
    expect(hasCurrentLegalAcceptanceMock).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('re-evaluates the guest cookie and renders children after acceptance in a later render', async () => {
    expectGuestGate(await renderLayout())
    getCookieMock.mockReturnValue({ value: JSON.stringify(currentAcceptance) })

    expect(await renderLayout()).toContain('Private recommendation subtree')
    expect(childRenderMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('allows the next layout render after the guest acceptance action writes its cookie', async () => {
    setCookieMock.mockImplementation((name: string, value: string) => {
      if (name === 'legalAcceptance') getCookieMock.mockReturnValue({ value })
    })
    expectGuestGate(await renderLayout())

    await setGuestLegalAcceptanceCookie()

    expect(setCookieMock).toHaveBeenCalledOnce()
    expect(refreshMock).toHaveBeenCalledOnce()
    expect(await renderLayout()).toContain('Private recommendation subtree')
    expect(childRenderMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it.each([undefined, '{', JSON.stringify(currentAcceptance)])(
    'uses the signed-in acceptance guard regardless of guest cookie %s',
    async (cookieValue) => {
      getCurrentSessionMock.mockResolvedValue(signedInSession)
      hasCurrentLegalAcceptanceMock.mockResolvedValue(true)
      getCookieMock.mockReturnValue(cookieValue === undefined ? undefined : { value: cookieValue })

      expect(await renderLayout()).toContain('Private recommendation subtree')
      expect(hasCurrentLegalAcceptanceMock).toHaveBeenCalledExactlyOnceWith('signed-in-user')
      expect(cookiesMock).not.toHaveBeenCalled()
      expect(getCookieMock).not.toHaveBeenCalled()
      expect(redirectMock).not.toHaveBeenCalled()
      expect(childRenderMock).toHaveBeenCalledOnce()
    },
  )

  it('redirects a signed-in user without current acceptance even with a valid guest cookie', async () => {
    getCurrentSessionMock.mockResolvedValue(signedInSession)
    getCookieMock.mockReturnValue({ value: JSON.stringify(currentAcceptance) })

    await expect(renderLayout()).rejects.toThrow('Redirected to /legal')

    expect(hasCurrentLegalAcceptanceMock).toHaveBeenCalledExactlyOnceWith('signed-in-user')
    expect(redirectMock).toHaveBeenCalledExactlyOnceWith('/legal')
    expect(cookiesMock).not.toHaveBeenCalled()
    expect(childRenderMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not render children if the signed-in legal acceptance check fails', async () => {
    getCurrentSessionMock.mockResolvedValue(signedInSession)
    hasCurrentLegalAcceptanceMock.mockRejectedValue(new Error('Simulated legal read failure'))

    await expect(renderLayout()).rejects.toThrow('Simulated legal read failure')

    expect(childRenderMock).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(cookiesMock).not.toHaveBeenCalled()
  })
})
