import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const errors = [];
async function client() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.addInitScript(() => {
    window.framesSeen = [];
    window.audioContexts = [];
    const BaseAudio = window.AudioContext;
    window.AudioContext = class extends BaseAudio {
      constructor(...args) {
        super(...args);
        window.audioContexts.push(this);
      }
    };
    window.addEventListener("vmeste-game-view", (e) => {
      window.framesSeen.push(e.detail);
      window.frameSeen = e.detail;
    });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  return page;
}
async function close(p) {
  if (await p.locator("#sheet[open]").count())
    await p.locator(".close-sheet").click();
}
async function approve(a, b) {
  await a.locator("[data-action=approve-pair]").click({ timeout: 40000 });
  await b.locator("[data-action=confirm-pair-code]").click();
}
async function open(p, id) {
  await close(p);
  await p.locator(".bottom-nav [data-action=games]").click();
  await p.locator(`[data-action=play][data-id="${id}"]`).click();
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
  await approve(a, b);
  await b.locator("#profile-form").waitFor();
  const monitor = await client();
  await monitor.goto(a.url());
  await monitor.getByLabel("Как вас зовут?").fill("Экран");
  await monitor.locator("[name=entryMode]").selectOption("display");
  await monitor.locator("#onboard-form button").click();
  await approve(a, monitor);
  await monitor.locator(".projector").waitFor();
  await open(a, "draw");
  await open(b, "draw");
  await a.locator("[data-party=ready]").click();
  await b.locator(".lobby-players .is-ready").waitFor();
  await b.locator("[data-party=ready]").click();
  await a.locator("#draw-pad").waitFor();
  const round = await b.evaluate(() => window.frameSeen.round);
  // Exercise the authenticated command listener with a long drawing: more than
  // the old 900-line retention and old 48 KB transport envelope.
  await a.evaluate(
    ({ round }) => {
      const saved = Object.keys(localStorage).find((k) =>
        k.startsWith("vmeste:session:"),
      );
      const sender = JSON.parse(localStorage.getItem(saved)).drawer;
      for (let offset = 0; offset < 2500; offset += 25)
        window.dispatchEvent(
          new CustomEvent("vmeste-game-input", {
            detail: {
              sender,
              input: {
                round,
                action: "ink",
                lines: Array.from({ length: 25 }, (_, i) => [
                  (offset + i) % 990,
                  10,
                  ((offset + i) % 990) + 1,
                  11,
                  0,
                ]),
              },
            },
          }),
        );
    },
    { round },
  );
  await b.waitForTimeout(2000);
  await b.waitForFunction(() =>
    window.framesSeen.some((f) => f.public.lines?.length === 2500),
  );
  assert.deepEqual(
    await b.evaluate(() => window.frameSeen.public.lines[0]),
    [0, 10, 1, 11, 0],
  );
  await b.waitForTimeout(31000);
  await b.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await a
    .getByText("Игра сохранена. Продолжим, когда все вернутся.", {
      exact: true,
    })
    .waitFor();
  await b.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await a.locator("#draw-pad").waitFor();
  await b.locator("[data-party=draw-solved]").click();
  await a.locator("[data-party=draw-next]").waitFor();
  await a.locator("[data-party=draw-next]").click();
  await a.locator("[data-party=draw-skip]").click();
  await a.locator("[data-party=draw-next]").waitFor();
  await close(a);
  await b.waitForFunction(() =>
    window.framesSeen.some(
      (f) => f.round === window.frameSeen.round && f.finished,
    ),
  );
  await close(b);
  console.log(
    "PASS two phones: readiness, 2500 retained strokes, >30s drawing, guessed, skipped and host exit",
  );
  await open(a, "likely");
  await open(b, "likely");
  await a.locator("[data-party=ready]").click();
  await b.locator("[data-party=ready]").click();
  await a.locator("[data-party=deck-choice]").first().click();
  assert.equal(await a.locator(".door-results").count(), 0);
  await b.locator("[data-party=deck-choice]").last().click();
  await a.locator(".door-results").waitFor();
  await b.locator(".door-results").waitFor();
  await monitor.locator(".party-likely").waitFor();
  await close(a);
  await close(b);
  await open(a, "riddles");
  await a.locator("[data-party=solo]").click();
  await a.locator("details.private-instructions").waitFor();
  await close(a);
  console.log(
    "PASS private two-phone votes revealed together; monitor follows game; riddles play on one phone",
  );
  await open(a, "meditation");
  await a.locator("[data-party=solo]").click();
  await a.locator("[data-party=sound]").click();
  await monitor.waitForFunction(
    () =>
      window.frameSeen.kind === "meditation" &&
      window.frameSeen.stage === "running",
  );
  await monitor.locator("[data-action=projector-sound]").click();
  await monitor.waitForFunction(
    () => window.audioContexts.at(-1)?.state === "running",
  );
  await close(a);
  await a.locator("#ambient-player [data-party=player-stop]").click();
  await monitor.waitForFunction(
    () => window.audioContexts.at(-1)?.state === "closed",
  );
  console.log(
    "PASS common screen plays music after gesture and releases audio when the game closes",
  );
  await a.locator(".bottom-nav [data-action=profile]").click();
  await a.locator("[data-action=mood-journal]").click();
  await a.locator("[name=note]").fill("Хороший спокойный день");
  await a.locator("#mood-form button[type=submit]").click();
  await a.locator(".mood-history article").waitFor();
  await a.screenshot({ path: "test-results/mood-journal.png" });
  await close(a);
  await open(a, "gardenworld");
  await a
    .locator("#garden-wish-form textarea")
    .fill("Пусть у тебя всё получится");
  await a.locator("#garden-wish-form button").click();
  await a.locator(".flower-wish").waitFor();
  await close(a);
  await open(b, "gardenworld");
  await b.getByText("Пусть у тебя всё получится", { exact: true }).waitFor();
  console.log(
    "PASS daily mood and unique wish flower are persisted and sync to partner",
  );
  await b.screenshot({ path: "test-results/wish-garden.png" });
  assert.deepEqual(errors, []);
  console.log("PASS no page errors");
} finally {
  await browser.close();
}
