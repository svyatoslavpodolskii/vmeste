import { esc, icon } from "./ui.js";

export const CIRCUIT_VERSION = 2;
export const teamPercent = (r) =>
  (r.teamScore / r.runLength).toLocaleString("ru-RU", {
    maximumFractionDigits: 1,
  });
const runDuration = (seconds) =>
  seconds < 60 ? `${Math.ceil(seconds)} с` : `${Math.floor(seconds / 60)} мин`;
// Each pair shares input primitives, but changes the actual objective or information available.
export const circuitTrials = [
  [
    "echo",
    "memory",
    "Световой след",
    "Вместе запомните дорожку. Воспроизведите её по очереди, по одному огоньку.",
  ],
  [
    "backecho",
    "memory",
    "Время вспять",
    "Запомните дорожку, затем пройдите её в обратном порядке. Ходы чередуются.",
  ],
  [
    "catch",
    "timing",
    "Ловцы рассвета",
    "У каждого свой луч. Поймайте его в центре шкалы. Важна общая точность, а не скорость друг против друга.",
  ],
  [
    "crossing",
    "timing",
    "Встречное течение",
    "Лучи движутся с разной скоростью и в разных направлениях. Каждый ловит свой свет в отмеченной зоне.",
  ],
  [
    "scales",
    "balance",
    "Воздушный мост",
    "Выберите по одному грузу так, чтобы общий вес совпал с целью. Ваши наборы разные — обсуждайте варианты.",
  ],
  [
    "climate",
    "balance",
    "Погода в бутылке",
    "Настройте одновременно тепло и влагу. Каждая ваша колба меняет оба значения — найдите сочетание вместе.",
  ],
  [
    "paths",
    "maze",
    "Двое в тумане",
    "Управляйте одним светлячком: один отвечает за горизонталь, другой — за вертикаль. Доберитесь до выхода.",
  ],
  [
    "keys",
    "maze",
    "Три потерянных искры",
    "Сначала соберите все три искры, затем ведите общий свет к выходу. Оси управления разделены.",
  ],
  [
    "wire",
    "wiring",
    "Проводники",
    "Поворачивайте свои участки цепи. Проведите свет от входа к выходу через оба реле.",
  ],
  [
    "detour",
    "wiring",
    "Окольный свет",
    "Соберите цепь с обходом: выход на той же стороне карты, но свет должен пройти дальние реле.",
  ],
  [
    "cargo",
    "cargo",
    "Ночной почтальон",
    "Соберите общий груз: уложитесь в вес и доставьте достаточно света. У каждого свой багаж.",
  ],
  [
    "fragile",
    "cargo",
    "Хрупкая экспедиция",
    "Кроме веса и света, сохраните точное количество хрупких посылок. Обсуждайте, что берёте.",
  ],
  [
    "code",
    "cipher",
    "Переводчики звёзд",
    "Один видит символ, другой — словарь. Договоритесь, какую кнопку нажать. Роли меняются.",
  ],
  [
    "shiftcode",
    "cipher",
    "Сдвинутая азбука",
    "Переведите символ по словарю и сдвиньте ответ на указанное число. Словарь и сдвиг на разных телефонах.",
  ],
  [
    "rhythm",
    "rhythm",
    "Ночная перекличка",
    "Каждый повторяет три удара по своей схеме. Общий ритм складывается из ваших разных партий.",
  ],
  [
    "sustain",
    "hold",
    "Длинное дыхание",
    "Запустите свет и отпустите через свой интервал. Постарайтесь вместе точно выдержать разные длительности.",
  ],
  [
    "parcels",
    "sorting",
    "Станция чудес",
    "Один видит посылку, другой знает правила станции. Отправляйте её в нужный портал, меняясь ролями.",
  ],
  [
    "mirrorpost",
    "sorting",
    "Зеркальная почта",
    "Правила станции меняются после каждой пары посылок. Следите за прямым и зеркальным режимами.",
  ],
  [
    "centroid",
    "orbit",
    "Общая орбита",
    "Расположите свои огни так, чтобы их общий центр оказался в нужной точке. Координаты цели разделены между вами.",
  ],
  [
    "tether",
    "orbit",
    "Натянутая нить",
    "Совместите общий центр с целью и сохраните нужную длину нити между первыми двумя огнями.",
  ],
  [
    "clues",
    "logic",
    "Перекрёсток смыслов",
    "У каждого часть карты. В каждом ряду найдите единственный знак, подходящий всем вашим подсказкам.",
  ],
  [
    "exclusions",
    "logic",
    "От противного",
    "Некоторые подсказки говорят о подходящих знаках, другие — о запрещённых. Сопоставьте их вслух.",
  ],
  [
    "kitchen",
    "recipe",
    "Кухня комет",
    "У каждого три ингредиента. Договоритесь, кто что добавит, чтобы вместе получить точный рецепт.",
  ],
  [
    "courses",
    "recipe",
    "Ужин по созвездиям",
    "Приготовьте три блюда подряд. На каждом блюде наборы ингредиентов меняются, а цель остаётся общей.",
  ],
].map(([id, family, title, instruction], i) => ({
  id,
  family,
  title,
  instruction,
  variant: i % 2,
}));

