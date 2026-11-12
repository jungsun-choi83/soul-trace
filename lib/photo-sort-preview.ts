import { normalizeCaptureDate } from "./photo-capture-date.ts";

export type PhotoPreviewInput = { id: string; happenedOn: string };
export type PhotoMonthPreview<T extends PhotoPreviewInput> = {
  monthKey: string;
  photos: { photo: T; destinationDate: string }[];
  count: number;
};

export function currentUploadDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function groupPhotosForMonthPreview<T extends PhotoPreviewInput>(
  photos: T[],
  uploadDate: string,
): PhotoMonthPreview<T>[] {
  const fallback = normalizeCaptureDate(uploadDate) ?? currentUploadDate();
  const groups = new Map<string, { photo: T; destinationDate: string }[]>();
  for (const photo of photos) {
    const destinationDate = normalizeCaptureDate(photo.happenedOn) ?? fallback;
    const monthKey = destinationDate.slice(0, 7);
    const group = groups.get(monthKey) ?? [];
    group.push({ photo, destinationDate });
    groups.set(monthKey, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([monthKey, entries]) => ({ monthKey, photos: entries, count: entries.length }));
}
