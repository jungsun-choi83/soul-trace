import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3100";
const OUT = "tmp-38pages/compare";
const PAGES = [
  { id: "01_splash", path: "/", splash: true },
  { id: "02_welcome", path: "/", splash: false },
  { id: "03_login", path: "/auth" },
  { id: "04_pet_setup", path: "/my/pets/new" },
  { id: "05_home", path: "/dashboard" },
  { id: "18_letter", path: "/choose" },
  { id: "19_living", path: "/living" },
  { id: "23_memorial_letter", path: "/memorial" },
  { id: "26_polaroid", path: "/polaroid" },
  { id: "29_my_polaroids", path: "/my-polaroids" },
  { id: "34_pets", path: "/my/pets" },
  { id: "35_collar", path: "/my/collar" },
  { id: "38_settings", path: "/settings" },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const report = [];

for (const item of PAGES) {
  if (!item.splash) {
    await page.addInitScript(() => {
      try { sessionStorage.setItem("soultrace.splash.seen", "1"); } catch {}
    });
  }
  const response = await page.goto(`${BASE}${item.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(item.splash ? 400 : 700);
  const stats = await page.evaluate(() => {
    const doc = document.documentElement;
    const tab = document.querySelector("nav[aria-label='SoulTrace']");
    const img = document.querySelector(".st-scene img, main img");
    return {
      url: location.pathname + location.search,
      title: document.title,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      scrollHeight: doc.scrollHeight,
      overflowX: doc.scrollWidth - doc.clientWidth,
      hasTabbar: Boolean(tab),
      image: img ? { w: img.naturalWidth, h: img.naturalHeight, rw: img.clientWidth, rh: img.clientHeight } : null,
    };
  });
  await page.screenshot({ path: `${OUT}/${item.id}-top.png` });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${item.id}-bottom.png` });
  report.push({ id: item.id, status: response?.status() ?? 0, ...stats });
}

writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report, null, 2));
