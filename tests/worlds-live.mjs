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
  await open(a, "meditation");
  await a.locator('[data-party="solo"]').click();
  await a.locator('[data-party="sound"]').click();
  assert.equal(await a.locator(".voice-tabs button").count(), 4);
  await a.locator('[data-party="voice"][data-index="2"]').click();
  await a.locator('[data-sound-pad="0"]').focus();
  await a.locator('[data-sound-pad="0"]').press("ArrowLeft");
  await close(a);
  await open(b, "questions");
  await m.waitForFunction(() => window.testFrame?.kind === "questions");
  assert.equal(await a.locator(".game-invitation").count(), 0);
  assert.ok(await a.locator("#ambient-player").count());
  await a.locator('[data-action="play"][data-id="questions"]').click();
  await a.locator('[data-party="ready"]').click();
  await b.locator('[data-party="ready"]').click();
  await b.locator('[data-party="deck-next"]').click();
  await a.waitForFunction(
    () =>
      document.querySelector('[data-party="deck-back"]')?.disabled === false,
  );
  assert.equal(await a.evaluate(() => window.testAudio[0].state), "running");
  console.log(
    "PASS solo instrument with four panels keeps playing beside another shared game; invitation does not interrupt",
  );
  await close(b);
  await open(b, "meditation");
  await b.locator('[data-sound-pad="0"]').waitFor();
  await b.locator('[data-party="sound"]').click();
  await b.locator('[data-sound-pad="0"]').focus();
  await b.locator('[data-sound-pad="0"]').press("ArrowRight");
  assert.equal(await b.locator(".voice-tabs").count(), 0);
  await a.locator('#ambient-player [data-party="player-open"]').click();
  await a.waitForFunction(() => !document.querySelector(".voice-tabs"));
  console.log(
    "PASS entering same instrument joins solo session and restores distinct two-person roles",
  );
  const star = a.locator('[data-constellation="0"]');
  await star.focus();
  await star.press("Space", { delay: 500 });
  await a.waitForFunction(() =>
    document
      .querySelector('[data-constellation="0"]')
      ?.classList.contains("remembered"),
  );
  console.log(
    "PASS constellation retains a persistent subtle memory after release",
  );
  await close(a);
  await close(b);
  await ac.setOffline(true);
  await bc.setOffline(true);
  await open(a, "gardenworld");
  await a.locator('[data-world="plant"][data-species="luna"]').click();
  await a.locator(".garden-plot").waitFor();
  await open(b, "gardenworld");
  await b.locator('[data-world="plant"][data-species="sun"]').click();
  await b.locator(".garden-plot").waitFor();
  await ac.setOffline(false);
  await bc.setOffline(false);
  await a.waitForFunction(
    () => document.querySelectorAll(".garden-plot").length === 2,
    {},
    { timeout: 40000 },
  );
  await b.waitForFunction(
    () => document.querySelectorAll(".garden-plot").length === 2,
    {},
    { timeout: 40000 },
  );
  console.log(
    "PASS real offline garden actions on separate devices merge without losing plants",
  );
  await close(a);
  await open(a, "lettersworld");
  await ac.setOffline(true);
  for (let i = 0; i < 10; i++) {
    await a.locator('[data-world="letters-compose"]').click();
    await a
      .locator("#world-question-form textarea")
      .fill("Вопрос без спешки " + i);
    await a.locator("#world-question-form button").click();
    await a.locator('[data-world="letters-compose"]').waitFor();
  }
  await close(b);
  await bc.setOffline(false);
  await ac.setOffline(false);
  await b.waitForFunction(
    () =>
      Number(document.querySelector("[data-unread-count]")?.textContent) >= 10,
    {},
    { timeout: 40000 },
  );
  assert.equal(await b.locator(".game-invitation").count(), 0);
  const count = await b.locator("[data-unread-count]").textContent();
  assert.ok(Number(count) >= 10);
  await b.locator(".activity-bell").click();
  await b.locator('.activity-item[data-id="lettersworld"]').first().click();
  await b
    .locator("#world-answer-form textarea")
    .fill("Ответ, который можно прочитать завтра.");
  await b.locator("#world-answer-form button").click();
  await a.waitForFunction(
    () =>
      Number(document.querySelector("[data-unread-count]")?.textContent) > 0,
  );
  await close(a);
  await a.locator(".activity-bell").click();
  await a
    .locator('.activity-item[data-id="lettersworld"]')
    .filter({ hasText: "Ответ, который можно прочитать завтра." })
    .click();
  await a
    .getByText("Ответ, который можно прочитать завтра.", { exact: true })
    .waitFor();
  console.log(
    "PASS ten offline questions create one quiet badge; notification opens exact answer thread",
  );
  await a.screenshot({ path: "test-results/letters-v4.png" });
  await close(a);
  await nav(a, "profile");
  assert.equal(await a.locator(".settings-actions").count(), 0);
  await a.locator('[data-action="room-menu"]').click();
  await a.locator(".current-room").waitFor();
  await a.locator('#sheet [data-action="settings"]').click();
  await a.locator('[data-action="settings-files"]').click();
  await a.locator("#import-file").waitFor({ state: "attached" });
  console.log(
    "PASS room switcher and compact icon settings replace profile text clutter",
  );
  await close(a);
  await nav(a, "ideas");
  await a.locator('[data-action="swipe"]').click();
  await a.locator('[data-action="swipe-filter"]').click();
  await a
    .locator('#swipe-filter-form select[name="location"]')
    .selectOption("Дома");
  await a.locator("#swipe-filter-form button").click();
  assert.ok(
    (await a.locator(".swipe-filter-summary").textContent()).includes("Дома"),
  );
  await a.locator('[data-action="swipe-add"]').click();
  await close(a);
  await nav(a, "build");
  await a.locator('[data-action="plan-like"]').first().click();
  await a.locator('[data-action="plan-like"][aria-pressed="true"]').waitFor();
  console.log(
    "PASS swipe filters and functional like button on a planned activity",
  );
  for (const width of [360, 390, 450, 1280]) {
    await a.setViewportSize({ width, height: 844 });
    assert.equal(
      await a.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
  }
  assert.deepEqual(errors, []);
  console.log("PASS no horizontal overflow and no uncaught JavaScript errors");
} finally {
  await browser.close();
}
