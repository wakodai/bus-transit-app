import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SCREENSHOT_PATH =
  process.env.SCREENSHOT_PATH || "artifacts/highlight-check.png";

async function selectStop(
  page: import("playwright-core").Page,
  inputIndex: number,
  query: string,
) {
  const input = page.getByPlaceholder("停留所名で検索").nth(inputIndex);
  await input.click({ force: true });
  await input.fill(query);
  const resultButton = page
    .getByRole("button", { name: new RegExp(query) })
    .first();
  await resultButton.click({ timeout: 10_000 });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromium.executablePath(),
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  const loadingText = "GTFS データを読み込んでいます...";
  try {
    await page.waitForSelector(`text=${loadingText}`, { timeout: 10_000 });
  } catch {
    // ignore if it renders fast
  }
  await page.waitForSelector(`text=${loadingText}`, {
    state: "detached",
    timeout: 20_000,
  });

  await selectStop(page, 0, "知立駅");
  await selectStop(page, 2, "牛田駅北");

  await page.getByRole("button", { name: "この条件で検索" }).click();
  await page.waitForTimeout(2_000);

  const highlightedPaths = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<SVGPathElement>("path.leaflet-interactive"),
    ).map((el) => ({
      strokeWidth: el.getAttribute("stroke-width"),
      opacity: el.getAttribute("stroke-opacity"),
      color: el.getAttribute("stroke"),
      fill: el.getAttribute("fill"),
      dash: el.getAttribute("stroke-dasharray"),
    })),
  );

  const itineraryRoutes = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>("[data-testid='itinerary-route']"),
    ).map((el) => el.innerText.trim()),
  );

  const usedRouteNames = await page.evaluate(
    () => (window as typeof window & { __usedRouteNames?: string[] }).__usedRouteNames,
  );
  const routeNames = await page.evaluate(
    () => (window as typeof window & { __routeNames?: string[] }).__routeNames,
  );
  const highlightedFlags = await page.evaluate(
    () => (window as typeof window & { __highlighted?: Record<string, boolean> }).__highlighted,
  );

  mkdirSync(path.dirname(SCREENSHOT_PATH), { recursive: true });
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log(
    JSON.stringify(
      {
        baseUrl: BASE_URL,
        screenshot: SCREENSHOT_PATH,
        pathsSummary: {
          total: highlightedPaths.length,
          widths: Array.from(
            new Set(
              highlightedPaths.map((p) => Number(p.strokeWidth || "0") || 0),
            ),
          ).sort((a, b) => a - b),
          dashValues: Array.from(new Set(highlightedPaths.map((p) => p.dash || ""))),
          highlightedLike: highlightedPaths.filter(
            (p) =>
              (p.dash === null || p.dash === "") &&
              Number(p.strokeWidth || "0") >= 3 &&
              Number(p.opacity || "0") >= 0.7,
          ).length,
        },
        itineraryRoutes,
        usedRouteNames,
        routeNames,
        highlightedFlags,
      },
      null,
      2,
    ),
  );
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
