export const TABLES = [
  "ideas",
  "reactions",
  "plans",
  "customTasks",
  "users",
  "meta",
];
export class Database {
  constructor(name = "vmeste-v1") {
    this.name = name;
  }
  async open(timeout = 12000) {
    this.db = await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        reject(
          Error(
            "Хранилище не ответило. Закройте другие окна приложения и попробуйте снова.",
          ),
        );
      }, timeout);
      const r = indexedDB.open(this.name, 1);
      r.onupgradeneeded = () => {
        for (const name of TABLES)
          r.result.createObjectStore(name, { keyPath: "id" });
      };
      r.onsuccess = () => {
        clearTimeout(timer);
        if (settled) return r.result.close();
        settled = true;
        r.result.onversionchange = () => r.result.close();
        resolve(r.result);
      };
      r.onerror = () => {
        clearTimeout(timer);
        settled = true;
        reject(r.error);
      };
    });
    return this;
  }
  async all(table, roomId) {
    return (await this.request(table, "readonly", (s) => s.getAll())).filter(
      (r) => r.roomId === roomId,
    );
  }
  request(table, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(table, mode);
      const r = action(tx.objectStore(table));
      tx.oncomplete = () => resolve(r.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || Error("Хранилище недоступно"));
    });
  }
  async put(table, record) {
    await this.request(table, "readwrite", (s) => s.put(record));
  }
  async batch(entries) {
    if (!entries.length) return;
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction(
        [...new Set(entries.map((e) => e.table))],
        "readwrite",
      );
      for (const { table, record } of entries)
        tx.objectStore(table).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  async clearRoom(roomId) {
    const entries = (
      await Promise.all(
        TABLES.map(async (table) =>
          (await this.all(table, roomId)).map((record) => ({ table, record })),
        ),
      )
    ).flat();
    await new Promise((resolve, reject) => {
      const tx = this.db.transaction(TABLES, "readwrite");
      for (const e of entries) tx.objectStore(e.table).delete(e.record.id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  close() {
    this.db.close();
  }
}