const symbols = ["☾", "✧", "≈", "♧", "◈", "◎"];
function rng(seed) {
  let n = 2166136261;
  for (const c of seed) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    return (n >>> 0) / 4294967296;
  };
}
const shuffled = (items, random) =>
  [...items]
    .map((v) => [random(), v])
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v);
const sum = (items) => items.reduce((a, b) => a + b, 0);
const all = (s, list) => s.players.every((p) => list.includes(p.id));
export function initCircuit(s, length = s.runLength || 8) {
  s.runLength = [8, 16, 24].includes(Number(length)) ? Number(length) : 8;
  const random = rng(s.round);
  // Interleave families so a shared run cannot be dominated by one input mechanic.
  const families = shuffled(
    [...new Set(circuitTrials.map((t) => t.family))],
    random,
  );
  const first = families.map(
    (f) =>
      shuffled(
        circuitTrials.filter((t) => t.family === f),
        random,
      )[0],
  );
  const second = shuffled(
    circuitTrials.filter((t) => !first.includes(t)),
    random,
  );
  s.route = first
    .concat(second)
    .slice(0, s.runLength)
    .map((t) => t.id);
  s.turn = 0;
  // Start with visible, direct actions; the longer box keeps advanced trials.
  if (s.runLength === 8)
    s.route = shuffled(
      [
        "echo",
        "catch",
        "paths",
        "wire",
        "code",
        "rhythm",
        "sustain",
        "parcels",
      ],
      random,
    );
  s.teamScore = 0;
  s.journal = [];
  s.rulesVersion = CIRCUIT_VERSION;
  prepareTrial(s);
}
export function prepareTrial(s) {
  s.trial = circuitTrials.find((t) => t.id === s.route[s.turn]);
  s.phase = "briefing";
  s.trialReady = [];
  s.attempts = 0;
  s.feedback = "";
  generateTrial(s);
}
function generateTrial(s) {
  const random = rng(`${s.round}:${s.turn}`),
    int = (max) => Math.floor(random() * max),
    ids = s.players.map((p) => p.id);
  const q = (s.q = { progress: 0, choices: {}, submitted: [], mistakes: 0 });
  const variant = s.trial.variant;
  switch (s.trial.family) {
    case "memory":
      q.pattern = Array.from({ length: 5 + variant }, () => int(4));
      q.expected = variant ? [...q.pattern].reverse() : q.pattern;
      q.memorized = [];
      break;
    case "timing":
      q.period = variant ? 3100 : 4000;
      q.offsets = Object.fromEntries(
        ids.map((id, i) => [id, variant ? i * 0.23 : 0]),
      );
      q.hits = {};
      break;
    case "rhythm":
      q.period = 6000;
      q.patterns = Object.fromEntries(
        ids.map((id, i) => [
          id,
          [0.15 + i * 0.025, 0.45 + i * 0.025, 0.75 + i * 0.025],
        ]),
      );
      q.hits = {};
      break;
    case "hold":
      q.durations = Object.fromEntries(
        ids.map((id, i) => [id, 1000 + ((i + s.turn) % 4) * 350]),
      );
      q.hits = {};
      break;
    case "balance": {
      q.options = Object.fromEntries(
        ids.map((id) => [
          id,
          Array.from({ length: 4 }, () => [1 + int(8), 1 + int(8)]),
        ]),
      );
      const selected = ids.map((id) => q.options[id][int(4)]);
      q.target = [
        sum(selected.map((v) => v[0])),
        sum(selected.map((v) => v[1])),
      ];
      break;
    }
    case "maze": {
      q.position = 0;
      q.exit = 35;
      q.keys = variant ? [5, 20, 30] : [];
      q.collected = [];
      // A connected perimeter and open central cross guarantee reachable keys and exit.
      const safe = new Set(
        Array.from({ length: 36 }, (_, n) => n).filter(
          (n) =>
            n < 6 ||
            n >= 30 ||
            n % 6 === 0 ||
            n % 6 === 5 ||
            n % 6 === 2 ||
            Math.floor(n / 6) === 3,
        ),
      );
      q.walls = shuffled(
        Array.from({ length: 36 }, (_, n) => n).filter((n) => !safe.has(n)),
        random,
      ).slice(0, 8);
      break;
    }
    case "wiring": {
      const path = variant
        ? [0, 4, 8, 9, 10, 6, 2, 3]
        : [0, 1, 5, 9, 10, 11, 15];
      q.exit = path.at(-1);
      q.relays = variant ? [8, 10] : [5, 10];
      q.tiles = Array.from({ length: 16 }, () => (int(2) ? [0, 1] : [0, 2]));
      const direction = (from, to) =>
        to === from - 4 ? 0 : to === from + 1 ? 1 : to === from + 4 ? 2 : 3;
      path.forEach((cell, i) => {
        q.tiles[cell] = [
          i ? direction(cell, path[i - 1]) : 3,
          i < path.length - 1 ? direction(cell, path[i + 1]) : 1,
        ];
      });
      q.rotation = Array.from({ length: 16 }, () => int(4));
      break;
    }
    case "cargo": {
      q.inventory = Object.fromEntries(
        ids.map((id) => [
          id,
          Array.from({ length: 4 }, () => ({
            mass: 1 + int(5),
            light: 1 + int(6),
            fragile: int(2),
          })),
        ]),
      );
      const delivery = ids.flatMap((id) =>
        shuffled(q.inventory[id], random).slice(0, 2),
      );
      q.capacity = sum(delivery.map((v) => v.mass));
      q.requiredLight = sum(delivery.map((v) => v.light));
      q.fragile = sum(delivery.map((v) => v.fragile));
      ids.forEach((id) => (q.choices[id] = []));
      break;
    }
    case "cipher":
      q.dictionary = shuffled([0, 1, 2, 3], random);
      q.codes = Array.from({ length: 6 }, () => int(4));
      q.shifts = Array.from({ length: 6 }, () => (variant ? 1 + int(3) : 0));
      break;
    case "sorting":
      q.rules = shuffled([0, 1, 2], random);
      q.parcels = Array.from({ length: 8 }, () => int(6));
      break;
    case "orbit": {
      const solution = ids.map(() => [int(3), int(3)]);
      q.target = [
        sum(solution.map((p) => p[0])),
        sum(solution.map((p) => p[1])),
      ];
      q.distance =
        (solution[0][0] - solution[1][0]) ** 2 +
        (solution[0][1] - solution[1][1]) ** 2;
      break;
    }
    case "logic": {
      q.answers = Array.from({ length: 3 }, () => int(6));
      q.clues = Object.fromEntries(
        ids.map((id, i) => [
          id,
          q.answers.map((correct) => {
            const remaining = [0, 1, 2, 3, 4, 5].filter((n) => n !== correct);
            return [
              correct,
              ...remaining.slice(i % 2 ? 2 : 0, i % 2 ? 4 : 2),
            ].sort((a, b) => a - b);
          }),
        ]),
      );
      break;
    }
    case "recipe":
      generateRecipe(s, random);
      break;
  }
}
function generateRecipe(s, random) {
  const q = s.q;
  q.cupboards = Object.fromEntries(
    s.players.map((p) => [
      p.id,
      shuffled([0, 1, 2, 3, 4, 5], random).slice(0, 3),
    ]),
  );
  const solution = s.players.map(
    (p) => q.cupboards[p.id][Math.floor(random() * 3)],
  );
  q.recipe = Array.from(
    { length: 6 },
    (_, n) => solution.filter((v) => v === n).length,
  );
  q.choices = {};
  q.submitted = [];
}
function succeed(s, score = 100, detail = "Получилось вместе") {
  s.result = {
    score: Math.max(10, Math.round(score - s.attempts * 8 - s.q.mistakes * 3)),
    detail,
  };
  s.phase = "result";
  s.trialReady = [];
}
function incorrect(s, detail) {
  s.attempts++;
  s.feedback = detail;
}
export function circuitLit(q) {
  const ports = (cell) => q.tiles[cell].map((v) => (v + q.rotation[cell]) % 4);
  if (!ports(0).includes(3)) return [];
  const lit = new Set([0]),
    queue = [0];
  for (const cell of queue)
    for (const dir of ports(cell)) {
      const next = [cell - 4, cell + 1, cell + 4, cell - 1][dir];
      if (
        next < 0 ||
        next >= 16 ||
        (dir === 1 && cell % 4 === 3) ||
        (dir === 3 && cell % 4 === 0)
      )
        continue;
      if (!lit.has(next) && ports(next).includes((dir + 2) % 4)) {
        lit.add(next);
        queue.push(next);
      }
    }
  return [...lit];
}
export function circuitCommand(s, sender, input, now = Date.now()) {
  if (
    s.finished ||
    !s.players.some((p) => p.id === sender) ||
    Number(input.turn) !== s.turn
  )
    return false;
  const q = s.q,
    family = s.trial.family,
    variant = s.trial.variant,
    n = s.players.length,
    index = s.players.findIndex((p) => p.id === sender);
  const value = Number(input.value),
    action = input.action;
  if (
    action === "run-ready" &&
    (s.phase === "briefing" || s.phase === "result")
  ) {
    if (!s.trialReady.includes(sender)) s.trialReady.push(sender);
    if (all(s, s.trialReady)) {
      if (s.phase === "briefing") {
        s.phase = family === "memory" ? "memorize" : "play";
        q.started = now + 1800;
      } else {
        s.teamScore += s.result.score;
        s.journal.push({
          id: s.trial.id,
          score: s.result.score,
          attempts: s.attempts,
          detail: s.result.detail,
        });
        s.turn++;
        if (s.turn >= s.route.length) {
          s.finished = true;
          s.elapsed = now - s.started;
          s.phase = "finished";
        } else prepareTrial(s);
      }
    }
    return true;
  }
  if (action === "run-memorized" && s.phase === "memorize") {
    if (!q.memorized.includes(sender)) q.memorized.push(sender);
    if (all(s, q.memorized)) s.phase = "play";
    return true;
  }
  if (s.phase !== "play") return false;
  if (action === "run-retry") {
    s.attempts++;
    generateTrial(s);
    s.phase = family === "memory" ? "memorize" : "play";
    s.q.started = now + 1800;
    s.feedback = "Попробуем ещё раз вместе";
    return true;
  }
  if (action === "run-commit") {
    if (!Object.hasOwn(q.choices, sender)) return false;
    if (q.submitted.includes(sender))
      q.submitted = q.submitted.filter((id) => id !== sender);
    else q.submitted.push(sender);
    if (all(s, q.submitted)) {
      if (family === "balance") {
        const picks = s.players.map((p) => q.options[p.id][q.choices[p.id]]),
          got = [sum(picks.map((v) => v[0])), sum(picks.map((v) => v[1]))];
        if (got[0] === q.target[0] && (!variant || got[1] === q.target[1]))
          succeed(s);
        else {
          incorrect(
            s,
            `Получилось ${got[0]}${variant ? " / " + got[1] : ""}. Сравните наборы и попробуйте другое сочетание.`,
          );
          q.submitted = [];
        }
      }
      if (family === "cargo") {
        const picks = s.players.flatMap((p) =>
          q.choices[p.id].map((i) => q.inventory[p.id][i]),
        );
        const mass = sum(picks.map((v) => v.mass)),
          light = sum(picks.map((v) => v.light)),
          fragile = sum(picks.map((v) => v.fragile));
        if (
          mass <= q.capacity &&
          light >= q.requiredLight &&
          (!variant || fragile === q.fragile)
        )
          succeed(s, 100, `Доставлено ${light} света, вес ${mass}`);
        else {
          incorrect(
            s,
            `Вес ${mass}/${q.capacity}, свет ${light}/${q.requiredLight}${variant ? ", хрупких: " + fragile + "/" + q.fragile : ""}. Груз можно изменить.`,
          );
          q.submitted = [];
        }
      }
      if (family === "orbit") {
        const picks = s.players.map((p) => [
          q.choices[p.id] % 3,
          Math.floor(q.choices[p.id] / 3),
        ]);
        const got = [sum(picks.map((p) => p[0])), sum(picks.map((p) => p[1]))],
          distance =
            (picks[0][0] - picks[1][0]) ** 2 + (picks[0][1] - picks[1][1]) ** 2;
        if (
          got.every((v, i) => v === q.target[i]) &&
          (!variant || distance === q.distance)
        )
          succeed(s);
        else {
          incorrect(
            s,
            `Общий центр: ${(got[0] / n).toFixed(2)} / ${(got[1] / n).toFixed(2)}${variant ? ", квадрат длины нити: " + distance : ""}. Подвиньте огни вместе.`,
          );
          q.submitted = [];
        }
      }
      if (family === "recipe") {
        const recipe = Array.from(
          { length: 6 },
          (_, i) => s.players.filter((p) => q.choices[p.id] === i).length,
        );
        if (recipe.every((v, i) => v === q.recipe[i])) {
          if (!variant || q.progress === 2)
            succeed(s, 100, variant ? "Три блюда готовы" : "Рецепт собран");
          else {
            q.progress++;
            generateRecipe(s, rng(`${s.round}:${s.turn}:dish${q.progress}`));
            s.feedback = "Блюдо готово! Теперь новый рецепт.";
          }
        } else {
          incorrect(
            s,
            "Ингредиенты не совпали с рецептом. Обсудите, кто что добавляет.",
          );
          q.submitted = [];
        }
      }
    }
    return true;
  }
  if (
    action === "run-choice" &&
    Number.isInteger(value) &&
    !q.submitted.includes(sender)
  ) {
    if (family === "balance" && value >= 0 && value < 4)
      q.choices[sender] = value;
    else if (family === "cargo" && value >= 0 && value < 4) {
      const items = q.choices[sender] || [];
      q.choices[sender] = items.includes(value)
        ? items.filter((n) => n !== value)
        : [...items, value];
    } else if (family === "orbit" && value >= 0 && value < 9)
      q.choices[sender] = value;
    else if (family === "recipe" && q.cupboards[sender].includes(value))
      q.choices[sender] = value;
    else return false;
    return true;
  }
  if (action === "run-tap" && Number.isInteger(value)) {
    if (
      ["memory", "cipher", "sorting", "logic"].includes(family) &&
      s.players[q.progress % n].id !== sender
    )
      return false;
    if (family === "memory" && value >= 0 && value < 4) {
      if (value === q.expected[q.progress]) q.progress++;
      else {
        q.mistakes++;
        s.feedback = "Этот огонёк другой. Сохраняем место, попробуйте ещё раз.";
      }
      if (q.progress === q.expected.length) succeed(s);
      return true;
    }
    if (family === "cipher" && value >= 0 && value < 4) {
      if (
        value ===
        (q.dictionary[q.codes[q.progress]] + q.shifts[q.progress]) % 4
      )
        q.progress++;
      else {
        q.mistakes++;
        s.feedback = "Сигнал не совпал. Сверьте словарь и сдвиг.";
      }
      if (q.progress === q.codes.length) succeed(s);
      return true;
    }
    if (family === "sorting" && value >= 0 && value < 3) {
      let target = q.rules[q.parcels[q.progress] % 3];
      if (variant && Math.floor(q.progress / 2) % 2) target = 2 - target;
      if (value === target) q.progress++;
      else {
        q.mistakes++;
        s.feedback = "Портал не принял посылку. Сверьте режим и инструкцию.";
      }
      if (q.progress === q.parcels.length) succeed(s);
      return true;
    }
    if (family === "logic" && value >= 0 && value < 6) {
      if (value === q.answers[q.progress]) q.progress++;
      else {
        q.mistakes++;
        s.feedback = "Этот знак не подходит всем подсказкам.";
      }
      if (q.progress === q.answers.length) succeed(s);
      return true;
    }
  }
  if (
    action === "run-move" &&
    family === "maze" &&
    [0, 1, 2, 3].includes(value)
  ) {
    if (
      n > 1 &&
      (value === 1 || value === 3 ? index % 2 !== 0 : index % 2 !== 1)
    )
      return false;
    const cell = q.position,
      next = [cell - 6, cell + 1, cell + 6, cell - 1][value];
    if (
      next < 0 ||
      next >= 36 ||
      (value === 1 && cell % 6 === 5) ||
      (value === 3 && cell % 6 === 0) ||
      q.walls.includes(next)
    ) {
      q.mistakes++;
      s.feedback = "Здесь стена. Попробуйте другую тропу.";
    } else q.position = next;
    if (q.keys.includes(q.position) && !q.collected.includes(q.position))
      q.collected.push(q.position);
    if (q.position === q.exit && q.collected.length === q.keys.length)
      succeed(s);
    return true;
  }
  if (
    action === "run-rotate" &&
    family === "wiring" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < 16 &&
    value % n === index
  ) {
    q.rotation[value] = (q.rotation[value] + 1) % 4;
    const lit = circuitLit(q);
    if (
      lit.includes(q.exit) &&
      q.tiles[q.exit].map((v) => (v + q.rotation[q.exit]) % 4).includes(1) &&
      q.relays.every((r) => lit.includes(r))
    )
      succeed(s);
    return true;
  }
  if (
    action === "run-hit" &&
    ["timing", "rhythm", "hold"].includes(family) &&
    Number.isFinite(input.measure)
  ) {
    if (q.submitted.includes(sender)) return false;
    const measure = Number(input.measure);
    if (family === "timing")
      q.hits[sender] = [Math.max(0, Math.min(1, measure))];
    if (family === "hold")
      q.hits[sender] = [Math.max(0, Math.min(10000, measure))];
    if (family === "rhythm") {
      q.hits[sender] ||= [];
      if (q.hits[sender].length < 3)
        q.hits[sender].push(Math.max(0, Math.min(1.5, measure)));
    }
    if (family !== "rhythm" || q.hits[sender].length === 3)
      q.submitted.push(sender);
    if (all(s, q.submitted)) {
      const errors = s.players.map((p) =>
        family === "timing"
          ? Math.abs(q.hits[p.id][0] - 0.5)
          : family === "hold"
            ? Math.abs(q.hits[p.id][0] - q.durations[p.id]) / 4000
            : sum(
                q.hits[p.id].map((hit, i) =>
                  Math.abs(hit - q.patterns[p.id][i]),
                ),
              ) / 3,
      );
      succeed(
        s,
        Math.max(20, 100 - (sum(errors) / n) * 180),
        "Ваш общий ритм сохранён",
      );
    }
    return true;
  }
  return false;
}

