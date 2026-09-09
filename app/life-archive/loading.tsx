export default function LifeArchiveLoading() {
  return (
    <main className="min-h-screen bg-black px-5 py-24 text-[#F3EAD8]" aria-busy="true">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="h-8 w-36 animate-pulse rounded bg-white/[0.06]" />
        <div className="mx-auto h-40 max-w-xl animate-pulse rounded-3xl bg-white/[0.05]" />
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="h-64 animate-pulse rounded-3xl bg-white/[0.05]" />
          <div className="h-64 animate-pulse rounded-3xl bg-white/[0.05]" />
        </div>
      </div>
    </main>
  );
}
