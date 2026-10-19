export class CatalogError extends Error {
  constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = new.target.name
  }
}

export class SpotifyAlbumHasNoArtistsError extends CatalogError {
  constructor(public readonly spotifyId: string) {
    super(`Spotify album has no artists: ${spotifyId}`)
  }
}

export class TagsNotFoundError extends CatalogError {
  constructor(public readonly tagIds: string[]) {
    super(`Tags not found: ${tagIds.join(', ')}`)
  }
}

export class AlbumNotFoundError extends CatalogError {
  constructor(public readonly albumId: string) {
    super(`Album not found in the catalog: ${albumId}`)
  }
}

export class CatalogAlbumHasNoArtistsError extends CatalogError {
  constructor(public readonly albumId: string) {
    super(`Catalog album has no associated artists: ${albumId}`)
  }
}