import test from "node:test";
import assert from "node:assert/strict";
import { chooseGame } from "../js/game-protocol.js";
import { initDeck, deckCommand, deckPublic } from "../js/deck-session.js";
import {
  initExpedition,
  expeditionCommand,
  expeditionPublic,
  expeditionSecret,
} from "../js/expedition.js";
import {
  quad,
  arrangeMeditation,
  meditationVoices,
} from "../js/sound-controls.js";
test("four meditation slots keep their settings when solo control becomes shared", () => {
  const s = {
    kind: "meditation",
    solo: true,
    players: [{ id: "A" }],
    contributors: {},
  };
  arrangeMeditation(s);
  s.contributors["A:voice2"].pads[0] = [0.9, 0.1];
  s.contributors["A:voice3"].memory = [0.2, 0, 0, 0];
  s.solo = false;
  s.players.push({ id: "B" });
  arrangeMeditation(s);
  const voices = meditationVoices(s);
  assert.equal(voices.filter((v) => v.owner === "A").length, 2);
  assert.equal(voices.filter((v) => v.owner === "B").length, 2);
  assert.deepEqual(s.contributors["A:voice1"].pads[0], [0.9, 0.1]);
  assert.equal(s.contributors["B:voice1"].memory[0], 0.2);
  s.players.push({ id: "C" }, { id: "D" });
  arrangeMeditation(s);
  assert.deepEqual(s.contributors.C.pads[0], [0.9, 0.1]);
  assert.equal(new Set(meditationVoices(s).map((v) => v.id)).size, 4);
});
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => memory.get(k) || null,
  setItem: (k, v) => memory.set(k, v),
};
const store = {
    roomId: "test",
    userId: "A",
    data: { customTasks: [], plans: [] },
  },
  players = [
    { id: "A", name: "One" },
    { id: "B", name: "Two" },
  ];
test("simultaneous same-kind invitations converge in both delivery orders; active session is preserved", () => {
  const a = { round: "a", kind: "word", stage: "lobby", createdAt: 5 },
    b = { round: "b", kind: "word", stage: "lobby", createdAt: 5 };
  assert.equal(chooseGame(a, b).round, "a");
  assert.equal(chooseGame(b, a).round, "a");
  assert.equal(chooseGame({ ...a, stage: "running" }, b).round, "a");
  const newer = { ...a, revision: 9 };
  assert.equal(chooseGame(newer, { ...a, revision: 8 }), newer);
});
test("persistent deck preserves entire history and inserts new cards without reshuffling existing order", () => {
  const s = { kind: "questions", players };
  initDeck(s, store);
  const original = [...s.deck.order];
  for (let i = 0; i < 20; i++)
    assert.ok(deckCommand(s, "A", { action: "deck-next" }));
  const resumed = { kind: "questions", players };
  store.data.customTasks.push({
    title: "A NEW QUESTION",
    kind: "question",
    createdAt: 100,
    authorId: "A",
  });
  initDeck(resumed, store);
  assert.equal(resumed.deck.index, 20);
  assert.deepEqual(resumed.deck.order.slice(0, 21), original.slice(0, 21));
  assert.equal(resumed.deck.order[21], "A NEW QUESTION");
  for (let i = 0; i < 20; i++)
    deckCommand(resumed, "B", { action: "deck-back" });
  assert.equal(resumed.deck.index, 0);
  assert.equal(deckPublic(resumed).card, original[0]);
});
test("two doors keep choices private until all selected, and reopening previous card preserves reveal", () => {
  const s = { kind: "choice", players };
  initDeck(s, store);
  deckCommand(s, "A", { action: "deck-choice", value: 0 });
  assert.deepEqual(deckPublic(s).choices, {});
  deckCommand(s, "B", { action: "deck-choice", value: 1 });
  assert.equal(deckPublic(s).revealed, true);
  deckCommand(s, "A", { action: "deck-next" });
  deckCommand(s, "A", { action: "deck-back" });
  assert.deepEqual(deckPublic(s).choices, { A: 0, B: 1 });
});
test("truth/dare is chosen by current player; rapid duplicate next messages cannot skip cards", () => {
  const s = { kind: "mixed", players };
  initDeck(s, store);
  assert.equal(
    deckCommand(s, "B", { action: "deck-pick", value: "dare" }),
    false,
  );
  assert.equal(
    deckCommand(s, "A", { action: "deck-pick", value: "dare" }),
    true,
  );
  assert.equal(deckPublic(s).type, "Действие");
  deckCommand(s, "A", { action: "deck-next", index: 0 });
  assert.equal(deckCommand(s, "B", { action: "deck-next", index: 0 }), false);
  assert.equal(deckPublic(s).active, "B");
});
test("quadrant weights are a complete normalized mixture at corners and interior", () => {
  for (const x of [0, 0.2, 0.5, 1])
    for (const y of [0, 0.8, 1]) {
      const q = quad(x, y);
      assert.ok(q.every((n) => n >= 0 && n <= 1));
      assert.ok(Math.abs(q.reduce((a, b) => a + b, 0) - 1) < 1e-10);
    }
  assert.deepEqual(quad(1, 0), [0, 1, 0, 0]);
});
test("eight challenge chapters can finish cooperatively, with private targets and score consistency", () => {
  const s = { kind: "archipelago", players, started: Date.now() };
  initExpedition(s);
  for (let round = 0; round < 8; round++) {
    assert.equal(s.turn, round);
    assert.equal(expeditionPublic(s).targets, undefined);
    assert.equal(expeditionSecret(s, "A").guide.target, s.targets.B);
    if (s.challenge === "signal")
      for (const u of players)
        expeditionCommand(s, u.id, {
          action: "mission-symbol",
          value: s.targets[u.id],
        });
    if (s.challenge === "memory") {
      for (const u of players) {
        expeditionCommand(s, u.id, { action: "mission-memorized" });
        for (const v of s.pattern)
          expeditionCommand(s, u.id, { action: "mission-symbol", value: v });
      }
    }
    if (s.challenge === "balance")
      for (const u of players)
        for (let n = 0; n < s.targets[u.id]; n++)
          expeditionCommand(s, u.id, { action: "mission-dial", value: 1 });
    if (s.challenge === "risk")
      for (const u of players)
        expeditionCommand(s, u.id, { action: "mission-risk", value: 1 });
    if (s.challenge === "link")
      while (s.phase === "challenge") {
        const target = s.destinations[s.beacons],
          queue = [[s.cursor, []]],
          seen = new Set();
        let path;
        while (queue.length) {
          const [pos, route] = queue.shift(),
            k = pos.join(",");
          if (seen.has(k)) continue;
          seen.add(k);
          if (pos[0] === target[0] && pos[1] === target[1]) {
            path = route;
            break;
          }
          for (const axis of [0, 1])
            for (const value of [-1, 1]) {
              const next = [...pos];
              next[axis] += value;
              if (
                next.some((n) => n < 0 || n > 5) ||
                s.obstacles.some(([x, y]) => x === next[0] && y === next[1])
              )
                continue;
              queue.push([next, [...route, { axis, value }]]);
            }
        }
        assert.ok(path?.length);
        for (const move of path) {
          const u = players.find((_, i) => (i + s.turn) % 2 === move.axis);
          expeditionCommand(s, u.id, {
            action: "mission-move",
            value: move.value,
          });
        }
      }
    assert.equal(s.phase, "reveal");
    expeditionCommand(s, "A", { action: "island-next" });
  }
  assert.equal(s.finished, true);
  assert.equal(s.journal.length, 8);
  assert.ok(s.scores.A > 50 && s.scores.B > 50);
});
