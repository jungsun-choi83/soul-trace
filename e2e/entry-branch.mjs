import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.SOULTRACE_BASE ?? "http://127.0.0.1:3100";
const widths = [375, 390, 430];
const results = [];

function record(name, width, ok, detail) {
  results.push({ name, width, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} @${width} ${detail}`);
}

async function openChoice(page) {
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "어떤 아이의 이야기를 시작할까요?" }).waitFor({ timeout: 20000 });
}

async function overflow(page, width) {
  return page.evaluate((viewport) => {
    const doc = document.documentElement;
    const wide = doc.scrollWidth > viewport + 2;
    const clipped = [...document.querySelectorAll("a, button")].filter((node) => {
      const box = node.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) return false;
      return box.left < -1 || box.right > viewport + 2;
    }).map((node) => (node.textContent || "").trim().slice(0, 40));
    return { wide, clipped };
  }, width);
}

const browser = await chromium.launch({ headless: true });
await mkdir("e2e/screenshots", { recursive: true });

try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();

    await openChoice(page);
    await page.getByTestId("living-choice").click();
    await page.waitForURL(/\/dashboard\/living/, { timeout: 20000 });
    const livingHeading = await page.getByRole("heading", { name: "우리 아이와 함께하는 오늘" }).isVisible();
    const livingHall = await page.getByRole("link", { name: "추모관", exact: true }).count();
    const livingFit = await overflow(page, width);
    record("A living home", width, livingHeading && livingHall === 0 && !livingFit.wide && livingFit.clipped.length === 0, page.url());
    if (width === 390) await page.screenshot({ path: "e2e/screenshots/living-home.png", fullPage: true });

    await page.getByRole("link", { name: "만들기", exact: true }).click();
    await page.waitForURL(/\/create/, { timeout: 20000 });
    await page.getByRole("link", { name: "AI 편지 받기" }).click();
    await page.waitForURL(/\/living/, { timeout: 30000 });
    const letterTitle = await page.title();
    record("C living letter", width, page.url().includes("/living") && !page.url().includes("/dashboard"), letterTitle);

    await page.goto(`${base}/dashboard/living`, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "목걸이", exact: true }).click();
    await page.waitForURL(/\/my\/device/, { timeout: 20000 });
    const collar = await page.getByText("기기 연결 전").first().isVisible();
    record("E collar", width, collar, page.url());

    await page.goto(`${base}/dashboard/living`, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "추억", exact: true }).click();
    await page.waitForURL(/\/life-archive|\/my\/pets/, { timeout: 20000 });
    const beam = page.getByRole("link", { name: "Eternal Beam 장면 만들기" });
    await beam.first().click();
    await page.waitForURL(/\/auth\?|\/beam-scene/, { timeout: 20000 });
    record("G living beam", width, decodeURIComponent(page.url()).includes("beam-scene"), page.url());

    await context.close();

    const memorialContext = await browser.newContext({ viewport: { width, height: 844 } });
    const memorial = await memorialContext.newPage();
    await openChoice(memorial);
    await memorial.getByTestId("memorial-choice").click();
    await memorial.waitForURL(/\/dashboard\/memorial/, { timeout: 20000 });
    const memorialHeading = await memorial.getByRole("heading", { name: "우리 아이와 함께했던 소중한 순간들" }).isVisible();
    const memorialCollar = await memorial.getByRole("link", { name: "목걸이", exact: true }).count();
    const hall = memorial.getByRole("link", { name: "추모관", exact: true });
    const hallHref = await hall.first().getAttribute("href");
    const memorialFit = await overflow(memorial, width);
    record(
      "B memorial home",
      width,
      memorialHeading && memorialCollar === 0 && hallHref?.startsWith("/memorial-space") && !memorialFit.wide && memorialFit.clipped.length === 0,
      `${memorial.url()} tab=${hallHref}`,
    );
    if (width === 390) await memorial.screenshot({ path: "e2e/screenshots/memorial-home.png", fullPage: true });

    await memorial.getByRole("link", { name: "만들기", exact: true }).click();
    await memorial.waitForURL(/\/create/, { timeout: 20000 });
    await memorial.getByRole("link", { name: "AI 편지 받기" }).click();
    await memorial.waitForURL(/\/memorial/, { timeout: 30000 });
    record("D memorial letter", width, new URL(memorial.url()).pathname === "/memorial", await memorial.title());

    await memorial.goto(`${base}/dashboard/memorial`, { waitUntil: "domcontentloaded" });
    await memorial.getByRole("link", { name: "추모관", exact: true }).first().click();
    await memorial.waitForURL(/\/auth\?|\/memorial-space/, { timeout: 20000 });
    record("F memorial hall", width, decodeURIComponent(memorial.url()).includes("memorial-space"), memorial.url());

    await memorial.goto(`${base}/dashboard/memorial`, { waitUntil: "domcontentloaded" });
    await memorial.getByRole("link", { name: "추억", exact: true }).click();
    await memorial.waitForURL(/\/life-archive|\/my\/pets/, { timeout: 20000 });
    await memorial.getByRole("link", { name: "Eternal Beam 장면 만들기" }).first().click();
    await memorial.waitForURL(/\/auth\?|\/beam-scene/, { timeout: 20000 });
    record("G memorial beam", width, decodeURIComponent(memorial.url()).includes("beam-scene"), memorial.url());
    await memorialContext.close();
  }

  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await guest.newPage();
  const pet = "61ee91b5-290b-4ed3-9a5a-62609efa80a1";
  await page.goto(`${base}/dashboard/living?pet=${pet}`, { waitUntil: "domcontentloaded" });
  await page.reload({ waitUntil: "domcontentloaded" });
  const keptLiving = page.url().includes("/dashboard/living") && page.url().includes(pet);
  record("H refresh living url", 390, keptLiving, page.url());

  await page.goto(`${base}/?p=not-a-code`, { waitUntil: "domcontentloaded" });
  const partnerFallback = await page.locator("h1").first().isVisible();
  record("J bad partner code", 390, partnerFallback && !page.url().includes("/dashboard"), page.url());

  await page.goto(`${base}/choose?ch=pension`, { waitUntil: "domcontentloaded" });
  const channelHref = await page.locator('a[href*="/living"]').first().getAttribute("href");
  record("J service channel", 390, Boolean(channelHref?.includes("/living") && channelHref.includes("ch=pension")), channelHref ?? "");

  await page.goto(`${base}/living?ch=pension`, { waitUntil: "domcontentloaded" });
  record("J direct living letter", 390, page.url().includes("/living"), await page.title());

  await page.goto(`${base}/polaroid`, { waitUntil: "domcontentloaded" });
  record("J polaroid", 390, page.url().includes("/polaroid"), await page.title());
  await guest.close();
} finally {
  await browser.close();
  await writeFile("e2e/screenshots/results.json", JSON.stringify(results, null, 2));
  const failed = results.filter((item) => !item.ok);
  if (failed.length) process.exitCode = 1;
}
