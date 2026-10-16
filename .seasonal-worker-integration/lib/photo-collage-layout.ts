import type { PhotoCollageLayout } from "./temporary-photo-archive-indexeddb.ts";

export type AdaptivePhotoCollageLayout =
  | "empty"
  | "hero-frame"
  | "story-pair"
  | "polaroid-trio"
  | "scrapbook-stack"
  | "memory-wall";

const LAYOUTS_BY_PHOTO_COUNT: readonly AdaptivePhotoCollageLayout[] = [
  "empty",
  "hero-frame",
  "story-pair",
  "polaroid-trio",
  "scrapbook-stack",
  "memory-wall",
];

export function photoCollageLayoutForCount(count: number): AdaptivePhotoCollageLayout {
  if (!Number.isInteger(count) || count < 0 || count > 5) {
    throw new RangeError("A photo collage supports between zero and five photos.");
  }
  return LAYOUTS_BY_PHOTO_COUNT[count];
}

/** Keeps the existing persisted union while presentation is selected by count. */
export function storedPhotoLayoutForCount(count: number): PhotoCollageLayout {
  const adaptive = photoCollageLayoutForCount(count);
  if (adaptive === "memory-wall") return "classic-centre";
  if (adaptive === "scrapbook-stack") return "scrapbook";
  return "clean-grid";
}
