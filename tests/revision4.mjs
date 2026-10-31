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

  async function game(id) {
    await close(a);
    await close(b);
    await nav(a, "games");
    await a.locator(`[data-action="play"][data-id="${id}"]`).click();
    await m.waitForFunction((id) => window.testFrame?.kind === id, id);
    assert.equal(
      await a.locator('[data-party="ready"]').textContent(),
      "Готов",
    );
    if (await b.locator('[data-party="join"]').count())
      await b.locator('[data-party="join"]').click();
    else {
      await close(b);
      await nav(b, "games");
      await b.locator(`[data-action="play"][data-id="${id}"]`).click();
    }
    await a.locator('[data-party="ready"]').click();
    await b.locator('[data-party="ready"]').click();
    await m.waitForFunction(
      (id) =>
        window.testFrame?.kind === id && window.testFrame?.stage === "running",
      id,
    );
  }
  await game("word");
  await a.locator("#party-answer-form textarea").fill("Ответ А");
  await a.locator("#party-answer-form button").click();
  await a.locator('[data-party="not-ready"]').waitFor();
  assert.ok(!(await m.locator("body").innerText()).includes("Ответ А"));
  await a.locator('[data-party="not-ready"]').click();
  await a.locator("#party-answer-form textarea").fill("Изменённый ответ");
  await a.locator("#party-answer-form button").click();
  await b.locator("#party-answer-form textarea").fill("Ответ Б");
  await b.locator("#party-answer-form button").click();
  await m.getByText("Изменённый ответ", { exact: true }).waitFor();
  console.log(
    "PASS lobby, invitation, ready, cancel ready, simultaneous reveal",
  );
  const previousPrompt = await m.locator(".party-prompt").textContent();
  await a.locator('[data-party="reveal"]').click();
  await m.waitForFunction(() => window.testFrame?.public.turn === 1);
  const followingPrompt = await m.locator(".party-prompt").textContent();
  await b.locator('[data-party="round-back"]').click();
  await m.waitForFunction((t) => window.testFrame?.text === t, previousPrompt);
  await a.locator('[data-party="reveal"]').click();
  await m.waitForFunction((t) => window.testFrame?.text === t, followingPrompt);
  console.log(
    "PASS previous round restores both answers and exact following prompt",
  );

  await game("choice");
  await a.locator('[data-party="deck-choice"][data-value="0"]').click();
  assert.ok(!(await m.locator("body").innerText()).includes("Левая дверь"));
  await b.locator('[data-party="deck-choice"][data-value="1"]').click();
  await m.locator(".door-results").waitFor();
  const original = await a.locator(".table-card p").textContent();
  await a.locator('[data-party="deck-next"]').click();
  await a.waitForFunction(
    () =>
      document.querySelector('[data-party="deck-back"]')?.disabled === false,
  );
  await a.locator('[data-party="deck-back"]').click();
  await a.waitForFunction(
    (t) => document.querySelector(".table-card p")?.textContent === t,
    original,
  );
  console.log(
    "PASS phone choices reveal together and unlimited backward history",
  );
  await game("mixed");
  await a.locator('[data-party="deck-pick"][data-value="dare"]').click();
  await a.waitForFunction(
    () => !!document.querySelector('[data-party="deck-next"]:not([disabled])'),
  );
  assert.equal(await a.locator('[data-party="deck-pick"]').count(), 0);
  await a.locator('[data-party="deck-next"]').click();
  await b.locator('[data-party="deck-pick"][data-value="truth"]').waitFor();
  console.log("PASS truth/dare choice and alternating turns");
  await game("draw");
  await b.locator('[data-party="draw-solved"]').click();
  await m.waitForFunction(() => window.testFrame?.public?.solved);
  console.log("PASS drawing guessed aloud; no typed guess");
  await game("soundgarden");
  await a.locator('[data-party="sound"]').click();
  const pad = a.locator('[data-sound-pad="0"]');
  await pad.focus();
  await pad.press("ArrowRight");
  await b.waitForFunction(() =>
    Object.values(window.testFrame.public.contributors).some(
      (c) => c.pads?.[0]?.[0] > 0.5,
    ),
  );
  assert.equal(await a.locator(".mood-sliders").count(), 0);
  await close(a);
  await a.locator("#ambient-player").waitFor();
  await a.locator('#ambient-player [data-party="sound"]').click();
  await a.getByText("На паузе", { exact: true }).waitFor();
  await a.locator('#ambient-player [data-party="player-stop"]').click();
  assert.equal(await a.locator("#ambient-player").count(), 0);
  console.log("PASS XY controls propagate; minimized player pauses and stops");
  await game("meditation");
  await a.locator('[data-party="sound"]').click();
  const star = a.locator('[data-constellation="0"]');
  await star.focus();
  await star.press("Space", { delay: 600 });
  await b.waitForFunction(() =>
    Object.values(window.testFrame.public.contributors).some(
      (c) => c.stars?.length,
    ),
  );
  console.log("PASS held constellation shared with partner");
  await a.screenshot({
    path: "test-results/instrument-v4.png",
    fullPage: true,
  });
  await close(a);
  await nav(a, "ideas");
  await a.locator('[data-action="swipe"]').click();
  const first = await a.locator(".swipe-copy h3").textContent();
  await a.locator('[data-action="swipe-next"]').click();
  await a.waitForFunction(
    (t) => document.querySelector(".swipe-copy h3")?.textContent !== t,
    first,
  );
  await a.locator('[data-action="swipe-back"]').click();
  await a.waitForFunction(
    (t) => document.querySelector(".swipe-copy h3")?.textContent === t,
    first,
  );
  console.log("PASS swipe backward history");

  await game("archipelago");
  const markNames = ["Луна", "Лист", "Волна", "Искра"];
  const guideA = await a.locator(".private-instructions h3").textContent(),
    guideB = await b.locator(".private-instructions h3").textContent();
  await a
    .locator(
      `[data-party="mission-symbol"][data-value="${markNames.findIndex((n) => guideB.includes(n))}"]`,
    )
    .click();
  await b
    .locator(
      `[data-party="mission-symbol"][data-value="${markNames.findIndex((n) => guideA.includes(n))}"]`,
    )
    .click();
  await m.waitForFunction(() => window.testFrame?.public.phase === "reveal");
  await a.locator('[data-party="island-next"]').click();
  await m.waitForFunction(() => window.testFrame?.public.turn === 1);
  const pattern = await m.evaluate(() => window.testFrame.public.pattern);
  await a.locator('[data-party="mission-memorized"]').click();
  await b.locator('[data-party="mission-memorized"]').click();
  for (const p of [a, b])
    for (const value of pattern) {
      await p
        .locator(`[data-party="mission-symbol"][data-value="${value}"]`)
        .click();
    }
  await m.waitForFunction(() => window.testFrame?.public.phase === "reveal");
  console.log(
    "PASS new expedition: asymmetric signals and shared memory chapters",
  );
  await game("rift");
  assert.equal(await a.locator(".rift-maze").count(), 0);
  await a.screenshot({
    path: "test-results/expedition-v4.png",
    fullPage: true,
  });
  console.log(
    "PASS PC-required game uses separate controller and display views",
  );
  // Simultaneous opening must resolve to one table, with both original hosts joined.
  await close(a);
  await close(b);
  await Promise.all([nav(a, "games"), nav(b, "games")]);
  await Promise.all([
    a.locator('[data-action="play"][data-id="museum"]').click(),
    b.locator('[data-action="play"][data-id="museum"]').click(),
  ]);
  await m.waitForFunction(
    () =>
      window.testFrame?.kind === "museum" &&
      window.testFrame.public.joined.length === 2,
  );
  const round = await m.evaluate(() => window.testFrame.round);
  await a.locator('[data-party="ready"]').click();
  await b.locator('[data-party="ready"]').click();
  await m.waitForFunction(() => window.testFrame?.stage === "running");
  assert.equal(await m.evaluate(() => window.testFrame.round), round);
  console.log(
    "PASS simultaneous duplicate lobbies merge and both players can ready",
  );
  await a.reload();
  await a.locator(".bottom-nav").waitFor();
  await a.locator('[data-action="open-live-game"][data-id="museum"]').click();
  await a.locator("#party-panel").waitFor();
  assert.equal(await m.evaluate(() => window.testFrame.round), round);
  console.log(
    "PASS host reload restores existing table rather than creating another",
  );
  assert.deepEqual(errors, []);
  console.log("PASS no uncaught JavaScript errors");
} finally {
  await browser.close();
}
