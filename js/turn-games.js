import { esc, icon, sheet, toast } from "./ui.js";
import { gamePool, cardKey } from "./game-pools.js";
import { markRead, unreadEvents } from "./activity.js";

export const TURN_WORLD = "wordworld";
const records = (store) =>
  store.data.plans.filter(
    (r) => !r.deletedAt && r.worldEvent?.world === TURN_WORLD,
  );
const idFor = (store, suffix) => `${store.roomId}:word:${suffix}`;
export function turnState(store) {
  const events = records(store)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => ({
      ...r.worldEvent,
      id: r.id,
      author: r.authorId,
    }));
  const packs = events
    .filter((e) => e.type === "pack")
    .sort((a, b) => a.number - b.number);
  const answers = events.filter((e) => e.type === "turn-answer");
  const reveals = events.filter((e) => e.type === "reveal");
  return { packs, answers, reveals, current: packs.at(-1) };
}
function hash(text) {
  let n = 2166136261;
  for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
export function nextTurnCards(store, state = turnState(store)) {
  const used = new Set(state.packs.flatMap((p) => p.cards.map((c) => c.key)));
  const pool = gamePool(store, "word");
  const custom = new Set(
    store.data.customTasks
      .filter((r) => !r.deletedAt && ["question", "truth"].includes(r.kind))
      .map((r) => cardKey(r.title)),
  );
  const fresh = pool.filter((p) => !used.has(cardKey(p)));
  // Exhaust the remaining deck before repeating; a short last pack is intentional.
  return (fresh.length ? fresh : pool)
    .sort(
      (a, b) =>
        Number(custom.has(cardKey(b))) - Number(custom.has(cardKey(a))) ||
        hash(store.roomId + ":" + state.packs.length + a) -
          hash(store.roomId + ":" + state.packs.length + b),
    )
    .slice(0, 4)
    .map((text) => ({ key: cardKey(text), text }));
}
export async function saveTurn(store, suffix, event) {
  return store.save("plans", {
    id: idFor(store, suffix),
    title: "Созвучия",
    items: [],
    worldEvent: { world: TURN_WORLD, at: Date.now(), ...event },
  });
}
export async function reconcileTurns(store) {
  if (
    !store.authEstablished ||
    store.authViewer ||
    store.authRoster?.[0]?.id !== store.userId
  )
    return;
  let state = turnState(store);
  const pack = state.current;
  if (pack) {
    for (let index = 0; index < pack.cards.length; index++) {
      if (state.reveals.some((r) => r.pack === pack.id && r.index === index))
        continue;
      const answers = pack.players.map((id) =>
        state.answers.find(
          (a) => a.pack === pack.id && a.index === index && a.author === id,
        ),
      );
      if (answers.every((a) => a?.ready && a.text.trim())) {
        await saveTurn(store, `reveal:${pack.number}:${index}`, {
          type: "reveal",
          pack: pack.id,
          index,
          text: pack.cards[index].text,
          answers: answers.map((a) => ({ author: a.author, text: a.text })),
        });
      }
    }
    state = turnState(store);
    if (
      !pack.cards.every((_, index) =>
        state.reveals.some((r) => r.pack === pack.id && r.index === index),
      )
    )
      return;
  }
  const players = (store.authRoster || []).map((p) => p.id);
  if (players.length < 2) return;
  const number = (pack?.number || 0) + 1;
  await saveTurn(store, `pack:${number}`, {
    type: "pack",
    number,
    players,
    cards: nextTurnCards(store, state),
  });
}
export function turnScreen(frame) {
  const p = frame.public || {};
  return `<section class="persistent-world turn-scene"><span class="eyebrow">ВМЕСТЕ ИЛИ В СВОЁМ РИТМЕ</span><h2>Созвучия</h2><p class="turn-scene-question">${esc(p.text || "Четыре вопроса, несколько взглядов. Ответьте, когда удобно.")}</p>${p.answers ? `<div class="turn-revealed">${p.answers.map((a) => `<article><small>${esc(a.name)}</small><p>${esc(a.text)}</p></article>`).join("")}</div>` : p.text ? `<p>${p.ready || 0} из ${p.total || 2} готовы. До раскрытия ответы остаются за карточкой.</p>` : ""}</section>`;
}

export class TurnGames {
  constructor(options) {
    this.options = options;
    this.pending = false;
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-turn]");
      if (b)
        this.action(b).catch((error) =>
          toast(error.message || "Не удалось сохранить ответ"),
        );
    });
    document.addEventListener("submit", (e) => {
      if (e.target.id !== "turn-answer-form") return;
      e.preventDefault();
      this.submit(e.target).catch((error) =>
        toast(error.message || "Не удалось сохранить ответ"),
      );
    });
    document.querySelector("#sheet").addEventListener("close", () => {
      this.opened = false;
    });
  }
  get store() {
    return this.options.store();
  }
  changed() {
    this.dirty = true;
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(async () => {
      try {
        while (this.dirty) {
          this.dirty = false;
          await reconcileTurns(this.store);
        }
        if (
          this.opened &&
          document.querySelector(".turn-panel") &&
          !document.querySelector("#turn-answer-form:focus-within")
        )
          this.render();
      } catch (error) {
        console.error("Turn reconciliation", error);
      } finally {
        this.pending = false;
      }
    });
  }
  open(event) {
    this.opened = true;
    this.packId = event?.pack || null;
    this.index = event?.index ?? null;
    this.history = false;
    this.render();
    document.querySelector("#sheet").scrollTop = 0;
    this.changed();
    if (
      !turnState(this.store).current &&
      this.store.authEstablished &&
      !this.store.authViewer
    ) {
      saveTurn(this.store, `request:${this.store.userId}`, {
        type: "request",
      }).catch((error) => toast(error.message));
    }
  }
  localDraftKey(pack, index) {
    return `vmeste:turn-draft:${this.store.roomId}:${this.store.userId}:${pack.id}:${index}`;
  }
  render() {
    if (!this.opened || !this.store) return;
    const state = turnState(this.store),
      pack = state.packs.find((p) => p.id === this.packId) || state.current;
    const unread = unreadEvents(this.store).filter(
      (e) => e.world === TURN_WORLD,
    );
    let content;
    let scene = { kind: TURN_WORLD, public: {} };
    if (!pack) {
      content = `<div class="empty"><h3>Соберём ваши первые созвучия</h3><p>Пригласите второго участника в комнату. После первого обмена набор из четырёх вопросов сохранится у обоих, и каждый сможет отвечать отдельно.</p></div>`;
    } else if (this.index == null) {
      const packs = this.history ? [...state.packs].reverse() : [state.current];
      content = `${unread.length ? `<button class="letters-digest" data-action="activity" data-world-filter="${TURN_WORLD}"><span>${icon("letter")}</span><span><strong>Есть новые общие ответы</strong><small>Раскрыто карточек: ${unread.length}</small></span><b>${unread.length}</b></button>` : ""}<div class="letters-toolbar"><button class="btn ${this.history ? "soft" : "primary"}" data-turn="current">Новые вопросы</button><button class="btn ${this.history ? "primary" : "soft"}" data-turn="history">${icon("clock")} Все наборы</button></div>${packs
        .map(
          (p) =>
            `<h3>Набор ${p.number}${p.id === state.current.id ? " · текущий" : ""}</h3><div class="letter-inbox">${p.cards
              .map((c, index) => {
                const reveal = state.reveals.find(
                  (r) => r.pack === p.id && r.index === index,
                );
                const own = state.answers.find(
                  (a) =>
                    a.pack === p.id &&
                    a.index === index &&
                    a.author === this.store.userId,
                );
                return `<button class="letter-preview" data-turn="card" data-pack="${esc(p.id)}" data-index="${index}"><span class="letter-icon">${icon(reveal ? "check" : "letter")}</span><span><strong>${esc(c.text)}</strong><small>${reveal ? "Общие ответы открыты" : own?.ready ? "Ваш ответ готов · ждём остальных" : "Можно ответить, когда удобно"}</small></span>${unread.some((e) => e.id === reveal?.id) ? '<b aria-label="Новое раскрытие">●</b>' : icon("arrow")}</button>`;
              })
              .join("")}</div>`,
        )
        .join(
          "",
        )}<p class="fine">Все отвечают на сохранённый набор. Когда готовые ответы встретятся при синхронизации, они раскроются; после всего набора появится следующий. Одновременно играть тоже можно.</p>`;
    } else {
      this.packId = pack.id;
      const index = Math.max(
        0,
        Math.min(pack.cards.length - 1, Number(this.index)),
      );
      this.index = index;
      const reveal = state.reveals.find(
        (r) => r.pack === pack.id && r.index === index,
      );
      const own = state.answers.find(
        (a) =>
          a.pack === pack.id &&
          a.index === index &&
          a.author === this.store.userId,
      );
      const ready = state.answers.filter(
        (a) => a.pack === pack.id && a.index === index && a.ready,
      ).length;
      scene.public = {
        text: pack.cards[index].text,
        ready,
        total: pack.players.length,
      };
      if (reveal) {
        markRead(this.store, [reveal.id]);
        scene.public.answers = reveal.answers.map((a) => ({
          text: a.text,
          name:
            this.store.users.find((u) => u.localUserId === a.author)
              ?.displayName || "Ваш человек",
        }));
      }
      const draft = localStorage.getItem(this.localDraftKey(pack, index));
      content = `<button class="btn text" data-turn="back">${icon("back")} Все вопросы</button><p class="fine">Набор ${pack.number} · ${index + 1} / ${pack.cards.length}</p>${reveal ? '<p class="center">Ваши ответы сохранены здесь. Можно возвращаться к ним и обсуждать сколько хочется.</p>' : `<form id="turn-answer-form"><label>Ваша мысль<textarea name="text" maxlength="1500" required placeholder="Можно подумать и вернуться позже…" ${own?.ready ? "disabled" : ""}>${esc(draft ?? own?.text ?? "")}</textarea></label><button class="btn ${own?.ready ? "soft" : "primary"} wide" ${own?.ready ? 'type="button" data-turn="unready"' : 'type="submit"'}>${own?.ready ? "Отменить готовность и изменить" : "Готово"}</button><p class="fine">${own?.ready ? "Ответ сохранён. Он раскроется, когда будут готовы все участники и устройства обменяются данными." : "До общего раскрытия готовность можно отменить. Черновик остаётся на этом устройстве."}</p></form>`}<div class="letters-toolbar"><button class="btn soft" data-turn="previous" ${index === 0 ? "disabled" : ""}>${icon("back")} Назад</button><button class="btn soft" data-turn="next" ${index === pack.cards.length - 1 ? "disabled" : ""}>Следующий ${icon("arrow")}</button></div>`;
    }
    sheet(
      `<div class="turn-panel">${turnScreen(scene)}${content}<p class="world-offline-note">${icon("check")} Ходы сохраняются без сети. Передача новых ответов требует соединения устройств; письма не хранятся на сервере.</p></div>`,
    );
    const input = document.querySelector("#turn-answer-form textarea");
    if (input && pack)
      input.addEventListener("input", () =>
        localStorage.setItem(this.localDraftKey(pack, this.index), input.value),
      );
    if (pack)
      this.options.peer()?.publishGame({
        ...scene,
        roomId: this.store.roomId,
        round: `${this.store.roomId}:wordworld`,
        title: "Созвучия",
        text:
          scene.public.text || "Ответьте на сохранённые вопросы, когда удобно.",
        revision: Date.now(),
        createdAt: 0,
        stage: "persistent",
      });
  }
  async submit(form) {
    const text = new FormData(form).get("text")?.trim();
    if (!text) return;
    const state = turnState(this.store),
      pack = state.packs.find((p) => p.id === this.packId);
    if (
      !pack ||
      state.reveals.some((r) => r.pack === pack.id && r.index === this.index)
    ) {
      this.render();
      return;
    }
    if (!pack.players.includes(this.store.userId)) return;
    form.querySelector("button").disabled = true;
    await saveTurn(
      this.store,
      `answer:${pack.number}:${this.index}:${this.store.userId}`,
      {
        type: "turn-answer",
        pack: pack.id,
        index: this.index,
        text: text.slice(0, 1500),
        ready: true,
      },
    );
    localStorage.removeItem(this.localDraftKey(pack, this.index));
    this.render();
    this.changed();
  }
  async action(b) {
    const action = b.dataset.turn;
    if (action === "current" || action === "back") {
      this.index = null;
      this.packId = null;
      this.history = false;
    }
    if (action === "history") {
      this.index = null;
      this.history = true;
    }
    if (action === "card") {
      this.index = Number(b.dataset.index);
      this.packId = b.dataset.pack;
    }
    if (action === "next") this.index++;
    if (action === "previous") this.index--;
    if (action === "unready") {
      const state = turnState(this.store),
        pack = state.packs.find((p) => p.id === this.packId);
      const answer = state.answers.find(
        (a) =>
          a.pack === this.packId &&
          a.index === this.index &&
          a.author === this.store.userId,
      );
      if (
        pack &&
        answer &&
        !state.reveals.some((r) => r.pack === pack.id && r.index === this.index)
      )
        await saveTurn(
          this.store,
          `answer:${pack.number}:${this.index}:${this.store.userId}`,
          { ...answer, ready: false },
        );
    }
    this.render();
    document.querySelector("#sheet").scrollTop = 0;
  }
}
