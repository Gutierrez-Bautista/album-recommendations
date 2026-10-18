import { AlbumNotFoundError, CatalogAlbumHasNoArtistsError } from "@/lib/catalog/errors"
import { type AlbumDetails, getAlbumById } from "@/lib/catalog/queries/albums"
import Link from "next/link"
import { notFound } from "next/navigation"

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

  return (
    <main className="min-h-dvh w-full flex flex-col justify-center items-center">
      
    </main>
  )
}