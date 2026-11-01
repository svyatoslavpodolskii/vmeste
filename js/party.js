import { updateSoundConnections } from "./sound-controls.js";
import { updateGamePresence } from "./game-protocol.js";
import { bindBeaconAssistant } from "./beacon-help.js";
import { poetryControls } from "./poetry.js";
import { assignedConstellations } from "./composition.js";
import { worldKinds, worldScreen } from "./worlds.js";
import { TURN_WORLD, turnScreen } from "./turn-games.js";
import {
  BEACON_RULES,
  initBeacon,
  beaconPublic,
  beaconSecret,
  beaconCommand,
} from "./beacon.js";
import {
  beaconHome,
  beaconScreen,
  beaconControls,
  beaconRecordView,
} from "./beacon-ui.js";
import {
  initCircuit,
  circuitCommand,
  circuitPublic,
  circuitSecret,
  circuitScreen,
  circuitControls,
  circuitHome,
  circuitRecordView,
  CIRCUIT_VERSION,
} from "./coop-circuit.js";
import {
  expeditionKinds,
  expeditionTitles,
  initExpedition,
  expeditionPublic,
  expeditionScreen,
  expeditionControls,
  expeditionSecret,
  expeditionCommand,
  nextIsland,
} from "./expedition.js";
import {
  nextFrequency,
  revealFrequency,
  frequencyCommand,
  frequencyPublic,
  frequencyScreen,
  frequencyControls,
} from "./frequency.js";
import {
  deckKinds,
  initDeck,
  deckPublic,
  deckCommand,
  deckScreen,
  deckControls,
  saveDeck,
  deckTitle,
} from "./deck-session.js";
import {
  arrangeMeditation,
  meditationVoices,
  soundControls,
  bindSoundControls,
  soundWorld,
  refreshSoundWorld,
} from "./sound-controls.js";
import { esc, icon, btn, sheet, toast, closeSheet, art } from "./ui.js";
import { NatureSound, soundLayers } from "./sound.js";
import { sessionDeck, cardKey, playedHistory } from "./game-pools.js";
export const partyKinds = [
  ...deckKinds,
  ...expeditionKinds,
  "museum",
  "frequency",
  "word",
  "poem",
  "draw",
  "beacon",
  "race",
  "meditation",
  "soundgarden",
];
export const partyTitles = {
  ...expeditionTitles,
  ...Object.fromEntries(deckKinds.map((k) => [k, deckTitle(k)])),
  museum: "Музей невозможного",
  frequency: "Секретная частота",
  word: "Созвучия",
  poem: "Стих по кусочкам",
  draw: "Нарисуй — объясни",
  beacon: "Зажечь маяк",
  race: "Светлячки наперегонки",
  meditation: "Общая тишина",
  soundgarden: "Сад звука",
};
const runes = ["🌱", "🌊", "☀️", "⭐"];
const pictureWords = [
  "Летающий чайник",
  "Кот-космонавт",
  "Велосипед для осьминога",
  "Дом на облаке",
  "Танцующий кактус",
  "Пиратская кофейня",
  "Сонный дракон",
  "Робот с букетом",
  "Лунный пикник",
  "Маяк на черепахе",
  "Зонт для жирафа",
  "Библиотека в лесу",
];
const museumActors = [
  "Кот",
  "Робот",
  "Пингвин",
  "Дракон",
  "Кактус",
  "Чайник",
  "Пират",
  "Волшебник",
  "Осьминог",
  "Будильник",
  "Снеговик",
  "Динозавр",
];
const museumActions = [
  "спит",
  "танцует",
  "в шляпе",
  "под зонтом",
  "на самокате",
  "ест мороженое",
  "в ванной",
  "держит шарик",
  "с крыльями",
  "на Луне",
  "читает книгу",
  "ловит рыбу",
];

