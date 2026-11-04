import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.env.SOULTRACE_BASE ?? "http://127.0.0.1:3100";
const widths = [375, 390, 430];
const blocked = "삶의 기록은 Eternal Beam 이용이 확인된 분께 열려 있어요.";
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
}

async function overflow(page, width) {
  return page.evaluate((viewport) => {
    const doc = document.documentElement;
    const clipped = [...document.querySelectorAll("a, button, h1, p")].filter((node) => {
      const box = node.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) return false;
      return box.left < -1 || box.right > viewport + 2;
    }).map((node) => (node.textContent || "").trim().slice(0, 48));
    return { wide: doc.scrollWidth > viewport + 2, clipped };
  }, width);
}

const browser = await chromium.launch({ headless: true });
await mkdir("e2e/screenshots", { recursive: true });

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${base}/dashboard/living`, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "추억", exact: true }).click();
  await page.waitForURL(/\/memories(?:\?|$)/, { timeout: 15000 });
  const body = await page.locator("body").innerText();
  record("guest tab avoids beam gate", !body.includes(blocked) && body.includes("우리 아이의 추억") && body.includes("아직 기록한 추억이 없어요"), page.url());
  record("guest save asks for login", body.includes("로그인하고 기록에 저장") && body.includes("계정에는 저장되지 않아요"), "local preview notice");
  await page.goto(`${base}/life-archive`, { waitUntil: "networkidle" });
  await page.getByText(blocked).waitFor();
  const legacy = await page.locator("body").innerText();
  record("legacy life archive gate remains", legacy.includes(blocked), "/life-archive");
  await context.close();

  for (const width of widths) {
    const sized = await browser.newContext({ viewport: { width, height: 844 } });
    const mobile = await sized.newPage();
    await mobile.goto(`${base}/memories`, { waitUntil: "domcontentloaded" });
    await mobile.getByRole("heading", { name: "우리 아이의 추억" }).waitFor();
    const layout = await overflow(mobile, width);
    record(`layout ${width}`, !layout.wide && layout.clipped.length === 0, layout.wide ? "horizontal scroll" : layout.clipped.join(" | ") || "fits");
    await mobile.screenshot({ path: `e2e/screenshots/memories-${width}.png` });
    await sized.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((item) => !item.ok);
if (failed.length) process.exitCode = 1;
