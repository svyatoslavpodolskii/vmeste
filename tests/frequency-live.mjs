import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const errors = [];
async function fresh(w = 390) {
  const c = await browser.newContext({ viewport: { width: w, height: 844 } });
  await c.addInitScript(() => {
    window.addEventListener(
      "vmeste-game-private",
      (e) => (window.testPrivate = e.detail),
    );
    window.addEventListener(
      "vmeste-game-view",
      (e) => (window.testFrame = e.detail),
    );
  });
  c.on("page", (p) =>
    p.on("pageerror", (e) => {
      errors.push(e.message);
      console.log("ERROR", e.message);
    }),
  );
  return { c, p: await c.newPage() };
}
async function join(a, url, name, mode = "player") {
  const x = await fresh(mode === "display" ? 1280 : 390);
  await x.p.goto(url);
  await x.p.getByLabel("Как вас зовут?").fill(name);
  await x.p.locator('select[name="entryMode"]').selectOption(mode);
  await x.p.locator("#onboard-form button").click();
  await a.locator('[data-action="approve-pair"]').waitFor({ timeout: 35000 });
  await a.locator('[data-action="approve-pair"]').click();
  await x.p.locator('[data-action="confirm-pair-code"]').click();
  await x.p
    .locator(mode === "display" ? ".projector" : "#profile-form")
    .waitFor();
  return x;
}
async function match(count) {
  const root = await fresh(),
    a = root.p;
  await a.goto(process.env.VMESTE_BASE || "http://127.0.0.1:4173");
  await a.getByLabel("Как вас зовут?").fill("Анна");
  await a
    .locator('select[name="capacity"]')
    .selectOption(count > 2 ? "10" : "2");
  await a.locator("#onboard-form button").click();
  await a.locator("#profile-form").waitFor();
  const contexts = [root],
    pages = [a],
    names = ["Анна", "Борис", "Вика"];
  for (let i = 1; i < count; i++) {
    const x = await join(a, a.url(), names[i] || `Игрок ${i + 1}`);
    contexts.push(x);
    pages.push(x.p);
  }
  const screen = await join(a, a.url(), "Общая частота", "display"),
    m = screen.p;
  contexts.push(screen);
  // The game controller is deliberately not the transport hub.
  const host = pages[1];
  await host.locator('.bottom-nav [data-action="games"]').click();
  await host.locator('[data-action="play"][data-id="frequency"]').click();
  await m.waitForFunction(() => window.testFrame?.kind === "frequency");
  for (const p of pages.filter((p) => p !== host))
    await p.locator('[data-action="open-live-game"]').click();
  const rounds = Math.max(4, count),
    used = [];
  for (let turn = 0; turn < rounds; turn++) {
    console.log("TURN", count, turn);
    await m.waitForFunction(
      (t) =>
        window.testFrame?.public.turn === t &&
        window.testFrame.public.phase === "clue",
      turn,
    );
    const info = await m.evaluate(() => window.testFrame.public);
    const leadName = info.players.find((u) => u.id === info.lead).name;
    const lead = pages[info.players.findIndex((u) => u.name === leadName)],
      others = pages.filter((p) => p !== lead);
    await lead
      .waitForFunction(() =>
        /^\d+$/.test(
          document.querySelector("[data-frequency-secret]")?.textContent || "",
        ),
      )
      .catch(async (e) => {
        console.log(
          "DEBUG",
          await lead.evaluate(() => ({
            frame: window.testFrame,
            secret: window.testPrivate,
            body: document.body.innerText.slice(-3500),
          })),
        );
        throw e;
      });
    const target = Number(
      await lead.locator("[data-frequency-secret]").innerText(),
    );
    assert.equal(info.target, undefined);
    assert.equal(info.guesses, undefined);
    for (const p of others)
      assert.equal(await p.locator("[data-frequency-secret]").count(), 0);
    assert.ok(!used.includes(info.axis.join("|")));
    used.push(info.axis.join("|"));
    await lead
      .locator("#party-answer-form input")
      .fill("Завтрак в домике над облаками");
    await lead.locator("#party-answer-form button").click();
    await m.waitForFunction(() => window.testFrame?.public.phase === "guess");
    const guess =
      turn === rounds - 1 ? (target <= 80 ? target + 20 : target - 20) : target;
    for (let i = 0; i < others.length; i++) {
      await others[i].locator("[data-frequency-slider]").fill(String(guess));
      await others[i].locator("#party-answer-form button").click();
      if (i < others.length - 1) {
        await m.waitForFunction(
          (n) => window.testFrame?.public.voted.length === n,
          i + 1,
        );
        assert.equal(
          await m.evaluate(() => window.testFrame.public.guesses),
          undefined,
        );
        assert.equal(
          await m.evaluate(() => window.testFrame.public.target),
          undefined,
        );
        await others[i]
          .getByText(
            "Ваша частота принята. Дождёмся остальных и откроем всё вместе.",
          )
          .waitFor();
      }
    }
    await m.waitForFunction(() => window.testFrame?.public.phase === "reveal");
    assert.equal(
      await m.evaluate(() => window.testFrame.public.target),
      target,
    );
    assert.equal(
      await m.evaluate(() => window.testFrame.public.consensus),
      guess,
    );
    assert.equal(
      await m.evaluate(() => window.testFrame.public.gain),
      turn === rounds - 1 ? 20 : 100,
    );
    if (turn === 0) {
      await m.setViewportSize({ width: 1280, height: 720 });
      await m.evaluate(() =>
        document.querySelector("#toast")?.classList.remove("visible"),
      );
      const bounds = await m.locator(".party-frequency").boundingBox();
      assert.ok(bounds.y + bounds.height <= 720, JSON.stringify(bounds));
      assert.ok(
        await m.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      await m.screenshot({
        path: `test-results/frequency-${count}-screen.png`,
        fullPage: true,
      });
      await others[0].screenshot({
        path: `test-results/frequency-${count}-phone.png`,
        fullPage: true,
      });
    }
    await host.locator('[data-party="frequency-next"]').click();
  }
  await m.waitForFunction(() => window.testFrame?.finished);
  const expectedScore = Math.round(((rounds - 1) * 100 + 20) / rounds);
  assert.equal(
    await m.evaluate(() => window.testFrame.public.score),
    expectedScore,
  );
  assert.equal(await m.locator(".frequency-log article").count(), rounds);
  await host.locator(".record-sheet").waitFor();
  assert.ok(
    (await host.locator(".record-sheet").innerText()).includes(
      `${expectedScore} /100`,
    ),
  );
  // Fresh games use a different axis before the entire deck is exhausted.
  await host.locator('[data-party="again"]').click();
  await m.waitForFunction(
    () =>
      window.testFrame?.public.phase === "clue" && !window.testFrame.finished,
  );
  assert.ok(
    !used.includes(
      await m.evaluate(() => window.testFrame.public.axis.join("|")),
    ),
  );
  await host.locator('[data-party="finish"]').click();
  await m.waitForFunction(
    () => window.testFrame?.finished && window.testFrame.public.cancelled,
  );
  assert.equal(
    await m.evaluate(() => window.testFrame.public.target),
    undefined,
  );
  assert.equal(await host.locator(".record-sheet").count(), 0);
  await host.locator(".close-sheet").click();
  await host.locator('.bottom-nav [data-action="profile"]').click();
  await host.locator('[data-action="game-records"]').click();
  assert.equal(await host.locator(".record-history-card").count(), 1);
  assert.ok(
    (await host.locator(".record-history-card").innerText()).includes(
      `${expectedScore} /100`,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    `PASS frequency ${count} players: private target, non-hub host, secret guesses, exact scores, rotating rounds, history and personal records`,
  );
  for (const x of contexts) await x.c.close();
}
try {
  if (process.env.FREQUENCY_TEN) await match(10);
  else {
    await match(2);
    await match(3);
  }
} finally {
  await browser.close();
}
