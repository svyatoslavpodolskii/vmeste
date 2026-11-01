import {
  questions,
  truths,
  dares,
  choices,
  likely,
  riddles,
} from "../data/games.js";
import { mimeCards } from "../data/presentation.js";
export function gamePool(store, kind) {
  const own = store.data.customTasks.filter((t) => !t.deletedAt);
  const letters = store.data.plans.filter(
    (p) => !p.deletedAt && p.worldEvent?.world === "lettersworld",
  );
  const answered = new Set(
    letters
      .filter((p) => p.worldEvent.type === "answer")
      .map((p) => p.worldEvent.question),
  );
  const sharedQuestions = letters
    .filter(
      (p) =>
        p.worldEvent.type === "question" &&
        !p.worldEvent.target &&
        answered.has(p.id),
    )
    .map((p) => p.worldEvent.text);
  const questionPool = [
    ...new Set(
      [
        ...questions,
        ...truths,
        ...sharedQuestions,
        ...own
          .filter((t) => ["question", "truth"].includes(t.kind))
          .map((t) => t.title),
      ]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  const darePool = [
    ...new Set(
      [
        ...dares,
        ...own.filter((t) => !t.kind || t.kind === "dare").map((t) => t.title),
      ]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (["questions", "echo", "prediction"].includes(kind)) return questionPool;
  if (kind === "mixed")
    return questionPool
      .map((q) => "Правда · " + q)
      .concat(darePool.map((d) => "Действие · " + d));
  return kind === "riddles"
    ? riddles
    : kind === "choice"
      ? choices
      : kind === "likely"
        ? likely
        : kind === "mime"
          ? mimeCards
          : questionPool;
}
export function cardKey(item) {
  const text = (typeof item === "object" ? item.title : String(item))
    .replace(/^(Правда|Действие) · /, "")
    .trim()
    .toLowerCase();
  let a = 2166136261,
    b = 5381;
  for (const c of text) {
    a = Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0;
    b = (Math.imul(b, 33) ^ c.charCodeAt(0)) >>> 0;
  }
  return a.toString(16) + ":" + b.toString(16);
}
export function playedHistory(store) {
  const out = {};
  for (const p of store.data.plans.filter((p) => !p.deletedAt)) {
    const event = p.worldEvent;
    if (event?.world === "lettersworld" && event.type === "answer") {
      const question = store.data.plans.find(
        (q) => q.id === event.question && !q.deletedAt,
      )?.worldEvent;
      if (question?.text && !question.target)
        out[cardKey(question.text)] = Math.max(
          out[cardKey(question.text)] || 0,
          event.at,
        );
    }
  }
  for (const p of store.data.plans.filter(
    (p) => p.historyOwner && !p.deletedAt,
  ))
    for (const [key, time] of Object.entries(p.played || {}))
      out[key] = Math.max(out[key] || 0, time);
  return out;
}
export function sessionDeck(store, kind) {
  const pool = gamePool(store, kind),
    history = playedHistory(store);
  const eligible = store.data.customTasks.filter(
    (t) =>
      !t.deletedAt &&
      (kind === "mixed" ||
        (!["mime", "choice", "likely", "riddles"].includes(kind) &&
          ["question", "truth"].includes(t.kind))),
  );
  const fresh = eligible
    .filter((t) => !history[cardKey(t.title)])
    .sort(
      (a, b) =>
        (b.authorId === store.userId) - (a.authorId === store.userId) ||
        b.createdAt - a.createdAt,
    );
  const freshKeys = new Set(fresh.map((t) => cardKey(t.title)));
  const chosen = pool
    .filter((item) => freshKeys.has(cardKey(item)))
    .sort(
      (a, b) =>
        fresh.findIndex((t) => cardKey(t.title) === cardKey(a)) -
        fresh.findIndex((t) => cardKey(t.title) === cardKey(b)),
    );
  const rotated = pool
    .filter((item) => !freshKeys.has(cardKey(item)))
    .map((item) => ({
      item,
      t: history[cardKey(item)] || 0,
      random: Math.random(),
    }))
    .sort((a, b) => a.t - b.t || a.random - b.random)
    .map((r) => r.item);
  return chosen.concat(rotated);
}
