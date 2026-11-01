import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
      permissions: ["notifications"],
      viewport: { width: 390, height: 844 },
    }),
    p = await context.newPage();
  await p.goto("http://127.0.0.1:4173");
  const result = await p.evaluate(async () => {
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => "granted",
    });
    Notification.requestPermission = async () => "granted";
    const n = await import("./js/notifications.js");
    const calls = [];
    navigator.serviceWorker.getRegistration = async () => ({
      showNotification: async (title, options) =>
        calls.push({ title, options }),
    });
    const store = { roomId: "room-native-test", authViewer: false };
    const before = await n.notifyRoom(store, {
      key: "first",
      title: "Совпало",
      body: "Идея",
    });
    await n.enableNotifications();
    const shown = await n.notifyRoom(store, {
      key: "first",
      title: "Совпало",
      body: "Идея",
    });
    const duplicate = await n.notifyRoom(store, {
      key: "first",
      title: "Совпало",
      body: "Идея",
    });
    const invited = await n.notifyRoom(store, {
      key: "invite:round-one",
      title: "Вас зовут играть",
      body: "Маяк",
      tab: "games",
    });
    n.disableNotifications();
    const disabled = await n.notifyRoom(store, {
      key: "next",
      title: "Совпало",
      body: "Идея",
    });
    return { before, shown, duplicate, invited, disabled, calls };
  });
  assert.equal(result.before, false);
  assert.equal(result.shown, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.invited, true);
  assert.equal(result.disabled, false);
  assert.equal(result.calls.length, 2);
  assert.ok(result.calls[0].options.data.url.endsWith("#matches"));
  assert.ok(result.calls[1].options.data.url.endsWith("#games"));
  await p.reload();
  const persisted = await p.evaluate(async () => {
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => "granted",
    });
    Notification.requestPermission = async () => "granted";
    const n = await import("./js/notifications.js");
    await n.enableNotifications();
    navigator.serviceWorker.getRegistration = async () => ({
      showNotification: async () => {
        throw Error("duplicate");
      },
    });
    return n.notifyRoom(
      { roomId: "room-native-test" },
      { key: "first", title: "Совпало", body: "Идея" },
    );
  });
  assert.equal(persisted, false);
  await p.getByLabel("Как вас зовут?").fill("Проверка уведомлений");
  await p.locator("#onboard-form button").click();
  await p.locator("#profile-form").waitFor();
  await p.locator('[data-action="settings"]').click();
  await p.locator('[data-action="notifications"]').click();
  await p.locator('[data-action="notifications-off"]').click();
  await p.locator('[data-action="notifications-on"]').waitFor();
  await p.locator('[data-action="notifications-on"]').click();
  await p.locator('[data-action="notifications-off"]').waitFor();
  console.log(
    "PASS native notifications opt in, correct room/tab, matches and invitations, deduplication across reload and explicit disable",
  );
} finally {
  await browser.close();
}
