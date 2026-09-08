import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  albums,
  albumArtists,
  albumTags,
  artists,
  tagCategories,
  tags,
} from '@/src/db/schema'
import {
  AlbumNotFoundError,
  CatalogAlbumHasNoArtistsError,
} from '../errors'

const {
  selectMock,

  albumFromMock,
  albumWhereMock,

  artistFromMock,
  artistInnerJoinMock,
  artistWhereMock,
  artistOrderByMock,

  tagFromMock,
  tagAlbumInnerJoinMock,
  tagCategoryInnerJoinMock,
  tagWhereMock,
  tagOrderByMock,
} = vi.hoisted(() => ({
  selectMock: vi.fn(),

  albumFromMock: vi.fn(),
  albumWhereMock: vi.fn(),

  artistFromMock: vi.fn(),
  artistInnerJoinMock: vi.fn(),
  artistWhereMock: vi.fn(),
  artistOrderByMock: vi.fn(),

  tagFromMock: vi.fn(),
  tagAlbumInnerJoinMock: vi.fn(),
  tagCategoryInnerJoinMock: vi.fn(),
  tagWhereMock: vi.fn(),
  tagOrderByMock: vi.fn(),
}))

vi.mock('@/src/db', () => ({
  default: {
    select: selectMock,
  },
}))

import { getAlbumById } from './albums'

const ALBUM_ID = 'album-database-id'

const persistedAlbum = {
  id: ALBUM_ID,
  spotifyId: 'spotify-album-id',
  name: 'Example Album',
  spotifyAlbumType: 'album',
  releaseKind: 'album',
  releaseDateRaw: '2026-09-05',
  releaseDatePrecision: 'day',
  releaseYear: 2026,
  totalTracks: 10,
  durationMs: 2_400_000,
  hasSpotifyMarkedExplicitTracks: false,
  coverUrl: 'https://i.scdn.co/image/example-cover',
  spotifyMetadataFetchedAt:
    new Date('2026-09-05T12:00:00.000Z'),
  createdAt:
    new Date('2026-09-05T12:00:00.000Z'),
  updatedAt:
    new Date('2026-09-05T12:00:00.000Z'),
}

const persistedArtists = [
  {
    id: 'first-artist-id',
    name: 'First Artist',
  },
  {
    id: 'second-artist-id',
    name: 'Second Artist',
  },
]

const persistedTags = [
  {
    id: 'rock-tag-id',
    name: 'Rock',
    categoryId: 'genre-category-id',
    category: 'Genre',
  },
  {
    id: 'energetic-tag-id',
    name: 'Energetic',
    categoryId: 'mood-category-id',
    category: 'Mood',
  },
]

describe('getAlbumById', () => {
  beforeEach(() => {
    vi.resetAllMocks()

    albumWhereMock.mockResolvedValue([
      persistedAlbum,
    ])
    albumFromMock.mockReturnValue({
      where: albumWhereMock,
    })

    artistOrderByMock.mockResolvedValue(
      persistedArtists,
    )
    artistWhereMock.mockReturnValue({
      orderBy: artistOrderByMock,
    })
    artistInnerJoinMock.mockReturnValue({
      where: artistWhereMock,
    })
    artistFromMock.mockReturnValue({
      innerJoin: artistInnerJoinMock,
    })

    tagOrderByMock.mockResolvedValue(persistedTags)
    tagWhereMock.mockReturnValue({
      orderBy: tagOrderByMock,
    })
    tagCategoryInnerJoinMock.mockReturnValue({
      where: tagWhereMock,
    })
    tagAlbumInnerJoinMock.mockReturnValue({
      innerJoin: tagCategoryInnerJoinMock,
    })
    tagFromMock.mockReturnValue({
      innerJoin: tagAlbumInnerJoinMock,
    })

    selectMock
      .mockReturnValueOnce({
        from: albumFromMock,
      })
      .mockReturnValueOnce({
        from: artistFromMock,
      })
      .mockReturnValueOnce({
        from: tagFromMock,
      })
  })

  it('returns the album with its ordered artists and tags', async () => {
    await expect(
      getAlbumById(ALBUM_ID),
    ).resolves.toEqual({
      ...persistedAlbum,
      artists: persistedArtists,
      tags: persistedTags,
    })

    expect(selectMock).toHaveBeenCalledTimes(3)

    expect(albumFromMock).toHaveBeenCalledWith(albums)
    expect(albumWhereMock).toHaveBeenCalledOnce()

    expect(selectMock).toHaveBeenNthCalledWith(2, {
      id: artists.id,
      name: artists.name,
    })
    expect(artistFromMock).toHaveBeenCalledWith(
      artists,
    )
    expect(
      artistInnerJoinMock,
    ).toHaveBeenCalledWith(
      albumArtists,
      expect.anything(),
    )
    expect(artistWhereMock).toHaveBeenCalledOnce()
    expect(artistOrderByMock).toHaveBeenCalledWith(
      albumArtists.position,
    )

    expect(selectMock).toHaveBeenNthCalledWith(3, {
      id: tags.id,
      name: tags.name,
      category: tagCategories.name,
      categoryId: tags.categoryId,
    })
    expect(tagFromMock).toHaveBeenCalledWith(tags)
    expect(
      tagAlbumInnerJoinMock,
    ).toHaveBeenCalledWith(
      albumTags,
      expect.anything(),
    )
    expect(
      tagCategoryInnerJoinMock,
    ).toHaveBeenCalledWith(
      tagCategories,
      expect.anything(),
    )
    expect(tagWhereMock).toHaveBeenCalledOnce()
    expect(tagOrderByMock).toHaveBeenCalledWith(
      tagCategories.name,
      tags.name,
    )
  })

  it('returns an empty tags array when the album has no tags', async () => {
    tagOrderByMock.mockResolvedValue([])

    await expect(
      getAlbumById(ALBUM_ID),
    ).resolves.toEqual({
      ...persistedAlbum,
      artists: persistedArtists,
      tags: [],
    })

    expect(selectMock).toHaveBeenCalledTimes(3)
  })

  it('rejects when the album does not exist', async () => {
    albumWhereMock.mockResolvedValue([])

    const request = getAlbumById(ALBUM_ID)

    await expect(request).rejects.toBeInstanceOf(
      AlbumNotFoundError,
    )
    await expect(request).rejects.toMatchObject({
      albumId: ALBUM_ID,
    })

    expect(selectMock).toHaveBeenCalledOnce()
    expect(artistFromMock).not.toHaveBeenCalled()
    expect(tagFromMock).not.toHaveBeenCalled()
  })

  it('rejects when the album has no associated artists', async () => {
    artistOrderByMock.mockResolvedValue([])

    const request = getAlbumById(ALBUM_ID)

    await expect(request).rejects.toBeInstanceOf(
      CatalogAlbumHasNoArtistsError,
    )
    await expect(request).rejects.toMatchObject({
      albumId: ALBUM_ID,
    })

    expect(selectMock).toHaveBeenCalledTimes(2)
    expect(tagFromMock).not.toHaveBeenCalled()
  })
})