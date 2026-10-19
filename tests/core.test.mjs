import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { Database } from "../js/db.js";
import { Store } from "../js/store.js";
import { Sync, metadata, delta, compare, validRecord } from "../js/sync.js";
import { builtinIdeas } from "../data/ideas.js";
import { surprise, reorder } from "../js/plans.js";
const room = "test-room-with-very-long-random-id";
async function make(user) {
  return new Store(
    await new Database(crypto.randomUUID()).open(),
    room,
    user,
  ).load();
}
test("100 unique, complete built-in ideas; compatible generated evenings", () => {
  assert.equal(builtinIdeas.length, 100);
  assert.equal(new Set(builtinIdeas.map((i) => i.id)).size, 100);
  for (const i of builtinIdeas) {
    assert.ok(
      i.description &&
        i.category &&
        i.mood &&
        i.location &&
        i.duration > 0 &&
        i.cost >= 0,
    );
  }
  for (let n = 0; n < 30; n++) {
    const plan = surprise(builtinIdeas).map((id) =>
      builtinIdeas.find((i) => i.id === id),
    );
    assert.ok(plan.length >= 2 && plan.length <= 4);
    assert.ok(plan.every((i) => ["Дома", "Где угодно"].includes(i.location)));
    assert.ok(plan.reduce((a, i) => a + i.duration, 0) <= 120);
  }
});
test("offline additions merge both ways and create real matches", async () => {
  const a = await make("A"),
    b = await make("B");
  const idea = await a.save("ideas", { title: "A idea" });
  await b.save("ideas", { title: "B idea" });
  await a.react(idea.id, "like");
  await b.react(idea.id, "like");
  await a.merge(delta(b, metadata(a)));
  await b.merge(delta(a, metadata(b)));
  assert.equal(a.data.ideas.length, 2);
  assert.equal(b.data.ideas.length, 2);
  assert.equal(a.matches.length, 1);
  assert.equal(b.matches.length, 1);
  assert.deepEqual(delta(a, metadata(b)), []);
  a.db.close();
  b.db.close();
});
test("same identity does not create false match", async () => {
  const a = await make("A");
  await a.react("builtin-movie-1", "like");
  await a.react("builtin-movie-1", "favorite");
  assert.equal(a.matches.length, 0);
  a.db.close();
});
test("deletion tombstone wins over stale snapshot and survives reopen", async () => {
  const a = await make("A"),
    b = await make("B");
  const idea = await a.save("ideas", { title: "Delete me" });
  await b.merge(delta(a, metadata(b)));
  await a.remove("ideas", idea.id);
  await a.merge(delta(b, metadata(a)));
  await b.merge(delta(a, metadata(b)));
  assert.equal(
    b.ideas.some((i) => i.id === idea.id),
    false,
  );
  await b.load();
  assert.ok(b.data.ideas[0].deletedAt);
  a.db.close();
  b.db.close();
});
test("empty device receives full snapshot using metadata protocol without echo loops", async () => {
  const a = await make("A"),
    b = await make("B");
  await a.save("ideas", { title: "Restore" });
  await a.save("plans", { title: "Evening", items: ["builtin-movie-1"] });
  let sa,
    sb,
    messages = 0;
  sa = new Sync(
    a,
    (m) => {
      messages++;
      sb.receive(m);
    },
    () => {},
  );
  sb = new Sync(
    b,
    (m) => {
      messages++;
      sa.receive(m);
    },
    () => {},
  );
  sa.hello();
  sb.hello();
  await sa.queue;
  await sb.queue;
  await sa.queue;
  await sb.queue;
  assert.equal(b.data.ideas.length, 1);
  assert.equal(b.data.plans.length, 1);
  assert.ok(messages < 10);
  a.db.close();
  b.db.close();
});
test("conflicts resolve deterministically regardless of delivery order", async () => {
  const a = await make("A"),
    b = await make("B");
  const first = await a.save("ideas", { id: "shared", title: "First" });
  await b.merge([{ table: "ideas", record: first }]);
  const one = {
      ...first,
      title: "One",
      version: 2,
      updatedAt: first.updatedAt + 10,
      writerId: "A",
    },
    two = {
      ...first,
      title: "Two",
      version: 2,
      updatedAt: first.updatedAt + 10,
      writerId: "B",
    };
  await a.merge([
    { table: "ideas", record: one },
    { table: "ideas", record: two },
  ]);
  await b.merge([
    { table: "ideas", record: two },
    { table: "ideas", record: one },
  ]);
  assert.deepEqual(a.data.ideas, b.data.ideas);
  assert.equal(compare(one, two), -compare(two, one));
  a.db.close();
  b.db.close();
});
test("import validates whole backup and isolates rooms", async () => {
  const a = await make("A");
  await a.save("ideas", { title: "Keep" });
  const snapshot = a.export();
  await assert.rejects(a.import({ ...snapshot, roomId: "other" }));
  await assert.rejects(
    a.import({
      ...snapshot,
      entries: [{ table: "ideas", record: { id: "bad" } }],
    }),
  );
  assert.equal(a.data.ideas.length, 1);
  assert.equal(await a.import(snapshot), 0);
  assert.equal(
    validRecord(
      "ideas",
      { ...snapshot.entries[0].record, roomId: "other" },
      room,
    ),
    false,
  );
  a.db.close();
});
test("reactions are unique; skip removes match; saved plans can complete", async () => {
  const a = await make("A"),
    b = await make("B");
  await a.react("builtin-movie-1", "like");
  await b.react("builtin-movie-1", "favorite");
  await a.merge(delta(b, metadata(a)));
  assert.equal(a.matches.length, 1);
  await a.react("builtin-movie-1", "skip");
  assert.equal(a.matches.length, 0);
  const p = await a.save("plans", {
    title: "Plan",
    items: ["builtin-movie-1"],
  });
  await a.save("plans", { id: p.id, completedAt: Date.now() });
  assert.ok(a.data.plans[0].completedAt);
  assert.deepEqual(reorder(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
  a.db.close();
  b.db.close();
});
test("concurrent incoming batches do not overwrite newer data", async () => {
  const a = await make("A");
  const base = {
    id: "race",
    roomId: room,
    title: "old",
    updatedAt: 1,
    version: 1,
    writerId: "B",
  };
  await Promise.all([
    a.merge([
      { table: "ideas", record: { ...base, title: "new", updatedAt: 2 } },
    ]),
    a.merge([{ table: "ideas", record: base }]),
  ]);
  assert.equal(a.data.ideas[0].title, "new");
  a.db.close();
});
