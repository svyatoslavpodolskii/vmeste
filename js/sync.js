export const SYNC_TABLES = [
  "ideas",
  "reactions",
  "plans",
  "customTasks",
  "users",
];
export function compare(a, b) {
  if (!b) return 1;
  return (
    a.updatedAt - b.updatedAt ||
    a.version - b.version ||
    String(a.writerId || "").localeCompare(String(b.writerId || "")) ||
    JSON.stringify(a).localeCompare(JSON.stringify(b))
  );
}
export function signature(r) {
  let hash = 2166136261;
  for (const char of JSON.stringify(r))
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return [r.updatedAt, r.version, r.writerId || "", (hash >>> 0).toString(16)];
}
export function validRecord(table, r, roomId) {
  if (
    !SYNC_TABLES.includes(table) ||
    !r ||
    typeof r !== "object" ||
    Array.isArray(r) ||
    r.roomId !== roomId ||
    typeof r.id !== "string" ||
    r.id.length > 200 ||
    !Number.isFinite(r.updatedAt) ||
    !Number.isInteger(r.version) ||
    r.version < 1 ||
    JSON.stringify(r).length > 60000
  )
    return false;
  if (r.deletedAt != null && !Number.isFinite(r.deletedAt)) return false;
  if (table === "ideas" || table === "customTasks")
    return (
      typeof r.title === "string" &&
      r.title.length > 0 &&
      r.title.length <= 160 &&
      (!r.description ||
        (typeof r.description === "string" && r.description.length <= 4000)) &&
      (!r.duration || Number.isFinite(r.duration)) &&
      (!r.cost || Number.isFinite(r.cost))
    );
  if (table === "reactions")
    return (
      typeof r.ideaId === "string" &&
      typeof r.userId === "string" &&
      r.id === `${roomId}:${r.ideaId}:${r.userId}` &&
      ["like", "skip", "favorite", "none"].includes(r.reaction)
    );
  if (table === "users")
    return (
      typeof r.displayName === "string" &&
      r.displayName.length <= 60 &&
      typeof r.localUserId === "string" &&
      r.id === `${roomId}:${r.localUserId}`
    );
  if (table === "plans") {
    if (
      r.historyOwner != null &&
      (typeof r.historyOwner !== "string" ||
        r.historyOwner.length > 100 ||
        !r.played ||
        typeof r.played !== "object" ||
        Array.isArray(r.played) ||
        Object.entries(r.played).length > 300 ||
        Object.entries(r.played).some(
          ([key, time]) =>
            key.length > 100 || !Number.isFinite(time) || time < 0,
        ))
    )
      return false;
    if (
      r.discoveryOwner != null &&
      (typeof r.discoveryOwner !== "string" ||
        !["plan", "discover"].includes(r.discoveryMode) ||
        !Array.isArray(r.remaining) ||
        !Array.isArray(r.seen) ||
        r.remaining.length > 1500 ||
        r.seen.length > 1500 ||
        [...r.remaining, ...r.seen].some(
          (id) => typeof id !== "string" || id.length > 200,
        ))
    )
      return false;
    if (
      r.arcadeRecord != null &&
      (!r.arcadeRecord ||
        typeof r.arcadeRecord.kind !== "string" ||
        !Number.isFinite(r.arcadeRecord.seconds) ||
        r.arcadeRecord.seconds < 0 ||
        !Array.isArray(r.arcadeRecord.players) ||
        r.arcadeRecord.players.length > 10 ||
        r.arcadeRecord.players.some((id) => typeof id !== "string"))
    )
      return false;
    return (
      typeof r.title === "string" &&
      r.title.length <= 160 &&
      Array.isArray(r.items) &&
      r.items.length <= 100 &&
      r.items.every((i) => typeof i === "string")
    );
  }
  return false;
}
export function metadata(store) {
  return Object.fromEntries(
    SYNC_TABLES.map((t) => [
      t,
      Object.fromEntries(store.data[t].map((r) => [r.id, signature(r)])),
    ]),
  );
}
export function delta(store, remote) {
  const result = [];
  for (const t of SYNC_TABLES)
    for (const r of store.data[t])
      if (JSON.stringify(remote?.[t]?.[r.id]) !== JSON.stringify(signature(r)))
        result.push({ table: t, record: r });
  return result;
}
export class Sync {
  constructor(store, send, status) {
    this.store = store;
    this.send = send;
    this.status = status;
    this.queue = Promise.resolve();
  }
  hello() {
    this.send({
      type: "meta",
      roomId: this.store.roomId,
      meta: metadata(this.store),
    });
  }
  receive(msg) {
    this.queue = this.queue
      .then(() => this.process(msg))
      .catch(() => this.status("Не удалось сохранить изменения"));
    return this.queue;
  }
  async process(msg) {
    if (!msg || msg.roomId !== this.store.roomId) return;
    if (msg.type === "meta") {
      this.status("Синхронизация…");
      const changes = delta(this.store, msg.meta);
      for (let i = 0; i < changes.length; i += 25)
        this.send({
          type: "records",
          roomId: this.store.roomId,
          entries: changes.slice(i, i + 25),
        });
      this.send({ type: "done", roomId: this.store.roomId });
    } else if (
      msg.type === "records" &&
      Array.isArray(msg.entries) &&
      msg.entries.length <= 100
    ) {
      await this.store.merge(msg.entries);
    } else if (msg.type === "done") {
      this.status("Всё синхронизировано");
    }
  }
  changed(entries) {
    this.send({ type: "records", roomId: this.store.roomId, entries });
  }
}
