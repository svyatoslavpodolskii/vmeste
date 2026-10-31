import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const errors = [];
const context = async (viewport = { width: 390, height: 844 }) => {
  const c = await browser.newContext({ viewport });
  await c.addInitScript(() => {
    window.testFrames = [];
    window.testAudio = [];
    window.addEventListener("vmeste-game-view", (e) => {
      window.testFrame = e.detail;
    });
    const Audio = window.AudioContext;
    window.AudioContext = class extends Audio {
      constructor(...args) {
        super(...args);
        window.testAudio.push(this);
      }
      createBufferSource() {
        const n = super.createBufferSource();
        (window.testSources ||= []).push(n);
        return n;
      }
    };
  });
  c.on("page", (p) =>
    p.on("pageerror", (e) => {
      errors.push(e.message);
      console.log("PAGEERROR", e.message);
    }),
  );
  return c;
};
async function nav(p, id) {
  await p.locator(`.bottom-nav [data-action="${id}"]`).click();
}
async function close(p) {
  if (await p.locator("#sheet[open]").count())
    await p.locator(".close-sheet").click();
}
async function approve(host, guest) {
  await host
    .locator('[data-action="approve-pair"]')
    .waitFor({ timeout: 40000 });
  await host.locator('[data-action="approve-pair"]').click();
  await guest.locator('[data-action="confirm-pair-code"]').click();
}
try {
  const ac = await context(),
    a = await ac.newPage();
  await a.goto("http://127.0.0.1:4173");
  await a.getByLabel("Как вас зовут?").fill("Свят");
  await a.locator("#onboard-form button").click();
  await a.locator("#profile-form").waitFor();
  const room = a.url();
  const bc = await context(),
    b = await bc.newPage();
  await b.goto(room);
  await b.getByLabel("Как вас зовут?").fill("Саида");
  await b.locator("#onboard-form button").click();
  await approve(a, b);
  await b.locator("#profile-form").waitFor();

  const mc = await context({ width: 1280, height: 800 }),
    m = await mc.newPage();
  await m.goto(room);
  await m.getByLabel("Как вас зовут?").fill("Наш экран");
  await m.locator('select[name="entryMode"]').selectOption("display");
  await m.locator("#onboard-form button").click();
  await approve(a, m);
  await m.locator(".projector").waitFor();
  console.log("PASS monitor admitted without player seat");

  async function open(p) {
    await close(p);
    await nav(p, "games");
    await p.locator('[data-action="play"][data-id="word"]').click();
  }
  await open(a);
  await open(b);
  await a.locator('[data-turn="card"]').first().waitFor();
  await b.locator('[data-turn="card"]').first().waitFor();
  const prompts = await a
    .locator('[data-turn="card"] strong')
    .allTextContents();
  assert.deepEqual(
    await b.locator('[data-turn="card"] strong').allTextContents(),
    prompts,
  );
  await ac.setOffline(true);
  await bc.setOffline(true);
  async function answer(p, index, text) {
    await p.locator('[data-turn="card"]').nth(index).click();
    await p.locator("#turn-answer-form textarea").fill(text);
    await p.locator('#turn-answer-form button[type="submit"]').click();
    await p.locator('[data-turn="unready"]').waitFor();
    await p.locator('[data-turn="back"]').click();
  }
  for (let i = 0; i < 4; i++) {
    await answer(a, i, "Свят думает " + i);
    await answer(b, i, "Саида думает " + i);
  }
  await a.reload();
  await a.locator(".bottom-nav").waitFor();
  await open(a);
  assert.deepEqual(
    await a.locator('[data-turn="card"] strong').allTextContents(),
    prompts,
  );
  assert.equal(await a.locator(".turn-revealed article").count(), 0);
  assert.equal(await m.locator(".turn-revealed article").count(), 0);
  await ac.setOffline(false);
  await bc.setOffline(false);
  await a
    .getByText("Набор 2 · текущий", { exact: true })
    .waitFor({ timeout: 45000 });
  await b
    .getByText("Набор 2 · текущий", { exact: true })
    .waitFor({ timeout: 45000 });
  await a.locator(".letters-digest").waitFor();
  await a.locator(".letters-digest").click();
  assert.equal(await a.locator(".activity-item").count(), 4);
  await a.locator(".activity-item").first().click();
  assert.equal(await a.locator(".turn-revealed article").count(), 2);
  await m.locator(".turn-revealed article").first().waitFor();
  assert.equal(await m.locator(".turn-revealed article").count(), 2);
  await a.locator('[data-turn="back"]').click();
  await a.locator('[data-turn="history"]').click();
  assert.equal(await a.locator('[data-turn="card"]').count(), 8);
  await a.screenshot({
    path: "test-results/turns-history.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS saved four-question batch, independent offline answers, reload, shared reveal, one new pack, unread and archive",
  );
} finally {
  await browser.close();
}
