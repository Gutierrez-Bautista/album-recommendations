import { getCurrentSession } from "@/lib/auth-guards";
import { DailyPick } from './_components/daily-pick'

export default async function Home() {
  const session = await getCurrentSession()
  const account = session ? { image: session.user.image ?? null } : null

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <DailyPick account={account} />
    </main>
  );
}
