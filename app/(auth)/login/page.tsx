import Link from "next/link";
import { startSpotifyLogin } from "./actions";
import Image from "next/image";
import { getCurrentSession } from "@/lib/auth-guards";
import { redirect } from "next/navigation";

type SearchParams = {
  error?: string;
  accountDeleted?: string;
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { error, accountDeleted } = await searchParams
  const session = await getCurrentSession()

  if (session) {
    redirect('/auth/complete')
  }

  return (
    <main className={`flex min-h-screen flex-col items-center justify-center py-8 gap-2 px-8 sm:p-12`}>
      {error === 'access_denied' && (
        <p role="status" className="opacity-35 absolute top-6 left-1/2 -translate-x-1/2">
          Spotify sign-in was cancelled. No changes were made.
        </p>
      )}

      {accountDeleted === '1' && (
        <p role="status" className="opacity-35 absolute top-6 left-1/2 -translate-x-1/2">
          Your account has been deleted. Remove access from Spotify at <Link target="_blank" href="https://www.spotify.com/account/apps/" className="underline text-(--app-primary-light)">
            https://www.spotify.com/account/apps/
          </Link> if you want to revoke access.
        </p>
      )}

      {error && error !== 'access_denied' && (
        <p role="alert" className="opacity-35 absolute top-6 left-1/2 -translate-x-1/2">
          {"We couldn't sign you in with Spotify. Please try again."}
        </p>
      )}
      <div className="flex flex-col items-center justify-center gap-4 bg-zinc-900 p-8 rounded-lg max-w-4xl">
        <h1 className="text-3xl font-bold">Sign in</h1>

        <p className="mt-2 text-sm text-zinc-400">
          Use your Spotify account to continue.
        </p>

        <p>
          Review our{' '}
          <Link href="/terms" className="underline text-(--app-primary-light)">
            Terms and Conditions
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline text-(--app-primary-light)">
            Privacy Policy
          </Link>{' '}
          before continuing. If you are new or the
          documents have changed, you will be asked to
          accept them before accessing the application.
        </p>

        <form action={startSpotifyLogin}>
          <button
            type="submit"
            className="mt-4 rounded-full bg-(--spotify-green) hover:scale-105 cursor-pointer hover:shadow-lg shadow-zinc-500/30 px-6 py-4 text-black transition-transform duration-200 self-center"
          >
            <Image
              src="/spotify-logo-black.svg"
              alt="Spotify Logo"
              width={32}
              height={32}
              className="inline-block mr-4 size-8"
            />
            Continue with Spotify
          </button>
        </form>
      </div>

      <span className="text-zinc-300">or</span>
      <Link href='/' className="bg-(--app-primary) hover:bg-(--app-primary-hover) hover:scale-105 rounded-full px-6 py-2 transition">Continue as a guest</Link>
    </main>
  )
}