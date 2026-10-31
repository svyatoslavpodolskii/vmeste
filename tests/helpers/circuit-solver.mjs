import assert from "node:assert/strict";
import { circuitCommand } from "../../js/coop-circuit.js";
export const players = [
  { id: "A", name: "A" },
  { id: "B", name: "B" },
  { id: "C", name: "C" },
  { id: "D", name: "D" },
];
export function send(s, id, action, value, extra = {}) {
  s.__trace?.push({ id, action, value, ...extra });
  assert.ok(
    circuitCommand(s, id, { action, value, turn: s.turn, ...extra }, 100000),
    `${s.trial.id}: ${action} by ${id}`,
  );
}
function combination(options, predicate, picked = [], index = 0) {
  if (index === options.length) return predicate(picked) ? picked : null;
  for (const value of options[index]) {
    const result = combination(
      options,
      predicate,
      [...picked, value],
      index + 1,
    );
    if (result) return result;
  }
  return null;
}
export function solveCircuitTrial(s) {
  const q = s.q,
    n = s.players.length,
    ids = s.players.map((p) => p.id),
    family = s.trial.family,
    variant = s.trial.variant;
  ids.forEach((id) => send(s, id, "run-ready"));
  if (family === "memory") {
    ids.forEach((id) => send(s, id, "run-memorized"));
    for (const value of q.expected)
      send(s, ids[q.progress % n], "run-tap", value);
  }
  if (family === "balance") {
    const solution = combination(
      ids.map(() => [0, 1, 2, 3]),
      (p) =>
        p.reduce((sum, i, k) => sum + q.options[ids[k]][i][0], 0) ===
          q.target[0] &&
        (!variant ||
          p.reduce((sum, i, k) => sum + q.options[ids[k]][i][1], 0) ===
            q.target[1]),
    );
    assert.ok(solution);
    ids.forEach((id, i) => send(s, id, "run-choice", solution[i]));
    ids.forEach((id) => send(s, id, "run-commit"));
  }
  if (family === "cargo") {
    const solution = combination(
      ids.map(() => Array.from({ length: 16 }, (_, i) => i)),
      (p) => {
        const items = p.flatMap((mask, i) =>
          q.inventory[ids[i]].filter((_, j) => mask & (1 << j)),
        );
        return (
          items.reduce((a, b) => a + b.mass, 0) <= q.capacity &&
          items.reduce((a, b) => a + b.light, 0) >= q.requiredLight &&
          (!variant || items.reduce((a, b) => a + b.fragile, 0) === q.fragile)
        );
      },
    );
    assert.ok(solution);
    ids.forEach((id, i) => {
      for (let j = 0; j < 4; j++)
        if (solution[i] & (1 << j)) send(s, id, "run-choice", j);
    });
    ids.forEach((id) => send(s, id, "run-commit"));
  }
  if (family === "orbit") {
    const solution = combination(
      ids.map(() => Array.from({ length: 9 }, (_, i) => i)),
      (p) =>
        p.reduce((sum, i) => sum + (i % 3), 0) === q.target[0] &&
        p.reduce((sum, i) => sum + Math.floor(i / 3), 0) === q.target[1] &&
        (!variant ||
          ((p[0] % 3) - (p[1] % 3)) ** 2 +
            (Math.floor(p[0] / 3) - Math.floor(p[1] / 3)) ** 2 ===
            q.distance),
    );
    assert.ok(solution);
    ids.forEach((id, i) => send(s, id, "run-choice", solution[i]));
    ids.forEach((id) => send(s, id, "run-commit"));
  }
  if (family === "recipe")
    while (s.phase !== "result") {
      const solution = combination(
        ids.map((id) => q.cupboards[id]),
        (p) => q.recipe.every((v, i) => p.filter((n) => n === i).length === v),
      );
      assert.ok(solution);
      ids.forEach((id, i) => send(s, id, "run-choice", solution[i]));
      ids.forEach((id) => send(s, id, "run-commit"));
    }
  if (family === "cipher")
    while (s.phase !== "result")
      send(
        s,
        ids[q.progress % n],
        "run-tap",
        (q.dictionary[q.codes[q.progress]] + q.shifts[q.progress]) % 4,
      );
  if (family === "sorting")
    while (s.phase !== "result") {
      const target = q.rules[q.parcels[q.progress] % 3];
      send(
        s,
        ids[q.progress % n],
        "run-tap",
        variant && Math.floor(q.progress / 2) % 2 ? 2 - target : target,
      );
    }
  if (family === "logic")
    while (s.phase !== "result")
      send(s, ids[q.progress % n], "run-tap", q.answers[q.progress]);
  if (family === "timing")
    ids.forEach((id) => send(s, id, "run-hit", 0, { measure: 0.5 }));
  if (family === "hold")
    ids.forEach((id) =>
      send(s, id, "run-hit", 0, { measure: q.durations[id] }),
    );
  if (family === "rhythm")
    ids.forEach((id) =>
      q.patterns[id].forEach((measure) =>
        send(s, id, "run-hit", 0, { measure }),
      ),
    );
  if (family === "wiring") {
    const path = variant ? [0, 4, 8, 9, 10, 6, 2, 3] : [0, 1, 5, 9, 10, 11, 15];
    const direction = (from, to) =>
      to === from - 4 ? 0 : to === from + 1 ? 1 : to === from + 4 ? 2 : 3;
    for (let i = 0; i < path.length && s.phase !== "result"; i++) {
      const cell = path[i],
        desired = [
          i ? direction(cell, path[i - 1]) : 3,
          i < path.length - 1 ? direction(cell, path[i + 1]) : 1,
        ];
      let rotates = 0;
      while (
        !desired.every((d) =>
          q.tiles[cell].map((p) => (p + q.rotation[cell]) % 4).includes(d),
        )
      ) {
        send(s, ids[cell % n], "run-rotate", cell);
        assert.ok(++rotates <= 4);
      }
    }
  }
  if (family === "maze") {
    const targetBits = (1 << q.keys.length) - 1,
      queue = [{ cell: 0, bits: 0, path: [] }],
      seen = new Set(["0:0"]);
    let route;
    for (let pos = 0; pos < queue.length; pos++) {
      const current = queue[pos];
      if (current.cell === q.exit && current.bits === targetBits) {
        route = current.path;
        break;
      }
      for (let dir = 0; dir < 4; dir++) {
        const cell = [
          current.cell - 6,
          current.cell + 1,
          current.cell + 6,
          current.cell - 1,
        ][dir];
        if (
          cell < 0 ||
          cell >= 36 ||
          (dir === 1 && current.cell % 6 === 5) ||
          (dir === 3 && current.cell % 6 === 0) ||
          q.walls.includes(cell)
        )
          continue;
        const keyIndex = q.keys.indexOf(cell),
          bits = keyIndex < 0 ? current.bits : current.bits | (1 << keyIndex),
          key = cell + ":" + bits;
        if (!seen.has(key)) {
          seen.add(key);
          queue.push({ cell, bits, path: [...current.path, dir] });
        }
      }
    }
    assert.ok(route);
    for (const dir of route)
      send(s, ids[dir % 2 === 1 ? 0 : 1], "run-move", dir);
  }
  assert.equal(s.phase, "result", s.trial.id);
}
