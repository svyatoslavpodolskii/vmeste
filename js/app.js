import { Database } from "./db.js";
import { Store } from "./store.js";
import { RoomPeer } from "./peer.js";
import {
  esc,
  icon,
  btn,
  art,
  duration,
  sheet,
  closeSheet,
  toast,
} from "./ui.js";
import {
  onboarding,
  header,
  navigation,
  ideasScreen,
  buildScreen,
  matchesScreen,
  profileScreen,
  gamesScreen,
} from "./screens.js";
import {
  surprise,
  reorder,
  shuffle,
  preference,
  recommendations,
} from "./plans.js";
import {
  questions,
  truths,
  dares,
  choices,
  likely,
  riddles,
} from "../data/games.js";
const app = document.querySelector("#app");
const params = new URLSearchParams(location.search);
const identityKey =
  params.get("participant") === "2" ? "vmeste-user-2" : "vmeste-user";
let userId = localStorage.getItem(identityKey) || crypto.randomUUID();
localStorage.setItem(identityKey, userId);
const lastRoomKey = identityKey + "-room";
const validRoom = (id) =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{24,100}$/.test(id);
let roomId = params.get("room") || localStorage.getItem(lastRoomKey);
if (!validRoom(roomId)) roomId = null;
let db,
  store,
  peer,
  installPrompt,
  matchIds = new Set(),
  game = null;
