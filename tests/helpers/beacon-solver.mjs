import assert from "node:assert/strict";
import { beaconCommand, beaconSecret } from "../../js/beacon.js";
export const crew = [
  { id: "A", name: "Аня" },
  { id: "B", name: "Борис" },
  { id: "C", name: "Вика" },
  { id: "D", name: "Глеб" },
];
export function beaconSend(s, id, action, index, value, extra = {}) {
  s.__trace?.push({ id, action, index, value, ...extra });
  assert.ok(
    beaconCommand(
      s,
      id,
      { action, index, value, turn: s.turn, ...extra },
      100000,
    ),
    `${s.module.id}: ${action} by ${id}`,
  );
}
export function solveBeaconModule(s) {
  s.players.forEach((p) => beaconSend(s, p.id, "beacon-ready"));
  const operator = beaconSecret(s, s.engineer),
    guide = beaconSecret(s, s.guides[0]),
    o = operator.observations,
    m = operator.machine,
    g = guide.manual;
  let measure;
  const set = (index, value = 0) =>
    beaconSend(s, s.engineer, "beacon-set", index, value);
  if (s.module.id === "prism") {
    const base = o.wind === 3 || o.hot ? [...g.base].reverse() : [...g.base];
    const anchor = (Math.floor(o.serial / 10) + (o.serial % 10) + g.lens) % 4,
      start = base.indexOf(anchor),
      target = base.slice(start).concat(base.slice(0, start));
    for (let pos = 0; pos < 4; pos++) {
      let at = s.machine.order.indexOf(target[pos]);
      while (at > pos) {
        set(at - 1);
        at--;
      }
    }
    const angle = (o.tide + (o.serial % 2 ? 1 : 3) + (o.hot ? 1 : 0)) % 4;
    while (s.machine.angle !== angle) set(4);
  }
  if (s.module.id === "power") {
    const min = g.baseLight + (o.wind === 0 ? 2 : 0),
      max = g.baseHeat - (o.hot ? 3 : 0),
      off = !o.reserveLow && o.serial % 2 === 0 && o.hot;
    const candidates = [];
    for (let a = 0; a <= 4; a++)
      for (let b = 0; b <= 4; b++)
        for (let c = 0; c <= 4; c++) {
          const levels = [a, b, c],
            light = levels.reduce(
              (sum, v, i) => sum + v * m.coefficients[i].light,
              0,
            ),
            heat = levels.reduce(
              (sum, v, i) => sum + v * m.coefficients[i].heat,
              0,
            );
          if (
            light >= min &&
            heat <= max &&
            (!off || c === 0) &&
            (!o.reserveLow || c >= 2)
          )
            candidates.push(levels);
        }
    candidates.sort(
      (a, b) => a.reduce((n, v) => n + v, 0) - b.reduce((n, v) => n + v, 0),
    );
    assert.ok(candidates.length);
    candidates[0].forEach((v, i) => {
      while (s.machine.levels[i] < v) set(i, 1);
    });
  }
  if (s.module.id === "coolant") {
    const allowed = g.materialRules[o.salt ? 1 : o.hot ? 2 : 0],
      forbidden = o.pressure >= 3 ? 0 : 3;
    const queue = [{ cell: 0, path: [0], cool: false }],
      seen = new Set(["0:false"]);
    let result;
    for (let pos = 0; pos < queue.length; pos++) {
      const current = queue[pos];
      if (current.cell === m.exit && current.cool) {
        result = current.path;
        break;
      }
      const choices = [
        current.cell - 5,
        current.cell + 1,
        current.cell + 5,
        current.cell - 1,
      ];
      for (let dir = 0; dir < 4; dir++) {
        const next = choices[dir];
        if (
          dir === forbidden ||
          next < 0 ||
          next >= 25 ||
          (dir === 1 && current.cell % 5 === 4) ||
          (dir === 3 && current.cell % 5 === 0)
        )
          continue;
        if (
          m.materials[next] !== allowed &&
          ![0, m.cooler, m.exit].includes(next)
        )
          continue;
        const cool = current.cool || next === m.cooler,
          key = next + ":" + cool;
        if (!seen.has(key)) {
          seen.add(key);
          queue.push({ cell: next, path: [...current.path, next], cool });
        }
      }
    }
    assert.ok(result);
    result.slice(1).forEach((cell) => set(cell));
  }
  if (s.module.id === "signal") {
    const observed = o.wind === 3 ? [...m.observed].reverse() : m.observed;
    const expected = observed
      .flatMap((n) => g.dictionary[n])
      .map((n) => (o.serial % 2 ? 1 - n : n));
    expected.forEach((n, i) => {
      if (s.machine.signal[i] !== n) set(i);
    });
  }
  if (s.module.id === "pendulum") {
    const ratio = g.ratioTable[o.salt];
    while (s.machine.gears[0] !== ratio) set(0);
    const direction = g.reverseWinds.includes(o.wind) ? 1 : 0;
    if (s.machine.direction !== direction) set(2);
    measure = ((g.phaseChart[o.tide] + (o.serial % 2 ? 1 : 0)) % 4) / 4;
  }
  if (s.module.id === "navigation") {
    const preferred = g.waterRules[o.hot ? 2 : o.salt ? 1 : 0],
      cargo = g.cargoRules[o.tide % 2];
    const options = m.routes
      .map((r, i) => ({ ...r, index: i }))
      .filter(
        (r) =>
          r.cargo === cargo &&
          (preferred === "освещённый" ? r.lit : r.water === preferred),
      )
      .sort((a, b) => a.cost - b.cost);
    assert.ok(options.length);
    const chosen = options[0];
    set(chosen.index);
    const bearing = (chosen.bearing + o.tide + g.courseOffset) % 4;
    while (s.machine.bearing !== bearing) set(4);
  }
  s.guides.forEach((id) => beaconSend(s, id, "beacon-guide-ready"));
  beaconSend(s, s.engineer, "beacon-launch", 0, 0, { measure });
  assert.equal(
    s.phase,
    "result",
    `${s.module.id}: instruction must actually solve the mechanism`,
  );
}
