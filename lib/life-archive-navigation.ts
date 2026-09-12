import type { ServerSearchParams } from "@/lib/search-params";

export type LifeArchiveOrigin = "letter" | "choose";

const LETTER_RETURN_PATHS = new Set(["/living", "/memorial", "/letter-result"]);
const ARCHIVE_ONLY_PARAMS = new Set(["from", "returnTo", "pet", "letter"]);

function firstValue(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function safeLetterReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/letter-result";
  try {
    const parsed = new URL(value, "https://soul-trace.invalid");
    return LETTER_RETURN_PATHS.has(parsed.pathname)
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/letter-result";
  } catch {
    return "/letter-result";
  }
}

export function resolveLifeArchiveNavigation(params: ServerSearchParams): {
  origin: LifeArchiveOrigin;
  backHref: string;
  archiveQuery: string;
} {
  const requestedOrigin = firstValue(params.from);
  const origin: LifeArchiveOrigin = requestedOrigin === "letter" ? "letter" : "choose";
  const preserved = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (ARCHIVE_ONLY_PARAMS.has(key)) continue;
    if (Array.isArray(value)) value.forEach((item) => preserved.append(key, item));
    else if (value !== undefined) preserved.append(key, value);
  }

  if (origin === "letter") {
    const returnTo = safeLetterReturnPath(firstValue(params.returnTo));
    preserved.set("from", "letter");
    preserved.set("returnTo", returnTo);
    return { origin, backHref: returnTo, archiveQuery: preserved.toString() };
  }

  if (requestedOrigin === "choose") preserved.set("from", "choose");
  const chooseContext = new URLSearchParams(preserved);
  chooseContext.delete("from");
  const query = chooseContext.toString();
  return {
    origin,
    backHref: query ? `/choose?${query}` : "/choose",
    archiveQuery: preserved.toString(),
  };
}
