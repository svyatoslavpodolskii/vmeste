import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ serviceWorkers: "block" });
  let fail = true;
  await context.route("**/js/app.js", (route) => {
    if (fail) {
      fail = false;
      route.abort();
    } else route.continue();
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173");
  await page.locator("#boot-refresh").waitFor({ timeout: 20000 });
  await page.evaluate(async () => {
    localStorage.setItem("preservation-marker", "keep-me");
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open("preservation-test", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("notes");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("notes", "readwrite");
      tx.objectStore("notes").put({ text: "Не терять" }, "wish");
      tx.oncomplete = resolve;
      tx.onerror = reject;
    });
    db.close();
  });
  await page.locator("#boot-refresh").click();
  await page.locator("#onboard-form").waitFor();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("preservation-marker")),
    "keep-me",
  );
  const text = await page.evaluate(async () => {
    const db = await new Promise((resolve) => {
      const r = indexedDB.open("preservation-test");
      r.onsuccess = () => resolve(r.result);
    });
    const result = await new Promise((resolve) => {
      const r = db.transaction("notes").objectStore("notes").get("wish");
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    return result.text;
  });
  assert.equal(text, "Не терять");
  console.log(
    "PASS broken module recovers to usable app, preserving localStorage and IndexedDB",
  );
} finally {
  await browser.close();
}
