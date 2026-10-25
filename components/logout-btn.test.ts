import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signOutMock, setPendingMock, setErrorMock } = vi.hoisted(() => ({
  signOutMock: vi.fn(),
  setPendingMock: vi.fn(),
  setErrorMock: vi.fn(),
}))

vi.mock('@/lib/auth-client', () => ({ authClient: { signOut: signOutMock } }))
vi.mock('react', async (importOriginal: () => Promise<typeof import('react')>) => {
  const actual = await importOriginal()
  return {
    ...actual,
    // Capture state transitions without a DOM renderer; useRef remains real.
    useState: (initial: unknown) => [initial, initial === false ? setPendingMock : setErrorMock],
  }
})

import LogoutButton, { useSignOut } from './logout-btn'

function captureHook() {
  const captured: { current?: ReturnType<typeof useSignOut> } = {}
  function Harness() {
    captured.current = useSignOut()
    return null
  }
  renderToStaticMarkup(createElement(Harness))
  if (!captured.current) throw new Error('Sign-out hook was not rendered')
  return captured.current
}

const replaceMock = vi.fn()

beforeEach(() => {
  signOutMock.mockReset().mockResolvedValue({ data: { url: '/login' }, error: null })
  vi.stubGlobal('window', { location: { replace: replaceMock } })
})

describe('useSignOut', () => {
  it('preserves the auth call and returned redirect', async () => {
    const hook = captureHook()
    expect(hook.pending).toBe(false)
    expect(hook.error).toBeNull()

    await hook.signOut()

    expect(signOutMock).toHaveBeenCalledExactlyOnceWith({ callbackURL: '/login' })
    expect(setPendingMock).toHaveBeenCalledWith(true)
    expect(setErrorMock).toHaveBeenCalledWith(null)
    expect(replaceMock).toHaveBeenCalledExactlyOnceWith('/login')
  })

  it('preserves the root fallback when the response has no redirect', async () => {
    signOutMock.mockResolvedValueOnce({ data: null, error: null })
    await captureHook().signOut()
    expect(replaceMock).toHaveBeenCalledExactlyOnceWith('/')
  })

  it('ignores repeated submissions before React rerenders', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined
    signOutMock.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve }))
    const hook = captureHook()
    const request = hook.signOut()
    await hook.signOut()

    expect(signOutMock).toHaveBeenCalledTimes(1)
    resolveRequest({ data: { url: '/login' }, error: null })
    await request
  })

  it('shows a sanitized error and permits retry after an error response', async () => {
    signOutMock.mockResolvedValueOnce({ data: null, error: { message: 'private server detail' } })
    const hook = captureHook()
    await hook.signOut()

    expect(setPendingMock).toHaveBeenLastCalledWith(false)
    expect(setErrorMock).toHaveBeenLastCalledWith('Unable to sign out. Please try again.')
    expect(replaceMock).not.toHaveBeenCalled()

    await hook.signOut()
    expect(signOutMock).toHaveBeenCalledTimes(2)
    expect(replaceMock).toHaveBeenCalledWith('/login')
  })

  it('handles rejected requests without exposing their details', async () => {
    signOutMock.mockRejectedValueOnce(new Error('private network detail'))
    await captureHook().signOut()

    expect(setPendingMock).toHaveBeenLastCalledWith(false)
    expect(setErrorMock).toHaveBeenLastCalledWith('Unable to sign out. Please try again.')
    expect(replaceMock).not.toHaveBeenCalled()
  })
})

describe('LogoutButton', () => {
  it('keeps a standalone button with a visible focus state', () => {
    const markup = renderToStaticMarkup(createElement(LogoutButton))
    expect(markup).toContain('type="button"')
    expect(markup).toContain('Sign out')
    expect(markup).toContain('focus-visible:outline-2')
    expect(signOutMock).not.toHaveBeenCalled()
  })
})
