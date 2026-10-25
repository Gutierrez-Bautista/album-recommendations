import Image from 'next/image'
import { InfoPopover } from '@/components/info-popover'
import { SpotifyAlbumCover } from '@/components/spotify/cover-image'
import { formatAlbumDuration, formatAlbumReleaseDate } from '@/lib/catalog/formatting'
import { getTagCategoryColor, sortTagCategories } from '@/lib/catalog/tag-presentation'
import type { DailyPickDetails } from '@/lib/daily-pick/queries'
import { getSpotifyAlbumUrl } from '@/lib/spotify/identifier'

const releaseLabels = {
  album: 'Album',
  single: 'Single',
  ep: 'EP',
  compilation: 'Compilation',
}

export function DailyPickAlbum({ album }: { album: DailyPickDetails['album'] }) {
  const spotifyUrl = getSpotifyAlbumUrl(album.spotifyId)
  const duration = formatAlbumDuration(album.durationMs)
  const showSpotifyType = album.releaseKind !== album.spotifyAlbumType
  const hasTags = album.tagCategories.some((category) => category.tags.length > 0)
  const explicit = album.hasSpotifyMarkedExplicitTracks

  return (
    <article aria-label="Today's recommended album" className="grid min-w-0 gap-8 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-10 lg:gap-14">
      <div className="mx-auto w-full min-w-0 max-w-md md:max-w-none">
        <div className="relative aspect-square w-full">
          <SpotifyAlbumCover
            albumTitle={album.name}
            url={album.coverUrl}
            sizes="(max-width: 448px) calc(100vw - 32px), (max-width: 767px) 448px, (max-width: 1152px) 40vw, 440px"
            loading="eager"
            className="object-contain!"
          />
        </div>
        <a
          href={spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-3 rounded-full bg-(--spotify-green) px-6 py-3 font-semibold text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--spotify-green)"
        >
          <Image src="/spotify-logo-black.svg" alt="" aria-hidden="true" width={24} height={24} />
          Open in Spotify<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>

      <div className="min-w-0 md:py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="min-w-0 text-3xl leading-tight font-semibold tracking-tight wrap-anywhere sm:text-4xl lg:text-4xl">
            <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" className="rounded hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--spotify-green)">
              {album.name}<span className="sr-only"> on Spotify (opens in a new tab)</span>
            </a>
          </h2>
          {album.releaseKind && (
            <span aria-label={`Daily Album release kind: ${releaseLabels[album.releaseKind]}`} className="rounded-full border border-(--app-primary)/40 bg-(--app-primary)/10 px-3 py-1 text-sm font-medium text-(--app-primary-light)">
              {releaseLabels[album.releaseKind]}
            </span>
          )}
        </div>
        <p className="mt-3 text-lg leading-relaxed text-zinc-300 wrap-anywhere sm:text-xl">
          {album.artists.map((artist) => artist.name).join(', ')}
        </p>

        {showSpotifyType && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <span>Spotify: {releaseLabels[album.spotifyAlbumType]}</span>
            {album.releaseKind && (
              <InfoPopover
                label={<span className="sr-only">About release classifications</span>}
                contentLabel="About release classifications"
                className="rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Daily Album uses a manually curated release classification. Spotify supplies its own independent classification and does not have a separate EP album type.
              </InfoPopover>
            )}
          </div>
        )}

        <ul aria-label="Album details" className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-300">
          <li>{album.totalTracks} {album.totalTracks === 1 ? 'track' : 'tracks'}</li>
          {duration !== null && (
            <li className="flex items-center gap-3"><span aria-hidden="true" className="text-zinc-600">·</span>{duration}</li>
          )}
          <li className="flex items-center gap-3">
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span>{formatAlbumReleaseDate(album.releaseDateRaw)}</span>
          </li>
          <li className="flex items-center gap-3">
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <InfoPopover
              label={explicit ? 'E' : 'NE'}
              triggerLabel={explicit ? 'E: at least one track marked explicit by Spotify' : 'NE: no tracks marked explicit by Spotify'}
              contentLabel="About Spotify explicit indication"
              showIcon={false}
              className="size-9 shrink-0 justify-center rounded-full border border-zinc-500 text-xs font-semibold text-zinc-200 transition-colors hover:border-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {explicit
                ? 'At least one track was marked explicit by Spotify.'
                : 'No track was marked explicit by Spotify.'}
              {' '}No marked tracks does not guarantee the content is suitable for every audience; Spotify may report an unknown status as not explicit.
            </InfoPopover>
          </li>
        </ul>

        <section aria-labelledby="daily-pick-tags-heading" className="mt-8">
          <h3 id="daily-pick-tags-heading" className="text-sm font-semibold text-zinc-200">Tags</h3>
          {hasTags ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {sortTagCategories(album.tagCategories).flatMap((category) => category.tags.map((tag) => (
                <InfoPopover
                  key={tag.id}
                  label={tag.name}
                  triggerLabel={`${tag.name}: about ${category.name} tags`}
                  contentLabel={`About ${category.name} tags`}
                  showIcon={false}
                  className={`max-w-full rounded-full border px-3 py-1.5 text-sm font-medium wrap-anywhere transition-colors hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${getTagCategoryColor(category.key)}`}
                >
                  <p className="font-semibold text-zinc-100">{category.name}</p>
                  {category.description !== null && <p className="mt-1">{category.description}</p>}
                </InfoPopover>
              )))}
            </div>
          ) : <p className="mt-3 text-sm text-zinc-400">No tags for this album yet.</p>}
        </section>
      </div>
    </article>
  )
}
