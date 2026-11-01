import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4173");
  await page.getByLabel("Как вас зовут?").fill("Садовник");
  await page.locator("#onboard-form button").click();
  await page.locator("#profile-form").waitFor();
  await page.locator('.bottom-nav [data-action="games"]').click();
  await page.locator('[data-action="play"][data-id="gardenworld"]').click();
  await page
    .locator("#garden-wish-form textarea")
    .fill("Пусть будет доброе утро");
  await page.locator('#garden-wish-form button[type="submit"]').click();
  await page.locator(".garden-plot").waitFor();
  await page.locator('[data-world="water"]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-world="water"]')?.disabled,
  );
  await page.locator('[data-world="release"]').click();
  await page.locator(".garden-plot").waitFor({ state: "detached" });
  await page.locator('[data-world="garden-archive"]').click();
  await page.locator('[data-world="restore"]').click();
  await page.locator('[data-world="garden-archive"]').click();
  await page.locator(".garden-plot").waitFor();
  await page.locator(".close-sheet").click();
  await page.locator('.bottom-nav [data-action="ideas"]').click();
  const card = page.locator(".idea-card").first(),
    id = await card.getAttribute("data-idea");
  await card.locator('[data-action="like"]').click();
  const own = page.locator(`[data-idea="${id}"]`);
  await own.locator('[data-action="complete-idea"]').click();
  await page.locator('[data-action="swipe"]').first().click();
  assert.notEqual(
    await page.locator("#swipe-card").getAttribute("data-id"),
    id,
  );
  assert.equal(await page.locator('[data-action="swipe-add"]').count(), 0);
  await page.locator('[data-action="swipe-super"]').waitFor();
  await page.locator(".close-sheet").click();
  await page.locator('.bottom-nav [data-action="profile"]').click();
  await page.locator('[data-action="game-records"]').click();
  await page.locator(".completed-idea-art").waitFor();
  await page.screenshot({ path: "test-results/completed-activity.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS daily watering, reversible flower release, completed liked activity reaches exhibition; no browser errors",
  );
} finally {
  await browser.close();
}
