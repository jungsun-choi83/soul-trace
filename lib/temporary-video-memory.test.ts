import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  MAX_TEMPORARY_VIDEO_BYTES,
  MAX_TEMPORARY_VIDEO_SECONDS,
  validateTemporaryVideoFile,
} from "./temporary-video-memory.ts";

const ui = readFileSync("components/temporary-video-memories.tsx", "utf8");
const archive = readFileSync("components/life-archive-preview.tsx", "utf8");
const photoUi = readFileSync("components/temporary-photo-moments.tsx", "utf8");
const en = JSON.parse(readFileSync("locales/en.json", "utf8"));
const ko = JSON.parse(readFileSync("locales/ko.json", "utf8"));

describe("temporary Life Archive video memories", () => {
  it("renders separate Add Photos and Add Video options", () => {
    assert.match(archive, /lifeArchive\.photos\.add/);
    assert.match(archive, /lifeArchive\.videos\.add/);
    assert.match(archive, /TemporaryVideoMemories/);
  });

  it("uses both actions as inline section shortcuts with focus", () => {
    assert.match(archive, /id="life-archive-video-upload"[\s\S]*ref=\{videoSectionRef\}/);
    assert.match(archive, /id="life-archive-photo-upload"[\s\S]*ref=\{photoSectionRef\}/);
    assert.match(archive, /section\?\.scrollIntoView\(\{ behavior: reducedMotion \? "auto" : "smooth", block: "start" \}\)/);
    assert.match(archive, /heading\?\.focus\(\{ preventScroll: true \}\)/);
    assert.match(archive, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)\.matches/);
    assert.match(archive, /aria-pressed=\{selectedMemoryType === "video"\}/);
    assert.match(archive, /aria-pressed=\{selectedMemoryType === "photos"\}/);
    assert.doesNotMatch(archive, /openVideoSection[\s\S]{0,300}inputRef|openPhotoSection[\s\S]{0,300}inputRef/);
    assert.doesNotMatch(archive, /router\.push|window\.open|role="dialog"/);
  });

  it("selects and previews exactly one mobile-compatible video", () => {
    assert.match(ui, /type="file" accept="video\/\*"/);
    assert.doesNotMatch(ui, /multiple/);
    assert.match(ui, /URL\.createObjectURL\(file\)/);
    assert.match(ui, /<video[\s\S]*controls[\s\S]*playsInline[\s\S]*preload="metadata"/);
    assert.doesNotMatch(ui, /autoPlay|autoplay|FileReader|base64|toDataURL/i);
  });

  it("replaces, removes, deletes, and cleans up every object URL", () => {
    assert.match(ui, /if \(current\) URL\.revokeObjectURL\(current\.url\)/);
    assert.match(ui, /removeSelected/);
    assert.match(ui, /deleteVideo/);
    assert.match(ui, /onError=\{rejectSelectedPreview\}/);
    assert.match(ui, /memoriesRef\.current\.forEach[\s\S]*URL\.revokeObjectURL/);
  });

  it("validates type, 50 MB size, 30 second duration, and preview support", () => {
    assert.equal(MAX_TEMPORARY_VIDEO_BYTES, 50 * 1024 * 1024);
    assert.equal(MAX_TEMPORARY_VIDEO_SECONDS, 30);
    assert.equal(validateTemporaryVideoFile({ type: "video/mp4", size: 1 }), null);
    assert.equal(validateTemporaryVideoFile({ type: "image/jpeg", size: 1 }), "unsupported");
    assert.equal(validateTemporaryVideoFile({ type: "video/mp4", size: MAX_TEMPORARY_VIDEO_BYTES + 1 }), "oversized");
    assert.match(ui, /probe\.duration > MAX_TEMPORARY_VIDEO_SECONDS/);
    assert.match(ui, /probe\.onerror[\s\S]*previewUnsupported/);
  });

  it("keeps the temporary in-memory fallback while secure mode uses the video API", () => {
    assert.doesNotMatch(ui, /sessionStorage|localStorage|indexedDB/i);
    assert.match(ui, /storageMode === "secure"/);
    assert.match(ui, /fetch\(videoApiUrl/);
    assert.match(ui, /storageMode === "temporary"[\s\S]*temporaryWarning/);
    assert.match(en.lifeArchive.videos.temporaryWarning, /refreshing or leaving/);
    assert.match(ko.lifeArchive.videos.temporaryWarning, /새로고침.*떠나면/);
    assert.equal(en.lifeArchive.videos.add, "Add Video");
    assert.equal(ko.lifeArchive.videos.add, "동영상 추가");
    assert.match(ui, /caption,/);
    assert.doesNotMatch(ui, /caption\.trim\(\)|translate/i);
  });

  it("leaves the existing photo and collage implementation intact", () => {
    assert.match(photoUi, /saveTemporaryPhotoMoment/);
    assert.match(photoUi, /storedPhotoLayoutForCount/);
    assert.match(photoUi, /layout=\{moment\.layout\}/);
    assert.match(photoUi, /multiple/);
  });
});
