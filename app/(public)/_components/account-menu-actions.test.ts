import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type ItemProps = {
  children: ReactNode,
  disabled?: boolean,
  className?: string,
  onSelect: (event: { preventDefault: () => void }) => void,
}

const { ui, signOut, deletion, itemMock, imageMock, contentMock } = vi.hoisted(() => ({
  ui: { open: true, action: null as 'sign-out' | 'delete-account' | null },
  signOut: { signOut: vi.fn(), pending: false, error: null as string | null },
  deletion: { deleteAccount: vi.fn(), pending: false, error: null as string | null },
  itemMock: vi.fn(),
  imageMock: vi.fn(),
  contentMock: vi.fn(),
}))

vi.mock('@/components/logout-btn', () => ({ useSignOut: () => signOut }))
vi.mock('@/components/delete-account-btn', () => ({ useDeleteAccount: () => deletion }))
vi.mock('react', async (importOriginal: () => Promise<typeof import('react')>) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useState: (initial: unknown) => initial === false
      ? [ui.open, (open: boolean) => { ui.open = open }]
      : [ui.action, (action: typeof ui.action) => { ui.action = action }],
  }
})

// Mock Radix's DOM/portal boundary to inspect application wiring in the Node runner.
// Keyboard navigation and image load/failure remain browser checks of Radix itself.
vi.mock('radix-ui/dropdown-menu', () => ({
  Root: ({ children }: { children: ReactNode }) => children,
  Trigger: ({ children }: { children: ReactNode }) => children,
  Portal: ({ children }: { children: ReactNode }) => ui.open ? children : null,
  Content: contentMock,
  Item: itemMock,
  Separator: () => createElement('hr'),
}))
vi.mock('radix-ui/avatar', () => ({
  Root: ({ children }: { children: ReactNode }) => children,
  Image: imageMock,
  Fallback: ({ children }: { children: ReactNode }) => children,
}))

import { AccountMenu } from './account-menu'

function renderMenu(image: string | null = null) {
  return renderToStaticMarkup(createElement(AccountMenu, { image }))
}

function items(): ItemProps[] {
  return itemMock.mock.calls.map(([props]) => props)
}

beforeEach(() => {
  ui.open = true
  ui.action = null
  signOut.pending = false
  signOut.error = null
  deletion.pending = false
  deletion.error = null
  imageMock.mockImplementation(() => null)
  contentMock.mockImplementation(({ children, className }: { children: ReactNode, className: string }) =>
    createElement('div', { role: 'menu', className }, children),
  )
  itemMock.mockImplementation(({ children, disabled, className }: ItemProps) =>
    createElement('button', { type: 'button', role: 'menuitem', disabled, className }, children),
  )
})

describe('AccountMenu action wiring', () => {
  it('renders only the two existing actions, with deletion last and separated', () => {
    const markup = renderMenu()
    expect(items().map(({ children }) => children)).toEqual(['Sign out', 'Delete account'])
    expect(markup).toMatch(/Sign out<\/button><hr\/><button[^>]*>Delete account/)
    expect(items()[1].className).toContain('text-(--danger)')
    expect(items().every(({ className }) => className?.includes('focus-visible:ring-2'))).toBe(true)
    expect(contentMock.mock.calls[0][0]).toMatchObject({ align: 'end', collisionPadding: 12 })
    expect(markup).toContain('max-w-[calc(100vw-1.5rem)]')
  })

  it.each(['sign-out', 'delete-account'] as const)('keeps the menu open while selecting %s and invokes its existing action', (action) => {
    renderMenu()
    const preventDefault = vi.fn()
    items()[action === 'sign-out' ? 0 : 1].onSelect({ preventDefault })
    const run = action === 'sign-out' ? signOut.signOut : deletion.deleteAccount

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(run).toHaveBeenCalledOnce()
    expect(preventDefault.mock.invocationCallOrder[0]).toBeLessThan(run.mock.invocationCallOrder[0])
    expect(ui.action).toBe(action)
  })

  it.each(['sign-out', 'delete-account'] as const)('disables both actions while %s is pending', (action) => {
    if (action === 'sign-out') signOut.pending = true
    else deletion.pending = true
    const markup = renderMenu()
    expect(items().every(({ disabled }) => disabled)).toBe(true)
    expect(markup).toContain(action === 'sign-out' ? 'Signing out…' : 'Deleting account…')
  })

  it.each(['sign-out', 'delete-account'] as const)('keeps a %s error visible after the menu closes', (action) => {
    ui.action = action
    if (action === 'sign-out') signOut.error = 'Unable to sign out. Please try again.'
    else deletion.error = 'Unable to delete your account. Please try again.'
    const expectedError = action === 'sign-out' ? signOut.error : deletion.error

    expect(renderMenu()).toContain(`role="alert"`)
    expect(renderMenu()).toContain(expectedError)
    ui.open = false
    const closedMarkup = renderMenu()
    expect(closedMarkup).not.toContain('role="menu"')
    expect(closedMarkup).toContain('role="alert"')
    expect(closedMarkup).toContain(expectedError)
  })

  it('shows the latest selected action error rather than masking it with a previous failure', () => {
    signOut.error = 'Previous sign-out failure'
    deletion.error = 'Latest deletion failure'
    ui.action = 'delete-account'
    const markup = renderMenu()
    expect(markup).toContain('Latest deletion failure')
    expect(markup).not.toContain('Previous sign-out failure')
  })

  it('keeps pending feedback visible if the user dismisses the menu', () => {
    ui.open = false
    deletion.pending = true
    const markup = renderMenu()
    expect(markup).toContain('role="status"')
    expect(markup).toContain('Deleting account…')
    expect(markup).not.toContain('role="menu"')
  })

  it.each([
    ['https://example.test/profile.jpg', 'https://example.test/profile.jpg'],
    ['  https://example.test/profile.jpg  ', 'https://example.test/profile.jpg'],
    ['', undefined],
    ['   ', undefined],
    [null, undefined],
  ])('passes only a usable profile source to Radix Avatar (%s)', (image, expectedSource) => {
    renderMenu(image)
    expect(imageMock.mock.calls[0][0]).toMatchObject({
      src: expectedSource, alt: '', referrerPolicy: 'no-referrer',
    })
  })
})
