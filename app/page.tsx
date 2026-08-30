export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h2 className="text-2xl font-bold">Daily Album</h2>
        <span className="text-sm text-muted-foreground opacity-75">
          Integrated with Spotify API
        </span>
      </main>
    </div>
  );
}