function museumPrompt(store, used = []) {
  const history = playedHistory(store);
  return (
    museumActors
      .flatMap((actor) => museumActions.map((action) => actor + " " + action))
      .filter((t) => !used.includes(t))
      .map((text) => ({
        text,
        time: history[cardKey("Музей: " + text)] || 0,
        r: Math.random(),
      }))
      .sort((a, b) => a.time - b.time || a.r - b.r)[0]?.text ||
    "Кот ремонтирует радугу"
  );
}
function sketch(lines) {
  return `<svg viewBox="0 0 1000 700" role="img" aria-label="Рисунок экспоната">${(Array.isArray(
    lines,
  )
    ? lines
    : []
  )
    .slice(0, 900)
    .map(
      (l) =>
        `<path d="M${clamp(l[0], 0, 1000)} ${clamp(l[1], 0, 700)}L${clamp(l[2], 0, 1000)} ${clamp(l[3], 0, 700)}" stroke="${["#6b527f", "#ed7798", "#5c9b8a", "#ce9b4b"][clamp(l[4], 0, 3)]}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
    )
    .join("")}</svg>`;
}
function thumbnail(lines) {
  const step = Math.max(1, Math.ceil(lines.length / 300)),
    out = [];
  let start = null,
    last = null,
    color = 0,
    count = 0;
  const flush = () => {
    if (start && last)
      out.push([...start, ...last, color].map((v) => Math.round(v)));
    start = null;
    count = 0;
  };
  for (const l of lines) {
    if (last && (l[0] !== last[0] || l[1] !== last[1] || l[4] !== color))
      flush();
    if (!start) {
      start = [l[0], l[1]];
      color = l[4];
    }
    last = [l[2], l[3]];
    count++;
    if (count >= step) flush();
  }
  flush();
  return out.filter(
    (_, index) => index % Math.max(1, Math.ceil(out.length / 300)) === 0,
  );
}
function museumScreen(f, p, players) {
  const ranked = [...players].sort(
    (a, b) => (p.scores?.[b.id] || 0) - (p.scores?.[a.id] || 0),
  );
  if (f.finished)
    return `<div class="museum-finale"><div class="museum-podium">${ranked.map((u, i) => `<div class="${(p.scores?.[u.id] || 0) === (p.scores?.[ranked[0]?.id] || 0) ? "museum-leader" : ""}"><span>${(p.scores?.[u.id] || 0) === (p.scores?.[ranked[0]?.id] || 0) ? "👑" : esc(u.avatar)}</span><strong>${esc(u.name)}</strong><b>${p.scores?.[u.id] || 0} очков</b></div>`).join("")}</div><h3>Ваша невозможная коллекция</h3><div class="museum-gallery">${(p.gallery || []).map((g) => `<article><div>${sketch(g.lines)}</div><h4>${esc(g.title)}</h4><small>Художник: ${esc(g.artist)}</small></article>`).join("")}</div></div>`;
  return `<div class="museum-room"><span class="museum-kicker">ЗАЛ ${String((p.turn || 0) + 1).padStart(2, "0")} / ${p.totalRounds}</span><div class="museum-frame">${sketch(p.lines)}</div>${p.phase === "reveal" ? `<div class="museum-true-title"><span>НАСТОЯЩЕЕ НАЗВАНИЕ</span><h3>${esc(p.secret)}</h3><p>Автор рисунка: ${esc(players.find((u) => u.id === p.drawer)?.name || "")}</p></div>` : `<div class="museum-mystery-title">${p.phase === "draw" ? "Пока экспонат рождается…" : p.phase === "captions" ? "Как назовут этот шедевр?" : "Какое название настоящее?"}</div>`}${
    p.phase === "vote" || p.phase === "reveal"
      ? `<div class="museum-options">${(p.choices || [])
          .map(
            (c, i) =>
              `<div class="museum-option ${p.phase === "reveal" && c.id === p.correct ? "museum-correct" : ""}"><span>${String.fromCharCode(65 + i)}</span><strong>${esc(c.text)}</strong>${
                p.phase === "reveal"
                  ? `<small>${
                      c.id === p.correct
                        ? "Оригинал художника"
                        : (p.authors?.[c.id] || [])
                            .map((id) => players.find((u) => u.id === id)?.name)
                            .filter(Boolean)
                            .join(", ") || "Из фондов музея"
                    } · ${p.tallies?.[c.id] || 0} голосов</small>`
                  : ""
              }</div>`,
          )
          .join("")}</div>`
      : ""
  }${p.phase === "reveal" ? `<div class="museum-score-strip">${ranked.map((u) => `<span>${esc(u.avatar)} ${esc(u.name)} <b>${p.scores?.[u.id] || 0}</b>${p.gains?.[u.id] ? ` <small>+${p.gains[u.id]}</small>` : ""}</span>`).join("")}</div>` : ""}</div>`;
}
const clamp = (n, min = 0, max = 1) =>
  Math.max(min, Math.min(max, Number(n) || 0));
const timer = (f) =>
  `<span class="elapsed" data-elapsed="${f.finished ? "fixed" : "live"}" data-base="${Number(f.elapsed) || 0}" data-seen="${performance.now()}">${((f.elapsed || 0) / 1000).toFixed(1)} с</span>`;
export function partyScreen(f, screen = false) {
  if (!f) return "<p>Выберите игру на телефоне.</p>";
  if (worldKinds.includes(f.kind)) return worldScreen(f);
  if (f.kind === TURN_WORLD) return turnScreen(f);
  if (f.kind === "exhibitworld")
    return f.public?.recordKind === "draw"
      ? `<section class="museum-finale"><h2>Наши рисунки</h2><div class="museum-gallery">${(f.public.gallery || []).map((g) => `<article><div class="museum-frame">${sketch(g.lines)}</div><h3>${esc(g.title || "Без названия")}</h3><p>${esc(g.artist || "Художник")}</p></article>`).join("")}</div></section>`
      : f.public?.recordKind === "museum"
        ? partyScreen({ ...f, kind: "museum" }, screen)
        : "<p>Сохранённая выставка</p>";
  const p = f.public || {},
    players = Array.isArray(p.players) ? p.players.slice(0, 10) : [];
  let body = "";
  if (p.paused && !f.finished)
    return `<section class="session-done"><span class="eyebrow">МОЖНО НЕ ТОРОПИТЬСЯ</span><h2>${esc(f.title)}</h2><p>Пауза: ${players
      .filter((u) => p.away?.includes(u.id))
      .map((u) => esc(u.name))
      .join(
        ", ",
      )} отошёл. Вернитесь в приложение — продолжим с того же места.</p></section>`;
  if (f.stage === "lobby" && f.finished)
    return `<section class="session-done"><span class="eyebrow">СТОЛ ЗАКРЫТ</span><h2>${esc(f.title)}</h2><p>Эта партия завершена. Можно открыть новую игру из библиотеки.</p></section>`;
  if (f.stage === "lobby")
    return `<section class="table-lobby"><span class="eyebrow">СОБИРАЕМСЯ ЗА ОДНИМ СТОЛОМ</span><h2>${esc(f.title)}</h2><p>Игра начнётся, когда присоединятся минимум ${p.minPlayers || 2} участника и все нажмут «Готов».</p><div class="lobby-players">${players.map((u) => `<div class="${p.readyPlayers?.includes(u.id) ? "is-ready" : ""}"><span>${esc(u.avatar)}</span><strong>${esc(u.name)}</strong><small>${p.away?.includes(u.id) ? "Отошёл" : p.readyPlayers?.includes(u.id) ? "Готов" : p.joined?.includes(u.id) ? "В комнате" : "Приглашён"}</small></div>`).join("")}</div>${p.needsUpdate?.length ? `<div class="lobby-update"><span>${icon("settings")}</span><div><strong>Нужно обновить приложение</strong><p>На устройствах: ${p.needsUpdate.map(esc).join(", ")}. Откройте «Настройки» → «Обновление», затем вернитесь к столу. Ответы и история сохранятся.</p></div></div>` : ""}<p class="fine">${p.requiresScreen ? `${p.screenCount ? "Общий экран подключён" : "Подключите ПК как общий экран — это часть игры"}` : "Один общий стол · одинаковые лобби объединяются автоматически"}</p></section>`;
  if (f.kind === "race" && p.rulesVersion === CIRCUIT_VERSION)
    return circuitScreen(f, screen);
  if (f.kind === "beacon" && p.rulesVersion === BEACON_RULES)
    return beaconScreen(f, screen);
  else if ([...expeditionKinds, "race", "beacon"].includes(f.kind))
    body = expeditionScreen(f, screen);
  else if (deckKinds.includes(f.kind)) body = deckScreen(f);
  else if (f.kind === "frequency") body = frequencyScreen(f);
  else if (f.kind === "museum") body = museumScreen(f, p, players);
  else if (f.kind === "race")
    body = `<div class="race-track">${players.map((u) => `<div class="race-lane"><span>${esc(u.name)}</span><div class="race-road"><b style="left:${clamp((p.positions?.[u.id] || 0) / 30) * 87}%">${esc(u.avatar || "✨")}</b><i>⚑</i></div><small>${p.times?.[u.id] ? `${(p.times[u.id] / 1000).toFixed(1)} с` : "Левый · правый · левый"}</small></div>`).join("")}</div>`;
  else if (f.kind === "draw")
    body = `<div class="drawing-screen"><svg viewBox="0 0 1000 700" role="img" aria-label="Общий рисунок">${(
      p.lines || []
    )
      .slice(0, 900)
      .map(
        (l) =>
          `<path d="M${clamp(l[0], 0, 1000)} ${clamp(l[1], 0, 700)}L${clamp(l[2], 0, 1000)} ${clamp(l[3], 0, 700)}" stroke="${["#6b527f", "#ed7798", "#5c9b8a", "#ce9b4b"][clamp(l[4], 0, 3)]}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
      )
      .join(
        "",
      )}</svg></div><p class="guess-line">${esc(p.lastGuess || "Объясняйте рисунком. Остальные угадывают.")}</p>`;
  else if (f.kind === "beacon")
    body = `<div class="beacon ${f.finished ? "beacon-lit" : ""}"><div class="beacon-lantern">${f.finished ? "🌟" : "🏮"}</div><div class="rune-rings">${(p.wheels || []).map((n, i) => `<span class="${p.aligned?.[i] ? "aligned" : ""}"><small>${i + 1}</small>${runes[clamp(n, 0, 3)]}</span>`).join("")}</div><p>${f.finished ? "Маяк горит. Вы нашли общий язык." : "Один видит подсказку, другой поворачивает кольцо."}</p></div>`;
  else if (f.kind === "word")
    body = p.revealed
      ? `<div class="association-cloud">${Object.values(p.answers || {})
          .map((a) => `<span>${esc(a)}</span>`)
          .join("")}</div>`
      : `<div class="hidden-answers">${players.map((u, i) => `<span class="${p.ready?.includes(u.id) ? "answer-ready" : ""}" style="--n:${i}">${p.ready?.includes(u.id) ? "✦" : "?"}</span>`).join("")}</div>`;
  else if (f.kind === "poem")
    body = p.revealed
      ? `<div class="poem-sheet">${esc(p.poem || "").replaceAll("\n", "<br>")}</div>`
      : `<div class="poem-sealed">${players.map((player) => `<div class="poem-envelope ${p.readyPlayers?.includes(player.id) ? "ready" : ""}"><span>${p.readyPlayers?.includes(player.id) ? icon("check") : icon("letter")}</span><strong>${esc(player.name)}</strong><small>${p.readyPlayers?.includes(player.id) ? "Слова готовы" : "Выбирает слова"}</small></div>`).join("")}</div>`;
  else if (["meditation", "soundgarden"].includes(f.kind)) body = soundWorld(f);
  else body = "";
  return `<section class="party-public party-${esc(f.kind)}"><h2>${esc(f.title)}</h2>${deckKinds.includes(f.kind) ? "" : `<p class="party-prompt">${esc(f.text)}</p>`}${body}<div class="party-progress">${esc(f.progress || "")}${f.kind === "draw" ? timer(f) : ""}</div></section>`;
}
export class PartyGames {
  constructor(options) {
    this.options = options;
    this.deviceId =
      localStorage.getItem("vmeste-device") || crypto.randomUUID();
    localStorage.setItem("vmeste-device", this.deviceId);
    this.secrets = new Map();
    this.frame = null;
    this.state = null;
    this.opened = false;
    this.invited = new Set();
    this.tables = new Map();
    this.audioFrame = null;
    this.drafts = new Map();
    this.markQueue = Promise.resolve();
    document.addEventListener("visibilitychange", () => {
      if (this.opened && this.frame && !this.frame.finished)
        this.input({
          action: "presence",
          active: document.visibilityState === "visible",
        });
    });
    window.addEventListener("vmeste-peer-ready", () => this.restore());
    window.addEventListener("vmeste-game-connected", () => {
      if (this.state && this.hosting) {
        this.broadcast();
        this.privateInstructions();
      }
      if (this.opened && this.frame && document.querySelector("#party-panel"))
        this.input({ action: "join" });
    });
    window.addEventListener("vmeste-game-view", (e) => this.receive(e.detail));
    window.addEventListener("vmeste-game-disconnected", (event) => {
      for (const table of this.tables.values())
        if (
          table.state &&
          !table.frame.finished &&
          table.state.joined?.includes(event.detail.member)
        )
          this.command(event.detail.member, {
            round: table.frame.round,
            action: "presence",
            active: false,
          });
    });
    window.addEventListener("vmeste-game-input", (e) =>
      this.command(e.detail.sender, e.detail.input),
    );
    window.addEventListener("vmeste-game-capabilities", () => {
      if (this.hosting && this.state?.stage === "lobby") this.broadcast();
    });
    window.addEventListener("vmeste-game-private", (e) => {
      const p = e.detail;
      if (p) {
        this.secrets.set(p.round + ":" + (p.turn || 0), p);
        if (this.opened && p.round === this.frame?.round)
          this.render(
            !(
              this.frame.kind === "beacon" &&
              p.role === "guide" &&
              document.querySelector("[data-beacon-assistant]")
            ),
          );
      }
    });
    document.addEventListener("click", (e) => {
      const button = e.target.closest("[data-party]");
      if (button) this.action(button.dataset.party, button);
    });
    document.addEventListener("submit", (e) => {
      if (e.target.id === "party-answer-form") {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(e.target));
        this.drafts.set(
          this.frame.round + ":" + (this.frame.public.turn || 0),
          values,
        );
        this.input({
          action: "answer",
          values,
          turn: this.frame.public.turn || 0,
        });
        const note = e.target.querySelector(".answer-note");
        if (note)
          note.textContent = "Ответ отправлен. Можно изменить до открытия.";
      }
    });
    document.addEventListener("input", (e) => {
      const form = e.target.closest("#party-answer-form");
      if (form && this.frame)
        this.drafts.set(
          this.frame.round + ":" + (this.frame.public.turn || 0),
          Object.fromEntries(new FormData(form)),
        );
      if (e.target.matches("[data-frequency-slider]")) {
        const output = document.querySelector(".frequency-reading");
        if (output) output.textContent = e.target.value;
      }
      if (e.target.matches("[data-sound-mood]")) {
        clearTimeout(this.moodTimer);
        const value = e.target.value,
          index = Number(e.target.dataset.soundMood);
        this.moodTimer = setTimeout(
          () => this.input({ action: "mood", index, value }),
          80,
        );
      }
      if (e.target.matches("[data-sound-volume]"))
        this.audio?.volume(Number(e.target.value));
    });
    document.querySelector("#sheet").addEventListener("close", () => {
      this.opened = false;
      document.querySelector("#sheet").classList.remove("game-expanded");
      for (const stop of this.soundCleanup || []) stop();
      this.soundCleanup = [];
      this.player();
    });
    new MutationObserver(() => this.player()).observe(
      document.querySelector("#sheet"),
      { attributes: true, attributeFilter: ["open"] },
    );
    this.ticker = setInterval(() => {
      if (this.hosting && this.state?.stage === "lobby" && this.beginIfReady())
        this.broadcast();
      for (const el of document.querySelectorAll("[data-countdown]"))
        el.textContent = Math.max(
          0,
          Math.ceil((Number(el.dataset.countdown) - Date.now()) / 1000),
        );
      for (const el of document.querySelectorAll('[data-elapsed="live"]'))
        el.textContent =
          (
            (Number(el.dataset.base) +
              performance.now() -
              Number(el.dataset.seen)) /
            1000
          ).toFixed(1) + " с";
    }, 150);
  }
  get store() {
    return this.options.store();
  }
  get peer() {
    return this.options.peer();
  }
  get userId() {
    return this.store?.userId;
  }
  get hosting() {
    return (
      this.state?.round === this.frame?.round &&
      this.frame?.controllerClient === this.peer?.peer?.id
    );
  }
  reset() {
    this.audio?.destroy();
    this.audio = null;
    this.player();
    document.body.classList.remove("has-player");
    this.state = null;
    this.frame = null;
    this.audioFrame = null;
    this.tables.clear();
    this.opened = false;
    this.secrets.clear();
  }
  start(kind, launch = {}) {
    if (kind === "museum" && (this.store.authCapacity || 2) < 3) {
      sheet(
        `<div class="game-invitation"><span class="invitation-symbol">${icon("gallery")}</span><span class="eyebrow">ОТ ТРЁХ ИГРОКОВ</span><h2>Музей для компании</h2><p>Здесь нужны художник и хотя бы два автора выдуманных табличек. Вдвоём блеф не работает — поэтому эта коробка доступна в комнате для компании.</p><p>Для двоих есть рисование с угадыванием вслух.</p><button class="btn primary wide" data-action="play" data-id="draw">Нарисуй и объясни</button></div>`,
      );
      return;
    }
    if (kind === "race" && !launch.circuit) {
      this.circuitMenu();
      return;
    }
    if (kind === "beacon" && !launch.beacon) {
      this.beaconMenu();
      return;
    }
    if (
      ["race", "beacon"].includes(kind) &&
      (launch.circuit || launch.beacon) &&
      this.tables.get(kind)?.frame.public.rulesVersion !== CIRCUIT_VERSION
    ) {
      const old = this.tables.get(kind)?.frame;
      if (old && !old.finished) {
        if (old.controller !== this.userId) {
          sheet(
            `<h2>В комнате прежняя партия</h2><p>Сначала обновите приложение у ведущего и завершите старый стол. Новая коробка использует другие правила.</p><button class="btn primary wide" data-party="${kind === "beacon" ? "beacon-home" : "circuit-home"}">Проверить снова</button>`,
          );
          return;
        }
        const closed = {
          ...old,
          finished: true,
          closedAt: Date.now(),
          revision: (old.revision || 0) + 1,
          ownerDevice: old.ownerDevice || this.deviceId,
        };
        this.peer?.publishGame(closed);
        this.options.onInvite?.(closed);
      }
      this.tables.delete(kind);
      if (this.frame?.kind === kind) {
        this.frame = null;
        this.state = null;
      }
    }
    if (this.frame?.kind === kind && !this.frame.finished) {
      this.open();
      return;
    }
    if (this.frame)
      this.tables.set(this.frame.kind, {
        frame: this.frame,
        state: this.state,
      });
    const table = this.tables.get(kind);
    if (table && !table.frame.finished) {
      this.frame = table.frame;
      this.state = table.state;
      this.open();
      return;
    }
    this.retireHostedExcept(kind);
    if (
      ["soundgarden", "meditation"].includes(kind) &&
      this.audioFrame?.kind !== kind
    ) {
      this.audio?.destroy();
      this.audio = null;
      this.audioFrame = null;
      this.player();
    }
    const online = this.peer?.onlineMembers() || new Set([this.userId]);
    const players = this.store.authRoster
      .filter((r) => online.has(r.id))
      .map((r) => ({
        id: r.id,
        name:
          this.store.data.users.find(
            (u) => u.localUserId === r.id && !u.deletedAt,
          )?.displayName || r.name,
        avatar:
          this.store.data.users.find((u) => u.localUserId === r.id)?.avatar ||
          "✨",
      }));
    if (!players.length)
      players.push({ id: this.userId, name: "Вы", avatar: "✨" });
    const s = (this.state = {
      kind,
      ownerDevice: this.deviceId,
      runLength: launch.length || 8,
      beaconLength: launch.length || 6,
      round: crypto.randomUUID(),
      players,
      started: 0,
      createdAt: Date.now(),
      stage: "lobby",
      joined: [this.userId],
      readyPlayers: [],
      revision: 0,
      phase: "play",
      answers: {},
      moves: 0,
    });
    if (deckKinds.includes(kind)) initDeck(s, this.store);
    if (kind === "frequency") {
      Object.assign(s, {
        turn: 0,
        totalRounds: Math.max(4, players.length),
        usedAxes: [],
        log: [],
        score: 0,
      });
      nextFrequency(s, this.store);
      this.mark("Частота: " + s.axis.join(" · "));
    }
    if (kind === "museum") {
      Object.assign(s, {
        turn: 0,
        totalRounds: players.length === 2 ? 4 : players.length,
        phase: "draw",
        lines: [],
        drawer: players[0].id,
        secret: museumPrompt(this.store),
        captions: {},
        votes: {},
        choices: [],
        scores: Object.fromEntries(players.map((u) => [u.id, 0])),
        gallery: [],
        usedPrompts: [],
      });
    }
    if (kind === "word") {
      initDeck(s, this.store);
      s.prompt =
        s.deck.order[s.deck.index] ||
        sessionDeck(this.store, "word")[0] ||
        "Что сделало бы этот вечер чуть лучше?";
      this.mark(s.prompt);
    }
    if (kind === "poem") {
      s.slots = Array.from(
        { length: Math.max(4, players.length) },
        (_, i) =>
          [
            "Предмет или существо",
            "Прилагательное",
            "Глагол: что делать?",
            "Место",
          ][i % 4],
      );
    }
    if (kind === "race") {
      s.positions = {};
      s.times = {};
      s.sides = {};
      s.taps = {};
    }
    if (kind === "draw") {
      s.turn = 0;
      s.lines = [];
      s.secret = pictureWords[Math.floor(Math.random() * pictureWords.length)];
      s.drawer = players[0].id;
      s.totalTurns = Math.min(players.length, 4);
    }
    if (["meditation", "soundgarden"].includes(kind))
      s.contributors = Object.fromEntries(
        players.map((u) => [
          u.id,
          {
            layers: [1, 1, 1, 0, 0, 0, 0, 0],
            moods: [0.55, 0.3, 0.6, 0.7],
            pads: [
              [0.25, 0.35],
              [0.7, 0.35],
              [0.35, 0.7],
              [0.75, 0.75],
            ],
          },
        ]),
      );
    if (kind === "meditation") arrangeMeditation(s);
    if (kind === "race") initCircuit(s);
    if (kind === "beacon") initBeacon(s);
    if (expeditionKinds.includes(kind)) initExpedition(s);
    this.broadcast();
    this.open();
  }
  mark(item) {
    if (!item) return;
    this.markQueue = this.markQueue
      .then(async () => {
        const store = this.store,
          id = `${store.roomId}:history:${store.userId}`,
          old = store.data.plans.find((p) => p.id === id);
        await store.save("plans", {
          id,
          title: "История игр",
          items: [],
          historyOwner: store.userId,
          played: { ...(old?.played || {}), [cardKey(item)]: Date.now() },
        });
      })
      .catch(() => toast("Не удалось сохранить историю игры"));
  }
  restore() {
    if (!this.store?.authEstablished || this.store.authViewer) return;
    if (this.state) {
      if (this.frame?.controller === this.userId) {
        if (
          ["race", "beacon"].includes(this.state.kind) &&
          this.state.rulesVersion !== 2
        ) {
          Object.assign(this.state, {
            finished: true,
            closedAt: Date.now(),
            stage: "lobby",
            joined: [],
            readyPlayers: [],
          });
          this.broadcast();
          return;
        }
        this.broadcast();
        this.privateInstructions();
      }
      return;
    }
    const owned = [...this.tables.values()].find(
      (t) =>
        t.state &&
        !t.state.finished &&
        t.frame.ownerDevice === this.deviceId &&
        t.frame.controller === this.userId,
    );
    if (owned) {
      const current = {
        state: this.state,
        frame: this.frame,
        opened: this.opened,
      };
      this.state = owned.state;
      this.frame = owned.frame;
      this.opened = false;
      this.backgroundDispatch = true;
      try {
        this.broadcast();
        this.privateInstructions();
      } finally {
        this.state = current.state;
        this.frame = current.frame;
        this.opened = current.opened;
        this.backgroundDispatch = false;
      }
      return;
    }
    let saved;
    try {
      saved = JSON.parse(
        localStorage.getItem(
          `vmeste:session:${this.store.roomId}:${this.userId}`,
        ),
      );
    } catch {}
    if (
      saved &&
      !saved.finished &&
      partyKinds.includes(saved.kind) &&
      saved.players?.some((u) => u.id === this.userId)
    ) {
      this.state = saved;
      if (["race", "beacon"].includes(saved.kind) && saved.rulesVersion !== 2) {
        Object.assign(this.state, {
          finished: true,
          closedAt: Date.now(),
          stage: "lobby",
          joined: [],
          readyPlayers: [],
        });
        this.broadcast();
        return;
      }
      this.broadcast();
      this.privateInstructions();
    }
  }

  publicFrame() {
    const frame = this.buildPublicFrame();
    return {
      ...frame,
      startedAt: this.state.started || 0,
      public: {
        ...frame.public,
        paused: !!this.state.pausedAt,
        away: this.state.away || [],
        closedBy: this.state.closedBy,
      },
      elapsed:
        this.state.pausedAt && this.state.started
          ? this.state.pausedAt - this.state.started
          : frame.elapsed,
      ownerDevice: this.state.ownerDevice || this.deviceId,
      closedAt: this.state.closedAt || 0,
    };
  }
  buildPublicFrame() {
    const s = this.state,
      p = {
        players: s.players,
        solo: !!s.solo,
        joined: s.joined,
        readyPlayers: s.readyPlayers,
        away: s.away || [],
        turn: s.turn || 0,
        historyDepth: s.past?.length || 0,
      };
    if (s.stage === "lobby")
      return {
        kind: s.kind,
        round: s.round,
        title: partyTitles[s.kind],
        text: "Ждём готовности участников",
        progress: "",
        stage: "lobby",
        finished: !!s.finished,
        invitedAt: s.invitedAt || 0,
        createdAt: s.createdAt,
        revision: s.revision,
        public: {
          rulesVersion: s.rulesVersion,
          runLength: s.runLength,
          players: s.players,
          joined: s.joined,
          readyPlayers: s.readyPlayers,
          away: s.away || [],
          requiresScreen: s.kind === "rift",
          minPlayers: s.kind === "museum" ? 3 : 2,
          needsUpdate: this.peer?.gameCompatibility?.(2) || [],
          screenCount: this.peer?.onlineDisplays?.() || 0,
        },
        controller: this.userId,
        controllerClient: this.peer?.peer?.id,
        elapsed: 0,
      };
    if (s.kind === "race" && s.rulesVersion === CIRCUIT_VERSION)
      return {
        kind: s.kind,
        round: s.round,
        title: partyTitles.race,
        text: s.trial.instruction,
        stage: s.stage,
        createdAt: s.createdAt,
        revision: s.revision,
        public: { ...circuitPublic(s), players: s.players, joined: s.joined },
        controller: this.userId,
        controllerClient: this.peer?.peer?.id,
        finished: !!s.finished,
        elapsed: s.finished ? s.elapsed : Date.now() - s.started,
      };
    if (s.kind === "beacon" && s.rulesVersion === BEACON_RULES)
      return {
        kind: s.kind,
        round: s.round,
        title: partyTitles.beacon,
        text: s.module.task,
        stage: s.stage,
        createdAt: s.createdAt,
        revision: s.revision,
        public: { ...beaconPublic(s), players: s.players, joined: s.joined },
        controller: this.userId,
        controllerClient: this.peer?.peer?.id,
        finished: !!s.finished,
        elapsed: s.finished ? s.elapsed : Date.now() - s.started,
      };
    if ([...expeditionKinds, "race", "beacon"].includes(s.kind))
      return {
        kind: s.kind,
        round: s.round,
        title: partyTitles[s.kind],
        text: "Разные пульты. Одна общая история.",
        stage: s.stage,
        createdAt: s.createdAt,
        revision: s.revision,
        public: { ...expeditionPublic(s), joined: s.joined },
        controller: this.userId,
        controllerClient: this.peer?.peer?.id,
        finished: !!s.finished,
        elapsed: s.finished ? s.elapsed : Date.now() - s.started,
      };
    let text = "",
      progress = "";
    if (deckKinds.includes(s.kind)) {
      Object.assign(p, deckPublic(s));
      p.turn = s.deck.index;
      text = p.card || "Выберите карточку";
    }
    if (s.kind === "museum") {
      text = s.finished
        ? "Коллекция, которую могли придумать только вы."
        : s.phase === "draw"
          ? `${s.players.find((u) => u.id === s.drawer)?.name} создаёт экспонат. Задание видно только художнику.`
          : s.phase === "captions"
            ? "Придумайте название, которое кажется настоящим. Ваше имя пока останется тайной."
            : s.phase === "vote"
              ? "Найдите оригинальное название и не попадитесь на чужую выдумку."
              : "Развешиваем таблички и раскрываем ваши хитрости.";
      Object.assign(p, {
        phase: s.phase,
        drawer: s.drawer,
        turn: s.turn,
        totalRounds: s.totalRounds,
        lines: s.finished ? [] : s.lines,
        ready: Object.keys(s.captions).length,
        voted: Object.keys(s.votes),
        scores: s.scores,
      });
      progress =
        s.phase === "captions"
          ? `${p.ready} / ${s.players.length - 1} названий`
          : s.phase === "vote"
            ? `${p.voted.length} / ${s.voters.length} голосов`
            : `${Math.min(s.turn + 1, s.totalRounds)} / ${s.totalRounds} залов`;
      if (["vote", "reveal"].includes(s.phase))
        p.choices = s.choices.map((c) => ({ id: c.id, text: c.text }));
      if (s.phase === "reveal" || s.finished)
        Object.assign(p, {
          secret: s.secret,
          correct: s.correct,
          authors: s.owners,
          tallies: s.tallies,
          gains: s.gains,
        });
      if (s.finished) p.gallery = s.gallery;
    }
    if (s.kind === "frequency") {
      Object.assign(p, frequencyPublic(s));
      text = s.finished
        ? "Вы научились слышать друг друга чуть точнее."
        : "Один образ. Разные ощущения. Одна общая частота.";
      progress = `${s.turn + 1} / ${s.totalRounds} волн · общее созвучие ${s.score || 0}/100`;
    }
    if (s.kind === "word") {
      text = String(s.prompt);
      p.readyPlayers = s.readyPlayers;
      p.revealed = s.phase === "reveal";
      p.ready = Object.keys(s.answers);
      if (p.revealed) p.answers = s.answers;
      progress = `${p.ready.length} / ${s.players.length} ответов`;
    }
    if (s.kind === "poem") {
      text = "Каждый добавляет слово. Вместе получается нечто большее.";
      p.readyPlayers = s.readyPlayers;
      p.revealed = s.phase === "reveal";
      p.ready = Object.keys(s.answers).length;
      p.total = s.slots.length;
      if (p.revealed) {
        const w = s.slots.map((_, i) => s.answers[i] || "тишина");
        p.poem =
          `Сегодня наш пароль — «${w[0]}».\nНаш свет — ${w[1]}.\nМы будем ${w[2]},\nИ встретимся там, где «${w[3]}».` +
          w
            .slice(4)
            .map(
              (v, i) =>
                `\nИ ${i % 2 ? "эхо" : "слово"} «${v}» останется с нами.`,
            )
            .join("");
      }
    }
    if (s.kind === "race") {
      text = s.finished
        ? "Огни дошли до финиша!"
        : "Чередуйте левую и правую кнопку. Каждый шаг приближает ваш огонёк.";
      p.positions = s.positions;
      p.times = s.times;
      progress = "30 шагов · без лимита времени";
    }
    if (s.kind === "draw") {
      text = s.finished
        ? "Все истории угаданы"
        : `Рисует ${s.players.find((u) => u.id === s.drawer)?.name || "участник"} · ход ${s.turn + 1} / ${s.totalTurns}`;
      p.lines = s.lines;
      p.drawer = s.drawer;
      p.turn = s.turn;
      p.solved = s.solved;
      if (s.solved) p.solution = s.secret;
      p.lastGuess = s.lastGuess;
      progress = s.solved
        ? `${s.skipped ? "Пропустили" : "Угадали"}: ${s.secret}`
        : "У каждого свой взгляд. Никаких штрафов за время.";
    }
    if (s.kind === "beacon") {
      text = s.finished
        ? "Вы зажгли маяк"
        : "Говорите друг с другом. Подсказки на одном телефоне управляют кольцами другого.";
      p.wheels = s.wheels;
      p.aligned = s.wheels.map(() => !!s.finished);
      progress = `${s.moves} поворотов`;
    }
    if (["meditation", "soundgarden"].includes(s.kind)) {
      text =
        s.kind === "meditation"
          ? "Настройте настроение — пусть звуковой пейзаж дышит рядом."
          : "Восемь слоёв на каждом телефоне. Партии разные, влияние общее.";
      p.contributors = s.contributors;
      p.musicShift = s.musicShift || 0;
      p.audioPaused = !!s.audioPaused;
      p.warmth =
        Object.values(s.contributors).reduce((n, c) => n + c.moods[0], 0) /
        s.players.length;
    }
    return {
      kind: s.kind,
      stage: s.stage,
      createdAt: s.createdAt,
      revision: s.revision,
      round: s.round,
      title: partyTitles[s.kind],
      text,
      progress,
      public: p,
      finished: !!s.finished,
      elapsed: s.finished ? s.elapsed : Date.now() - s.started,
      controller: this.userId,
      controllerClient: this.peer?.peer?.id,
    };
  }
  broadcast() {
    if (this.state.finished && !this.state.closedAt)
      this.state.closedAt = Date.now();
    this.state.revision = (this.state.revision || 0) + 1;
    if (this.state.kind === "race")
      try {
        localStorage.setItem(
          `vmeste:circuit:${this.store.roomId}:${this.userId}`,
          JSON.stringify(this.state),
        );
      } catch {}
    if (this.state.kind === "beacon")
      try {
        localStorage.setItem(
          `vmeste:beacon:${this.store.roomId}:${this.userId}`,
          JSON.stringify(this.state),
        );
      } catch {}
    if (!this.backgroundDispatch)
      try {
        localStorage.setItem(
          `vmeste:session:${this.store.roomId}:${this.userId}`,
          JSON.stringify(this.state),
        );
      } catch {}
    this.frame = this.publicFrame();
    this.tables.set(this.frame.kind, { frame: this.frame, state: this.state });
    if (
      ["soundgarden", "meditation"].includes(this.frame.kind) &&
      this.audioFrame?.kind === this.frame.kind
    )
      this.audioFrame = this.frame;
    this.peer?.publishGame(this.frame);
    this.applyAudioState(this.frame);
    if (!this.backgroundDispatch) this.options.onFrame?.(this.frame);
    else this.options.onInvite?.(this.frame);
    if (this.opened) this.render();
    this.player();
    if (this.audio?.started && this.audioFrame)
      this.audio.apply(
        this.audioFrame.public.contributors || {},
        this.userId,
        this.audioFrame.kind,
      );
  }
  receive(frame) {
    if (!partyKinds.includes(frame.kind)) return;
    const existing = this.tables.get(frame.kind);
    // Closing a duplicate round must not replace the surviving round's state.
    if (
      frame.finished &&
      existing &&
      !existing.frame.finished &&
      existing.frame.round !== frame.round
    )
      return;
    if (frame.finished && existing?.state?.round === frame.round) {
      existing.state.finished = true;
      existing.state.closedAt = frame.closedAt || existing.state.closedAt;
      if (this.state?.round === frame.round) this.state.finished = true;
      try {
        const key = `vmeste:session:${this.store.roomId}:${this.userId}`;
        if (JSON.parse(localStorage.getItem(key))?.round === frame.round)
          localStorage.setItem(key, JSON.stringify(existing.state));
        if (frame.kind === "race")
          localStorage.setItem(
            `vmeste:circuit:${this.store.roomId}:${this.userId}`,
            JSON.stringify(existing.state),
          );
        if (frame.kind === "beacon")
          localStorage.setItem(
            `vmeste:beacon:${this.store.roomId}:${this.userId}`,
            JSON.stringify(existing.state),
          );
      } catch {}
    }
    if (frame.finished && this.audioFrame?.round === frame.round) {
      this.audio?.destroy();
      this.audio = null;
      this.audioFrame = null;
      this.player();
    }
    this.tables.set(frame.kind, {
      frame,
      state: existing?.state?.round === frame.round ? existing.state : null,
    });
    if (!this.audio) this.applyAudioState(frame);
    if (this.audioFrame?.kind === frame.kind) {
      this.audioFrame = frame;
      this.applyAudioState(frame);
      if (this.audio?.started)
        this.audio.apply(
          frame.public.contributors || {},
          this.userId,
          frame.kind,
        );
    }
    if (this.frame && frame.kind !== this.frame.kind && !this.frame.finished) {
      this.options.onInvite?.(frame);
      if (!this.invited.has(frame.round)) {
        this.invited.add(frame.round);
      }
      return;
    }
    if (
      this.frame?.kind === frame.kind &&
      this.frame?.round !== frame.round &&
      this.state?.round !== frame.round
    ) {
      this.state =
        existing?.state?.round === frame.round ? existing.state : null;
    }
    if (!document.querySelector("#party-panel")) this.opened = false;
    if (!partyKinds.includes(frame.kind)) {
      if (this.opened && document.querySelector("#party-panel")) {
        closeSheet();
        toast("На общем экране выбрана другая игра");
      }
      this.opened = false;
      this.frame = frame;
      return;
    }
    if (
      frame.finished &&
      this.audioFrame?.round === frame.round &&
      this.audio?.started
    )
      this.audio.stop();
    const previous = this.frame;
    if (
      frame.finished &&
      frame.public?.closedBy &&
      frame.public.closedBy !== this.userId &&
      !this.invited.has("closed:" + frame.round)
    ) {
      this.invited.add("closed:" + frame.round);
      toast("Участник покинул игру. Можно начать новую партию.");
    }
    if (previous?.round === frame.round && !frame.finished) {
      const left = (previous.public.joined || []).find(
        (id) => id !== this.userId && !frame.public.joined?.includes(id),
      );
      if (left)
        toast("Участник вышел из лобби. Можно подождать или покинуть игру.");
    }
    this.frame = frame;
    if (
      (frame.stage === "lobby" ||
        ["soundgarden", "meditation"].includes(frame.kind)) &&
      !frame.finished &&
      this.opened &&
      !frame.public.joined?.includes(this.userId)
    )
      this.input({ action: "join" });
    this.options.onFrame?.(frame);
    this.player();
    if (
      !this.store?.authViewer &&
      !this.options.isMonitor?.() &&
      frame.stage === "lobby" &&
      frame.controller !== this.userId &&
      !!frame.invitedAt &&
      !frame.finished &&
      !this.invited.has(frame.round + ":" + frame.invitedAt)
    ) {
      this.invited.add(frame.round + ":" + frame.invitedAt);
      if (!document.querySelector("#sheet").open) {
        sheet(
          `<div class="game-invitation"><span class="invitation-symbol">${icon("games")}</span><span class="eyebrow">ВАС ПРИГЛАШАЮТ</span><h2>${esc(frame.title)}</h2><p>Ваш человек ждёт за общим столом. Приглашение останется в разделе игр.</p><button class="btn primary wide" data-party="join">Присоединиться</button><button class="btn text wide" data-action="close">Позже</button></div>`,
        );
      }
    }
    if (this.opened && partyKinds.includes(frame.kind))
      this.render(previous?.round !== frame.round);
    if (
      this.audio?.started &&
      ["meditation", "soundgarden"].includes(frame.kind)
    )
      this.audio.apply(
        frame.public.contributors || {},
        this.userId,
        frame.kind,
      );
  }
  privateInstructions() {
    const s = this.state;
    if (!s || s.stage === "lobby") return;
    for (const u of s.players) {
      let payload = {
        round: s.round,
        turn: deckKinds.includes(s.kind) ? s.deck.index : s.turn || 0,
      };
      if (s.kind === "beacon" && s.rulesVersion === BEACON_RULES)
        Object.assign(payload, beaconSecret(s, u.id));
      else if (s.kind === "race" && s.rulesVersion === CIRCUIT_VERSION)
        Object.assign(payload, circuitSecret(s, u.id));
      else if ([...expeditionKinds, "race", "beacon"].includes(s.kind))
        Object.assign(payload, expeditionSecret(s, u.id));
      if (
        s.kind === "mime" &&
        u.id === s.players[s.deck.index % s.players.length].id
      )
        payload.prompt = s.deck.order[s.deck.index];
      if (
        s.kind === "riddles" &&
        u.id === s.players[s.deck.index % s.players.length].id
      )
        payload.answer = s.deck.order[s.deck.index]?.answer;
      if (s.kind === "frequency" && u.id === s.lead) payload.target = s.target;
      if (["draw", "museum"].includes(s.kind) && u.id === s.drawer)
        payload.word = s.secret;
      if (s.kind === "museum") {
        payload.ownChoices = (s.choices || [])
          .filter((c) => s.owners?.[c.id]?.includes(u.id))
          .map((c) => c.id);
        payload.alreadyGuessed = (s.guessed || []).includes(u.id);
        payload.canVote = (s.voters || []).includes(u.id);
      }
      if (u.id === this.userId)
        this.secrets.set(s.round + ":" + payload.turn, payload);
      else this.peer?.sendPrivate(u.id, payload);
    }
  }
  input(data) {
    if (!this.frame) return;
    this.peer?.sendInput({ round: this.frame.round, ...data });
  }
  openTable(kind) {
    if (this.frame)
      this.tables.set(this.frame.kind, {
        frame: this.frame,
        state: this.state,
      });
    const table = this.tables.get(kind);
    if (!table) return;
    this.frame = table.frame;
    this.state = table.state;
    this.options.onFrame?.(this.frame);
    this.open();
  }
  endEmpty(kind) {
    const table = this.tables.get(kind);
    if (table?.state && !table.state.joined.length) {
      this.command(this.userId, {
        round: table.frame.round,
        action: "end-empty",
      });
      toast("Игра завершена. Приглашение закрыто");
    }
  }
  applyAudioState(frame) {
    if (
      !this.audio &&
      !this.store?.authViewer &&
      !this.options.isMonitor?.() &&
      ["meditation", "soundgarden"].includes(frame.kind) &&
      frame.stage === "running" &&
      !frame.finished &&
      frame.public.joined?.includes(this.userId)
    ) {
      this.audioFrame = frame;
      this.audio = new NatureSound(this.options.soundSeed());
    }
    if (this.audioFrame?.round !== frame.round || !this.audio) return;
    if (frame.finished) {
      this.audio.destroy();
      this.audio = null;
      this.audioFrame = null;
    } else if (
      frame.public.audioPaused &&
      (this.audio.started || this.audio.starting)
    )
      this.audio.stop();
    else if (
      !frame.public.audioPaused &&
      !this.audio.started &&
      !this.audio.starting
    )
      this.audio
        .start()
        .then(() => {
          if (this.audioFrame?.round === frame.round && this.audio)
            this.audio.apply(
              frame.public.contributors || {},
              this.userId,
              frame.kind,
            );
          this.player();
          if (this.opened && this.frame?.round === frame.round) this.controls();
        })
        .catch(() => {});
  }
  retireHostedExcept(kind) {
    const previous = { state: this.state, frame: this.frame };
    for (const [otherKind, table] of this.tables) {
      if (
        otherKind === kind ||
        table.frame.finished ||
        !table.state ||
        table.frame.controllerClient !== this.peer?.peer?.id
      )
        continue;
      const state = table.state;
      if (deckKinds.includes(state.kind) && state.started)
        this.saveDeckRecord(state).catch(() =>
          toast("Не удалось сохранить партию"),
        );
      this.rememberDrawing(state);
      if (state.kind === "draw" && state.started && state.drawGallery?.length)
        this.store
          .save("plans", {
            id: `${this.store.roomId}:record:${state.round}`,
            title: partyTitles.draw,
            items: [],
            arcadeRecord: {
              kind: "draw",
              seconds: Math.max(0, Date.now() - state.started) / 1000,
              players: state.players.map((p) => p.id),
              gallery: state.drawGallery,
              partial: true,
            },
          })
          .catch(() => toast("Не удалось сохранить рисунки"));
      state.finished = true;
      state.closedAt = Date.now();
      state.revision = (state.revision || 0) + 1;
      state.elapsed = state.started ? Date.now() - state.started : 0;
      this.state = state;
      const frame = this.publicFrame();
      table.frame = frame;
      this.peer?.publishGame(frame);
      this.options.onInvite?.(frame);
      if (state.kind === "race")
        localStorage.setItem(
          `vmeste:circuit:${this.store.roomId}:${this.userId}`,
          JSON.stringify(state),
        );
      if (state.kind === "beacon")
        localStorage.setItem(
          `vmeste:beacon:${this.store.roomId}:${this.userId}`,
          JSON.stringify(state),
        );
      if (this.audioFrame?.round === frame.round) {
        this.audio?.destroy();
        this.audio = null;
        this.audioFrame = null;
        this.player();
      }
    }
    this.state = previous.state;
    this.frame = previous.frame;
  }
  circuitMenu() {
    if (
      this.opened &&
      this.frame &&
      !["meditation", "soundgarden"].includes(this.frame.kind)
    )
      this.input({ action: "leave" });
    this.opened = false;
    let table = this.tables.get("race");
    if (!table)
      try {
        const saved = JSON.parse(
          localStorage.getItem(
            `vmeste:circuit:${this.store.roomId}:${this.userId}`,
          ),
        );
        if (
          saved?.rulesVersion === CIRCUIT_VERSION &&
          saved.kind === "race" &&
          !saved.finished
        ) {
          const previous = this.state;
          this.state = saved;
          table = { state: saved, frame: this.publicFrame() };
          this.state = previous;
          this.tables.set("race", table);
        }
      } catch {}
    const active =
      table?.frame.public.rulesVersion === CIRCUIT_VERSION ? table.frame : null;
    sheet(circuitHome(this.store, active));
    document.querySelector("#sheet").scrollTop = 0;
  }
  beaconMenu() {
    if (
      this.opened &&
      this.frame &&
      !["meditation", "soundgarden"].includes(this.frame.kind)
    )
      this.input({ action: "leave" });
    this.opened = false;
    let table = this.tables.get("beacon");
    if (!table)
      try {
        const saved = JSON.parse(
          localStorage.getItem(
            `vmeste:beacon:${this.store.roomId}:${this.userId}`,
          ),
        );
        if (saved?.rulesVersion === BEACON_RULES && !saved.finished) {
          const previous = this.state;
          this.state = saved;
          table = { state: saved, frame: this.publicFrame() };
          this.state = previous;
          this.tables.set("beacon", table);
        }
      } catch {}
    sheet(
      beaconHome(
        this.store,
        table?.frame.public.rulesVersion === BEACON_RULES ? table.frame : null,
      ),
    );
    document.querySelector("#sheet").scrollTop = 0;
  }
  command(sender, input) {
    if (input?.round === this.frame?.round)
      return this.handleCommand(sender, input);
    const table = [...this.tables.values()].find(
      (t) => t.frame.round === input?.round && t.state,
    );
    if (!table) return;
    const current = {
      frame: this.frame,
      state: this.state,
      opened: this.opened,
    };
    this.frame = table.frame;
    this.state = table.state;
    this.opened = false;
    this.backgroundDispatch = true;
    try {
      this.handleCommand(sender, input);
      if (this.state?.finished && !this.frame.finished) this.broadcast();
    } finally {
      this.frame = current.frame;
      this.state = current.state;
      this.opened = current.opened;
      this.backgroundDispatch = false;
      this.player();
    }
  }
  handleCommand(sender, input) {
    const s = this.state;
    if (
      !s ||
      !this.hosting ||
      input?.round !== s.round ||
      (s.finished && input.action !== "round-back")
    )
      return;
    if (input.action === "join") {
      if (
        s.stage === "running" &&
        !s.players.some((u) => u.id === sender) &&
        !["soundgarden", "meditation"].includes(s.kind)
      )
        return;
      if (!s.players.some((u) => u.id === sender)) {
        const r = this.store.authRoster.find((r) => r.id === sender);
        if (!r) return;
        s.players.push({
          id: r.id,
          name: r.name,
          avatar:
            this.store.users.find((u) => u.localUserId === r.id)?.avatar ||
            "✨",
        });
      }
      if (!s.joined.includes(sender)) s.joined.push(sender);
      updateGamePresence(s, sender, true);
      if (s.contributors && sender !== this.userId && s.solo) {
        s.solo = false;
        if (s.kind !== "meditation")
          for (const id of Object.keys(s.contributors))
            if (id.includes(":voice")) delete s.contributors[id];
      }
      if (s.contributors && !s.contributors[sender])
        s.contributors[sender] = {
          layers: [1, 1, 1, 0, 0, 0, 0, 0],
          moods: [0.55, 0.3, 0.6, 0.7],
          pads: [
            [0.25, 0.35],
            [0.7, 0.35],
            [0.35, 0.7],
            [0.75, 0.75],
          ],
        };
      if (s.kind === "meditation") arrangeMeditation(s);
      this.broadcast();
      if (s.stage === "running") this.privateInstructions();
      return;
    }
    if (
      input.action === "end-empty" &&
      sender === this.userId &&
      !s.joined.length
    ) {
      this.finish();
      return;
    }
    if (input.action === "leave") {
      if (!s.joined.includes(sender)) return;
      s.closedBy = sender;
      this.rememberDrawing(s);
      if (s.kind === "draw" && s.started && s.drawGallery?.length)
        this.store
          .save("plans", {
            id: `${this.store.roomId}:record:${s.round}`,
            title: partyTitles.draw,
            items: [],
            arcadeRecord: {
              kind: "draw",
              seconds: Math.max(0, Date.now() - s.started) / 1000,
              players: s.players.map((p) => p.id),
              gallery: s.drawGallery,
              partial: true,
            },
          })
          .catch(() => toast("Не удалось сохранить рисунки"));

      if (deckKinds.includes(s.kind) && s.started)
        this.saveDeckRecord(s).catch(() =>
          toast("Не удалось сохранить партию"),
        );

      s.joined = s.joined.filter((id) => id !== sender);
      s.readyPlayers = (s.readyPlayers || []).filter((id) => id !== sender);
      if (
        (s.stage === "running" &&
          !["soundgarden", "meditation"].includes(s.kind)) ||
        sender === s.controller ||
        sender === this.userId ||
        !s.joined.length
      ) {
        s.finished = true;
        s.closedAt = Date.now();
      }
      this.broadcast();
      return;
    }
    if (input.action === "presence" && s.joined.includes(sender)) {
      updateGamePresence(s, sender, !!input.active);
      this.broadcast();
      if (input.active && !s.pausedAt) this.privateInstructions();
      return;
    }
    if (s.pausedAt) return;
    if (!s.players.some((u) => u.id === sender) || !s.joined.includes(sender))
      return;
    if (
      ["meditation", "soundgarden"].includes(s.kind) &&
      input.action === "audio-close"
    ) {
      s.finished = true;
      s.closedAt = Date.now();
      s.elapsed = s.started ? Date.now() - s.started : 0;
      this.broadcast();
      return;
    }
    if (
      ["meditation", "soundgarden"].includes(s.kind) &&
      input.action === "audio-pause"
    ) {
      s.audioPaused = !!input.paused;
      this.broadcast();
      return;
    }
    if (s.stage === "lobby") {
      if (input.action === "ready") {
        s.readyPlayers = s.readyPlayers.includes(sender)
          ? s.readyPlayers.filter((id) => id !== sender)
          : [...s.readyPlayers, sender];
        this.beginIfReady();
        this.broadcast();
      }
      return;
    }
    if (s.kind === "beacon" && s.rulesVersion === BEACON_RULES) {
      if (beaconCommand(s, sender, input)) {
        if (s.finished && !s.recorded) {
          s.recorded = true;
          this.store
            .save("plans", {
              id: `${this.store.roomId}:record:${s.round}`,
              title: "Маяк · сохранённая гавань",
              items: [],
              arcadeRecord: {
                kind: "beacon",
                rulesVersion: BEACON_RULES,
                players: s.players.map((p) => p.id),
                seconds: s.elapsed / 1000,
                createdAt: Date.now(),
                teamScore: s.teamScore,
                beaconLength: s.beaconLength,
                harbor: s.harbor,
                journal: s.journal,
              },
            })
            .catch(() => toast("Не удалось сохранить вахту"));
        }
        this.broadcast();
        this.privateInstructions();
        this.render(this.userId === s.engineer);
      }
      return;
    }
    if (s.kind === "race" && s.rulesVersion === CIRCUIT_VERSION) {
      if (circuitCommand(s, sender, input)) {
        if (s.finished && !s.recorded) {
          s.recorded = true;
          this.store
            .save("plans", {
              id: `${this.store.roomId}:record:${s.round}`,
              title: "Светлячки · общий забег",
              items: [],
              arcadeRecord: {
                kind: "race",
                rulesVersion: CIRCUIT_VERSION,
                seconds: s.elapsed / 1000,
                players: s.players.map((p) => p.id),
                teamScore: s.teamScore,
                runLength: s.runLength,
                journal: s.journal,
                route: s.route,
                createdAt: Date.now(),
              },
            })
            .catch(() => toast("Не удалось сохранить общий рекорд"));
        }
        this.broadcast();
        this.privateInstructions();
        this.render(true);
      }
      return;
    }
    if ([...expeditionKinds, "race", "beacon"].includes(s.kind)) {
      if (input.turn != null && input.turn !== s.turn) return;
      if (expeditionCommand(s, sender, input)) {
        if (s.finished && !s.recorded) {
          s.recorded = true;
          this.store
            .save("plans", {
              id: `${this.store.roomId}:record:${s.round}`,
              title: partyTitles[s.kind],
              items: [],
              arcadeRecord: {
                kind: s.kind,
                seconds: s.elapsed / 1000,
                players: s.players.map((u) => u.id),
                results: s.scores,
                journal: s.journal,
                createdAt: Date.now(),
              },
            })
            .catch(() => toast("Не удалось сохранить итог"));
        }
        this.broadcast();
        this.privateInstructions();
        if (input.action === "island-next") this.render(true);
      }
      return;
    }
    if (deckKinds.includes(s.kind)) {
      if (deckCommand(s, sender, input, this.store)) {
        if (s.kind !== "mixed" && s.deck.index >= s.deck.order.length) {
          this.saveDeckRecord(s).catch(() =>
            toast("Не удалось сохранить партию"),
          );
          s.finished = true;
          s.elapsed = Date.now() - s.started;
        }

        this.broadcast();
        this.privateInstructions();
        if (s.deck.order[s.deck.index]) this.mark(s.deck.order[s.deck.index]);
      }
      return;
    }
    if (input.action === "round-back") {
      this.previousRound();
      return;
    }
    if (
      input.action === "answer" &&
      input.turn != null &&
      input.turn !== (s.turn || 0)
    )
      return;
    if (
      input.action === "not-ready" &&
      ["word", "poem"].includes(s.kind) &&
      s.phase === "play"
    ) {
      s.readyPlayers = s.readyPlayers.filter((id) => id !== sender);
      this.broadcast();
      return;
    }
    if (
      ["draw-solved", "draw-skip"].includes(input.action) &&
      s.kind === "draw"
    ) {
      s.solved = true;
      s.skipped = input.action === "draw-skip";
      this.broadcast();
      return;
    }
    if (s.kind === "frequency") {
      if (frequencyCommand(s, sender, input)) this.broadcast();
      return;
    }
    if (s.kind === "museum") {
      if (
        input.action === "museum-caption" &&
        s.phase === "draw" &&
        sender === s.drawer
      ) {
        s.phase = "captions";
        this.broadcast();
        return;
      }
      if (
        input.action === "answer" &&
        s.phase === "captions" &&
        sender !== s.drawer
      ) {
        const caption = String(input.values?.answer || "")
          .trim()
          .slice(0, 130);
        if (caption) s.captions[sender] = caption;
        if (Object.keys(s.captions).length >= s.players.length - 1)
          this.museumVote();
        else this.broadcast();
        return;
      }
      if (
        input.action === "museum-vote" &&
        s.phase === "vote" &&
        s.voters.includes(sender) &&
        !s.votes[sender]
      ) {
        const choice = s.choices.find((c) => c.id === input.choice);
        if (!choice || s.owners[choice.id]?.includes(sender)) return;
        s.votes[sender] = choice.id;
        if (Object.keys(s.votes).length >= s.voters.length) this.museumReveal();
        else this.broadcast();
        return;
      }
    }
    if (input.action === "answer") {
      if (s.kind === "word" && s.phase === "play") {
        const answer = String(input.values?.answer || "")
          .trim()
          .slice(0, 160);
        if (answer) s.answers[sender] = answer;
      }
      if (s.kind === "poem" && s.phase === "play")
        for (const [index, value] of Object.entries(input.values || {})) {
          const i = Number(index);
          if (
            Number.isInteger(i) &&
            i >= 0 &&
            i < s.slots.length &&
            s.players[i % s.players.length].id === sender &&
            String(value).trim()
          )
            s.answers[i] = String(value).trim().slice(0, 50);
        }
      if (s.kind === "draw" && !s.solved && sender !== s.drawer) {
        const guess = String(input.values?.answer || "")
          .trim()
          .slice(0, 100);
        s.lastGuess = guess
          ? `${s.players.find((u) => u.id === sender).name}: ${guess}`
          : "";
        const clean = (v) => v.toLowerCase().replace(/[^а-яёa-z0-9]/g, "");
        if (clean(guess) === clean(s.secret)) {
          s.solved = true;
          if (s.turn + 1 >= s.totalTurns) this.finish();
        }
      }
    }
    if (
      input.action === "answer" &&
      ["word", "poem"].includes(s.kind) &&
      s.phase === "play"
    ) {
      const valid =
        s.kind === "word"
          ? !!s.answers[sender]
          : s.slots.every(
              (_, i) =>
                s.players[i % s.players.length].id !== sender || !!s.answers[i],
            );
      if (valid && !s.readyPlayers.includes(sender))
        s.readyPlayers.push(sender);
      if (s.players.every((u) => s.readyPlayers.includes(u.id)))
        s.phase = "reveal";
    }
    if (
      ["draw", "museum"].includes(s.kind) &&
      (s.kind !== "museum" || s.phase === "draw") &&
      input.action === "ink" &&
      sender === s.drawer &&
      !s.solved &&
      Array.isArray(input.lines) &&
      input.lines.length <= 25
    ) {
      for (const line of input.lines)
        if (
          Array.isArray(line) &&
          line.length === 5 &&
          line.every(Number.isFinite) &&
          s.lines.length < 12000
        )
          s.lines.push(
            line.map((v, i) =>
              Math.round(clamp(v, 0, i % 2 === 1 ? 700 : i === 4 ? 3 : 1000)),
            ),
          );
    }
    if (s.kind === "beacon" && input.action === "rotate") {
      const i = Number(input.index);
      if (
        Number.isInteger(i) &&
        i >= 0 &&
        i < s.wheels.length &&
        s.players[i % s.players.length].id === sender
      ) {
        s.wheels[i] = (s.wheels[i] + 1) % 4;
        s.moves++;
        if (s.wheels.every((v, n) => v === s.targets[n])) this.finish();
      }
    }
    if (s.kind === "race" && input.action === "step") {
      const side = Number(input.side);
      if (
        [0, 1].includes(side) &&
        s.sides[sender] !== side &&
        Date.now() - (s.taps[sender] || 0) >= 75 &&
        !s.times[sender]
      ) {
        s.sides[sender] = side;
        s.taps[sender] = Date.now();
        s.positions[sender] = (s.positions[sender] || 0) + 1;
        if (s.positions[sender] >= 30) s.times[sender] = Date.now() - s.started;
        if (s.players.every((u) => s.times[u.id])) this.finish();
      }
    }
    if (["meditation", "soundgarden"].includes(s.kind)) {
      if (input.action === "music-shuffle") {
        s.musicShift = (s.musicShift || 0) + 1;
        this.broadcast();
        return;
      }
      const voice =
        (s.solo || s.kind === "meditation") &&
        [1, 2, 3].includes(Number(input.voice))
          ? Number(input.voice)
          : 0;
      const voiceId = voice ? sender + ":voice" + voice : sender;
      if (
        s.kind === "meditation" &&
        input.action !== "star" &&
        !meditationVoices(s).some((v) => v.id === voiceId && v.owner === sender)
      )
        return;
      const c = s.contributors[voiceId];
      if (!c) return;
      const index = Number(input.index);
      if (
        input.action === "sound-pad" &&
        [0, 1, 2, 3].includes(Number(input.bank)) &&
        Number.isFinite(input.x) &&
        Number.isFinite(input.y)
      ) {
        c.pads ||= [
          [0.5, 0.5],
          [0.45, 0.65],
        ];
        c.pads[Number(input.bank)] = [clamp(input.x), clamp(input.y)];
        c.moods = [
          clamp(input.x),
          clamp(input.y),
          Number(input.bank) === 1 ? clamp(input.y) : c.moods[2],
          1 - clamp(input.x),
        ];
      }
      if (
        input.action === "star" &&
        Number.isInteger(index) &&
        index >= 0 &&
        index < 12
      ) {
        if (
          !assignedConstellations(
            s.players,
            sender,
            s.solo,
            `${s.round}:${s.musicShift || 0}`,
          ).some((star) => star.index === index)
        )
          return;
        c.stars = (c.stars || []).filter(
          (st) => st.index !== index && st.until > Date.now(),
        );
        c.stars.push({
          index,
          gesture:
            typeof input.gesture === "string"
              ? input.gesture.slice(0, 80)
              : undefined,
          holding: !!input.holding,
          hold: clamp(Number(input.hold) || 0, 0, 5),
          power: clamp(input.power),
          until: Math.min(
            Date.now() + 18000,
            Number(input.until) || Date.now() + 1000,
          ),
        });
        c.memory ||= [0, 0, 0, 0];
        c.memory[index] = Math.min(
          1,
          (c.memory[index] || 0) * 0.99 + clamp(input.power) * 0.12,
        );
        c.memoryAt = Date.now();
      }
      if (
        input.action === "layer" &&
        Number.isInteger(index) &&
        index >= 0 &&
        index < 8
      )
        c.layers[index] = c.layers[index] ? 0 : 1;
      if (
        input.action === "mood" &&
        Number.isInteger(index) &&
        index >= 0 &&
        index < 4
      )
        c.moods[index] = clamp(input.value);
    }
    this.broadcast();
  }
  async frequencyNext() {
    const s = this.state;
    if (!s || s.kind !== "frequency" || s.phase !== "reveal") return;
    if (this.forwardRound()) return;
    this.rememberRound();
    if (s.turn + 1 >= s.totalRounds) {
      await this.finish();
      return;
    }
    s.turn++;
    nextFrequency(s, this.store);
    this.mark("Частота: " + s.axis.join(" · "));
    this.broadcast();
    this.privateInstructions();
    this.render(true);
  }
  museumVote() {
    const s = this.state,
      clean = (v) =>
        v
          .toLowerCase()
          .trim()
          .replace(/[^а-яёa-z0-9]/g, "");
    s.owners = {};
    s.guessed = [];
    s.choices = [];
    s.votes = {};
    const add = (text, owner) => {
      let c = s.choices.find((c) => clean(c.text) === clean(text));
      if (!c) {
        c = { id: crypto.randomUUID(), text };
        s.choices.push(c);
        s.owners[c.id] = [];
      }
      if (owner) s.owners[c.id].push(owner);
      return c.id;
    };
    s.correct = add(s.secret, null);
    for (const [id, caption] of Object.entries(s.captions)) {
      if (clean(caption) === clean(s.secret)) s.guessed.push(id);
      else add(caption, id);
    }
    const actor = s.secret.split(" ")[0];
    for (const action of [...museumActions].sort(() => Math.random() - 0.5)) {
      if (s.choices.length >= 4) break;
      add(actor + " " + action, null);
    }
    for (let i = s.choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [s.choices[i], s.choices[j]] = [s.choices[j], s.choices[i]];
    }
    s.voters = s.players
      .filter((u) => u.id !== s.drawer && !s.guessed.includes(u.id))
      .map((u) => u.id);
    s.phase = "vote";
    this.broadcast();
    this.privateInstructions();
    this.render(true);
    if (!s.voters.length) this.museumReveal();
  }
  museumReveal() {
    const s = this.state;
    if (s.phase === "reveal") return;
    s.phase = "reveal";
    s.gains = Object.fromEntries(s.players.map((u) => [u.id, 0]));
    s.tallies = {};
    for (const id of s.guessed) {
      s.gains[id] += 3;
      s.gains[s.drawer]++;
    }
    for (const [id, choice] of Object.entries(s.votes)) {
      s.tallies[choice] = (s.tallies[choice] || 0) + 1;
      if (choice === s.correct) {
        s.gains[id] += 2;
        s.gains[s.drawer]++;
      } else for (const author of s.owners[choice] || []) s.gains[author]++;
    }
    for (const id of Object.keys(s.gains)) s.scores[id] += s.gains[id];
    s.gallery.push({
      title: s.secret,
      artist: s.players.find((u) => u.id === s.drawer)?.name,
      lines: thumbnail(s.lines),
    });
    s.usedPrompts.push(s.secret);
    this.mark("Музей: " + s.secret);
    this.broadcast();
  }
  museumNext() {
    const s = this.state;
    if (this.forwardRound()) return;
    this.rememberRound();
    if (s.turn + 1 >= s.totalRounds) {
      this.finish();
      return;
    }
    s.turn++;
    s.drawer = s.players[s.turn % s.players.length].id;
    s.secret = museumPrompt(this.store, s.usedPrompts);
    s.phase = "draw";
    s.lines = [];
    s.captions = {};
    s.votes = {};
    s.choices = [];
    s.guessed = [];
    this.broadcast();
    this.privateInstructions();
    this.render(true);
  }
  rememberDrawing(s) {
    if (s.kind !== "draw" || !s.lines?.length) return;
    s.drawGallery ||= [];
    if (s.drawGallery.some((g) => g.turn === s.turn)) return;
    s.drawGallery.push({
      turn: s.turn,
      title: s.secret,
      artist: s.players.find((p) => p.id === s.drawer)?.name || "Художник",
      lines: thumbnail(s.lines),
    });
  }
  async saveDeckRecord(s) {
    await this.store.save("plans", {
      id: `${this.store.roomId}:record:${s.round}`,
      title: partyTitles[s.kind],
      items: [],
      arcadeRecord: {
        kind: s.kind,
        seconds: Math.max(0, Date.now() - s.started) / 1000,
        players: s.players.map((p) => p.id),
        cards: s.deck.index,
      },
    });
  }
  async finish() {
    const s = this.state;
    if (!s || s.finished) return;
    s.closedAt = Date.now();
    if (s.stage === "lobby") {
      s.finished = true;
      s.elapsed = 0;
      this.broadcast();
      return;
    }
    this.rememberDrawing(s);
    s.finished = true;
    s.elapsed = Date.now() - s.started;
    if (["race", "beacon"].includes(s.kind) && s.rulesVersion === 2) {
      this.broadcast();
      return;
    }
    if (
      (s.kind === "frequency" && s.log.length < s.totalRounds) ||
      !["draw", "beacon", "race", "museum", "frequency"].includes(s.kind)
    ) {
      this.audio?.stop();
      this.broadcast();
      return;
    }
    const record = {
      kind: s.kind,
      seconds: s.elapsed / 1000,
      moves: s.moves,
      players: s.players.map((p) => p.id),
      createdAt: Date.now(),
      results: [
        "museum",
        "frequency",
        ...expeditionKinds,
        "race",
        "beacon",
      ].includes(s.kind)
        ? { ...s.scores }
        : undefined,
      times: s.kind === "race" ? { ...s.times } : undefined,
      gallery:
        s.kind === "museum"
          ? s.gallery
          : s.kind === "draw"
            ? s.drawGallery
            : undefined,
    };
    await this.store.save("plans", {
      id: `${this.store.roomId}:record:${s.round}`,
      title: partyTitles[s.kind],
      items: [],
      arcadeRecord: record,
    });
    if (this.state?.round === s.round) this.broadcast();
  }
  open() {
    if (!partyKinds.includes(this.frame?.kind)) return;
    if (!this.frame.finished) this.input({ action: "join" });
    this.opened = true;
    this.render(true);
    document.querySelector("#sheet").scrollTop = 0;
  }
  render(force = false) {
    const f = this.frame;
    if (!f || !this.opened) return;
    const key =
      f.round +
      ":" +
      f.stage +
      ":" +
      !!f.public.paused +
      ":" +
      (f.public.moduleReady || []).join(",") +
      ":" +
      (f.public.approved || []).join(",") +
      ":" +
      (f.public.trialReady || []).join(",") +
      ":" +
      (f.invitedAt || 0) +
      ":" +
      (f.public.index ?? 0) +
      ":" +
      !!f.public.selected +
      ":" +
      !!f.public.deadline +
      ":" +
      f.public.phase +
      ":" +
      !!f.public.solo +
      ":" +
      (f.public.musicShift || 0) +
      ":" +
      !!f.public.audioPaused +
      ":" +
      (f.stage === "lobby"
        ? (f.public.readyPlayers || []).join(",")
        : !!f.public.readyPlayers?.includes(this.userId)) +
      ":" +
      f.kind +
      ":" +
      !!f.finished +
      ":" +
      !!f.public.revealed +
      ":" +
      (f.public.turn || 0) +
      ":" +
      !!f.public.solved +
      ":" +
      (f.public.phase || "") +
      ":" +
      !!f.public.voted?.includes(this.userId) +
      ":" +
      !!f.public.memorized?.includes(this.userId) +
      ":" +
      !!f.public.submitted?.includes(this.userId) +
      ":" +
      f.public.dials?.[this.userId] +
      ":" +
      f.public.progressBy?.[this.userId];
    const readiness = [
      ...(f.public.readyPlayers || []),
      ...(f.public.moduleReady || []),
      ...(f.public.trialReady || []),
      ...(f.public.approved || []),
    ];
    if (force || document.querySelector("#party-panel")?.dataset.key !== key) {
      sheet(
        `<div id="party-panel" data-key="${esc(key)}"><div class="game-toolbar"><button class="btn text" data-party="leave-table">Покинуть игру</button><button class="btn text" data-party="focus">${icon("expand")} ${document.querySelector("#sheet").classList.contains("game-expanded") ? "Обычный вид" : "На весь экран"}</button></div><div id="party-live"></div><div id="party-controls"></div></div>`,
      );
      this.opened = true;
      this.controls();
    }
    const stage = document.querySelector("#party-live");
    if (
      stage &&
      !(
        ["meditation", "soundgarden"].includes(f.kind) &&
        f.stage === "running" &&
        !f.finished &&
        refreshSoundWorld(stage, f)
      )
    )
      stage.innerHTML =
        (f.finished ||
        f.stage === "lobby" ||
        (f.kind === "beacon" && f.public.rulesVersion === BEACON_RULES)
          ? ""
          : `<div class="game-presence" aria-label="Участники игры">${f.public.players?.map((u) => `<span>${esc(u.avatar)} ${esc(u.name)} · ${f.public.away?.includes(u.id) ? "отошёл" : readiness.includes(u.id) ? "Готов ✓" : f.public.joined?.includes(u.id) ? "за столом" : "приглашён"}</span>`).join("") || ""}</div>`) +
        partyScreen(f);
    this.updateLobby();
    if (["draw", "museum"].includes(f.kind)) this.paint();
    if (["meditation", "soundgarden"].includes(f.kind)) {
      const mine =
        f.public.contributors?.[
          this.voice && (f.kind === "meditation" || f.public.solo)
            ? this.userId + ":voice" + this.voice
            : this.userId
        ];
      for (const point of document.querySelectorAll(
        "[data-meditation-point]",
      )) {
        const voice = Number(point.dataset.meditationPoint);
        const id = point.dataset.owner + (voice ? ":voice" + voice : "");
        const p = f.public.contributors?.[id]?.pads?.[0];
        if (p && !point.classList.contains("dragging-point")) {
          point.style.left = `${10 + p[0] * 80}%`;
          point.style.top = `${10 + p[1] * 80}%`;
          point.dataset.x = p[0];
          point.dataset.y = p[1];
        }
      }
      for (const point of document.querySelectorAll("[data-garden-bank]")) {
        const p = mine?.pads?.[Number(point.dataset.gardenBank)];
        if (p && !point.classList.contains("dragging-point")) {
          point.dataset.x = p[0];
          point.dataset.y = p[1];
          point.style.left = `${10 + p[0] * 80}%`;
          point.style.top = `${10 + p[1] * 80}%`;
        }
      }
      const plane = document.querySelector(".meditation-plane");
      if (plane) {
        const memory = Object.values(f.public.contributors || {}).reduce(
          (n, c) =>
            n + (c.memory || []).reduce((a, b) => a + (Number(b) || 0), 0),
          0,
        );
        plane.style.setProperty(
          "--garden-memory",
          `${Math.min(180, memory * 12)}deg`,
        );
      }
      updateSoundConnections();
      for (const b of document.querySelectorAll('[data-party="layer"]'))
        b.setAttribute(
          "aria-pressed",
          String(!!mine?.layers?.[b.dataset.index]),
        );
    }
    if (["soundgarden", "meditation"].includes(f.kind)) {
      const voice =
          (f.public.solo || f.kind === "meditation") && this.voice
            ? this.userId + ":voice" + this.voice
            : this.userId,
        mine = f.public.contributors?.[voice];
      for (const star of document.querySelectorAll("[data-constellation]")) {
        const memory = mine?.memory?.[Number(star.dataset.constellation)] || 0;
        star.classList.toggle("remembered", memory > 0.01);
        star.style.setProperty("--memory", String(memory));
      }
    }
    const records = document.querySelector("#party-records");
    if (records) records.innerHTML = this.records();
  }
  controls() {
    const f = this.frame,
      p = f.public,
      box = document.querySelector("#party-controls");
    if (!box) return;
    if (p.paused && !f.finished) {
      box.innerHTML =
        '<p class="fine center">Игра сохранена. Продолжим, когда все вернутся.</p>';
      return;
    }
    const member = p.players.some((u) => u.id === this.userId),
      secret = this.secrets.get(f.round + ":" + (p.turn || 0)) || {};
    let html = "";
    if (f.stage === "lobby" && f.finished)
      html =
        '<button class="btn soft wide" data-action="close">Закрыть окно</button>';
    else if (f.stage === "lobby") {
      html = `<button class="btn primary wide" data-party="ready">${p.readyPlayers?.includes(this.userId) ? "Отменить готовность" : "Готов"}</button><p class="muted center">${p.joined?.length || 1} за столом · начало после готовности всех</p>${this.hosting && ["soundgarden", "meditation"].includes(f.kind) ? '<button class="btn lavender wide" data-party="solo">Слушать одному · все пульты</button>' : this.hosting && [...deckKinds, "poem"].includes(f.kind) ? '<button class="btn lavender wide" data-party="solo">Играть с одного телефона · ответы вслух</button>' : ""}${this.hosting ? `<button class="btn soft wide" data-party="invite" ${f.invitedAt ? "disabled" : ""}>${f.invitedAt ? "Приглашение активно" : "Отправить приглашение"}</button><p class="fine center">Приглашение останется в играх до закрытия лобби и не прервёт другую игру.</p><button class="btn text wide" data-party="cancel-lobby">Закрыть лобби</button>` : ""}`;
    } else if (f.kind === "race" && p.rulesVersion === CIRCUIT_VERSION)
      html = circuitControls(f, this.userId, secret);
    else if (f.kind === "beacon" && p.rulesVersion === BEACON_RULES)
      html = beaconControls(f, this.userId, secret);
    else if ([...expeditionKinds, "race", "beacon"].includes(f.kind))
      html = expeditionControls(f, this.userId, secret);
    else if (deckKinds.includes(f.kind))
      html = deckControls(f, this.userId, secret);
    else if (f.finished && f.kind === "frequency" && p.cancelled)
      html = this.hosting
        ? '<button class="btn primary wide" data-party="again">Начать новую партию</button>'
        : "";
    else if (f.finished)
      html = `${["draw", "beacon", "race", "museum", "frequency"].includes(f.kind) ? `<div id="party-records">${this.records()}</div>` : '<div class="session-done"><h3>Спасибо за это время</h3><p>Можно вернуться сюда, когда снова захочется.</p></div>'}${this.hosting ? '<button class="btn primary wide" data-party="again">Ещё одна партия</button>' : ""}`;
    else if (!member)
      html =
        '<p class="muted center">Следующий раунд — и вы с нами. Сейчас можно смотреть общий экран.</p>';
    else if (f.kind === "frequency")
      html = frequencyControls(f, this.userId, secret);
    else if (f.kind === "museum") {
      if (p.phase === "draw")
        html =
          p.drawer === this.userId
            ? `<div class="private-instructions"><small>ТАЙНА ХУДОЖНИКА</small><h3>${esc(secret.word || "Получаем задание…")}</h3><p>Рисуйте без букв и цифр. Пусть смысл угадают по деталям.</p></div><canvas id="draw-pad" width="1000" height="700" aria-label="Рисовать экспонат"></canvas><button class="btn primary wide" data-party="museum-caption">Экспонат готов</button>`
            : '<div class="museum-phone-wait"><span>🖼️</span><h3>Скоро ваш выход</h3><p>Рассмотрите рисунок на экране. Придумайте ему правдоподобное название.</p></div>';
      else if (p.phase === "captions")
        html =
          p.drawer === this.userId
            ? '<p class="game-instruction">Остальные придумывают названия. Вы пока храните оригинал в тайне.</p>'
            : `<form id="party-answer-form"><label>Название, в которое поверят<input name="answer" maxlength="130" required placeholder="Как бы вы назвали этот экспонат?"></label><button class="btn primary wide" type="submit">Повесить тайную табличку</button><p class="answer-note"></p></form>`;
      else if (p.phase === "vote")
        html =
          p.drawer === this.userId
            ? '<p class="game-instruction">Вы знаете оригинал. Наблюдайте, на что поведутся гости музея.</p>'
            : secret.alreadyGuessed
              ? '<div class="museum-phone-wait"><span>✨</span><h3>Вы назвали оригинал!</h3><p>Пока остальные выбирают, храните секрет.</p></div>'
              : p.voted.includes(this.userId)
                ? '<div class="museum-phone-wait"><span>🗳️</span><h3>Ваш голос принят</h3><p>Сейчас узнаем, кому удалось вас убедить.</p></div>'
                : `<p class="game-instruction">Найдите настоящее название. За своё голосовать нельзя.</p><div class="museum-ballot">${(p.choices || []).map((c, i) => `<button data-party="museum-vote" data-choice="${esc(c.id)}" ${(secret.ownChoices || []).includes(c.id) ? "disabled" : ""}><b>${String.fromCharCode(65 + i)}</b><span>${esc(c.text)}</span>${(secret.ownChoices || []).includes(c.id) ? "<small>Ваша табличка</small>" : ""}</button>`).join("")}</div>`;
      else
        html = `<div class="game-instruction"><p>+2 за оригинал · +1 за каждого, кто поверил вашей выдумке · +3 за точное название без подсказок. Художнику — очко за каждого угадавшего.</p>${this.hosting ? '<button class="btn primary wide" data-party="museum-next">Следующий зал →</button>' : "<p>Ведущий откроет следующий зал.</p>"}</div>`;
    } else if (f.kind === "word")
      html = p.revealed
        ? '<p class="game-instruction">Прочитайте ответы и выберите самый неожиданный. Здесь нет неправильных.</p>'
        : `<form id="party-answer-form"><label>Ваш ответ<textarea name="answer" maxlength="160" required placeholder="Одна мысль или короткая фраза…"></textarea></label><button class="btn primary wide" type="submit">Готово</button><p class="answer-note"></p></form>`;
    else if (f.kind === "poem")
      html = p.revealed
        ? `<p class="game-instruction">Прочитайте стих вслух по строчке. Чью интонацию он напоминает?</p><button class="btn lavender wide" data-party="save-poem">${icon("gallery")} Сохранить наш стих</button>`
        : poetryControls(
            f,
            this.userId,
            this.drafts.get(f.round + ":" + (p.turn || 0)) || {},
          );
    else if (f.kind === "race")
      html = `<p class="game-instruction">Чередуйте кнопки. Не скорость телефона, а ваш ритм.</p><div class="race-controls"><button data-party="step" data-side="0">Левый<br>☄️</button><button data-party="step" data-side="1">Правый<br>✨</button></div>`;
    else if (f.kind === "beacon")
      html = `<div class="private-instructions"><h3>Подсказки для товарищей</h3>${secret.guides?.map((g) => `<p>Кольцо ${g.index + 1} · ${esc(g.for)} → <b>${runes[g.target]}</b></p>`).join("") || "<p>Подсказки прилетят с устройства ведущего.</p>"}</div><div class="rune-controls">${(secret.controls || []).map((i) => `<button class="btn soft" data-party="rotate" data-index="${i}">Повернуть кольцо ${i + 1}</button>`).join("")}</div>`;
    else if (f.kind === "draw")
      html = p.solved
        ? `<div class="answer-reveal"><h3>Угадали!</h3><p>${esc(p.solution || "")}</p></div>`
        : p.drawer === this.userId
          ? `<div class="private-instructions"><small>Только вы видите задание</small><h3>${esc(secret.word || "Получаем карточку…")}</h3></div><canvas id="draw-pad" width="1000" height="700" aria-label="Рисовать подсказку"></canvas><div class="ink-colors">${["Лаванда", "Роза", "Мята", "Мёд"].map((c, i) => `<button data-party="ink-color" data-index="${i}" style="--ink:${["#6b527f", "#ed7798", "#5c9b8a", "#ce9b4b"][i]}">${c}</button>`).join("")}</div>`
          : `<p class="game-instruction">Угадывайте вслух. Когда ответ найден, нажмите кнопку.</p><button class="btn primary wide" data-party="draw-solved">Угадали!</button><button class="btn soft wide" data-party="draw-skip">Пропустить · открыть ответ</button>`;
    else if (["meditation", "soundgarden"].includes(f.kind)) {
      if (
        f.kind === "meditation" &&
        !meditationVoices(f.public).some(
          (v) => v.owner === this.userId && v.voice === (this.voice || 0),
        )
      )
        this.voice = 0;
      html = soundControls(f, this.userId, this.audio, this.voice || 0);
    }

    if (
      this.hosting &&
      !f.finished &&
      f.stage !== "lobby" &&
      !deckKinds.includes(f.kind) &&
      ![...expeditionKinds, "race", "beacon"].includes(f.kind)
    ) {
      if (f.kind === "frequency" && p.phase === "reveal")
        html += `<button class="btn primary wide" data-party="frequency-next">${p.turn + 1 >= p.totalRounds ? "Наше созвучие →" : "Следующая волна →"}</button>`;
      if (f.kind === "frequency" && p.phase === "guess")
        html +=
          '<details class="game-rules"><summary>Если кто-то отошёл</summary><button class="btn soft wide" data-party="frequency-reveal">Открыть принятые догадки</button></details>';
      if (["word", "poem"].includes(f.kind) && p.revealed)
        html += `<button class="btn lavender wide" data-party="reveal">Следующий раунд</button>`;
      if (f.kind === "museum" && ["draw", "captions", "vote"].includes(p.phase))
        html +=
          '<details class="game-rules"><summary>Если кто-то отошёл</summary><button class="btn soft wide" data-party="museum-advance">Продолжить без ожидания</button></details>';
      if (f.kind === "draw" && p.solved)
        html +=
          '<button class="btn primary wide" data-party="draw-next">Следующий художник</button>';
      html +=
        '<details class="session-menu"><summary>Управление партией</summary><p>Закончить игру у всех участников и сохранить результат.</p><button class="btn text wide" data-party="finish">Закончить у всех</button></details>';
    }

    box.innerHTML = html;
    if (
      ["word", "poem"].includes(f.kind) &&
      p.readyPlayers?.includes(this.userId) &&
      !p.revealed
    ) {
      box.querySelector("#party-answer-form button")?.remove();
      box.insertAdjacentHTML(
        "beforeend",
        '<button class="btn lavender wide" data-party="not-ready">Отменить готовность · изменить</button>',
      );
      for (const input of box.querySelectorAll("input,textarea"))
        input.disabled = true;
    }
    const draft = this.drafts.get(f.round + ":" + (f.public.turn || 0));
    if (draft && !p.revealed)
      for (const el of box.querySelectorAll(
        "#party-answer-form input,#party-answer-form textarea",
      ))
        if (draft[el.name] != null) {
          if (el.type === "radio") el.checked = el.value === draft[el.name];
          else el.value = draft[el.name];
        }
    this.bindDrawing();
    if (f.kind === "beacon") bindBeaconAssistant(f, secret);
    bindSoundControls(this);
  }
  roundCopy() {
    const { past, future, ...current } = this.state;
    return JSON.parse(JSON.stringify(current));
  }
  rememberRound() {
    const s = this.state;
    const snapshot = this.roundCopy();
    s.past ||= [];
    s.past.push(snapshot);
    s.future = [];
  }
  previousRound() {
    const s = this.state;
    if (!s?.past?.length) return;
    const current = this.roundCopy(),
      previous = s.past.pop(),
      future = [current, ...(s.future || [])];
    this.state = {
      ...previous,
      past: s.past,
      future,
      revision: s.revision,
      finished: false,
    };
    this.broadcast();
    this.privateInstructions();
    this.render(true);
  }
  forwardRound() {
    const s = this.state;
    if (!s?.future?.length) return false;
    const current = this.roundCopy(),
      next = s.future.shift();
    this.state = {
      ...next,
      past: [...(s.past || []), current],
      future: s.future,
      revision: s.revision,
    };
    this.broadcast();
    this.privateInstructions();
    this.render(true);
    return true;
  }
  beginIfReady() {
    const s = this.state;
    if (
      !s ||
      s.stage !== "lobby" ||
      s.joined.length < (s.solo ? 1 : s.kind === "museum" ? 3 : 2) ||
      !!s.away?.length ||
      !s.joined.every((id) => s.readyPlayers.includes(id))
    )
      return false;
    if (s.kind === "rift" && !(this.peer?.onlineDisplays?.() > 0)) return false;
    if (this.peer?.gameCompatibility?.(2).length) return false;
    s.players = s.players.filter((p) => s.joined.includes(p.id));
    if (s.kind === "race") initCircuit(s);
    if (s.kind === "beacon") initBeacon(s);
    if (expeditionKinds.includes(s.kind)) initExpedition(s);
    if (s.kind === "museum") s.totalRounds = Math.max(4, s.players.length);
    if (s.kind === "draw") s.totalTurns = Math.max(4, s.players.length);
    if (s.kind === "poem")
      s.slots = Array.from(
        { length: Math.max(4, s.players.length) },
        (_, i) =>
          [
            "Предмет или существо",
            "Прилагательное",
            "Глагол: что делать?",
            "Место",
          ][i % 4],
      );
    s.stage = "running";
    s.readyPlayers = [];
    s.started = Date.now();
    this.privateInstructions();
    return true;
  }
  updateLobby() {
    const f = this.frame;
    if (!f) return;
    const b = document.querySelector('[data-party="ready"]');
    if (b)
      b.textContent = f.public.readyPlayers?.includes(this.userId)
        ? "Отменить готовность"
        : "Готов";
  }
  player() {
    let el = document.querySelector("#ambient-player");
    if (!this.audio?.context) {
      el?.remove();
      document.body.classList.remove("has-player");
      return;
    }
    const parent = document.querySelector("#sheet[open]") || document.body;
    if (el && el.parentElement !== parent) parent.append(el);
    const playerKey = this.audioFrame?.round + ":" + this.audio.started;
    if (el?.dataset.key === playerKey) return;
    if (!el) {
      el = document.createElement("aside");
      el.id = "ambient-player";
      el.className = "ambient-player";
      el.setAttribute("aria-label", "Фоновая музыка");
      parent.append(el);
    }
    el.dataset.key = playerKey;
    el.innerHTML = `<button data-party="player-open" aria-label="Открыть звуковой пульт"><span class="mini-wave ${this.audio.started ? "playing" : ""}"><i></i><i></i><i></i></span><span>${esc(partyTitles[this.audioFrame?.kind] || "Ваш звуковой пейзаж")}<small>${this.audio.started ? "Сейчас звучит" : "На паузе"}</small></span></button><button data-party="sound" aria-label="${this.audio.started ? "Пауза" : "Продолжить музыку"}">${icon(this.audio.started ? "pause" : "play")}</button><button data-party="player-stop" aria-label="Выключить музыку">${icon("close")}</button>`;
    document.body.classList.add("has-player");
  }
  records() {
    const f = this.frame;
    const entries = this.store.data.plans
      .filter(
        (p) =>
          !p.deletedAt &&
          p.arcadeRecord?.kind === f.kind &&
          p.arcadeRecord.players.includes(this.userId) &&
          p.arcadeRecord.players.length === f.public.players.length,
      )
      .sort((a, b) =>
        ["museum", "frequency", ...expeditionKinds, "race", "beacon"].includes(
          f.kind,
        )
          ? (b.arcadeRecord.results?.[this.userId] || 0) -
            (a.arcadeRecord.results?.[this.userId] || 0)
          : (a.arcadeRecord.times?.[this.userId] / 1000 ||
              a.arcadeRecord.seconds) -
            (b.arcadeRecord.times?.[this.userId] / 1000 ||
              b.arcadeRecord.seconds),
      );
    const place = entries.findIndex((p) => p.id.endsWith(f.round)) + 1;
    return `<div class="record-sheet"><h3>${place ? "№ " + place + " в ваших результатах" : "Ваши результаты"}</h3><p>${["museum", "frequency", ...expeditionKinds, "race", "beacon"].includes(f.kind) ? `${f.public.scores?.[this.userId] || 0} ${f.kind === "frequency" ? "/100 · общее созвучие" : "очков за выставку"}` : `${((f.public.times?.[this.userId] || f.elapsed) / 1000).toFixed(1)} с · без лимита, с вашим ритмом`}</p>${entries
      .slice(0, 5)
      .map(
        (r, i) =>
          `<p><b>${i + 1}.</b> ${["museum", "frequency", ...expeditionKinds, "race", "beacon"].includes(f.kind) ? `${r.arcadeRecord.results?.[this.userId] || 0} ${f.kind === "frequency" ? "/100" : "очков"}` : `${(r.arcadeRecord.times?.[this.userId] / 1000 || r.arcadeRecord.seconds).toFixed(1)} с`} · ${r.arcadeRecord.players.length} участников${r.arcadeRecord.gallery ? ` <button class="btn text" data-party="view-record" data-id="${esc(r.id)}">Выставка</button>` : ""}</p>`,
      )
      .join(
        "",
      )}<small>Сравнение ваших партий этой игры с тем же числом участников.</small></div>`;
  }
  showRecords() {
    const records = this.store.data.plans
      .filter(
        (p) => !p.deletedAt && p.arcadeRecord?.players.includes(this.userId),
      )
      .sort((a, b) => b.createdAt - a.createdAt);
    sheet(
      `<span class="eyebrow">ВАША ИГРОВАЯ ПАМЯТЬ</span><h2>Выставки и итоги</h2><p class="muted">Сохранённые рисунки, общие пути и результаты ваших партий. Новые ответы и события находятся отдельно — под колокольчиком.</p><div class="game-record-list">${
        records
          .map(
            (r) =>
              `<article class="record-history-card"><div><span class="eyebrow">${new Date(r.createdAt).toLocaleDateString("ru-RU")} · ${r.arcadeRecord.players.length} участников</span><h3>${esc(r.title)}</h3><p>${r.arcadeRecord.kind === "activity" ? "Вы это сделали вместе" : r.arcadeRecord.kind === "poem" ? "Ваши слова сложились вместе" : r.arcadeRecord.rulesVersion === BEACON_RULES && r.arcadeRecord.kind === "beacon" ? `${r.arcadeRecord.harbor.ships.length} судов дома · ${r.arcadeRecord.beaconLength} узлов` : r.arcadeRecord.rulesVersion === CIRCUIT_VERSION && r.arcadeRecord.kind === "race" ? `${Math.round(r.arcadeRecord.teamScore / r.arcadeRecord.runLength)}% общего света · ${r.arcadeRecord.runLength} испытаний` : ["museum", "frequency", ...expeditionKinds, "race", "beacon"].includes(r.arcadeRecord.kind) ? `${r.arcadeRecord.results?.[this.userId] || 0} ${r.arcadeRecord.kind === "frequency" ? "/100" : "очков"}` : `${(r.arcadeRecord.times?.[this.userId] / 1000 || r.arcadeRecord.seconds).toFixed(1)} с`}</p></div>${
                r.arcadeRecord.kind === "activity"
                  ? `<div class="completed-idea-art">${art(r.arcadeRecord.activity)}</div><p>${esc(r.arcadeRecord.activity.description || "")}</p>`
                  : r.arcadeRecord.kind === "poem"
                    ? `<button class="btn soft wide" data-party="poem-record" data-id="${esc(r.id)}">Прочитать наш стих ${icon("story")}</button>`
                    : r.arcadeRecord.gallery
                      ? `<div class="record-thumbs">${r.arcadeRecord.gallery
                          .slice(0, 3)
                          .map((g) => `<div>${sketch(g.lines)}</div>`)
                          .join(
                            "",
                          )}</div><button class="btn text" data-party="view-record" data-id="${esc(r.id)}">Открыть выставку</button><button class="btn soft wide" data-party="screen-record" data-id="${esc(r.id)}">Показать на общем экране</button>`
                      : r.arcadeRecord.kind === "beacon" &&
                          r.arcadeRecord.rulesVersion === BEACON_RULES
                        ? `<button class="btn soft wide" data-party="beacon-record" data-id="${esc(r.id)}">Открыть гавань ${icon("arrow")}</button>`
                        : r.arcadeRecord.kind === "race" &&
                            r.arcadeRecord.rulesVersion === CIRCUIT_VERSION
                          ? `<button class="btn soft wide" data-party="view-team-record" data-id="${esc(r.id)}">Посмотреть путь ${icon("arrow")}</button>`
                          : ""
              }<button class="btn text" data-party="delete-record" data-id="${esc(r.id)}">${icon("trash")} Удалить результат</button></article>`,
          )
          .join("") ||
        '<p class="muted center">Первые результаты появятся после игры. Никаких обязательных рекордов — просто память о времени вместе.</p>'
      }</div>`,
    );
    this.opened = false;
  }
  viewRecord(id, screen = false) {
    const r = this.store.data.plans.find(
      (p) => p.id === id && !p.deletedAt && p.arcadeRecord?.gallery,
    );
    if (!r) return;
    const data = r.arcadeRecord;
    const frame = {
      kind: "exhibitworld",
      stage: "persistent",
      round: `${this.store.roomId}:exhibit:${id}`,
      revision: Date.now(),
      createdAt: 0,
      title: partyTitles.museum,
      text: "Из вашей игровой памяти. Эти истории могли придумать только вы.",
      progress: "Выставка сохранена",
      finished: true,
      elapsed: data.seconds * 1000,
      public: {
        recordKind: data.kind === "draw" ? "draw" : "museum",
        players: data.players.map((id) => ({
          id,
          name:
            this.store.users.find((u) => u.localUserId === id)?.displayName ||
            "Участник",
          avatar:
            this.store.users.find((u) => u.localUserId === id)?.avatar || "✨",
        })),
        scores: data.results,
        gallery: data.gallery,
      },
    };
    if (screen) this.peer?.publishGame(frame);
    this.opened = false;
    sheet(partyScreen(frame));
  }
  async action(action, el) {
    try {
      if (
        action === "save-poem" &&
        this.frame?.kind === "poem" &&
        this.frame.public.revealed
      ) {
        const f = this.frame,
          id = `${this.store.roomId}:poem:${f.round}:${f.public.turn || 0}`;
        if (!this.store.data.plans.some((p) => p.id === id && !p.deletedAt))
          await this.store.save("plans", {
            id,
            title: "Наш стих",
            items: [],
            arcadeRecord: {
              kind: "poem",
              seconds: Math.max(0, (f.elapsed || 0) / 1000),
              players: f.public.players.map((p) => p.id),
              poem: f.public.poem,
              createdAt: Date.now(),
            },
          });
        toast("Стих сохранён в «Выставках и итогах»");
        return;
      }
      if (action === "poem-record") {
        const record = this.store.data.plans.find(
          (p) =>
            p.id === el.dataset.id &&
            !p.deletedAt &&
            p.arcadeRecord?.kind === "poem",
        );
        if (record)
          sheet(
            `<span class="eyebrow">ВАША ОБЩАЯ ПОЭЗИЯ · ${new Date(record.createdAt).toLocaleDateString("ru-RU")}</span><h2>Наш стих</h2><div class="poem-sheet">${esc(record.arcadeRecord.poem).replaceAll("\n", "<br>")}</div>`,
          );
        return;
      }
      if (action === "circuit-home") {
        this.circuitMenu();
        return;
      }
      if (action === "beacon-home") {
        this.beaconMenu();
        return;
      }
      if (action === "beacon-start") {
        this.start("beacon", {
          beacon: true,
          length: Number(el.dataset.length),
        });
        return;
      }
      if (action === "beacon-resume") {
        this.openTable("beacon");
        return;
      }
      if (action === "beacon-record") {
        const record = this.store.data.plans.find(
          (r) =>
            r.id === el.dataset.id &&
            !r.deletedAt &&
            r.arcadeRecord?.kind === "beacon" &&
            r.arcadeRecord.rulesVersion === BEACON_RULES,
        );
        if (record) {
          this.opened = false;
          sheet(beaconRecordView(record, this.store));
        }
        return;
      }
      if (action === "beacon-action") {
        const input = {
          action: el.dataset.beaconAction,
          index: Number(el.dataset.index),
          value: Number(el.dataset.value),
          turn: this.frame.public.turn,
        };
        if (
          input.action === "beacon-launch" &&
          this.frame.public.module.id === "pendulum"
        ) {
          const secret = this.secrets.get(
            this.frame.round + ":" + this.frame.public.turn,
          )?.machine;
          if (!secret) return;
          let measure = ((Date.now() - secret.clockStart) / secret.period) % 1;
          if (secret.direction) measure = 1 - measure;
          input.measure = measure;
        }
        this.input(input);
        return;
      }
      if (action === "circuit-start") {
        this.start("race", {
          circuit: true,
          length: Number(el.dataset.length),
        });
        return;
      }
      if (action === "circuit-resume") {
        this.openTable("race");
        return;
      }
      if (action === "run-hold") {
        if (!this.holdStart) {
          this.holdStart = performance.now();
          el.textContent = "Отпустить свет";
        } else {
          this.input({
            action: "run-hit",
            turn: this.frame.public.turn,
            measure: performance.now() - this.holdStart,
          });
          this.holdStart = 0;
        }
        return;
      }
      if (action === "run-action") {
        const data = {
          action: el.dataset.runAction,
          turn: this.frame.public.turn,
          value: Number(el.dataset.value),
        };
        if (data.action === "run-hit") {
          const clock = document.querySelector("[data-run-clock]");
          const elapsed =
            (Date.now() - Number(clock.dataset.start)) /
            Number(clock.dataset.period);
          if (elapsed < 0) {
            toast("Сейчас загорится свет — приготовьтесь");
            return;
          }
          let measure =
            clock.dataset.runClock === "rhythm"
              ? elapsed
              : (elapsed + Number(clock.dataset.offset || 0)) % 1;
          if (
            clock.dataset.runClock === "timing" &&
            this.frame.public.trial.variant &&
            this.frame.public.players.findIndex((p) => p.id === this.userId) % 2
          )
            measure = 1 - measure;
          data.measure = measure;
        }
        this.input(data);
        return;
      }
      if (action === "focus") {
        const expanded = document
          .querySelector("#sheet")
          .classList.toggle("game-expanded");
        el.textContent = expanded ? "Обычный вид" : "На весь экран";
        el.setAttribute("aria-pressed", String(expanded));
        return;
      }
      if (action === "voice") {
        this.voice = Number(el.dataset.index) || 0;
        this.controls();
        return;
      }
      if (action === "join") {
        this.open();
        return;
      }
      if (action === "solo" && this.hosting) {
        this.state.solo = true;
        this.state.players = this.state.players.filter(
          (u) => u.id === this.userId,
        );
        this.state.joined = [this.userId];
        this.state.readyPlayers = [this.userId];
        if (this.state.kind === "meditation") arrangeMeditation(this.state);
        else if (this.state.kind === "soundgarden")
          for (let i = 1; i < 4; i++)
            this.state.contributors[this.userId + ":voice" + i] = {
              layers: [1, 1, 1, 0, 0, 0, 0, 0],
              moods: [0.55, 0.3, 0.6, 0.7],
              pads: [
                [0.25 + i * 0.12, 0.35 + i * 0.1],
                [0.45, 0.65],
              ],
            };
        this.beginIfReady();
        this.broadcast();
        return;
      }
      if (action === "round-back") {
        this.input({ action });
        return;
      }
      if (action === "invite" && this.hosting && !this.state.invitedAt) {
        this.state.invitedAt = Date.now();
        this.broadcast();
        toast("Приглашение активно — ваш человек увидит его в играх");
        return;
      }
      if (action === "cancel-lobby" && this.hosting) {
        await this.finish();
        closeSheet();
        toast("Лобби закрыто. Приглашение больше не активно");
        return;
      }
      if (
        action === "ready" ||
        action === "not-ready" ||
        action === "draw-solved" ||
        action === "draw-skip"
      ) {
        this.input({ action });
        return;
      }
      if (action.startsWith("deck-")) {
        this.input({
          action,
          value: el.dataset.value,
          index: this.frame.public.index,
        });
        return;
      }
      if (action.startsWith("mission-") || action === "island-next") {
        this.input({
          action,
          value: Number(el.dataset.value),
          turn: this.frame.public.turn,
        });
        return;
      }
      if (action === "frequency-spoken") {
        this.input({ action });
        return;
      }
      if (action === "player-open") {
        this.openTable(this.audioFrame?.kind || this.frame.kind);
        return;
      }
      if (action === "player-stop") {
        if (this.audioFrame)
          this.peer?.sendInput({
            round: this.audioFrame.round,
            action: "audio-close",
          });
        this.audio?.destroy();
        this.audio = null;
        this.audioFrame = null;
        this.player();
        if (this.opened) this.controls();
        return;
      }

      if (action === "view-record" || action === "screen-record") {
        this.viewRecord(el.dataset.id, action === "screen-record");
        return;
      }
      if (action === "view-team-record") {
        const record = this.store.data.plans.find(
          (r) =>
            r.id === el.dataset.id &&
            !r.deletedAt &&
            r.arcadeRecord?.rulesVersion === CIRCUIT_VERSION,
        );
        if (record) {
          this.opened = false;
          sheet(circuitRecordView(record, this.store));
        }
        return;
      }
      if (action === "delete-record") {
        const record = this.store.data.plans.find(
          (r) => r.id === el.dataset.id && r.arcadeRecord && !r.deletedAt,
        );
        if (record) {
          await this.store.remove("plans", record.id);
          this.showRecords();
          toast("Результат удалён из общей выставки");
        }
        return;
      }
      if (action === "frequency-next" && this.hosting)
        await this.frequencyNext();
      if (
        action === "frequency-reveal" &&
        this.hosting &&
        revealFrequency(this.state)
      )
        this.broadcast();
      if (action === "museum-caption") this.input({ action: "museum-caption" });
      if (action === "museum-vote")
        this.input({ action: "museum-vote", choice: el.dataset.choice });
      if (action === "museum-next" && this.hosting) this.museumNext();
      if (action === "museum-advance" && this.hosting) {
        if (this.state.phase === "draw") {
          this.state.phase = "captions";
          this.broadcast();
        } else if (this.state.phase === "captions") this.museumVote();
        else if (this.state.phase === "vote") this.museumReveal();
      }
      if (action === "step")
        this.input({ action: "step", side: Number(el.dataset.side) });
      if (action === "rotate")
        this.input({ action: "rotate", index: Number(el.dataset.index) });
      if (action === "layer")
        this.input({ action: "layer", index: Number(el.dataset.index) });
      if (action === "ink-color") this.inkColor = Number(el.dataset.index);
      if (action === "leave-table") {
        this.input({ action: "leave" });
        closeSheet();
        return;
      }
      if (action === "music-shuffle") {
        this.input({ action });
        return;
      }
      if (action === "local-mute") {
        if (this.audio) {
          this.audio.muted = !this.audio.muted;
          this.audio.volume(this.audio.level);
        }
        this.controls();
        return;
      }
      if (action === "sound") {
        if (this.audio?.started && this.audio.context?.state === "running") {
          this.peer?.sendInput({
            round: this.audioFrame.round,
            action: "audio-pause",
            paused: true,
          });
          await this.audio?.stop();
        } else {
          this.audioFrame ||= this.frame;
          this.audio ||= new NatureSound(this.options.soundSeed());
          await this.audio.start();
          this.audio.apply(
            this.audioFrame.public.contributors,
            this.userId,
            this.audioFrame.kind,
          );
          this.peer?.sendInput({
            round: this.audioFrame.round,
            action: "audio-pause",
            paused: false,
          });
        }
        this.player();
        if (!el) return;
        el.innerHTML =
          icon(this.audio?.started ? "pause" : "play") +
          (this.audio?.started ? " Пауза" : " Продолжить");
      }
      if (action === "again" && this.hosting) this.start(this.frame.kind);
      if (action === "finish" && this.hosting) await this.finish();
      if (action === "reveal" && this.hosting) {
        if (this.state.phase === "reveal") {
          if (this.forwardRound()) return;
          this.rememberRound();
          this.state.readyPlayers = [];
          this.state.answers = {};
          this.state.phase = "play";
          this.drafts.delete(this.frame.round);
          if (this.state.kind === "word") {
            this.state.usedPrompts ||= [];
            this.state.usedPrompts.push(this.state.prompt);
            this.state.deck.index++;
            if (this.state.deck.index >= this.state.deck.order.length) {
              this.state.deck.order = sessionDeck(this.store, "word");
              this.state.deck.index = 0;
            }
            saveDeck(this.state);
            this.state.prompt = this.state.deck.order[this.state.deck.index];
            this.mark(this.state.prompt);
          }
          this.state.turn = (this.state.turn || 0) + 1;
          this.broadcast();
        } else {
          this.state.phase = "reveal";
          this.broadcast();
        }
      }
      if (action === "draw-next" && this.hosting) {
        const s = this.state;
        this.rememberDrawing(s);
        if (s.turn + 1 >= s.totalTurns) {
          await this.finish();
          return;
        }
        s.turn++;
        s.drawer = s.players[s.turn % s.players.length].id;
        s.secret =
          pictureWords[Math.floor(Math.random() * pictureWords.length)];
        s.lines = [];
        s.solved = false;
        s.skipped = false;
        s.lastGuess = "";
        this.broadcast();
        this.privateInstructions();
        this.render(true);
      }
    } catch (error) {
      toast(error.message || "Не получилось. Попробуйте ещё раз");
    }
  }
  bindDrawing() {
    const canvas = document.querySelector("#draw-pad");
    if (!canvas) return;
    let last = null,
      batch = [],
      lastSent = 0;
    const point = (e) => {
      const r = canvas.getBoundingClientRect();
      return [
        Math.round(clamp((e.clientX - r.left) / r.width) * 1000),
        Math.round(clamp((e.clientY - r.top) / r.height) * 700),
      ];
    };
    const flush = () => {
      while (batch.length) {
        this.input({ action: "ink", lines: batch.splice(0, 25) });
        lastSent = performance.now();
      }
    };
    canvas.onpointerdown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      last = point(e);
    };
    canvas.onpointermove = (e) => {
      if (!last) return;
      const next = point(e),
        line = [...last, ...next, this.inkColor || 0];
      if (Math.hypot(next[0] - last[0], next[1] - last[1]) < 3) return;
      batch.push(line);
      const ctx = canvas.getContext("2d");
      ctx.strokeStyle = ["#6b527f", "#ed7798", "#5c9b8a", "#ce9b4b"][
        this.inkColor || 0
      ];
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(...last);
      ctx.lineTo(...next);
      ctx.stroke();
      last = next;
      if (performance.now() - lastSent > 80) flush();
    };
    canvas.onpointerup = canvas.onpointercancel = () => {
      flush();
      last = null;
    };
    this.paint();
  }
  paint() {
    const canvas = document.querySelector("#draw-pad");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 1000, 700);
    for (const line of this.frame.public.lines || []) {
      ctx.strokeStyle = ["#6b527f", "#ed7798", "#5c9b8a", "#ce9b4b"][line[4]];
      ctx.lineWidth = 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(line[0], line[1]);
      ctx.lineTo(line[2], line[3]);
      ctx.stroke();
    }
  }
  bindTouch() {
    const pad = document.querySelector("#sound-touch");
    if (!pad) return;
    let active = false,
      last = 0;
    const touch = (e) => {
      if (!active || performance.now() - last < 100) return;
      last = performance.now();
      const r = pad.getBoundingClientRect(),
        x = clamp((e.clientX - r.left) / r.width),
        y = clamp((e.clientY - r.top) / r.height);
      pad.style.setProperty("--x", x * 100 + "%");
      pad.style.setProperty("--y", y * 100 + "%");
      this.input({ action: "mood", index: 0, value: x });
      this.input({ action: "mood", index: 2, value: 1 - y });
    };
    pad.onpointerdown = (e) => {
      active = true;
      pad.setPointerCapture(e.pointerId);
      touch(e);
    };
    pad.onpointermove = touch;
    pad.onpointerup = pad.onpointercancel = () => (active = false);
  }
}
