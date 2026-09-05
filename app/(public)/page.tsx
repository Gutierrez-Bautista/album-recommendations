import { DeleteAccountBtn } from "@/components/delete-account-btn";
import LogoutButton from "@/components/logout-btn";
import { getCurrentSession } from "@/lib/auth-guards";
import Link from "next/link";

export default async function Home() {
  const session = await getCurrentSession()

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h2 className="text-2xl font-bold">Daily Album</h2>
        <span className="text-sm text-muted-foreground opacity-75">
          Integrated with Spotify API
        </span>

        {
          session ? ( <>
            <LogoutButton />
            <DeleteAccountBtn />
          </>
          ) : <Link href='/login' className="px-6 py-2 bg-(--app-primary) hover:bg-(--app-primary-hover) rounded-full">Sign in</Link> 
        }
      </main>
    </div>
  );
}
