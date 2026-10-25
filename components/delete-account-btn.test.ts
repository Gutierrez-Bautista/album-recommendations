import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { deleteUserMock, setPendingMock, setErrorMock } = vi.hoisted(() => ({
  deleteUserMock: vi.fn(),
  setPendingMock: vi.fn(),
  setErrorMock: vi.fn(),
}))

vi.mock('@/lib/auth-client', () => ({ authClient: { deleteUser: deleteUserMock } }))
vi.mock('react', async (importOriginal: () => Promise<typeof import('react')>) => {
  const actual = await importOriginal()
  return {
    ...actual,
    // Capture state transitions without a DOM renderer; useRef remains real.
    useState: (initial: unknown) => [initial, initial === false ? setPendingMock : setErrorMock],
  }
})

import { DeleteAccountBtn, useDeleteAccount } from './delete-account-btn'

function captureHook() {
  const captured: { current?: ReturnType<typeof useDeleteAccount> } = {}
  function Harness() {
    captured.current = useDeleteAccount()
    return null
  }
  renderToStaticMarkup(createElement(Harness))
  if (!captured.current) throw new Error('Account deletion hook was not rendered')
  return captured.current
}

const confirmMock = vi.fn()
const alertMock = vi.fn()
const replaceMock = vi.fn()

beforeEach(() => {
  deleteUserMock.mockReset().mockResolvedValue({ data: {}, error: null })
  confirmMock.mockReset().mockReturnValue(true)
  vi.stubGlobal('window', {
    confirm: confirmMock,
    alert: alertMock,
    location: { replace: replaceMock },
  })
})

describe('useDeleteAccount', () => {
  it('preserves confirmation, Spotify notice, auth call, and redirect', async () => {
    const hook = captureHook()
    expect(hook.pending).toBe(false)
    expect(hook.error).toBeNull()
    await hook.deleteAccount()

    expect(confirmMock).toHaveBeenCalledExactlyOnceWith(
      'this will delete your account, library, and Spotify connection. It cannot be undone. Are you sure you want to continue?',
    )
    expect(alertMock).toHaveBeenCalledExactlyOnceWith(
      'After deleting your account, you will be redirected to the main page. You will also need to remove access from Spotify at https://www.spotify.com/account/apps/',
    )
    expect(alertMock.mock.invocationCallOrder[0]).toBeLessThan(deleteUserMock.mock.invocationCallOrder[0])
    expect(deleteUserMock).toHaveBeenCalledExactlyOnceWith({ callbackURL: '/login?accountDeleted=1' })
    expect(setPendingMock).toHaveBeenCalledWith(true)
    expect(setErrorMock).toHaveBeenCalledWith(null)
    expect(replaceMock).toHaveBeenCalledExactlyOnceWith('/login?accountDeleted=1')
  })

  it('cancels without alert, state changes, deletion, or navigation', async () => {
    confirmMock.mockReturnValueOnce(false)
    await captureHook().deleteAccount()

    expect(alertMock).not.toHaveBeenCalled()
    expect(setPendingMock).not.toHaveBeenCalled()
    expect(setErrorMock).not.toHaveBeenCalled()
    expect(deleteUserMock).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('ignores duplicate actions while deleting, including duplicate prompts', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined
    deleteUserMock.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve }))
    const hook = captureHook()
    const request = hook.deleteAccount()
    await hook.deleteAccount()

    expect(deleteUserMock).toHaveBeenCalledTimes(1)
    expect(confirmMock).toHaveBeenCalledTimes(1)
    expect(alertMock).toHaveBeenCalledTimes(1)
    resolveRequest({ data: {}, error: null })
    await request
  })

  it('explains SESSION_NOT_FRESH in English and permits retry', async () => {
    deleteUserMock.mockResolvedValueOnce({ data: null, error: { code: 'SESSION_NOT_FRESH' } })
    const hook = captureHook()
    await hook.deleteAccount()

    expect(setErrorMock).toHaveBeenLastCalledWith('For your security, sign in again before deleting your account.')
    expect(setPendingMock).toHaveBeenLastCalledWith(false)
    expect(replaceMock).not.toHaveBeenCalled()

    await hook.deleteAccount()
    expect(deleteUserMock).toHaveBeenCalledTimes(2)
    expect(replaceMock).toHaveBeenCalledWith('/login?accountDeleted=1')
  })

  it('sanitizes other server errors and restores the action after failure', async () => {
    deleteUserMock.mockResolvedValueOnce({ data: null, error: { code: 'UNKNOWN', message: 'private detail' } })
    await captureHook().deleteAccount()

    expect(setErrorMock).toHaveBeenLastCalledWith('Unable to delete your account. Please try again.')
    expect(setPendingMock).toHaveBeenLastCalledWith(false)
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('sanitizes a rejected deletion request and resets pending', async () => {
    deleteUserMock.mockRejectedValueOnce(new Error('private network detail'))
    await captureHook().deleteAccount()

    expect(setErrorMock).toHaveBeenLastCalledWith('Unable to delete your account. Please try again.')
    expect(setPendingMock).toHaveBeenLastCalledWith(false)
    expect(replaceMock).not.toHaveBeenCalled()
  })
})

describe('DeleteAccountBtn', () => {
  it('preserves the standalone button and keeps it within small containers', () => {
    const markup = renderToStaticMarkup(createElement(DeleteAccountBtn))
    expect(markup).toContain('type="button"')
    expect(markup).toContain('Delete account')
    expect(markup).toContain('max-w-full')
    expect(markup).toContain('focus-visible:outline-2')
    expect(deleteUserMock).not.toHaveBeenCalled()
  })
})
