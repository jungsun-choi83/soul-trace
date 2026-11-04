import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.SOULTRACE_BASE ?? "http://127.0.0.1:3100";
const viewports = [
  [390, 844, "390x844"],
  [375, 812, "375x812"],
  [430, 932, "430x932"],
  [721, 940, "721x940"],
];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail}`);
}

const results = [];
const browser = await chromium.launch({ headless: true });
await mkdir("e2e/screenshots", { recursive: true });

try {
  for (const [width, height, label] of viewports) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${base}/?splash=1`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "어떤 아이의 이야기를 시작할까요?" }).waitFor({ timeout: 20000 });
    await page.waitForTimeout(1700);
    const box = await page.evaluate(() => {
      const living = document.querySelector('[data-testid="living-choice"]');
      const memorial = document.querySelector('[data-testid="memorial-choice"]');
      const tabs = document.querySelectorAll(".st-tabbar").length;
      const rect = (node) => {
        const box = node.getBoundingClientRect();
        const image = node.querySelector("img");
        const imageBox = image.getBoundingClientRect();
        return {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          bottom: box.bottom,
          text: node.innerText,
          imageWidth: imageBox.width,
          imageHeight: imageBox.height,
        };
      };
      return { living: rect(living), memorial: rect(memorial), tabs, innerHeight: window.innerHeight };
    });
    const sameRow = Math.abs(box.living.y - box.memorial.y) < 2;
    const sameSize = Math.abs(box.living.width - box.memorial.width) < 2 && Math.abs(box.living.height - box.memorial.height) < 2;
    const sideBySide = box.memorial.x > box.living.x + box.living.width * 0.6;
    const imageRatio = box.living.imageHeight / box.living.imageWidth;
    const ratioOk = Math.abs(imageRatio - 1.05) < 0.04;
    const bothVisible = box.living.bottom < box.innerHeight + 1 && box.memorial.bottom < box.innerHeight + 1 && box.living.y >= 0;
    const textOk = box.living.text.includes("지금 함께 있는 아이") && box.living.text.includes("오늘을 기록하고, 새 추억을 만들어요.")
      && box.memorial.text.includes("구름 위에 있는 아이") && box.memorial.text.includes("소중했던 순간을 오래 간직해요.");
    const ok = sameRow && sameSize && sideBySide && ratioOk && bothVisible && textOk && box.tabs === 0;
    record(
      `choice ${label}`,
      ok,
      `row=${sameRow} size=${sameSize} side=${sideBySide} ratio=${imageRatio.toFixed(3)} visible=${bothVisible} text=${textOk} tabs=${box.tabs} y=${box.living.y.toFixed(1)}/${box.memorial.y.toFixed(1)} w=${box.living.width.toFixed(1)} h=${box.living.height.toFixed(1)}`,
    );
    await page.screenshot({ path: `e2e/screenshots/choice-after-${label}.png` });
    await page.close();
  }

  const flow = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await flow.goto(`${base}/?splash=1`, { waitUntil: "domcontentloaded" });
  await flow.getByTestId("living-choice").waitFor({ timeout: 20000 });
  await flow.waitForTimeout(1700);
  await flow.getByTestId("living-choice").click();
  await flow.waitForURL(/\/dashboard\/living/, { timeout: 20000 });
  record("living destination", flow.url().includes("/dashboard/living"), flow.url());

  await flow.goto(`${base}/choose`, { waitUntil: "domcontentloaded" });
  await flow.getByTestId("memorial-choice").click();
  await flow.waitForURL(/\/dashboard\/memorial/, { timeout: 20000 });
  record("memorial destination", flow.url().includes("/dashboard/memorial"), flow.url());

  await flow.goto(`${base}/living`, { waitUntil: "domcontentloaded" });
  record("letter page", new URL(flow.url()).pathname === "/living", flow.url());
  await flow.goto(`${base}/polaroid`, { waitUntil: "domcontentloaded" });
  record("polaroid page", new URL(flow.url()).pathname === "/polaroid", flow.url());
  await flow.goto(`${base}/auth?returnTo=%2Fdashboard`, { waitUntil: "domcontentloaded" });
  record("login page", new URL(flow.url()).pathname === "/auth", flow.url());
  await flow.close();
} finally {
  await browser.close();
  await writeFile("e2e/screenshots/choice-layout.json", JSON.stringify(results, null, 2));
  if (results.some((item) => !item.ok)) process.exitCode = 1;
}
