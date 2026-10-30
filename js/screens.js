import { momentIdeas, dailyOrder } from "./moments.js";
import { gameBoxes } from "../data/presentation.js";
import { recommendations, preference } from "./plans.js";
import {
  esc,
  icon,
  btn,
  card,
  empty,
  art,
  duration,
  affinity,
  suggestion,
  avatarPicker,
} from "./ui.js";
import { categories } from "../data/ideas.js";
export function onboarding(room) {
  return `<main class="onboarding"><div class="eyebrow">ВАШЕ МАЛЕНЬКОЕ МЕСТО</div><h1 class="brand">Вместе<span>♥</span></h1><p class="intro">Идеи, игры и маленькие<br>приключения для своих</p><img class="welcome-art" src="./assets/together.svg" alt="Сердечко и звезда уютно сидят рядом"><h2>${room ? "Вас уже ждут ♡" : "Обычный день.<br>Особенный — вместе."}</h2><p class="muted">${room ? "Осталось только познакомиться." : "Готовьте, играйте, мечтайте.<br>Сохраните то, что хочется сделать вместе."}</p><form id="onboard-form"><label for="display-name">Как вас зовут?</label><input id="display-name" name="name" placeholder="Ваше имя" autocomplete="given-name" maxlength="60" required>${room ? '<label>Режим входа<select name="entryMode"><option value="player">Игрок · вход или восстановление</option><option value="mirror">Ещё одно моё устройство</option><option value="display">Общий экран · монитор</option></select></label>' : '<label>Комната<select name="capacity"><option value="2">Для двоих</option><option value="10">Для компании · до 10 участников</option></select></label>'}<button class="btn primary wide" type="submit">${room ? "Войти в нашу комнату" : icon("plus") + " Создать нашу комнату"}</button></form>${room ? "" : btn("У меня уже есть ссылка", "join", "text wide")}<p class="fine">Без регистрации. Ваши идеи — на ваших устройствах.</p></main>`;
}
export function header(s) {
  const titles = {
    ideas: "Вместе",
    build: "Собрать вечер",
    games: "Игры",
    matches: s.store.authCapacity > 2 ? "Общие интересы" : "Матчи",
    profile: "Наша комната",
  };
  return `<header class="app-header"><div class="topline"><span class="eyebrow">${s.store.authCapacity>2?"ХОРОШЕЕ ВРЕМЯ СО СВОИМИ":"МАЛЕНЬКИЕ РАДОСТИ ДЛЯ ДВОИХ"}</span><button class="room-pill" data-action="profile" aria-label="Открыть комнату" title="Визуальный код комнаты">${icon("home")} ${esc(s.roomLabel)} ${icon("arrow")}</button></div><div class="heading-row"><h1 class="brand ${s.tab !== "ideas" ? "small-brand" : ""}">${titles[s.tab]}<span>♥</span></h1><div class="avatars" aria-label="Участники">${s.store.users
    .slice(0, 10)
    .map(
      (u, i) =>
        `<span class="avatar avatar-${i}" title="${esc(u.displayName)}">${esc(u.avatar || u.displayName.slice(0, 1))}</span>`,
    )
    .join(
      "",
    )}${s.store.users.length < 2 ? '<span class="avatar waiting">♡</span>' : ""}</div></div><p class="subtitle">${{ ideas: "Идеи, игры и маленькие приключения", build: "Что-то простое, уютное и ваше", games: "Колоды для двоих · ваши вопросы и задания", matches: "То, что понравилось вам обоим", profile: "Место, куда хочется возвращаться" }[s.tab]}</p><button class="sync-status" data-action="connection"><span class="status-dot"></span><span id="connection-status">${esc(s.status)}</span></button></header>`;
}
export function navigation(tab, count, capacity = 2) {
  return `<nav class="bottom-nav" aria-label="Основная навигация">${[
    ["ideas", "idea", "Идеи"],
    ["build", "plan", "Собрать"],
    ["matches", "match", capacity > 2 ? "Общие" : "Матчи"],
    ["games", "games", "Игры"],
    ["profile", "user", "Профиль"],
  ]
    .map(
      ([id, ic, label]) =>
        `<button data-action="${id}" class="nav-item ${tab === id ? "active" : ""}" ${tab === id ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}${id === "matches" && count ? ` <b>${count}</b>` : ""}</span></button>`,
    )
    .join("")}</nav>`;
}
export function filtered(s) {
  return dailyOrder(s.store.ideas).filter((i) => {
    const c = s.category;
    if (
      c !== "Всё" &&
      c !== "Сюрприз" &&
      !(c === "Бесплатно"
        ? i.cost === 0
        : c === "Быстро"
          ? i.duration <= 20
          : [i.category, i.location, i.mood].includes(c))
    )
      return false;
    if (s.mood && i.mood !== s.mood) return false;
    if (s.maxDuration && i.duration > s.maxDuration) return false;
    if (
      s.onlyFavorites &&
      !["like", "favorite"].includes(s.store.reaction(i.id))
    )
      return false;
    return `${i.title} ${i.description}`
      .toLowerCase()
      .includes(s.search.toLowerCase());
  });
}
export function ideasScreen(s) {
  const list = filtered(s),
    gaming = ["Игры", "Задания", "Разговоры"].includes(s.category);
  const moment = momentIdeas(s.store);
  const day =
    s.store.ideas[Math.floor(Date.now() / 86400000) % s.store.ideas.length];
  return `<section class="hero"><div class="hero-copy"><div class="eyebrow">${gaming ? "НЕМНОГО МАГИИ В ОБЫЧНОМ" : "ПУСТЬ СЕГОДНЯ БУДЕТ ХОРОШО"}</div><h2>${gaming ? "Игры и задания" : "Сегодняшний вайб"}<span class="spark">✧</span></h2><p>${gaming ? "Смеяться, удивляться<br>и узнавать друг друга." : "Больше тепла, близости<br>и маленьких радостей."}</p>${btn(icon("plus") + " Предложить идею", "new-idea", "primary")}</div><img src="./assets/together.svg" alt="" class="hero-art"></section><button class="daily" data-action="detail" data-id="${esc(day.id)}"><span>✦ Идея дня</span><strong>${esc(day.title)}</strong>${icon("arrow")}</button><section class="moment-section moment-${moment.season}"><div class="moment-heading"><span>${moment.symbol}</span><div><span class="eyebrow">${moment.daypart}</span><h2>${moment.title}</h2></div></div><p>${moment.description}</p><div class="moment-carousel">${moment.list.map((i) => `<article class="moment-card bond-${affinity(s.store, i).level}"><button class="art-button" data-action="detail" data-id="${esc(i.id)}">${art(i)}</button><strong class="moment-title">${esc(i.title)}</strong><div class="row">${affinity(s.store, i).html}${btn(icon("plus"), "add-plan", "soft", `data-id="${esc(i.id)}" aria-label="В план: ${esc(i.title)}"`)}${btn(icon("heart"), "like", "soft", `data-id="${esc(i.id)}" aria-label="Сердечко идеи дня: ${esc(i.title)}"`)}</div></article>`).join("")}</div><div class="row">${btn("Листать без раздумий", "swipe", "primary")}${btn("Все с фильтрами", "show-catalog", "text")}</div></section><div class="section-title" id="catalog"><h2>${gaming ? "Давайте поиграем" : "Все идеи"} <span class="hand-heart">♡</span></h2><button class="icon-btn" data-action="filter" aria-label="Сегодня хочется — фильтры">${icon("filter")}</button></div><div class="categories" aria-label="Категории">${categories.map((c, i) => `<button class="chip chip-${i % 6} ${c === s.category ? "selected" : ""}" data-action="category" data-category="${c}" aria-pressed="${c === s.category}">${["✦", "⌂", "♧", "⚄", "✓", "☾", "☺", "✎", "♨", "♫", "☏", "✧", "♡", "◷"][i]} ${c}</button>`).join("")}</div><label class="search">${icon("search")}<input id="search" placeholder="Найти маленькое приключение" aria-label="Поиск идей" value="${esc(s.search)}"><span>${list.length}</span></label>${s.mood || s.maxDuration || s.onlyFavorites || s.showSkipped ? btn("Сбросить фильтры", "reset-filters", "text") : ""}<div class="idea-list">${
    list
      .slice(0, s.limit)
      .map((i) => card(i, s.store))
      .join("") ||
    empty(
      "Пока ничего не нашлось",
      "Попробуйте другой фильтр или добавьте свою идею.",
      "new-idea",
      "Предложить идею",
    )
  }</div>${list.length > s.limit ? btn(`Ещё идеи · осталось ${list.length - s.limit}`, "more", "soft wide") : ""}<aside class="banner"><span class="banner-icon">✦</span><div><h3>Из общей базы</h3><p>${s.store.ideas.length} способов побыть ближе.<br>А ваши идеи сделают её ещё лучше.</p></div>${btn(icon("arrow"), "all", "lavender", 'aria-label="Открыть всю базу"')}</aside>`;
}
export function buildScreen(s) {
  const ideas = s.draft
      .map((id) => s.store.ideas.find((i) => i.id === id))
      .filter(Boolean),
    total = ideas.reduce((sum, i) => sum + i.duration, 0);
  const saved = s.store.data.plans.filter(
    (p) =>
      !p.deletedAt &&
      !p.draftOwner &&
      !p.historyOwner &&
      !p.arcadeRecord &&
      !p.discoveryOwner,
  );
  return `<section class="plan-panel"><div class="section-title"><h2>Ваш план <span class="spark">✧</span></h2><span class="pill">${icon("clock")}${duration(total)}</span></div><p class="muted">Перетаскивайте за ⋮⋮ или используйте стрелки</p><ol class="plan-items">${ideas.map((i, n) => `<li class="plan-item bond-${affinity(s.store, i).level}" data-index="${n}"><span class="step-number">${n + 1}</span>${art(i)}<div class="plan-info"><h3>${esc(i.title)}</h3><span class="muted">${duration(i.duration)} · ${esc(i.location)}</span><div class="reorder-controls">${affinity(s.store, i).html}<button class="icon-btn" data-action="move-up" data-index="${n}" aria-label="Выше: ${esc(i.title)}" ${n === 0 ? "disabled" : ""}>${icon("up")}</button><button class="icon-btn" data-action="move-down" data-index="${n}" aria-label="Ниже: ${esc(i.title)}" ${n === ideas.length - 1 ? "disabled" : ""}>${icon("down")}</button><button class="icon-btn" data-action="remove-plan-item" data-index="${n}" aria-label="Убрать: ${esc(i.title)}">${icon("close")}</button></div></div><button class="drag-handle" aria-label="Перетащить: ${esc(i.title)}" data-index="${n}">⋮⋮</button></li>`).join("")}</ol>${!ideas.length ? empty("Вечер начинается с идеи", "Добавьте пару занятий — получится ваш маленький план.") : ""}</section><aside class="banner"><span class="banner-icon">⚄</span><div><h3>Случайный выбор</h3><p>Выберите место, настроение и время</p></div>${btn(icon("shuffle") + " Удиви нас", "surprise", "lavender")}</aside>${btn(icon("plan") + " Сохранить план", "save-plan", "primary wide", ideas.length ? "" : "disabled")}<div class="section-title"><h2>Наши планы</h2><span class="muted">${saved.length}</span></div>${saved.map((p) => `<article class="saved-plan ${p.completedAt ? "completed" : ""}"><div><h3>${esc(p.title)}</h3><p>${p.items.length} занятия · ${p.completedAt ? "Выполнен ♡" : "Ждёт своего вечера"}</p></div><div class="row">${btn("Открыть", "open-plan", "soft", `data-id="${esc(p.id)}"`)}${btn(p.completedAt ? "Вернуть" : "Готово " + icon("check"), "complete-plan", "lavender", `data-id="${esc(p.id)}"`)}<button class="icon-btn" data-action="delete-plan" data-id="${esc(p.id)}" aria-label="Удалить план ${esc(p.title)}">${icon("trash")}</button></div></article>`).join("") || '<p class="muted center">Сохранённые вечера появятся здесь.</p>'}<div class="section-title"><h2>Добавить ещё</h2><span class="muted">Листайте внутри →</span></div><p class="muted">Пять идей в столбике. Сердечки — сначала, дальше новые варианты.</p><div id="recommendation-feed" class="recommendation-feed" tabindex="0" role="region" aria-label="Рекомендации для вечера">${feedBatch(s, s.feedStart || 0, s.feedCount || 10)}</div>`;
}
export function matchesScreen(s) {
  const matches = s.store.matches;
  return `<section class="hero match-hero"><div class="hero-copy"><h2>${matches.length ? "Совпало!" : "Ближе с каждой идеей"}</h2><strong>${matches.length ? matches.length + " общих идей" : "Ваше «тоже хочу»"}</strong><p>${matches.length ? "Одинаковые вкусы —<br>больше особенных моментов." : "Отмечайте то, что нравится.<br>Общие симпатии появятся здесь."}</p></div><img class="hero-art" src="./assets/together.svg" alt=""></section><div class="section-title"><h2>Ваши общие идеи <span class="hand-heart">♡</span></h2></div>${matches.map((i) => card(i, s.store, { match: true })).join("") || empty("Найдите первое совпадение", "Когда вы оба отметите одну идею сердечком, она появится здесь.")}<aside class="banner pink"><span class="banner-icon">⚄</span><div><h3>Пусть решит случай</h3><p>Одна идея из ваших совпадений</p></div>${btn("Выбрать", "random-match", "primary", matches.length ? "" : "disabled")}</aside>`;
}
export function profileScreen(s) {
  const me = s.store.users.find((u) => u.localUserId === s.store.userId),
    partner = s.store.users.find((u) => u.localUserId !== s.store.userId);
  return `<section class="room-card"><img src="./assets/together.svg" alt="" class="room-art"><h2>${s.store.authCapacity > 2 ? "Ваша компания" : esc(me?.displayName || "Вы") + (partner ? " и " + esc(partner.displayName) : " и ваш человек")}</h2><p class="muted">${partner ? "Хорошо, что вы есть друг у друга." : "Пригласите того, с кем хочется делить маленькие радости."}</p>${btn(icon("copy") + " Скопировать ссылку", "copy-link", "primary wide")}<p class="room-symbols">${esc(s.roomLabel)}</p><p class="room-id">Код комнаты · ${esc(s.store.roomId)}</p><p class="muted">${s.store.users.length} / ${s.store.authCapacity || 2} участников · дополнительные устройства и экраны — по подтверждению</p></section>${partner && me?.displayName.trim().toLowerCase() === partner.displayName.trim().toLowerCase() ? `<aside class="identity-warning"><h3>Две роли, одинаковые имена?</h3><p>Исправьте имена, сохранив все сердечки и авторство.</p>${btn("Исправить имена", "pair-names", "primary")}</aside>` : ""}${s.store.authCapacity > 2 ? `<section class="participants-grid">${s.store.users.map((u) => `<div><span>${esc(u.avatar || "✨")}</span><strong>${esc(u.displayName)}</strong></div>`).join("")}</section>` : ""}<section class="settings"><h2>О вас</h2><form id="profile-form"><label>Имя<input name="name" maxlength="60" value="${esc(me?.displayName || "")}" required></label>${avatarPicker(me?.avatar || "🌷")}<button class="btn soft" type="submit">Сохранить</button></form></section><section class="settings"><h2>Ваши данные</h2><p class="muted">Идеи хранятся на ваших устройствах. Для обмена изменениями откройте комнату одновременно.</p><div class="settings-actions">${btn("Мои комнаты", "rooms", "text")}${btn("Режим общего экрана", "screen-mode", "text")}${s.store.authCapacity === 2 ? btn("Исправить имена", "pair-names", "text") : ""}${btn("Понравившиеся идеи", "favorites", "text")}${btn("Наш пул вопросов и действий", "tasks", "text")}${btn("Игровая история и выставки", "game-records", "text")}${btn("Скачать резервную копию", "export", "text")}<label class="btn text file-label">Восстановить из файла<input type="file" id="import-file" accept="application/json,.json"></label>${btn("🔄 Проверить обновление", "update-app", "text")}${btn("Установить приложение", "install", "text")}${btn("О связи и приватности", "connection", "text")}${btn("Выйти из комнаты", "leave", "text")}${btn("Очистить локальную копию", "clear", "text danger")}</div></section><p class="fine center">Сделано для маленьких моментов ♡<br>Вместе · версия 3.0</p>`;
}

