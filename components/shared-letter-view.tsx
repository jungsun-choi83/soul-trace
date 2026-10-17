import type { SharedLetter } from "@/lib/letter-share";

export function SharedLetterView({ letter }: { letter: SharedLetter | null }) {
  if (!letter) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B0A08] px-5 py-16 text-[#F4EBDD]">
        <section className="w-full max-w-lg rounded-3xl border border-[#C7A43A]/35 bg-[#15120E] p-8 text-center shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <p className="mb-3 text-xs uppercase tracking-[0.28em] text-[#C7A43A]">SOUL TRACE</p>
          <h1 className="font-serif text-3xl">This shared letter is unavailable</h1>
          <p className="mt-4 text-sm leading-7 text-[#CFC3B2]">The link may have expired or been withdrawn.</p>
        </section>
      </main>
    );
  }

  const isKorean = letter.locale === "ko";
  return (
    <main className="min-h-screen bg-[#0B0A08] px-4 py-10 text-[#F4EBDD] sm:px-6 sm:py-16">
      <article className="mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-[#C7A43A]/40 bg-[#F4EBDD] text-[#2A2118] shadow-[0_24px_100px_rgba(0,0,0,0.55)]">
        {letter.heroImageUrl ? (
          // The URL is a short-lived private Supabase signature issued server-side.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={letter.heroImageUrl} alt="" className="h-56 w-full object-cover sm:h-72" />
        ) : null}
        <div className={`p-7 sm:p-12 ${isKorean ? "font-ko" : "font-serif"}`}>
          <p className="text-center text-[10px] font-sans uppercase tracking-[0.35em] text-[#9B7A22]">SOUL TRACE</p>
          <div className="mx-auto mt-4 h-px w-20 bg-[#C7A43A]/70" />
          <h1 className="mt-7 text-center text-3xl leading-tight sm:text-4xl">{letter.title}</h1>
          <div className="mx-auto mt-8 max-w-2xl space-y-5 text-[1.05rem] leading-8 sm:text-lg">
            {letter.paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 12)}`}>{paragraph}</p>)}
          </div>
          {letter.endingPhrase ? <p className="mt-8 text-right text-base italic text-[#80672D]">{letter.endingPhrase}</p> : null}
          <p className="mt-10 text-center text-xs font-sans uppercase tracking-[0.25em] text-[#8A7350]">Shared with Soul Trace</p>
        </div>
      </article>
    </main>
  );
}
