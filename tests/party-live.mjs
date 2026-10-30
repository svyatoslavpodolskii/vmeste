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
    await m.waitForFunction((id) => window.testFrame?.kind === id, id, {
      timeout: 15000,
    });
    await b.locator('[data-action="open-live-game"]').click();
  }
  await game("word");
  await a.locator("#party-answer-form textarea").fill("Первый тайный ответ");
  await a.locator("#party-answer-form button").click();
  await b.locator("#party-answer-form textarea").fill("Второй тайный ответ");
  await b.locator("#party-answer-form button").click();
  await m.waitForFunction(() => window.testFrame?.public?.ready?.length === 2);
  assert.ok(
    !(await m.locator("body").innerText()).includes("Первый тайный ответ"),
  );
  await a.locator('[data-party="reveal"]').click();
  await m.getByText("Первый тайный ответ", { exact: true }).waitFor();
  await m.getByText("Второй тайный ответ", { exact: true }).waitFor();
  console.log("PASS private answers reveal together");
  await close(a);
  await close(b);
  await nav(b, "games");
  await b.locator('[data-action="play"][data-id="poem"]').click();
  await m.waitForFunction(() => window.testFrame?.kind === "poem");
  await a.locator('[data-action="open-live-game"]').click();
  for (const [p, prefix] of [
    [a, "СловоА"],
    [b, "СловоБ"],
  ]) {
    const fields = p.locator("#party-answer-form input");
    for (let i = 0; i < (await fields.count()); i++)
      await fields.nth(i).fill(prefix + i);
    await p.locator("#party-answer-form button").click();
  }
  await m.waitForFunction(() => window.testFrame?.public?.ready === 4);
  assert.ok(!(await m.locator("body").innerText()).includes("СловоА"));
  await b.locator('[data-party="reveal"]').click();
  await m.waitForFunction(
    () =>
      window.testFrame?.public?.poem?.includes("СловоА") &&
      window.testFrame?.public?.poem?.includes("СловоБ"),
  );
  console.log(
    "PASS non-hub player hosts collaborative poetry and receives other controllers",
  );
  await game("draw");
  const secret = await a.locator(".private-instructions h3").innerText();
  assert.ok(!(await m.locator("body").innerText()).includes(secret));
  const canvas = await a.locator("#draw-pad").boundingBox();
  await a.mouse.move(canvas.x + 30, canvas.y + 30);
  await a.mouse.down();
  await a.mouse.move(canvas.x + 100, canvas.y + 100, { steps: 10 });
  await a.mouse.up();
  await m.waitForFunction(() => window.testFrame?.public?.lines?.length > 0);
  console.log("PASS live drawing with hidden prompt");
  await b.locator("#party-answer-form input").fill(secret);
  await b.locator("#party-answer-form button").click();
  await a.locator('[data-party="draw-next"]').waitFor();
  await a.locator('[data-party="draw-next"]').click();
  await b.waitForFunction(
    () =>
      document.querySelector(".private-instructions h3")?.textContent &&
      !document
        .querySelector(".private-instructions h3")
        ?.textContent.includes("Получаем"),
  );
  const secret2 = await b.locator(".private-instructions h3").innerText();
  await a.locator("#party-answer-form input").fill(secret2);
  await a.locator("#party-answer-form button").click();
  await a.locator(".record-sheet").waitFor();
  console.log("PASS drawing turns and personal records");
  await game("beacon");
  const guides = async (p) =>
    p.locator(".private-instructions p").allTextContents();
  const ga = await guides(a),
    gb = await guides(b);
  const runes = ["🌱", "🌊", "☀️", "⭐"];
  for (const [p, list] of [
    [b, ga],
    [a, gb],
  ])
    for (const line of list) {
      const index = Number(line.match(/Кольцо (\d+)/)?.[1]) - 1,
        target = runes.findIndex((r) => line.includes(r));
      for (let i = 0; i < target; i++)
        await p.locator(`[data-party="rotate"][data-index="${index}"]`).click();
    }
  await a.locator(".record-sheet").waitFor();
  await m.waitForFunction(() => window.testFrame?.finished);
  console.log("PASS cooperative beacon solved by shared instructions");
  await game("race");
  for (let step = 0; step < 30; step++) {
    await Promise.all([
      a.locator(`[data-party="step"][data-side="${step % 2}"]`).click(),
      b.locator(`[data-party="step"][data-side="${step % 2}"]`).click(),
    ]);
    await a.waitForTimeout(85);
  }
  await a.locator(".record-sheet").waitFor();
  await m.waitForFunction(() => window.testFrame?.finished);
  assert.ok(
    Object.values(await m.evaluate(() => window.testFrame.public.times)).every(
      (v) => v > 0,
    ),
  );
  console.log("PASS phone-controlled race and recorded finishing times");
  await game("soundgarden");
  await a.locator('[data-party="sound"]').click();
  await b.locator('[data-party="sound"]').click();
  assert.equal(await a.evaluate(() => window.testAudio[0].state), "running");
  assert.equal(await b.evaluate(() => window.testAudio[0].state), "running");
  assert.equal(await a.locator(".sound-pads button").count(), 8);
  assert.equal(await b.locator(".sound-pads button").count(), 8);
  const checksum = async (p) =>
    p.evaluate(() =>
      Array.from(
        window.testSources[0].buffer.getChannelData(0).slice(0, 200),
      ).reduce((a, n) => a + n, 0),
    );
  assert.notEqual(await checksum(a), await checksum(b));
  await a.locator('[data-party="layer"][data-index="6"]').click();
  await m.waitForFunction(() =>
    Object.values(window.testFrame?.public?.contributors || {}).some(
      (v) => v.layers[6] === 1,
    ),
  );
  console.log(
    "PASS eight ambient layers, different device audio, shared controls",
  );
  await game("meditation");
  assert.equal(await a.locator(".sound-pads").count(), 0);
  assert.equal(await a.locator("[data-sound-mood]").count(), 4);
  await a.locator('[data-sound-mood="0"]').fill("0.9");
  await m.waitForFunction(() =>
    Object.values(window.testFrame?.public?.contributors || {}).some(
      (v) => v.moods[0] === 0.9,
    ),
  );
  console.log("PASS meditation is separate from interactive music");
  await m.screenshot({ path: "test-results/v3-projector.png", fullPage: true });
  await a.screenshot({
    path: "test-results/v3-meditation.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  await m.reload();
  await m.locator(".projector").waitFor();
  console.log("PASS monitor role persists after reload");
  assert.deepEqual(errors, []);
  console.log("PASS all live party checks");
} finally {
  await browser.close();
}
