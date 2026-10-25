import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { cookiesMock, setCookieMock, refreshMock, legalVersions } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  setCookieMock: vi.fn(),
  refreshMock: vi.fn(),
  legalVersions: {
    terms: 'terms-v2' as string | undefined,
    privacy: 'privacy-v3' as string | undefined,
  },
}))

vi.mock('next/headers', () => ({ cookies: cookiesMock }))
vi.mock('next/cache', () => ({ refresh: refreshMock }))
vi.mock('@/lib/legal', () => ({
  get CURRENT_TERMS_VERSION() { return legalVersions.terms },
  get CURRENT_PRIVACY_VERSION() { return legalVersions.privacy },
}))

import { setGuestLegalAcceptanceCookie } from './actions'

beforeEach(() => {
  cookiesMock.mockReset().mockResolvedValue({ set: setCookieMock })
  setCookieMock.mockReset()
  refreshMock.mockReset()
  legalVersions.terms = 'terms-v2'
  legalVersions.privacy = 'privacy-v3'
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-25T15:20:30.456Z'))
})

afterEach(() => vi.useRealTimers())

describe('setGuestLegalAcceptanceCookie', () => {
  it('serializes current shared versions and a real acceptance timestamp', async () => {
    await setGuestLegalAcceptanceCookie()

    expect(cookiesMock).toHaveBeenCalledTimes(1)
    expect(setCookieMock).toHaveBeenCalledTimes(1)
    const [name, value, options] = setCookieMock.mock.calls[0]
    expect(name).toBe('legalAcceptance')
    expect(JSON.parse(value)).toEqual({
      termsVersion: 'terms-v2',
      privacyVersion: 'privacy-v3',
      acceptedAt: '2026-10-25T15:20:30.456Z',
    })
    expect(options).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(setCookieMock.mock.invocationCallOrder[0]).toBeLessThan(refreshMock.mock.invocationCallOrder[0])
  })

  it('keeps the existing secure cookie option in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await setGuestLegalAcceptanceCookie()

    expect(setCookieMock.mock.calls[0][2]).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  })

  it.each([
    { terms: undefined, privacy: 'privacy-v3' },
    { terms: 'terms-v2', privacy: undefined },
    { terms: '', privacy: 'privacy-v3' },
    { terms: 'terms-v2', privacy: '' },
    { terms: '  ', privacy: 'privacy-v3' },
    { terms: 'terms-v2', privacy: '\t' },
  ])('does not record acceptance or refresh when versions are unavailable: %j', async (versions) => {
    Object.assign(legalVersions, versions)

    await expect(setGuestLegalAcceptanceCookie()).rejects.toThrow(
      'Legal acceptance is temporarily unavailable. Please try again later.',
    )
    expect(cookiesMock).not.toHaveBeenCalled()
    expect(setCookieMock).not.toHaveBeenCalled()
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('does not refresh if the cookie store cannot be read', async () => {
    cookiesMock.mockRejectedValueOnce(new Error('Cookie store unavailable'))

    await expect(setGuestLegalAcceptanceCookie()).rejects.toThrow('Cookie store unavailable')
    expect(setCookieMock).not.toHaveBeenCalled()
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('does not refresh if writing the cookie fails', async () => {
    setCookieMock.mockImplementationOnce(() => { throw new Error('Cookie write failed') })

    await expect(setGuestLegalAcceptanceCookie()).rejects.toThrow('Cookie write failed')
    expect(refreshMock).not.toHaveBeenCalled()
  })
})
