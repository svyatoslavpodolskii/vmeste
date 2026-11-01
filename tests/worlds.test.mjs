import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { Database } from "../js/db.js";
import { Store } from "../js/store.js";
import { delta, metadata } from "../js/sync.js";
import { gardenState, atlasState, lettersState } from "../js/worlds.js";
import { unreadEvents, markRead } from "../js/activity.js";
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) || null,
  setItem: (k, v) => values.set(k, v),
};
async function store(user) {
  return new Store(
    await new Database(crypto.randomUUID()).open(),
    "world-test-room",
    user,
  ).load();
}
async function event(s, world, fields) {
  return s.save("plans", {
    title: world,
    items: [],
    worldEvent: { world, at: 100000, ...fields },
  });
}
test("independent offline gardens preserve both plants and all watering after merge", async () => {
  const a = await store("A"),
    b = await store("B");
  await event(a, "gardenworld", {
    type: "plant",
    plot: "A:0",
    species: "luna",
  });
  await event(b, "gardenworld", { type: "plant", plot: "B:0", species: "sun" });
  await event(a, "gardenworld", { type: "water", plot: "A:0", at: 100001 });
  await a.merge(delta(b, metadata(a)));
  await b.merge(delta(a, metadata(b)));
  const one = gardenState(a, 100000 + 7 * 86400000),
    two = gardenState(b, 100000 + 7 * 86400000);
  assert.deepEqual(one, two);
  assert.equal(one.plots.length, 2);
  assert.equal(one.bloom, 2);
  assert.equal(one.waters, 1);
  a.db.close();
  b.db.close();
});
test("asynchronous atlas exploration combines a union, without one player overwriting another", async () => {
  const a = await store("A"),
    b = await store("B");
  await event(a, "atlasworld", { type: "explore", tile: 11, chapter: 0 });
  await event(b, "atlasworld", { type: "explore", tile: 13, chapter: 0 });
  await a.merge(delta(b, metadata(a)));
  await b.merge(delta(a, metadata(b)));
  assert.deepEqual(atlasState(a), atlasState(b));
  assert.equal(atlasState(a).tiles.length, 3);
  a.db.close();
  b.db.close();
});
test("batch of questions produces aggregate unread count and thread reads are idempotent", async () => {
  const a = await store("A"),
    b = await store("B");
  const q = [];
  for (let i = 0; i < 10; i++)
    q.push(
      await event(a, "lettersworld", {
        type: "question",
        text: "Question " + i,
        target: "B",
        at: 100000 + i,
      }),
    );
  await b.merge(delta(a, metadata(b)));
  assert.equal(unreadEvents(b).length, 10);
  markRead(b, [q[0].id]);
  assert.equal(unreadEvents(b).length, 9);
  markRead(b, [q[0].id]);
  assert.equal(unreadEvents(b).length, 9);
  const reply = await event(b, "lettersworld", {
    type: "answer",
    text: "An answer",
    question: q[0].id,
    target: "A",
  });
  await a.merge(delta(b, metadata(a)));
  assert.equal(unreadEvents(a).length, 1);
  assert.equal(lettersState(a).answers[0].question, q[0].id);
  markRead(a, [reply.id]);
  assert.equal(unreadEvents(a).length, 0);
  a.db.close();
  b.db.close();
});
