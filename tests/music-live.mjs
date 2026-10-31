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
  const privateIdeas = await m.evaluate(async () => {
    const r = await indexedDB.databases();
    const name = r.find((d) => d.name.startsWith("vmeste-")).name;
    return await new Promise((resolve) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => {
        const db = req.result,
          q = db.transaction("ideas").objectStore("ideas").getAll();
        q.onsuccess = () => {
          resolve(q.result.length);
          db.close();
        };
      };
    });
  });
  assert.equal(privateIdeas, 0);

  async function open(p, id) {
    await close(p);
    await nav(p, "games");
    await p.locator(`[data-action="play"][data-id="${id}"]`).click();
  }

  await open(a, "soundgarden");
  await open(b, "soundgarden");
  await a.locator('[data-party="ready"]').click();
  await b.locator('[data-party="ready"]').click();
  await a.locator('[data-sound-pad="3"]').waitFor();
  for (const p of [a, b]) {
    assert.equal(await p.locator("[data-sound-pad]").count(), 4);
    await p.locator('[data-party="sound"]').click();
    for (const bank of [0, 1, 2, 3]) {
      await p.locator(`[data-sound-pad="${bank}"]`).focus();
      await p.locator(`[data-sound-pad="${bank}"]`).press("ArrowRight");
    }
  }
  await m.waitForFunction(
    () =>
      Object.values(window.testFrame?.public.contributors || {}).length === 2 &&
      Object.values(window.testFrame.public.contributors).every(
        (c) => c.pads?.length === 4,
      ),
  );
  assert.equal(await m.locator(".scene-voice").count(), 2);
  await a.screenshot({
    path: "test-results/music-four-panels.png",
    fullPage: true,
  });
  await m.screenshot({ path: "test-results/music-garden-monitor.png" });
  console.log(
    "PASS both performers have four panels; all eight controls reach the public scene",
  );
  await close(a);
  await close(b);
  await open(a, "meditation");
  await open(b, "meditation");
  await a.locator('[data-party="ready"]').click();
  await b.locator('[data-party="ready"]').click();
  await a.locator("[data-constellation]").first().waitFor();
  for (const p of [a, b]) {
    assert.equal(await p.locator("[data-constellation]").count(), 6);
    await p.locator('[data-party="sound"]').click();
    for (const star of await p.locator("[data-constellation]").all()) {
      await star.focus();
      await star.press("Space", { delay: 100 });
    }
  }
  await m.waitForFunction(
    () =>
      Object.values(window.testFrame?.public.contributors || {}).flatMap(
        (c) => c.stars || [],
      ).length >= 8,
  );
  assert.equal(await m.locator(".scene-voice").count(), 4);
  assert.equal(await m.locator(".scene-star").count(), 12);
  await a.locator(".constellation-field").scrollIntoViewIfNeeded();
  await a.screenshot({ path: "test-results/music-six-constellations.png" });
  await m.screenshot({ path: "test-results/music-sky-monitor.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS twelve distinct constellation actions, four shared voices and public monitor; no JS errors",
  );
} finally {
  await browser.close();
}
