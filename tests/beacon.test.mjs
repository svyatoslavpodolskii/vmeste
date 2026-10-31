import test from "node:test";
import assert from "node:assert/strict";
import {
  initBeacon,
  beaconPublic,
  beaconSecret,
  beaconCommand,
  beaconEvaluation,
} from "../js/beacon.js";
import {
  crew,
  beaconSend,
  solveBeaconModule,
} from "./helpers/beacon-solver.mjs";
test("conditional manuals solve every generated module in complete 3/6/9-node shifts for 2/3/4 people", () => {
  const visited = new Set();
  for (const length of [3, 6, 9])
    for (let count = 2; count <= 4; count++)
      for (let seed = 0; seed < 12; seed++) {
        const s = {
          round: `beacon-${length}-${count}-${seed}`,
          players: crew.slice(0, count),
          started: 1000,
        };
        initBeacon(s, length);
        for (let step = 0; step < length; step++) {
          visited.add(s.module.id);
          const oldEngineer = s.engineer;
          solveBeaconModule(s);
          assert.equal(s.result.score, 100);
          s.players.forEach((p) => beaconSend(s, p.id, "beacon-ready"));
          if (s.phase === "voyage")
            s.players.forEach((p) =>
              beaconSend(s, p.id, "beacon-voyage", 0, seed % 2),
            );
          if (!s.finished) assert.notEqual(s.engineer, oldEngineer);
        }
        assert.ok(s.finished);
        assert.equal(s.teamScore, length * 100);
        assert.equal(s.journal.length, length);
        assert.equal(s.harbor.ships.length, Math.ceil(length / 2));
        assert.equal(
          new Set(s.harbor.ships.map((ship) => ship.name)).size,
          s.harbor.ships.length,
        );
      }
  assert.equal(visited.size, 6);
});
test("one phone never receives both the physical readings and the manual; actions are role-bound", () => {
  const s = { round: "privacy", players: crew.slice(0, 2), started: 1000 };
  initBeacon(s, 6);
  const publicView = beaconPublic(s),
    operator = beaconSecret(s, s.engineer),
    guide = beaconSecret(s, s.guides[0]);
  for (const key of [
    "machine",
    "observations",
    "manual",
    "answerOrder",
    "dictionary",
    "materials",
  ])
    assert.equal(publicView[key], undefined);
  assert.equal(operator.manual, undefined);
  assert.equal(guide.observations, undefined);
  assert.equal(guide.machine, undefined);
  s.players.forEach((p) => beaconSend(s, p.id, "beacon-ready"));
  assert.equal(
    beaconCommand(s, s.guides[0], {
      action: "beacon-set",
      turn: 0,
      index: 0,
      value: 1,
    }),
    false,
  );
  assert.equal(
    beaconCommand(s, s.engineer, { action: "beacon-guide-ready", turn: 0 }),
    false,
  );
  assert.equal(
    beaconCommand(s, s.engineer, { action: "beacon-launch", turn: 1 }),
    false,
  );
  beaconSend(s, s.engineer, "beacon-launch");
  assert.equal(s.phase, "repair");
  assert.ok(s.feedback);
});
test("route decisions carry real consequences into the next module and invalid phase measures cannot pass", () => {
  const start = {
    round: "consequences",
    players: crew.slice(0, 2),
    started: 1000,
  };
  initBeacon(start, 6);
  for (let i = 0; i < 2; i++) {
    solveBeaconModule(start);
    start.players.forEach((p) => beaconSend(start, p.id, "beacon-ready"));
  }
  assert.equal(start.phase, "voyage");
  const quiet = structuredClone(start),
    outer = structuredClone(start);
  quiet.players.forEach((p) => beaconSend(quiet, p.id, "beacon-voyage", 0, 0));
  outer.players.forEach((p) => beaconSend(outer, p.id, "beacon-voyage", 0, 1));
  assert.notEqual(quiet.harbor.fuel, outer.harbor.fuel);
  assert.notEqual(quiet.harbor.heat, outer.harbor.heat);
  assert.notEqual(quiet.harbor.tide, outer.harbor.tide);
  const s = { round: "phase", players: crew.slice(0, 2), started: 1000 };
  initBeacon(s, 6);
  s.module = { id: "pendulum" };
  s.machine = {
    gears: [1, 1],
    ratio: 1,
    direction: 0,
    answerDirection: 0,
    answerPhase: 0,
  };
  assert.equal(beaconEvaluation(s, 2).ok, false);
  assert.equal(beaconEvaluation(s, NaN).ok, false);
});
