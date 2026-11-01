import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { Database } from "../js/db.js";
import { Store } from "../js/store.js";
import {
  gamePool,
  sessionDeck,
  playedHistory,
  cardKey,
} from "../js/game-pools.js";
import { gardenState, worldScreen } from "../js/worlds.js";
import { activityEvents, unreadEvents, markRead } from "../js/activity.js";
import { initDeck, deckCommand, deckPublic } from "../js/deck-session.js";
import { initCircuit, circuitTrials } from "../js/coop-circuit.js";
import { enrichIdea } from "../data/topics.js";
const values = new Map();
globalThis.localStorage = {
  getItem: (k) => values.get(k) || null,
  setItem: (k, v) => values.set(k, v),
};
const make = async (user) =>
  new Store(
    await new Database(crypto.randomUUID()).open(),
    "repair-room",
    user,
  ).load();
test("answered shared letters join the common question pool at the tail; targeted letters remain targeted", async () => {
  const s = await make("a");
  for (const [id, text, target] of [
    ["q", "Откуда берётся вдохновение?", null],
    ["private", "Личный вопрос", "b"],
  ]) {
    await s.save("plans", {
      id,
      title: "Письмо",
      items: [],
      worldEvent: {
        world: "lettersworld",
        at: 100,
        type: "question",
        text,
        target,
      },
    });
    await s.save("plans", {
      id: "answer-" + id,
      title: "Ответ",
      items: [],
      worldEvent: {
        world: "lettersworld",
        at: 200,
        type: "answer",
        text: "Ответ",
        question: id,
      },
    });
  }
  assert.ok(gamePool(s, "questions").includes("Откуда берётся вдохновение?"));
  assert.ok(!gamePool(s, "questions").includes("Личный вопрос"));
  assert.equal(playedHistory(s)[cardKey("Откуда берётся вдохновение?")], 200);
  assert.equal(
    sessionDeck(s, "questions").at(-1),
    "Откуда берётся вдохновение?",
  );
});
test("thousands of wishes keep unique plots, dates, authors, water and safe escaped text", async () => {
  const s = await make("a");
  for (let i = 0; i < 1001; i++)
    await s.save("plans", {
      title: "Пожелание",
      items: [],
      worldEvent: {
        world: "gardenworld",
        type: "plant",
        plot: "wish-" + i,
        species: "unique",
        text: "<script>пожелание " + i + "</script>",
        at: 1000 + i,
      },
    });
  const state = gardenState(s, 10000000);
  assert.equal(state.plots.length, 1001);
  assert.equal(new Set(state.plots.map((p) => p.plot)).size, 1001);
  assert.equal(state.plots[0].at, 1000);
  assert.equal(state.plots[0].author, "a");
  const html = worldScreen({
    kind: "gardenworld",
    public: { ...state, plots: state.plots.slice(0, 2) },
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("hsl("));
});
test("daily mood validates metrics, syncs and updates the same day without overwriting another participant", async () => {
  const a = await make("a"),
    b = await make("b");
  const entry = {
    day: "2026-11-01",
    note: "Хороший день",
    mood: 4,
    energy: 3,
    calm: 5,
  };
  const id = "repair-room:mood:a:" + entry.day;
  await a.save("plans", {
    id,
    title: "Настроение",
    items: [],
    moodEntry: entry,
  });
  await b.merge([
    { table: "plans", record: a.data.plans.find((p) => p.id === id) },
  ]);
  assert.equal(
    b.data.plans.find((p) => p.id === id).moodEntry.note,
    entry.note,
  );
  await a.save("plans", { id, moodEntry: { ...entry, mood: 2 } });
  assert.equal(a.data.plans.filter((p) => p.moodEntry).length, 1);
  await assert.rejects(
    a.save("plans", { id, moodEntry: { ...entry, mood: 6 } }),
  );
});
test("who is more likely hides votes until both phones choose and supports revisions before reveal", async () => {
  const store = await make("a");
  const s = { kind: "likely", players: [{ id: "a" }, { id: "b" }] };
  initDeck(s, store);
  assert.ok(deckCommand(s, "a", { action: "deck-choice", value: "b" }, store));
  assert.deepEqual(deckPublic(s).choices, {});
  assert.ok(deckCommand(s, "a", { action: "deck-choice", value: "a" }, store));
  assert.ok(deckCommand(s, "b", { action: "deck-choice", value: "b" }, store));
  assert.deepEqual(deckPublic(s).choices, { a: "a", b: "b" });
});
test("matches persist in notifications until read; semantic illustration picks music versus photo albums", async () => {
  const s = await make("a");
  const idea = s.ideas[0];
  await s.react(idea.id, "like");
  await s.save("reactions", {
    id: `repair-room:${idea.id}:b`,
    ideaId: idea.id,
    userId: "b",
    reaction: "like",
  });
  const event = activityEvents(s).find((e) => e.world === "matches");
  assert.ok(event);
  assert.ok(unreadEvents(s).some((e) => e.id === event.id));
  markRead(s, [event.id]);
  assert.ok(!unreadEvents(s).some((e) => e.id === event.id));
  assert.equal(
    enrichIdea({ title: "Альбом целиком" }).image,
    "./assets/music.svg",
  );
  assert.equal(
    enrichIdea({ title: "Альбом наших моментов" }).image,
    "./assets/photo.svg",
  );
  assert.equal(enrichIdea({ title: "Парная зарядка" }).topic, "Спорт");
});
test("short firefly route uses understandable visible actions rather than orbit algebra", () => {
  for (let i = 0; i < 30; i++) {
    const s = { round: "easy-" + i, players: [{ id: "a" }, { id: "b" }] };
    initCircuit(s, 8);
    assert.equal(s.route.length, 8);
    assert.ok(
      !s.route.some(
        (id) => circuitTrials.find((t) => t.id === id).family === "orbit",
      ),
    );
  }
});

test("backgrounding pauses game clocks, removes readiness and resumes without charging absent time", async () => {
  const { updateGamePresence } = await import("../js/game-protocol.js");
  const state = {
    kind: "race",
    stage: "running",
    started: 1000,
    q: { started: 1200 },
    readyPlayers: ["a", "b"],
    deck: { deadlines: { 0: 5000 } },
  };
  updateGamePresence(state, "b", false, 2000);
  assert.equal(state.pausedAt, 2000);
  assert.deepEqual(state.readyPlayers, ["a"]);
  updateGamePresence(state, "a", false, 2500);
  updateGamePresence(state, "b", true, 3000);
  assert.equal(state.pausedAt, 2000);
  updateGamePresence(state, "a", true, 7000);
  assert.equal(state.pausedAt, 0);
  assert.equal(state.started, 6000);
  assert.equal(state.q.started, 6200);
  assert.equal(state.deck.deadlines[0], 10000);
});
