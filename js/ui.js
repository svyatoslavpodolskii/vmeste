import { illustrations, avatars } from "../data/presentation.js";
export const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  games: "M6 8h12l4 11-4 2-4-5h-4l-4 5-4-2L6 8ZM6 12h4m-2-2v4m8-2h.1m2 2h.1",
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  idea: "M9 18h6m-5 3h4M8 14c-5-4-2-12 4-12s9 8 4 12l-1 2H9l-1-2Z",
  plan: "M14 3H5v18h10M8 7h6M8 11h5m5 3v8m-4-4h8M17 3l3 3v5",
  match: "M12 20C-4 10 4-2 12 6c8-8 16 4 0 14Zm0-14c-4 4-4 8 0 14",
  user: "M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  home: "m3 10 9-8 9 8M5 9v12h14V9m-10 12v-7h6v7",
  bookmark: "M6 3h12v18l-6-4-6 4V3Z",
  clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  filter: "M4 7h16M4 17h16M8 4v6m8 4v6",
  check: "m5 12 4 4L19 6",
  shuffle: "m3 4 18 16m-5 0h5v-5M3 20 21 4m-5 0h5v5",
  skip: "m5 5 10 7-10 7V5Zm14 0v14",
  copy: "M8 8h12v13H8V8ZM16 8V3H3v13h5",
  down: "m6 9 6 6 6-6",
  up: "m6 15 6-6 6 6",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  search: "m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
};
export const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.heart}"/></svg>`;
export const btn = (text, action, cls = "soft", extra = "") =>
  `<button class="btn ${cls}" data-action="${action}" ${extra}>${text}</button>`;
export function art(idea, cls = "") {
  const allowed = illustrations.map(([name]) => name);
  const file = String(idea.image || "").match(
    /^\.\/assets\/([a-z]+)\.svg$/,
  )?.[1];
  if (
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(
      idea.image || "",
    )
  )
    return `<img class="art user-art ${cls}" src="${esc(idea.image)}" alt="" loading="lazy">`;
  return file && allowed.includes(file)
    ? `<img class="art ${cls}" src="./assets/${file}.svg" alt="" loading="lazy">`
    : `<div class="art emoji-art ${cls}" aria-hidden="true">${esc(idea.icon || "✦")}</div>`;
}
export const duration = (m) =>
  m >= 60
    ? `${Math.floor(m / 60)} ч${m % 60 ? " " + (m % 60) + " мин" : ""}`
    : `${m} мин`;
export function toast(message) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("visible"), 3200);
}
let returnFocus;
export function sheet(html) {
  const d = document.querySelector("#sheet");
  if (!d.open) returnFocus = document.activeElement;
  document.querySelector("#sheet-content").innerHTML =
    `<div class="sheet-handle"></div><button class="icon-btn close-sheet" data-action="close" aria-label="Закрыть">${icon("close")}</button>${html}`;
  if (!d.open) d.showModal();
  d.scrollTop = 0;
  document.body.classList.add("modal-open");
}
export function closeSheet() {
  document.querySelector("#sheet").close();
  document.body.classList.remove("modal-open");
  returnFocus?.focus?.();
}
export function card(idea, store, { match = false } = {}) {
  const reaction = store.reaction(idea.id),
    liked = ["like", "favorite"].includes(reaction);
  const bond = affinity(store, idea);
  return `<article class="idea-card bond-${bond.level}" data-idea="${esc(idea.id)}"><button class="art-button" data-action="detail" data-id="${esc(idea.id)}" aria-label="Открыть: ${esc(idea.title)}">${art(idea)}</button><div class="card-info"><button class="title-button" data-action="detail" data-id="${esc(idea.id)}"><h3>${esc(idea.title)}</h3></button><p>${esc(idea.description)}</p><div class="tags"><span>${icon("clock")}${duration(idea.duration || 30)}</span><span>${icon("home")}${esc(idea.location || "Дома")}</span><span class="mood">${esc(idea.mood || "Уютно")}</span></div>${match ? `<div class="match-label">${bond.html}${store.authCapacity>2?"Нравится нескольким участникам":"Понравилось вам обоим"}</div>` : ""}<div class="card-actions">${btn(icon("bookmark") + " В план", "add-plan", "soft", `data-id="${esc(idea.id)}"`)}</div></div><button class="icon-btn like ${liked ? "liked" : ""}" data-action="like" data-id="${esc(idea.id)}" aria-label="${liked ? "Убрать симпатию" : "Нравится"}: ${esc(idea.title)}" title="Нажмите — лайк; удерживайте — суперлайк" aria-pressed="${liked}">${reaction === "favorite" ? `<span class="super-heart">${icon("heart")}<small>✦</small></span>` : icon("heart")}</button></article>`;
}
export function empty(title, text, action = "ideas", label = "Найти идею") {
  return `<div class="empty"><span class="empty-icon">♡</span><h3>${title}</h3><p>${text}</p>${btn(label, action, "lavender")}</div>`;
}

