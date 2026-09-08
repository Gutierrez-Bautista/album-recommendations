export class AlbumImportError extends Error {
  constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = new.target.name
  }
}

export class AlbumHasNoArtistsError extends AlbumImportError {
  constructor(public readonly spotifyId: string) {
    super(`Spotify album has no artists: ${spotifyId}`)
  }
}

export class AlbumUpdateError extends Error {
  constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = new.target.name
  }
}

export class AlbumNotFoundError extends AlbumUpdateError {
  constructor(public readonly albumId: string) {
    super(`Album with ID ${albumId} wasn't imported`)
  }
}

export class TagsNotFoundError extends AlbumUpdateError {
  constructor(public readonly tagIds: string[]) {
    super(`Tags not found: ${tagIds.join(', ')}`)
  }
}