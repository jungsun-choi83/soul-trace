import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  photoCollageLayoutForCount,
  storedPhotoLayoutForCount,
} from "./photo-collage-layout.ts";

const ui = readFileSync("components/temporary-photo-moments.tsx", "utf8");
const storage = readFileSync("lib/temporary-photo-archive-indexeddb.ts", "utf8");

describe("adaptive Life Archive photo collage", () => {
  it("preserves the zero-photo empty state", () => {
    assert.equal(photoCollageLayoutForCount(0), "empty");
    assert.match(ui, /moments\.length === 0 && legacyMemories\.length === 0/);
  });

  it("selects one centralized layout for photo counts one through five", () => {
    assert.deepEqual([1, 2, 3, 4, 5].map(photoCollageLayoutForCount), [
      "hero-frame",
      "story-pair",
      "polaroid-trio",
      "scrapbook-stack",
      "memory-wall",
    ]);
    for (const name of ["hero-frame", "story-pair", "polaroid-trio", "scrapbook-stack", "memory-wall"]) {
      assert.match(ui, new RegExp(`adaptiveLayout === "${name}"|data-collage-layout=\\{adaptiveLayout\\}`));
    }
  });

  it("rejects more than five instead of discarding photos", () => {
    assert.throws(() => photoCollageLayoutForCount(6), RangeError);
    assert.match(ui, /selected\.length \+ incoming\.length > MAX_PHOTOS_PER_MOMENT/);
    assert.match(storage, /input\.files\.length > MAX_PHOTOS_PER_MOMENT/);
  });

  it("automatically changes presentation after additions and removals", () => {
    assert.match(ui, /setLayout\(storedPhotoLayoutForCount\(next\.length\)\)/);
    assert.equal(storedPhotoLayoutForCount(1), "clean-grid");
    assert.equal(storedPhotoLayoutForCount(4), "scrapbook");
    assert.equal(storedPhotoLayoutForCount(5), "classic-centre");
  });

  it("preserves ordered URLs and stored data without cropping", () => {
    assert.match(ui, /tile\(urls\[0\][\s\S]*tile\(urls\[1\][\s\S]*tile\(urls\[2\]/);
    assert.match(ui, /photoIds\[index\]/);
    assert.match(ui, /h-auto w-full object-contain/);
    assert.doesNotMatch(ui, /urls\.sort|urls\.splice|object-cover[^\n]*CollageImage/);
    assert.match(storage, /photoIds: string\[\]/);
    assert.match(storage, /photoSettings/);
  });

  it("keeps fullscreen originals, favorite, and safe delete behavior", () => {
    assert.match(ui, /moment\.urls\[index\][\s\S]*max-h-\[82vh\] max-w-full object-contain/);
    assert.match(ui, /toggleFavorite\(moment\)/);
    assert.match(ui, /setDeleteTarget\(moment\)/);
    assert.match(ui, /deleteConfirm/);
  });

  it("reduces overlap on mobile and retains the 700px desktop boundary", () => {
    assert.match(ui, /max-w-\[700px\]/);
    assert.match(ui, /grid-cols-2/);
    assert.match(ui, /sm:translate|sm:-translate/);
    assert.match(ui, /overflow-hidden/);
    assert.match(ui, /index % 2 \? "rotate-\[1deg\]" : "-rotate-\[1deg\]"/);
  });

  it("continues to render existing saved photo memories", () => {
    assert.match(ui, /visibleMoments\.map/);
    assert.match(ui, /PhotoCollage urls=\{moment\.urls\}/);
    assert.match(ui, /data-stored-layout=\{layout\}/);
  });
});
