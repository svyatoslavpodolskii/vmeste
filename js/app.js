import {
  activityEvents,
  activitySheet,
  unreadEvents,
  markRead,
} from "./activity.js";
import { WorldGames, worldKinds } from "./worlds.js";
import { TurnGames, TURN_WORLD } from "./turn-games.js";
import { categories } from "../data/ideas.js";
import { roomMenu, settingsHome, backupSettings } from "./preferences.js";
import { PartyGames, partyKinds, partyScreen } from "./party.js";
import { roomSymbols, savedRooms, rememberRoom } from "./rooms.js";
import {
  gamePool as poolFor,
  sessionDeck,
  cardKey,
  playedHistory,
} from "./game-pools.js";
import { gameBoxes } from "../data/presentation.js";
import { RoomAuth } from "./auth.js";
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
  visualPicker,
  avatarPicker,
  affinity,
  suggestion,
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
  feedBatch,
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
document.addEventListener("change", (e) => {
  captureProfileDraft(e);
  if (!e.target.matches(".inline-avatar-picker input[name=avatar]")) return;
  const picker = e.target.closest(".inline-avatar-picker");
  picker.querySelector(".avatar-preview").textContent = e.target.value;
  picker.querySelector("details").open = false;
  picker.querySelector("summary").focus();
});
function captureProfileDraft(e) {
  const form = e.target.closest("#profile-form");
  if (!form || !store) return;
  const values = Object.fromEntries(new FormData(form));
  state.profileDraft = {
    ...values,
    roomId: store.roomId,
    userId: store.userId,
  };
}
document.addEventListener("input", captureProfileDraft);
const params = new URLSearchParams(location.search);
const identityKey =
  params.get("participant") === "2" ? "vmeste-user-2" : "vmeste-user";
const baseUserId = localStorage.getItem(identityKey) || crypto.randomUUID();
let userId = baseUserId;
localStorage.setItem(identityKey, userId);
const lastRoomKey = identityKey + "-room";
const validRoom = (id) =>
  typeof id === "string" && /^[a-zA-Z0-9_-]{24,100}$/.test(id);
let roomId = params.get("room") || localStorage.getItem(lastRoomKey);
if (!validRoom(roomId)) roomId = null;
if (roomId)
  userId =
    localStorage.getItem(identityKey + ":member:" + roomId) || baseUserId;
