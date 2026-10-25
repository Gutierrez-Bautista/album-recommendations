import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth-client', () => ({
  authClient: { signOut: vi.fn(), deleteUser: vi.fn() },
}))

import { AccountMenu } from './account-menu'

describe('AccountMenu server render', () => {
  it.each([null, '', '   ', 'https://example.test/profile.jpg'])(
    'provides an accessible trigger and fallback before loading image %s',
    (image) => {
      const markup = renderToStaticMarkup(createElement(AccountMenu, { image }))

      expect(markup).toContain('type="button"')
      expect(markup).toContain('aria-label="Account menu"')
      expect(markup).toContain('aria-haspopup="menu"')
      expect(markup).toContain('aria-expanded="false"')
      expect(markup).toContain('focus-visible:outline-2')
      expect(markup).toContain('<svg aria-hidden="true"')
      expect(markup).not.toContain('Sign out')
      expect(markup).not.toContain('Delete account')
      expect(markup).not.toContain('Sign in')
    },
  )
})
