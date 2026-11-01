import { esc, icon, sheet } from "./ui.js";
export function activityEvents(store) {
  return store.data.plans
    .filter(
      (p) =>
        !p.deletedAt &&
        p.worldEvent &&
        !["water", "explore", "request", "pack", "turn-answer"].includes(
          p.worldEvent.type,
        ),
    )
    .map((p) => ({ ...p.worldEvent, id: p.id, author: p.authorId }))
    .concat(
      (store.matches || []).map((idea) => {
        const at = Math.max(
          ...store.data.reactions
            .filter(
              (r) =>
                r.ideaId === idea.id &&
                !r.deletedAt &&
                ["like", "favorite"].includes(r.reaction),
            )
            .map((r) => r.updatedAt),
          0,
        );
        return {
          world: "matches",
          type: "match",
          text: idea.title,
          idea: idea.id,
          at,
          id: `match:${idea.id}:${at}`,
        };
      }),
    )
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
  if (event.world === "wordworld") return event.type === "reveal";
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
  if (e.world === "matches") return "Совпало! Идея понравилась вам обоим";
  if (e.world === "wordworld") return "Созвучия: общие ответы открыты";
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
export function activitySheet(store, world = "") {
  const all = activityEvents(store).filter(
      (e) =>
        (!world || e.world === world) &&
        (e.world !== "wordworld" || e.type === "reveal"),
    ),
    read = readIds(store);
  return `<div class="activity-head"><span class="eyebrow">ВАШЕ ОБЩЕЕ ВРЕМЯ</span><h2>${world === "lettersworld" ? "История писем" : world === "wordworld" ? "История созвучий" : "Что нового"}</h2><p>Сначала последние события. Читайте, когда удобно.</p></div>${world === "lettersworld" ? `<button class="btn text" data-world="letters-inbox">${icon("back")} К письмам</button>` : world === "wordworld" ? `<button class="btn text" data-turn="back">${icon("back")} К вопросам</button>` : ""}<div class="activity-toolbar"><button class="btn text" data-action="activity-read-all" data-world-filter="${esc(world)}">Прочитать всё</button></div><div class="activity-list">${all.map((e) => `<button class="activity-item ${!read.has(e.id) && relevant(store, e) ? "unread" : ""}" data-action="activity-open" data-id="${esc(e.world)}" data-event="${esc(e.id)}"><span class="activity-symbol">${icon(e.world === "matches" ? "heart" : e.world === "lettersworld" ? "letter" : e.world === "gardenworld" ? "plant" : "map")}</span><span><strong>${e.author === store.userId ? (e.type === "question" ? "Вы оставили вопрос" : e.type === "answer" ? "Вы ответили" : activityLabel(e)) : activityLabel(e)}</strong><p>${esc((e.text || "").slice(0, 100) || store.users.find((u) => u.localUserId === e.author)?.displayName || "Ваш человек")}</p><small>${new Date(e.at).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small></span><i></i></button>`).join("") || '<div class="empty"><h3>Пока здесь тихо</h3><p>Вопросы, ответы и маленькие открытия будут собираться здесь.</p></div>'}</div>`;
}
