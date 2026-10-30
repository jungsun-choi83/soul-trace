import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import * as nodeModule from "node:module";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium, webkit, type Browser } from "playwright";

/**
 * Visual consistency of the three Polaroid surfaces, rendered for real:
 *
 *   result page card  →  gallery card  →  downloaded PNG
 *
 * The test compiles the real `SeasonalPolaroidFrame` component and the real
 * Tailwind utilities it uses, serves them with the real template image and
 * the real export module, and drives the system Chrome through Playwright.
 * It then checks that caption lines land in the same relative positions on
 * both cards, that both cards export to the same 1080 × 1620 pixels, that the
 * file contains the template corners (no tilt crop), the photo, and the
 * caption exactly where the page shows it. Desktop and phone viewports,
 * English and Korean, typical and maximum-length captions.
 *
 * Skipped when no Chrome channel is available (for example a bare CI box).
 */
const { createRequire } = nodeModule;
const stripTypeScriptTypes = (nodeModule as unknown as { stripTypeScriptTypes: (code: string, options: { mode: "strip" }) => string }).stripTypeScriptTypes;
const require = createRequire(resolve(process.cwd(), "package.json"));
const OUT_DIR = process.env.SOUL_TRACE_VISUAL_OUT ?? join(tmpdir(), "soul-trace-visual");

type Scenario = { id: string; lang: "en" | "ko"; lines: [string, string, string, string] };
const SCENARIOS: Scenario[] = [
  { id: "en-max", lang: "en", lines: ["Mom and Dad, happy Halloween from Maximiliano1!", "I feel zoomie-filled in pumpkin orange,", "while I carry my toy, cheese close by.", "This tiny moment feels like home."] },
  { id: "en-typical", lang: "en", lines: ["Mom, happy Halloween from Chime!", "I'm ready for cozy naps tonight", "with my bat wings and big grin,", "and this spooky night feels like home."] },
  { id: "ko-max", lang: "ko", lines: ["엄마와 아빠, 뚜리뚜리뚜리뚜리뚜리뚜리야! 해피 할로윈!", "오늘은 작은 뱀파이어 옷 입었어,", "좋아하는 루틴을 지키고 참치도 좋아해.", "사랑스러운 순간 하나를 담았어."] },
  { id: "ko-typical", lang: "ko", lines: ["엄마, 뚜리야! 해피 할로윈!", "오늘은 호박 옷 입고,", "낙엽 위에서 코 킁킁,", "이런 할로윈이 제일 좋아."] },
];

async function compileFrameModule(): Promise<string> {
  const swc = require("next/dist/build/swc") as {
    loadBindings: () => Promise<unknown>;
    transform: (code: string, options: Record<string, unknown>) => Promise<{ code: string }>;
  };
  await swc.loadBindings();
  const source = readFileSync("components/seasonal-polaroid-frame.tsx", "utf8");
  const { code } = await swc.transform(source, {
    filename: "seasonal-polaroid-frame.tsx",
    jsc: { parser: { syntax: "typescript", tsx: true }, transform: { react: { runtime: "automatic" } }, target: "es2022" },
    module: { type: "es6" },
  });
  return code;
}

