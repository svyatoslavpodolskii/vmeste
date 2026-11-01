import test from "node:test";
import assert from "node:assert/strict";
import {
  circuitTrials,
  initCircuit,
  prepareTrial,
  circuitCommand,
  circuitPublic,
  circuitSecret,
} from "../js/coop-circuit.js";
import { players, send, solveCircuitTrial } from "./helpers/circuit-solver.mjs";
test("all 24 trials are solvable in complete cooperative runs for 2, 3 and 4 players", () => {
  assert.equal(circuitTrials.length, 24);
  assert.equal(new Set(circuitTrials.map((t) => t.family)).size, 13);
  for (let count = 2; count <= 4; count++)
    for (let seed = 0; seed < 4; seed++) {
      const s = {
        round: `circuit-${count}-${seed}`,
        players: players.slice(0, count),
        started: 1000,
      };
      initCircuit(s, 24);
      assert.equal(new Set(s.route).size, 24);
      for (let i = 0; i < 24; i++) {
        solveCircuitTrial(s);
        assert.equal(s.result.score, 100);
        s.players.forEach((p) => send(s, p.id, "run-ready"));
      }
      assert.ok(s.finished);
      assert.equal(s.teamScore, 2400);
      assert.equal(s.journal.length, 24);
      assert.equal(s.scores, undefined);
      assert.equal(
        circuitCommand(s, "A", { action: "run-ready", turn: s.turn }),
        false,
      );
    }
});
test("private guides stay private, stale turns and actions from the wrong role are rejected", () => {
  const s = { round: "private", players: players.slice(0, 2), started: 1000 };
  initCircuit(s, 8);
  s.route = ["code"];
  prepareTrial(s);
  s.players.forEach((p) => send(s, p.id, "run-ready"));
  assert.equal(circuitPublic(s).dictionary, undefined);
  assert.equal(circuitSecret(s, "A").dictionary, undefined);
  assert.equal(circuitSecret(s, "B").dictionary.length, 4);
  assert.equal(
    circuitCommand(s, "B", { action: "run-tap", turn: 0, value: 0 }),
    false,
  );
  assert.equal(
    circuitCommand(s, "A", { action: "run-tap", turn: 1, value: 0 }),
    false,
  );
  s.route = ["paths"];
  prepareTrial(s);
  s.players.forEach((p) => send(s, p.id, "run-ready"));
  assert.equal(
    circuitCommand(s, "A", { action: "run-move", turn: 0, value: 2 }),
    false,
  );
  s.route = ["wire"];
  prepareTrial(s);
  s.players.forEach((p) => send(s, p.id, "run-ready"));
  assert.equal(
    circuitCommand(s, "B", { action: "run-rotate", turn: 0, value: 0 }),
    false,
  );
});

test("orbit clues and rope length are drawn visually without coordinate instructions", async () => {
  const { circuitControls, circuitScreen } = await import(
    "../js/coop-circuit.js"
  );
  const s = {
    round: "visual-orbit",
    players: players.slice(0, 2),
    started: 1000,
  };
  initCircuit(s, 24);
  s.route = ["tether"];
  s.turn = 0;
  prepareTrial(s);
  s.phase = "play";
  const pub = { ...circuitPublic(s), players: s.players };
  const f = { public: pub, kind: "race" };
  const html = circuitControls(
    f,
    players[0].id,
    circuitSecret(s, players[0].id),
  );
  assert.ok(html.includes("orbit-sky"));
  assert.ok(html.includes("светлая вертикаль"));
  assert.ok(!html.includes("квадрат длины"));
  assert.ok(!html.includes("общего центра ="));
  assert.ok(circuitScreen(f, true).includes("Образец длины нити"));
  assert.ok(!circuitScreen(f).includes("orbit-sky"));
});
