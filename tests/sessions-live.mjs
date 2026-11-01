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
  async function open(p, id) {
    await close(p);
    await nav(p, "games");
    await p.locator(`[data-action="play"][data-id="${id}"]`).click();
  }
  await open(a, "questions");
  await close(a);
  await a.waitForFunction(
    () => document.querySelectorAll(".live-game-banner").length === 0,
  );
  await close(b);
  await b.waitForFunction(
    () => document.querySelectorAll(".live-game-banner").length === 0,
  );
  console.log(
    "PASS leaving a hosted lobby closes its invitation on both phones",
  );
  await open(a, "meditation");
  await a.locator('[data-party="solo"]').click();
  await a.locator('[data-party="sound"]').click();
  await open(b, "meditation");
  await b.locator(".meditation-plane").waitFor();
  await b.locator('[data-party="sound"]').click();
  await close(a);
  await close(b);
  await b.locator('#ambient-player [data-party="sound"]').click();
  await a.waitForFunction(() => window.testAudio.at(-1)?.state === "suspended");
  await b.waitForFunction(() => window.testAudio.at(-1)?.state === "suspended");
  await a.locator('#ambient-player [data-party="sound"]').click();
  await b.waitForFunction(() => window.testAudio.at(-1)?.state === "running");
  await b.locator('#ambient-player [data-party="player-stop"]').click();
  await a.locator("#ambient-player").waitFor({ state: "detached" });
  await b.locator("#ambient-player").waitFor({ state: "detached" });
  await a.waitForFunction(
    () =>
      ![...document.querySelectorAll(".live-game-banner")].some((e) =>
        e.textContent.includes("Общая тишина"),
      ),
  );
  await a.reload();
  await a.locator(".bottom-nav").waitFor();
  await a.waitForTimeout(1000);
  assert.equal(await a.locator("#ambient-player").count(), 0);
  console.log(
    "PASS pause, resume and close are shared; closing the player closes its lobby and survives reload",
  );
  await nav(a, "ideas");
  assert.equal(await a.locator(".categories").count(), 0);
  assert.equal(await a.locator("[data-catalogue-filter]").count(), 3);
  assert.ok(!(await a.locator("main").textContent()).includes("undefined"));
  const geometry = await a.locator(".catalogue-paged").evaluate((e) => ({
    height: e.clientHeight,
    width: e.clientWidth,
    scroll: e.scrollWidth,
    rows: new Set([...e.children].map((c) => c.offsetTop)).size,
  }));
  assert.equal(geometry.rows, 3);
  assert.ok(geometry.height < 600);
  assert.ok(geometry.scroll > geometry.width * 5);
  const roomBox = await a.locator(".room-pill").boundingBox(),
    bell = await a.locator(".activity-bell").boundingBox();
  assert.ok(roomBox.x > bell.x);
  await a
    .locator('[data-catalogue-filter="ideaLocation"]')
    .selectOption({ label: "Дома" });
  assert.ok((await a.locator(".catalogue-paged .idea-card").count()) > 0);
  const first = await a
    .locator(".catalogue-paged .idea-card")
    .first()
    .boundingBox();
  const action = await a
    .locator(".catalogue-paged .idea-card")
    .first()
    .locator(".card-actions button")
    .boundingBox();
  assert.ok(action.y + action.height <= first.y + first.height + 1);
  await a.locator("#catalog").scrollIntoViewIfNeeded();
  await a.screenshot({ path: "test-results/catalogue-three-rows.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS bounded catalogue, three rows with descriptions, grouped filters, no undefined, room aligned after bell",
  );
} finally {
  await browser.close();
}
