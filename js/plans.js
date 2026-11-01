export function surprise(
  ideas,
  { location = "Дома", minutes = 120, score = () => 0 } = {},
) {
  const pool = ideas.filter(
    (i) =>
      (!location || i.location === location || i.location === "Где угодно") &&
      i.duration <= minutes,
  );
  const picked = [],
    used = new Set();
  let total = 0;
  const fitting = pool.filter((i) => i.duration <= minutes / 2);
  for (const idea of shuffle(fitting.length >= 2 ? fitting : pool).sort(
    (a, b) => score(b) - score(a),
  )) {
    if (picked.length >= Math.max(2, Math.min(6, Math.ceil(minutes / 45))))
      break;
    if (used.has(idea.category) || total + idea.duration > minutes) continue;
    picked.push(idea.id);
    used.add(idea.category);
    total += idea.duration;
  }
  return picked;
}
export function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function reorder(items, from, to) {
  const result = [...items];
  if (from < 0 || to < 0 || from >= items.length || to >= items.length)
    return result;
  result.splice(to, 0, result.splice(from, 1)[0]);
  return result;
}

export function preference(store, idea) {
  const rs = store.data.reactions.filter(
    (r) =>
      r.ideaId === idea.id &&
      !r.deletedAt &&
      ["like", "favorite"].includes(r.reaction),
  );
  return rs.reduce((n, r) => n + (r.reaction === "favorite" ? 4 : 2), 0);
}
export function recommendations(store, draft = [], { discover = false } = {}) {
  const chosen = store.ideas.filter((i) => draft.includes(i.id));
  return store.ideas
    .filter(
      (i) =>
        !draft.includes(i.id) &&
        (!discover || (!ownLiked(store, i.id) && !completedIdea(store, i.id))),
    )
    .sort((a, b) => {
      const score = (i) =>
        preference(store, i) * 10 +
        chosen.reduce(
          (n, c) =>
            n +
            (c.mood === i.mood ? 3 : 0) +
            (c.location === i.location ? 1 : 0),
          0,
        );
      return score(b) - score(a);
    });
}

export function ownLiked(store, id) {
  return store.data.reactions.some(
    (r) =>
      r.ideaId === id &&
      r.userId === store.userId &&
      !r.deletedAt &&
      ["like", "favorite"].includes(r.reaction),
  );
}
export function completedIdea(store, id) {
  return store.data.plans.some(
    (p) => !p.deletedAt && p.completedIdea === id && p.completedAt,
  );
}
export function partnerPreference(store, id) {
  return store.data.reactions
    .filter(
      (r) =>
        r.ideaId === id &&
        r.userId !== store.userId &&
        !r.deletedAt &&
        ["like", "favorite"].includes(r.reaction),
    )
    .reduce((n, r) => n + (r.reaction === "favorite" ? 4 : 2), 0);
}
