import { esc, icon } from "./ui.js";
export const expeditionKinds = ["archipelago", "rift"];
export const expeditionTitles = {
  archipelago: "Острова наизнанку",
  rift: "Комната с разломом",
};
const names = [
  "Тихая гавань",
  "Память тумана",
  "Переводчики звёзд",
  "Хрупкое равновесие",
  "Тропа искателей",
  "Обратная сторона",
  "Радио маяка",
  "Сердце архипелага",
];
const glyphs = ["Луна", "Лист", "Волна", "Искра"];
const marks = ["☾", "♧", "≈", "✧"];
const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
export function initExpedition(s) {
  s.turn = 0;
  s.totalRounds = 8;
  s.scores = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  s.journal = [];
  nextIsland(s);
}
export function nextIsland(s) {
  s.challenge = (
    s.kind === "beacon"
      ? [
          "signal",
          "balance",
          "memory",
          "link",
          "signal",
          "balance",
          "link",
          "memory",
        ]
      : s.kind === "race"
        ? [
            "risk",
            "memory",
            "signal",
            "link",
            "risk",
            "memory",
            "balance",
            "link",
          ]
        : [
            "signal",
            "memory",
            "balance",
            "risk",
            "link",
            "memory",
            "signal",
            "link",
          ]
  )[s.turn];
  s.phase = "challenge";
  s.responses = {};
  s.progressBy = {};
  s.memorized = [];
  s.readyAnswers = [];
  s.roundGains = {};
  s.roundMistakes = {};
  s.pattern = Array.from(
    { length: Math.min(7, 3 + Math.floor(s.turn / 2)) },
    () => Math.floor(Math.random() * 4),
  );
  s.targets = Object.fromEntries(
    s.players.map((p, i) => [
      p.id,
      (i + s.turn + Math.floor(Math.random() * 3)) % 4,
    ]),
  );
  s.layouts = Object.fromEntries(
    s.players.map((p) => [p.id, shuffle([0, 1, 2, 3])]),
  );
  s.dials = Object.fromEntries(s.players.map((p) => [p.id, 0]));
  s.cursor = [0, 0];
  s.beacons = 0;
  s.destinations = [
    [5, 5],
    [5, 0],
    [0, 5],
  ];
  s.obstacles =
    s.turn % 2
      ? [
          [2, 0],
          [2, 1],
          [2, 2],
          [4, 4],
        ]
      : [
          [1, 3],
          [2, 3],
          [3, 3],
          [4, 1],
        ];
  s.moves = 0;
}
function complete(s, gains) {
  s.roundGains =
    gains ||
    Object.fromEntries(
      s.players.map((u) => [
        u.id,
        Math.max(2, 10 - (s.roundMistakes[u.id] || 0) * 2),
      ]),
    );
  for (const [id, n] of Object.entries(s.roundGains))
    s.scores[id] = (s.scores[id] || 0) + n;
  s.phase = "reveal";
  s.journal.push({
    name: names[s.turn],
    type: s.challenge,
    gains: s.roundGains,
  });
}
export function expeditionCommand(s, sender, input) {
  if (s.phase === "reveal" && input.action === "island-next") {
    if (s.turn + 1 >= s.totalRounds) {
      s.finished = true;
      s.elapsed = Date.now() - s.started;
      return true;
    }
    s.turn++;
    nextIsland(s);
    return true;
  }
  if (s.phase !== "challenge") return false;
  const value = Number(input.value);
  if (input.action === "mission-memorized" && s.challenge === "memory") {
    if (!s.memorized.includes(sender)) s.memorized.push(sender);
    return true;
  }
  if (input.action === "mission-symbol" && [0, 1, 2, 3].includes(value)) {
    if (s.challenge === "memory") {
      if (!s.memorized.includes(sender) || s.readyAnswers.includes(sender))
        return false;
      const progress = s.progressBy[sender] || 0;
      if (value === s.pattern[progress]) s.progressBy[sender] = progress + 1;
      else {
        s.progressBy[sender] = 0;
        s.roundMistakes[sender] = (s.roundMistakes[sender] || 0) + 1;
      }
      if (s.progressBy[sender] === s.pattern.length)
        s.readyAnswers.push(sender);
    } else if (s.challenge === "signal") {
      if (s.readyAnswers.includes(sender)) return false;
      if (value === s.targets[sender]) s.readyAnswers.push(sender);
      else s.roundMistakes[sender] = (s.roundMistakes[sender] || 0) + 1;
    } else return false;
    if (s.players.every((u) => s.readyAnswers.includes(u.id))) complete(s);
    return true;
  }
  if (
    input.action === "mission-dial" &&
    s.challenge === "balance" &&
    [-1, 1].includes(value)
  ) {
    s.dials[sender] = (s.dials[sender] + value + 5) % 5;
    s.moves++;
    if (s.players.every((u) => s.dials[u.id] === s.targets[u.id])) complete(s);
    return true;
  }
  if (
    input.action === "mission-risk" &&
    s.challenge === "risk" &&
    [0, 1, 2].includes(value)
  ) {
    s.responses[sender] = value;
    if (s.players.every((u) => Object.hasOwn(s.responses, u.id))) {
      const bold = Object.values(s.responses).filter((n) => n === 2).length;
      complete(
        s,
        Object.fromEntries(
          s.players.map((u) => [
            u.id,
            s.responses[u.id] === 0
              ? 4
              : s.responses[u.id] === 1
                ? 7
                : bold <= Math.ceil(s.players.length / 3)
                  ? 12
                  : 2,
          ]),
        ),
      );
    }
    return true;
  }
  if (
    input.action === "mission-move" &&
    s.challenge === "link" &&
    [-1, 1].includes(value)
  ) {
    const role = s.players.findIndex((u) => u.id === sender) % 2,
      axis = (role + s.turn) % 2;
    const next = [...s.cursor];
    next[axis] = Math.max(0, Math.min(5, next[axis] + value));
    s.moves++;
    if (!s.obstacles.some(([x, y]) => next[0] === x && next[1] === y))
      s.cursor = next;
    const target = s.destinations[s.beacons];
    if (s.cursor[0] === target[0] && s.cursor[1] === target[1]) s.beacons++;
    if (s.beacons >= s.destinations.length)
      complete(s, Object.fromEntries(s.players.map((u) => [u.id, 12])));
    return true;
  }
  return false;
}
export function expeditionPublic(s) {
  return {
    players: s.players,
    turn: s.turn,
    totalRounds: s.totalRounds,
    challenge: s.challenge,
    phase: s.phase,
    scores: s.scores,
    gains: s.roundGains,
    memorized: s.memorized,
    progressBy: s.progressBy,
    readyAnswers: s.readyAnswers,
    pattern:
      s.challenge === "memory" && s.memorized.length < s.players.length
        ? s.pattern
        : [],
    patternLength: s.pattern.length,
    dials: s.dials,
    layouts: s.layouts,
    submitted: Object.keys(s.responses),
    responses: s.phase === "reveal" ? s.responses : {},
    cursor: s.cursor,
    obstacles: s.obstacles,
    beacons: s.beacons,
    destination: s.destinations[Math.min(s.beacons, 2)],
    moves: s.moves,
    journal: s.journal,
    requiresScreen: s.kind === "rift",
  };
}
export function expeditionSecret(s, user) {
  const i = s.players.findIndex((u) => u.id === user),
    next = s.players[(i + 1) % s.players.length];
  return {
    guide: {
      name: next.name,
      target: s.targets[next.id],
      glyph: glyphs[s.targets[next.id]],
    },
    pattern: s.kind === "rift" ? [] : s.pattern,
  };
}
export function expeditionScreen(f, screen = false) {
  const p = f.public;
  if (f.finished)
    return `<section class="expedition-finale"><span class="eyebrow">АРХИПЕЛАГ СОБРАН</span><h2>Восемь историй, которые вы прошли вместе</h2><div class="voyage-scores">${p.players.map((u) => `<span>${esc(u.name)}<b>${p.scores[u.id] || 0}</b></span>`).join("")}</div><div class="island-journal">${p.journal.map((r, i) => `<div><span>0${i + 1}</span><h3>${r.name}</h3></div>`).join("")}</div></section>`;
  const board = `<div class="island-route">${names.map((name, i) => `<span class="island ${i === p.turn ? "current" : i < p.turn ? "visited" : ""}" style="--island:${i}"><i>${i < p.turn ? "✓" : i + 1}</i><small>${name}</small></span>`).join("")}</div>`;
  let body = "";
  if (p.phase === "reveal")
    body = `<div class="island-success"><span>✦</span><h3>Остров отзывается</h3><p>Обсудите ваш ход. Следующая история начнётся, когда вы захотите.</p><div class="voyage-scores">${p.players.map((u) => `<span>${esc(u.name)} <b>+${p.gains[u.id] || 0}</b><small>${p.scores[u.id] || 0} всего</small></span>`).join("")}</div></div>`;
  else if (p.challenge === "memory")
    body = `<div class="signal-memory">${!p.requiresScreen || screen ? `<h3>Запомните световой след</h3><div class="memory-pattern">${p.pattern.length ? p.pattern.map((n) => `<span>${marks[n]}</span>`).join("") : "<span>След ушёл в туман. Воспроизведите его на телефонах.</span>"}</div>` : "<h3>Сигналы — на общем экране</h3>"}<p>${p.readyAnswers.length} / ${p.players.length} восстановили путь</p></div>`;
  else if (p.challenge === "signal")
    body =
      '<div class="signal-memory"><h3>Вы — переводчики друг для друга</h3><p>Вы видите нужный символ соседа, но не свой. Опишите его голосом. На каждом пульте символы расположены по-разному.</p></div>';
  else if (p.challenge === "balance")
    body = `<div class="reactor-world"><span class="reactor-core">◎</span><h3>Удержите хрупкое равновесие</h3><p>Вы знаете настройку соседа. Договоритесь вслух и настройте каждый свой регулятор.</p><div class="reactor-dials">${p.players.map((u) => `<span>${esc(u.name)}<b>${p.dials[u.id] || 0}</b></span>`).join("")}</div></div>`;
  else if (p.challenge === "risk")
    body = `<div class="risk-world"><h3>На острове хватает места не всем искателям</h3><p>Привал даёт 4 кристалла, разведка — 7. Рывок даёт 12, если его выбрала не более трети команды; иначе только 2. Выбирайте тайно — и обсуждайте последствия.</p><strong>${p.submitted.length} / ${p.players.length} выбрали</strong></div>`;
  else if (p.challenge === "link")
    body =
      !p.requiresScreen || screen
        ? `<h3>Один корабль. Половина управления у каждого.</h3><div class="rift-maze">${Array.from(
            { length: 36 },
            (_, i) => {
              const x = i % 6,
                y = Math.floor(i / 6);
              return `<span class="${p.obstacles.some(([a, b]) => a === x && b === y) ? "wall" : ""} ${p.cursor[0] === x && p.cursor[1] === y ? "ship" : ""} ${p.destination[0] === x && p.destination[1] === y ? "goal" : ""}">${p.cursor[0] === x && p.cursor[1] === y ? "◈" : p.destination[0] === x && p.destination[1] === y ? "✦" : ""}</span>`;
            },
          ).join(
            "",
          )}</div><p>${p.beacons} / 3 маяков · ${p.moves} движений. На этом острове оси поменялись местами.</p>`
        : "<h3>Корабль и разломы видны только на общем экране.</h3>";
  return `<section class="expedition-world expedition-${f.kind}"><span class="eyebrow">ОСТРОВ ${p.turn + 1} / 8</span><h2>${names[p.turn]}</h2>${board}<div class="island-challenge">${body}</div></section>`;
}
export function expeditionControls(f, user, secret) {
  const p = f.public,
    b = (label, action, value = "", cls = "soft") =>
      `<button class="btn ${cls}" data-party="${action}" data-value="${value}">${label}</button>`;
  if (f.finished) return "";
  if (p.phase === "reveal")
    return b(
      p.turn === 7
        ? "Открыть наш архипелаг"
        : "Следующий остров " + icon("arrow"),
      "island-next",
      "",
      "primary wide",
    );
  if (p.challenge === "signal")
    return `<div class="private-instructions"><span>ПЕРЕДАЙТЕ ГОЛОСОМ</span><h3>${esc(secret.guide?.name)} нужен символ «${esc(secret.guide?.glyph)}»</h3></div><div class="mission-symbols">${(p.layouts[user] || [0, 1, 2, 3]).map((n) => b(marks[n] + "<small>" + glyphs[n] + "</small>", "mission-symbol", n)).join("")}</div>${p.readyAnswers.includes(user) ? "<p>Ваш сигнал совпал. Помогите остальным.</p>" : ""}`;
  if (p.challenge === "memory")
    return !p.memorized.includes(user)
      ? `${p.requiresScreen ? "<p>Посмотрите на большой экран. Можно обсуждать и делить последовательность.</p>" : `<div class="memory-pattern">${(secret.pattern || []).map((n) => `<span>${marks[n]}</span>`).join("")}</div>`}${b("Запомнил · спрятать след", "mission-memorized", "", "primary wide")}`
      : `<p>Повторите след · ${p.progressBy[user] || 0} / ${p.patternLength}</p><div class="mission-symbols">${(p.layouts[user] || [0, 1, 2, 3]).map((n) => b(marks[n], "mission-symbol", n)).join("")}</div>`;
  if (p.challenge === "balance")
    return `<p>${esc(secret.guide?.name)} нужно значение ${secret.guide?.target ?? "…"}. У каждого — своя часть инструкции.</p><div class="dial-control">${b("−", "mission-dial", -1)}<strong>${p.dials[user] || 0}</strong>${b("+", "mission-dial", 1)}</div>`;
  if (p.challenge === "risk")
    return p.submitted.includes(user)
      ? "<p>Ваш выбор принят. Дождёмся остальных.</p>"
      : `<div class="risk-buttons">${b("Привал · 4", "mission-risk", 0)}${b("Разведка · 7", "mission-risk", 1)}${b("Рывок · 12 или 2", "mission-risk", 2, "lavender")}</div>`;
  const role = p.players.findIndex((u) => u.id === user) % 2,
    axis = (role + p.turn) % 2;
  return `<p>Ваш пульт управляет ${axis ? "вертикалью" : "горизонталью"}. Вторую ось держит партнёр. Найдите три маяка и обходите тёмные разломы.</p><div class="navigation-thrusters">${b(axis ? "Вверх" : "Влево", "mission-move", -1)}${b(axis ? "Вниз" : "Вправо", "mission-move", 1)}</div>`;
}
