import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const errors = [];
async function fresh() {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await c.addInitScript(() =>
    window.addEventListener(
      "vmeste-game-view",
      (e) => (window.testFrame = e.detail),
    ),
  );
  c.on("page", (p) =>
    p.on("pageerror", (e) => {
      errors.push(e.message);
      console.log("ERROR", e.message);
    }),
  );
  return { c, p: await c.newPage() };
}
async function host(name, capacity) {
  const x = await fresh();
  await x.p.goto("http://127.0.0.1:4173");
  await x.p.getByLabel("Как вас зовут?").fill(name);
  await x.p.locator('select[name="capacity"]').selectOption(String(capacity));
  await x.p.locator("#onboard-form button").click();
  await x.p.locator("#profile-form").waitFor();
  return x;
}
async function join(url, name, mode = "player") {
  const x = await fresh();
  await x.p.goto(url);
  await x.p.getByLabel("Как вас зовут?").fill(name);
  await x.p.locator('select[name="entryMode"]').selectOption(mode);
  await x.p.locator("#onboard-form button").click();
  return x;
}
async function approve(a, target, guest) {
  await a.locator('[data-action="approve-pair"]').waitFor({ timeout: 40000 });
  if (target)
    await a.locator("#admission-target").selectOption({ label: target });
  await a.locator('[data-action="approve-pair"]').click();
  await guest.locator('[data-action="confirm-pair-code"]').click();
}
try {
  const root = await host("Host", 10),
    a = root.p,
    url = a.url(),
    pages = [a];
  for (let i = 1; i < 10; i++) {
    const x = await join(url, "Player " + i);
    await approve(a, null, x.p);
    await x.p.locator("#profile-form").waitFor();
    pages.push(x.p);
  }
  const monitor = await join(url, "Screen", "display");
  await approve(a, null, monitor.p);
  await monitor.p.locator(".projector").waitFor();
  for (const p of pages) {
    await p.locator('.bottom-nav [data-action="games"]').click();
    await p.locator('[data-action="play"][data-id="meditation"]').click();
    await p.locator('[data-party="ready"]').waitFor();
  }
  for (const p of pages) await p.locator('[data-party="ready"]').click();
  for (const p of pages) {
    await p.locator("[data-constellation]").first().waitFor();
    await p.locator("[data-constellation]").first().focus();
    await p
      .locator("[data-constellation]")
      .first()
      .press("Space", { delay: 100 });
  }
  await monitor.p.waitForFunction(
    () =>
      Object.values(window.testFrame?.public.contributors || {}).filter((c) =>
        (c.memory || []).some((n) => n > 0),
      ).length === 10,
  );
  assert.equal(await monitor.p.locator(".scene-voice").count(), 4);
  assert.deepEqual(errors, []);
  console.log(
    "PASS all ten performers can play distinct constellation actions; four shared movable voices remain",
  );
} finally {
  await browser.close();
}