export function affinity(store, idea) {
  const ids =
    store.authRoster?.map((r) => r.id) || store.users.map((u) => u.localUserId);
  const reactions = store.data.reactions.filter(
    (r) =>
      r.ideaId === idea.id &&
      !r.deletedAt &&
      ["like", "favorite"].includes(r.reaction) &&
      (!ids.length || ids.includes(r.userId)),
  );
  const unique = [...new Map(reactions.map((r) => [r.userId, r])).values()];
  const both = unique.length >= 2,
    fire = unique.filter((r) => r.reaction === "favorite").length>=2;
  const anySuper = unique.some((r) => r.reaction === "favorite");
  const level = fire
    ? "fire"
    : both
      ? "mutual"
      : anySuper
        ? "super"
        : unique.length
          ? "liked"
          : "";
  const label = fire
    ? "Оба поставили суперлайк"
    : both
      ? "Нравится вам обоим"
      : anySuper
        ? "Суперлайк одного из вас"
        : unique.length
          ? "Нравится одному из вас"
          : "";
  return {
    level,
    label,
    html: level
      ? `<span class="affinity affinity-${level}" title="${label}" aria-label="${label}">${icon("heart")}${fire ? '<span class="heart-spark">✦</span>' : anySuper && !both ? '<span class="heart-star">✦</span>' : ""}</span>`
      : "",
  };
}

export function avatarPicker(current = "🌷") {
  const list = [...new Set([current, ...avatars])];
  return `<fieldset class="avatar-picker"><legend>Ваш значок</legend><details><summary><span class="avatar-preview">${esc(current)}</span> Выбрать персонажа или символ</summary><div class="emoji-gallery">${list.map((a) => `<label title="${esc(a)}"><input type="radio" name="avatar" value="${esc(a)}" ${current === a ? "checked" : ""}><span>${a}</span></label>`).join("")}</div></details></fieldset>`;
}
export function visualPicker(idea = {}) {
  const image = idea.image || "./assets/magic.svg",
    isImage = !!idea.image;
  return `<fieldset class="visual-picker"><legend>Оформление идеи</legend><div class="visual-modes"><label><input type="radio" name="visualMode" value="illustration" ${isImage ? "checked" : ""}><span>🖼️ Иллюстрация</span></label><label><input type="radio" name="visualMode" value="emoji" ${!isImage ? "checked" : ""}><span>✨ Эмодзи</span></label></div><div class="illustration-gallery">${illustrations.map(([name, label]) => `<label title="${label}"><input type="radio" name="artwork" value="./assets/${name}.svg" ${image === `./assets/${name}.svg` ? "checked" : ""}><img src="./assets/${name}.svg" alt="${label}"><span>${label}</span></label>`).join("")}${image.startsWith("data:") ? `<label><input type="radio" name="artwork" value="${esc(image)}" checked><img src="${esc(image)}" alt="Прежнее изображение"><span>Прежнее</span></label>` : ""}</div><div class="emoji-gallery idea-emojis">${[...new Set([idea.icon || "✨", ...avatars])].map((e) => `<label title="${esc(e)}"><input type="radio" name="icon" value="${esc(e)}" ${e === (idea.icon || "✨") ? "checked" : ""}><span>${e}</span></label>`).join("")}</div></fieldset>`;
}
export function suggestion(idea, store) {
  const bond = affinity(store, idea);
  return `<article class="suggestion bond-${bond.level}" data-suggestion="${esc(idea.id)}">${art(idea)}<button class="title-button" data-action="detail" data-id="${esc(idea.id)}">${esc(idea.title)}</button>${bond.html}${btn(icon("plus"), "add-plan", "soft", `data-id="${esc(idea.id)}" aria-label="Добавить: ${esc(idea.title)}"`)}</article>`;
}
