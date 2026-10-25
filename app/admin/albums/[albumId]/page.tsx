import { AlbumNotFoundError, CatalogAlbumHasNoArtistsError } from "@/lib/catalog/errors"
import { formatAlbumDuration } from '@/lib/catalog/formatting'
import { type AlbumDetails, getAlbumById } from "@/lib/catalog/queries/albums"
import { getTagCategoriesWithTags } from "@/lib/catalog/queries/tags"
import { InfoPopover } from "@/components/info-popover"
import { SpotifyAlbumCover } from "@/components/spotify/cover-image"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import AlbumEditForm from "./album-edit-form"

type Props = {
  params: Promise<{albumId: string}>
}

function invalidAlbumPage (id: string, kind: 'invalid_id' | 'internal_data') {
  return <main className="min-h-dvh w-full flex flex-col justify-center items-center">
    <h1 className="text-3xl">{kind === 'internal_data' ? 'Invalid Album' : 'Invalid Album ID'}</h1>
    <p className="text-gray-400 mb-6">
      {
        kind === 'internal_data'
        ? `Album with ID ${id} exists but its data is incomplete`
        : `The ID ${id} isn't a valid UUID`
      }
    </p>
    <Link
      href='/'
      className="px-6 py-2 rounded-full bg-(--app-primary) transition hover:bg-(--app-primary-hover) cursor-pointer"
    >Back to home</Link>
  </main>
}

export default async function AlbumEditPage(props: Props) {
  const params = await props.params
  const albumId = params.albumId

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(albumId)) {
    return invalidAlbumPage(albumId, 'invalid_id')
  }

  let album: AlbumDetails

  try {
    album = await getAlbumById(albumId)
  } catch (error) {
    if (error instanceof CatalogAlbumHasNoArtistsError) {
      return invalidAlbumPage(albumId, 'internal_data')
    }
    if (error instanceof AlbumNotFoundError) {
      notFound()
    }

    throw error
  }

  const categories = await getTagCategoriesWithTags()
  const spotifyAlbumUrl = `https://open.spotify.com/album/${encodeURIComponent(album.spotifyId)}`

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">Edit album</h1>
        <p className="mt-2 text-zinc-400">
          Review Spotify details and edit this album&apos;s catalog classifications.
        </p>
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <section aria-labelledby="spotify-metadata-heading" className="min-w-0 rounded-xl bg-zinc-800/70 p-5 sm:p-6 lg:sticky lg:top-6 lg:self-start">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <h2 id="spotify-metadata-heading" className="text-xl font-semibold">Spotify metadata</h2>
            <InfoPopover
              label={<span className="sr-only">About Spotify metadata</span>}
              contentLabel="About Spotify metadata"
              className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              These details came from Spotify when the album was imported. They are read only here; the release kind and tags below are defined by Daily Album.
            </InfoPopover>
          </div>

          <div className="flex min-w-0 flex-col gap-5 sm:flex-row lg:flex-col xl:flex-row">
            <div className="relative aspect-square w-full max-w-48 shrink-0 self-center sm:self-start">
              <SpotifyAlbumCover
                albumTitle={album.name}
                url={album.coverUrl}
                sizes="(max-width: 640px) 192px, 192px"
                loading="eager"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm text-zinc-400">Spotify {album.spotifyAlbumType}</p>
              <h3 className="mt-1 wrap-break-word text-2xl font-semibold">{album.name}</h3>
              <p className="mt-1 wrap-break-word text-zinc-300">
                {album.artists.map((artist) => artist.name).join(', ')}
              </p>

              <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                <div>
                  <dt className="text-zinc-400">Release date</dt>
                  <dd className="mt-1">{album.releaseDateRaw}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Tracks</dt>
                  <dd className="mt-1">{album.totalTracks}</dd>
                </div>
                <div>
                  <dt className="text-zinc-400">Duration</dt>
                  <dd className="mt-1">{formatAlbumDuration(album.durationMs) ?? 'Unavailable'}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-zinc-400">
                    Explicit indication
                    <InfoPopover
                      label={<span className="sr-only">About Spotify explicit indication</span>}
                      contentLabel="About Spotify explicit indication"
                      className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      This reflects whether any imported track was marked explicit by Spotify. No marked tracks does not guarantee the content is clean; Spotify can report an unknown status as not explicit.
                    </InfoPopover>
                  </dt>
                  <dd className="mt-1">
                    {album.hasSpotifyMarkedExplicitTracks ? 'At least one track marked' : 'No tracks marked'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <a
            href={spotifyAlbumUrl}
            className="mt-6 inline-flex items-center gap-2 rounded text-(--spotify-green) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--spotify-green)"
            target="_blank"
          >
            <Image src="/spotify-logo-green.svg" alt="" aria-hidden="true" width={20} height={20} />
            Open in Spotify
          </a>
        </section>

        <section aria-labelledby="catalog-classification-heading" className="min-w-0 rounded-xl bg-zinc-800/70 p-5 sm:p-6">
          <h2 id="catalog-classification-heading" className="text-xl font-semibold">Catalog classification</h2>
          <p className="mt-2 text-sm text-zinc-400">Choose how Daily Album describes this release.</p>
          <AlbumEditForm
            key={album.id}
            albumId={album.id}
            initialReleaseKind={album.releaseKind}
            initialTagIds={album.tags.map((tag) => tag.id)}
            categories={categories}
          />
        </section>
      </div>
    </main>
  )
}
