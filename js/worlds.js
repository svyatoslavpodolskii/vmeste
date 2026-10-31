import { readIds, markRead, unreadEvents } from "./activity.js";
import { esc, icon, sheet, toast } from "./ui.js";
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
  for (const p of plots.values()) {
    p.waters = events.filter(
      (e) => e.type === "water" && e.plot === p.plot && e.at >= p.at,
    ).length;
    p.stage = Math.min(
      4,
      1 + Math.floor(Math.max(0, now - p.at) / 900000) + Math.min(2, p.waters),
    );
    p.bloom = p.stage === 4;
    p.color = species.find((s) => s[0] === p.species)[2];
    p.name = species.find((s) => s[0] === p.species)[1];
  }
  return {
    plots: [...plots.values()],
    waters: events.filter((e) => e.type === "water").length,
    events: events.slice(-8),
    bloom: [...plots.values()].filter((p) => p.bloom).length,
  };
}
const stories = [
  "В камне слышится далёкий прибой. Здесь стоит остановиться.",
  "На ветке висит фонарь. Кажется, кто-то уже ждал вас.",
  "Тропа хранит отпечатки двух разных подошв.",
  "Вы нашли чашку с нарисованной луной.",
  "В старом письме одно слово: «Возвращайтесь».",
  "Среди травы мерцает маленький кристалл.",
  "Отсюда видно место, где можно построить обсерваторию.",
  "Ветер приносит мелодию из трёх нот.",
];
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
  return {
    chapter,
    latest,
    tiles: [...tiles.values()],
    built: [...built],
    events: turn.slice(-5),
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
  return `<svg viewBox="0 0 120 130" class="garden-flower flower-${p.species}" style="--petal:${p.color};--growth:${p.stage}" aria-hidden="true"><path d="M60 121Q56 85 61 53" stroke="#7f9a78" fill="none" stroke-width="4"/><path d="M59 99Q25 100 31 77Q53 75 59 99m1-16q29 1 28-22-24 0-28 22" fill="#a8bd92"/>${p.stage >= 2 ? Array.from({ length: p.species === "sun" ? 9 : 5 }, (_, i) => `<ellipse cx="60" cy="35" rx="${p.species === "fern" ? 7 : 12}" ry="${14 + p.stage * 2}" fill="var(--petal)" transform="rotate(${i * (p.species === "sun" ? 40 : 72)} 60 55)"/>`).join("") : `<ellipse cx="61" cy="55" rx="10" ry="16" fill="var(--petal)"/>`}<circle cx="60" cy="55" r="${p.stage >= 3 ? 10 : 5}" fill="#f6e1ad"/>${p.bloom ? '<circle cx="96" cy="22" r="2" fill="#f7e6b7"/><circle cx="20" cy="60" r="3" fill="#f7e6b7"/>' : ""}</svg>`;
}
export function worldScreen(frame) {
  const p = frame.public || {};
  if (frame.kind === "lettersworld")
    return `<section class="persistent-world letters-world"><span class="eyebrow">МОЖНО ОТВЕТИТЬ ПОЗЖЕ</span><h2>Между строк</h2><div class="letters-constellation" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<span style="--n:${i}">${icon("letter")}</span>`).join("")}</div><p>${p.questionCount || 0} вопросов · ${p.answerCount || 0} ответов</p><p>Личные ответы остаются на ваших телефонах. А здесь — тихое место вашей переписки.</p></section>`;
  if (frame.kind === "gardenworld")
    return `<section class="persistent-world garden-world"><span class="eyebrow">РАСТЁТ, ДАЖЕ КОГДА ВЫ ДАЛЕКО</span><h2>Сад встреч</h2><p>${p.bloom || 0} цветов распустилось · ${p.waters || 0} тёплых дождей</p><div class="garden-landscape">${(p.plots || []).map((plot) => `<article class="garden-plot">${flower(plot)}<strong>${esc(plot.name)}</strong><small>${esc(p.players?.find((u) => u.id === plot.author)?.name || "Ваш сад")} · ${plot.bloom ? "Цветёт" : "Растёт"}</small></article>`).join("") || '<div class="garden-empty"><span>🌱</span><h3>Здесь появится ваш общий сад</h3><p>Посадите первый росток на телефоне.</p></div>'}</div></section>`;
  const known = new Set((p.tiles || []).map((t) => t.tile)),
    available = (n) =>
      known.has(n) ||
      [n % 5 > 0 ? n - 1 : -1, n % 5 < 4 ? n + 1 : -1, n - 5, n + 5].some((v) =>
        known.has(v),
      );
  return `<section class="persistent-world atlas-world"><span class="eyebrow">ЭКСПЕДИЦИЯ ${p.chapter + 1}</span><h2>Атлас тихих открытий</h2><p>${known.size} / 25 мест · ${p.built?.length || 0} / 3 общих маяков</p><div class="atlas-map">${Array.from({ length: 25 }, (_, n) => `<span class="atlas-tile terrain-${hash(frame.roomId + ":" + p.chapter + ":" + n) % 4} ${known.has(n) ? "known" : available(n) ? "nearby" : "fog"}"><b>${known.has(n) ? ["♧", "≈", "△", "✦"][hash(frame.roomId + ":" + p.chapter + ":" + n) % 4] : available(n) ? "·" : ""}</b><small>${n + 1}</small></span>`).join("")}</div><div class="atlas-landmarks">${["Обсерватория", "Дом историй", "Световой мост"].map((n, i) => `<span class="${p.built?.includes(i) ? "built" : ""}">${icon(["star", "story", "link"][i])}${n}</span>`).join("")}</div></section>`;
}
export class WorldGames {
  constructor(options) {
    this.options = options;
    this.opened = false;
    this.kind = null;
    document.addEventListener("submit", (e) => {
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
        "#world-question-form:focus-within,#world-answer-form:focus-within",
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
      `<div class="world-panel">${worldScreen(f)}<div id="world-controls">${this.kind === "lettersworld" ? this.lettersControls() : this.kind === "gardenworld" ? this.gardenControls(p) : this.atlasControls(p)}</div><p class="world-offline-note">${icon("check")} Каждый ход сохранён на этом устройстве. Когда вы встретитесь в сети, мир объединится.</p></div>`,
    );
    this.opened = true;
    this.options.peer()?.publishGame(f);
  }
  lettersControls() {
    const state = lettersState(this.store),
      read = readIds(this.store),
      me = this.store.userId;
    if (this.lettersView === "compose")
      return `<button class="btn text" data-world="letters-inbox">${icon("back")} Письма</button><form id="world-question-form"><label>О чём спросим?<textarea name="text" maxlength="700" required placeholder="Что сегодня сделало твой день чуть лучше?"></textarea></label><label>Кому<select name="target"><option value="">Нашему кругу</option>${this.store.users
        .filter((u) => u.localUserId !== me)
        .map(
          (u) =>
            `<option value="${esc(u.localUserId)}">${esc(u.displayName)}</option>`,
        )
        .join(
          "",
        )}</select></label><button class="btn primary wide" type="submit">Оставить вопрос</button><p class="fine">Он сохранится здесь и прилетит вашему человеку при следующем обмене данными. Торопиться с ответом не нужно.</p></form>`;
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
    const own = p.plots.filter((b) => b.author === this.store.userId),
      free = [0, 1, 2, 3].find(
        (i) => !own.some((p) => p.plot === this.store.userId + ":" + i),
      );
    return `<div class="world-action-heading"><h3>Ваши ростки</h3><span>${own.length} / 4</span></div>${free != null ? `<p>Выберите семя. Сосед увидит новый росток после обмена изменениями.</p><div class="seed-palette">${species.map(([id, name, color]) => `<button data-world="plant" data-species="${id}"><i style="background:${color}"></i><span>${name}</span></button>`).join("")}</div>` : ""}<h3>Тёплый дождь</h3><div class="garden-water-list">${p.plots.map((plot) => `<button class="btn soft" data-world="water" data-plot="${esc(plot.plot)}">${icon("water")} Полить ${esc(plot.name)}</button>`).join("") || "<p>Сначала посадите семя.</p>"}</div><p class="fine">Растения растут и без открытого приложения. Вода ускоряет рост; одному цветку достаточно одного полива от каждого человека за четыре часа.</p>`;
  }
  atlasControls(p) {
    const known = new Set(p.tiles.map((t) => t.tile)),
      neighbors = Array.from({ length: 25 }, (_, n) => n).filter(
        (n) =>
          !known.has(n) &&
          [n % 5 > 0 ? n - 1 : -1, n % 5 < 4 ? n + 1 : -1, n - 5, n + 5].some(
            (v) => known.has(v),
          ),
      );
    return `<div class="atlas-explore"><h3>Куда отправимся?</h3><p>Открывайте соседние места в своём ритме. Ваш человек сможет продолжить с любого края общей карты.</p><div class="exploration-choices">${neighbors.map((n) => `<button class="btn soft" data-world="explore" data-tile="${n}">Тропа ${n + 1}</button>`).join("")}</div>${p.tiles.length >= 5 ? `<h3>Оставьте маяк для вашего человека</h3><div class="exploration-choices">${["Обсерватория", "Дом историй", "Световой мост"].map((n, i) => `<button class="btn lavender" data-world="build" data-landmark="${i}" ${p.built.includes(i) ? "disabled" : ""}>${n}${p.built.includes(i) ? " · построен" : ""}</button>`).join("")}</div>` : ""}${p.complete ? '<button class="btn primary wide" data-world="next-chapter">Новая экспедиция · сохранить эту в атласе</button>' : ""}<div class="atlas-journal">${p.events
      .filter((e) => e.type === "explore")
      .map(
        (e) =>
          `<article><small>Тропа ${e.tile + 1}</small><p>${stories[hash(this.store.roomId + ":" + p.chapter + ":" + e.tile) % stories.length]}</p></article>`,
      )
      .reverse()
      .join("")}</div></div>`;
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
      if (!plot) return;
      const id = `${this.store.roomId}:water:${this.store.userId}:${plot.plot}:${Math.floor(Date.now() / 14400000)}`;
      if (this.store.data.plans.some((p) => p.id === id)) {
        toast("Этот росток уже получил ваш дождь. Загляните позже.");
        return;
      }
      await this.save({ type: "water", plot: plot.plot }, id);
    }
    if (action === "explore") {
      const s = atlasState(this.store, this.chapter),
        n = Number(b.dataset.tile),
        known = new Set(s.tiles.map((t) => t.tile));
      if (
        !Number.isInteger(n) ||
        n < 0 ||
        n >= 25 ||
        known.has(n) ||
        ![n % 5 > 0 ? n - 1 : -1, n % 5 < 4 ? n + 1 : -1, n - 5, n + 5].some(
          (v) => known.has(v),
        )
      )
        return;
      await this.save({ type: "explore", tile: n, chapter: s.chapter });
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
