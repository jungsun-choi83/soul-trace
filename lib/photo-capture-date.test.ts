import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCaptureDate, readOriginalCaptureDate } from "./photo-capture-date.ts";

function jpegWithOriginalDate(value: string): Uint8Array {
  const date = new TextEncoder().encode(`${value}\0`);
  const tiff = new Uint8Array(44 + date.length);
  const view = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49]);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, 1, true);
  view.setUint16(10, 0x8769, true);
  view.setUint16(12, 4, true);
  view.setUint32(14, 1, true);
  view.setUint32(18, 26, true);
  view.setUint32(22, 0, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 0x9003, true);
  view.setUint16(30, 2, true);
  view.setUint32(32, date.length, true);
  view.setUint32(36, 44, true);
  view.setUint32(40, 0, true);
  tiff.set(date, 44);

  const exifHeader = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0]);
  const app1Length = exifHeader.length + tiff.length + 2;
  const jpeg = new Uint8Array(2 + 2 + 2 + exifHeader.length + tiff.length + 2);
  jpeg.set([0xff, 0xd8, 0xff, 0xe1, app1Length >> 8, app1Length & 0xff]);
  jpeg.set(exifHeader, 6);
  jpeg.set(tiff, 6 + exifHeader.length);
  jpeg.set([0xff, 0xd9], jpeg.length - 2);
  return jpeg;
}

test("EXIF original capture dates normalize without converting the camera's calendar date", () => {
  assert.equal(normalizeCaptureDate("2021:08:09 23:45:00"), "2021-08-09");
  assert.equal(normalizeCaptureDate("2021-08-09T23:45:00+09:00"), "2021-08-09");
});

test("missing, malformed, and impossible EXIF dates stay unavailable", () => {
  assert.equal(normalizeCaptureDate(undefined), null);
  assert.equal(normalizeCaptureDate("2021:02:29 12:00:00"), null);
  assert.equal(normalizeCaptureDate("not a capture date"), null);
});

test("EXIF read failures and missing DateTimeOriginal are safe null results", async () => {
  const file = new Blob(["photo"]);
  assert.equal(await readOriginalCaptureDate(file, async () => ({ Make: "Camera" })), null);
  assert.equal(await readOriginalCaptureDate(file, async () => { throw new Error("bad metadata"); }), null);
});

test("the browser parser reads DateTimeOriginal from an EXIF JPEG", async () => {
  assert.equal(await readOriginalCaptureDate(jpegWithOriginalDate("2019:12:31 23:59:58")), "2019-12-31");
});

test("a corrected date remains distinct from the original detected date", async () => {
  const detected = await readOriginalCaptureDate(new Blob(), async () => ({ DateTimeOriginal: "2020:04:05 12:00:00" }));
  const corrected = "2020-04-06";
  assert.equal(detected, "2020-04-05");
  assert.equal(corrected, "2020-04-06");
});
