import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

const {
  getSessionMock,
  headersMock,
  redirectMock,
  selectMock,
  fromMock,
  whereMock,
  limitMock,
} = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  headersMock: vi.fn(),
  redirectMock: vi.fn(),
  selectMock: vi.fn(),
  fromMock: vi.fn(),
  whereMock: vi.fn(),
  limitMock: vi.fn(),
}))

vi.mock('react', () => ({
  cache: (callback: unknown) => callback,
}))

vi.mock('next/headers', () => ({
  headers: headersMock,
}))

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}))

vi.mock('@/src/db/index', () => ({
  default: {
    select: selectMock,
  },
}))

import {
  getCurrentSession,
  hasCurrentLegalAcceptance,
  requireAdmin,
  requireAppAccess,
  requireSession,
} from './auth-guards'

const adminSession = {
  session: {
    id: 'admin-session-id',
  },
  user: {
    id: 'admin-id',
    role: 'admin',
  },
}

const userSession = {
  session: {
    id: 'user-session-id',
  },
  user: {
    id: 'user-id',
    role: 'user',
  },
}

let requestHeaders: Headers

function mockLegalAcceptance(userId: string): void {
  limitMock.mockResolvedValue([
    {
      userId,
    },
  ])
}

beforeEach(() => {
  vi.resetAllMocks()

  requestHeaders = new Headers({
    cookie: 'session=test-session',
  })

  headersMock.mockResolvedValue(requestHeaders)

  selectMock.mockReturnValue({
    from: fromMock,
  })

  fromMock.mockReturnValue({
    where: whereMock,
  })

  whereMock.mockReturnValue({
    limit: limitMock,
  })

  limitMock.mockResolvedValue([])

  redirectMock.mockImplementation(
    (destination: string) => {
      throw new Error(`Redirected to ${destination}`)
    },
  )
})

describe('getCurrentSession', () => {
  it('gets the current session using the request headers', async () => {
    getSessionMock.mockResolvedValue(userSession)

    await expect(getCurrentSession()).resolves.toBe(
      userSession,
    )

    expect(headersMock).toHaveBeenCalledOnce()

    expect(getSessionMock).toHaveBeenCalledWith({
      headers: requestHeaders,
    })
  })
})

describe('requireSession', () => {
  it('returns an authenticated session', async () => {
    getSessionMock.mockResolvedValue(userSession)

    await expect(requireSession()).resolves.toBe(
      userSession,
    )

    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('redirects unauthenticated users to login', async () => {
    getSessionMock.mockResolvedValue(null)

    await expect(requireSession()).rejects.toThrow(
      'Redirected to /login',
    )

    expect(redirectMock).toHaveBeenCalledWith('/login')
  })
})

describe('hasCurrentLegalAcceptance', () => {
  it('returns true when a current acceptance exists', async () => {
    mockLegalAcceptance('user-id')

    await expect(
      hasCurrentLegalAcceptance('user-id'),
    ).resolves.toBe(true)

    expect(selectMock).toHaveBeenCalledOnce()
    expect(fromMock).toHaveBeenCalledOnce()
    expect(whereMock).toHaveBeenCalledOnce()
    expect(limitMock).toHaveBeenCalledWith(1)
  })

  it('returns false when no current acceptance exists', async () => {
    limitMock.mockResolvedValue([])

    await expect(
      hasCurrentLegalAcceptance('user-id'),
    ).resolves.toBe(false)
  })
})

describe('requireAppAccess', () => {
  it('returns the session when legal acceptance is current', async () => {
    getSessionMock.mockResolvedValue(userSession)
    mockLegalAcceptance('user-id')

    await expect(requireAppAccess()).resolves.toBe(
      userSession,
    )

    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('redirects to legal acceptance when it is missing', async () => {
    getSessionMock.mockResolvedValue(userSession)
    limitMock.mockResolvedValue([])

    await expect(requireAppAccess()).rejects.toThrow(
      'Redirected to /legal',
    )

    expect(redirectMock).toHaveBeenCalledWith('/legal')
  })
})

describe('requireAdmin', () => {
  it('returns the session for an administrator', async () => {
    getSessionMock.mockResolvedValue(adminSession)
    mockLegalAcceptance('admin-id')

    await expect(requireAdmin()).resolves.toBe(
      adminSession,
    )

    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('redirects authenticated non-admin users', async () => {
    getSessionMock.mockResolvedValue(userSession)
    mockLegalAcceptance('user-id')

    await expect(requireAdmin()).rejects.toThrow(
      'Redirected to /',
    )

    expect(redirectMock).toHaveBeenCalledWith('/')
  })
})