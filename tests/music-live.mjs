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
  await a.locator('[data-party="invite"]').click();
  await m.waitForTimeout(300);
  assert.equal(await m.locator("#sheet[open]").count(), 0);
  await open(b, "soundgarden");
  await a.locator('[data-party="ready"]').click();
  await b.locator('[data-party="ready"]').click();
  await a.locator('[data-garden-bank="3"]').waitFor();
  for (const p of [a, b]) {
    assert.equal(await p.locator("[data-garden-bank]").count(), 4);
    await p.waitForFunction(() =>
      window.testAudio.some((c) => c.state === "running"),
    );
    for (const bank of [0, 1, 2, 3]) {
      await p.locator(`[data-garden-bank="${bank}"]`).focus();
      await p.locator(`[data-garden-bank="${bank}"]`).press("ArrowRight");
    }
  }
  await m.waitForFunction(
    () =>
      Object.values(window.testFrame?.public.contributors || {}).length === 2 &&
      Object.values(window.testFrame.public.contributors).every(
        (c) => c.pads?.length === 4,
      ),
  );
  assert.equal(await m.locator(".scene-voice").count(), 8);
  await m.waitForFunction(() =>
    window.testAudio.some((c) => c.state === "running"),
  );
  assert.ok(
    await m.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight + 2,
    ),
  );
  await m.evaluate(
    () =>
      (window.sceneReference = document.querySelector(".shared-sound-scene")),
  );
  const point = a.locator('[data-garden-bank="0"]');
  await point.scrollIntoViewIfNeeded();
  const bounds = await point.boundingBox();
  await a.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await a.mouse.down();
  await a.mouse.move(
    bounds.x + bounds.width / 2 + 25,
    bounds.y + bounds.height / 2 - 30,
    { steps: 5 },
  );
  await a.mouse.up();
  await m.waitForTimeout(200);
  assert.equal(
    await m.evaluate(async () => {
      const { refreshSoundWorld } = await import("./js/sound-controls.js");
      const before = document.querySelector(".shared-sound-scene");
      return (
        refreshSoundWorld(
          document.querySelector(".projector-live"),
          window.testFrame,
        ) && before === document.querySelector(".shared-sound-scene")
      );
    }),
    true,
  );
  await m.locator('[data-action="projector-sound"]').click();
  await m.waitForFunction(() => window.testAudio.at(-1)?.state === "closed");
  assert.equal(
    await b.evaluate(() => !!window.testFrame.public.audioPaused),
    false,
  );
  await m.locator('[data-action="projector-sound"]').click();
  await m.waitForFunction(() => window.testAudio.at(-1)?.state === "running");
  await m.setViewportSize({ width: 800, height: 600 });
  await m.waitForTimeout(100);
  assert.ok(
    await m.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight + 2,
    ),
  );
  await m.setViewportSize({ width: 1280, height: 800 });
  await a.locator('[data-party="local-mute"]').click();
  assert.equal(
    await a.locator('[data-party="local-mute"]').getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    await b.evaluate(() => !!window.testFrame.public.audioPaused),
    false,
  );
  await a.locator('[data-party="local-mute"]').click();
  await a.locator('[data-party="focus"]').click();
  await a.evaluate(() => (document.querySelector("#sheet").scrollTop = 0));
  assert.ok(
    await a
      .locator(".instrument")
      .evaluate((n) => n.getBoundingClientRect().width > innerWidth * 0.9),
  );
  await a.screenshot({ path: "test-results/music-one-plane.png" });
  await a.locator('[data-party="focus"]').click();
  await m.screenshot({ path: "test-results/music-garden-monitor.png" });
  console.log(
    "PASS both performers have four points on one plane; all eight controls reach the public scene",
  );
  await close(a);
  await close(b);
  await open(a, "meditation");
  await open(b, "meditation");
  await a.locator('[data-party="ready"]').click();
  await b.locator('[data-party="ready"]').click();
  await a.locator("[data-constellation]").first().waitFor();
  const before = await a
    .locator("[data-constellation]")
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.constellation));
  await a.locator('[data-party="music-shuffle"]').click();
  await a.waitForFunction(
    (previous) =>
      JSON.stringify(
        [...document.querySelectorAll("[data-constellation]")].map(
          (n) => n.dataset.constellation,
        ),
      ) !== JSON.stringify(previous),
    before,
  );
  const keys = await a
    .locator("[data-constellation]")
    .evaluateAll((nodes) => nodes.map((n) => n.dataset.constellation));
  await b.waitForFunction(
    (mine) =>
      [...document.querySelectorAll("[data-constellation]")].every(
        (n) => !mine.includes(n.dataset.constellation),
      ),
    keys,
  );
  for (const p of [a, b]) {
    assert.equal(await p.locator("[data-meditation-point]").count(), 2);
    assert.equal(await p.locator("[data-constellation]").count(), 6);
    await p.waitForFunction(() =>
      window.testAudio.some((c) => c.state === "running"),
    );
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