export function circuitPublic(s) {
  const q = s.q,
    family = s.trial.family;
  const common = {
    rulesVersion: CIRCUIT_VERSION,
    trial: s.trial,
    phase: s.phase,
    turn: s.turn,
    route: s.route,
    runLength: s.runLength,
    teamScore: s.teamScore,
    result: s.result,
    journal: s.journal,
    trialReady: s.trialReady,
    feedback: s.feedback,
    submitted: q.submitted,
    progress: q.progress,
    started: q.started,
    attempts: s.attempts,
  };
  if (family === "memory")
    Object.assign(common, {
      pattern: s.phase === "memorize" ? q.pattern : null,
      length: q.expected.length,
      memorized: q.memorized,
    });
  if (family === "timing" || family === "rhythm") common.period = q.period;
  if (family === "balance")
    common.target = s.trial.variant ? q.target : [q.target[0]];
  if (family === "maze")
    Object.assign(common, {
      position: q.position,
      exit: q.exit,
      walls: q.walls,
      keys: q.keys,
      collected: q.collected,
    });
  if (family === "wiring")
    Object.assign(common, {
      tiles: q.tiles.map((ports, i) =>
        ports.map((v) => (v + q.rotation[i]) % 4),
      ),
      lit: circuitLit(q),
      relays: q.relays,
      exit: q.exit,
    });
  if (family === "cargo")
    Object.assign(common, {
      capacity: q.capacity,
      requiredLight: q.requiredLight,
      fragile: s.trial.variant ? q.fragile : null,
    });
  if (family === "orbit")
    Object.assign(common, {
      points: s.players.map((p) => q.choices[p.id] ?? null),
      distance: s.trial.variant ? q.distance : null,
    });
  if (family === "recipe") common.recipe = q.recipe;
  return common;
}
export function circuitSecret(s, id) {
  const q = s.q,
    family = s.trial.family,
    index = s.players.findIndex((p) => p.id === id),
    actor = s.players[q.progress % s.players.length].id;
  const secret = { choice: q.choices[id], actor, slot: index };
  if (family === "balance") secret.options = q.options[id];
  if (family === "cargo") secret.inventory = q.inventory[id];
  if (family === "cipher") {
    if (id !== actor) secret.dictionary = q.dictionary;
    else {
      secret.code = q.codes[q.progress];
      secret.shift = q.shifts[q.progress];
    }
  }
  if (family === "sorting") {
    if (id !== actor) secret.rules = q.rules;
    else secret.parcel = q.parcels[q.progress];
    secret.mirror = s.trial.variant && Math.floor(q.progress / 2) % 2 === 1;
  }
  if (family === "logic") {
    secret.clue = q.clues[id][q.progress] || [];
    secret.negative = !!s.trial.variant && index % 2 === 1;
  }
  if (family === "orbit")
    secret.target = {
      axis: index % 2,
      value: q.target[index % 2] / s.players.length,
    };
  if (family === "recipe") secret.cupboard = q.cupboards[id];
  if (family === "timing") secret.offset = q.offsets[id];
  if (family === "rhythm") {
    secret.pattern = q.patterns[id];
    secret.hits = q.hits[id]?.length || 0;
  }
  if (family === "hold") secret.duration = q.durations[id];
  return secret;
}