const state = {
  tab: ["ideas", "build", "matches", "games", "profile"].includes(
    location.hash.slice(1),
  )
    ? location.hash.slice(1)
    : "ideas",
  category: "Всё",
  mood: "",
  search: "",
  maxDuration: 0,
  onlyFavorites: false,
  showSkipped: false,
  limit: 12,
  status: navigator.onLine ? "Ждём второго" : "Офлайн",
  draft: [],
};
function render() {
  if (!store) {
    app.innerHTML = onboarding(roomId);
    return;
  }
  state.store = store;
  state.roomLabel = roomId.slice(0, 6).toUpperCase();
  const scroll = window.scrollY;
  app.innerHTML = `<div class="app-shell">${header(state)}<main id="main">${{ ideas: ideasScreen, build: buildScreen, matches: matchesScreen, profile: profileScreen, games: gamesScreen }[state.tab](state)}</main>${navigation(state.tab, store.matches.length)}</div>`;
  window.scrollTo(0, scroll);
}
function navigate(tab) {
  closeSheet();
  state.tab = tab;
  location.hash = tab;
  render();
  window.scrollTo(0, 0);
}
function setStatus(text) {
  state.status = text;
  const el = document.querySelector("#connection-status");
  if (el) el.textContent = text;
  document
    .querySelector(".sync-status")
    ?.classList.toggle(
      "connected",
      ["Вы вдвоём", "Всё синхронизировано"].includes(text),
    );
}
async function enter(room, name, avatar = "🌷") {
  peer?.stop();
  roomId = room;
  localStorage.setItem(lastRoomKey, room);
  const url = new URL(location.href);
  url.searchParams.set("room", room);
  history.replaceState(null, "", url);
  store = await new Store(db, room, userId).load();
  const me = store.users.find((u) => u.localUserId === userId);
  if (name || !me)
    await store.save("users", {
      id: `${room}:${userId}`,
      localUserId: userId,
      displayName: name || "Вы",
      avatar: me?.avatar || avatar,
    });
  const draft = await db.all("meta", room);
  state.draft = draft.find((r) => r.id === `${room}:draft`)?.items || [];
  matchIds = new Set(store.matches.map((i) => i.id));
  store.addEventListener("change", (e) => {
    const newMatches = store.matches.filter((i) => !matchIds.has(i.id));
    matchIds = new Set(store.matches.map((i) => i.id));
    if (newMatches.length) {
      toast("Совпало! " + newMatches[0].title);
      document.querySelector("#toast")?.classList.add("match-toast");
      setTimeout(
        () => document.querySelector("#toast")?.classList.remove("match-toast"),
        3500,
      );
    }
    if (!document.querySelector("#sheet").open) render();
    if (e.detail.local && peer?.connection?.open)
      setStatus("Всё синхронизировано");
  });
  render();
  peer = new RoomPeer(store, setStatus);
}
async function persistDraft() {
  await db.put("meta", { id: `${roomId}:draft`, roomId, items: state.draft });
}
function ideaById(id) {
  return store.ideas.find((i) => i.id === id);
}
function detail(id) {
  const i = ideaById(id);
  if (!i) {
    toast("Эта идея уже удалена");
    return;
  }
  const playable = [
    "builtin-questions-1",
    "builtin-questions-2",
    "builtin-questions-3",
    "builtin-questions-7",
    "builtin-games-1",
  ].includes(id);
  sheet(
    `<div class="detail-art">${art(i)}</div><span class="eyebrow">${esc(i.category || "ВАША ИДЕЯ")}</span><h2>${esc(i.title)}</h2><p class="detail-description">${esc(i.description || "Маленькая идея для вашего особенного вечера.")}</p><div class="tags"><span>${icon("clock")}${duration(i.duration || 30)}</span><span>${icon("home")}${esc(i.location || "Дома")}</span><span>${i.cost ? esc(i.cost) + " ₸ примерно" : "Бесплатно"}</span><span class="mood">${esc(i.mood || "Уютно")}</span></div>${i.materials ? `<h3>Что понадобится</h3><ul>${i.materials.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<h3>Как провести время</h3><ol class="instructions">${(i.steps || [i.description || "Обсудите, как хотите провести время.", "Выберите удобный момент и приготовьте всё необходимое.", "Наслаждайтесь процессом — здесь не нужно делать идеально."]).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>${playable ? btn("Начать игру " + icon("arrow"), "game", "lavender wide", `data-id="${esc(id)}"`) : ""}<div class="row detail-buttons">${btn(icon("heart") + (["like", "favorite"].includes(store.reaction(id)) ? " Нравится ♥" : " Нравится"), "like", "soft", `data-id="${esc(id)}"`)}${btn(icon("bookmark") + " В план", "add-plan", "primary", `data-id="${esc(id)}"`)}</div>${btn(store.reaction(id) === "favorite" ? "♥★ Убрать суперлайк" : "♥★ Суперлайк", "favorite", "text wide", `data-id="${esc(id)}"`)}${i.source === "user" && i.authorId === userId ? `<div class="row">${btn("Изменить", "edit-idea", "text", `data-id="${esc(id)}"`)}${btn("Удалить идею", "delete-idea", "text danger", `data-id="${esc(id)}"`)}</div>` : ""}`,
  );
}
function ideaForm(id) {
  const i = id ? ideaById(id) : {};
  sheet(
    `<span class="eyebrow">ЛУЧШИЕ ИДЕИ — ВАШИ</span><h2>${id ? "Изменить идею" : "А давай…"}</h2><p class="muted">Достаточно названия. Остальное — по желанию.</p><form id="idea-form" data-id="${esc(id || "")}"><label>Название<input name="title" placeholder="Например, встретить рассвет" maxlength="160" required value="${esc(i.title || "")}"></label><label>Пару слов об идее<textarea name="description" maxlength="4000" placeholder="Что будем делать?">${esc(i.description || "")}</textarea></label><label>Картинка (по желанию)<input type="file" name="photo" accept="image/png,image/jpeg,image/webp"></label>${i.image ? '<label class="check-label"><input type="checkbox" name="removeImage">Убрать картинку</label>' : ""}<div class="form-grid"><label>Категория<select name="category">${["Дома", "Прогулки", "Игры", "Задания", "Еда", "Музыка", "Разговоры", "Творчество", "Свидания"].map((c) => `<option ${i.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Настроение<select name="mood">${["Уютно", "Спокойно", "Весело", "Близко", "Активно", "Творчески", "Необычно"].map((c) => `<option ${i.mood === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Где<select name="location">${["Дома", "На улице", "Где угодно"].map((c) => `<option ${i.location === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Минут<input name="duration" type="number" inputmode="numeric" min="1" max="1440" value="${i.duration || 30}"></label><label>Примерно, ₸<input name="cost" type="number" inputmode="numeric" min="0" max="10000000" value="${i.cost || 0}"></label><label>Значок<input name="icon" maxlength="8" value="${esc(i.icon || "✨")}"></label></div><button class="btn primary wide" type="submit">${id ? "Сохранить изменения" : "Добавить нашу идею"}</button></form>`,
  );
}
function filterSheet() {
  sheet(
    `<h2>Сегодня хочется…</h2><form id="filter-form"><label>Настроение<select name="mood">${["", "Уютно", "Спокойно", "Весело", "Необычно", "Близко", "Активно", "Творчески"].map((c) => `<option value="${c}" ${state.mood === c ? "selected" : ""}>${c || "Любое"}</option>`).join("")}</select></label><label>Есть время<select name="maxDuration">${[
      [0, "Сколько угодно"],
      [15, "До 15 минут"],
      [30, "До получаса"],
      [60, "До часа"],
      [120, "До двух часов"],
    ]
      .map(
        ([n, c]) =>
          `<option value="${n}" ${state.maxDuration === n ? "selected" : ""}>${c}</option>`,
      )
      .join(
        "",
      )}</select></label><label class="check-label"><input name="favorites" type="checkbox" ${state.onlyFavorites ? "checked" : ""}>Только с сердечком</label><button class="btn primary wide" type="submit">Найти занятие</button></form>`,
  );
}
const gameNames = {
  questions: "Вопросы друг другу",
  mixed: "Правда или действие",
  riddles: "Данетки",
  choice: "Что бы ты выбрал?",
  likely: "Кто скорее?",
};
function gamePool(kind) {
  const own = store.data.customTasks.filter((t) => !t.deletedAt);
  const q = [
    ...questions,
    ...own.filter((t) => t.kind === "question").map((t) => t.title),
  ];
  const truth = [
    ...truths,
    ...own.filter((t) => t.kind === "truth").map((t) => t.title),
  ];
  const dare = [
    ...dares,
    ...own.filter((t) => !t.kind || t.kind === "dare").map((t) => t.title),
  ];
  return kind === "riddles"
    ? riddles
    : [
        ...new Set(
          kind === "questions"
            ? [...q, ...truth]
            : kind === "mixed"
              ? [...q, ...truth]
                  .map((x) => "Правда · " + x)
                  .concat(dare.map((x) => "Действие · " + x))
              : kind === "choice"
                ? choices
                : likely,
        ),
      ];
}
function startGame(kind) {
  const key = `${roomId}:deck:${kind}`;
  game = { kind, key };
  try {
    Object.assign(game, JSON.parse(localStorage.getItem(key)) || {});
  } catch {}
  if (!Array.isArray(game.order) || !game.order.length)
    game.order = shuffle(gamePool(kind));
  gameView();
}
function gameView() {
  localStorage.setItem(
    game.key,
    JSON.stringify({ order: game.order, index: game.index || 0 }),
  );
  const index = game.index || 0,
    item = game.order[index],
    done = index >= game.order.length;
  sheet(
    `<span class="eyebrow">${esc(gameNames[game.kind])}</span><h2>${done ? "Колода закончилась" : "Ваш ход"}</h2>${done ? "<p>Все карточки сыграны. Новый круг перемешает колоду и добавит новые карточки из пула.</p>" : `<div class="question-card"><span>${index + 1} / ${game.order.length}</span><p>${esc(typeof item === "object" ? item.title : item)}</p></div>${game.kind === "riddles" ? `<p class="muted">Передайте экран ведущему. Он читает разгадку и отвечает только «да», «нет» или «неважно». Затем спрячьте ответ и читайте историю вместе.</p><details><summary>Разгадка · только для ведущего</summary><p>${esc(item.answer)}</p></details>` : '<p class="muted">Отвечайте по очереди. Любую карточку можно пропустить без объяснений.</p>'}`}${btn(done ? "Перемешать новую колоду" : "Следующая карточка →", done ? "restart-game" : "next-question", "primary wide")}`,
  );
}
function tasksSheet() {
  sheet(
    `<h2>Наши карточки</h2><p class="muted">Подготовьте заранее. Вопросы появятся в разговорах и правде, действия — в «Правде или действии». Существующая колода сохраняется до конца круга.</p><form id="task-form"><label>Тип<select name="kind"><option value="question">Вопрос</option><option value="truth">Правда</option><option value="dare">Действие</option></select></label><label>Текст<input name="title" maxlength="160" required placeholder="Что ты давно хотел попробовать?"></label><button class="btn primary" type="submit">Добавить в пул</button></form><div class="task-list">${store.data.customTasks
      .filter((t) => !t.deletedAt)
      .map(
        (t) =>
          `<article class="saved-plan"><div><span class="muted">${{ question: "Вопрос", truth: "Правда", dare: "Действие" }[t.kind] || "Действие"}</span><h3>${esc(t.title)}</h3></div>${btn("Удалить", "delete-task", "text", `data-id="${esc(t.id)}"`)}</article>`,
      )
      .join("")}</div>`,
  );
}
let swipeDeck = [];
function swipeView() {
  swipeDeck = swipeDeck.filter(
    (id) => ideaById(id) && !state.draft.includes(id),
  );
  const i = ideaById(swipeDeck[0]);
  sheet(
    i
      ? `<h2>Из ваших сердечек</h2><p class="muted">Вправо — в план, влево — следующая. Сердечки сохраняются.</p><div id="swipe-card" data-id="${esc(i.id)}">${art(i)}<h3>${esc(i.title)}</h3><p>${esc(i.description)}</p><span>${duration(i.duration)} · ${esc(i.location)}</span></div><div class="row">${btn("← Дальше", "swipe-next", "soft")}${btn("В план →", "swipe-add", "primary", `data-id="${esc(i.id)}"`)}</div><p class="muted">Осталось ${swipeDeck.length}</p>`
      : `<h2>Всё посмотрели</h2><p>Лайкните больше идей или продолжите подбор в рекомендациях.</p>${btn("Вернуться к плану", "close", "primary")}`,
  );
}
function confirmSheet(title, text, action, id = "") {
  sheet(
    `<h2>${title}</h2><p>${text}</p><div class="row">${btn("Отмена", "close", "soft")}${btn("Продолжить", action, "primary", `data-id="${esc(id)}"`)}</div>`,
  );
}
async function action(a, el) {
  const id = el.dataset.id;
  if (["ideas", "build", "matches", "games", "profile"].includes(a)) {
    navigate(a);
    return;
  }
  switch (a) {
    case "close":
      closeSheet();
      render();
      break;
    case "join":
      sheet(
        `<h2>Ваша ссылка-приглашение</h2><p class="muted">Вставьте ссылку, которую вам отправили.</p><form id="join-form"><label>Ссылка<input name="link" type="url" placeholder="https://…/?room=…" required></label><button class="btn primary wide" type="submit">Продолжить</button></form>`,
      );
      break;
    case "copy-link": {
      const u = new URL(location.href);
      u.search = "";
      u.searchParams.set("room", roomId);
      u.hash = "";
      try {
        await navigator.clipboard.writeText(u.href);
        toast("Ссылка скопирована. Отправьте её вашему человеку ♡");
      } catch {
        sheet(
          `<h2>Пригласите вашего человека</h2><label>Скопируйте ссылку<input readonly value="${esc(u.href)}" aria-label="Ссылка комнаты"></label>`,
        );
      }
      break;
    }
    case "new-idea":
      ideaForm();
      break;
    case "edit-idea":
      ideaForm(id);
      break;
    case "detail":
      detail(id);
      break;
    case "like":
      await store.react(
        id,
        ["like", "favorite"].includes(store.reaction(id)) ? "none" : "like",
      );
      if (document.querySelector("#sheet").open) detail(id);
      break;
    case "favorite":
      await store.react(
        id,
        store.reaction(id) === "favorite" ? "like" : "favorite",
      );
      detail(id);
      break;
    case "skip":
      await store.react(id, "skip");
      toast("Пропущено. Можно вернуть через фильтры");
      break;
    case "category":
      state.category = el.dataset.category;
      state.limit = 12;
      if (state.category === "Сюрприз") {
        detail(shuffle(store.ideas)[0].id);
      } else render();
      break;
    case "filter":
      filterSheet();
      break;
    case "reset-filters":
      Object.assign(state, {
        mood: "",
        maxDuration: 0,
        onlyFavorites: false,
        showSkipped: false,
        category: "Всё",
        search: "",
      });
      render();
      break;
    case "more":
      state.limit += 12;
      render();
      break;
    case "all":
      Object.assign(state, {
        category: "Всё",
        search: "",
        mood: "",
        maxDuration: 0,
        onlyFavorites: false,
        limit: 1000,
      });
      render();
      document
        .querySelector(".categories")
        .scrollIntoView({ behavior: "smooth" });
      break;
    case "favorites":
      state.onlyFavorites = true;
      state.category = "Всё";
      state.search = "";
      navigate("ideas");
      break;
    case "add-plan":
      if (!state.draft.includes(id)) {
        state.draft.push(id);
        await persistDraft();
        toast("Добавлено в ваш вечер");
        if (!document.querySelector("#sheet").open) render();
      } else toast("Уже есть в вашем плане");
      break;
    case "remove-plan-item":
      state.draft.splice(Number(el.dataset.index), 1);
      await persistDraft();
      render();
      break;
    case "move-up":
    case "move-down":
      state.draft = reorder(
        state.draft,
        Number(el.dataset.index),
        Number(el.dataset.index) + (a === "move-up" ? -1 : 1),
      );
      await persistDraft();
      render();
      break;
    case "more-suggestions":
      state.suggestLimit = (state.suggestLimit || 12) + 12;
      render();
      break;
    case "swipe":
      swipeDeck = recommendations(store, state.draft)
        .filter((i) => preference(store, i))
        .sort((a, b) => {
          const recent = (id) =>
            Math.max(
              0,
              ...store.data.reactions
                .filter(
                  (r) =>
                    r.ideaId === id &&
                    !r.deletedAt &&
                    ["like", "favorite"].includes(r.reaction),
                )
                .map((r) => r.updatedAt),
            );
          return recent(b.id) - recent(a.id);
        })
        .map((i) => i.id);
      swipeView();
      break;
    case "swipe-next":
      swipeDeck.shift();
      swipeView();
      break;
    case "swipe-add":
      await action("add-plan", el);
      swipeDeck.shift();
      swipeView();
      break;
    case "surprise":
      sheet(
        `<h2>Какой вечер соберём?</h2><form id="surprise-form"><label>Где<select name="location"><option>Дома</option><option>На улице</option><option value="">Где угодно</option></select></label><label>Время<select name="minutes">${[30, 60, 120, 180, 240].map((n) => `<option value="${n}" ${n === 120 ? "selected" : ""}>${duration(n)}</option>`).join("")}</select></label><label>Настроение<select name="mood">${["", "Уютно", "Спокойно", "Весело", "Близко", "Активно", "Творчески", "Необычно"].map((m) => `<option value="${m}">${m || "Любое"}</option>`).join("")}</select></label><p class="muted">Сердечки и суперлайки в приоритете.${state.draft.length ? " Текущая сборка будет заменена; сохранённые планы останутся." : ""}</p><button class="btn primary wide" type="submit">Собрать вечер</button></form>`,
      );
      break;
    case "save-plan":
      if (!state.draft.length) return;
      sheet(
        `<h2>Пусть этот вечер случится</h2><form id="plan-form"><label>Название плана<input name="title" value="Наш уютный вечер" maxlength="160" required></label><button class="btn primary wide" type="submit">Сохранить план</button></form>`,
      );
      break;
    case "open-plan": {
      const p = store.data.plans.find((p) => p.id === id);
      sheet(
        `<h2>${esc(p.title)}</h2><ol class="instructions">${p.items.map((id) => `<li>${esc(ideaById(id)?.title || "Идея была удалена")}</li>`).join("")}</ol>${btn("Скопировать в конструктор", "load-plan", "primary wide", `data-id="${esc(id)}"`)}`,
      );
      break;
    }
    case "load-plan":
      if (state.draft.length)
        confirmSheet(
          "Заменить текущую сборку?",
          "Сохранённый план останется в списке. Его копия заменит текущую сборку.",
          "confirm-load-plan",
          id,
        );
      else await action("confirm-load-plan", el);
      break;
    case "confirm-load-plan":
      state.draft = store.data.plans
        .find((p) => p.id === id)
        .items.filter((id) => ideaById(id));
      await persistDraft();
      navigate("build");
      break;
    case "complete-plan": {
      const p = store.data.plans.find((p) => p.id === id);
      await store.save("plans", {
        id,
        completedAt: p.completedAt ? null : Date.now(),
      });
      break;
    }
    case "delete-plan":
      confirmSheet(
        "Удалить план?",
        "Он исчезнет и у второго участника после обмена изменениями.",
        "confirm-delete-plan",
        id,
      );
      break;
    case "confirm-delete-plan":
      await store.remove("plans", id);
      closeSheet();
      render();
      break;
    case "delete-idea":
      confirmSheet(
        "Удалить вашу идею?",
        "Удаление передастся второму участнику.",
        "confirm-delete-idea",
        id,
      );
      break;
    case "confirm-delete-idea":
      await store.remove("ideas", id);
      closeSheet();
      render();
      break;
    case "random-match":
      if (store.matches.length) detail(shuffle(store.matches)[0].id);
      break;
    case "game":
      startGame(
        id === "builtin-games-1"
          ? "mixed"
          : id === "builtin-questions-2"
            ? "choice"
            : id === "builtin-questions-3"
              ? "likely"
              : "questions",
      );
      break;
    case "play":
      startGame(id);
      break;
    case "restart-game":
      game.order = shuffle(gamePool(game.kind));
      game.index = 0;
      gameView();
      break;
    case "next-question":
      game.index = (game.index || 0) + 1;
      gameView();
      break;
    case "tasks":
      tasksSheet();
      break;
    case "complete-task": {
      const t = store.data.customTasks.find((t) => t.id === id);
      await store.save("customTasks", {
        id,
        completedAt: t.completedAt ? null : Date.now(),
      });
      tasksSheet();
      break;
    }
    case "delete-task":
      await store.remove("customTasks", id);
      tasksSheet();
      break;
    case "export": {
      const blob = new Blob([JSON.stringify(store.export(), null, 2)], {
          type: "application/json",
        }),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `vmeste-${roomId.slice(0, 6)}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("Резервная копия подготовлена");
      break;
    }
    case "connection":
      sheet(
        `<h2>Рядом, даже когда не рядом</h2><p><strong>${esc(state.status)}</strong></p><p>Пока второй человек не в сети, все изменения сохраняются здесь. Когда вы одновременно откроете комнату, приложение попробует объединить ваши данные.</p><p>Если связь не появляется, попробуйте другую сеть. Некоторые сети не разрешают прямое соединение. Можно передать резервную копию через раздел «Ваши данные».</p><h3>Только ваше</h3><p>Ссылка — ключ от комнаты. Отправляйте её только вашему человеку. Идеи не хранятся на сервере; служба соединения помогает устройствам найти друг друга. Аналитики и рекламы нет.</p><p>После очистки браузера откройте ту же ссылку вместе со вторым участником: его копия восстановит общие данные. Восстановить прежние имя и реакции можно выбором своего профиля ниже.</p>${store.users
          .filter((u) => u.localUserId !== userId)
          .map((u) =>
            btn(
              "Это я: " + esc(u.displayName),
              "recover-user",
              "soft wide",
              `data-id="${esc(u.localUserId)}"`,
            ),
          )
          .join("")}`,
      );
      break;
    case "recover-user":
      confirmSheet(
        "Восстановить свой профиль?",
        "Выбирайте только свой прежний профиль. Реакции и авторство будут снова связаны с ним.",
        "confirm-recover",
        id,
      );
      break;
    case "confirm-recover": {
      const previous = userId;
      peer?.stop();
      await store.remove("users", `${roomId}:${previous}`);
      const entries = store.export().entries;
      const oldDb = db;
      userId = id;
      localStorage.setItem(identityKey, id);
      db = await new Database("vmeste-" + id).open();
      await db.batch(entries);
      oldDb.close();
      closeSheet();
      await enter(roomId);
      break;
    }
    case "leave":
      confirmSheet(
        "Выйти из комнаты?",
        "Данные останутся на этом устройстве. По прежней ссылке можно вернуться.",
        "confirm-leave",
      );
      break;
    case "clear":
      confirmSheet(
        "Очистить локальную копию?",
        "Сначала скачайте резервную копию. Данные на этом устройстве будут удалены; копия второго человека сохранится.",
        "confirm-clear",
      );
      break;
    case "confirm-clear":
      peer?.stop();
      await db.clearRoom(roomId);
      await action("confirm-leave", el);
      break;
    case "confirm-leave":
      peer?.stop();
      store = null;
      roomId = null;
      state.draft = [];
      localStorage.removeItem(lastRoomKey);
      history.replaceState(null, "", location.pathname);
      closeSheet();
      render();
      break;
    case "install":
      if (installPrompt) {
        await installPrompt.prompt();
        await installPrompt.userChoice;
        installPrompt = null;
      } else
        sheet(
          `<h2>Вместе на главном экране</h2><p>На iPhone: откройте приложение в Safari, нажмите «Поделиться», затем «На экран Домой».</p><p>На Android: откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».</p><p class="muted">После первого открытия приложение доступно без интернета. Обмен изменениями требует подключения обоих участников.</p>`,
        );
      break;
  }
}
document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  try {
    await action(el.dataset.action, el);
  } catch (err) {
    toast(err.message || "Не получилось. Попробуйте ещё раз");
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target,
    fields = Object.fromEntries(new FormData(form));
  const submit = form.querySelector('[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    switch (form.id) {
      case "onboard-form":
        if (!fields.name.trim()) throw Error("Напишите ваше имя");
        const fresh = !roomId;
        await enter(
          roomId || crypto.randomUUID().replaceAll("-", ""),
          fields.name.trim(),
        );
        if (fresh) {
          navigate("profile");
          toast("Ваша комната готова. Пригласите второго участника ♡");
        }
        break;
      case "join-form": {
        const u = new URL(fields.link);
        const id = u.searchParams.get("room");
        if (!validRoom(id)) throw Error("В ссылке не найдена комната");
        roomId = id;
        closeSheet();
        render();
        break;
      }
      case "surprise-form": {
        const pool = store.ideas.filter(
          (i) =>
            (!fields.location ||
              i.location === fields.location ||
              i.location === "Где угодно") &&
            (!fields.mood || i.mood === fields.mood),
        );
        const picked = surprise(pool, {
          location: fields.location,
          minutes: Number(fields.minutes),
          score: (i) => preference(store, i),
        });
        if (!picked.length)
          throw Error(
            "Нет подходящих идей. Попробуйте другое настроение или больше времени",
          );
        state.draft = picked;
        await persistDraft();
        closeSheet();
        navigate("build");
        toast("Ваш вечер готов ♥");
        break;
      }
      case "idea-form":
        if (!fields.title.trim()) throw Error("Добавьте название идеи");
        await store.save("ideas", {
          ...fields,
          photo: undefined,
          image: fields.removeImage
            ? ""
            : await readPhoto(
                form.elements.photo.files[0],
                ideaById(form.dataset.id)?.image,
              ),
          id: form.dataset.id || undefined,
          title: fields.title.trim(),
          duration: Number(fields.duration) || 30,
          cost: Number(fields.cost) || 0,
          source: "user",
        });
        closeSheet();
        Object.assign(state, {
          category: "Всё",
          search: "",
          mood: "",
          maxDuration: 0,
          onlyFavorites: false,
          limit: 1000,
        });
        navigate("ideas");
        toast("Идея сохранена ♡");
        break;
      case "filter-form":
        state.mood = fields.mood;
        state.maxDuration = Number(fields.maxDuration);
        state.onlyFavorites = !!fields.favorites;
        state.showSkipped = !!fields.skipped;
        state.limit = 12;
        closeSheet();
        render();
        break;
      case "profile-form":
        if (!fields.name.trim()) throw Error("Напишите ваше имя");
        await store.save("users", {
          id: `${roomId}:${userId}`,
          localUserId: userId,
          displayName: fields.name.trim(),
          avatar: fields.avatar,
        });
        toast("Сохранено");
        break;
      case "plan-form":
        if (!fields.title.trim()) throw Error("Назовите ваш вечер");
        await store.save("plans", {
          title: fields.title.trim(),
          items: [...state.draft],
        });
        state.draft = [];
        await persistDraft();
        closeSheet();
        render();
        toast("Вечер сохранён ♡");
        break;
      case "task-form":
        if (!fields.title.trim()) throw Error("Напишите задание");
        await store.save("customTasks", {
          title: fields.title.trim(),
          kind: fields.kind,
          description: "",
        });
        tasksSheet();
        break;
    }
  } catch (err) {
    toast(err.message || "Не удалось сохранить. Проверьте доступное место");
  } finally {
    if (submit) submit.disabled = false;
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    const pos = e.target.selectionStart;
    state.search = e.target.value;
    state.limit = 12;
    render();
    const input = document.querySelector("#search");
    input.focus({ preventScroll: true });
    input.setSelectionRange(pos, pos);
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.id !== "import-file") return;
  try {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10_000_000)
      throw Error("Файл слишком большой (максимум 10 МБ)");
    const input = JSON.parse(await file.text());
    const count = await store.import(input);
    render();
    toast(`Восстановлено записей: ${count}`);
  } catch (err) {
    toast(err.message || "Не удалось прочитать резервную копию");
  }
});
document.querySelector("#sheet").addEventListener("close", () => {
  document.body.classList.remove("modal-open");
  if (store) render();
});
document.querySelector("#sheet").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    const r = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeSheet();
  }
});
let drag;
document.addEventListener("pointerdown", (e) => {
  const handle = e.target.closest(".drag-handle");
  if (!handle) return;
  drag = {
    from: Number(handle.dataset.index),
    to: Number(handle.dataset.index),
    el: handle.closest(".plan-item"),
    y: e.clientY,
  };
  handle.setPointerCapture(e.pointerId);
  drag.el.classList.add("dragging");
});
document.addEventListener("pointermove", (e) => {
  if (!drag) return;
  drag.el.style.transform = `translateY(${e.clientY - drag.y}px)`;
  for (const el of document.querySelectorAll(".plan-item")) {
    const r = el.getBoundingClientRect();
    if (el !== drag.el && e.clientY >= r.top && e.clientY <= r.bottom)
      drag.to = Number(el.dataset.index);
  }
});
async function endDrag(cancel = false) {
  if (!drag) return;
  const d = drag;
  drag = null;
  d.el.style.transform = "";
  d.el.classList.remove("dragging");
  if (!cancel) {
    state.draft = reorder(state.draft, d.from, d.to);
    try {
      await persistDraft();
      render();
    } catch {
      toast("Не удалось сохранить порядок");
    }
  }
}
document.addEventListener("pointerup", () => endDrag());
document.addEventListener("pointercancel", () => endDrag(true));
window.addEventListener("hashchange", () => {
  const tab = location.hash.slice(1);
  if (
    store &&
    ["ideas", "build", "matches", "games", "profile"].includes(tab) &&
    tab !== state.tab
  ) {
    state.tab = tab;
    render();
  }
});
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
});
window.addEventListener("pagehide", () => peer?.stop());
window.addEventListener("pageshow", (e) => {
  if (e.persisted && store) peer = new RoomPeer(store, setStatus);
});
try {
  db = await new Database("vmeste-" + userId).open();
  if (roomId) {
    const users = await db.all("users", roomId);
    if (users.some((u) => u.localUserId === userId && !u.deletedAt))
      await enter(roomId);
    else render();
  } else render();
} catch {
  app.innerHTML =
    '<main class="onboarding"><h1>Не получилось открыть хранилище</h1><p>Разрешите сайту сохранять данные и обновите страницу. Ваши идеи не будут потеряны из-за несохранённых изменений.</p><button class="btn primary" onclick="location.reload()">Попробовать снова</button></main>';
}

async function readPhoto(file, previous = "") {
  if (!file) return previous;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 10_000_000)
    throw Error("Выберите JPG, PNG или WebP до 10 МБ");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas"),
    ratio = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let image;
  for (const quality of [0.8, 0.6, 0.4, 0.2]) {
    image = canvas.toDataURL("image/jpeg", quality);
    if (image.length < 48000) return image;
  }
  throw Error("Картинка слишком сложная. Выберите более простое изображение");
}
let press,
  suppressLike = false,
  swipeTouch;
document.addEventListener("pointerdown", (e) => {
  const heart = e.target.closest('[data-action="like"]');
  if (heart) {
    const x = e.clientX,
      y = e.clientY;
    press = {
      x,
      y,
      timer: setTimeout(async () => {
        suppressLike = heart.dataset.id;
        setTimeout(() => (suppressLike = false), 1000);
        try {
          await store.react(
            heart.dataset.id,
            store.reaction(heart.dataset.id) === "favorite"
              ? "like"
              : "favorite",
          );
          if (document.querySelector("#sheet").open) detail(heart.dataset.id);
          toast("Суперлайк обновлён ♥★");
        } catch (err) {
          toast(err.message);
        }
      }, 550),
    };
  }
  const card = e.target.closest("#swipe-card");
  if (card) swipeTouch = { x: e.clientX, y: e.clientY, id: card.dataset.id };
});
document.addEventListener("pointermove", (e) => {
  if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) {
    clearTimeout(press.timer);
    press = null;
  }
});
document.addEventListener("pointerup", async (e) => {
  if (press) {
    clearTimeout(press.timer);
    press = null;
  }
  if (swipeTouch) {
    const t = swipeTouch;
    swipeTouch = null;
    if (
      Math.abs(e.clientX - t.x) > 65 &&
      Math.abs(e.clientX - t.x) > Math.abs(e.clientY - t.y) * 1.3
    ) {
      try {
        if (e.clientX > t.x)
          await action("add-plan", { dataset: { id: t.id } });
        swipeDeck.shift();
        swipeView();
      } catch (err) {
        toast(err.message);
      }
    }
  }
});
document.addEventListener("pointercancel", () => {
  if (press) clearTimeout(press.timer);
  press = null;
  swipeTouch = null;
  suppressLike = false;
});
document.addEventListener(
  "click",
  (e) => {
    if (
      suppressLike &&
      e.target.closest('[data-action="like"]')?.dataset.id === suppressLike
    ) {
      suppressLike = false;
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  },
  true,
);
let loadingRecommendations = false;
window.addEventListener(
  "scroll",
  () => {
    const more = document.querySelector("#recommendation-more");
    if (
      !loadingRecommendations &&
      state.tab === "build" &&
      more &&
      more.getBoundingClientRect().top < innerHeight + 200
    ) {
      loadingRecommendations = true;
      state.suggestLimit = (state.suggestLimit || 12) + 12;
      render();
      requestAnimationFrame(() => (loadingRecommendations = false));
    }
  },
  { passive: true },
);

window.vmesteBeforeUpdate = async () => {
  if (store) {
    await store.queue;
    await persistDraft();
  }
};
