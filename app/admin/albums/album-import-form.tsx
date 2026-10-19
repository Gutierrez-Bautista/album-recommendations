'use client'

import Image from "next/image"
import { useActionState } from "react"
import {
  importAlbumAction,
  previewAlbumAction,
  type AlbumImportState,
  type AlbumPreview,
  type AlbumPreviewState,
} from './actions'

const initialPreviewState: AlbumPreviewState = {
  status: 'idle',
}

const initialImportState: AlbumImportState = {
  status: 'idle',
}

function formatDuration(durationMs: number): string {
  const totalMinutes = Math.floor(durationMs / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  return `${hours} hr ${minutes} min`
}

export default function AlbumImportForm () {
  const [
    previewState,
    previewAction,
    isPreviewPending,
  ] = useActionState(
    previewAlbumAction,
    initialPreviewState,
  )

  const spotifyInputError =
    previewState.status === 'validation-error'
      ? previewState.fieldErrors.spotifyInput?.[0]
      : undefined

  return <div className="flex flex-col gap-6">
    <form
      action={previewAction}
      className="rounded-xl bg-zinc-800/70 p-6"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="spotifyInput">
          Spotify album URL or ID
        </label>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="spotifyInput"
            name="spotifyInput"
            type="text"
            required
            aria-invalid={Boolean(spotifyInputError)}
            aria-describedby={
              spotifyInputError
                ? 'spotifyInput-error'
                : undefined
            }
            className="min-w-0 flex-1 rounded bg-zinc-700 px-3 py-2"
          />

          <button
            type="submit"
            disabled={isPreviewPending}
            className="rounded-full bg-(--app-primary) px-6 py-2 cursor-pointer transition hover:bg-(--app-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPreviewPending
              ? 'Loading…'
              : 'Preview album'}
          </button>
        </div>

        {spotifyInputError && (
          <p
            id="spotifyInput-error"
            role="alert"
            className="text-sm text-red-500"
          >
            {spotifyInputError}
          </p>
        )}

        {previewState.status === 'error' && (
          <p role="alert" className="text-sm text-red-500">
            {previewState.message}
          </p>
        )}
      </div>
    </form>
    {previewState.status === 'success' && (
      <AlbumPreviewAndImport
        key={previewState.preview.spotifyId}
        preview={previewState.preview}
      />
    )}
  </div>
}

function AlbumPreviewAndImport({
  preview,
}: {  
  preview: AlbumPreview
}) {
  const [state, action, isPending] = useActionState(
    importAlbumAction,
    initialImportState,
  )

  const wasImported = state.status === 'success'

  return (
    <section className="rounded-xl bg-zinc-800/70 p-6">
      <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
        {preview.coverImageUrl ? (
          <Image
            src={preview.coverImageUrl}
            alt={`${preview.name} cover`}
            width={320}
            height={320}
            className="aspect-square w-full rounded-lg object-cover"
          />
        ) : (
          <div className="aspect-square rounded-lg bg-zinc-700" />
        )}

        <div>
          <p className="text-sm uppercase tracking-wide text-(--spotify-green)">
            Spotify {preview.spotifyAlbumType}
          </p>

          <h2 className="mt-1 text-2xl font-semibold">
            {preview.name}
          </h2>

          <p className="mt-1 text-zinc-300">
            {preview.artists
              .map((artist) => artist.name)
              .join(', ')}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-zinc-400">Release</dt>
              <dd>{preview.releaseDateRaw}</dd>
            </div>

            <div>
              <dt className="text-zinc-400">Tracks</dt>
              <dd>{preview.totalTracks}</dd>
            </div>

            <div>
              <dt className="text-zinc-400">Duration</dt>
              <dd>{formatDuration(preview.durationMs)}</dd>
            </div>

            <div>
              <dt className="text-zinc-400">Explicit</dt>
              <dd>
                {preview.hasSpotifyMarkedExplicitTracks
                  ? 'Yes'
                  : 'No'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <form
        action={action}
        className="mt-6 border-t border-zinc-700 pt-6"
      >
        <input
          type="hidden"
          name="spotifyInput"
          value={preview.spotifyId}
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="releaseKind">
              Release kind
            </label>

            <select
              id="releaseKind"
              name="releaseKind"
              defaultValue=""
              required
              aria-describedby="releaseKind-error"
              className="rounded bg-zinc-700 px-3 py-2"
              disabled={wasImported}
            >
              <option value="" disabled>
                Select a release kind
              </option>
              <option value="album">Album</option>
              <option value="single">Single</option>
              <option value="ep">EP</option>
              <option value="compilation">
                Compilation
              </option>
            </select>

            {state.status === 'validation-error' &&
              state.fieldErrors.releaseKind && (
                <p
                  id="releaseKind-error"
                  className="text-sm text-red-500"
                >
                  {state.fieldErrors.releaseKind[0]}
                </p>
              )}
          </div>

          <button
            type="submit"
            disabled={
              isPending || wasImported
            }
            className={`
              rounded-full px-6 py-2 transition
              disabled:cursor-not-allowed sm:mt-7.5 cursor-pointer
              ${
                wasImported
                  ? 'bg-emerald-600'
                  : 'bg-(--app-primary) hover:bg-(--app-primary-hover)'
              }
            `}
            // "rounded-full cursor-pointer bg-(--app-primary) px-6 py-2 transition hover:bg-(--app-primary-hover) disabled:cursor-not-allowed disabled:opacity-60 sm:mt-8"
          >
            {isPending ? 'Importing…' : wasImported ? 'Imported' : 'Import album'}
          </button>
        </div>

        {state.status === 'error' && (
          <p role="alert" className="mt-4 text-red-500">
            {state.message}
          </p>
        )}

        {state.status === 'success' && (
          <p role="status" className="mt-4 text-green-400">
            {state.message}
          </p>
        )}
      </form>
    </section>
  )
}