const button = (title, action, value, extra = "") =>
  `<button class="btn soft" data-party="run-action" data-run-action="${action}" data-value="${value}" ${extra}>${title}</button>`;
export function circuitScreen(f) {
  const p = f.public;
  return `<section class="circuit-scene"><span class="eyebrow">СВЕТЛЯЧКИ · ОДНА КОМАНДА</span><div class="circuit-route">${(p.route || []).map((id, i) => `<i class="${i < p.turn ? "passed" : i === p.turn ? "current" : ""}" title="${esc(circuitTrials.find((t) => t.id === id)?.title)}"></i>`).join("")}</div><h2>${f.finished ? "Ночь стала светлее" : esc(p.trial?.title)}</h2><p>${f.finished ? `Вы вместе прошли ${p.runLength} испытаний` : esc(p.trial?.instruction)}</p><div class="team-light"><strong>${p.teamScore || 0}</strong><span>общего света${p.runLength ? ` · из ${p.runLength * 100}` : ""}</span></div>${p.phase === "result" ? `<div class="circuit-result"><strong>+${p.result.score}</strong><p>${esc(p.result.detail)}</p><small>Все достижения здесь общие.</small></div>` : ""}${p.phase === "play" && p.trial.family === "maze" ? mazeGrid(p) : p.phase === "play" && p.trial.family === "wiring" ? wireGrid(p) : p.phase === "memorize" ? `<div class="circuit-pattern">${p.pattern.map((n) => `<span>${symbols[n]}</span>`).join("")}</div>` : ""}${p.feedback ? `<p class="circuit-feedback" role="status">${esc(p.feedback)}</p>` : ""}</section>`;
}
function mazeGrid(p) {
  return `<div class="circuit-maze">${Array.from({ length: 36 }, (_, i) => `<i class="${p.walls.includes(i) ? "wall" : ""} ${p.position === i ? "traveller" : ""}">${p.position === i ? "✦" : p.exit === i ? "⌂" : p.keys.includes(i) && !p.collected.includes(i) ? "·" : ""}</i>`).join("")}</div>`;
}
function wireGrid(p, playerIndex = -1, count = 1) {
  return `<div class="circuit-wires">${p.tiles
    .map(
      (ports, i) =>
        `<button class="wire-tile ${p.lit.includes(i) ? "lit" : ""} ${p.relays.includes(i) ? "relay" : ""}" ${playerIndex >= 0 && i % count === playerIndex ? 'data-party="run-action" data-run-action="run-rotate" data-value="' + i + '"' : "disabled"} aria-label="Повернуть участок ${i + 1}"><svg viewBox="0 0 100 100" aria-hidden="true">${ports
          .map(
            (dir) =>
              `<path d="M50 50 L${[
                [50, 0],
                [100, 50],
                [50, 100],
                [0, 50],
              ][dir].join(" ")}"/>`,
          )
          .join(
            "",
          )}<circle cx="50" cy="50" r="${p.relays.includes(i) ? 12 : 5}"/></svg></button>`,
    )
    .join("")}</div>`;
}
export function circuitControls(f, user, secret = {}) {
  const p = f.public,
    family = p.trial.family,
    index = p.players.findIndex((u) => u.id === user),
    mine = p.submitted?.includes(user),
    ready = p.trialReady?.includes(user),
    actor = secret.actor === user;
  if (f.finished)
    return `<button class="btn primary wide" data-party="circuit-home">Меню забегов и общие рекорды</button>`;
  if (["briefing", "result"].includes(p.phase))
    return `<p class="center">${p.trialReady?.length || 0} / ${p.players.length} готовы</p><button class="btn primary wide" data-party="run-action" data-run-action="run-ready" ${ready ? "disabled" : ""}>${ready ? "Ждём остальных" : p.phase === "briefing" ? "Правила понятны · готов" : "Дальше вместе"}</button>`;
  if (p.phase === "memorize")
    return `<button class="btn primary wide" data-party="run-action" data-run-action="run-memorized" ${p.memorized.includes(user) ? "disabled" : ""}>${p.memorized.includes(user) ? "Ждём остальных" : "Запомнил"}</button>`;
  let html = "";
  if (["memory", "cipher", "sorting", "logic"].includes(family))
    html += `<p class="game-instruction">${actor ? "Ваш ход — советуйтесь вслух" : `Сейчас действует ${esc(p.players.find((u) => u.id === secret.actor)?.name || "ваш человек")}`}</p>`;
  if (family === "memory")
    html += `<p class="center">Огонёк ${(p.progress || 0) + 1} / ${p.length}${p.trial.variant ? " · обратный порядок" : ""}</p><div class="circuit-buttons">${symbols
      .slice(0, 4)
      .map((s, i) => button(s, "run-tap", i, actor ? "" : "disabled"))
      .join("")}</div>`;
  if (family === "timing" || family === "rhythm" || family === "hold") {
    if (mine)
      return '<div class="circuit-wait"><h3>Ваш свет пойман</h3><p>Ждём остальные партии вашего общего ритма.</p></div>';
    if (family === "timing")
      html += `<div class="timing-track" data-run-clock="timing" data-start="${p.started}" data-period="${p.period}" data-offset="${secret.offset || 0}"><i style="animation-duration:${p.period}ms;animation-delay:${p.started - Date.now() - (secret.offset || 0) * p.period}ms;animation-direction:${p.trial.variant && index % 2 ? "reverse" : "normal"}"></i><b></b></div><button class="btn primary wide" data-party="run-action" data-run-action="run-hit">Поймать в центре</button>`;
    if (family === "rhythm")
      html += `<p>Ваши удары: ${(secret.pattern || []).map((v) => Math.round(v * 100) + "%").join(" · ")}</p><div class="timing-track" data-run-clock="rhythm" data-start="${p.started}" data-period="${p.period}"><i style="animation-duration:${p.period}ms;animation-delay:${p.started - Date.now()}ms;animation-iteration-count:1;animation-fill-mode:forwards"></i>${(secret.pattern || []).map((v) => `<b style="left:${v * 100}%"></b>`).join("")}</div><button class="btn primary wide" data-party="run-action" data-run-action="run-hit">Удар ${(secret.hits || 0) + 1} / 3</button>`;
    if (family === "hold")
      html += `<p class="center">Ваш интервал: ${(secret.duration / 1000).toFixed(2)} с. Считайте вместе вслух.</p><button class="btn primary wide" data-party="run-hold" data-duration="${secret.duration}">Запустить свет</button>`;
  }
  if (family === "balance")
    html += `<h3>Общая цель: ${p.target.join(" тепла / ")}${p.trial.variant ? " влаги" : " веса"}</h3><div class="circuit-options">${(secret.options || []).map((v, i) => button(p.trial.variant ? `${v[0]} тепла · ${v[1]} влаги` : `Вес ${v[0]}`, "run-choice", i, `${mine ? "disabled" : ""} aria-pressed="${secret.choice === i}"`)).join("")}</div>`;
  if (family === "maze")
    html += `<p class="center">${index % 2 ? "Вы управляете вертикалью" : "Вы управляете горизонталью"}${p.keys.length ? ` · Искры: ${p.collected.length} / ${p.keys.length}` : ""}</p>${mazeGrid(p)}<div class="circuit-buttons">${(index %
    2
      ? [
          ["↑", 0],
          ["↓", 2],
        ]
      : [
          ["←", 3],
          ["→", 1],
        ]
    )
      .map(([label, dir]) => button(label, "run-move", dir))
      .join("")}</div>`;
  if (family === "wiring")
    html += `<p class="center">Ваши участки доступны для поворота. Свет должен пройти реле с кругами.</p>${wireGrid(p, index, p.players.length)}`;
  if (family === "cargo")
    html += `<h3>Вес ≤ ${p.capacity} · свет ≥ ${p.requiredLight}${p.fragile != null ? ` · хрупких ровно ${p.fragile}` : ""}</h3><div class="circuit-options">${(secret.inventory || []).map((v, i) => button(`${symbols[i]} Вес ${v.mass} · свет ${v.light}${v.fragile ? " · хрупкое" : ""}`, "run-choice", i, `${mine ? "disabled" : ""} aria-pressed="${secret.choice?.includes(i) || false}"`)).join("")}</div>`;
  if (family === "cipher")
    html += actor
      ? `<div class="private-instructions"><h3>Сигнал ${symbols[secret.code] || "…"}${secret.shift ? ` · сдвиг +${secret.shift}` : ""}</h3><p>Попросите перевод у вашего человека, затем нажмите ответ.</p></div><div class="circuit-buttons">${[0, 1, 2, 3].map((v) => button(String(v + 1), "run-tap", v)).join("")}</div>`
      : `<div class="private-instructions"><h3>Ваш словарь</h3><p>${(secret.dictionary || []).map((v, i) => symbols[i] + " = " + (v + 1)).join(" · ")}</p><p>При сдвиге после четвёртой кнопки снова идёт первая.</p></div>`;
  if (family === "sorting")
    html += actor
      ? `<div class="private-instructions"><h3>Посылка ${symbols[secret.parcel] || "…"}</h3><p>${secret.mirror ? "Зеркальный режим: первый и третий порталы меняются местами" : "Прямой режим"}</p></div><div class="circuit-buttons">${[0, 1, 2].map((i) => button("Портал " + (i + 1), "run-tap", i)).join("")}</div>`
      : `<div class="private-instructions"><h3>Таблица станции</h3><p>${(secret.rules || []).map((v, i) => symbols[i] + " и " + symbols[i + 3] + " → портал " + (v + 1)).join("<br>")}</p><p>В зеркальном режиме 1 ↔ 3.</p></div>`;
  if (family === "orbit")
    html += `<div class="private-instructions"><p>Ваша часть цели: ${secret.target?.axis ? "вертикаль" : "горизонталь"} общего центра = ${secret.target?.value?.toFixed(2)}${p.distance != null ? ` · квадрат длины нити = ${p.distance}` : ""}</p></div><div class="orbit-choice">${Array.from({ length: 9 }, (_, i) => button(`${i % 3} / ${Math.floor(i / 3)}`, "run-choice", i, `${mine ? "disabled" : ""} aria-pressed="${secret.choice === i}"`)).join("")}</div>`;
  if (family === "logic")
    html += `<div class="private-instructions"><h3>Ряд ${(p.progress || 0) + 1} / 3</h3><p>${secret.negative ? "Запрещены: " + symbols.filter((_, i) => !secret.clue?.includes(i)).join(" ") : "Подходят: " + (secret.clue || []).map((i) => symbols[i]).join(" ")}</p></div><div class="circuit-buttons">${symbols.map((s, i) => button(s, "run-tap", i, actor ? "" : "disabled")).join("")}</div>`;
  if (family === "recipe")
    html += `<h3>Рецепт ${p.trial.variant ? `${(p.progress || 0) + 1} / 3` : ""}</h3><p class="recipe-target">${p.recipe
      .map((v, i) => (v ? `${symbols[i]} × ${v}` : ""))
      .filter(Boolean)
      .join(
        " · ",
      )}</p><p>Ваши ингредиенты</p><div class="circuit-buttons">${(secret.cupboard || []).map((i) => button(symbols[i], "run-choice", i, `${mine ? "disabled" : ""} aria-pressed="${secret.choice === i}"`)).join("")}</div>`;
  if (["balance", "cargo", "orbit", "recipe"].includes(family))
    html += `<button class="btn primary wide" data-party="run-action" data-run-action="run-commit" ${secret.choice == null ? "disabled" : ""}>${mine ? "Отменить готовность" : "Готово"}</button><p class="fine center">${p.submitted?.length || 0} / ${p.players.length} готовы. Можно менять выбор до общей проверки.</p>`;
  if (family === "rhythm")
    html += `<button class="btn text wide" data-party="run-action" data-run-action="run-retry">Начать ритм заново вместе</button>`;
  return html;
}
export function circuitHome(store, active) {
  const records = store.data.plans
    .filter(
      (r) =>
        !r.deletedAt &&
        r.arcadeRecord?.kind === "race" &&
        r.arcadeRecord.rulesVersion === CIRCUIT_VERSION,
    )
    .map((r) => ({ ...r.arcadeRecord, id: r.id }))
    .sort(
      (a, b) =>
        b.teamScore / b.runLength - a.teamScore / a.runLength ||
        a.seconds - b.seconds,
    );
  return `<section class="circuit-home"><span class="eyebrow">КООПЕРАТИВНЫЙ ПАРК ИСПЫТАНИЙ</span><h2>Светлячки</h2><p>Одна команда, разные таланты. Ведите общий свет через память, ритм, цепи и тайные подсказки. Личного победителя здесь нет.</p>${
    active && !active.finished
      ? '<button class="btn primary wide" data-party="circuit-resume">Продолжить общий забег</button>'
      : `<h3>Выберите прогулку</h3><div class="circuit-options">${[
          [8, "Короткая тропа"],
          [16, "Большая прогулка"],
          [24, "Вся ночь"],
        ]
          .map(
            ([n, title]) =>
              `<button class="btn soft" data-party="circuit-start" data-length="${n}"><strong>${title}</strong><small>${n} разных испытаний</small></button>`,
          )
          .join("")}</div>`
  }<h3>Ваши общие рекорды</h3>${
    records.length
      ? `<div class="circuit-records">${records
          .slice(0, 12)
          .map(
            (r) =>
              `<article><strong>${teamPercent(r)}% общего света</strong><p>${r.players.map((id) => esc(store.users.find((u) => u.localUserId === id)?.displayName || "Участник")).join(" + ")}</p><small>${r.runLength} испытаний · ${runDuration(r.seconds)} · ${new Date(r.createdAt).toLocaleDateString("ru-RU")}</small><button class="btn text" data-party="view-team-record" data-id="${esc(r.id)}">Посмотреть путь</button></article>`,
          )
          .join("")}</div>`
      : '<div class="empty"><p>Первый общий рекорд появится после полного забега. Можно играть с остановками и возвращаться к той же тропе.</p></div>'
  }<details class="game-rules"><summary>Какие испытания вас ждут</summary><div class="circuit-catalogue">${circuitTrials.map((t) => `<article><strong>${t.title}</strong><p>${t.instruction}</p></article>`).join("")}</div></details></section>`;
}
export function circuitRecordView(record, store) {
  const r = record.arcadeRecord;
  return `<section class="circuit-home"><span class="eyebrow">СОХРАНЁННЫЙ ОБЩИЙ ПУТЬ</span><h2>Светлячки · ${teamPercent(r)}%</h2><p>${r.players.map((id) => esc(store.users.find((u) => u.localUserId === id)?.displayName || "Участник")).join(" + ")}</p><div class="circuit-records">${(r.journal || []).map((item, i) => `<article><small>Этап ${i + 1}</small><h3>${esc(circuitTrials.find((t) => t.id === item.id)?.title || item.id)}</h3><strong>${item.score} общего света</strong><p>${esc(item.detail)}</p></article>`).join("")}</div><button class="btn text wide" data-party="delete-record" data-id="${esc(record.id)}">${icon("trash")} Удалить результат</button></section>`;
}
