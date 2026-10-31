import test from "node:test";
import assert from "node:assert/strict";
import {
  assignedConstellations,
  phraseNotes,
  constellations,
} from "../js/composition.js";
import { soundControls } from "../js/sound-controls.js";

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

test("garden exposes four useful panels per performer and meditation six distinct stars in a pair", () => {
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
  assert.equal((garden.match(/data-sound-pad=/g) || []).length, 4);
  frame.kind = "meditation";
  const a = soundControls(frame, "a", null),
    b = soundControls(frame, "b", null);
  assert.equal((a.match(/data-constellation=/g) || []).length, 6);
  assert.equal((b.match(/data-constellation=/g) || []).length, 6);
  assert.ok(!a.includes("undefined") && !b.includes("undefined"));
});
