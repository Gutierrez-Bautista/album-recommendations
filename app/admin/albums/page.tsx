import AlbumImportForm from "./album-import-form";

export default function ImportAlbumPage () {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 py-16">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-semibold">
          Album import
        </h1>

        <p className="mt-2 text-zinc-400">
          Preview Spotify metadata before adding an album
          to the catalog.
        </p>
      </header>

      <AlbumImportForm />
    </main>
  )
}