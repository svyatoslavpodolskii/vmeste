// Everyone chooses the same lobby; a started table wins against a duplicate invitation.
export const GAME_PROTOCOL = 2;
export function selectGameScreen(current, frames, incoming, pinned = false) {
  const all = [...frames];
  if (incoming) {
    const index = all.findIndex((f) => f.kind === incoming.kind);
    if (index >= 0) all[index] = incoming;
    else all.push(incoming);
    if (incoming.kind === "exhibitworld") return incoming;
  }
  const available = (f) =>
    f && !f.ownerOffline && (!f.finished || f.stage === "persistent");
  const updated = all.find((f) => f.round === current?.round);
  if (pinned && available(updated)) return updated;
  const live = all
    .filter((f) => available(f) && ["running", "lobby"].includes(f.stage))
    .sort(
      (a, b) =>
        Number(b.stage === "running") - Number(a.stage === "running") ||
        (b.startedAt || b.createdAt || 0) - (a.startedAt || a.createdAt || 0) ||
        String(b.round).localeCompare(String(a.round)),
    );
  if (live.length) return live[0];
  if (available(updated) && updated.stage === "persistent") return updated;
  if (incoming?.stage === "persistent") return incoming;
  return updated || incoming || current;
}
export function updateGamePresence(state, member, active, now = Date.now()) {
  state.away = (state.away || []).filter((id) => id !== member);
  if (!active) {
    state.away.push(member);
    state.readyPlayers = (state.readyPlayers || []).filter(
      (id) => id !== member,
    );
  }
  if (
    state.stage !== "running" ||
    ["soundgarden", "meditation"].includes(state.kind)
  )
    return;
  if (state.away.length && !state.pausedAt) state.pausedAt = now;
  if (!state.away.length && state.pausedAt) {
    const delay = Math.max(0, now - state.pausedAt);
    for (const object of [state, state.q, state.machine])
      if (object)
        for (const key of ["started", "clockStart", "deadline"])
          if (Number.isFinite(object[key])) object[key] += delay;
    for (const [key, time] of Object.entries(state.deck?.deadlines || {}))
      state.deck.deadlines[key] = time + delay;
    state.pausedAt = 0;
  }
}
export function chooseGame(current, incoming) {
  if (
    current?.round === incoming?.round &&
    current?.closedAt &&
    !incoming?.finished
  )
    return current;
  if (!current || current.finished || !incoming) return incoming || current;
  if (current.round === incoming.round)
    return (incoming.revision || 0) >= (current.revision || 0)
      ? incoming
      : current;
  if (current.kind !== incoming.kind) return incoming;
  if (current.stage === "running" && incoming.stage === "lobby") return current;
  if (incoming.stage === "running" && current.stage === "lobby")
    return incoming;
  const a = [current.createdAt || 0, current.round || ""],
    b = [incoming.createdAt || 0, incoming.round || ""];
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? current : incoming;
}
const active = (f) =>
  f && !f.finished && ["lobby", "running"].includes(f.stage);
export function closedRoundMarker(frame, now = Date.now()) {
  return {
    kind: frame.kind,
    round: frame.round,
    title: frame.title || "Завершённая партия",
    text: "Этот стол закрыт",
    stage: "lobby",
    finished: true,
    closedAt: frame.closedAt || now,
    createdAt: frame.createdAt || 0,
    revision: frame.revision || 0,
    ownerDevice: frame.ownerDevice,
    controller: frame.controller,
    controllerClient: frame.controllerClient,
    public: { players: [], joined: [], readyPlayers: [] },
  };
}
export function rememberClosed(games, frame, now = Date.now()) {
  games.closedRounds ||= new Map();
  const marker = closedRoundMarker(frame, now);
  const previous = games.closedRounds.get(frame.round);
  if (
    previous &&
    previous.closedAt === marker.closedAt &&
    previous.revision >= marker.revision
  )
    return previous;
  games.closedRounds.delete(frame.round);
  games.closedRounds.set(frame.round, marker);
  games.closedRevision = (games.closedRevision || 0) + 1;
  if (games.closedRounds.size > 1024)
    games.closedRounds.delete(games.closedRounds.keys().next().value);
  return marker;
}
// A device owns one live table. Permanent worlds are not live lobbies.
export function acceptGameFrame(games, incoming, now = Date.now()) {
  const previous = games.get(incoming.kind);
  const retired = [];
  games.closedRounds ||= new Map();
  const closed = games.closedRounds.get(incoming.round);
  if (closed && !incoming.finished) {
    if (active(previous) && previous.round !== incoming.round)
      return { chosen: previous, retired: [closed] };
    games.set(incoming.kind, closed);
    return { chosen: closed, retired };
  }
  if (incoming.finished && ["lobby", "running"].includes(incoming.stage)) {
    incoming.closedAt ||= now;
    rememberClosed(games, incoming, now);
    if (active(previous) && previous.round !== incoming.round)
      return { chosen: previous, retired: [] };
  }
  let chosen =
    previous?.round === incoming.round && incoming.closedAt && incoming.finished
      ? incoming
      : chooseGame(previous, incoming);
  if (
    active(previous) &&
    active(incoming) &&
    previous.round !== incoming.round &&
    previous.ownerDevice &&
    previous.ownerDevice === incoming.ownerDevice
  ) {
    chosen =
      (incoming.createdAt || 0) > (previous.createdAt || 0) ||
      ((incoming.createdAt || 0) === (previous.createdAt || 0) &&
        incoming.round > previous.round)
        ? incoming
        : previous;
  }
  if (
    active(previous) &&
    active(incoming) &&
    previous.round !== incoming.round
  ) {
    const loser = chosen === incoming ? previous : incoming;
    retired.push(
      rememberClosed(
        games,
        { ...loser, closedAt: now, revision: (loser.revision || 0) + 1 },
        now,
      ),
    );
  }
  if (chosen !== incoming) return { chosen, retired };
  if (active(incoming) && incoming.ownerDevice) {
    for (const [kind, frame] of games) {
      if (
        kind === incoming.kind ||
        !active(frame) ||
        frame.ownerDevice !== incoming.ownerDevice
      )
        continue;
      const newer =
        (frame.createdAt || 0) > (incoming.createdAt || 0) ||
        ((frame.createdAt || 0) === (incoming.createdAt || 0) &&
          frame.round > incoming.round);
      if (newer) {
        chosen = {
          ...incoming,
          finished: true,
          closedAt: now,
          replacedBy: frame.round,
          revision: (incoming.revision || 0) + 1,
        };
        break;
      }
    }
    if (chosen === incoming)
      for (const [kind, frame] of games) {
        if (
          kind !== incoming.kind &&
          active(frame) &&
          frame.ownerDevice === incoming.ownerDevice
        ) {
          const closed = {
            ...frame,
            finished: true,
            closedAt: now,
            replacedBy: incoming.round,
            revision: (frame.revision || 0) + 1,
          };
          games.set(kind, closed);
          rememberClosed(games, closed, now);
          retired.push(closed);
        }
      }
  }
  games.set(chosen.kind, chosen);
  if (chosen.finished && chosen.closedAt) rememberClosed(games, chosen, now);
  return { chosen, retired };
}
