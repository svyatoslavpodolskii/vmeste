import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch(),
  errors = [];
try {
  const ac = await browser.newContext({
      serviceWorkers: "block",
      viewport: { width: 390, height: 844 },
    }),
    bc = await browser.newContext({
      serviceWorkers: "block",
      viewport: { width: 390, height: 844 },
    });
  const a = await ac.newPage(),
    b = await bc.newPage();
  for (const p of [a, b])
    p.on("pageerror", (error) => errors.push(error.message));
  await bc.route("**/js/auth.js", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "gameProtocol: GAME_PROTOCOL",
      "gameProtocol: 0",
    );
    assert.ok(body.includes("gameProtocol: 0"));
    await route.fulfill({ response, body });
  });
  await a.goto("http://127.0.0.1:4173");
  await a.getByLabel("Как вас зовут?").fill("Аня");
  await a.locator("#onboard-form button").click();
  await a.locator("#profile-form").waitFor();
  await b.goto(a.url());
  await b.getByLabel("Как вас зовут?").fill("Борис");
  await b.locator("#onboard-form button").click();
  await a.locator('[data-action="approve-pair"]').waitFor({ timeout: 40000 });
  await a.locator('[data-action="approve-pair"]').click();
  await b.locator('[data-action="confirm-pair-code"]').click();
  await b.locator("#profile-form").waitFor();
  for (const p of [a, b])
    await p.locator('.bottom-nav [data-action="games"]').click();
  await a.locator('[data-action="play"][data-id="race"]').click();
  await a.locator('[data-party="circuit-start"][data-length="8"]').click();
  await b.locator('[data-action="play"][data-id="race"]').click();
  await b.locator('[data-party="circuit-resume"]').click();
  await a.locator('[data-party="ready"]').click();
  await b.locator('[data-party="ready"]').click();
  await a.locator(".lobby-update").waitFor();
  assert.ok((await a.locator(".lobby-update").textContent()).includes("Борис"));
  await a.waitForTimeout(600);
  const get = () =>
    a.evaluate(() =>
      JSON.parse(
        localStorage.getItem(
          Object.keys(localStorage).find((k) =>
            k.startsWith("vmeste:circuit:"),
          ),
        ),
      ),
    );
  assert.equal((await get()).stage, "lobby");
  await a.screenshot({ path: "test-results/version-update-lobby.png" });
  await bc.unroute("**/js/auth.js");
  await b.reload();
  await b.locator(".bottom-nav").waitFor();
  await a.waitForFunction(
    () =>
      JSON.parse(
        localStorage.getItem(
          Object.keys(localStorage).find((k) =>
            k.startsWith("vmeste:circuit:"),
          ),
        ),
      ).stage === "running",
    {},
    { timeout: 45000 },
  );
  await a.locator(".circuit-scene").waitFor();
  assert.equal(await a.locator(".lobby-update").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS old game client receives a clear update gate; ready lobby proceeds after compatible reload without losing the room",
  );
} finally {
  await browser.close();
}
