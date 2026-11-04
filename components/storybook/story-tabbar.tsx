import type { LifeStatus } from "@/lib/pet-first-archive";
import { type StoryTab } from "@/lib/story-tabs";
import Link from "next/link";

export type { StoryTab };

const TABS: StoryTab[] = ["home", "memories", "create", "context", "pet"];

export function StoryTabbar({
  current,
  labels,
  hrefs,
  lifeStatus = "unspecified",
}: {
  current: StoryTab;
  labels: Record<StoryTab, string>;
  hrefs: Record<StoryTab, string>;
  lifeStatus?: LifeStatus | null;
}) {
  const contextKind = lifeStatus ?? "unspecified";
  return (
    <nav aria-label="SoulTrace" className="st-tabbar">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-0.5 px-1 py-1">
        {TABS.map((tab) => (
          <Link key={tab} href={hrefs[tab]} prefetch={false} aria-current={current === tab ? "page" : undefined} className="st-tab relative z-[1]">
            <TabIcon tab={tab} contextKind={contextKind} />
            <span>{labels[tab]}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function TabIcon({ tab, contextKind }: { tab: StoryTab; contextKind: LifeStatus }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {tab === "home" ? (
        <>
          <path d="M4 11.5 12 5l8 6.5" />
          <path d="M6.5 10v8.5h11V10" />
          <path d="M10.5 18.5v-4h3v4" />
        </>
      ) : tab === "memories" ? (
        <>
          <rect x="4.5" y="6" width="6.5" height="6.5" rx="1.2" />
          <rect x="13" y="6" width="6.5" height="6.5" rx="1.2" />
          <rect x="4.5" y="14.5" width="6.5" height="4.5" rx="1.2" />
          <rect x="13" y="14.5" width="6.5" height="4.5" rx="1.2" />
        </>
      ) : tab === "create" ? (
        <>
          <path d="M12 3.5 13.6 9.2 19.5 10.8 13.6 12.4 12 18.1 10.4 12.4 4.5 10.8 10.4 9.2 12 3.5Z" />
          <path d="M18.2 16.2v4.2M16.1 18.3h4.2" />
        </>
      ) : tab === "context" && contextKind === "memorial" ? (
        <>
          <path d="M12 20s-6.5-4.2-6.5-9.1A4.4 4.4 0 0 1 12 7.2 4.4 4.4 0 0 1 18.5 10.9C18.5 15.8 12 20 12 20Z" />
          <path d="M12 7.2V4.4" />
        </>
      ) : tab === "context" ? (
        <>
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="2.2" />
          <path d="M12 4.5v2.2M12 17.3v2.2M4.5 12h2.2M17.3 12h2.2" />
        </>
      ) : (
        <>
          <circle cx="12" cy="13.5" r="3.5" />
          <circle cx="7" cy="9" r="1.8" />
          <circle cx="10.2" cy="6.2" r="1.8" />
          <circle cx="13.8" cy="6.2" r="1.8" />
          <circle cx="17" cy="9" r="1.8" />
        </>
      )}
    </svg>
  );
}
