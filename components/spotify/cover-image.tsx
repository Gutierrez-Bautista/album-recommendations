import Image from "next/image"

interface Props {
  url: string | null
  albumTitle: string
  sizes: string
  className?: string
  loading?: 'eager' | 'lazy'
}

export function SpotifyAlbumCover ({ albumTitle, url, className, loading = 'lazy', sizes }: Props) {
  return (
    <Image 
      alt={`${albumTitle} cover`}
      src={url ?? '/album-placeholder.svg'}
      loading={loading}
      sizes={sizes}
      fill
      className={(className ?? '') + ` rounded sm:rounded-lg ${url ? '' : 'border'} border-fuchsia-500/40 bg-linear-to-br from-fuchsia-500/40 via-zinc-900 to-zinc-950 shadow-[0_0_30px_rgba(217,70,239,0.12)] object-cover`}
    />
  )
}