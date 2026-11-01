export const BEACON_RULES = 2;
export const beaconModules = [
  {
    id: "prism",
    title: "Линзовая призма",
    task: "Соберите порядок четырёх линз и угол луча по показаниям и условной инструкции.",
  },
  {
    id: "power",
    title: "Сердце маяка",
    task: "Настройте три энергетических банка. Света должно хватить, а нагрев должен остаться в безопасных пределах.",
  },
  {
    id: "coolant",
    title: "Холодные ручьи",
    task: "Проведите воду через охладитель к выходу. Инструкция подскажет, какие материалы и направления сейчас допустимы.",
  },
  {
    id: "signal",
    title: "Азбука гавани",
    task: "Переведите наблюдаемые знаки в импульсы с учётом ветра и сигнала судна.",
  },
  {
    id: "pendulum",
    title: "Маятник прилива",
    task: "Подберите передачи и направление, затем остановите луч в нужной фазе по указаниям навигатора.",
  },
  {
    id: "navigation",
    title: "Проводка к дому",
    task: "Сопоставьте маршруты с требованиями судна и гавани, выберите безопасный путь и выставьте входной курс.",
  },
];
export const colors = ["Янтарь", "Мята", "Сумерки", "Лёд"];
export const marks = ["☀", "♧", "☾", "◈"];
export const materialNames = ["Медь", "Стекло", "Камень", "Узел"];
const shipNames = [
  "Тёплый берег",
  "Лунный почтальон",
  "Дом на воде",
  "Ласточка",
  "Северный сад",
  "Тихий остров",
];
export const dirs = ["Северный", "Восточный", "Южный", "Западный"];
function random(seed) {
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    return (n >>> 0) / 4294967296;
  };
}
const shuffle = (a, rng) =>
  [...a]
    .map((v) => [rng(), v])
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v);
const add = (a) => a.reduce((n, v) => n + v, 0);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function initBeacon(s, length = s.beaconLength || 6) {
  s.beaconLength = [3, 6, 9].includes(Number(length)) ? Number(length) : 6;
  s.rulesVersion = BEACON_RULES;
  s.turn = 0;
  s.harbor = {
    heat: 18,
    fuel: 8,
    tide: 0,
    lens: 0,
    wind: 0,
    ships: [],
    lights: [],
  };
  s.journal = [];
  s.teamScore = 0;
  const rng = random(s.round),
    first = shuffle(
      beaconModules.map((m) => m.id),
      rng,
    ),
    second = shuffle(first, rng);
  s.shipOrder = shuffle(shipNames, rng);
  if (first.at(-1) === second[0])
    [second[0], second[1]] = [second[1], second[0]];
  s.beaconRoute = [...first, ...second].slice(0, s.beaconLength);
  prepareBeacon(s);
}
export function prepareBeacon(s) {
  s.module = beaconModules.find((m) => m.id === s.beaconRoute[s.turn]);
  s.phase = "briefing";
  s.moduleReady = [];
  s.approved = [];
  s.feedback = "";
  s.moduleMistakes = 0;
  s.harborVotes = {};
  const rng = random(
      `${s.round}:${s.turn}:${s.harbor.tide}:${s.harbor.lens}:${s.harbor.fuel}`,
    ),
    int = (n) => Math.floor(rng() * n);
  const q = (s.machine = {
    wind: (int(4) + s.harbor.wind) % 4,
    tide: (int(4) + s.harbor.tide) % 4,
    serial: 10 + int(90),
    hot: s.harbor.heat >= 45,
    salt: int(2),
    pressure: 1 + int(4),
    ship:
      s.shipOrder?.[Math.floor(s.turn / 2)] ||
      shipNames[Math.floor(s.turn / 2) % shipNames.length],
  });
  const engineer = s.players[s.turn % s.players.length];
  s.engineer = engineer.id;
  s.guides = s.players.filter((p) => p.id !== engineer.id).map((p) => p.id);
  if (s.module.id === "prism") {
    q.base = shuffle([0, 1, 2, 3], rng);
    q.anchor =
      (Math.floor(q.serial / 10) + (q.serial % 10) + s.harbor.lens) % 4;
    q.reverse = q.wind === 3 || q.hot;
    const order = q.reverse ? [...q.base].reverse() : q.base;
    const start = order.indexOf(q.anchor);
    q.answerOrder = order.slice(start).concat(order.slice(0, start));
    q.answerAngle = (q.tide + (q.serial % 2 ? 1 : 3) + (q.hot ? 1 : 0)) % 4;
    q.order = shuffle([0, 1, 2, 3], rng);
    q.angle = 0;
  }
  if (s.module.id === "power") {
    q.coefficients = Array.from({ length: 3 }, () => ({
      light: 1 + int(4),
      heat: 1 + int(3),
    }));
    q.answerLevels = Array.from({ length: 3 }, () => 1 + int(3));
    q.reserveLow = s.harbor.fuel < 4;
    q.reserveOff = q.serial % 2 === 0 && q.hot && !q.reserveLow;
    if (q.reserveOff) q.answerLevels[2] = 0;
    if (q.reserveLow) q.answerLevels[2] = 2 + int(2);
    const light = add(
        q.answerLevels.map((v, i) => v * q.coefficients[i].light),
      ),
      heat = add(q.answerLevels.map((v, i) => v * q.coefficients[i].heat));
    q.minLight = light;
    q.maxHeat = heat + int(3);
    q.baseLight = q.minLight - (q.wind === 0 ? 2 : 0);
    q.baseHeat = q.maxHeat + (q.hot ? 3 : 0);
    q.levels = [0, 0, 0];
  }
  if (s.module.id === "coolant") {
    q.materialRules = shuffle([0, 1, 2], rng);
    q.allowed = q.materialRules[q.salt ? 1 : q.hot ? 2 : 0];
    q.forbidden = q.pressure >= 3 ? 0 : 3;
    q.cooler = (1 + int(3)) * 5 + 1 + int(3);
    q.exit = 24;
    q.materials = Array.from({ length: 25 }, () => int(3));
    const path = [0];
    for (const target of [q.cooler, q.exit])
      while (path.at(-1) !== target) {
        const cell = path.at(-1),
          steps = [];
        if (cell % 5 < target % 5) steps.push(cell + 1);
        if (Math.floor(cell / 5) < Math.floor(target / 5)) steps.push(cell + 5);
        path.push(steps[int(steps.length)]);
      }
    for (const n of path) q.materials[n] = q.allowed;
    for (const n of [0, q.cooler, q.exit]) q.materials[n] = 3;
    q.path = [0];
  }
  if (s.module.id === "signal") {
    q.dictionary = shuffle(
      [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      rng,
    );
    q.observed = Array.from({ length: 3 }, () => int(4));
    q.reverse = q.wind === 3;
    q.invert = q.serial % 2 === 1;
    const observed = q.reverse ? [...q.observed].reverse() : q.observed;
    q.answerSignal = observed
      .flatMap((n) => q.dictionary[n])
      .map((n) => (q.invert ? 1 - n : n));
    q.signal = Array(6).fill(0);
  }
  if (s.module.id === "pendulum") {
    q.ratioTable = shuffle([1, 2], rng);
    q.ratio = q.ratioTable[q.salt];
    q.answerGears = q.ratio === 2 ? [2, 1] : q.hot ? [2, 2] : [1, 1];
    q.reverseWinds = shuffle([0, 1, 2, 3], rng).slice(0, 2);
    q.phaseChart = shuffle([0, 1, 2, 3], rng);
    q.answerDirection = q.reverseWinds.includes(q.wind) ? 1 : 0;
    q.answerPhase = (q.phaseChart[q.tide] + (q.serial % 2 ? 1 : 0)) % 4;
    q.gears = [1, 1];
    q.direction = 0;
    q.clockStart = Date.now();
    q.period = 5000;
  }
  if (s.module.id === "navigation") {
    q.waterRules = shuffle(["охлаждённый", "пресный", "освещённый"], rng);
    q.cargoRules = shuffle(["письма", "пассажиры"], rng);
    q.courseOffset = int(4);
    q.preferred = q.waterRules[q.hot ? 2 : q.salt ? 1 : 0];
    q.needCargo = q.cargoRules[q.tide % 2];
    q.routes = Array.from({ length: 4 }, (_, index) => ({
      name: [
        "Каменная коса",
        "Тихая протока",
        "Дальний причал",
        "Северный мост",
      ][index],
      water: index % 2 ? "пресный" : "охлаждённый",
      cargo: int(2) ? "письма" : "пассажиры",
      lit: !!int(2),
      cost: 1 + int(4),
      bearing: int(4),
    }));
    const correct = int(4);
    q.routes[correct].cargo = q.needCargo;
    if (q.preferred === "освещённый") q.routes[correct].lit = true;
    else q.routes[correct].water = q.preferred;
    const eligible = (route) =>
      route.cargo === q.needCargo &&
      (q.preferred === "освещённый" ? route.lit : route.water === q.preferred);
    const minCost = Math.min(...q.routes.filter(eligible).map((r) => r.cost));
    q.correctRoutes = q.routes
      .map((r, i) => (eligible(r) && r.cost === minCost ? i : -1))
      .filter((n) => n >= 0);
    q.answerRoute = q.correctRoutes[0];
    q.route = 0;
    q.bearing = 0;
  }
}
export function beaconEvaluation(s, measure) {
  const q = s.machine;
  switch (s.module.id) {
    case "prism":
      return {
        ok:
          q.order.every((v, i) => v === q.answerOrder[i]) &&
          q.angle === q.answerAngle,
        detail: "Линзы собрали устойчивый луч",
        fuel: 1,
        heat: 2,
        lens: q.order[0],
      };
    case "power": {
      const light = add(q.levels.map((v, i) => v * q.coefficients[i].light)),
        heat = add(q.levels.map((v, i) => v * q.coefficients[i].heat));
      return {
        ok:
          light >= q.minLight &&
          heat <= q.maxHeat &&
          (!q.reserveOff || q.levels[2] === 0) &&
          (!q.reserveLow || q.levels[2] >= 2),
        detail: `Энергии: ${light}, нагрева: ${heat}`,
        fuel: Math.max(1, 5 - add(q.levels)),
        heat: Math.ceil(heat / 2),
        lens: s.harbor.lens,
      };
    }
    case "coolant": {
      const path = q.path,
        correct =
          path[0] === 0 &&
          path.at(-1) === q.exit &&
          path.includes(q.cooler) &&
          path.every(
            (cell, i) =>
              (q.materials[cell] === q.allowed ||
                [0, q.cooler, q.exit].includes(cell)) &&
              (!i ||
                (moveDirection(path[i - 1], cell) >= 0 &&
                  moveDirection(path[i - 1], cell) !== q.forbidden)),
          );
      return {
        ok: correct,
        detail: "Вода прошла через охладитель и вернула маяку дыхание",
        fuel: 0,
        heat: -25,
        lens: s.harbor.lens,
      };
    }
    case "signal":
      return {
        ok: q.signal.every((v, i) => v === q.answerSignal[i]),
        detail: `«${q.ship}» принял ваш сигнал`,
        fuel: 1,
        heat: 0,
        lens: s.harbor.lens,
      };
    case "pendulum": {
      const ratio = q.gears[0] / q.gears[1],
        phase = q.answerPhase / 4;
      const distance =
        Number.isFinite(measure) && measure >= 0 && measure <= 1
          ? Math.min(Math.abs(measure - phase), 1 - Math.abs(measure - phase))
          : 1;
      return {
        ok:
          ratio === q.ratio &&
          q.direction === q.answerDirection &&
          distance <= 0.1,
        detail: "Маятник вошёл в гармонию с приливом",
        fuel: 1,
        heat: -4,
        lens: s.harbor.lens,
      };
    }
    case "navigation":
      return {
        ok:
          q.correctRoutes.includes(q.route) &&
          q.bearing ===
            (q.routes[q.route].bearing + q.tide + q.courseOffset) % 4,
        detail: `«${q.ship}» идёт через ${q.routes[q.route].name.toLowerCase()}`,
        fuel: -q.routes[q.route].cost,
        heat: 0,
        lens: s.harbor.lens,
      };
    default:
      return { ok: false };
  }
}
function moveDirection(from, to) {
  if (to === from - 5) return 0;
  if (to === from + 1 && from % 5 < 4) return 1;
  if (to === from + 5) return 2;
  if (to === from - 1 && from % 5 > 0) return 3;
  return -1;
}
export function beaconCommand(s, sender, input, now = Date.now()) {
  if (
    s.finished ||
    input.turn !== s.turn ||
    !s.players.some((p) => p.id === sender)
  )
    return false;
  const action = input.action,
    q = s.machine,
    index = Number(input.index),
    value = Number(input.value);
  if (
    action === "beacon-ready" &&
    (s.phase === "briefing" || s.phase === "result")
  ) {
    if (!s.moduleReady.includes(sender)) s.moduleReady.push(sender);
    if (s.players.every((p) => s.moduleReady.includes(p.id))) {
      if (s.phase === "briefing") {
        s.phase = "repair";
        s.moduleReady = [];
        q.clockStart = now;
      } else {
        s.turn++;
        if (s.turn >= s.beaconRoute.length) {
          s.harbor.ships.push({
            name: q.ship,
            route: "под вашим восстановленным светом",
            leg: s.turn,
          });
          s.finished = true;
          s.phase = "finished";
          s.elapsed = now - s.started;
        } else if (s.turn % 2 === 0) {
          s.phase = "voyage";
          s.harborVotes = {};
          s.moduleReady = [];
        } else prepareBeacon(s);
      }
    }
    return true;
  }
  if (
    action === "beacon-voyage" &&
    s.phase === "voyage" &&
    [0, 1].includes(value)
  ) {
    s.harborVotes[sender] = value;
    if (s.players.every((p) => Object.hasOwn(s.harborVotes, p.id))) {
      if (new Set(Object.values(s.harborVotes)).size === 1) {
        const daring = value === 1;
        s.harbor.tide = (s.harbor.tide + (daring ? 2 : 1)) % 4;
        s.harbor.wind = (s.harbor.wind + (daring ? 3 : 1)) % 4;
        s.harbor.fuel = Math.max(0, s.harbor.fuel + (daring ? 2 : -1));
        s.harbor.heat = clamp(s.harbor.heat + (daring ? 10 : -8), 0, 99);
        s.harbor.ships.push({
          name: q.ship,
          route: daring ? "внешним фарватером" : "тихой протокой",
          leg: s.turn,
        });
        prepareBeacon(s);
      } else {
        s.feedback =
          "Вы выбрали разные пути. Обсудите, кого и как проводим, и выберите вместе.";
        s.harborVotes = {};
      }
    }
    return true;
  }
  if (s.phase !== "repair") return false;
  if (action === "beacon-guide-ready" && s.guides.includes(sender)) {
    s.approved = s.approved.includes(sender)
      ? s.approved.filter((id) => id !== sender)
      : [...s.approved, sender];
    return true;
  }
  if (sender !== s.engineer) return false;
  if (action === "beacon-set") {
    if (
      s.module.id === "prism" &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < 4
    ) {
      const other = (index + 1) % 4;
      [q.order[index], q.order[other]] = [q.order[other], q.order[index]];
    } else if (s.module.id === "prism" && index === 4)
      q.angle = (q.angle + 1) % 4;
    else if (
      s.module.id === "power" &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < 3 &&
      [1, -1].includes(value)
    )
      q.levels[index] = clamp(q.levels[index] + value, 0, 4);
    else if (
      s.module.id === "coolant" &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < 25
    ) {
      const back = q.path.indexOf(index);
      if (back >= 0) q.path = q.path.slice(0, back + 1);
      else if (moveDirection(q.path.at(-1), index) >= 0) q.path.push(index);
      else return false;
    } else if (
      s.module.id === "signal" &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < 6
    )
      q.signal[index] = q.signal[index] ? 0 : 1;
    else if (s.module.id === "pendulum" && [0, 1].includes(index))
      q.gears[index] = (q.gears[index] % 4) + 1;
    else if (s.module.id === "pendulum" && index === 2)
      q.direction = q.direction ? 0 : 1;
    else if (
      s.module.id === "navigation" &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < 4
    )
      q.route = index;
    else if (s.module.id === "navigation" && index === 4)
      q.bearing = (q.bearing + 1) % 4;
    else return false;
    s.approved = [];
    return true;
  }
  if (action === "beacon-launch") {
    if (!s.guides.every((id) => s.approved.includes(id))) {
      s.feedback = "Навигатор сначала подтверждает, что инструкция сверена.";
      return true;
    }
    const result = beaconEvaluation(s, input.measure);
    if (!result.ok) {
      s.moduleMistakes++;
      s.harbor.heat = clamp(s.harbor.heat + 6, 0, 99);
      s.feedback =
        "Механизм не вошёл в режим. У маяка стало теплее; сверяйте показания и каждое условие инструкции. Настройки можно исправить.";
      s.approved = [];
      return true;
    }
    s.harbor.heat = clamp(s.harbor.heat + result.heat, 0, 99);
    s.harbor.fuel = Math.max(0, s.harbor.fuel + result.fuel);
    s.harbor.lens = result.lens;
    const score = Math.max(20, 100 - s.moduleMistakes * 10);
    s.teamScore += score;
    s.harbor.lights.push(s.module.id);
    s.journal.push({
      module: s.module.id,
      engineer: s.engineer,
      score,
      detail: result.detail,
      heat: s.harbor.heat,
      fuel: s.harbor.fuel,
    });
    s.result = { ...result, score };
    s.phase = "result";
    s.moduleReady = [];
    s.feedback = "";
    return true;
  }
  return false;
}

export function beaconPublic(s) {
  const q = s.machine;
  const display =
    s.module.id === "prism"
      ? { order: q.order, angle: q.angle }
      : s.module.id === "power"
        ? {
            levels: q.levels,
            light: add(q.levels.map((v, i) => v * q.coefficients[i].light)),
            heat: add(q.levels.map((v, i) => v * q.coefficients[i].heat)),
          }
        : s.module.id === "coolant"
          ? {
              materials: q.materials,
              path: q.path,
              cooler: q.cooler,
              exit: q.exit,
            }
          : s.module.id === "signal"
            ? { observed: q.observed, signal: q.signal }
            : s.module.id === "pendulum"
              ? {
                  gears: q.gears,
                  direction: q.direction,
                  clockStart: q.clockStart,
                  period: q.period / q.gears[1],
                }
              : { routes: q.routes, route: q.route, bearing: q.bearing };
  return {
    display,
    rulesVersion: BEACON_RULES,
    phase: s.phase,
    module: s.module,
    ship: s.machine.ship,
    turn: s.turn,
    total: s.beaconLength,
    engineer: s.engineer,
    guides: s.guides,
    harbor: s.harbor,
    teamScore: s.teamScore,
    journal: s.journal,
    moduleReady: s.moduleReady,
    approved: s.approved,
    result: s.result,
    feedback: s.feedback,
    voted: Object.keys(s.harborVotes || {}),
  };
}
export function beaconSecret(s, id) {
  const q = s.machine;
  if (id === s.engineer) {
    const observations = {
      wind: q.wind,
      tide: q.tide,
      serial: q.serial,
      hot: q.hot,
      salt: q.salt,
      pressure: q.pressure,
      ship: q.ship,
      reserveLow: !!q.reserveLow,
    };
    const machine =
      s.module.id === "prism"
        ? { order: q.order, angle: q.angle }
        : s.module.id === "power"
          ? { coefficients: q.coefficients, levels: q.levels }
          : s.module.id === "coolant"
            ? {
                materials: q.materials,
                path: q.path,
                cooler: q.cooler,
                exit: q.exit,
              }
            : s.module.id === "signal"
              ? { observed: q.observed, signal: q.signal }
              : s.module.id === "pendulum"
                ? {
                    gears: q.gears,
                    direction: q.direction,
                    clockStart: q.clockStart,
                    period: q.period / q.gears[1],
                  }
                : { routes: q.routes, route: q.route, bearing: q.bearing };
    return {
      role: "engineer",
      observations,
      machine,
      vote: s.harborVotes?.[id],
    };
  }
  const manual =
    s.module.id === "prism"
      ? { base: q.base, lens: s.harbor.lens }
      : s.module.id === "power"
        ? { baseLight: q.baseLight, baseHeat: q.baseHeat }
        : s.module.id === "coolant"
          ? { materialRules: q.materialRules }
          : s.module.id === "signal"
            ? { dictionary: q.dictionary }
            : s.module.id === "pendulum"
              ? {
                  ratioTable: q.ratioTable,
                  reverseWinds: q.reverseWinds,
                  phaseChart: q.phaseChart,
                }
              : {
                  waterRules: q.waterRules,
                  cargoRules: q.cargoRules,
                  courseOffset: q.courseOffset,
                };
  return { role: "guide", manual, vote: s.harborVotes?.[id] };
}
