import exifr from "exifr";

const { parse } = exifr;

export function normalizeCaptureDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})[:\-](\d{2})[:\-](\d{2})(?:\b|T|\s|$)/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const candidate = `${year}-${month}-${day}`;
  const date = new Date(`${candidate}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === candidate
    ? candidate
    : null;
}

type MetadataParser = (file: Blob | Uint8Array) => Promise<unknown>;

export async function readOriginalCaptureDate(
  file: Blob | Uint8Array,
  metadataParser: MetadataParser = (input) => parse(input, {
    exif: { pick: ["DateTimeOriginal"], reviveValues: false },
    tiff: { pick: ["DateTimeOriginal"], reviveValues: false },
    xmp: { pick: ["DateTimeOriginal"], reviveValues: false },
    iptc: false,
    icc: false,
    gps: false,
    reviveValues: false,
  }),
): Promise<string | null> {
  try {
    const metadata = await metadataParser(file);
    if (!metadata || typeof metadata !== "object") return null;
    return normalizeCaptureDate((metadata as Record<string, unknown>).DateTimeOriginal);
  } catch {
    return null;
  }
}
