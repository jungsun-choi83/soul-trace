import type ko from "@/locales/ko.json";

export type Locale = "ko" | "en";

export type Messages = typeof ko;

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "ko" || value === "en";
}

/** dot-path: "hero.title" */
export function getMessage(messages: Messages, path: string): string {
  const parts = path.split(".");
  let current: unknown = messages;
  for (const p of parts) {
    if (current === null || typeof current !== "object" || !(p in current)) {
      return path;
    }
    current = (current as Record<string, unknown>)[p];
  }
  return typeof current === "string" ? current : path;
}
