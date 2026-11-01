import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const errors = [];
async function client() {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
}
async function close(p) {
  if (await p.locator("#sheet[open]").count())
    await p.locator(".close-sheet").click();
}
async function open(p) {
  await close(p);
  await p.locator(".bottom-nav [data-action=games]").click();
  await p.locator("[data-action=play][data-id=poem]").click();
}
try {
  const a = await client();
  await a.goto("http://127.0.0.1:4173");
  await a.getByLabel("Как вас зовут?").fill("Свят");
  await a.locator("#onboard-form button").click();
  await a.locator("#profile-form").waitFor();
  const b = await client();
  await b.goto(a.url());
  await b.getByLabel("Как вас зовут?").fill("Саида");
  await b.locator("#onboard-form button").click();
  await a.locator("[data-action=approve-pair]").click({ timeout: 40000 });
  await b.locator("[data-action=confirm-pair-code]").click();
  await b.locator("#profile-form").waitFor();

  await open(a);
  await open(b);
  await a.locator("[data-party=ready]").click();
  await b.locator("[data-party=ready]").click();
  assert.equal(await a.locator("#party-answer-form textarea").count(), 0);
  for (const p of [a, b]) {
    const groups = p.locator(".poetry-palette fieldset");
    const count = await groups.count();
    assert.equal(count, 2);
    for (let i = 0; i < count; i++)
      await groups.nth(i).locator("label").first().click();
  }
  await a.locator("#party-answer-form button[type=submit]").click();
  assert.equal(await a.locator(".poem-result").count(), 0);
  await b.locator("#party-answer-form button[type=submit]").click();
  await a.waitForFunction(() =>
    document
      .querySelector("#party-live")
      ?.textContent.includes("Сегодня наш пароль"),
  );
  await b.waitForFunction(() =>
    document
      .querySelector("#party-live")
      ?.textContent.includes("Сегодня наш пароль"),
  );
  const first = await a.locator("#party-live").textContent();
  const firstPoem = await a.locator(".poem-sheet").textContent();
  await a.locator("[data-party=save-poem]").click();
  await a.locator("[data-party=reveal]").click();
  await a.locator("#party-answer-form").waitFor();
  assert.equal(await a.locator(".poetry-words input:checked").count(), 0);
  await a.screenshot({
    path: "test-results/poetry-palette.png",
    animations: "disabled",
  });
  console.log(
    "PASS poetry: two taps-only controllers, private choices, simultaneous reveal, fresh choices next round",
  );
  await close(a);
  await close(b);
  for (const p of [a, b]) {
    await p.locator(".bottom-nav [data-action=profile]").click();
    await p.locator("[data-action=game-records]").click();
    await p.locator("[data-party=poem-record]").click();
    assert.equal(await p.locator(".poem-sheet").textContent(), firstPoem);
  }
  console.log(
    "PASS shared poetry archive preserves the revealed poem on both devices",
  );
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
