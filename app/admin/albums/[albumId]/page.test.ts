import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AlbumNotFoundError, CatalogAlbumHasNoArtistsError } from '@/lib/catalog/errors'

const {
  getAlbumByIdMock,
  getTagCategoriesWithTagsMock,
  notFoundMock,
  coverPropsMock,
  formPropsMock,
} = vi.hoisted(() => ({
  getAlbumByIdMock: vi.fn(),
  getTagCategoriesWithTagsMock: vi.fn(),
  notFoundMock: vi.fn(),
  coverPropsMock: vi.fn(),
  formPropsMock: vi.fn(),
}))

vi.mock('@/lib/catalog/queries/albums', () => ({ getAlbumById: getAlbumByIdMock }))
vi.mock('@/lib/catalog/queries/tags', () => ({ getTagCategoriesWithTags: getTagCategoriesWithTagsMock }))
vi.mock('next/navigation', () => ({ notFound: notFoundMock }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('@/components/info-popover', () => ({ InfoPopover: () => null }))
vi.mock('@/components/spotify/cover-image', () => ({
  SpotifyAlbumCover: (props: unknown) => {
    coverPropsMock(props)
    return null
  },
}))
vi.mock('./album-edit-form', () => ({
  default: (props: unknown) => {
    formPropsMock(props)
    return null
  },
}))

import AlbumEditPage from './page'

const ALBUM_ID = '550e8400-e29b-41d4-a716-446655440000'
const TAG_ID = '3d813cbb-47fb-4cfe-b7c6-3b466b873f20'

const album = {
  id: ALBUM_ID,
  spotifyId: '4aawyAB9vmqN3uQ7FjRGTy',
  name: 'Example Album',
  artists: [{ id: 'artist-id', name: 'Example Artist' }],
  tags: [{ id: TAG_ID, name: 'Rock', categoryId: 'category-id', categoryKey: 'genre', category: 'Genre', categoryDescription: null }],
  spotifyAlbumType: 'album',
  releaseKind: 'ep',
  releaseDateRaw: '2026-09',
  totalTracks: 10,
  durationMs: null,
  hasSpotifyMarkedExplicitTracks: false,
  coverUrl: 'https://i.scdn.co/image/example-cover',
}

const categories = [{
  id: 'category-id',
  key: 'genre',
  name: 'Genre',
  description: 'Musical genre or subgenre',
  tags: [{ id: TAG_ID, name: 'Rock', slug: 'rock', parentId: null }],
}]

function pageFor(albumId: string) {
  return AlbumEditPage({ params: Promise.resolve({ albumId }) })
}

beforeEach(() => {
  vi.resetAllMocks()
  getAlbumByIdMock.mockResolvedValue(album)
  getTagCategoriesWithTagsMock.mockResolvedValue(categories)
  notFoundMock.mockImplementation(() => { throw new Error('NEXT_NOT_FOUND') })
})

describe('AlbumEditPage', () => {
  it('shows the selected album and passes current classifications to the form', async () => {
    const markup = renderToStaticMarkup(await pageFor(ALBUM_ID))

    expect(getAlbumByIdMock).toHaveBeenCalledWith(ALBUM_ID)
    expect(getTagCategoriesWithTagsMock).toHaveBeenCalledOnce()
    expect(coverPropsMock).toHaveBeenCalledWith(expect.objectContaining({
      albumTitle: album.name,
      url: album.coverUrl,
    }))
    expect(formPropsMock).toHaveBeenCalledWith(expect.objectContaining({
      albumId: ALBUM_ID,
      initialReleaseKind: 'ep',
      initialTagIds: [TAG_ID],
      categories,
    }))
    expect(markup).toContain('Example Album')
    expect(markup).toContain('Example Artist')
    expect(markup).toContain('Spotify album')
    expect(markup).toContain('Unavailable')
    expect(markup).toContain('No tracks marked')
    expect(markup).toContain('https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy')
    expect(markup).toContain('lg:sticky lg:top-6')
  })

  it('does not query the catalog for an invalid album ID', async () => {
    const markup = renderToStaticMarkup(await pageFor('invalid-id'))

    expect(markup).toContain('Invalid Album ID')
    expect(getAlbumByIdMock).not.toHaveBeenCalled()
    expect(getTagCategoriesWithTagsMock).not.toHaveBeenCalled()
  })

  it('uses the existing not-found behavior for a missing album', async () => {
    getAlbumByIdMock.mockRejectedValueOnce(new AlbumNotFoundError(ALBUM_ID))

    await expect(pageFor(ALBUM_ID)).rejects.toThrow('NEXT_NOT_FOUND')
    expect(notFoundMock).toHaveBeenCalledOnce()
    expect(getTagCategoriesWithTagsMock).not.toHaveBeenCalled()
  })

  it('uses the existing internal-data error for an album with no artists', async () => {
    getAlbumByIdMock.mockRejectedValueOnce(new CatalogAlbumHasNoArtistsError(ALBUM_ID))

    const markup = renderToStaticMarkup(await pageFor(ALBUM_ID))

    expect(markup).toContain('Invalid Album')
    expect(markup).toContain('its data is incomplete')
    expect(getTagCategoriesWithTagsMock).not.toHaveBeenCalled()
  })
})
