import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.SOUL_TRACE_BASE ?? "http://127.0.0.1:3100";
const OUT = process.env.SOUL_TRACE_NOCROP_OUT ?? "tmp-38pages/verify";
const VIEWPORTS = [
  { name: "375", width: 375, height: 667 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
];
const PAGES = [
  { id: "01_splash", path: "/", splash: true },
  { id: "02_welcome", path: "/", splash: false },
  { id: "03_login", path: "/auth" },
  { id: "18_letter", path: "/choose" },
  { id: "26_polaroid", path: "/polaroid" },
  { id: "05_home", path: "/dashboard" },
  { id: "34_pets", path: "/my/pets" },
  { id: "38_settings", path: "/settings" },
  { id: "19_living", path: "/living" },
  { id: "23_memorial", path: "/memorial" },
];

const failures = [];

async function skipSplash(page) {
  await page.evaluate(() => {
    try {
      sessionStorage.setItem("soultrace.splash.seen", "1");
    } catch {}
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const tab = document.querySelector("nav[aria-label='SoulTrace']");
    const submit = document.querySelector("button[type='submit'], a.st-btn-primary, button.st-btn-primary");
    const scene = document.querySelector(".st-scene img, img[class*='object-contain']");
    const tabBox = tab?.getBoundingClientRect();
    const submitBox = submit?.getBoundingClientRect();
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      scrollHeight: doc.scrollHeight,
      clientHeight: doc.clientHeight,
      overflowX: doc.scrollWidth - doc.clientWidth,
      sceneNatural: scene ? { w: scene.naturalWidth, h: scene.naturalHeight, renderedW: scene.clientWidth, renderedH: scene.clientHeight } : null,
      submitBottom: submitBox ? submitBox.bottom : null,
      tabTop: tabBox ? tabBox.top : null,
      submitCovered: Boolean(submitBox && tabBox && submitBox.bottom > tabBox.top + 4 && submitBox.top < tabBox.bottom),
    };
  });
}

async function capture(page, fileBase) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const view = page.viewportSize() ?? { width: 390, height: 844 };
  await page.screenshot({ path: `${fileBase}-top.png` });
  const mid = Math.max(0, Math.floor((height - view.height) / 2));
  const bottom = Math.max(0, height - view.height);
  await page.evaluate((y) => window.scrollTo(0, y), mid);
  await page.screenshot({ path: `${fileBase}-mid.png` });
  await page.evaluate((y) => window.scrollTo(0, y), bottom);
  await page.screenshot({ path: `${fileBase}-bottom.png` });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
mkdirSync(OUT, { recursive: true });

try {
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport, locale: "ko-KR" });
    const page = await context.newPage();
    for (const item of PAGES) {
      if (!item.splash) await skipSplash(page);
      const response = await page.goto(`${BASE}${item.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      if (item.splash) {
        await page.waitForTimeout(300);
      } else {
        await skipSplash(page);
        if (page.url().endsWith("/") === false && item.path === "/") {
          await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
        }
        await page.waitForTimeout(400);
      }
      const stats = await measure(page);
      const fileBase = `${OUT}/${viewport.name}-${item.id}`;
      await capture(page, fileBase);
      const status = response?.status() ?? 0;
      if (stats.overflowX > 2) failures.push(`${viewport.name} ${item.id} horizontal overflow ${stats.overflowX}`);
      if (stats.submitCovered) failures.push(`${viewport.name} ${item.id} tab bar covers submit`);
      if (status >= 500) failures.push(`${viewport.name} ${item.id} HTTP ${status}`);
      writeFileSync(`${fileBase}.json`, JSON.stringify({ path: item.path, status, ...stats }, null, 2));
    }
    await context.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`OK ${VIEWPORTS.length} viewports x ${PAGES.length} pages -> ${OUT}`);
