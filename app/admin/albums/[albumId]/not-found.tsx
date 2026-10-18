import Link from "next/link"

export default function Error404 () {
  return (
    <main className="min-h-dvh w-full flex flex-col justify-center items-center">
      <h1 className="text-3xl">Album not Found</h1>
      <p className="text-gray-400 mb-6">Album with that ID doesn&apos;t exists</p>
      <Link
        href='/'
        className="px-6 py-2 rounded-full bg-(--app-primary) transition hover:bg-(--app-primary-hover) cursor-pointer"
      >Back to home</Link>
    </main>
  )
}