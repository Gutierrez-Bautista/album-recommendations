import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  AlbumNotFoundError,
  TagsNotFoundError,
} from '@/lib/catalog/errors'

const {
  requireAdminMock,
  updateAlbumMock
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  updateAlbumMock: vi.fn(),
}))

vi.mock('@/lib/auth-guards', () => ({
  requireAdmin: requireAdminMock,
}))

vi.mock('@/lib/catalog/update-album', () => ({
  updateAlbum: updateAlbumMock,
}))

import {
  updateAlbumAction,
  type UpdateAlbumState,
} from './actions'

const ALBUM_DATABASE_ID =
  '550e8400-e29b-41d4-a716-446655440000'

const FIRST_TAG_ID =
  '3d813cbb-47fb-4cfe-b7c6-3b466b873f20'

const SECOND_TAG_ID =
  '21d1ec88-21bb-42e9-a1e3-3c0f8ea3e2e1'

const initialUpdateState: UpdateAlbumState = {
  status: 'idle',
}

function createUpdateFormData({
  albumId = ALBUM_DATABASE_ID,
  releaseKind = 'album',
  tagIds = [],
}: {
  albumId?: string
  releaseKind?: string
  tagIds?: string[]
} = {}): FormData {
  const formData = new FormData()

  formData.set('albumId', albumId)
  formData.set('releaseKind', releaseKind)

  for (const tagId of tagIds) {
    formData.append('tagIds', tagId)
  }

  return formData
}

beforeEach(() => {
  vi.resetAllMocks()

  requireAdminMock.mockResolvedValue({
    user: {
      id: 'admin-id',
      role: 'admin',
    },
  })

  updateAlbumMock.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('updateAlbumAction', () => {
  it('returns validation errors before updating the album', async () => {
    const result = await updateAlbumAction(
      initialUpdateState,
      createUpdateFormData({
        albumId: 'invalid-album-id',
        releaseKind: 'mixtape',
        tagIds: ['invalid-tag-id'],
      }),
    )

    expect(requireAdminMock).toHaveBeenCalledOnce()

    expect(result).toMatchObject({
      status: 'validation-error',
      fieldErrors: {
        albumId: expect.any(Array),
        releaseKind: expect.any(Array),
        tagIds: expect.any(Array),
      },
    })

    expect(updateAlbumMock).not.toHaveBeenCalled()
  })

  it('updates an album with the validated form data', async () => {
    const result = await updateAlbumAction(
      initialUpdateState,
      createUpdateFormData({
        releaseKind: 'ep',
        tagIds: [
          FIRST_TAG_ID,
          SECOND_TAG_ID,
        ],
      }),
    )

    expect(requireAdminMock).toHaveBeenCalledOnce()

    expect(updateAlbumMock).toHaveBeenCalledOnce()
    expect(updateAlbumMock).toHaveBeenCalledWith({
      albumId: ALBUM_DATABASE_ID,
      releaseKind: 'ep',
      tagIds: [
        FIRST_TAG_ID,
        SECOND_TAG_ID,
      ],
    })

    expect(result).toEqual({
      status: 'success',
      message: 'Album updated successfully.',
    })
  })

  it('allows removing all album tags', async () => {
    await updateAlbumAction(
      initialUpdateState,
      createUpdateFormData({
        tagIds: [],
      }),
    )

    expect(updateAlbumMock).toHaveBeenCalledWith({
      albumId: ALBUM_DATABASE_ID,
      releaseKind: 'album',
      tagIds: [],
    })
  })

  it.each([
    {
      name: 'a missing album',
      error: new AlbumNotFoundError(
        ALBUM_DATABASE_ID,
      ),
      expectedMessage:
        'Album not found. Please reload the page.',
    },
    {
      name: 'missing tags',
      error: new TagsNotFoundError([
        FIRST_TAG_ID,
      ]),
      expectedMessage:
        'Some selected tags were not found. Please reload the page.',
    },
  ])(
    'maps $name to a safe error',
    async ({ error, expectedMessage }) => {
      updateAlbumMock.mockRejectedValue(error)

      const result = await updateAlbumAction(
        initialUpdateState,
        createUpdateFormData({
          tagIds: [FIRST_TAG_ID],
        }),
      )

      expect(result).toEqual({
        status: 'error',
        message: expectedMessage,
      })
    },
  )

  it('logs unexpected errors and returns a generic message', async () => {
    const unexpectedError = new Error(
      'Database connection failed',
    )

    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    updateAlbumMock.mockRejectedValue(
      unexpectedError,
    )

    const result = await updateAlbumAction(
      initialUpdateState,
      createUpdateFormData(),
    )

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Unexpected album update action error',
      unexpectedError,
    )

    expect(result).toEqual({
      status: 'error',
      message:
        'An unexpected error occurred. Try again later.',
    })
  })

  it('does not update when authorization fails', async () => {
    const authorizationError = new Error('Forbidden')

    requireAdminMock.mockRejectedValueOnce(
      authorizationError,
    )

    await expect(
      updateAlbumAction(
        initialUpdateState,
        createUpdateFormData(),
      ),
    ).rejects.toBe(authorizationError)

    expect(updateAlbumMock).not.toHaveBeenCalled()
  })
})