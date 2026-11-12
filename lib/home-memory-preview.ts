export type HomeMemoryPreview = {
  entryId: string;
  petId: string;
  kind: "photo" | "video" | "text";
  title: string | null;
  story: string | null;
  happenedOn: string | null;
  createdAt: string;
  imageUrl: string | null;
};

export function takeRecentRowsPerPet<T>(
  rows: readonly T[],
  petIdOf: (row: T) => string,
  limit = 6,
): T[] {
  const counts = new Map<string, number>();
  const recent: T[] = [];
  for (const row of rows) {
    const petId = petIdOf(row);
    const count = counts.get(petId) ?? 0;
    if (count >= limit) continue;
    counts.set(petId, count + 1);
    recent.push(row);
  }
  return recent;
}

export function recentMemoriesForPet<T extends HomeMemoryPreview>(items: readonly T[], petId: string | null): T[] {
  return petId ? items.filter((item) => item.petId === petId) : [];
}

export function homeMemoryPreviewTitle(item: Pick<HomeMemoryPreview, "title" | "story" | "kind">, lang: "ko" | "en"): string {
  const title = item.title?.trim();
  if (title) return title;
  const story = item.story?.trim();
  if (story) return story;
  if (lang === "ko") {
    return item.kind === "photo" ? "사진 기록" : item.kind === "video" ? "영상 기록" : "글 기록";
  }
  return item.kind === "photo" ? "Photo memory" : item.kind === "video" ? "Video memory" : "Written memory";
}

export function formatHomeMemoryDate(item: Pick<HomeMemoryPreview, "happenedOn" | "createdAt">, lang: "ko" | "en"): string | null {
  const value = item.happenedOn || item.createdAt;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}
