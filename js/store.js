import { SYNC_TABLES, compare, validRecord } from "./sync.js";
import { builtinIdeas } from "../data/ideas.js";
export class Store extends EventTarget {
  constructor(db, roomId, userId) {
    super();
    this.db = db;
    this.roomId = roomId;
    this.userId = userId;
    this.data = {};
    this.clock = 0;
    this.queue = Promise.resolve();
  }
  async load() {
    for (const table of SYNC_TABLES)
      this.data[table] = await this.db.all(table, this.roomId);
    this.clock = Math.max(
      0,
      ...Object.values(this.data)
        .flat()
        .map((r) => r.updatedAt),
    );
    return this;
  }
  get ideas() {
    return [
      ...this.data.ideas
        .filter((r) => !r.deletedAt)
        .sort((a, b) => b.createdAt - a.createdAt),
      ...builtinIdeas.map((i) => ({ ...i, roomId: this.roomId })),
    ].filter((i) => !this.data.ideas.find((r) => r.id === i.id && r.deletedAt));
  }
  get users() {
    return this.data.users.filter(
      (r) =>
        !r.deletedAt &&
        !r.provisional &&
        (!this.authRoster ||
          this.authRoster.some((m) => m.id === r.localUserId)),
    );
  }
  reaction(id, userId = this.userId) {
    return this.data.reactions.find(
      (r) => r.ideaId === id && r.userId === userId && !r.deletedAt,
    )?.reaction;
  }
  get matches() {
    return this.ideas.filter(
      (i) =>
        new Set(
          this.data.reactions
            .filter(
              (r) =>
                r.ideaId === i.id &&
                (!this.authRoster ||
                  this.authRoster.some((m) => m.id === r.userId)) &&
                !r.deletedAt &&
                ["like", "favorite"].includes(r.reaction),
            )
            .map((r) => r.userId),
        ).size >= 2,
    );
  }
  async save(table, fields) {
    const previous = this.data[table].find((r) => r.id === fields.id);
    const now = Math.max(Date.now(), this.clock + 1);
    this.clock = now;
    const record = {
      ...previous,
      ...fields,
      id: fields.id || crypto.randomUUID(),
      roomId: this.roomId,
      authorId: fields.authorId || previous?.authorId || this.userId,
      createdAt: previous?.createdAt || now,
      updatedAt: now,
      version: (previous?.version || 0) + 1,
      writerId: this.userId,
    };
    if (!validRecord(table, record, this.roomId))
      throw Error("Проверьте заполненные поля");
    await this.merge([{ table, record }], true);
    return record;
  }
  merge(entries, local = false) {
    const operation = async () => {
      const accepted = [];
      for (const { table, record: incoming } of entries) {
        let record = incoming;
        if (!validRecord(table, record, this.roomId)) continue;
        const pending = accepted.find(
          (e) => e.table === table && e.record.id === record.id,
        );
        const old =
          pending?.record || this.data[table].find((r) => r.id === record.id);
        let historyChanged = false;
        if (
          table === "plans" &&
          record.historyOwner &&
          old?.historyOwner === record.historyOwner
        ) {
          const played = { ...(old.played || {}) };
          for (const [key, time] of Object.entries(record.played || {}))
            played[key] = Math.max(played[key] || 0, time);
          const merged = Object.fromEntries(
            Object.entries(played)
              .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
              .slice(0, 300),
          );
          historyChanged =
            JSON.stringify(merged) !== JSON.stringify(old.played || {});
          record = {
            ...(compare(record, old) > 0 ? record : old),
            played: merged,
          };
        }
        if (historyChanged || compare(record, old) > 0) {
          if (pending) pending.record = record;
          else accepted.push({ table, record });
        }
      }
      await this.db.batch(accepted);
      for (const { table, record } of accepted) {
        this.data[table] = this.data[table]
          .filter((r) => r.id !== record.id)
          .concat(record);
        this.clock = Math.max(this.clock, record.updatedAt);
      }
      if (accepted.length)
        this.dispatchEvent(
          new CustomEvent("change", { detail: { entries: accepted, local } }),
        );
      return accepted.length;
    };
    this.queue = this.queue.then(operation, operation);
    return this.queue;
  }
  react(ideaId, reaction) {
    return this.save("reactions", {
      id: `${this.roomId}:${ideaId}:${this.userId}`,
      ideaId,
      userId: this.userId,
      reaction,
    });
  }
  remove(table, id) {
    return this.save(table, { id, deletedAt: Date.now() });
  }
  export() {
    return {
      format: "vmeste",
      schema: 1,
      roomId: this.roomId,
      exportedAt: new Date().toISOString(),
      entries: SYNC_TABLES.flatMap((table) =>
        this.data[table].map((record) => ({ table, record })),
      ),
    };
  }
  async import(input) {
    if (
      input?.format !== "vmeste" ||
      input.schema !== 1 ||
      input.roomId !== this.roomId ||
      !Array.isArray(input.entries) ||
      input.entries.length > 10000 ||
      !input.entries.every(
        (e) => e && validRecord(e.table, e.record, this.roomId),
      )
    )
      throw Error("Это не резервная копия этой комнаты или файл повреждён");
    return this.merge(input.entries, true);
  }
}
