'use server'

import { requireAdmin } from "@/lib/auth-guards"
import { importAlbumSchema, previewAlbumSchema, type ImportAlbumFields } from './validations'
import * as z from "zod"
import { importSpotifyAlbum } from '@/lib/catalog/import-album'
import { InvalidSpotifyAlbumInputError, SpotifyNotFoundError, SpotifyRateLimitError, SpotifyServiceError } from "@/lib/spotify/errors"
import { SpotifyAlbumHasNoArtistsError } from "@/lib/catalog/errors"
import { getSpotifyAlbum } from "@/lib/spotify/albums"

type AlbumImportFieldErrors = Partial<
  Record<keyof ImportAlbumFields, string[]>
>

export type AlbumImportState =
  | {
    status: 'idle'
  }
  | {
    status: 'validation-error'
    fieldErrors: AlbumImportFieldErrors
  }
  | {
    status: 'error'
    message: string
  }
  | {
    status: 'success'
    albumId: string
    message: string
  }

export type AlbumPreview = {
  spotifyId: string
  name: string
  spotifyAlbumType: 'album' | 'single' | 'compilation'
  releaseDateRaw: string
  releaseYear: number
  totalTracks: number
  durationMs: number
  hasSpotifyMarkedExplicitTracks: boolean
  coverImageUrl: string | null
  spotifyUrl: string
  artists: {
    spotifyId: string
    name: string
  }[]
}

export type AlbumPreviewState =
  | {
    status: 'idle'
  }
  | {
    status: 'validation-error'
    fieldErrors: {
      spotifyInput?: string[]
    }
  }
  | {
    status: 'error'
    message: string
  }
  | {
    status: 'success'
    preview: AlbumPreview
  }

const createMessageError = (
  message: string,
): {
  status: 'error'
  message: string
} => {
  return {
    status: 'error',
    message,
  }
}

const createSpotifyInputError = (
  message: string,
): {
  status: 'validation-error'
  fieldErrors: {
    spotifyInput?: string[]
  }
} => {
  return {
    status: 'validation-error',
    fieldErrors: {
      spotifyInput: [message],
    },
  }
}

const manageSpotifyErrors = (error: unknown) => {
  if (error instanceof InvalidSpotifyAlbumInputError) {
    return createSpotifyInputError('Enter a valid Spotify album URL or ID')
  }

  if (error instanceof SpotifyNotFoundError) {
    return createSpotifyInputError('No Spotify album was found for this URL or ID.')
  }

  if (error instanceof SpotifyRateLimitError) {
    if (error.retryAfterSeconds !== undefined) {
      return createMessageError(
        `Spotify is temporarily limiting requests. Try again in ${error.retryAfterSeconds} seconds.`,
      )
    }

    return createMessageError('Spotify is temporarily limiting requests. Try again later.')
  }

  if (error instanceof SpotifyServiceError) {
    return createMessageError(
      'Spotify is temporarily unavailable. Try again later.',
    )
  }

  if (error instanceof SpotifyAlbumHasNoArtistsError) {
    return createMessageError('Spotify returned incomplete album metadata. Try again later.')
  }

  console.error('Unexpected album action error', error)

  return createMessageError(
    'An unexpected error occurred. Try again later.',
  )
}

export async function previewAlbumAction(
  _previousState: AlbumPreviewState,
  formData: FormData,
): Promise<AlbumPreviewState> {
  await requireAdmin()

  const validationResult = previewAlbumSchema.safeParse({
    spotifyInput: formData.get('spotifyInput'),
  })

  if (!validationResult.success) {
    return {
      status: 'validation-error',
      fieldErrors: z.flattenError(
        validationResult.error,
      ).fieldErrors,
    }
  }

  try {
    const metadata = await getSpotifyAlbum(
      validationResult.data.spotifyInput,
    )

    return {
      status: 'success',
      preview: {
        spotifyId: metadata.spotifyId,
        name: metadata.name,
        spotifyAlbumType: metadata.spotifyAlbumType,
        releaseDateRaw: metadata.releaseDateRaw,
        releaseYear: metadata.releaseYear,
        totalTracks: metadata.totalTracks,
        durationMs: metadata.durationMs,
        hasSpotifyMarkedExplicitTracks:
          metadata.hasSpotifyMarkedExplicitTracks,
        coverImageUrl: metadata.coverImageUrl,
        spotifyUrl: metadata.spotifyUrl,
        artists: metadata.artists.map((artist) => ({
          spotifyId: artist.spotifyId,
          name: artist.name,
        })),
      },
    }
  } catch (error) {
    return manageSpotifyErrors(error)
  }
}

export async function importAlbumAction(
  _previousState: AlbumImportState,
  formData: FormData,
): Promise<AlbumImportState> {
  await requireAdmin()

  const validationResult = importAlbumSchema.safeParse({
    spotifyInput: formData.get('spotifyInput'),
    releaseKind: formData.get('releaseKind'),
  })

  if (!validationResult.success) {
    return {
      status: 'validation-error',
      fieldErrors: z.flattenError(validationResult.error).fieldErrors,
    }
  }

  const { releaseKind, spotifyInput } = validationResult.data

  try {
    const importResult = await importSpotifyAlbum({ spotifyInput, releaseKind })

    return {
      status: 'success',
      albumId: importResult.id,
      message: 'Album imported successfully'
    }
  } catch (error) {
    return manageSpotifyErrors(error)
  }
}