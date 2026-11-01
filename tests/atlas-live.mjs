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
  await p.locator("[data-action=play][data-id=atlasworld]").click();
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
  assert.equal(await a.locator("[data-world=atlas-place]").count(), 24);
  assert.equal(await a.locator("[data-world=build]").count(), 0);
  await a.locator('[data-world=atlas-place][data-tile="0"]').click();
  await a
    .locator("#atlas-note-form textarea")
    .fill("Золотая полоска света на стене");
  await a.locator("#atlas-note-form button").click();
  await a
    .locator(".atlas-journal")
    .getByText("Золотая полоска света на стене", { exact: true })
    .waitFor();
  await open(b);
  await b.locator('[data-world=atlas-place][data-tile="0"]').click();
  await b
    .locator(".atlas-journal")
    .getByText("Золотая полоска света на стене", { exact: true })
    .waitFor();
  await b.locator("#atlas-note-form textarea").fill("А я увидела тень листьев");
  await b.locator("#atlas-note-form button").click();
  await a
    .locator(".atlas-journal")
    .getByText("А я увидела тень листьев", { exact: true })
    .waitFor();
  assert.equal(await a.locator(".atlas-journal article").count(), 2);
  await close(a);
  await a.reload();
  await a.locator(".bottom-nav").waitFor();
  await open(a);
  await a.locator('[data-world=atlas-place][data-tile="0"]').click();
  assert.equal(
    await a.locator("#atlas-note-form textarea").inputValue(),
    "Золотая полоска света на стене",
  );
  await a
    .locator("#atlas-note-form textarea")
    .fill("Золотая полоска стала длиннее");
  await a.locator("#atlas-note-form button").click();
  await b
    .locator(".atlas-journal")
    .getByText("Золотая полоска стала длиннее", { exact: true })
    .waitFor();
  assert.equal(await b.locator(".atlas-journal article").count(), 2);
  await a.locator("[data-world=atlas-back]").click();
  await a.waitForTimeout(350);
  await a.screenshot({
    path: "test-results/atlas-observations.png",
    animations: "disabled",
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS atlas: 24 actual invitations, independent notes by both people, reload, editing without duplicates, shared history, no fake build buttons",
  );
} finally {
  await browser.close();
}
