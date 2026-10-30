import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import assert from "node:assert/strict";
await mkdir("test-results", { recursive: true });
let latest = false,
  pendingV2 = false;
const server = http.createServer(async (req, res) => {
  try {
    let file =
      decodeURIComponent(new URL(req.url, "http://localhost").pathname).slice(
        1,
      ) || "index.html";
    if (file.includes("..")) throw Error();
    const body = latest
      ? await readFile(file)
      : execFileSync(
          "git",
          ["show", `${pendingV2 ? "1e0d8b5" : "7b648a2"}:${file}`],
          {
            maxBuffer: 4_000_000,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
    const type = file.endsWith(".js")
      ? "text/javascript"
      : file.endsWith(".html")
        ? "text/html"
        : file.endsWith(".css")
          ? "text/css"
          : file.endsWith(".json")
            ? "application/json"
            : file.endsWith(".svg")
              ? "image/svg+xml"
              : "application/octet-stream";
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await ctx.newPage();
  await page.goto(base);
  await page.getByLabel("Как вас зовут?").fill("Обновление без потерь");
  await page.locator("#onboard-form button").click();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.locator('[data-action="ideas"]').last().click();
  await page.locator('[data-action="new-idea"]').first().click();
  await page
    .locator('#idea-form input[name="title"]')
    .fill("Моя идея до обновления");
  await page.locator('#idea-form button[type="submit"]').click();
  await page
    .getByRole("heading", { name: "Моя идея до обновления", exact: true })
    .waitFor();
  const idea = await page
    .locator(".idea-card")
    .first()
    .getAttribute("data-idea");
  await page
    .locator(`.idea-card[data-idea="${idea}"] [data-action="like"]`)
    .click();
  await page
    .locator(
      `.idea-card[data-idea="${idea}"] [data-action="like"][aria-pressed="true"]`,
    )
    .waitFor();
  await page
    .locator(`.idea-card[data-idea="${idea}"] [data-action="add-plan"]`)
    .click();
  await page.locator('[data-action="build"]').click();
  await page.locator(".plan-item").waitFor();
  await page.evaluate(async () => {
    const { Database } = await import("./js/db.js"),
      { Store } = await import("./js/store.js");
    const id = localStorage.getItem("vmeste-user"),
      room = new URL(location).searchParams.get("room");
    const db = await new Database("vmeste-" + id).open(),
      store = await new Store(db, room, id).load();
    await store.save("plans", {
      title: "Сохранённый вечер",
      items: ["builtin-movie-1"],
    });
    await store.save("customTasks", {
      title: "Старая карточка",
      description: "",
    });
    db.close();
  });
  const snapshot = () =>
    page.evaluate(async () => {
      const id = localStorage.getItem("vmeste-user");
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open("vmeste-" + id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = reject;
      });
      const result = {};
      for (const name of db.objectStoreNames) {
        result[name] = await new Promise((resolve, reject) => {
          const req = db.transaction(name).objectStore(name).getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = reject;
        });
      }
      db.close();
      return {
        data: result,
        identity: id,
        room: localStorage.getItem("vmeste-user-room"),
      };
    });
  function preserved(after, before) {
    assert.equal(after.identity, before.identity);
    assert.equal(after.room, before.room);
    for (const [table, records] of Object.entries(before.data))
      for (const record of records)
        assert.deepEqual(
          after.data[table].find((r) => r.id === record.id),
          record,
          `preserved ${table}:${record.id}`,
        );
  }
  const before = await snapshot();
  const other = await ctx.newPage();
  await other.goto(page.url());
  if (process.env.PWA_WAITING_2) {
    pendingV2 = true;
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg.update();
    });
    await page.waitForFunction(
      async () => !!(await navigator.serviceWorker.getRegistration()).waiting,
    );
  }
  latest = true;
  await page.reload();
  // The old controller still serves app 1.0; the new independent updater must be reachable.
  await page.waitForFunction(() => !!window.vmesteUpdates);
  await page
    .locator("#app-update button")
    .filter({ hasText: "Обновить приложение" })
    .waitFor({ timeout: 30000 });
  await page.screenshot({ path: "test-results/pwa-update.png" });
  await page
    .locator("#app-update button")
    .filter({ hasText: "Обновить приложение" })
    .click();
  await page.locator('[data-action="games"]').waitFor({ timeout: 30000 });
  await page.locator('[data-action="profile"]').last().click();
  await page.waitForFunction(
    () => document.body.textContent.includes("версия 3.1.0"),
    {},
    { timeout: 30000 },
  );
  preserved(await snapshot(), before);
  assert.ok(!other.isClosed(), "old tab need not be closed");
  await page.locator('[data-action="update-app"]').click();
  await page
    .getByText("У вас актуальная версия приложения. Все данные на месте.")
    .waitFor();
  await page
    .locator("#app-update button")
    .filter({ hasText: "Закрыть" })
    .click();
  await ctx.setOffline(true);
  await page.locator('[data-action="update-app"]').click();
  await page.getByText(/Для загрузки обновления нужен интернет/).waitFor();
  preserved(await snapshot(), before);
  await page.reload();
  await page.waitForFunction(() =>
    document.body.textContent.includes("версия 3.1.0"),
  );
  preserved(await snapshot(), before);
  console.log(
    "PASS PWA 1.0 → 3.1.0 with old tab open: identity, room, ideas, likes, saved plans, tasks and draft unchanged; manual/offline checks and offline restart",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
