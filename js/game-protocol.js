// Everyone chooses the same lobby; a started table wins against a duplicate invitation.
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
// A device owns one live table. Permanent worlds are not live lobbies.
export function acceptGameFrame(games, incoming, now = Date.now()) {
  const previous = games.get(incoming.kind);
  let chosen = chooseGame(previous, incoming);
  const retired = [];
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
          retired.push(closed);
        }
      }
  }
  games.set(chosen.kind, chosen);
  return { chosen, retired };
}