let db,
  store,
  peer,
  installPrompt,
  matchIds = new Set(),
  game = null,
  roomAuth,
  approvalResolve,
  approvalClient,
  confirmCodeResolve;
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
const worlds = new WorldGames({ store: () => store, peer: () => peer });
const turns = new TurnGames({ store: () => store, peer: () => peer });
const party = new PartyGames({
  store: () => store,
  peer: () => peer,
  soundSeed: () => `${roomId}:${userId}:${roomAuth?.record.publicKey.x}`,
  onInvite: (frame) => {
    state.invites ||= {};
    state.invites[frame.kind] = frame;
    if (!document.querySelector("#sheet").open && store?.authEstablished)
      render();
  },
  onFrame: (frame) => {
    state.invites ||= {};
    state.invites[frame.kind] = frame;
    state.partyFrame = frame;
    if (!document.querySelector("#sheet").open && store?.authEstablished)
      render();
  },
});
function updateUnread() {
  if (!store) return;
  state.unread = unreadEvents(store).length;
  for (const badge of document.querySelectorAll("[data-unread-count]")) {
    badge.textContent = state.unread;
    badge.hidden = !state.unread;
  }
}
window.addEventListener("vmeste-unread", updateUnread);
function screenTabs() {
  return `<div class="screen-tabs">${[...(peer?.games?.values() || [])]
    .filter((f) => !f.finished)
    .map(
      (f) =>
        `<button class="btn ${state.screenFrame?.kind === f.kind ? "lavender" : "soft"}" data-action="screen-game" data-id="${esc(f.kind)}">${esc(f.title)}</button>`,
    )
    .join("")}</div>`;
}
function render() {
  if (!store) {
    app.innerHTML = onboarding(roomId);
    return;
  }
  if (store.authEstablished && (store.authViewer || state.screenOnly)) {
    const f = state.screenFrame;
    app.innerHTML = `<main class="projector"><header><span>${roomSymbols(roomId)}</span>${btn("Мои комнаты", "rooms", "text")}${!store.authViewer ? btn("Играть здесь", "client-mode", "text") : ""}${btn("На весь экран", "fullscreen", "text")}</header><div class="projector-card"><span class="eyebrow">ОБЩИЙ ЭКРАН</span><div class="projector-live">${screenTabs()}${f ? partyScreen(f, true) : `<h1>Экран готов</h1><p>Начните игру на телефоне. Здесь появится общая карточка — без скрытых ответов и личных данных.</p>`}</div></div><footer>Управление остаётся на телефоне</footer></main>`;
    return;
  }
  if (store.authEstablished === false) {
    app.innerHTML = `<main class="onboarding pairing-lobby"><span class="eyebrow">ВАША КОМНАТА</span><h1>Вас ждут?</h1><div class="pair-orbit">${state.pairCode || "🪐"}</div><h2>${esc(state.pairMessage || "Отправляем запрос на вход…")}</h2><p class="muted">Откройте комнату на устройстве второго участника. Пока он не подтвердит вход, общие данные сюда не передаются.</p>${state.confirmCodePending ? `<p>У ${esc(state.confirmPeer || "вашего человека")} на экране те же значки?</p>${btn("Значки совпадают · войти", "confirm-pair-code", "primary wide")}${btn("Это не мой человек", "decline-pair-code", "text wide")}` : btn("Повторить подключение", "retry-pair", "primary")}${btn("Выйти", "confirm-leave", "text")}</main>`;
    return;
  }
  state.store = store;
  state.roomLabel = roomSymbols(roomId);
  rememberRoom(identityKey, {
    id: roomId,
    name:
      store.users.map((u) => u.displayName).join(" и ") ||
      roomAuth?.record.roster.map((r) => r.name).join(" и "),
    capacity: store.authCapacity,
    viewer: store.authViewer,
  });
  state.unread = unreadEvents(store).length;
  const scroll = window.scrollY;
  const feedScroll =
    document.querySelector("#recommendation-feed")?.scrollLeft || 0;
  app.innerHTML = `<div class="app-shell ${store.authCapacity > 2 ? "friends-theme" : ""}">${header(state)}<main id="main">${Object.values(
    state.invites || {},
  )
    .filter(
      (f) =>
        !f.finished &&
        (f.kind === state.partyFrame?.kind ||
          !f.public?.joined?.includes(userId)),
    )
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .slice(-1)
    .map(
      (f) =>
        `<aside class="live-game-banner"><span>${esc(f.title)}</span>${btn(f.public?.joined?.includes(userId) ? "Вернуться" : "Присоединиться", "open-live-game", "soft", `data-id="${esc(f.kind)}"`)}${f.controller === userId && f.public?.joined?.length === 0 ? btn("Завершить", "end-empty-game", "text", `data-id="${esc(f.kind)}"`) : ""}</aside>`,
    )
    .join(
      "",
    )}${{ ideas: ideasScreen, build: buildScreen, matches: matchesScreen, profile: profileScreen, games: gamesScreen }[state.tab](state)}</main>${navigation(
    state.tab,
    store.matches.length,
    store.authCapacity,
    Object.values(state.invites || {}).some(
      (f) =>
        !f.finished &&
        f.controller !== userId &&
        !f.public?.joined?.includes(userId),
    ),
  )}${["ideas", "build"].includes(state.tab) ? `<button class="discover-fab" data-action="swipe" aria-label="Листать идеи">${icon("shuffle")}<span>Листать идеи</span></button>` : ""}${state.connectedIntro ? '<div class="connection-intro" aria-live="polite"><span>✨</span><h2>Вы вместе</h2><p>Свои люди. Одна маленькая вселенная.</p></div>' : ""}</div>`;
  window.scrollTo(0, scroll);
  const feed = document.querySelector("#recommendation-feed");
  if (feed) feed.scrollLeft = feedScroll;
}
function navigate(tab) {
  closeSheet();
  if (tab === "build" && state.tab !== "build") {
    state.feedOrder = null;
    state.feedStart = 0;
    state.feedCount = 10;
  }
  state.tab = tab;
  location.hash = tab;
  render();
  window.scrollTo(0, 0);
}
let syncStatusTimer;
function setStatus(text) {
  if (text === "Синхронизация…" && state.status === "На связи") return;
  clearTimeout(syncStatusTimer);
  if (text === "Синхронизация…") {
    syncStatusTimer = setTimeout(() => showStatus("Обновляем данные…"), 2000);
    return;
  }
  showStatus(
    ["Вы вдвоём", "Всё синхронизировано"].includes(text) ? "На связи" : text,
  );
}
function showStatus(text) {
  state.status = text;
  const el = document.querySelector("#connection-status");
  if (el) el.textContent = text;
  document
    .querySelector(".sync-status")
    ?.classList.toggle(
      "connected",
      ["На связи", "Вы вдвоём", "Всё синхронизировано"].includes(text),
    );
}
async function enter(room, name, avatar = "🌷", creator = false, options = {}) {
  party.reset();
  state.invites = {};
  state.partyFrame = null;
  state.screenFrame = null;
  state.screenOnly = false;
  peer?.stop();
  const member =
    localStorage.getItem(identityKey + ":member:" + room) || baseUserId;
  if (member !== userId) {
    db?.close();
    userId = member;
    db = await new Database("vmeste-" + member).open();
  }
  state.feedOrder = null;
  state.feedStart = 0;
  state.feedCount = 10;
  roomId = room;
  localStorage.setItem(lastRoomKey, room);
  const url = new URL(location.href);
  url.searchParams.set("room", room);
  history.replaceState(null, "", url);
  store = await new Store(db, room, userId).load();
  const me = store.data.users.find(
    (u) => u.localUserId === userId && !u.deletedAt,
  );
  const previouslyKnown = !!me && !me.provisional;
  if (name || !me)
    await store.save("users", {
      id: `${room}:${userId}`,
      localUserId: userId,
      displayName: name || "Вы",
      avatar: me?.avatar || avatar,
      provisional: !creator && !previouslyKnown,
    });
  const draft = await db.all("meta", room);
  state.draft = draft.find((r) => r.id === `${room}:draft`)?.items || [];
  roomAuth = await RoomAuth.create(store, {
    established: creator || previouslyKnown,
    capacity: options.capacity,
    requestedMode: options.requestedMode,
    onlineMembers: () => peer?.onlineMembers() || new Set([userId]),
    onRequest: (request) =>
      new Promise((resolve) => {
        if (approvalResolve) {
          approvalResolve(false);
          approvalResolve = null;
        }
        approvalResolve = resolve;
        approvalClient = request.clientId;
        sheet(
          `<div class="pair-orbit">${request.code}</div><span class="eyebrow">СВЕРЬТЕ ЗНАЧКИ НА ДВУХ ЭКРАНАХ</span><h2>${esc(request.name)} просит подключиться</h2><p>${request.mode === "display" ? "Общий экран получит только открытую игровую карточку, без вашей базы и скрытых ответов." : request.restoring ? "Передайте устройству одну из прежних ролей. Идеи, реакции и планы восстановятся от подключённого участника." : "Примите нового участника в вашу комнату."}</p><label>Разрешить как<select id="admission-target">${request.targets.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}</select></label><p class="muted">Принимайте только вашего человека, если значки на экранах совпадают.</p><div class="row">${btn("Отклонить", "deny-pair", "soft")}${btn("Подтвердить подключение", "approve-pair", "primary")}</div>`,
        );
      }),
    onConfirm: (request) =>
      new Promise((resolve) => {
        confirmCodeResolve = resolve;
        state.confirmClient = request.clientId;
        state.pairCode = request.code;
        state.confirmPeer = request.name;
        state.confirmCodePending = true;
        state.pairMessage =
          "Подтвердите одинаковые значки на обоих устройствах";
        render();
      }),
    onPendingClosed: (clientId) => {
      if (confirmCodeResolve && state.confirmClient === clientId) {
        const resolve = confirmCodeResolve;
        confirmCodeResolve = null;
        state.confirmCodePending = false;
        resolve(false);
        if (!store?.authEstablished) render();
      }
      if (approvalResolve && approvalClient === clientId) {
        const resolve = approvalResolve;
        approvalResolve = null;
        approvalClient = null;
        closeSheet();
        resolve(false);
      }
    },
    onWaiting: (info) => {
      state.pairCode = info?.code;
      state.pairMessage = info?.message;
      if (store && !store.authEstablished) render();
    },
    onAdmitted: async (id, name) => {
      const previous = userId;
      if (id !== userId) {
        const provisional = store.data.users.find(
          (u) => u.localUserId === previous && u.provisional,
        );
        if (provisional) await store.remove("users", provisional.id);
        const nextDb = await new Database("vmeste-" + id).open();
        await nextDb.batch([
          ...store.export().entries,
          ...(await db.all("meta", roomId)).map((record) => ({
            table: "meta",
            record,
          })),
        ]);
        db.close();
        db = nextDb;
        store.db = db;
        userId = id;
        store.userId = id;
        localStorage.setItem(identityKey + ":member:" + roomId, id);
      }
      if (store.authViewer) {
        state.tab = "profile";
        render();
        return;
      }
      if (!store.data.users.some((u) => u.localUserId === id && !u.deletedAt))
        await store.save("users", {
          id: `${roomId}:${id}`,
          localUserId: id,
          displayName: name,
          avatar: "🧝",
          provisional: false,
        });
      else if (store.data.users.find((u) => u.localUserId === id)?.provisional)
        await store.save("users", {
          id: `${roomId}:${id}`,
          provisional: false,
        });
      state.tab = "profile";
      location.hash = "profile";
      render();
    },
    onConnected: () => {
      state.connectedIntro = true;
      toast("Вы снова вместе ✨");
      render();
      setTimeout(() => {
        state.connectedIntro = false;
        render();
      }, 2200);
    },
  });
  matchIds = new Set(store.matches.map((i) => i.id));
  store.addEventListener("change", (e) => {
    if (e.detail.entries.some((e) => e.record.worldEvent)) {
      worlds.changed(e.detail.entries);
      if (
        e.detail.entries.some((e) => e.record.worldEvent?.world === TURN_WORLD)
      )
        turns.changed();
      updateUnread();
    }
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
    const restoredDraft = e.detail.entries.find(
      (e) =>
        e.table === "plans" &&
        e.record.draftOwner === userId &&
        !e.record.deletedAt,
    );
    if (restoredDraft) {
      state.draft = [...restoredDraft.record.items];
      db.put("meta", { id: `${roomId}:draft`, roomId, items: state.draft });
      if (!document.querySelector("#sheet").open) render();
    }
    if (e.detail.local && peer?.admission?.authorized)
      setStatus("Всё синхронизировано");
  });
  if (
    store.authEstablished &&
    !store.authViewer &&
    !store.data.plans.some((p) => p.draftOwner === userId)
  )
    await persistDraft();
  render();
  peer = new RoomPeer(store, setStatus, roomAuth);
}
async function persistDraft() {
  await db.put("meta", { id: `${roomId}:draft`, roomId, items: state.draft });
  if (store?.authEstablished)
    await store.save("plans", {
      id: `${roomId}:draft:${userId}`,
      title: "Текущий вечер",
      items: [...state.draft],
      draftOwner: userId,
    });
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
    `<div class="detail-art">${art(i)}</div><span class="eyebrow">${esc(i.category || "ВАША ИДЕЯ")}</span><h2>${esc(i.title)}</h2><p class="detail-description">${esc(i.description || "Маленькая идея для вашего особенного вечера.")}</p><div class="tags"><span>${icon("clock")}${duration(i.duration || 30)}</span><span>${icon("home")}${esc(i.location || "Дома")}</span><span>${i.cost ? esc(i.cost) + " ₸ примерно" : "Бесплатно"}</span><span class="mood">${esc(i.mood || "Уютно")}</span></div>${i.materials ? `<h3>Что понадобится</h3><ul>${i.materials.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<h3>Как провести время</h3><ol class="instructions">${(i.steps || [i.description || "Обсудите, как хотите провести время.", "Выберите удобный момент и приготовьте всё необходимое.", "Наслаждайтесь процессом — здесь не нужно делать идеально."]).map((x) => `<li>${esc(x)}</li>`).join("")}</ol>${playable ? btn("Начать игру " + icon("arrow"), "game", "lavender wide", `data-id="${esc(id)}"`) : ""}<div class="row detail-buttons">${btn(icon("heart") + " Нравится", "like", `soft reaction-button ${["like", "favorite"].includes(store.reaction(id)) ? "is-selected" : ""}`, `data-id="${esc(id)}" aria-pressed="${["like", "favorite"].includes(store.reaction(id))}"`)}${btn(icon("bookmark") + " В план", "add-plan", "primary", `data-id="${esc(id)}"`)}</div>${btn(icon("star") + " Суперлайк", "favorite", `lavender wide reaction-button ${store.reaction(id) === "favorite" ? "is-selected" : ""}`, `data-id="${esc(id)}" aria-pressed="${store.reaction(id) === "favorite"}"`)}${i.source === "user" && i.authorId === userId ? `<div class="row">${btn("Изменить", "edit-idea", "text", `data-id="${esc(id)}"`)}${btn("Удалить идею", "delete-idea", "text danger", `data-id="${esc(id)}"`)}</div>` : ""}`,
  );
}
function ideaForm(id) {
  const i = id ? ideaById(id) : {};
  sheet(
    `<span class="eyebrow">ЛУЧШИЕ ИДЕИ — ВАШИ</span><h2>${id ? "Изменить идею" : "А давай…"}</h2><p class="muted">Достаточно названия. Остальное — по желанию.</p><form id="idea-form" data-id="${esc(id || "")}"><label>Название<input name="title" placeholder="Например, встретить рассвет" maxlength="160" required value="${esc(i.title || "")}"></label><label>Пару слов об идее<textarea name="description" maxlength="4000" placeholder="Что будем делать?">${esc(i.description || "")}</textarea></label>${visualPicker(i)}<div class="form-grid"><label>Категория<select name="category">${["Дома", "Прогулки", "Игры", "Задания", "Еда", "Музыка", "Разговоры", "Творчество", "Свидания"].map((c) => `<option ${i.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Настроение<select name="mood">${["Уютно", "Спокойно", "Весело", "Близко", "Активно", "Творчески", "Необычно"].map((c) => `<option ${i.mood === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Где<select name="location">${["Дома", "На улице", "Где угодно"].map((c) => `<option ${i.location === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Минут<input name="duration" type="number" inputmode="numeric" min="1" max="1440" value="${i.duration || 30}"></label><label>Примерно, ₸<input name="cost" type="number" inputmode="numeric" min="0" max="10000000" value="${i.cost || 0}"></label></div><button class="btn primary wide" type="submit">${id ? "Сохранить изменения" : "Добавить нашу идею"}</button></form>`,
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
const gameNames = Object.fromEntries(gameBoxes.map((g) => [g.id, g.title]));
function gamePool(kind) {
  return poolFor(store, kind);
}
let gameTimer,
  historyQueue = Promise.resolve();
function startGame(kind) {
  if (kind === "word") {
    worlds.opened = false;
    turns.open();
    return;
  }
  if (worldKinds.includes(kind)) {
    worlds.open(kind);
    return;
  }
  if (partyKinds.includes(kind)) {
    party.start(kind);
    return;
  }
  party.audio?.stop();
  const key = `${roomId}:deck:${kind}`;
  game = { kind, key, phase: 0, score: 0, attempts: 0, builtAt: Date.now() };
  try {
    Object.assign(game, JSON.parse(localStorage.getItem(key)) || {});
  } catch {}
  const fresh = sessionDeck(store, kind),
    history = playedHistory(store);
  const newlyAdded = store.data.customTasks.some(
    (t) =>
      !t.deletedAt &&
      !history[cardKey(t.title)] &&
      !game.order?.some((item) => cardKey(item) === cardKey(t.title)) &&
      fresh.some((item) => cardKey(item) === cardKey(t.title)),
  );
  if (!Array.isArray(game.order) || !game.order.length || newlyAdded) {
    game.order = fresh;
    game.builtAt = Date.now();
    game.index = 0;
    game.phase = 0;
    game.markedIndex = -1;
  }
  gameView();
}
function gameView() {
  clearInterval(gameTimer);
  const index = game.index || 0,
    item = game.order[index],
    done = index >= game.order.length,
    box = gameBoxes.find((b) => b.id === game.kind) || gameBoxes[0];
  localStorage.setItem(
    game.key,
    JSON.stringify({ ...game, key: undefined, kind: undefined }),
  );
  let body = "",
    controls = "";
  if (!done && game.markedIndex !== index) {
    game.markedIndex = index;
    const key = cardKey(item);
    historyQueue = historyQueue
      .then(async () => {
        const id = `${roomId}:history:${userId}`,
          old = store.data.plans.find((p) => p.id === id);
        const played = { ...(old?.played || {}), [key]: Date.now() };
        const recent = Object.fromEntries(
          Object.entries(played)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 300),
        );
        await store.save("plans", {
          id,
          title: "История игр",
          items: [],
          historyOwner: userId,
          played: recent,
        });
      })
      .catch(() => toast("Не удалось сохранить историю игры"));
  }
  const text =
    typeof item === "object"
      ? item.title
      : String(item || "").replace(/^(Правда|Действие) · /, "");
  const phase = game.phase || 0;
  if (done) {
    body = `<div class="deck-finale">${box.emoji}<h2>Вся колода сыграна</h2><p>Новый круг перемешает карточки и добавит новые из общего пула.</p></div>`;
    controls = btn("Перемешать колоду", "restart-game", "primary wide");
  } else if (game.kind === "prediction" && phase === 1) {
    body = `<div class="card-back"><span>🔮</span><h2>Передайте телефон</h2><p>Прогноз спрятан. Теперь ваш человек отвечает.</p></div>`;
    controls = btn(
      "Телефон у меня · открыть вопрос",
      "game-phase",
      "primary wide",
      'data-phase="2"',
    );
  } else {
    body = `<div class="table-card"><span class="card-suit">${box.emoji}</span><span class="card-number">${index + 1} / ${game.order.length}</span><p>${esc(text)}</p><span class="card-suit bottom">${box.emoji}</span></div>`;
    if (game.kind === "prediction") {
      if (phase === 0) {
        body += `<form id="prediction-form"><label>Как, по-вашему, ответит ваш человек?<textarea name="prediction" maxlength="500" required placeholder="Мой прогноз…"></textarea></label><button class="btn primary wide" type="submit">Спрятать прогноз и передать телефон</button></form>`;
      } else if (phase === 2) {
        body +=
          '<p class="game-instruction">Ответьте вслух, прежде чем смотреть прогноз.</p>';
        controls = btn(
          "Показать прогноз",
          "game-phase",
          "primary wide",
          'data-phase="3"',
        );
      } else {
        body += `<div class="prediction-reveal"><span>Ваш прогноз</span><p>${esc(game.prediction)}</p></div>`;
        controls = `<div class="row">${btn("Совпало!", "game-hit", "primary")}${btn("Узнали новое", "game-miss", "soft")}</div>`;
      }
    } else if (game.kind === "mime") {
      if (phase === 0)
        controls = btn("Начать 45 секунд", "mime-start", "primary wide");
      else if (phase === 1) {
        body += `<div class="game-timer" id="game-timer">45</div><p class="game-instruction">Экран видит только исполнитель. Показывайте без слов!</p>`;
        controls = `<div class="row">${btn("Угадали!", "game-hit", "primary")}${btn("Пропустить", "game-miss", "soft")}</div>`;
        gameTimer = setInterval(() => {
          const left = Math.max(
            0,
            Math.ceil((game.deadline - Date.now()) / 1000),
          );
          const timer = document.querySelector("#game-timer");
          if (!timer) {
            clearInterval(gameTimer);
            return;
          }
          timer.textContent = left;
          if (!left) {
            clearInterval(gameTimer);
            game.phase = 2;
            gameView();
          }
        }, 200);
      } else {
        body +=
          '<p class="game-instruction">Время вышло. Поменяйтесь ролями!</p>';
        controls = `<div class="row">${btn("Успели угадать", "game-hit", "primary")}${btn("Следующая", "game-miss", "soft")}</div>`;
      }
    } else {
      if (game.kind === "riddles")
        body += `<details class="riddle-answer"><summary>Разгадка · только для ведущего</summary><p>${esc(item.answer)}</p></details>`;
      if (game.kind === "echo")
        body += `<p class="game-instruction">${phase === 0 ? "Ответьте так, как ответил бы ваш человек. Затем передайте телефон." : "Теперь расскажите свой настоящий ответ. Что совпало, а что удивило?"}</p>`;
      controls =
        game.kind === "echo" && phase === 0
          ? btn(
              "Передать телефон",
              "game-phase",
              "primary wide",
              'data-phase="1"',
            )
          : btn("Следующая карточка →", "next-question", "primary wide");
    }
  }
  const secret =
    (game.kind === "prediction" && phase === 1) ||
    (game.kind === "mime" && !done);
  peer?.publishGame({
    title: box.title,
    text: done
      ? "Колода закончилась"
      : secret
        ? "Ход на телефоне. Ответ скрыт от общего экрана."
        : text,
    progress: done ? "Новый круг?" : `${index + 1} / ${game.order.length}`,
    kind: game.kind,
    controller: userId,
  });
  sheet(
    `<div class="board-game felt-${box.color}"><header class="table-heading"><span class="eyebrow">${box.subtitle}</span><h2>${box.title}</h2>${game.attempts ? `<span class="score-chip">${game.score} / ${game.attempts} совпадений</span>` : ""}</header>${body}<div class="game-controls">${controls}${!done && !controls.includes('data-action="next-question"') ? btn("Пропустить карточку", "next-question", "text wide") : ""}</div><details class="game-rules"><summary>Как играть</summary><p>${box.rule}</p><p>Вопросы и правда — один общий пул. Любой ход можно пропустить.</p></details></div>`,
  );
}
function tasksSheet() {
  sheet(
    `<h2>Наши карточки</h2><p class="muted">Подготовьте заранее. Вопросы появятся в разговорах и правде, действия — в «Правде или действии». Существующая колода сохраняется до конца круга.</p><form id="task-form"><label>Тип<select name="kind"><option value="question">Вопрос</option><option value="dare">Действие</option></select></label><label>Текст<input name="title" maxlength="160" required placeholder="Что ты давно хотел попробовать?"></label><button class="btn primary" type="submit">Добавить в пул</button></form><div class="task-list">${store.data.customTasks
      .filter((t) => !t.deletedAt)
      .map(
        (t) =>
          `<article class="saved-plan"><div><span class="muted">${{ question: "Вопрос", truth: "Вопрос", dare: "Действие" }[t.kind] || "Действие"}</span><h3>${esc(t.title)}</h3></div>${btn("Удалить", "delete-task", "text", `data-id="${esc(t.id)}"`)}</article>`,
      )
      .join("")}</div>`,
  );
}
let swipeFilters = { category: "Всё", location: "", minutes: 0, free: false },
  swipeSeen = [],
  swipeDeck = [],
  swipeMode = "discover",
  swipeBusy = false;
function prepareSwipe(random = false) {
  const available = store.ideas.filter(
    (i) =>
      (swipeMode !== "plan" || !state.draft.includes(i.id)) &&
      (swipeFilters.category === "Всё" ||
        [i.category, i.mood, i.location, i.topic].includes(
          swipeFilters.category,
        )) &&
      (!swipeFilters.location ||
        i.location === swipeFilters.location ||
        i.location === "Где угодно") &&
      (!swipeFilters.minutes || i.duration <= swipeFilters.minutes) &&
      (!swipeFilters.free || !i.cost),
  );
  const recent = (i) =>
    Math.max(
      0,
      ...store.data.reactions
        .filter(
          (r) =>
            r.ideaId === i.id &&
            !r.deletedAt &&
            ["like", "favorite"].includes(r.reaction),
        )
        .map((r) => r.updatedAt),
    );
  const saved = store.data.plans.find(
    (p) =>
      p.discoveryOwner === userId &&
      p.discoveryMode === swipeMode &&
      !p.deletedAt,
  );
  if (!random && saved?.remaining?.length) {
    const ids = new Set(available.map((i) => i.id));
    swipeSeen = saved.seen || [];
    const fresh = available
      .filter(
        (i) => !saved.remaining.includes(i.id) && !swipeSeen.includes(i.id),
      )
      .map((i) => i.id);
    swipeDeck = fresh.concat(saved.remaining.filter((id) => ids.has(id)));
    return;
  }
  swipeSeen = [];
  swipeDeck = (
    random
      ? shuffle(available)
      : available
          .filter((i) => preference(store, i))
          .sort((a, b) => recent(b) - recent(a))
          .concat(shuffle(available.filter((i) => !preference(store, i))))
  ).map((i) => i.id);
}
function swipeView() {
  swipeDeck = swipeDeck.filter((id) => ideaById(id));
  if (!swipeDeck.length) prepareSwipe(true);
  const i = ideaById(swipeDeck[0]);
  sheet(
    `<div class="discover-head"><span class="eyebrow">DISCOVER · ДЛЯ ДВОИХ</span><h2>${swipeMode === "plan" ? "Выбираем вечер" : "Открываем новое"}</h2>${btn(icon("filter") + " Подобрать", "swipe-filter", "soft")}<p class="swipe-filter-summary">${[swipeFilters.category !== "Всё" ? swipeFilters.category : "Все темы", swipeFilters.location, swipeFilters.minutes ? `до ${swipeFilters.minutes} мин` : "", swipeFilters.free ? "бесплатно" : ""].filter(Boolean).join(" · ")}</p><div class="row">${btn("Открытия", "swipe-mode", swipeMode === "discover" ? "primary" : "soft", 'data-id="discover"')}${btn("В план", "swipe-mode", swipeMode === "plan" ? "primary" : "soft", 'data-id="plan"')}${btn(icon("shuffle"), "swipe-random", "soft", 'aria-label="Перемешать идеи"')}</div></div>${i ? `<div class="swipe-stack"><div id="swipe-card" class="bond-${affinity(store, i).level}" data-id="${esc(i.id)}">${art(i)}<div class="swipe-copy">${affinity(store, i).html}<h3>${esc(i.title)}</h3><p>${esc(i.description)}</p><span>${duration(i.duration)} · ${esc(i.location)}</span></div></div></div><p class="muted center">Влево — дальше · вправо — ${swipeMode === "plan" ? "в план" : "нравится"}</p><div class="swipe-actions">${btn(icon("back"), "swipe-back", "soft", `aria-label="Предыдущая идея" ${swipeSeen.length ? "" : "disabled"}`)}${btn(icon("close"), "swipe-next", "soft", 'aria-label="Следующая идея"')}${btn(icon("heart"), "swipe-yes", "primary", `data-id="${esc(i.id)}" aria-label="${swipeMode === "plan" ? "Добавить в план" : "Нравится"}"`)}${btn(icon("plus"), "swipe-add", "lavender", `data-id="${esc(i.id)}" aria-label="В план"`)}</div>` : "<p>По этим условиям идей не осталось. Измените подбор или откройте новый круг.</p>"}`,
  );
}
async function persistSwipe() {
  await store.save("plans", {
    id: `${roomId}:discover:${userId}:${swipeMode}`,
    title: "Колода идей",
    items: [],
    discoveryOwner: userId,
    discoveryMode: swipeMode,
    remaining: [...swipeDeck],
    seen: [...new Set(swipeSeen)].slice(-1500),
  });
}
async function swipeAdvance(yes = false) {
  if (swipeBusy) return;
  swipeBusy = true;
  const id = swipeDeck[0],
    card = document.querySelector("#swipe-card");
  try {
    if (card) {
      card.style.transition = "transform .18s ease,opacity .18s";
      card.style.transform = `translateX(${yes ? 300 : -300}px) rotate(${yes ? 12 : -12}deg)`;
      card.style.opacity = "0";
    }
    if (yes) {
      if (swipeMode === "plan") await action("add-plan", { dataset: { id } });
      else if (!["like", "favorite"].includes(store.reaction(id)))
        await store.react(id, "like");
    }
    await new Promise((r) => setTimeout(r, 160));
    swipeDeck.shift();
    swipeSeen.push(id);
    await persistSwipe();
    if (
      document.querySelector("#sheet").open &&
      document.querySelector("#swipe-card") === card
    )
      swipeView();
  } finally {
    swipeBusy = false;
  }
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
    case "plan-like":
      await store.react(
        id,
        ["like", "favorite"].includes(store.reaction(id)) ? "none" : "like",
      );
      render();
      break;
    case "activity":
      sheet(activitySheet(store, el.dataset.worldFilter || ""));
      break;
    case "activity-read-all":
      markRead(
        store,
        activityEvents(store)
          .filter(
            (e) =>
              !el.dataset.worldFilter || e.world === el.dataset.worldFilter,
          )
          .map((e) => e.id),
      );
      sheet(activitySheet(store, el.dataset.worldFilter || ""));
      break;
    case "activity-open": {
      const event = activityEvents(store).find(
        (e) => e.id === el.dataset.event,
      );
      if (event?.world === TURN_WORLD) turns.open(event);
      else if (event) worlds.openEvent(event);
      break;
    }
    case "settings":
      sheet(settingsHome());
      break;
    case "settings-files":
      sheet(backupSettings());
      break;
    case "room-menu":
      sheet(roomMenu(identityKey, roomId));
      break;
    case "edit-profile": {
      const me = store.users.find((u) => u.localUserId === userId);
      sheet(
        `<h2>Ваш образ</h2><form id="profile-edit-form"><label>Имя<input name="name" maxlength="60" value="${esc(me?.displayName || "")}" required></label>${avatarPicker(me?.avatar || "🌷")}<button class="btn primary wide" type="submit">Сохранить</button></form>`,
      );
      break;
    }
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
      swipeMode = state.tab === "build" ? "plan" : "discover";
      prepareSwipe();
      swipeView();
      break;
    case "swipe-mode":
      swipeMode = id;
      prepareSwipe();
      swipeView();
      break;
    case "swipe-random":
      prepareSwipe(true);
      swipeView();
      break;
    case "swipe-filter":
      sheet(
        `<h2>Какие идеи листаем?</h2><form id="swipe-filter-form"><label>Тема<select name="category">${categories
          .filter((c) => !["Сюрприз", "Бесплатно", "Быстро"].includes(c))
          .map(
            (c) =>
              `<option ${swipeFilters.category === c ? "selected" : ""}>${c}</option>`,
          )
          .join(
            "",
          )}</select></label><label>Место<select name="location"><option value="">Где угодно</option>${["Дома", "На улице"].map((c) => `<option ${swipeFilters.location === c ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Есть время<select name="minutes">${[
          [0, "Без ограничений"],
          [15, "15 минут"],
          [30, "Полчаса"],
          [60, "Час"],
          [120, "Два часа"],
        ]
          .map(
            ([v, n]) =>
              `<option value="${v}" ${swipeFilters.minutes === v ? "selected" : ""}>${n}</option>`,
          )
          .join(
            "",
          )}</select></label><label class="check-label"><input type="checkbox" name="free" ${swipeFilters.free ? "checked" : ""}>Бесплатно</label><button class="btn primary wide" type="submit">Листать подходящие</button></form>`,
      );
      break;
    case "swipe-back": {
      if (swipeBusy) break;
      let previous;
      while (swipeSeen.length && !previous) {
        const id = swipeSeen.pop();
        if (ideaById(id)) previous = id;
      }
      if (previous) {
        swipeDeck = swipeDeck.filter((id) => id !== previous);
        swipeDeck.unshift(previous);
        await persistSwipe();
        swipeView();
      }
      break;
    }
    case "swipe-next":
      await swipeAdvance(false);
      break;
    case "swipe-yes":
      await swipeAdvance(true);
      break;
    case "swipe-add":
      await action("add-plan", el);
      swipeSeen.push(swipeDeck.shift());
      await persistSwipe();
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
      game.order = sessionDeck(store, game.kind);
      game.builtAt = Date.now();
      game.markedIndex = -1;
      game.index = 0;
      game.phase = 0;
      game.score = 0;
      game.attempts = 0;
      gameView();
      break;
    case "game-phase":
      game.phase = Number(el.dataset.phase);
      gameView();
      break;
    case "mime-start":
      game.phase = 1;
      game.deadline = Date.now() + 45000;
      gameView();
      break;
    case "game-hit":
    case "game-miss":
      game.attempts = (game.attempts || 0) + 1;
      game.score = (game.score || 0) + (a === "game-hit" ? 1 : 0);
    case "next-question":
      game.phase = 0;
      game.prediction = "";
      game.index = (game.index || 0) + 1;
      while (
        game.index < game.order.length &&
        (playedHistory(store)[cardKey(game.order[game.index])] || 0) >
          game.builtAt
      )
        game.index++;
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
        `<h2>Ваша комната на двоих</h2><div class="pair-orbit">${store.users.map((u) => esc(u.avatar || "🪐")).join(" · ")}</div><p>${esc(state.status)}</p><p>Роли закреплены за участниками вашей комнаты. Новый телефон получает доступ только после подтверждения вторым человеком и сверки значков. При восстановлении прежние реакции и авторство остаются у той же роли.</p><p class="muted">Если оба устройства потеряют данные, восстановить их без сохранённой копии будет неоткуда. Для восстановления с партнёра один из прежних клиентов должен быть онлайн. Для входа нужна новая версия на обоих устройствах.</p>${btn("Исправить имена в комнате", "pair-names", "lavender wide")}`,
      );
      break;
    case "pair-names": {
      const me = store.users.find((u) => u.localUserId === userId),
        other = store.users.find((u) => u.localUserId !== userId);
      sheet(
        `<h2>Как вас зовут?</h2><p class="muted">Меняются только имена. Роли, сердечки и авторство сохраняются.</p><form id="pair-names-form"><label>Вы<input name="me" maxlength="60" required value="${esc(me?.displayName || "")}"></label>${other ? `<label>Ваш человек<input name="partner" maxlength="60" required value="${esc(other.displayName)}"></label>` : ""}<button class="btn primary wide" type="submit">Сохранить имена</button></form>`,
      );
      break;
    }
    case "approve-pair":
    case "deny-pair": {
      const target = document.querySelector("#admission-target")?.value;
      const resolve = approvalResolve;
      approvalResolve = null;
      approvalClient = null;
      closeSheet();
      resolve?.(a === "approve-pair" ? { target } : false);
      break;
    }
    case "game-records":
      party.showRecords();
      break;
    case "open-live-game":
      if (id) party.openTable(id);
      else party.open();
      break;
    case "end-empty-game":
      party.endEmpty(id);
      render();
      break;
    case "screen-game":
      state.screenKind = id;
      state.screenFrame = peer?.games?.get(id);
      render();
      break;
    case "screen-mode":
      closeSheet();
      state.screenOnly = true;
      state.screenFrame = peer?.lastGame;
      render();
      break;
    case "client-mode":
      state.screenOnly = false;
      render();
      break;
    case "fullscreen":
      if (!document.fullscreenElement)
        await document.documentElement.requestFullscreen?.();
      else await document.exitFullscreen?.();
      break;
    case "show-catalog":
      document
        .querySelector("#catalog")
        ?.scrollIntoView({ behavior: "smooth" });
      break;
    case "rooms":
      sheet(roomMenu(identityKey, roomId));
      break;
    case "switch-room":
      closeSheet();
      await enter(id);
      navigate("profile");
      break;
    case "new-room":
      party.reset();
      peer?.stop();
      store = null;
      roomId = null;
      state.draft = [];
      history.replaceState(null, "", location.pathname);
      closeSheet();
      render();
      break;
    case "confirm-pair-code":
    case "decline-pair-code": {
      const resolve = confirmCodeResolve;
      confirmCodeResolve = null;
      state.confirmCodePending = false;
      resolve?.(a === "confirm-pair-code");
      render();
      break;
    }
    case "retry-pair":
      peer?.restart();
      break;
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
      party.reset();
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
          "🌷",
          fresh,
          {
            capacity: Number(fields.capacity) || 2,
            requestedMode: fields.entryMode || "player",
          },
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
          image:
            fields.visualMode === "emoji"
              ? ""
              : fields.artwork || "./assets/magic.svg",
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
      case "swipe-filter-form":
        swipeFilters = {
          category: fields.category,
          location: fields.location,
          minutes: Number(fields.minutes),
          free: !!fields.free,
        };
        prepareSwipe(true);
        await persistSwipe();
        swipeView();
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
      case "pair-names-form": {
        if (
          !fields.me.trim() ||
          (fields.partner != null && !fields.partner.trim())
        )
          throw Error("Заполните имена");
        const other = store.users.find((u) => u.localUserId !== userId);
        await store.save("users", {
          id: `${roomId}:${userId}`,
          displayName: fields.me.trim(),
        });
        if (other)
          await store.save("users", {
            id: other.id,
            displayName: fields.partner.trim(),
          });
        roomAuth.record.roster = roomAuth.record.roster.map((r) => ({
          ...r,
          name: r.id === userId ? fields.me.trim() : fields.partner.trim(),
        }));
        await roomAuth.save();
        closeSheet();
        render();
        break;
      }
      case "profile-edit-form":
      case "profile-form":
        if (!fields.name.trim()) throw Error("Напишите ваше имя");
        await store.save("users", {
          id: `${roomId}:${userId}`,
          localUserId: userId,
          displayName: fields.name.trim(),
          avatar: fields.avatar,
        });
        state.profileDraft = null;
        if (form.id === "profile-form") render();
        if (form.id === "profile-edit-form") closeSheet();
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
      case "prediction-form":
        if (!fields.prediction.trim()) throw Error("Запишите прогноз");
        game.prediction = fields.prediction.trim();
        game.phase = 1;
        gameView();
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
  if (approvalResolve) {
    const resolve = approvalResolve;
    approvalResolve = null;
    resolve(false);
  }
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
  if (e.persisted && store) peer = new RoomPeer(store, setStatus, roomAuth);
});
try {
  db = await new Database("vmeste-" + userId).open();
  if (roomId) {
    const users = await db.all("users", roomId);
    const storedAuth = (await db.all("meta", roomId)).find(
      (r) => r.id === `${roomId}:auth`,
    );
    if (
      storedAuth ||
      users.some(
        (u) => u.localUserId === userId && !u.deletedAt && !u.provisional,
      )
    )
      await enter(roomId);
    else render();
  } else render();
} catch {
  app.innerHTML =
    '<main class="onboarding"><h1>Не получилось открыть хранилище</h1><p>Разрешите сайту сохранять данные и обновите страницу. Ваши идеи не будут потеряны из-за несохранённых изменений.</p><button class="btn primary" onclick="location.reload()">Попробовать снова</button></main>';
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
  if (swipeTouch) {
    const card = document.querySelector("#swipe-card");
    if (card) {
      const delta = e.clientX - swipeTouch.x;
      card.style.transform = `translateX(${delta}px) rotate(${delta / 22}deg)`;
    }
  }
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
        await swipeAdvance(e.clientX > t.x);
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
document.addEventListener(
  "scroll",
  (e) => {
    const feed = e.target;
    if (feed?.id !== "recommendation-feed" || feed.dataset.loading) return;
    if (feed.scrollLeft + feed.clientWidth < feed.scrollWidth - 180) return;
    feed.dataset.loading = "1";
    const start = state.feedStart || 0,
      count = state.feedCount || 10;
    feed.insertAdjacentHTML("beforeend", feedBatch(state, start + count, 10));
    state.feedCount = count + 10;
    if (state.feedCount > 40) {
      const width = feed.scrollWidth;
      for (let i = 0; i < 10; i++) feed.firstElementChild?.remove();
      state.feedStart = start + 10;
      state.feedCount -= 10;
      feed.scrollLeft -= width - feed.scrollWidth;
    }
    requestAnimationFrame(() => delete feed.dataset.loading);
  },
  true,
);
window.addEventListener("keydown", (e) => {
  if (
    document.querySelector("#swipe-card") &&
    !e.target.matches("input,textarea")
  ) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      swipeAdvance(false);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      swipeAdvance(true);
    }
  }
});

window.vmesteBeforeUpdate = async () => {
  if (store) {
    await historyQueue;
    await store.queue;
    await persistDraft();
  }
};

window.addEventListener("vmeste-game-view", (e) => {
  const incoming = e.detail;
  if (state.screenKind)
    state.screenFrame = peer?.games?.get(state.screenKind) || incoming;
  else if (
    !["soundgarden", "meditation"].includes(incoming.kind) ||
    !state.screenFrame ||
    ["soundgarden", "meditation"].includes(state.screenFrame.kind)
  )
    state.screenFrame = incoming;
  if (store?.authViewer || state.screenOnly) {
    const live = document.querySelector(".projector-live");
    if (live)
      live.innerHTML = screenTabs() + partyScreen(state.screenFrame, true);
    else render();
  }
});
