import type { HomeRecent } from "@/lib/pet-first-archive-data";
import { formatHomeMemoryDate, homeMemoryPreviewTitle } from "@/lib/home-memory-preview";
import Link from "next/link";

export function HomeRecentMemories({
  items,
  href,
  lang,
  title,
  empty,
  viewAll,
}: {
  items: HomeRecent[];
  href: string;
  lang: "ko" | "en";
  title: string;
  empty: string;
  viewAll: string;
}) {
  return (
    <section className="mt-6" aria-labelledby="home-recent-memories">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-recent-memories" className="st-headline text-xl text-[#1e4d3a]">{title}</h2>
        <Link href={href} className="st-link shrink-0 text-sm">{viewAll}</Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[#3e6274]">{empty}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => {
            const previewTitle = homeMemoryPreviewTitle(item, lang);
            const formattedDate = formatHomeMemoryDate(item, lang);
            return (
              <li key={item.entryId}>
                <Link href={href} className="st-card block h-full overflow-hidden">
                  {item.imageUrl ? (
                    // Signed Storage URLs expire and are outside the image optimizer allowlist.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.title || previewTitle} className="aspect-square w-full object-cover" />
                  ) : (
                    <span className="line-clamp-5 flex aspect-square items-center bg-[#dce8ef] p-3 text-sm leading-relaxed text-[#3e6274]">
                      {previewTitle}
                    </span>
                  )}
                  <span className="block px-3 py-2.5">
                    <span className="line-clamp-2 block text-sm font-medium text-[#1e4d3a]">{previewTitle}</span>
                    {formattedDate ? <time dateTime={item.happenedOn || item.createdAt} className="mt-1 block text-xs text-[#82715f]">{formattedDate}</time> : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
