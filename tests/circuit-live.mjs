import { chromium } from "playwright";
import assert from "node:assert/strict";
import { solveCircuitTrial } from "./helpers/circuit-solver.mjs";
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
  const runLength = Number(process.env.CIRCUIT_LENGTH || 24);
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
  await nav(a, "games");
  await a.locator('[data-action="play"][data-id="race"]').click();
  assert.equal(await a.locator(".table-lobby").count(), 0);
  await a.getByRole("heading", { name: "Ваши общие рекорды" }).waitFor();
  await a
    .locator(`[data-party="circuit-start"][data-length="${runLength}"]`)
    .click();
  await close(b);
  await nav(b, "games");
  await b.locator('[data-action="play"][data-id="race"]').click();
  await b.locator('[data-party="circuit-resume"]').click();
  await a.locator('[data-party="ready"]').click();
  await b.locator('[data-party="ready"]').click();
  const getState = () =>
    a.evaluate(() =>
      JSON.parse(
        localStorage.getItem(
          Object.keys(localStorage).find((k) =>
            k.startsWith("vmeste:circuit:"),
          ),
        ),
      ),
    );
  let initial = await getState();
  const ownA = await a.evaluate(() => localStorage.getItem("vmeste-user"));
  const pages = Object.fromEntries(
    initial.players.map((p) => [p.id, p.id === ownA ? a : b]),
  );
  async function changed(revision) {
    await a.waitForFunction(
      (revision) =>
        JSON.parse(
          localStorage.getItem(
            Object.keys(localStorage).find((k) =>
              k.startsWith("vmeste:circuit:"),
            ),
          ),
        ).revision > revision,
      revision,
    );
  }
  for (let turn = 0; turn < runLength; turn++) {
    const current = await getState();
    assert.equal(current.turn, turn);
    const model = structuredClone(current);
    model.__trace = [];
    solveCircuitTrial(model);
    let trace = model.__trace;
    if (current.trial.family === "rhythm")
      trace = [
        ...trace.filter((c) => c.action !== "run-hit"),
        ...trace
          .filter((c) => c.action === "run-hit")
          .sort((a, b) => a.measure - b.measure),
      ];
    for (const command of trace) {
      const page = pages[command.id],
        before = await getState();
      if (command.action === "run-hit") {
        const family = before.trial.family;
        if (family === "hold") {
          await page.locator('[data-party="run-hold"]').click();
          await page.waitForTimeout(command.measure);
          await page.locator('[data-party="run-hold"]').click();
        } else {
          let target;
          if (family === "rhythm")
            target = before.q.started + command.measure * before.q.period;
          else {
            const offset = before.q.offsets[command.id] || 0;
            target = before.q.started + (0.5 - offset) * before.q.period;
            while (target < Date.now() + 150) target += before.q.period;
          }
          await page.waitForTimeout(Math.max(0, target - Date.now()));
          await page.locator('[data-run-action="run-hit"]').click();
        }
      } else {
        let selector = `[data-run-action="${command.action}"]`;
        if (command.value != null)
          selector += `[data-value="${command.value}"]`;
        await page.locator(selector).click();
      }
      await changed(before.revision).catch(async (error) => {
        console.log("STATE", JSON.stringify(await getState()));
        throw error;
      });
    }
    const result = await getState();
    assert.equal(result.phase, "result");
    await m.waitForFunction(() => window.testFrame?.public.phase === "result");
    assert.equal(await a.locator('[data-party="finish"]').count(), 0);
    if (turn === 0) {
      await close(a);
      await a.reload();
      await a.locator(".bottom-nav").waitFor();
      await nav(a, "games");
      await a.locator('[data-action="play"][data-id="race"]').click();
      await a.locator('[data-party="circuit-resume"]').click();
      assert.equal((await getState()).turn, 0);
    }
    for (const player of result.players) {
      const before = await getState();
      await pages[player.id].locator('[data-run-action="run-ready"]').click();
      await changed(before.revision);
    }
    await a.waitForFunction(
      ({ turn, runLength }) => {
        const s = JSON.parse(
          localStorage.getItem(
            Object.keys(localStorage).find((k) =>
              k.startsWith("vmeste:circuit:"),
            ),
          ),
        );
        return turn === runLength - 1 ? s.finished : s.turn === turn + 1;
      },
      { turn, runLength },
    );
    console.log(
      "PASS live trial",
      turn + 1,
      current.trial.id,
      result.result.score,
    );
  }
  const finished = await getState();
  assert.ok(finished.finished);
  assert.equal(finished.journal.length, runLength);
  await a.locator('[data-party="circuit-home"]').click();
  await a.locator(".circuit-records article").first().waitFor();
  assert.ok(
    (await a.locator(".circuit-records").textContent()).includes(
      String(runLength),
    ),
  );
  await a.screenshot({ path: "test-results/circuit-team-record.png" });
  await a.locator('[data-party="view-team-record"]').first().click();
  assert.equal(await a.locator(".circuit-records article").count(), runLength);
  await a.locator('[data-party="delete-record"]').click();
  assert.equal(await a.locator(".record-history-card").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    `PASS full ${runLength}-trial real-peer cooperative run, host reload, menu, detailed shared record and deletion`,
  );
} finally {
  await browser.close();
}
