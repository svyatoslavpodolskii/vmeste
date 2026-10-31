import { esc, icon } from "./ui.js";
const clamp = (n) => Math.max(0, Math.min(1, n));
export const quad = (x, y) => [
  (1 - x) * (1 - y),
  x * (1 - y),
  (1 - x) * y,
  x * y,
];
const roles = [
  ["Прилив", "Мягкие волны и тёплые обертоны", "tide"],
  ["Крона", "Воздушные переливы и мерцающая глубина", "canopy"],
  ["Орбита", "Дальний свет и медленные гармонии", "orbit"],
  ["Искра", "Зернистые текстуры и мягкое эхо", "spark"],
];
export function soundRole(f, user) {
  return (f.public.players.findIndex((u) => u.id === user) + 4) % 4;
}
function pad(bank, title, corners, point, theme) {
  const [x, y] = point || [0.5, 0.5];
  return `<section class="mix-panel panel-${theme}"><header><span class="eyebrow">${bank ? "02 / ГАРМОНИКИ" : "01 / СРЕДА"}</span><h3>${title}</h3></header><div class="xy-pad" data-sound-pad="${bank}" role="slider" tabindex="0" aria-label="${title}: смешивание четырёх настроений" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(x * 100)}" aria-valuetext="Горизонталь ${Math.round(x * 100)}, вертикаль ${Math.round(y * 100)}" data-x="${x}" data-y="${y}"><div class="pad-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></div>${corners.map((c, i) => `<span class="corner corner-${i}">${c}</span>`).join("")}<span class="pad-orbit orbit-a"></span><span class="pad-orbit orbit-b"></span><span class="mix-cursor" style="transform:translate(${x * 100}%,${y * 100}%)"><i></i></span><span class="pad-hint">Двигайте свет внутри</span></div></section>`;
}
export function soundControls(f, user, audio, voice = 0) {
  const mine =
      f.public.contributors?.[
        f.public.solo && voice ? user + ":voice" + voice : user
      ] || {},
    role = f.public.solo ? voice : soundRole(f, user),
    r = roles[role];
  return `<div class="instrument instrument-${r[2]}">${f.public.solo ? `<div class="voice-tabs" aria-label="Четыре одиночных пульта">${roles.map((r, i) => `<button data-party="voice" data-index="${i}" aria-pressed="${i === voice}">${r[0]}</button>`).join("")}</div>` : ``}<header class="instrument-title"><span class="instrument-sigil">${["◒", "⌁", "◉", "✧"][role]}</span><div><span class="eyebrow">ВАШ ПУЛЬТ / ${role + 1}</span><h3>${r[0]}</h3><p>${r[1]}</p></div></header><button class="btn primary wide" data-party="sound">${icon(audio?.started ? "pause" : "play")} ${audio?.started ? "Пауза" : "Включить звук здесь"}</button>${f.kind === "soundgarden" ? pad(0, "Живой ландшафт", role % 2 ? ["Листва", "Дождь", "Ночь", "Ветер"] : ["Берег", "Роса", "Ветер", "Лес"], mine.pads?.[0], r[2]) + pad(1, "Гармонический сад", role % 2 ? ["Хрусталь", "Туман", "Космос", "Тепло"] : ["Свет", "Земля", "Воздух", "Янтарь"], mine.pads?.[1] || [0.45, 0.65], r[2]) : pad(0, "Как дышит ваш космос", ["Прозрачно", "Тепло", "Текуче", "Глубоко"], mine.pads?.[0], r[2]) + `<section class="constellation-field"><span class="eyebrow">ЗАЖГИТЕ СОЗВЕЗДИЕ</span><p>Удерживайте: ярче свет, сильнее отклик, дольше послезвучие.</p><div class="constellations">${["Комета", "Туманность", "Пульсар", "Аврора"].map((n, i) => `<button data-constellation="${i}" class="constellation constellation-${(i + role) % 4}" aria-label="Удерживать: ${n}"><svg viewBox="0 0 100 90" aria-hidden="true"><path d="${["M15 60 40 20 60 66 88 30", "M10 30 40 65 58 16 90 55", "M20 15 80 30 40 70 20 15 85 75", "M10 66 30 20 70 15 90 55 50 78 30 20"][(i + role) % 4]}"/><circle cx="40" cy="20" r="3"/><circle cx="60" cy="66" r="4"/><circle cx="88" cy="30" r="3"/></svg><span>${n}</span><i></i></button>`).join("")}</div></section>`}<div class="sound-volume"><label>Громкость здесь<input type="range" data-sound-volume min="0" max="1" step=".01" value="${audio?.level ?? 0.55}"></label><p>Ваши пульты различаются. Каждый меняет свою часть общего звучания.</p></div></div>`;
}
export function soundWorld(f) {
  const cs = Object.values(f.public.contributors || {}),
    a = cs[0]?.pads?.[0] || [0.5, 0.5],
    b = cs[1]?.pads?.[0] || [0.5, 0.5];
  return `<div class="audio-visual world-${f.kind}" aria-hidden="true"><div class="sound-orbit" style="transform:translate(${(a[0] - 0.5) * 35}px,${(a[1] - 0.5) * 30}px) scale(${0.8 + a[0] * 0.4})"></div><div class="sound-orbit second" style="transform:translate(${(b[0] - 0.5) * -35}px,${(b[1] - 0.5) * 30}px) scale(${0.8 + b[1] * 0.4})"></div><span class="sound-seed">${f.kind === "meditation" ? "СЛУШАТЬ МЕЖДУ ЗВЁЗДАМИ" : "САД, КОТОРЫЙ РАСТЁТ ИЗ ВАС"}</span><div class="world-particles">${Array.from({ length: 12 }, (_, i) => `<i style="--n:${i}"></i>`).join("")}</div></div><div class="contribution-strip">${f.public.players.map((u, i) => `<span><i class="contribution-${i % 4}"></i>${esc(u.name)} · ${roles[i % 4][0]}</span>`).join("")}</div>`;
}
export function bindSoundControls(party) {
  for (const stop of party.soundCleanup || []) stop();
  party.soundCleanup = [];
  for (const pad of document.querySelectorAll("[data-sound-pad]")) {
    let active = false,
      last = 0;
    const update = (x, y, send = true) => {
      x = clamp(x);
      y = clamp(y);
      pad.dataset.x = x;
      pad.dataset.y = y;
      pad.querySelector(".mix-cursor").style.transform =
        `translate(${x * 100}%,${y * 100}%)`;
      pad.setAttribute("aria-valuenow", Math.round(x * 100));
      pad.setAttribute(
        "aria-valuetext",
        `Горизонталь ${Math.round(x * 100)}, вертикаль ${Math.round(y * 100)}`,
      );
      if (send)
        party.input({
          action: "sound-pad",
          voice: party.voice || 0,
          bank: Number(pad.dataset.soundPad),
          x,
          y,
        });
    };
    const move = (e) => {
      if (!active) return;
      const r = pad.getBoundingClientRect();
      const send = performance.now() - last > 70;
      if (send) last = performance.now();
      update(
        (e.clientX - r.left) / r.width,
        (e.clientY - r.top) / r.height,
        send,
      );
    };
    pad.onpointerdown = (e) => {
      active = true;
      last = 0;
      pad.setPointerCapture(e.pointerId);
      pad.classList.add("is-touching");
      move(e);
    };
    pad.onpointermove = move;
    pad.onpointerup = pad.onpointercancel = () => {
      if (active) update(Number(pad.dataset.x), Number(pad.dataset.y));
      active = false;
      pad.classList.remove("is-touching");
    };
    pad.onkeydown = (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
        return;
      e.preventDefault();
      update(
        Number(pad.dataset.x) +
          (e.key === "ArrowLeft" ? -0.04 : e.key === "ArrowRight" ? 0.04 : 0),
        Number(pad.dataset.y) +
          (e.key === "ArrowUp" ? -0.04 : e.key === "ArrowDown" ? 0.04 : 0),
      );
    };
  }
  for (const star of document.querySelectorAll("[data-constellation]")) {
    let started = 0,
      timer;
    const stop = () => {
      if (!started) return;
      const hold = Math.min(5, (performance.now() - started) / 1000);
      clearInterval(timer);
      started = 0;
      star.classList.remove("holding");
      star.classList.add("afterglow");
      star.style.setProperty("--decay", `${1 + hold * 3}s`);
      party.input({
        action: "star",
        voice: party.voice || 0,
        index: Number(star.dataset.constellation),
        power: 0.25 + hold * 0.15,
        hold,
        until: Date.now() + 1000 + hold * 3000,
      });
      navigator.vibrate?.(0);
    };
    party.soundCleanup.push(stop);
    const start = () => {
      if (started) return;
      started = performance.now();
      star.classList.add("holding");
      star.classList.remove("afterglow");
      party.input({
        action: "star",
        voice: party.voice || 0,
        index: Number(star.dataset.constellation),
        power: 0.2,
        hold: 0,
        until: Date.now() + 1000,
      });
      timer = setInterval(() => {
        const hold = Math.min(5, (performance.now() - started) / 1000);
        star.style.setProperty("--charge", String(0.2 + hold * 0.16));
        navigator.vibrate?.(Math.round(10 + hold * 3));
        party.input({
          action: "star",
          voice: party.voice || 0,
          index: Number(star.dataset.constellation),
          power: 0.2 + hold * 0.16,
          hold,
          until: Date.now() + 1300,
        });
      }, 240);
    };
    star.onpointerdown = (e) => {
      star.setPointerCapture(e.pointerId);
      start();
    };
    star.onpointerup = star.onpointercancel = stop;
    star.onkeydown = (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        start();
      }
    };
    star.onkeyup = stop;
  }
}
