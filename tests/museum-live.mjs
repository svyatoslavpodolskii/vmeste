import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
const errors = [];
async function fresh(w = 390) {
  const c = await browser.newContext({ viewport: { width: w, height: 844 } });
  await c.addInitScript(() => {
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
  const url = a.url(),
    contexts = [root],
    pages = [a];
  for (let i = 1; i < count; i++) {
    const x = await join(a, url, ["", "Борис", "Вика", "Глеб"][i]);
    contexts.push(x);
    pages.push(x.p);
  }
  const screen = await join(a, url, "Общий музей", "display"),
    m = screen.p;
  contexts.push(screen);
  await a.locator('.bottom-nav [data-action="games"]').click();
  await a.locator('[data-action="play"][data-id="museum"]').click();
  await m.waitForFunction(() => window.testFrame?.kind === "museum");
  for (const p of pages.slice(1))
    if (await p.locator('[data-party="join"]').count())
      await p.locator('[data-party="join"]').click();
    else await p.locator('[data-action="open-live-game"]').click();
  for (const p of pages) {
    if (await p.locator('[data-party="join"]').count())
      await p.locator('[data-party="join"]').click();
    await p.locator('[data-party="ready"]').waitFor();
  }
  for (const p of pages) await p.locator('[data-party="ready"]').click();
  const rounds = Math.max(4, count);
  for (let turn = 0; turn < rounds; turn++) {
    await m.waitForFunction(
      (t) =>
        window.testFrame?.public?.turn === t &&
        window.testFrame.public.phase === "draw",
      turn,
    );
    const artist = pages[turn % count];
    await artist.waitForFunction(
      () =>
        document.querySelector(".private-instructions h3")?.textContent &&
        !document
          .querySelector(".private-instructions h3")
          .textContent.includes("Получаем"),
    );
    const secret = await artist.locator(".private-instructions h3").innerText();
    assert.ok(
      !(await m.evaluate(
        (s) => JSON.stringify(window.testFrame).includes(s),
        secret,
      )),
      "secret stays off screen during drawing",
    );
    await artist.locator("#draw-pad").scrollIntoViewIfNeeded();
    const canvas = await artist.locator("#draw-pad").boundingBox();
    await artist.mouse.move(canvas.x + 15, canvas.y + 15);
    await artist.mouse.down();
    await artist.mouse.move(canvas.x + 80, canvas.y + 70, { steps: 8 });
    await artist.mouse.up();
    await m.waitForFunction(() => window.testFrame?.public?.lines?.length > 0);
    await artist.locator('[data-party="museum-caption"]').click();
    const voters = pages.filter((p) => p !== artist);
    for (let i = 0; i < voters.length; i++) {
      await voters[i]
        .locator("#party-answer-form input")
        .fill(`Убедительная выдумка ${turn}-${i}`);
      await voters[i].locator("#party-answer-form button").click();
    }
    await m.waitForFunction(() => window.testFrame?.public.phase === "vote");
    assert.equal(
      await m.evaluate(() => window.testFrame.public.correct),
      undefined,
    );
    const correct = await m.evaluate(
      (s) => window.testFrame.public.choices.find((c) => c.text === s).id,
      secret,
    );
    for (const p of voters) {
      await p
        .locator(`.museum-ballot button[data-choice="${correct}"]`)
        .waitFor();
      assert.ok(await p.locator(".museum-ballot button:disabled").count());
      await p
        .locator(`.museum-ballot button[data-choice="${correct}"]`)
        .click();
    }
    await m.waitForFunction(() => window.testFrame?.public.phase === "reveal");
    assert.equal(
      await m.evaluate(() => window.testFrame.public.secret),
      secret,
    );
    assert.ok(await m.locator(".museum-correct").count());
    if (turn === 0) {
      await m.waitForTimeout(500);
      await m.evaluate(() =>
        document.querySelector("#toast").classList.remove("visible"),
      );
    }
    if (turn === 0)
      await m.screenshot({
        path: `test-results/museum-${count}-reveal.png`,
        fullPage: true,
      });
    await a.locator('[data-party="museum-next"]').click();
  }
  await m.waitForFunction(() => window.testFrame?.finished);
  assert.equal(await m.locator(".museum-gallery article").count(), rounds);
  await a.locator(".record-sheet").waitFor();
  const scores = await m.evaluate(() => window.testFrame.public.scores);
  assert.ok(Object.values(scores).every((s) => s > 0));
  await m.screenshot({
    path: `test-results/museum-${count}-final.png`,
    fullPage: true,
  });
  await a.locator(".close-sheet").click();
  await a.locator('.bottom-nav [data-action="profile"]').click();
  await a.locator('[data-action="game-records"]').click();
  await a.locator('[data-party="view-record"]').click();
  assert.equal(await a.locator(".museum-gallery article").count(), rounds);
  console.log(
    `PASS museum ${count} players: ${rounds} rounds, private prompts, live art, anonymous titles, blocked self-vote, scoring, rotating artists, gallery and record`,
  );
  await Promise.all(contexts.map((x) => x.c.close()));
}
try {
  await match(3);
  await match(4);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
