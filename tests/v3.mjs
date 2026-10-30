import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const errors = [];
const context = async () => {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  c.on("page", (p) =>
    p.on("pageerror", (e) => {
      errors.push(e.message);
      console.log("PAGEERROR", e.message);
    }),
  );
  return c;
};
try {
  const aCtx = await context(),
    a = await aCtx.newPage();
  await a.goto("http://127.0.0.1:4173");
  await a.getByLabel("Как вас зовут?").fill("Свят");
  await a.locator("#onboard-form button").click();
  await a.locator("#profile-form").waitFor();
  const roomUrl = a.url();
  console.log("created");
  const bCtx = await context(),
    b = await bCtx.newPage();
  await b.goto(roomUrl);
  await b.getByLabel("Как вас зовут?").fill("Саида");
  await b.locator("#onboard-form button").click();
  await b.locator(".pairing-lobby").waitFor();
  await a.locator('[data-action="approve-pair"]').waitFor({ timeout: 40000 });
  const acode = await a.locator(".pair-orbit").innerText(),
    bcode = await b.locator(".pair-orbit").innerText();
  assert.equal(acode, bcode);
  console.log("same SAS");
  assert.equal(await b.locator(".idea-card").count(), 0);
  await a.locator('[data-action="approve-pair"]').click();
  await b.locator('[data-action="confirm-pair-code"]').click();
  await b.locator("#profile-form").waitFor({ timeout: 30000 });
  await a.waitForFunction(() =>
    document.querySelector(".room-card h2")?.textContent.includes("Саида"),
  );
  console.log("admitted");
  await b.reload();
  await b.locator("#profile-form").waitFor();
  await b.waitForFunction(
    () =>
      /Вы вдвоём|Всё синхронизировано/.test(
        document.querySelector("#connection-status")?.textContent || "",
      ),
    null,
    { timeout: 30000 },
  );
  console.log("reconnected");
  await a.locator('[data-action="ideas"]').last().click();
  await a.locator('.idea-card [data-action="like"]').first().click();
  await b.locator('[data-action="ideas"]').last().click();
  const cCtx = await context(),
    c = await cCtx.newPage();
  await c.goto(roomUrl);
  await c.getByLabel("Как вас зовут?").fill("Третий");
  await c.locator("#onboard-form button").click();
  await c
    .getByText(/Все места заняты/)
    .waitFor({ timeout: 35000 })
    .catch(async (e) => {
      console.log("A", await a.locator("#sheet-content").innerText());
      console.log("BSTATUS", await b.locator("#connection-status").innerText());
      console.log("C", await c.locator("body").innerText());
      throw e;
    });
  assert.equal(await c.locator(".idea-card").count(), 0);
  console.log("third blocked");
  await a.locator('[data-action="build"]').click();
  assert.equal(await a.locator("#recommendation-feed .suggestion").count(), 10);
  await a.screenshot({ path: "test-results/v3-build.png", fullPage: true });
  await a.locator(".discover-fab").click();
  await a.locator("#swipe-card").waitFor();
  await a.locator('[data-action="swipe-next"]').click();
  await a.locator(".close-sheet").click();
  await a.locator('[data-action="games"]').click();
  await a.locator('[data-action="play"][data-id="prediction"]').click();
  await a.locator("#prediction-form textarea").fill("Тёплый чай");
  await a.locator("#prediction-form button").click();
  await a.locator('[data-action="game-phase"]').click();
  await a.locator('[data-action="game-phase"]').click();
  assert.match(await a.locator(".prediction-reveal").innerText(), /Тёплый чай/);
  console.log("games");
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