async function compileFrameCss(): Promise<string> {
  const { compile } = await import(require.resolve("@tailwindcss/node")) as {
    compile: (css: string, options: { base: string; onDependency: (path: string) => void }) => Promise<{ build: (candidates: string[]) => string }>;
  };
  const compiler = await compile('@import "tailwindcss";', { base: process.cwd(), onDependency: () => {} });
  const source = readFileSync("components/seasonal-polaroid-frame.tsx", "utf8");
  const candidates = [...new Set(source.split(/[\s"'`${}]+/).filter(Boolean))];
  const fonts = [
    "@import url('https://fonts.googleapis.com/css2?family=Marcellus&family=Noto+Serif+KR:wght@200;400&display=swap');",
    ".font-display-en{font-family:Marcellus,\"Marcellus\",serif;letter-spacing:.3em;font-weight:400}",
    ".font-ko{font-family:\"Noto Serif KR\",serif;font-weight:200;letter-spacing:.02em}",
  ].join("\n");
  return `${fonts}\n${compiler.build(candidates)}`;
}

function exportModuleSource(): string {
  const stripped = stripTypeScriptTypes(readFileSync("lib/seasonal-polaroid-export.ts", "utf8"), { mode: "strip" });
  return stripped.replace(/from "html-to-image"/, 'from "/html-to-image/es/index.js"');
}

function htmlToImageFile(file: string): string | null {
  const path = resolve("node_modules/html-to-image/es", file);
  if (!existsSync(path)) return null;
  // The ES build uses extension-less relative imports, which browsers reject.
  return readFileSync(path, "utf8").replace(/from '(\.\/[^']+)'/g, (match, spec: string) => spec.endsWith(".js") ? match : `from '${spec}.js'`);
}

function harnessHtml(frameModule: { SeasonalPolaroidFrame: unknown; SEASONAL_POLAROID_FRAME_BASE_CLASS: string }): string {
  const t = (key: string) => key;
  const cards = SCENARIOS.flatMap((scenario) => [
    // Result page: a 430px column on desktop, the viewport minus padding on a phone.
    { kind: "result", scenario, className: undefined, wrap: "width:min(430px,calc(100vw - 40px))" },
    // Gallery: one of three grid columns on desktop, a single full-width card on a phone.
    { kind: "gallery", scenario, className: `${frameModule.SEASONAL_POLAROID_FRAME_BASE_CLASS} mx-auto max-w-[440px]`, wrap: "width:min(300px,calc(100vw - 40px))" },
  ]).map(({ kind, scenario, className, wrap }) => {
    const markup = renderToStaticMarkup(createElement(frameModule.SeasonalPolaroidFrame as never, {
      lang: scenario.lang,
      t,
      imageUrl: "/pet.png",
      memoLines: scenario.lines,
      showMemo: true,
      placeholder: false,
      ...(className ? { className } : {}),
    }));
    return `<div style="${wrap}" data-card="${kind}" data-scenario="${scenario.id}">${markup}</div>`;
  }).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Polaroid visual harness</title><link rel="stylesheet" href="/frame.css">
<style>body{margin:0;padding:20px;background:#111;display:flex;flex-wrap:wrap;gap:24px;align-items:flex-start}</style>
</head><body>${cards}
<script type="module">
import { renderSeasonalPolaroidCanvas } from "/export.js";
import { toCanvas, getFontEmbedCSS } from "/html-to-image/es/index.js";
// React 19 hoists image preload <link>s before the element, so pick the frame div itself.
const frameOf = (card) => card.querySelector("div");
// The real component fits each caption line in a layout effect; the static
// harness runs the same exported function after fonts load.
import { fitCaptionLines } from "/frame-fit.js";
import { splitCaptionGreeting } from "/frame-fit.js";
await document.fonts.ready;
for (const memo of document.querySelectorAll('[class*="2.5cqw"]')) {
  if (!fitCaptionLines(memo)) {
    // Same rule as the component: at the floor, an over-long greeting gets a second explicit line.
    const first = memo.querySelector("p"); const split = splitCaptionGreeting(first.textContent);
    if (split) { const second = first.cloneNode(false); first.textContent = split[0]; second.textContent = split[1]; first.after(second); fitCaptionLines(memo); }
  }
}
window.__measure = async () => {
  await document.fonts.ready;
  const result = {};
  for (const card of document.querySelectorAll("[data-card]")) {
    const frame = frameOf(card);
    const saved = { transform: frame.style.transform, rotate: frame.style.rotate };
    frame.style.transition = "none"; frame.style.transform = "none"; frame.style.rotate = "none";
    const box = frame.getBoundingClientRect();
    // Only the caption paragraphs: the photo window also holds an invisible "developing" overlay <p>.
    const memo = frame.querySelector('[class*="2.5cqw"]');
    const lines = [...memo.querySelectorAll("p")].flatMap((p) => {
      const range = document.createRange(); range.selectNodeContents(p);
      return [...range.getClientRects()].map((r) => ({ left: (r.left - box.left) / box.width, right: (r.right - box.left) / box.width, top: (r.top - box.top) / box.height, bottom: (r.bottom - box.top) / box.height }));
    });
    frame.style.transform = saved.transform; frame.style.rotate = saved.rotate;
    const minFontPx = Math.min(...[...memo.querySelectorAll("p")].map((p) => parseFloat(getComputedStyle(p).fontSize)));
    result[card.dataset.scenario + ":" + card.dataset.card] = { width: box.width, height: box.height, fontPx: parseFloat(getComputedStyle(memo).fontSize), minFontPx, lines };
  }
  return result;
};
const stats = (canvas) => {
  const g = canvas.getContext("2d");
  const px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3);
  // Caption window (19%..81% × 70.6%..81%). Caption ink is dark and neutral
  // (#49372A); the leaves beside it are dark but saturated, so chroma excludes them.
  const X0 = 205, X1 = 875, Y0 = 1144, Y1 = 1312;
  const band = g.getImageData(X0, Y0, X1 - X0, Y1 - Y0).data;
  let minX = 1080, maxX = 0, minY = 1620, maxY = 0, ink = 0;
  for (let y = 0; y < Y1 - Y0; y += 1) for (let x = 0; x < X1 - X0; x += 1) {
    const i = (y * (X1 - X0) + x) * 4; const r = band[i], gg = band[i + 1], b = band[i + 2];
    const l = (r + gg + b) / 3; const chroma = Math.max(r, gg, b) - Math.min(r, gg, b);
    if (l < 130 && chroma < 45) { ink += 1; const ax = X0 + x, ay = Y0 + y; if (ax < minX) minX = ax; if (ax > maxX) maxX = ax; if (ay < minY) minY = ay; if (ay > maxY) maxY = ay; }
  }
  const photo = g.getImageData(540, 650, 1, 1).data;
  return { corners: [px(3, 3), px(1076, 3), px(3, 1616), px(1076, 1616)], ink, captionBox: ink ? { left: minX / 1080, right: maxX / 1080, top: minY / 1620, bottom: maxY / 1620 } : null, photoPixel: [photo[0], photo[1], photo[2]], flowerPixel: px(150, 230) };
};
window.__exports = {};
window.__export = async (scenario, withDataUrl) => {
  const out = {};
  const canvases = {};
  window.__exports[scenario] = canvases;
  for (const kind of ["result", "gallery"]) {
    const frame = frameOf(document.querySelector('[data-scenario="' + scenario + '"][data-card="' + kind + '"]'));
    const canvas = await renderSeasonalPolaroidCanvas(frame);
    canvases[kind] = canvas;
    out[kind] = { width: canvas.width, height: canvas.height, ...stats(canvas), ...(withDataUrl ? { dataUrl: canvas.toDataURL("image/png") } : {}) };
  }
  // Before: the previous export captured the tilted node as displayed and enlarged it.
  const resultFrame = frameOf(document.querySelector('[data-scenario="' + scenario + '"][data-card="result"]'));
  const legacy = await toCanvas(resultFrame, { cacheBust: false, pixelRatio: 1, backgroundColor: "#F2E8D7", skipFonts: false });
  const legacyOut = document.createElement("canvas"); legacyOut.width = 1080; legacyOut.height = 1620;
  legacyOut.getContext("2d").drawImage(legacy, 0, 0, 1080, 1620);
  out.legacy = { ...stats(legacyOut), ...(withDataUrl ? { dataUrl: legacyOut.toDataURL("image/png") } : {}) };
  // Isolate the caption ink: export once more with the caption hidden and diff.
  const memo = resultFrame.querySelector('[class*="2.5cqw"]');
  memo.style.visibility = "hidden";
  const blank = await renderSeasonalPolaroidCanvas(resultFrame);
  memo.style.visibility = "";
  const withText = canvases.result.getContext("2d").getImageData(0, 0, 1080, 1620).data;
  const without = blank.getContext("2d").getImageData(0, 0, 1080, 1620).data;
  let cMinX = 1080, cMaxX = 0, cMinY = 1620, cMaxY = 0, captionPixels = 0; const rowInk = new Array(1620).fill(0);
  for (let y = 0; y < 1620; y += 1) for (let x = 0; x < 1080; x += 1) {
    const i = (y * 1080 + x) * 4;
    if (Math.abs(withText[i] - without[i]) + Math.abs(withText[i + 1] - without[i + 1]) + Math.abs(withText[i + 2] - without[i + 2]) > 90) {
      captionPixels += 1; rowInk[y] += 1; if (x < cMinX) cMinX = x; if (x > cMaxX) cMaxX = x; if (y < cMinY) cMinY = y; if (y > cMaxY) cMaxY = y;
    }
  }
  // Text lines in the file: runs of inked rows separated by at least three blank rows at 1080 × 1620.
  let fileLines = 0, blankRows = 3; for (const n of rowInk) { if (n > 0) { if (blankRows >= 3) fileLines += 1; blankRows = 0; } else blankRows += 1; }
  out.captionInk = captionPixels ? { left: cMinX / 1080, right: cMaxX / 1080, top: cMinY / 1620, bottom: cMaxY / 1620, pixels: captionPixels, lines: fileLines } : null;
  // Per DOM line: the ink x-extent inside that line's vertical band.
  const memoRect = (() => { const saved = { t: resultFrame.style.transform, r: resultFrame.style.rotate }; resultFrame.style.transform = "none"; resultFrame.style.rotate = "none"; const box = resultFrame.getBoundingClientRect(); const rows = [...memo.querySelectorAll("p")].flatMap((p) => { const range = document.createRange(); range.selectNodeContents(p); return [...range.getClientRects()].map((r) => ({ left: (r.left - box.left) / box.width, right: (r.right - box.left) / box.width, top: (r.top - box.top) / box.height, bottom: (r.bottom - box.top) / box.height })); }); resultFrame.style.transform = saved.t; resultFrame.style.rotate = saved.r; return rows; })();
  out.lineInk = memoRect.map((line) => {
    let lMin = 1080, lMax = 0, count = 0;
    // Inner 60% of the line box: with 1.1 leading, neighbouring ascenders and
    // descenders reach into the outer rows and would skew the measurement.
    const inset = (line.bottom - line.top) * 0.2;
    for (let y = Math.round((line.top + inset) * 1620); y < Math.round((line.bottom - inset) * 1620); y += 1) for (let x = 0; x < 1080; x += 1) {
      const i = (y * 1080 + x) * 4;
      if (Math.abs(withText[i] - without[i]) + Math.abs(withText[i + 1] - without[i + 1]) + Math.abs(withText[i + 2] - without[i + 2]) > 90) { count += 1; if (x < lMin) lMin = x; if (x > lMax) lMax = x; }
    }
    return { dom: line, ink: count ? { left: lMin / 1080, right: lMax / 1080 } : null };
  });
  // Diagnostics: did font embedding succeed, and what does the caption band look like at full resolution?
  try {
    const embedded = await getFontEmbedCSS(resultFrame);
    const expectedFont = scenario.startsWith("ko") ? /Noto Serif KR/i : /Marcellus/i;
    out.fontEmbed = expectedFont.test(embedded) ? "ok" : "caption font missing from embedded CSS (" + embedded.length + " chars)";
  } catch (error) { out.fontEmbed = "failed: " + (error && error.message); }
  const overlay = resultFrame.querySelector('[class*="transition-opacity"]');
  out.overlay = { computedOpacity: getComputedStyle(overlay).opacity, exportPixel: Array.from(canvases.result.getContext("2d").getImageData(540, 760, 1, 1).data).slice(0, 3), blankPixel: Array.from(blank.getContext("2d").getImageData(540, 760, 1, 1).data).slice(0, 3) };
  const a = withText;
  const b = canvases.gallery.getContext("2d").getImageData(0, 0, 1080, 1620).data;
  let sum = 0, differing = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
    sum += d; if (d > 48) differing += 1;
  }
  out.diff = { meanAbs: sum / (a.length / 4), differingFraction: differing / (a.length / 4) };
  const template = new Image(); template.src = "/template.png"; await template.decode();
  const tc = document.createElement("canvas"); tc.width = 1080; tc.height = 1620; tc.getContext("2d").drawImage(template, 0, 0, 1080, 1620);
  out.templateCorners = stats(tc).corners;
  return out;
};
// The real check: the pixels the person sees (a screenshot of the flat card)
// against the pixels in the file, at the same size.
window.__compare = async (screenshotBase64, scenario, region) => {
  const shot = new Image(); shot.src = "data:image/png;base64," + screenshotBase64; await shot.decode();
  const w = shot.naturalWidth, h = shot.naturalHeight;
  const S = document.createElement("canvas"); S.width = w; S.height = h; S.getContext("2d").drawImage(shot, 0, 0);
  const E = document.createElement("canvas"); E.width = w; E.height = h; const eg = E.getContext("2d"); eg.imageSmoothingQuality = "high"; eg.drawImage(window.__exports[scenario].result, 0, 0, w, h);
  const a = S.getContext("2d").getImageData(0, 0, w, h).data, b = eg.getImageData(0, 0, w, h).data;
  let sum = 0, differing = 0;
  const box = (d) => {
    let mn = w, mx = 0, tn = h, tx = 0, n = 0; const rows = [];
    // Scan only the region the page's caption lines occupy (plus a margin), so leaf
    // stems beside the window cannot skew the ink box on either surface.
    for (let y = Math.round(h * region.top); y < Math.round(h * region.bottom); y += 1) { let rowInk = 0; for (let x = Math.round(w * region.left); x < Math.round(w * region.right); x += 1) { const i = (y * w + x) * 4; const l = (d[i] + d[i + 1] + d[i + 2]) / 3; const chroma = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); if (l < 130 && chroma < 45) { n += 1; rowInk += 1; if (x < mn) mn = x; if (x > mx) mx = x; if (y < tn) tn = y; if (y > tx) tx = y; } } rows.push(rowInk); }
    // Count text lines as runs of inked rows separated by at least two blank rows.
    let lines = 0, blank = 2; for (const rowInk of rows) { if (rowInk > 0) { if (blank >= 2) lines += 1; blank = 0; } else blank += 1; }
    return n ? { left: mn / w, right: mx / w, top: tn / h, bottom: tx / h, pixels: n, lines } : null;
  };
  for (let i = 0; i < a.length; i += 4) { const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3; sum += d; if (d > 48) differing += 1; }
  return { size: w + "x" + h, meanAbs: sum / (a.length / 4), differingFraction: differing / (a.length / 4), captionOnScreen: box(a), captionInFile: box(b) };
};
window.__ready = true;
</script></body></html>`;
}

async function startServer(html: string, css: string, fitModule: string): Promise<{ server: Server; origin: string }> {
  const template = readFileSync("public/images/soul_trace_seasonal_polaroid_blank_caption_template.png");
  const petCandidates = ["public/images/Golden Floral Haze Background.png", "public/og-cover.png"];
  const pet = readFileSync(petCandidates.find((path) => existsSync(path)) ?? "public/images/soul_trace_seasonal_polaroid_blank_caption_template.png");
  const exporter = exportModuleSource();
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const send = (status: number, type: string, body: string | Buffer) => { response.writeHead(status, { "content-type": type }); response.end(body); };
    if (url.pathname === "/") return send(200, "text/html; charset=utf-8", html);
    if (url.pathname === "/frame.css") return send(200, "text/css", css);
    if (url.pathname === "/template.png") return send(200, "image/png", template);
    if (url.pathname === "/pet.png") return send(200, "image/png", pet);
    if (url.pathname === "/images/soul_trace_seasonal_polaroid_blank_caption_template.png") return send(200, "image/png", template);
    if (url.pathname === "/export.js") return send(200, "text/javascript", exporter);
    if (url.pathname === "/frame-fit.js") return send(200, "text/javascript", fitModule);
    if (url.pathname.startsWith("/html-to-image/es/")) {
      const file = htmlToImageFile(url.pathname.slice("/html-to-image/es/".length));
      return file === null ? send(404, "text/plain", "missing") : send(200, "text/javascript", file);
    }
    return send(404, "text/plain", `not found: ${url.pathname} ${extname(url.pathname)}`);
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { server, origin: `http://127.0.0.1:${port}` };
}

function savePng(name: string, dataUrl: string | undefined): void {
  if (!dataUrl) return;
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), Buffer.from(dataUrl.split(",")[1]!, "base64"));
}

