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