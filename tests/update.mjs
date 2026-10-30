import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:4173");
  await page.getByLabel("Как вас зовут?").fill("Тест");
  await page.locator("#onboard-form button").click();
  await page.locator('[data-action="ideas"]').last().click();
  await page.locator(".daily").click();
  await page.locator('#sheet [data-action="like"]').click();
  await page.waitForFunction(() =>
    document
      .querySelector('#sheet [data-action="like"]')
      .textContent.includes("♥"),
  );
  await page.locator('#sheet [data-action="favorite"]').click();
  await page.waitForFunction(() =>
    document
      .querySelector('#sheet [data-action="favorite"]')
      .textContent.includes("Убрать суперлайк"),
  );
  await page.locator(".close-sheet").click();
  await page.locator('[data-action="build"]').click();
  await page.locator('[data-action="swipe"]').click();
  assert.equal(await page.locator("#swipe-card").count(), 1);
  await page.locator('[data-action="swipe-add"]').click();
  await page.locator(".close-sheet").click();
  assert.equal(await page.locator(".plan-item").count(), 1);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "build overflow",
  );
  const before = await page.locator(".suggestion").count();
  await page
    .locator('[data-action="more-suggestions"]')
    .scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  assert.ok((await page.locator(".suggestion").count()) > before);
  await page.locator('[data-action="surprise"]').click();
  await page
    .locator('#surprise-form select[name="minutes"]')
    .selectOption("60");
  await page.locator("#surprise-form button").click();
  assert.ok((await page.locator(".plan-item").count()) > 0);
  await page.locator('[data-action="games"]').click();
  await page.locator('[data-action="tasks"]').click();
  await page.locator("#task-form input").fill("Уникальный вопрос для теста?");
  await page.locator("#task-form button").click();
  await page.waitForFunction(() =>
    document.querySelector(".task-list").textContent.includes("Уникальный"),
  );
  await page.locator(".close-sheet").click();
  await page.locator('[data-action="play"][data-id="questions"]').click();
  const seen = new Set();
  for (let n = 0; n < 29; n++) {
    const q = await page.locator(".question-card p").textContent();
    assert.ok(!seen.has(q), "no repeats");
    seen.add(q);
    await page.locator('[data-action="next-question"]').click();
    await page.waitForTimeout(50);
    if (await page.locator('[data-action="restart-game"]').count()) break;
  }
  assert.ok(seen.has("Уникальный вопрос для теста?"));
  await page.locator(".close-sheet").click();
  await page.locator('[data-action="play"][data-id="riddles"]').click();
  await page.locator("summary").click();
  assert.ok((await page.locator("details p").innerText()).length > 40);
  await page.locator(".close-sheet").click();
  await page.screenshot({ path: "test-results/games-v2.png", fullPage: true });
  await page.locator('[data-action="ideas"]').last().click();
  await page.locator('[data-action="new-idea"]').first().click();
  await page
    .locator('#idea-form input[name="title"]')
    .fill("Идея с фотографией");
  await page
    .locator('#idea-form input[name="photo"]')
    .setInputFiles("assets/icon-512.png");
  await page.locator('#idea-form button[type="submit"]').click();
  await page
    .getByRole("heading", { name: "Идея с фотографией", exact: true })
    .waitFor();
  assert.ok(await page.locator(".user-art").count());
  await page.reload();
  await page
    .getByRole("heading", { name: "Идея с фотографией", exact: true })
    .waitFor();
  assert.ok(await page.locator(".user-art").count());
  for (const width of [360, 390, 450, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow ${width}`,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS v2: daily like, superlike, swipe, recommendations, generator, custom pool, no repeats, riddles, photo persistence, responsive widths",
  );
} finally {
  await browser.close();
}
