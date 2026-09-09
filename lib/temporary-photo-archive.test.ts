import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  isSupportedPhoto,
  MAX_PHOTOS_PER_MOMENT,
} from "./temporary-photo-archive-indexeddb.ts";

const ui = readFileSync("components/temporary-photo-moments.tsx", "utf8");
const storage = readFileSync("lib/temporary-photo-archive-indexeddb.ts", "utf8");
const archive = readFileSync("components/life-archive-preview.tsx", "utf8");
const en = JSON.parse(readFileSync("locales/en.json", "utf8"));
const ko = JSON.parse(readFileSync("locales/ko.json", "utf8"));

describe("temporary photo-first Life Archive", () => {
  it("accepts browser-compatible non-empty photos and rejects unsupported files", () => {
    assert.equal(isSupportedPhoto({ type: "image/jpeg", size: 1 }), true);
    assert.equal(isSupportedPhoto({ type: "image/png", size: 1 }), true);
    assert.equal(isSupportedPhoto({ type: "image/webp", size: 1 }), true);
    assert.equal(isSupportedPhoto({ type: "image/gif", size: 1 }), false);
    assert.equal(isSupportedPhoto({ type: "image/jpeg", size: 0 }), false);
    assert.equal(MAX_PHOTOS_PER_MOMENT, 5);
  });

  it("selects multiple photos, validates all 5, previews, removes, and reorders", () => {
    assert.match(ui, /type="file"[\s\S]*multiple/);
    assert.match(ui, /selected\.length \+ incoming\.length > MAX_PHOTOS_PER_MOMENT/);
    assert.match(ui, /canDecodePhoto/);
    assert.match(ui, /removeSelected/);
    assert.match(ui, /moveSelected\(index, -1\)/);
    assert.match(ui, /moveSelected\(index, 1\)/);
  });

  it("shows compact responsive thumbnails in a horizontally scrolling row", () => {
    assert.match(ui, /flex max-w-full[^"]*overflow-x-auto/);
    assert.match(ui, /h-20 w-20 sm:h-24 sm:w-24/);
    assert.match(ui, /rounded-xl object-cover/);
  });

  it("keeps compact remove, reorder, Add more, and count controls", () => {
    assert.match(ui, /absolute -right-1\.5 -top-1\.5[\s\S]*<span aria-hidden>×<\/span>/);
    assert.match(ui, /moveSelected\(index, -1\)/);
    assert.match(ui, /moveSelected\(index, 1\)/);
    assert.match(ui, /selected\.length < MAX_PHOTOS_PER_MOMENT/);
    assert.match(ui, /inputRef\.current\?\.click\(\)/);
    assert.equal(en.lifeArchive.photos.addMore, "Add more");
    assert.equal(ko.lifeArchive.photos.addMore, "더 추가");
    assert.equal(en.lifeArchive.photos.selectedCount, "%SELECTED% of %MAX% photos");
  });

  it("requires photos but keeps caption and date optional and exact", () => {
    assert.match(ui, /if \(!selected\.length\)/);
    assert.match(ui, /caption,/);
    assert.doesNotMatch(ui, /caption\.trim\(\)/);
    assert.match(ui, /memoryDate: memoryDate \|\| null/);
  });

  it("keeps the stored layout contract while presentation adapts automatically", () => {
    assert.match(ui, /storedPhotoLayoutForCount\(next\.length\)/);
    assert.match(ui, /photoCollageLayoutForCount\(urls\.length\)/);
    assert.match(storage, /Classic Centre requires exactly five photos/);
  });

  it("stores layout, order, and centre choice separately from original photos", () => {
    assert.match(storage, /layout: PhotoCollageLayout/);
    assert.match(storage, /centerPhotoId/);
    assert.match(storage, /photoSettings/);
    assert.match(storage, /photoIds/);
    assert.match(ui, /centerPhotoIndex/);
    assert.match(ui, /collagePreview/);
    assert.match(ui, /object-contain/);
    assert.match(ui, /object-cover/);
    assert.match(ui, /croppedEdges/);
    assert.match(ui, /positionX/);
    assert.match(ui, /positionY/);
    assert.match(ui, /zoom/);
  });

  it("stores records and original blobs separately in IndexedDB only", () => {
    assert.match(storage, /indexedDB\.open/);
    assert.match(storage, /photo-moments/);
    assert.match(storage, /photo-blobs/);
    assert.match(storage, /blob: file/);
    assert.doesNotMatch(storage, /canvas|toDataURL|resize|compress/i);
    assert.doesNotMatch(storage, /sessionStorage\.|localStorage\.|fetch\(/);
  });

  it("automatically fits complete photo compositions without user mode controls", () => {
    assert.match(ui, /object-contain/);
    assert.match(ui, /bg-\[#33251D\]/);
    assert.match(ui, /rotate-\[1deg\]/);
    assert.doesNotMatch(ui, /Fit Full Photo|Fill Frame/);
  });

  it("provides responsive collage layouts, gallery viewing, deletion, and clearing", () => {
    assert.match(ui, /photoCollageLayoutForCount\(urls\.length\)/);
    assert.match(ui, /adaptiveLayout === "hero-frame"/);
    assert.match(ui, /adaptiveLayout === "story-pair"/);
    assert.match(ui, /adaptiveLayout === "polaroid-trio"/);
    assert.match(ui, /adaptiveLayout === "scrapbook-stack"/);
    assert.match(ui, /setGallery/);
    assert.match(ui, /deleteTemporaryPhotoMoment/);
    assert.match(ui, /clearTemporaryPhotoMoments/);
    assert.match(storage, /blobStore\.delete\(cursor\.primaryKey\)/);
  });

  it("derives a compact Favorite Moments row from the original saved records", () => {
    assert.match(ui, /moments\.filter\(\(moment\) => moment\.isFavorite\)/);
    assert.match(ui, /favoriteMoments\.map/);
    assert.match(ui, /favoriteScrollRef/);
    assert.match(ui, /toggleFavorite\(moment\)/);
    assert.doesNotMatch(ui, /structuredClone|duplicate|cloneBlob/i);
  });

  it("revokes browser object URLs and preserves older text memories", () => {
    assert.match(ui, /URL\.revokeObjectURL/);
    assert.match(ui, /legacyMemories\.map/);
    assert.match(archive, /legacyMemories=\{memories\}/);
  });

  it("uses approved localized labels without translating stored content", () => {
    assert.equal(en.lifeArchive.photos.add, "Add Photos");
    assert.equal(ko.lifeArchive.photos.add, "사진 추가하기");
    assert.equal(en.lifeArchive.photos.save, "Save This Moment");
    assert.equal(ko.lifeArchive.photos.save, "이 순간 저장하기");
    assert.doesNotMatch(ui, /translate(Text|Content)|autoTranslate/i);
  });
});
