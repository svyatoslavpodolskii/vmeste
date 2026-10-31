import { esc } from "./ui.js";
import { cardKey, playedHistory } from "./game-pools.js";
const axes = [
  ["Почти незаметно", "Грандиозно"],
  ["Абсолютный покой", "Полный хаос"],
  ["Каждый день", "Раз в жизни"],
  ["Очень уютно", "Очень приключенчески"],
  ["Маленькая радость", "Большая мечта"],
  ["План до мелочей", "Чистая импровизация"],
  ["Совершенно обычно", "Совершенно волшебно"],
  ["Сделать самому", "Собрать команду"],
  ["Тихий вечер", "Большой праздник"],
  ["Больше смешно", "Больше трогательно"],
  ["Просто начать", "Нужно набраться смелости"],
  ["Запах детства", "Запах будущего"],
  ["Крошечный секрет", "Новость для всех"],
  ["Подарок практичный", "Подарок удивительный"],
  ["Медленно и вдумчиво", "Быстро и интуитивно"],
  ["Идеальный порядок", "Творческий беспорядок"],
  ["Скорее реальность", "Скорее сон"],
  ["Только для себя", "Хочется поделиться"],
  ["Короткая прогулка", "Настоящая экспедиция"],
  ["Изобретение полезное", "Изобретение забавное"],
  ["Приятный сюрприз", "Невероятный поворот"],
  ["Для дождливого утра", "Для звёздной ночи"],
  ["Вещь с историей", "Вещь из будущего"],
  ["Тихая уверенность", "Взрыв восторга"],
];
export function nextFrequency(s, store) {
  const history = playedHistory(store);
  const available = axes.filter((a) => !s.usedAxes.includes(a.join(" · ")));
  const pool = available.length ? available : axes;
  s.axis = pool
    .map((axis) => ({
      axis,
      time: history[cardKey("Частота: " + axis.join(" · "))] || 0,
      tie: Math.random(),
    }))
    .sort((a, b) => a.time - b.time || a.tie - b.tie)[0].axis;
  s.usedAxes.push(s.axis.join(" · "));
  s.lead = s.players[s.turn % s.players.length].id;
  s.target = 10 + Math.floor(Math.random() * 81);
  s.phase = "clue";
  s.clue = "";
  s.guesses = {};
}
export function revealFrequency(s) {
  const guesses = Object.values(s.guesses);
  if (s.phase !== "guess" || !guesses.length) return false;
  s.phase = "reveal";
  s.consensus = Math.round(guesses.reduce((a, b) => a + b, 0) / guesses.length);
  s.gain = Math.max(0, 100 - Math.abs(s.consensus - s.target) * 4);
  s.log.push({
    axis: s.axis,
    clue: s.clue,
    target: s.target,
    consensus: s.consensus,
    gain: s.gain,
  });
  s.score = Math.round(s.log.reduce((n, r) => n + r.gain, 0) / s.log.length);
  s.scores = Object.fromEntries(s.players.map((p) => [p.id, s.score]));
  return true;
}
export function frequencyCommand(s, sender, input) {
  if (
    input.action === "frequency-spoken" &&
    s.phase === "clue" &&
    sender === s.lead
  ) {
    s.clue = "Подсказка прозвучала вслух";
    s.phase = "guess";
    return true;
  }
  if (input.action !== "answer") return false;
  if (s.phase === "clue" && sender === s.lead) {
    const clue = String(input.values?.answer || "")
      .trim()
      .slice(0, 160);
    if (!clue) return false;
    s.clue = clue;
    s.phase = "guess";
    return true;
  }
  if (
    s.phase === "guess" &&
    sender !== s.lead &&
    !Object.hasOwn(s.guesses, sender)
  ) {
    const raw = input.values?.guess;
    const value = Number(raw);
    if (
      !["string", "number"].includes(typeof raw) ||
      raw == null ||
      raw === "" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    )
      return false;
    s.guesses[sender] = Math.round(value);
    if (Object.keys(s.guesses).length === s.players.length - 1)
      revealFrequency(s);
    return true;
  }
  return false;
}
export function frequencyPublic(s) {
  const p = {
    cancelled: !!s.finished && s.log.length < s.totalRounds,
    players: s.players,
    axis: s.axis,
    lead: s.lead,
    turn: s.turn,
    totalRounds: s.totalRounds,
    phase: s.phase,
    clue: s.clue,
    voted: Object.keys(s.guesses),
    score: s.score || 0,
    scores: s.scores || {},
  };
  if (s.phase === "reveal" || (s.finished && !p.cancelled))
    Object.assign(p, {
      target: s.target,
      guesses: s.guesses,
      consensus: s.consensus,
      gain: s.gain,
    });
  if (s.finished) p.log = s.log;
  return p;
}
export function frequencyScreen(f) {
  const p = f.public,
    revealed = p.phase === "reveal" || (f.finished && !p.cancelled);
  if (p.cancelled)
    return '<div class="game-instruction"><h3>Можно продолжить в другой раз</h3><p>Партия завершена досрочно. Незаконченный результат не попал в рекорды.</p></div>';
  if (f.finished)
    return `<div class="frequency-world"><div class="frequency-orbit" aria-hidden="true">◌</div><h3>Ваше созвучие — ${p.score}/100</h3><p>Каждый увидел мир по-своему. Вот волны, на которых вы встретились.</p><div class="frequency-log">${(p.log || []).map((r) => `<article><strong>${esc(r.clue)}</strong><span>${r.consensus} → ${r.target} · ${r.gain}/100</span><small>${esc(r.axis.join(" — "))}</small></article>`).join("")}</div></div>`;
  const markers = revealed
    ? `<div class="frequency-zone" style="left:${Math.max(0, p.target - 6)}%;width:12%"></div><i class="frequency-target" style="left:${p.target}%"><span>Секрет · ${p.target}</span></i><i class="frequency-consensus" style="left:${p.consensus}%"><span>Вы · ${p.consensus}</span></i>`
    : '<span class="frequency-hidden">Частота пока скрыта</span>';
  return `<div class="frequency-world"><div class="frequency-orbit" aria-hidden="true">◌</div><p class="frequency-clue">${esc(p.clue || "Какой пример настроит вас на одну волну?")}</p><div class="frequency-dial">${markers}</div><div class="frequency-poles"><strong>${esc(p.axis[0])}</strong><strong>${esc(p.axis[1])}</strong></div>${
    revealed
      ? `<div class="frequency-result"><b>${p.gain || 0}<small>/100</small></b><span>за эту волну</span><p>${p.gain >= 88 ? "Почти читаете мысли друг друга." : p.gain >= 60 ? "Поймали близкую частоту." : "Ваши шкалы разные — и это начало интересного разговора."}</p></div><div class="frequency-guesses">${p.players
          .filter((u) => Object.hasOwn(p.guesses || {}, u.id))
          .map(
            (u) =>
              `<span>${esc(u.avatar)} ${esc(u.name)} <b>${p.guesses[u.id]}</b></span>`,
          )
          .join("")}</div>`
      : `<p class="muted">${p.phase === "clue" ? `${esc(p.players.find((u) => u.id === p.lead)?.name || "")} придумывает подсказку` : `${p.voted.length} / ${p.players.length - 1} догадок · позиции скрыты до раскрытия`}</p>`
  }</div>`;
}
export function frequencyControls(f, userId, secret) {
  const p = f.public;
  if (p.phase === "clue")
    return p.lead === userId
      ? `<div class="private-instructions"><small>ВАША ТАЙНАЯ ЧАСТОТА</small><h3 data-frequency-secret>${secret.target ?? "Получаем…"}</h3><p>0 — ${esc(p.axis[0])}. 100 — ${esc(p.axis[1])}.</p></div><p class="game-instruction">Скажите вслух один образ в этой точке шкалы. Не называйте число. Если вы далеко друг от друга, используйте ваш звонок.</p><button class="btn primary wide" data-party="frequency-spoken">Подсказка сказана</button><details class="game-rules"><summary>Удобнее написать?</summary><form id="party-answer-form"><label>Подсказка<input name="answer" maxlength="160" required></label><button class="btn soft wide">Передать подсказку</button></form></details>`
      : '<div class="game-instruction"><h3>Ловите ход мыслей</h3><p>Подсказчик видит точку и подбирает пример. Скоро вы решите, где он находится на шкале.</p></div>';
  if (p.phase === "guess")
    return p.lead === userId
      ? '<p class="game-instruction">Сохраните загадочное лицо. Пусть остальные обсудят ваш пример, не добавляйте объяснений до раскрытия.</p>'
      : p.voted.includes(userId)
        ? '<p class="game-instruction">Ваша частота принята. Дождёмся остальных и откроем всё вместе.</p>'
        : '<form id="party-answer-form"><label>Где находится этот пример?<input type="range" name="guess" min="0" max="100" value="50" step="1" data-frequency-slider></label><output class="frequency-reading">50</output><button class="btn primary wide">Зафиксировать частоту</button><p class="fine">Обсудите пример и выберите свою позицию. Командная точка — среднее ваших догадок.</p></form>';
  return '<p class="game-instruction">Что в подсказке повело вас именно сюда? Обсудите до следующей волны: единственно правильного восприятия здесь нет.</p>';
}
