import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  albums,
  albumTags,
  tags,
} from '@/src/db/schema'
import {
  AlbumNotFoundError,
  TagsNotFoundError,
} from './errors'

const {
  transactionMock,
  updateMock,
  updateSetMock,
  updateWhereMock,
  updateReturningMock,
  selectMock,
  selectFromMock,
  selectWhereMock,
  deleteMock,
  deleteWhereMock,
  insertMock,
  insertValuesMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  updateMock: vi.fn(),
  updateSetMock: vi.fn(),
  updateWhereMock: vi.fn(),
  updateReturningMock: vi.fn(),
  selectMock: vi.fn(),
  selectFromMock: vi.fn(),
  selectWhereMock: vi.fn(),
  deleteMock: vi.fn(),
  deleteWhereMock: vi.fn(),
  insertMock: vi.fn(),
  insertValuesMock: vi.fn(),
}))

vi.mock('@/src/db', () => ({
  default: {
    transaction: transactionMock,
  },
}))

import { updateAlbum } from './update-album'

const ALBUM_ID = 'album-database-id'
const FIRST_TAG_ID = 'first-tag-id'
const SECOND_TAG_ID = 'second-tag-id'

const persistedAlbum = {
  id: ALBUM_ID,
  releaseKind: 'ep',
}

describe('updateAlbum', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    updateReturningMock.mockResolvedValue([
      persistedAlbum,
    ])
    updateWhereMock.mockReturnValue({
      returning: updateReturningMock,
    })
    updateSetMock.mockReturnValue({
      where: updateWhereMock,
    })
    updateMock.mockReturnValue({
      set: updateSetMock,
    })

    selectWhereMock.mockResolvedValue([
      { id: FIRST_TAG_ID },
      { id: SECOND_TAG_ID },
    ])
    selectFromMock.mockReturnValue({
      where: selectWhereMock,
    })
    selectMock.mockReturnValue({
      from: selectFromMock,
    })

    deleteWhereMock.mockResolvedValue(undefined)
    deleteMock.mockReturnValue({
      where: deleteWhereMock,
    })

    insertValuesMock.mockResolvedValue(undefined)
    insertMock.mockReturnValue({
      values: insertValuesMock,
    })

    const transaction = {
      update: updateMock,
      select: selectMock,
      delete: deleteMock,
      insert: insertMock,
    }

    transactionMock.mockImplementation(
      async (
        callback: (
          trans: typeof transaction,
        ) => Promise<unknown>,
      ) => callback(transaction),
    )
  })

  it('updates the release kind and replaces the album tags', async () => {
    await expect(
      updateAlbum({
        albumId: ALBUM_ID,
        releaseKind: 'ep',
        tagIds: [
          FIRST_TAG_ID,
          SECOND_TAG_ID,
          FIRST_TAG_ID,
        ],
      }),
    ).resolves.toEqual(persistedAlbum)

    expect(transactionMock).toHaveBeenCalledOnce()

    expect(updateMock).toHaveBeenCalledWith(albums)
    expect(updateSetMock).toHaveBeenCalledWith({
      releaseKind: 'ep',
    })
    expect(updateWhereMock).toHaveBeenCalledOnce()
    expect(updateReturningMock).toHaveBeenCalledOnce()

    expect(selectMock).toHaveBeenCalledWith({
      id: tags.id,
    })
    expect(selectFromMock).toHaveBeenCalledWith(tags)
    expect(selectWhereMock).toHaveBeenCalledOnce()

    expect(deleteMock).toHaveBeenCalledWith(albumTags)
    expect(deleteWhereMock).toHaveBeenCalledOnce()

    expect(insertMock).toHaveBeenCalledWith(albumTags)
    expect(insertValuesMock).toHaveBeenCalledWith([
      {
        albumId: ALBUM_ID,
        tagId: FIRST_TAG_ID,
        source: 'manual',
      },
      {
        albumId: ALBUM_ID,
        tagId: SECOND_TAG_ID,
        source: 'manual',
      },
    ])
  })

  it('removes all tags when tagIds is empty', async () => {
    await updateAlbum({
      albumId: ALBUM_ID,
      releaseKind: 'album',
      tagIds: [],
    })

    expect(selectMock).not.toHaveBeenCalled()

    expect(deleteMock).toHaveBeenCalledWith(albumTags)
    expect(deleteWhereMock).toHaveBeenCalledOnce()

    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rejects an album that does not exist', async () => {
    updateReturningMock.mockResolvedValue([])

    const request = updateAlbum({
      albumId: ALBUM_ID,
      releaseKind: 'album',
      tagIds: [FIRST_TAG_ID],
    })

    await expect(request).rejects.toBeInstanceOf(
      AlbumNotFoundError,
    )
    await expect(request).rejects.toMatchObject({
      albumId: ALBUM_ID,
    })

    expect(selectMock).not.toHaveBeenCalled()
    expect(deleteMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rejects tags that do not exist', async () => {
    selectWhereMock.mockResolvedValue([
      { id: FIRST_TAG_ID },
    ])

    const request = updateAlbum({
      albumId: ALBUM_ID,
      releaseKind: 'album',
      tagIds: [
        FIRST_TAG_ID,
        SECOND_TAG_ID,
      ],
    })

    await expect(request).rejects.toBeInstanceOf(
      TagsNotFoundError,
    )
    await expect(request).rejects.toMatchObject({
      tagIds: [SECOND_TAG_ID],
    })

    expect(deleteMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('waits for old tag relations to be deleted before inserting new ones', async () => {
    let resolveDeletion!: () => void

    deleteWhereMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDeletion = resolve
      }),
    )

    const request = updateAlbum({
      albumId: ALBUM_ID,
      releaseKind: 'album',
      tagIds: [FIRST_TAG_ID],
    })

    await vi.waitFor(() => {
      expect(deleteWhereMock).toHaveBeenCalledOnce()
    })

    expect(insertMock).not.toHaveBeenCalled()

    resolveDeletion()

    await expect(request).resolves.toEqual(
      persistedAlbum,
    )

    expect(insertMock).toHaveBeenCalledWith(albumTags)
  })
})