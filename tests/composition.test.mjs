import test from "node:test";
import assert from "node:assert/strict";
import {
  assignedConstellations,
  phraseNotes,
  constellations,
  gardenPhrase,
} from "../js/composition.js";
test("the garden evolves without input and every panel changes the resulting phrase", () => {
  const room = {
    a: {
      pads: [
        [0.2, 0.2],
        [0.1, 0.5],
        [0.1, 0.5],
        [0.1, 0.1],
      ],
    },
    b: {
      pads: [
        [0.3, 0.3],
        [0.1, 0.5],
        [0.1, 0.5],
        [0.1, 0.1],
      ],
    },
  };
  const baseline = gardenPhrase(room, 0, 0);
  assert.notDeepEqual(gardenPhrase(room, 0, 1), baseline);
  for (const bank of [0, 1, 2, 3]) {
    const changed = structuredClone(room);
    changed.a.pads[bank] = [1, 1];
    changed.b.pads[bank] = [1, 1];
    assert.notDeepEqual(gardenPhrase(changed, 0, 0), baseline, `panel ${bank}`);
  }
  for (let chapter = 0; chapter < 36; chapter++)
    for (let seat = 0; seat < 2; seat++) {
      const notes = gardenPhrase(room, seat, chapter);
      assert.ok(notes.length >= 2 && notes.length <= 6);
      assert.ok(
        notes.every(
          (n) => n.frequency >= 65 && n.frequency < 1050 && n.gain < 0.05,
        ),
      );
    }
});
import { soundControls, arrangeMeditation } from "../js/sound-controls.js";
test("a ten-person sky retains four movable voices and constellation access for everyone", () => {
  const players = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    name: String(i),
  }));
  const state = { kind: "meditation", players, contributors: {} };
  arrangeMeditation(state);
  assert.equal(
    Object.values(state.contributors).filter((c) => c.slot >= 0).length,
    4,
  );
  for (const p of players) {
    assert.ok(state.contributors[p.id]);
    assert.ok(assignedConstellations(players, p.id).length >= 1);
  }
  state.contributors["9"].memory = [0.4];
  arrangeMeditation(state);
  assert.equal(state.contributors["9"].memory[0], 0.4);
});

test("twelve distinct actions divide among performers with no omissions or overlaps", () => {
  for (const count of [1, 2, 3, 4]) {
    const players = Array.from({ length: count }, (_, i) => ({
      id: String(i),
      name: String(i),
    }));
    const allocations = players.map((p) =>
      assignedConstellations(players, p.id),
    );
    assert.equal(new Set(allocations.flat().map((c) => c.index)).size, 12);
    assert.equal(allocations.flat().length, 12);
    if (count === 2)
      assert.deepEqual(
        allocations.map((a) => a.length),
        [6, 6],
      );
  }
  assert.equal(
    new Set(constellations.map((c) => c.notes.join() + c.step)).size,
    12,
  );
});

test("both participants alter harmony; repeated actions retain a bounded musical register", () => {
  const room = { a: { pads: [[0, 0]] }, b: { pads: [[0, 0]] } };
  const before = phraseNotes(0, room);
  room.b.pads[0] = [1, 1];
  assert.notDeepEqual(phraseNotes(0, room), before);
  for (let i = 0; i < 12; i++)
    for (const note of phraseNotes(i, room, 1)) {
      assert.ok(note.frequency >= 65 && note.frequency < 1050);
      assert.ok(note.gain < 0.05 && note.duration < 4);
    }
});

test("garden exposes four controls on one plane per performer and meditation six distinct stars in a pair", () => {
  const frame = {
    kind: "soundgarden",
    public: {
      players: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
      contributors: { a: {}, b: {} },
    },
  };
  const garden = soundControls(frame, "a", null);
  assert.equal((garden.match(/data-garden-bank=/g) || []).length, 4);
  frame.kind = "meditation";
  const a = soundControls(frame, "a", null),
    b = soundControls(frame, "b", null);
  assert.equal((a.match(/data-constellation=/g) || []).length, 6);
  assert.equal((b.match(/data-constellation=/g) || []).length, 6);
  assert.ok(!a.includes("undefined") && !b.includes("undefined"));
});

test("twelve short-note keys have distinct stable harmonious pitches regardless of gesture history", async () => {
  const { constellationTone } = await import("../js/composition.js");
  const room = {
    a: { pads: [[0.4, 0.5]], memory: [0, 0, 0, 0] },
    b: { pads: [[0.6, 0.3]] },
  };
  const tones = Array.from({ length: 12 }, (_, i) =>
    constellationTone(i, room),
  );
  assert.equal(new Set(tones).size, 12);
  assert.ok(tones.every((v, i) => !i || v > tones[i - 1]));
  room.a.memory = [0.6, 0.9, 0.2, 0.8];
  assert.deepEqual(
    Array.from({ length: 12 }, (_, i) => constellationTone(i, room)),
    tones,
  );
});

test("session swaps exchange ownership without losing or changing pitches", () => {
  const players = [{ id: "a" }, { id: "b" }];
  const before = assignedConstellations(players, "a", false, "room:0").map(
    (s) => s.index,
  );
  const after = assignedConstellations(players, "a", false, "room:1").map(
    (s) => s.index,
  );
  assert.notDeepEqual(before, after);
  assert.deepEqual(
    after,
    assignedConstellations(players, "b", false, "room:0").map((s) => s.index),
  );
  assert.equal(new Set([...before, ...after]).size, 12);
});
