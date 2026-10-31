import { chromium } from "playwright";
import assert from "node:assert/strict";
import { solveBeaconModule } from "./helpers/beacon-solver.mjs";
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
  const length = Number(process.env.BEACON_LENGTH || 9);
  async function open(p) {
    await close(p);
    await nav(p, "games");
    await p.locator('[data-action="play"][data-id="beacon"]').click();
  }
  await open(a);
  assert.equal(await a.locator(".table-lobby").count(), 0);
  await a
    .locator(`[data-party="beacon-start"][data-length="${length}"]`)
    .click();
  await open(b);
  await b.locator('[data-party="beacon-resume"]').click();
  await a.locator('[data-party="ready"]').click();
  await b.locator('[data-party="ready"]').click();
  await m.waitForFunction(
    () =>
      window.testFrame?.kind === "beacon" &&
      window.testFrame?.stage === "running",
  );
  const getState = () =>
    a.evaluate(() =>
      JSON.parse(
        localStorage.getItem(
          Object.keys(localStorage).find((k) => k.startsWith("vmeste:beacon:")),
        ),
      ),
    );
  const first = await getState(),
    ownA = await a.evaluate(() => localStorage.getItem("vmeste-user"));
  const pages = Object.fromEntries(
    first.players.map((p) => [p.id, p.id === ownA ? a : b]),
  );
  const captured = new Set();
  async function changed(revision) {
    await a.waitForFunction(
      (revision) =>
        JSON.parse(
          localStorage.getItem(
            Object.keys(localStorage).find((k) =>
              k.startsWith("vmeste:beacon:"),
            ),
          ),
        ).revision > revision,
      revision,
    );
  }
  for (let turn = 0; turn < length; turn++) {
    const initial = await getState();
    assert.equal(initial.turn, turn);
    const model = structuredClone(initial);
    model.__trace = [];
    solveBeaconModule(model);
    let inspected = false;
    for (const command of model.__trace) {
      const before = await getState(),
        page = pages[command.id];
      if (command.action !== "beacon-ready" && !inspected) {
        inspected = true;
        const engineer = pages[before.engineer],
          guide = pages[before.guides[0]];
        await engineer.locator(".beacon-machine").waitFor();
        await guide.locator(".beacon-guide").waitFor();
        assert.equal(await engineer.locator(".beacon-guide").count(), 0);
        assert.equal(await guide.locator(".beacon-machine").count(), 0);
        assert.equal(
          await m.locator(".beacon-machine,.beacon-guide").count(),
          0,
        );
        assert.equal(
          await m.evaluate(() => window.testFrame.public.machine),
          undefined,
        );
        if (!captured.has(before.module.id)) {
          captured.add(before.module.id);
          await engineer
            .locator(".beacon-observations")
            .scrollIntoViewIfNeeded();
          await engineer.screenshot({
            path: `test-results/beacon-${before.module.id}-engineer.png`,
          });
          await guide.locator(".beacon-guide").scrollIntoViewIfNeeded();
          await guide.screenshot({
            path: `test-results/beacon-${before.module.id}-guide.png`,
          });
          await m.screenshot({
            path: `test-results/beacon-${before.module.id}-monitor.png`,
          });
        }
      }
      if (
        command.action === "beacon-launch" &&
        before.module.id === "pendulum"
      ) {
        const period = before.machine.period / before.machine.gears[1];
        const raw = before.machine.direction
          ? 1 - command.measure
          : command.measure;
        let target = before.machine.clockStart + raw * period;
        while (target < Date.now() + 200) target += period;
        await page.waitForTimeout(Math.max(0, target - Date.now()));
      }
      let selector = `[data-beacon-action="${command.action}"]`;
      if (command.index != null && command.action === "beacon-set") selector += `[data-index="${command.index}"]`;
      if (command.value != null && command.value !== 0 && command.action !== "beacon-launch")
        selector += `[data-value="${command.value}"]`;
      await page.locator(selector).click();
      await changed(before.revision);
    }
    const result = await getState();
    assert.equal(result.phase, "result");
    if (turn === 0) {
      await close(a);
      await a.reload();
      await a.locator(".bottom-nav").waitFor();
      await open(a);
      await a.locator('[data-party="beacon-resume"]').click();
      assert.equal((await getState()).turn, 0);
    }
    for (const p of result.players) {
      const old = await getState();
      await pages[p.id].locator('[data-beacon-action="beacon-ready"]').click();
      await changed(old.revision);
    }
    await a.waitForFunction(
      ({ turn, length }) => {
        const s = JSON.parse(
          localStorage.getItem(
            Object.keys(localStorage).find((k) =>
              k.startsWith("vmeste:beacon:"),
            ),
          ),
        );
        return turn === length - 1 ? s.finished : s.turn === turn + 1;
      },
      { turn, length },
    );
    if ((await getState()).phase === "voyage")
      for (const p of result.players) {
        const old = await getState();
        await pages[p.id]
          .locator(
            `[data-beacon-action="beacon-voyage"][data-value="${turn % 3 ? 1 : 0}"]`,
          )
          .click();
        await changed(old.revision);
      }
    console.log(
      "PASS beacon node",
      turn + 1,
      initial.module.id,
      result.result.score,
    );
  }
  const final = await getState();
  assert.ok(final.finished);
  assert.equal(final.journal.length, length);
  assert.equal(final.harbor.ships.length, Math.ceil(length / 2));
  await a.locator('[data-party="beacon-home"]').click();
  await a.locator('[data-party="beacon-record"]').first().waitFor();
  await a.locator('[data-party="beacon-record"]').first().click();
  assert.equal(await a.locator(".beacon-journal article").count(), length);
  assert.equal(
    await a.locator(".beacon-arrivals article").count(),
    Math.ceil(length / 2),
  );
  await a.screenshot({ path: "test-results/beacon-saved-harbor.png" });
  assert.deepEqual(errors, []);
  console.log(
    `PASS beacon ${length} nodes: private physical panels/manuals, changing roles, harbor consequences, host reload and detailed saved harbor`,
  );
} finally {
  await browser.close();
}
