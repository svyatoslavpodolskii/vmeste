import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { Database } from "../js/db.js";
import { Store } from "../js/store.js";
import { metadata, delta, validRecord } from "../js/sync.js";
import {
  turnState,
  reconcileTurns,
  saveTurn,
  nextTurnCards,
} from "../js/turn-games.js";
import { unreadEvents, markRead } from "../js/activity.js";
const local = new Map();
globalThis.localStorage = {
  getItem: (k) => local.get(k) || null,
  setItem: (k, v) => local.set(k, v),
};
async function setup(id) {
  const s = await new Store(
    await new Database(crypto.randomUUID()).open(),
    "turn-room",
    id,
  ).load();
  s.authEstablished = true;
  s.authRoster = [{ id: "A" }, { id: "B" }];
  return s;
}
async function exchange(a, b) {
  await a.merge(delta(b, metadata(a)));
  await b.merge(delta(a, metadata(b)));
}
test("offline turn batch preserves prompts, supports cancellation, reveals snapshots and issues exactly one next pack", async () => {
  const a = await setup("A"),
    b = await setup("B");
  await reconcileTurns(a);
  await exchange(a, b);
  const pack = turnState(a).current;
  assert.equal(pack.cards.length, 4);
  assert.deepEqual(turnState(b).current.cards, pack.cards);
  for (let i = 0; i < 4; i++) {
    await saveTurn(a, `answer:1:${i}:A`, {
      type: "turn-answer",
      pack: pack.id,
      index: i,
      text: `A-${i}`,
      ready: true,
    });
    await saveTurn(b, `answer:1:${i}:B`, {
      type: "turn-answer",
      pack: pack.id,
      index: i,
      text: `B-${i}`,
      ready: true,
    });
  }
  await saveTurn(b, "answer:1:0:B", {
    type: "turn-answer",
    pack: pack.id,
    index: 0,
    text: "changed B",
    ready: false,
  });
  await reconcileTurns(a);
  assert.equal(turnState(a).reveals.length, 0);
  await exchange(a, b);
  await reconcileTurns(a);
  assert.equal(turnState(a).reveals.length, 3);
  assert.equal(turnState(a).packs.length, 1);
  await saveTurn(b, "answer:1:0:B", {
    type: "turn-answer",
    pack: pack.id,
    index: 0,
    text: "final B",
    ready: true,
  });
  await exchange(a, b);
  await reconcileTurns(a);
  await reconcileTurns(a);
  await exchange(a, b);
  assert.equal(turnState(a).packs.length, 2);
  assert.deepEqual(turnState(a), turnState(b));
  assert.equal(
    turnState(a).reveals.find((r) => r.index === 0).answers[1].text,
    "final B",
  );
  assert.equal(unreadEvents(a).length, 4);
  markRead(a, [turnState(a).reveals[0].id]);
  assert.equal(unreadEvents(a).length, 3);
  assert.ok(
    turnState(a).current.cards.every(
      (c) => !pack.cards.some((p) => p.key === c.key),
    ),
  );
  const saved = structuredClone(turnState(a).reveals);
  await saveTurn(b, "answer:1:0:B", {
    type: "turn-answer",
    pack: pack.id,
    index: 0,
    text: "late stale edit",
    ready: false,
  });
  await exchange(a, b);
  await reconcileTurns(a);
  assert.deepEqual(turnState(a).reveals, saved);
  a.db.close();
  b.db.close();
});
test("new authored cards lead the next pack; schemas reject malformed payloads", async () => {
  const s = await setup("A");
  await s.save("customTasks", { kind: "question", title: "Наш новый вопрос?" });
  assert.equal(nextTurnCards(s)[0].text, "Наш новый вопрос?");
  await reconcileTurns(s);
  const record = s.data.plans[0];
  assert.ok(validRecord("plans", record, s.roomId));
  assert.equal(
    validRecord(
      "plans",
      {
        ...record,
        worldEvent: { ...record.worldEvent, cards: [{ key: "bad", text: 2 }] },
      },
      s.roomId,
    ),
    false,
  );
  s.db.close();
});
