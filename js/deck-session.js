import { sessionDeck, cardKey, gamePool } from "./game-pools.js";
import { gameBoxes } from "../data/presentation.js";
import { esc, icon } from "./ui.js";
export const deckKinds = [
  "questions",
  "mixed",
  "choice",
  "likely",
  "riddles",
  "echo",
  "prediction",
  "mime",
];
export const deckTitle = (k) => gameBoxes.find((g) => g.id === k)?.title || k;
export function initDeck(s, store) {
  const key = `${store.roomId}:table-deck:${s.kind}`;
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(key));
  } catch {}
  const fresh = sessionDeck(store, s.kind),
    valid = new Set(fresh.map(cardKey));
  if (saved?.order?.length) {
    const known = new Set(saved.order.map(cardKey));
    const added = fresh.filter((c) => !known.has(cardKey(c)));
    const index = Math.min(saved.index || 0, saved.order.length);
    s.deck = {
      ...saved,
      order: [
        ...saved.order.slice(0, index + 1),
        ...added,
        ...saved.order.slice(index + 1),
      ],
    };
  } else
    s.deck = {
      order: fresh,
      index: 0,
      choices: {},
      reveals: {},
      picked: {},
      truthCursor: 0,
      dareCursor: 0,
    };
  s.deck.key = key;
  s.deck.choices ||= {};
  s.deck.reveals ||= {};
  s.deck.picked ||= {};
  s.deck.truths ||= fresh.filter((x) => String(x).startsWith("Правда · "));
  s.deck.dares ||= fresh.filter((x) => String(x).startsWith("Действие · "));
  s.deck.truthCursor ||= 0;
  s.deck.dareCursor ||= 0;
  saveDeck(s);
}
export function saveDeck(s) {
  try {
    localStorage.setItem(s.deck.key, JSON.stringify(s.deck));
  } catch {}
}
export function deckPublic(s) {
  const d = s.deck,
    i = d.index,
    item = s.kind === "mixed" ? d.picked[i] : d.order[i],
    raw = typeof item === "object" ? item.title : String(item || ""),
    host = s.players[i % s.players.length];
  return {
    index: i,
    total:
      s.kind === "mixed" ? d.truths.length + d.dares.length : d.order.length,
    card:
      s.kind === "mime" && !d.reveals[i]
        ? "Задание видно только исполнителю. Угадывайте по движениям."
        : s.kind === "riddles"
          ? raw
          : raw.replace(/^(Правда|Действие) · /, ""),
    answer: s.kind === "riddles" && d.reveals[i] ? item?.answer : "",
    deadline: d.deadlines?.[i],
    phase: d.phases?.[i] || 0,
    revealed: !!d.reveals[i],
    choices: d.reveals[i] ? d.choices[i] || {} : {},
    voted: Object.keys(d.choices[i] || {}),
    active: host?.id,
    activeName: host?.name,
    selected: s.kind === "mixed" ? !!item : true,
    type: raw.startsWith("Действие") ? "Действие" : "Правда",
    done: s.kind !== "mixed" && i >= d.order.length,
  };
}
export function deckCommand(s, sender, input, store) {
  const d = s.deck,
    i = d.index;
  if (input.index != null && input.index !== i) return false;
  if (input.action === "deck-next" && s.kind !== "mixed" && i >= d.order.length)
    return false;
  if (input.action === "deck-back" && i > 0) d.index--;
  else if (input.action === "deck-next") {
    if (s.kind === "mixed" && !d.picked[i]) return false;
    d.index++;
  } else if (input.action === "deck-reveal") d.reveals[i] = true;
  else if (
    input.action === "deck-perform" &&
    s.players[i % s.players.length].id === sender
  ) {
    d.deadlines ||= {};
    d.deadlines[i] = Date.now() + 45000;
  } else if (input.action === "deck-phase") {
    d.phases ||= {};
    d.phases[i] = (d.phases[i] || 0) + 1;
  } else if (
    input.action === "deck-choice" &&
    s.kind === "choice" &&
    !d.reveals[i] &&
    [0, 1].includes(Number(input.value))
  ) {
    (d.choices[i] ||= {})[sender] = Number(input.value);
    if (s.players.every((u) => Object.hasOwn(d.choices[i], u.id)))
      d.reveals[i] = true;
  } else if (
    input.action === "deck-pick" &&
    s.kind === "mixed" &&
    s.players[i % s.players.length].id === sender &&
    !d.picked[i]
  ) {
    const type = input.value === "dare" ? "dare" : "truth",
      pool = d[type === "dare" ? "dares" : "truths"],
      cursor = type + "Cursor";
    if (!pool.length) return false;
    d.picked[i] = pool[d[cursor] % pool.length];
    d[cursor]++;
  } else if (input.action === "deck-restart" && i >= d.order.length) {
    d.order = sessionDeck(store, s.kind);
    d.index = 0;
    d.choices = {};
    d.reveals = {};
  } else return false;
  saveDeck(s);
  return true;
}
export function deckScreen(f) {
  const p = f.public;
  return `<div class="shared-deck"><span class="eyebrow">${esc(p.activeName || "Ваш ход")} · ${p.index + 1} / ${p.total}</span><div class="table-card"><span class="card-suit">${icon("games")}</span><p>${p.done ? "Вся колода сыграна" : !p.selected ? "Правда или действие?" : esc(p.card)}</p></div>${p.answer ? `<div class="answer-reveal"><h3>Разгадка</h3><p>${esc(p.answer)}</p></div>` : ""}${f.kind === "choice" ? (p.revealed ? `<div class="door-results">${p.players.map((u) => `<span>${esc(u.name)} · ${p.choices[u.id] === 0 ? "Левая дверь" : "Правая дверь"}</span>`).join("")}</div><p>Выборы открыты. Обсуждайте столько, сколько хочется.</p>` : `<p>${p.voted.length} / ${p.players.length} выбрали · раскроем одновременно</p>`) : ""}</div>`;
}
export function deckControls(f, user, secret = {}) {
  const p = f.public,
    b = (label, action, extra = "") =>
      `<button class="btn soft" data-party="${action}" ${extra}>${label}</button>`;
  if (p.done) return b("Назад", "deck-back") + b("Новый круг", "deck-restart");
  const content =
    f.kind === "mime" && !p.revealed
      ? `${p.active === user ? `<div class="private-instructions"><span>ТОЛЬКО ВАМ</span><h3>${esc(secret.prompt || "Получаем задание…")}</h3></div>` : `<p>Показывает ${esc(p.activeName)}. Угадывайте вслух.</p>`}${p.deadline ? `<strong data-countdown="${p.deadline}">${Math.max(0, Math.ceil((p.deadline - Date.now()) / 1000))}</strong>${b("Угадали · открыть задание", "deck-reveal")}` : p.active === user ? b("Начать 45 секунд", "deck-perform") : "<p>Исполнитель начнёт, когда будет готов.</p>"}`
      : ["prediction", "echo"].includes(f.kind)
        ? `<p>${p.phase === 0 ? "Сначала предположите вслух, как ответит ваш человек." : "Теперь ваш человек отвечает сам. Обсудите, что совпало и что удивило."}</p>${p.phase === 0 ? b("Прогноз готов · настоящий ответ", "deck-phase") : ""}`
        : f.kind === "mixed" && !p.selected
          ? p.active === user
            ? `<div class="door-buttons">${b("Правда", "deck-pick", 'data-value="truth"')}${b("Действие", "deck-pick", 'data-value="dare"')}</div>`
            : `<p>Сейчас выбирает ${esc(p.activeName)}.</p>`
          : f.kind === "choice" && !p.revealed
            ? `<div class="door-buttons">${b("Левая дверь", "deck-choice", 'data-value="0"')}${b("Правая дверь", "deck-choice", 'data-value="1"')}</div><p>${p.voted.includes(user) ? "Ваш выбор принят. Можно изменить до раскрытия." : "Коснитесь двери. Чужой выбор пока скрыт."}</p>`
            : f.kind === "riddles" && !p.revealed
              ? `<p>Задавайте вопросы вслух. Ведущий отвечает «да», «нет» или «неважно».</p>${p.active === user ? `<details class="private-instructions"><summary>Тайный ответ ведущего</summary><p>${esc(secret.answer || "Получаем ответ…")}</p></details>${b("Показать разгадку всем", "deck-reveal")}` : "<p>Разгадку откроет ведущий.</p>"}`
              : "";
  return `${content}<div class="deck-navigation">${b(icon("back") + " Назад", "deck-back", p.index ? "" : "disabled")}${b("Дальше " + icon("arrow"), "deck-next", !p.selected || (f.kind === "choice" && !p.revealed) ? "disabled" : "")}</div><p class="fine">Один стол, одна колода. Возвращайтесь на любую предыдущую карточку.</p>`;
}
