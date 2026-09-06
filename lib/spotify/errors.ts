export class SpotifyError extends Error {
  constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = new.target.name
  }
}

export class SpotifyApiError extends SpotifyError {
  constructor(
    message: string,
    public readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

export class SpotifyNotFoundError extends SpotifyApiError {
  constructor(resource: string, id: string) {
    super(`${resource} with ID "${id}" was not found`, 404)
  }
}

export class SpotifyRateLimitError extends SpotifyApiError {
  constructor(public readonly retryAfterSeconds?: number) {
    super('Spotify API rate limit exceeded', 429)
  }
}

export class SpotifyUnauthorizedError extends SpotifyApiError {
  constructor() {
    super('Spotify authorization failed', 401)
  }
}

export class SpotifyServiceError extends SpotifyApiError {
  constructor(status: number, options?: ErrorOptions) {
    super(
      `Spotify API request failed with status ${status}`,
      status,
      options,
    )
  }
}

export class InvalidSpotifyAlbumInputError extends SpotifyError {
  constructor(input: string) {
    super(`Invalid Spotify album URL or ID: "${input}"`)
  }
}