import { btn, icon } from "./ui.js";
const preferenceKey = () =>
  "vmeste:notifications:" + new URL("./", location.href).pathname;
const delivered = new Set();
let loaded = false;
function loadDelivered() {
  if (loaded) return;
  loaded = true;
  try {
    const saved = JSON.parse(
      localStorage.getItem(preferenceKey() + ":delivered"),
    );
    if (Array.isArray(saved))
      for (const key of saved.slice(-2000))
        if (typeof key === "string" && key.length <= 400) delivered.add(key);
  } catch {}
}
export function notificationsEnabled() {
  try {
    return localStorage.getItem(preferenceKey()) === "on";
  } catch {
    return false;
  }
}
export function disableNotifications() {
  localStorage.setItem(preferenceKey(), "off");
}
export async function enableNotifications() {
  if (!("Notification" in window))
    throw Error(
      "Этот браузер не поддерживает уведомления устройства. История под колокольчиком продолжит работать.",
    );
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw Error(
      "Уведомления не разрешены. Разрешение можно изменить в настройках сайта в браузере.",
    );
  localStorage.setItem(preferenceKey(), "on");
}
export function notificationSettings() {
  const supported = "Notification" in window;
  const enabled =
    supported &&
    Notification.permission === "granted" &&
    notificationsEnabled();
  return `<span class="eyebrow">ВАЖНОЕ НЕ ПОТЕРЯЕТСЯ</span><h2>Уведомления</h2><p>${enabled ? "Совпадения и приглашения будут появляться в уведомлениях устройства." : "Можно получать уведомления устройства, когда появилась новая общая идея или вас позвали играть."}</p><p class="fine">Они работают, пока приложение открыто или свернуто и устройства на связи. После полного закрытия новые события станут известны при следующем подключении. Совпадения остаются под колокольчиком до прочтения.</p>${supported ? btn(enabled ? "Выключить уведомления" : "Включить уведомления", enabled ? "notifications-off" : "notifications-on", "primary wide") : "<p>Этот браузер не поддерживает уведомления устройства. События доступны в приложении под колокольчиком.</p>"}${btn(icon("back") + " Настройки", "settings", "text wide")}`;
}
export async function notifyRoom(store, { key, title, body, tab = "matches" }) {
  if (
    !store ||
    store.authViewer ||
    !notificationsEnabled() ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  )
    return false;
  const identity = store.roomId + ":" + key;
  loadDelivered();
  if (delivered.has(identity)) return false;
  delivered.add(identity);
  const url = new URL("./", location.href);
  url.searchParams.set("room", store.roomId);
  url.hash = tab;
  const options = {
    body,
    tag: identity,
    icon: new URL("./assets/icon-192.png", url).href,
    data: { room: store.roomId, tab, url: url.href },
  };
  try {
    const registration = await navigator.serviceWorker?.getRegistration(
      new URL("./", location.href),
    );
    if (registration) await registration.showNotification(title, options);
    else {
      const notification = new Notification(title, options);
      notification.onclick = () => {
        window.focus();
        notification.close();
        window.dispatchEvent(
          new CustomEvent("vmeste-notification-open", { detail: options.data }),
        );
      };
    }
    try {
      localStorage.setItem(
        preferenceKey() + ":delivered",
        JSON.stringify([...delivered].slice(-2000)),
      );
    } catch {}
    return true;
  } catch {
    delivered.delete(identity);
    return false;
  }
}
