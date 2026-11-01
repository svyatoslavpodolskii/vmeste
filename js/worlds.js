import { readIds, markRead, unreadEvents } from "./activity.js";
import { esc, icon, sheet, toast } from "./ui.js";
import { discoveryAt, atlasMap, atlasNotebook } from "./atlas.js";
export const worldKinds = ["gardenworld", "atlasworld", "lettersworld"];
export const worldTitles = {
  gardenworld: "Сад встреч",
  atlasworld: "Атлас тихих открытий",
  lettersworld: "Между строк",
};
const species = [
  ["luna", "Лунный цветок", "#c1afd9"],
  ["fern", "Папоротник", "#94b397"],
  ["sun", "Солнечная ромашка", "#e4c578"],
  ["coral", "Коралловый мак", "#d9909c"],
  ["blue", "Небесный колокольчик", "#98b6d4"],
  ["mint", "Мята", "#92bcae"],
  ["unique", "Цветок пожелания", "#d9909c"],
];
export const hash = (s) => {
  let n = 2166136261;
  for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
};
export function worldEvents(store, world) {
  return store.data.plans
    .filter((p) => !p.deletedAt && p.worldEvent?.world === world)
    .map((p) => ({ ...p.worldEvent, author: p.authorId, id: p.id }))
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}
export function gardenState(store, now = Date.now()) {
  const events = worldEvents(store, "gardenworld"),
    plots = new Map();
  for (const e of events)
    if (
      e.type === "plant" &&
      typeof e.plot === "string" &&
      species.some((s) => s[0] === e.species)
    )
      plots.set(e.plot, { ...e, waters: 0 });
  for (const event of events) {
    const plot = plots.get(event.plot);
    if (!plot || event.at < plot.at) continue;
    if (event.type === "release") plot.archived = true;
    if (event.type === "restore") plot.archived = false;
    if (event.type === "water") {
      plot.wateredAt ||= {};
      if (event.at - (plot.wateredAt[event.author] ?? -Infinity) >= 86400000) {
        plot.waters++;
        plot.wateredAt[event.author] = event.at;
      }
    }
  }
  for (const p of plots.values()) {
    p.stage = Math.min(
      4,
      1 +
        Math.floor(
          Math.max(0, now - p.at) / 172800000 + Math.min(1, p.waters / 4),
        ),
    );
    p.bloom = p.stage === 4;
    p.color =
      p.species === "unique"
        ? `hsl(${hash(p.plot) % 360} 55% 72%)`
        : species.find((s) => s[0] === p.species)[2];
    p.name = species.find((s) => s[0] === p.species)[1];
  }
  return {
    plots: [...plots.values()].filter((p) => !p.archived),
    archived: [...plots.values()].filter((p) => p.archived),
    waters: [...plots.values()].reduce((n, p) => n + p.waters, 0),
    events: events.slice(-8),
    bloom: [...plots.values()].filter((p) => !p.archived && p.bloom).length,
  };
}
export function atlasState(store, chapter) {
  const events = worldEvents(store, "atlasworld"),
    latest = Math.max(0, ...events.map((e) => Number(e.chapter) || 0));
  chapter = chapter ?? latest;
  const turn = events.filter((e) => e.chapter === chapter),
    tiles = new Map([[12, { tile: 12, author: null, type: "explore" }]]);
  for (const e of turn)
    if (
      e.type === "explore" &&
      Number.isInteger(e.tile) &&
      e.tile >= 0 &&
      e.tile < 25
    )
      tiles.set(e.tile, e);
  const built = new Set(
    turn.filter((e) => e.type === "build").map((e) => e.landmark),
  );
  [5, 13, 25].forEach((count, index) => {
    if (tiles.size >= count) built.add(index);
  });
  return {
    chapter,
    latest,
    tiles: [...tiles.values()],
    built: [...built],
    events: turn.filter((e) => e.type === "explore").slice(-100),
    complete: tiles.size === 25 && built.size === 3,
  };
}
export function lettersState(store) {
  const events = worldEvents(store, "lettersworld");
  return {
    questions: events.filter((e) => e.type === "question"),
    answers: events.filter((e) => e.type === "answer"),
    events,
  };
}
function flower(p) {
  if (p.species === "unique") {
    const seed = hash(p.plot),
      count = 5 + (seed % 9);
    const leafFamily = (seed >>> 12) % 3;
    const leaf =
      leafFamily === 0
        ? "M59 101Q19 100 29 76Q51 75 59 101m2-14q35-1 26-25-23 0-26 25"
        : leafFamily === 1
          ? "M59 103Q24 73 23 61Q47 73 59 103m2-15q31-30 35-39-26 6-35 39"
          : "M59 101l-16-3 5-7-15-4 9-6-6-9 17 9 6 20m2-15 16-1-4-7 13-5-8-4 5-9-17 12-5 14";

    return `<svg viewBox="0 0 120 130" class="garden-flower" aria-hidden="true"><path d="M60 122Q${40 + (seed % 40)} 90 60 52" stroke="#71967c" stroke-width="3" fill="none"/><path d="${leaf}" fill="hsl(${90 + (seed % 65)} 28% 65%)"/>${p.stage >= 2 ? Array.from({ length: count }, (_, i) => `<ellipse cx="60" cy="${33 + (seed % 9)}" rx="${5 + ((seed >>> 4) % 9)}" ry="${14 + ((seed >>> 8) % 11)}" fill="hsl(${(seed + i * (seed % 7)) % 360} 58% ${64 + (i % 4) * 4}%)" transform="rotate(${(i * 360) / count} 60 53)"/>`).join("") : `<ellipse cx="60" cy="53" rx="9" ry="15" fill="${p.color}"/>`}<circle cx="60" cy="53" r="${5 + (seed % 5)}" fill="hsl(${35 + (seed % 30)} 80% 82%)"/></svg>`;
  }
  return `<svg viewBox="0 0 120 130" class="garden-flower flower-${p.species}" style="--petal:${p.color};--growth:${p.stage}" aria-hidden="true"><path d="M60 121Q56 85 61 53" stroke="#7f9a78" fill="none" stroke-width="4"/><path d="M59 99Q25 100 31 77Q53 75 59 99m1-16q29 1 28-22-24 0-28 22" fill="#a8bd92"/>${p.stage >= 2 ? Array.from({ length: p.species === "sun" ? 9 : 5 }, (_, i) => `<ellipse cx="60" cy="35" rx="${p.species === "fern" ? 7 : 12}" ry="${14 + p.stage * 2}" fill="var(--petal)" transform="rotate(${i * (p.species === "sun" ? 40 : 72)} 60 55)"/>`).join("") : `<ellipse cx="61" cy="55" rx="10" ry="16" fill="var(--petal)"/>`}<circle cx="60" cy="55" r="${p.stage >= 3 ? 10 : 5}" fill="#f6e1ad"/>${p.bloom ? '<circle cx="96" cy="22" r="2" fill="#f7e6b7"/><circle cx="20" cy="60" r="3" fill="#f7e6b7"/>' : ""}</svg>`;
}
export function worldScreen(frame, interactive = false) {
  const p = frame.public || {};
  if (frame.kind === "lettersworld")
    return `<section class="persistent-world letters-world"><span class="eyebrow">МОЖНО ОТВЕТИТЬ ПОЗЖЕ</span><h2>Между строк</h2><div class="letters-constellation" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<span style="--n:${i}">${icon("letter")}</span>`).join("")}</div><p>${p.questionCount || 0} вопросов · ${p.answerCount || 0} ответов</p><p>Личные ответы остаются на ваших телефонах. А здесь — тихое место вашей переписки.</p></section>`;
  if (frame.kind === "gardenworld")
    return `<section class="persistent-world garden-world"><span class="eyebrow">РАСТЁТ, ДАЖЕ КОГДА ВЫ ДАЛЕКО</span><h2>Сад встреч</h2><p>${p.bloom || 0} цветов распустилось · ${p.waters || 0} тёплых дождей</p><div class="garden-landscape">${(p.plots || []).map((plot) => `<article class="garden-plot">${flower(plot)}<strong>${esc(plot.name)}</strong>${plot.text ? `<p class="flower-wish">${esc(plot.text)}</p>` : ""}<small>${esc(p.players?.find((u) => u.id === plot.author)?.name || "Ваш сад")} · ${new Date(plot.at).toLocaleDateString("ru-RU")} · ${plot.bloom ? "Цветёт" : "Растёт"}</small>${interactive ? `<button class="btn text" data-world="${plot.archived ? "restore" : "release"}" data-plot="${esc(plot.plot)}">${plot.archived ? "Вернуть в сад" : "Отдать вечности"}</button>` : ""}</article>`).join("") || '<div class="garden-empty"><span>🌱</span><h3>Здесь появится ваш общий сад</h3><p>Посадите первый росток на телефоне.</p></div>'}</div></section>`;
  return (
    atlasMap(frame, interactive) +
    (!interactive ? atlasNotebook(p, p.players || [], null, false) : "")
  );
}
export class WorldGames {
  constructor(options) {
    this.options = options;
    this.opened = false;
    this.kind = null;
    document.addEventListener("submit", (e) => {
      if (e.target.id === "atlas-note-form") {
        e.preventDefault();
        this.saveAtlas(e.target).catch((error) => toast(error.message));
        return;
      }
      if (e.target.id === "garden-wish-form") {
        e.preventDefault();
        const text = String(new FormData(e.target).get("text") || "").trim();
        if (!text) return;
        this.gardenPage = 0;
        this.save({
          type: "plant",
          species: "unique",
          plot: crypto.randomUUID(),
          text: text.slice(0, 700),
        }).catch((error) => toast(error.message));
        return;
      }
      if (!["world-question-form", "world-answer-form"].includes(e.target.id))
        return;
      e.preventDefault();
      const form = e.target,
        values = Object.fromEntries(new FormData(form)),
        text = String(values.text || "").trim();
      if (!text) return;
      const event =
        form.id === "world-question-form"
          ? {
              type: "question",
              text: text.slice(0, 700),
              target: values.target || null,
            }
          : {
              type: "answer",
              text: text.slice(0, 4000),
              question: form.dataset.question,
              target: form.dataset.target,
            };
      this.save(event).catch((err) =>
        toast(err.message || "Не удалось сохранить письмо"),
      );
    });
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-world]");
      if (b)
        this.action(b).catch((err) =>
          toast(err.message || "Не удалось сохранить ход"),
        );
    });
    document
      .querySelector("#sheet")
      .addEventListener("close", () => (this.opened = false));
  }
  get store() {
    return this.options.store();
  }
  async saveAtlas(form) {
    const tile = Number(form.dataset.tile),
      chapter = Number(form.dataset.chapter);
    const text = String(new FormData(form).get("text") || "").trim();
    if (
      !text ||
      !Number.isInteger(tile) ||
      tile < 0 ||
      tile > 24 ||
      tile === 12 ||
      !Number.isInteger(chapter) ||
      chapter < 0 ||
      chapter > atlasState(this.store).latest
    )
      return;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      await this.store.save("plans", {
        id: `${this.store.roomId}:atlas:${chapter}:${tile}:${this.store.userId}`,
        title: "Атлас тихих открытий",
        items: [],
        worldEvent: {
          world: "atlasworld",
          type: "explore",
          tile,
          chapter,
          text: text.slice(0, 700),
          at: Date.now(),
        },
      });
      if (this.kind === "atlasworld" && this.opened) this.render();
      toast("Находка сохранена в вашем общем атласе");
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  }
  changed(entries) {
    if (!this.store?.authEstablished || this.store.authViewer) return;
    for (const kind of new Set(
      entries
        .filter((e) => e.record.worldEvent)
        .map((e) => e.record.worldEvent.world),
    )) {
      if (!worldKinds.includes(kind)) continue;
      const previous = this.kind,
        chapter = this.chapter;
      this.kind = kind;
      this.chapter = null;
      const f = this.frame();
      this.kind = previous;
      this.chapter = chapter;
      this.options.peer()?.publishGame(f);
    }
    if (
      this.opened &&
      document.querySelector(".world-panel") &&
      !document.querySelector(
        "#world-question-form:focus-within,#world-answer-form:focus-within,#garden-wish-form:focus-within,#atlas-note-form:focus-within",
      )
    )
      this.render();
  }
  frame() {
    const letter =
      this.kind === "lettersworld" ? lettersState(this.store) : null;
    const state = letter
      ? {
          questionCount: letter.questions.length,
          answerCount: letter.answers.length,
        }
      : this.kind === "gardenworld"
        ? gardenState(this.store)
        : atlasState(this.store, this.chapter);
    if (this.kind === "gardenworld") {
      state.archiveCount = state.archived.length;
      state.showArchive = !!this.gardenArchive;
      if (this.gardenArchive) state.plots = state.archived;
      delete state.archived;
      state.total = state.plots.length;
      state.page = Math.min(
        this.gardenPage || 0,
        Math.max(0, Math.ceil(state.total / 24) - 1),
      );
      state.plots = state.plots
        .slice()
        .reverse()
        .slice(state.page * 24, (state.page + 1) * 24);
    }
    return {
      kind: this.kind,
      roomId: this.store.roomId,
      round: this.store.roomId + ":world:" + this.kind,
      title: worldTitles[this.kind],
      text: "Ваш мир сохраняет каждый ход. Можно играть отдельно и вместе.",
      revision: Date.now(),
      createdAt: 0,
      stage: "persistent",
      public: {
        ...state,
        players: this.store.users.map((u) => ({
          id: u.localUserId,
          name: u.displayName,
        })),
      },
    };
  }
  open(kind) {
    this.kind = kind;
    this.chapter = null;
    this.thread = null;
    this.atlasTile = null;
    this.lettersView = "inbox";
    this.opened = true;
    this.render();
    document.querySelector("#sheet").scrollTop = 0;
  }
  render() {
    if (!this.store || !this.kind || !this.opened) return;
    const f = this.frame(),
      p = f.public;
    sheet(
      `<div class="world-panel">${worldScreen(f, true)}<div id="world-controls">${this.kind === "lettersworld" ? this.lettersControls() : this.kind === "gardenworld" ? this.gardenControls(p) : this.atlasControls(p)}</div><p class="world-offline-note">${icon("check")} Каждый ход сохранён на этом устройстве. Когда вы встретитесь в сети, мир объединится.</p></div>`,
    );
    this.opened = true;
    this.options.peer()?.publishGame(f);
  }
  lettersControls() {
    const state = lettersState(this.store),
      read = readIds(this.store),
      me = this.store.userId;
    if (this.lettersView === "compose")
      return `<button class="btn text" data-world="letters-inbox">${icon("back")} Письма</button><form id="world-question-form"><label>О чём спросим?<textarea name="text" maxlength="700" required placeholder="Что сегодня сделало твой день чуть лучше?"></textarea></label>${
        this.store.authCapacity > 2
          ? `<label>Кому<select name="target"><option value="">Нашему кругу</option>${this.store.users
              .filter((u) => u.localUserId !== me)
              .map(
                (u) =>
                  `<option value="${esc(u.localUserId)}">${esc(u.displayName)}</option>`,
              )
              .join("")}</select></label>`
          : ""
      }<button class="btn primary wide" type="submit">Оставить вопрос</button><p class="fine">Он сохранится здесь и прилетит вашему человеку при следующем обмене данными. Торопиться с ответом не нужно.</p></form>`;
    if (this.thread) {
      const question = state.questions.find((q) => q.id === this.thread);
      if (!question) {
        this.thread = null;
        return this.lettersControls();
      }
      const answers = state.answers.filter((a) => a.question === question.id);
      const ids = [question, ...answers]
        .filter((e) => e.author !== me)
        .map((e) => e.id);
      markRead(this.store, ids);
      return `<button class="btn text" data-world="letters-inbox">${icon("back")} Все письма</button><article class="question-letter"><span class="eyebrow">${esc(this.store.users.find((u) => u.localUserId === question.author)?.displayName || "Вопрос")}</span><h3>${esc(question.text)}</h3><small>${new Date(question.at).toLocaleDateString("ru-RU")}</small></article><div class="letter-thread">${answers.map((a) => `<article id="letter-${esc(a.id)}" class="letter-answer ${a.author === me ? "own-answer" : ""}"><small>${esc(this.store.users.find((u) => u.localUserId === a.author)?.displayName || "Ваш человек")} · ${new Date(a.at).toLocaleDateString("ru-RU")}</small><p>${esc(a.text).replaceAll("\n", "<br>")}</p></article>`).join("") || '<p class="muted center">Здесь ещё будет ответ. Можно подождать столько, сколько нужно.</p>'}</div><form id="world-answer-form" data-question="${esc(question.id)}" data-target="${esc(question.author === me ? "" : question.author)}"><label>${question.author === me ? "Продолжить разговор" : "Ваш ответ"}<textarea name="text" maxlength="4000" required placeholder="Пишите, когда захочется…"></textarea></label><button class="btn primary wide" type="submit">Сохранить ответ</button></form>`;
    }
    const questions = state.questions
      .filter((q) => !q.target || q.target === me || q.author === me)
      .sort((a, b) => {
        const last = (q) =>
          Math.max(
            q.at,
            ...state.answers
              .filter((v) => v.question === q.id)
              .map((v) => v.at),
          );
        return last(b) - last(a);
      });
    const unread = unreadEvents(this.store).filter(
      (e) => e.world === "lettersworld",
    );
    const newAnswers = unread.filter((e) => e.type === "answer").length;
    return `${unread.length ? `<button class="letters-digest" data-action="activity" data-world-filter="lettersworld"><span class="activity-symbol">${icon("letter")}</span><span><strong>Есть непрочитанные письма</strong><small>${newAnswers ? `Новых ответов: ${newAnswers} · ` : ""}Всего событий: ${unread.length}</small></span><b>${unread.length}</b></button>` : ""}<div class="letters-toolbar"><button class="btn primary" data-world="letters-compose">${icon("plus")} Спросить</button><button class="btn soft" data-action="activity" data-world-filter="lettersworld">${icon("clock")} Вся история</button></div><div class="letter-inbox">${
      questions
        .map((q) => {
          const answers = state.answers.filter((a) => a.question === q.id),
            unread = [q, ...answers].filter(
              (e) => e.author !== me && !read.has(e.id),
            ).length;
          return `<button class="letter-preview ${unread ? "letter-unread" : ""}" data-world="letters-thread" data-question="${esc(q.id)}"><span class="letter-icon">${icon("letter")}</span><span><strong>${esc(q.text)}</strong><small>${q.author === me ? "Вы спросили" : esc(this.store.users.find((u) => u.localUserId === q.author)?.displayName || "Ваш человек")} · ${answers.length ? answers.length + " ответов" : "Ждёт ответа"}</small></span>${unread ? `<b>${unread}</b>` : icon("arrow")}</button>`;
        })
        .join("") ||
      '<div class="empty"><h3>Первое письмо — за вами</h3><p>Один хороший вопрос может продолжаться несколько дней.</p></div>'
    }</div>`;
  }
  openEvent(event) {
    this.kind = event.world;
    this.opened = true;
    this.chapter = null;
    this.thread =
      event.type === "answer"
        ? event.question
        : event.type === "question"
          ? event.id
          : null;
    this.lettersView = "inbox";
    markRead(this.store, [event.id]);
    this.render();
    if (event.type === "answer") {
      document
        .getElementById("letter-" + event.id)
        ?.scrollIntoView({ block: "center", behavior: "instant" });
    } else document.querySelector("#sheet").scrollTop = 0;
  }
  gardenControls(p) {
    return `<form id="garden-wish-form"><h3>Вырастить тёплые слова</h3><label>Пожелание, благодарность или мысль дня<textarea name="text" maxlength="700" required placeholder="Пусть у тебя сегодня будет повод улыбнуться…"></textarea></label><p class="fine">Из этих слов вырастет единственный цветок — со своим цветом и лепестками. Дата и автор останутся рядом.</p><button class="btn primary wide" type="submit">Посадить пожелание ${icon("plant")}</button></form><div class="letters-toolbar"><button class="btn soft" data-world="garden-newer" ${!p.page ? "disabled" : ""}>Новые цветы</button><span>${p.total} в саду</span><button class="btn soft" data-world="garden-older" ${(p.page + 1) * 24 >= p.total ? "disabled" : ""}>Раньше</button></div><button class="btn text wide" data-world="garden-archive">${p.showArchive ? "Вернуться в сад" : "Отданные вечности · " + p.archiveCount}</button><h3>Тёплый дождь</h3><p class="fine">Ваш дождь — раз в сутки для каждого ростка. Сад расцветает за несколько дней, без спешки.</p><div class="garden-water-list">${p.plots
      .filter((plot) => !plot.bloom)
      .map(
        (plot) =>
          `<button class="btn soft" data-world="water" data-plot="${esc(plot.plot)}" ${Date.now() - (plot.wateredAt?.[this.store.userId] || 0) < 86400000 || plot.archived ? "disabled" : ""}>${icon("water")} ${Date.now() - (plot.wateredAt?.[this.store.userId] || 0) < 86400000 ? "Дождь уже был сегодня" : "Полить " + esc(plot.name)}</button>`,
      )
      .join("")}</div>`;
  }
  atlasControls(p) {
    const tile = this.atlasTile,
      selected =
        Number.isInteger(tile) && tile !== 12
          ? discoveryAt(tile, p.chapter)
          : null;
    const ownNote = worldEvents(this.store, "atlasworld").find(
      (e) =>
        e.chapter === p.chapter &&
        e.tile === tile &&
        e.author === this.store.userId &&
        e.text,
    );
    return `<div class="atlas-explore">${selected ? `<button class="btn text" data-world="atlas-back">${icon("back")} Весь атлас</button><div class="atlas-invitation"><span>${icon(selected.symbol)}</span><h3>${esc(selected.title)}</h3><p>${esc(selected.prompt)}</p></div><form id="atlas-note-form" data-tile="${tile}" data-chapter="${p.chapter}"><label>Что хочется запомнить?<textarea name="text" maxlength="700" required placeholder="Пара слов о вашей находке…">${esc(ownNote?.text || "")}</textarea></label><button class="btn primary wide" type="submit">${ownNote ? "Дополнить воспоминание" : "Сохранить открытие"}</button><p class="fine">Можно сделать сейчас или вернуться позже. Ваш человек сможет оставить свою находку в том же месте.</p></form>` : `<h3>Заметили что-нибудь хорошее?</h3><p>Каждый значок на карте — небольшое задание на внимание. Откройте любое, попробуйте вместе или порознь и оставьте несколько слов. Здесь нет таймера и неправильных ответов.</p>`}<div class="letters-toolbar"><button class="btn soft" data-world="atlas-previous" ${!p.chapter ? "disabled" : ""}>Предыдущая глава</button><button class="btn soft" data-world="atlas-current" ${p.chapter === p.latest ? "disabled" : ""}>К последней</button></div>${p.complete && p.chapter === p.latest ? '<button class="btn primary wide" data-world="next-chapter">Начать новую главу · эта останется в истории</button>' : ""}${atlasNotebook(p, p.players, tile)}</div>`;
  }
  async save(event, id) {
    await this.store.save("plans", {
      id: id || crypto.randomUUID(),
      title: worldTitles[this.kind],
      items: [],
      worldEvent: { world: this.kind, at: Date.now(), ...event },
    });
    if (event.type === "question") {
      this.lettersView = "inbox";
      this.thread = null;
    }
    this.render();
  }
  async action(b) {
    if (!this.kind) return;
    const action = b.dataset.world;
    if (action === "garden-archive") {
      this.gardenArchive = !this.gardenArchive;
      this.gardenPage = 0;
      this.render();
      return;
    }
    if (action === "release" || action === "restore") {
      const state = gardenState(this.store);
      if (
        [...state.plots, ...state.archived].some(
          (p) => p.plot === b.dataset.plot,
        )
      )
        await this.save({ type: action, plot: b.dataset.plot });
      return;
    }
    if (action === "garden-newer" || action === "garden-older") {
      this.gardenPage = Math.max(
        0,
        (this.gardenPage || 0) + (action === "garden-older" ? 1 : -1),
      );
      this.render();
      document.querySelector("#sheet").scrollTop = 0;
      return;
    }
    if (action === "letters-compose") {
      this.lettersView = "compose";
      this.thread = null;
      this.render();
      return;
    }
    if (action === "letters-inbox") {
      this.lettersView = "inbox";
      this.thread = null;
      this.render();
      return;
    }
    if (action === "letters-thread") {
      this.thread = b.dataset.question;
      this.lettersView = "inbox";
      this.render();
      return;
    }
    if (action === "plant") {
      const s = gardenState(this.store),
        own = s.plots.filter((p) => p.author === this.store.userId),
        slot = [0, 1, 2, 3].find(
          (i) => !own.some((p) => p.plot === this.store.userId + ":" + i),
        );
      if (slot == null) return;
      await this.save({
        type: "plant",
        plot: this.store.userId + ":" + slot,
        species: b.dataset.species,
      });
    }
    if (action === "water") {
      const plot = gardenState(this.store).plots.find(
        (p) => p.plot === b.dataset.plot,
      );
      if (
        !plot ||
        plot.bloom ||
        Date.now() - (plot.wateredAt?.[this.store.userId] || 0) < 86400000
      )
        return;
      const id = `${this.store.roomId}:water:${this.store.userId}:${plot.plot}:${Math.floor(Date.now() / 86400000)}`;
      if (this.store.data.plans.some((p) => p.id === id)) {
        toast("Этот росток уже получил ваш дождь. Загляните позже.");
        return;
      }
      await this.save({ type: "water", plot: plot.plot }, id);
    }
    if (action === "atlas-place" || action === "explore") {
      const tile = Number(b.dataset.tile);
      if (!Number.isInteger(tile) || tile < 0 || tile > 24 || tile === 12)
        return;
      this.atlasTile = tile;
      this.render();
      document
        .querySelector("#world-controls")
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    if (["atlas-back", "atlas-previous", "atlas-current"].includes(action)) {
      if (action === "atlas-previous")
        this.chapter = Math.max(
          0,
          atlasState(this.store, this.chapter).chapter - 1,
        );
      if (action === "atlas-current") this.chapter = null;
      this.atlasTile = null;
      this.render();
      return;
    }
    if (action === "build") {
      const s = atlasState(this.store, this.chapter),
        n = Number(b.dataset.landmark);
      if (s.tiles.length < 5 || ![0, 1, 2].includes(n) || s.built.includes(n))
        return;
      await this.save({ type: "build", landmark: n, chapter: s.chapter });
    }
    if (action === "next-chapter") {
      const s = atlasState(this.store, this.chapter);
      if (!s.complete) return;
      this.chapter = s.chapter + 1;
      await this.save({ type: "chapter", chapter: this.chapter });
    }
  }
}
