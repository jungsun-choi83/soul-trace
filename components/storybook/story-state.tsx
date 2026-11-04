import type { ReactNode } from "react";

import { StoryScene, type StorySceneName } from "./story-scene";

type StoryStateKind = "empty" | "loading" | "success" | "error";

export function StoryState({
  kind,
  title,
  body,
  scene,
  action,
}: {
  kind: StoryStateKind;
  title: string;
  body?: string;
  scene?: StorySceneName;
  action?: ReactNode;
}) {
  const role = kind === "error" ? "alert" : "status";
  return (
    <div role={role} aria-live={kind === "error" ? "assertive" : "polite"} className="st-card st-rise overflow-hidden text-center">
      {scene ? <StoryScene scene={scene} className="rounded-b-none" /> : null}
      <div className="px-5 py-7 sm:px-8">
        {kind === "loading" ? <StoryDots /> : <StoryMark kind={kind} />}
        <p className="st-headline mt-3 text-lg">{title}</p>
        {body ? <p className="st-body mx-auto mt-2 max-w-sm text-sm text-[color:var(--st-text-soft)]">{body}</p> : null}
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}

function StoryDots() {
  return (
    <span className="inline-flex gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((dot) => (
        <span key={dot} className="st-breathe size-2 rounded-full bg-[color:var(--st-accent)]" style={{ animationDelay: `${dot * 220}ms` }} />
      ))}
    </span>
  );
}

function StoryMark({ kind }: { kind: Exclude<StoryStateKind, "loading"> }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="mx-auto size-10 text-[color:var(--st-accent)]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {kind === "success" ? (
        <>
          <path d="M24 40c-9-6-15-11-15-19a8 8 0 0 1 15-4 8 8 0 0 1 15 4c0 8-6 13-15 19Z" />
          <path d="m18 23 4 4 8-8" />
        </>
      ) : kind === "error" ? (
        <>
          <circle cx="24" cy="24" r="15" />
          <path d="M24 16v10" />
          <path d="M24 32h.01" />
        </>
      ) : (
        <>
          <path d="M12 34c4-10 20-10 24 0" />
          <circle cx="17" cy="18" r="3" />
          <circle cx="31" cy="18" r="3" />
          <circle cx="11" cy="25" r="2.5" />
          <circle cx="37" cy="25" r="2.5" />
        </>
      )}
    </svg>
  );
}
