export type SavedSeasonalPolaroid = {
  resultId: string;
  petName: string;
  species: string;
  status: string;
  themeId: string;
  costumeId: string;
  memoLines: [string, string, string, string];
  memoLocale: "ko" | "en";
  createdAt: string;
};

export async function fetchMyPolaroids(signal?: AbortSignal): Promise<SavedSeasonalPolaroid[]> {
  const response = await fetch("/api/my-polaroids", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });
  const body = await response.json().catch(() => null) as { results?: unknown; error?: unknown } | null;
  if (!response.ok) {
    const error = typeof body?.error === "string" ? body.error : "gallery_unavailable";
    throw new Error(error);
  }
  if (!Array.isArray(body?.results)) throw new Error("gallery_invalid_response");

  return body.results.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const lines = row.memoLines;
    if (
      typeof row.resultId !== "string" ||
      typeof row.petName !== "string" ||
      typeof row.species !== "string" ||
      typeof row.status !== "string" ||
      typeof row.themeId !== "string" ||
      typeof row.costumeId !== "string" ||
      !Array.isArray(lines) ||
      lines.length !== 4 ||
      !lines.every((line) => typeof line === "string") ||
      (row.memoLocale !== "ko" && row.memoLocale !== "en") ||
      typeof row.createdAt !== "string"
    ) return [];
    return [{
      resultId: row.resultId,
      petName: row.petName,
      species: row.species,
      status: row.status,
      themeId: row.themeId,
      costumeId: row.costumeId,
      memoLines: lines as [string, string, string, string],
      memoLocale: row.memoLocale,
      createdAt: row.createdAt,
    }];
  });
}

export function myPolaroidImageUrl(resultId: string): string {
  return `/api/account-result/seasonal-polaroid?resultId=${encodeURIComponent(resultId)}`;
}
