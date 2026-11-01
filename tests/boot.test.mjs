import test from "node:test";
import assert from "node:assert/strict";
import { Database } from "../js/db.js";

test("a stuck IndexedDB open times out and closes a late connection without deleting data", async () => {
  const original = globalThis.indexedDB;
  const request = {};
  let closed = false;
  globalThis.indexedDB = { open: () => request };
  try {
    await assert.rejects(
      new Database("preserved-room").open(15),
      /Хранилище не ответило/,
    );
    request.result = {
      close: () => {
        closed = true;
      },
    };
    request.onsuccess();
    assert.equal(closed, true);
  } finally {
    globalThis.indexedDB = original;
  }
});