export function gamesScreen(s) {
  return `<section class="shelf-intro"><span class="eyebrow">ВАША ИГРОТЕКА</span><h2>Достанем коробку?</h2><p>Телефоны становятся контроллерами, ПК — общим экраном. Истории, рисунки, головоломки и природный звук.</p>${btn("Подготовить наши вопросы и действия", "tasks", "text")}</section><div class="board-shelf">${gameBoxes.map((g, n) => `<button class="game-box box-${g.color}" data-action="play" data-id="${g.id}"><span class="box-edge"></span><span class="box-number">${String(n + 1).padStart(2, "0")} · ${s.store.authCapacity > 2 ? "ДЛЯ ДРУЗЕЙ" : "ДЛЯ ДВОИХ"}</span><span class="box-art">${g.emoji}</span><h3>${g.title}</h3><span class="box-subtitle">${g.subtitle}</span><p>${g.description}</p><span class="box-play">Открыть коробку ${icon("arrow")}</span></button>`).join("")}</div><p class="muted center">Вопросы и правда — один пул для всех разговорных игр. Действия — отдельный. Без повторов до конца каждой колоды.</p>`;
}
export function feedBatch(s, start, count) {
  const ranked = recommendations(s.store, s.draft).map((i) => i.id);
  s.feedOrder ||= ranked;
  for (const id of ranked) if (!s.feedOrder.includes(id)) s.feedOrder.push(id);
  const available = s.feedOrder
    .map((id) => s.store.ideas.find((i) => i.id === id))
    .filter((i) => i && !s.draft.includes(i.id));
  if (!available.length)
    return '<p class="muted">Все идеи уже в вашем плане.</p>';
  return Array.from({ length: count }, (_, n) =>
    suggestion(available[(start + n) % available.length], s.store),
  ).join("");
}