const near = (a: number, b: number, tolerance: number, label: string) => assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a.toFixed(4)} vs ${b.toFixed(4)} (tolerance ${tolerance})`);
const colorNear = (a: number[], b: number[], tolerance: number) => a.every((channel, index) => Math.abs(channel - b[index]!) <= tolerance);

/**
 * Both engines must pass. WebKit is Safari's engine and the engine of every
 * browser on iOS; it paints html-to-image's SVG before the `<img>` data inside
 * it has loaded, which is why the exporter draws the template and the photo
 * natively. Install it once with `npx playwright install webkit`.
 */
const ENGINES = [
  { name: "chrome", launch: () => chromium.launch({ channel: "chrome", headless: true }) },
  { name: "webkit", launch: () => webkit.launch({ headless: true }) },
];

test("result card, gallery card, and downloaded PNG are one composition", { timeout: 900_000 }, async (t) => {
  // Opt in: this drives real browsers for a few minutes. `npm run test:visual`.
  if (process.env.SOUL_TRACE_VISUAL !== "1") {
    t.skip("set SOUL_TRACE_VISUAL=1 (npm run test:visual) to run the browser-based visual check");
    return;
  }
  let server: Server | undefined;
  const summary: string[] = [];
  try {
    const [frameCode, css] = await Promise.all([compileFrameModule(), compileFrameCss()]);
    const modulePath = join(OUT_DIR, "seasonal-polaroid-frame.compiled.mjs");
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(modulePath, frameCode
      .replace(/from "react\/jsx-runtime"/, `from "${require.resolve("react/jsx-runtime")}"`)
      .replace(/from "react";/, `from "${require.resolve("react")}";`));
    const frameModule = await import(modulePath) as { SeasonalPolaroidFrame: unknown; SEASONAL_POLAROID_FRAME_BASE_CLASS: string };
    const html = harnessHtml(frameModule);
    writeFileSync(join(OUT_DIR, "harness.html"), html);
    // Browser copy of the fit routine: the compiled frame module minus its React/JSX parts.
    const fitModule = frameCode
      .replace(/^.*from "react\/jsx-runtime";/m, "")
      .replace(/^"use client";/m, "")
      .replace(/export function SeasonalPolaroidFrame[\s\S]*$/m, "")
      .replace(/import \{[^}]*\} from "react";/g, "");
    const started = await startServer(html, css, fitModule);
    server = started.server;
    const origin = started.origin;
    for (const engine of ENGINES) {
    let browser: Browser;
    try {
      browser = await engine.launch();
    } catch (error) {
      assert.fail(`${engine.name} is not available for the visual check (${error instanceof Error ? error.message.split("\n")[0] : "unknown"}); install it with \`npx playwright install ${engine.name === "chrome" ? "chrome" : engine.name}\``);
    }
    try {
    // Desktop at device scale 1 is the harshest case for on-screen glyph snapping;
    // phones render at scale 3, which is what their screenshots must reflect.
    for (const viewport of [{ name: "desktop", width: 1280, height: 900, scale: 1 }, { name: "phone", width: 390, height: 844, scale: 3 }]) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.scale });
      const label = `${engine.name} ${viewport.name}`;
      const progress = (step: string) => { if (process.env.SOUL_TRACE_VISUAL_DEBUG) console.error(`[visual] ${label}: ${step}`); };
      page.on("pageerror", (error) => console.error(`[visual] page error: ${error.message}`));
      page.on("console", (message) => { if (message.type() === "error" && !/favicon/.test(message.location().url ?? "")) console.error(`[visual] console: ${message.text()} ${message.location().url}`); });
      await page.goto(`${origin}/`, { waitUntil: "load" });
      progress("loaded");
      await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, undefined, { timeout: 60_000 });
      progress("ready");
      await page.evaluate(() => document.fonts.ready);
      const measured = await page.evaluate(() => (window as unknown as { __measure: () => Promise<Record<string, { width: number; height: number; fontPx: number; minFontPx: number; lines: Array<{ left: number; right: number; top: number; bottom: number }> }>> }).__measure());
      await page.screenshot({ path: join(OUT_DIR, `page-${engine.name}-${viewport.name}.png`), fullPage: true });
      writeFileSync(join(OUT_DIR, `measured-${engine.name}-${viewport.name}.json`), JSON.stringify(measured, null, 1));
      const fontStatus = await page.evaluate(() => ({ marcellus: document.fonts.check("12px Marcellus", "Mom"), notoSerifKr: document.fonts.check("12px 'Noto Serif KR'", "뚜리") }));
      writeFileSync(join(OUT_DIR, `fonts-${engine.name}-${viewport.name}.json`), JSON.stringify(fontStatus));

      for (const scenario of SCENARIOS) {
        progress(`scenario ${scenario.id}`);
        const result = measured[`${scenario.id}:result`]!;
        const gallery = measured[`${scenario.id}:gallery`]!;
        // 1. Same caption layout on both cards, relative to the card.
        assert.equal(result.lines.length, gallery.lines.length, `${label} ${scenario.id}: visual line count differs between result and gallery`);
        assert.ok(result.lines.length === 4 || result.lines.length === 5, `${label} ${scenario.id}: caption has ${result.lines.length} visual lines`);
        // Readability floor: no line below 80% of the base size on screen.
        assert.ok(result.minFontPx >= result.fontPx * 0.8 - 0.01, `${label} ${scenario.id}: smallest line is ${result.minFontPx.toFixed(2)}px, below the floor`);
        result.lines.forEach((line, index) => {
          const other = gallery.lines[index]!;
          for (const edge of ["left", "right", "top", "bottom"] as const) near(line[edge], other[edge], 0.012, `${label} ${scenario.id} line ${index + 1} ${edge}`);
        });
        near(result.fontPx / result.width, gallery.fontPx / gallery.width, 0.0005, `${label} ${scenario.id} font ratio`);

        // 2. Both cards export to the same file.
        const exported = await page.evaluate((id) => (window as unknown as { __export: (id: string, withDataUrl: boolean) => Promise<unknown> }).__export(id, true), scenario.id) as unknown as {
          result: { width: number; height: number; corners: number[][]; ink: number; captionBox: { left: number; right: number; top: number; bottom: number } | null; photoPixel: number[]; flowerPixel: number[]; dataUrl?: string };
          gallery: { corners: number[][]; captionBox: { left: number; right: number; top: number; bottom: number } | null; dataUrl?: string };
          legacy: { corners: number[][]; captionBox: { left: number; right: number; top: number; bottom: number } | null; dataUrl?: string };
          diff: { meanAbs: number; differingFraction: number };
          templateCorners: number[][];
          captionInk: { left: number; right: number; top: number; bottom: number; pixels: number; lines: number } | null;
          fontEmbed: string;
          lineInk: Array<{ dom: { left: number; right: number; top: number; bottom: number }; ink: { left: number; right: number } | null }>;
          overlay: { computedOpacity: string; exportPixel: number[]; blankPixel: number[] };
        };
        if (viewport.name === "desktop") {
          savePng(`${engine.name}-${scenario.id}-result-export.png`, exported.result.dataUrl);
          savePng(`${engine.name}-${scenario.id}-gallery-export.png`, exported.gallery.dataUrl);
          savePng(`${engine.name}-${scenario.id}-legacy-export.png`, exported.legacy.dataUrl);

        }
        assert.equal(exported.result.width, 1080);
        assert.equal(exported.result.height, 1620);
        assert.ok(exported.diff.meanAbs < 4, `${label} ${scenario.id}: result and gallery exports differ (mean ${exported.diff.meanAbs.toFixed(2)})`);
        assert.ok(exported.diff.differingFraction < 0.015, `${label} ${scenario.id}: ${(exported.diff.differingFraction * 100).toFixed(2)}% of pixels differ between result and gallery exports`);

        // 3. The file holds the whole template (no tilt crop), the photo, and the decorations.
        for (const [index, corner] of exported.result.corners.entries()) {
          assert.ok(colorNear(corner, exported.templateCorners[index]!, 20), `${label} ${scenario.id}: export corner ${index} is ${corner} but the template corner is ${exported.templateCorners[index]}`);
        }
        assert.ok(!colorNear(exported.result.photoPixel, [242, 232, 215], 12), `${label} ${scenario.id}: photo window is empty in the export`);
        assert.ok(!colorNear(exported.result.flowerPixel, [242, 232, 215], 12), `${label} ${scenario.id}: decorative flowers missing in the export`);

        writeFileSync(join(OUT_DIR, `fontembed-${engine.name}-${viewport.name}-${scenario.id}.txt`), exported.fontEmbed);
        assert.equal(exported.fontEmbed, "ok", `${label} ${scenario.id}: font embedding failed, export would fall back to system fonts`);
        // 4. What the person sees versus what the file holds, at the same size.
        const handle = await page.$(`[data-scenario="${scenario.id}"][data-card="result"] div`);
        assert.ok(handle);
        await handle!.evaluate((el) => { const e = el as HTMLElement; e.style.transition = "none"; e.style.rotate = "none"; e.style.transform = "none"; e.style.boxShadow = "none"; e.style.borderRadius = "0"; });
        const shot = await handle!.screenshot({ type: "png" });
        await handle!.evaluate((el) => { const e = el as HTMLElement; e.style.rotate = ""; e.style.transform = ""; e.style.boxShadow = ""; e.style.borderRadius = ""; });
        if (viewport.name === "desktop") {
          writeFileSync(join(OUT_DIR, `${engine.name}-${scenario.id}-result-onscreen.png`), shot);
        }
        const region = {
          left: Math.max(0, Math.min(...result.lines.map((line) => line.left)) - 0.02),
          right: Math.min(1, Math.max(...result.lines.map((line) => line.right)) + 0.02),
          top: Math.min(...result.lines.map((line) => line.top)) - 0.005,
          bottom: Math.max(...result.lines.map((line) => line.bottom)) + 0.005,
        };
        const compared = await page.evaluate(([b64, id, box]) => (window as unknown as { __compare: (b64: string, id: string, region: unknown) => Promise<unknown> }).__compare(b64 as string, id as string, box), [shot.toString("base64"), scenario.id, region]) as unknown as {
          size: string; meanAbs: number; differingFraction: number;
          captionOnScreen: { left: number; right: number; top: number; bottom: number; pixels: number; lines: number } | null;
          captionInFile: { left: number; right: number; top: number; bottom: number; pixels: number; lines: number } | null;
        };
        assert.ok(compared.captionOnScreen && compared.captionInFile, `${label} ${scenario.id}: caption ink missing on screen or in the file`);
        // Same lines, same vertical placement, same centring. Horizontal extents may
        // differ by a few percent: on screen Chrome snaps small glyph advances to device
        // pixels, the SVG capture uses exact advances. Line breaks cannot differ because
        // every caption line is its own paragraph sized never to wrap.
        assert.ok(exported.captionInk, `${label} ${scenario.id}: no caption ink in the file`);
        // Each on-screen line has ink in the file inside its own vertical band, centred where the page centres it.
        assert.equal(exported.lineInk.length, result.lines.length, `${label} ${scenario.id}: line bands in the file differ from the screen`);
        exported.lineInk.forEach((line, index) => {
          assert.ok(line.ink, `${label} ${scenario.id}: line ${index + 1} has no ink in the file`);
          near((line.ink!.left + line.ink!.right) / 2, (line.dom.left + line.dom.right) / 2, 0.012, `${label} ${scenario.id} line ${index + 1} centre on screen vs file`);
          assert.ok(line.ink!.right - line.ink!.left <= line.dom.right - line.dom.left + 0.01, `${label} ${scenario.id}: line ${index + 1} is wider in the file than on screen`);
        });
        for (const edge of ["top", "bottom"] as const) near(compared.captionInFile![edge], compared.captionOnScreen![edge], 0.008, `${label} ${scenario.id} caption ${edge} on screen vs file`);
        const centerOnScreen = (compared.captionOnScreen!.left + compared.captionOnScreen!.right) / 2;
        const centerInFile = (compared.captionInFile!.left + compared.captionInFile!.right) / 2;
        // Whole-caption centre: lines beside the top-right leaf tip sit off-centre by design, and
        // the narrower file text moves that bbox centre slightly; the per-line check above is the strict one.
        near(centerInFile, centerOnScreen, 0.02, `${label} ${scenario.id} caption centre on screen vs file`);
        // Korean glyphs are wider, so pixel snapping of advances on screen adds up to ~3.5% of the frame per edge.
        for (const edge of ["left", "right"] as const) near(compared.captionInFile![edge], compared.captionOnScreen![edge], 0.04, `${label} ${scenario.id} caption ${edge} on screen vs file`);
        assert.ok(compared.meanAbs < 10, `${label} ${scenario.id}: screen and file differ (mean ${compared.meanAbs.toFixed(2)})`);
        assert.ok(compared.differingFraction < 0.03, `${label} ${scenario.id}: ${(compared.differingFraction * 100).toFixed(2)}% of pixels differ between screen and file`);
        // The invisible "developing" overlay must stay invisible in the file.
        assert.equal(exported.overlay.computedOpacity, "0", `${label} ${scenario.id}: overlay opacity`);
        assert.ok(colorNear(exported.overlay.exportPixel, exported.overlay.blankPixel, 2), `${label} ${scenario.id}: overlay pixel differs between captures`);
        const legacyCornerMismatch = exported.legacy.corners.filter((corner, index) => !colorNear(corner, exported.templateCorners[index]!, 20)).length;
        summary.push(`${label} ${scenario.id}: lines=${result.lines.length} font=${result.fontPx.toFixed(2)}px/${gallery.fontPx.toFixed(2)}px minLine=${result.minFontPx.toFixed(2)}px(screen)/${(result.minFontPx * 1080 / result.width).toFixed(1)}px(file) diff=${exported.diff.meanAbs.toFixed(2)} (${(exported.diff.differingFraction * 100).toFixed(2)}%) screenVsFile=${compared.meanAbs.toFixed(2)} (${(compared.differingFraction * 100).toFixed(2)}%) captionLines=${result.lines.length}/${exported.lineInk.filter((line) => line.ink).length} legacyCornersClipped=${legacyCornerMismatch}/4`);
      }
      await page.close();
    }
    } finally {
      await browser.close();
    }
    }
  } finally {
    server?.close();
  }
  writeFileSync(join(OUT_DIR, "summary.txt"), summary.join("\n"));
  t.diagnostic(summary.join(" | "));
});
