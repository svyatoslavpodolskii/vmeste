import { esc, icon, sheet } from "./ui.js";
export function activityEvents(store) {
  return store.data.plans
    .filter((p) => !p.deletedAt && p.worldEvent)
    .map((p) => ({ ...p.worldEvent, id: p.id, author: p.authorId }))
    .sort((a, b) => b.at - a.at || b.id.localeCompare(a.id));
}
export function readIds(store) {
  try {
    return new Set(
      JSON.parse(
        localStorage.getItem(`vmeste:read:${store.roomId}:${store.userId}`),
      ) || [],
    );
  } catch {
    return new Set();
  }
}
export function relevant(store, event) {
  if (event.author === store.userId) return false;
  if (event.world === "lettersworld")
    return !event.target || event.target === store.userId;
  return true;
}
export function unreadEvents(store) {
  const read = readIds(store);
  return activityEvents(store).filter(
    (e) => relevant(store, e) && !read.has(e.id),
  );
}
export function markRead(store, ids) {
  const read = readIds(store);
  const before = read.size;
  for (const id of ids) read.add(id);
  if (read.size === before) return;
  localStorage.setItem(
    `vmeste:read:${store.roomId}:${store.userId}`,
    JSON.stringify([...read]),
  );
  globalThis.window?.dispatchEvent(new CustomEvent("vmeste-unread"));
}
export function activityLabel(e) {
  return e.type === "question"
    ? "Новый вопрос"
    : e.type === "answer"
      ? "Ответ на ваш вопрос"
      : e.type === "plant"
        ? "В саду новый росток"
        : e.type === "water"
          ? "В саду прошёл дождь"
          : e.type === "explore"
            ? "Открыта новая тропа"
            : e.type === "build"
              ? "В атласе появился маяк"
              : "Продолжение вашей истории";
}
export function activitySheet(store) {
  const all = activityEvents(store),
    read = readIds(store);
  return `<div class="activity-head"><span class="eyebrow">ВАШЕ ОБЩЕЕ ВРЕМЯ</span><h2>Что нового</h2><p>Все события в одном месте. Читайте, когда удобно.</p></div><div class="activity-toolbar"><button class="btn text" data-action="activity-read-all">Прочитать всё</button></div><div class="activity-list">${all.map((e) => `<button class="activity-item ${!read.has(e.id) && relevant(store, e) ? "unread" : ""}" data-action="activity-open" data-id="${esc(e.world)}" data-event="${esc(e.id)}"><span class="activity-symbol">${icon(e.world === "lettersworld" ? "letter" : e.world === "gardenworld" ? "plant" : "map")}</span><span><strong>${activityLabel(e)}</strong><p>${esc((e.text || "").slice(0, 100) || store.users.find((u) => u.localUserId === e.author)?.displayName || "Ваш человек")}</p><small>${new Date(e.at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></span><i></i></button>`).join("") || '<div class="empty"><h3>Пока здесь тихо</h3><p>Вопросы, ответы и маленькие открытия будут собираться здесь.</p></div>'}</div>`;
}
