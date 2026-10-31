// Everyone chooses the same lobby; a started table wins against a duplicate invitation.
export function chooseGame(current, incoming) {
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
