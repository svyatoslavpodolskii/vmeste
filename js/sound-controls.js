import { esc, icon } from "./ui.js";
import { assignedConstellations } from "./composition.js";
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
export function meditationVoices(state) {
  const players = state.solo
    ? state.players.slice(0, 1)
    : state.players.slice(0, 4);
  if (!players.length) return [];
  return roles.map((r, index) => {
    const owner = players[index % players.length];
    const voice = Math.floor(index / players.length);
    return {
      index,
      owner: owner.id,
      name: r[0],
      voice,
      id: owner.id + (voice ? ":voice" + voice : ""),
      theme: r[2],
    };
  });
}
export function arrangeMeditation(state) {
  if (state.kind !== "meditation") return;
  const previous = Object.values(state.contributors || {});
  state.contributors = Object.fromEntries(
    meditationVoices(state).map((v) => [
      v.id,
      {
        layers: [1, 1, 1, 0, 0, 0, 0, 0],
        moods: [0.55, 0.3, 0.6, 0.7],
        pads: [
          [0.25 + (v.index % 2) * 0.5, 0.25 + Math.floor(v.index / 2) * 0.5],
          [0.45, 0.65],
        ],
        ...(previous.find((c) => c.slot === v.index) ||
          previous[v.index] ||
          {}),
        slot: v.index,
      },
    ]),
  );
}
function meditationPlane(f, user) {
  return `<section class="meditation-mixer"><header><span class="eyebrow">ЧЕТЫРЕ ГОЛОСА · ОДНО НЕБО</span><h3>Характер музыки</h3></header><p>Двигайте свои огни. Каждый меняет свою гармонику; чужие огни видны рядом.</p><div class="plane-labels"><span>Прозрачно</span><span>Тепло</span></div><div class="meditation-plane" aria-label="Общая плоскость четырёх голосов"><div class="pad-grid" aria-hidden="true"><i></i><i></i></div>${meditationVoices(
    { ...f.public, kind: f.kind },
  )
    .map((v) => {
      const point = f.public.contributors?.[v.id]?.pads?.[0] || [0.5, 0.5];
      return `<button class="meditation-point point-${v.index} ${v.owner === user ? "own-point" : "remote-point"}" data-meditation-point="${v.voice}" data-point-slot="${v.index}" data-owner="${esc(v.owner)}" data-x="${point[0]}" data-y="${point[1]}" style="left:${10 + point[0] * 80}%;top:${10 + point[1] * 80}%" aria-label="${v.name}: ${v.owner === user ? "ваш голос, двигайте стрелками или касанием" : "голос другого участника"}" ${v.owner === user ? "" : "disabled"}><i></i><span>${v.name}</span></button>`;
    })
    .join(
      "",
    )}</div><div class="plane-labels"><span>Текуче</span><span>Глубоко</span></div><div class="plane-legend">${meditationVoices(
    f.public,
  )
    .map(
      (v) =>
        `<span class="legend-${v.index}"><i></i>${v.name} · ${v.owner === user ? "вы" : esc(f.public.players.find((p) => p.id === v.owner)?.name || "ваш человек")}</span>`,
    )
    .join("")}</div></section>`;
}
export function soundRole(f, user) {
  return (f.public.players.findIndex((u) => u.id === user) + 4) % 4;
}
function starDrawing(index) {
  const points = Array.from({ length: 4 + (index % 3) }, (_, i) => {
    const angle = i * 2.399 + index * 0.47;
    const radius = 18 + ((i * 13 + index * 7) % 22);
    return [50 + Math.cos(angle) * radius, 45 + Math.sin(angle) * radius];
  });
  return `<svg viewBox="0 0 100 90" aria-hidden="true"><path d="M${points.map((p) => p.join(" ")).join(" L")}"/>${points.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === 0 ? 4 : 2.5}"/>`).join("")}</svg>`;
}

export function updateSoundConnections() {
  const plane = document.querySelector(".meditation-plane");
  if (!plane) return;
  let svg = plane.querySelector(".voice-connections");
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("voice-connections");
    plane.prepend(svg);
  }
  const points = [...plane.querySelectorAll(".meditation-point")];
  svg.innerHTML = points
    .flatMap((a, i) =>
      points.slice(i + 1).map((b) => {
        const ax = Number(a.dataset.x),
          ay = Number(a.dataset.y),
          bx = Number(b.dataset.x),
          by = Number(b.dataset.y);
        const affinity = Math.max(
          0.08,
          0.5 - Math.hypot(ax - bx, ay - by) * 0.4,
        );
        return `<line x1="${10 + ax * 80}" y1="${10 + ay * 80}" x2="${10 + bx * 80}" y2="${10 + by * 80}" opacity="${affinity}"/>`;
      }),
    )
    .join("");
}
function pad(bank, title, corners, point, theme) {
  const [x, y] = point || [0.5, 0.5];
  return `<section class="mix-panel mix-bank-${bank} panel-${theme}"><header><span class="eyebrow">${["01 / СРЕДА", "02 / ГАРМОНИЯ", "03 / МЕЛОДИЯ", "04 / ДВИЖЕНИЕ"][bank]}</span><h3>${title}</h3></header><div class="xy-pad" data-sound-pad="${bank}" role="slider" tabindex="0" aria-label="${title}: смешивание четырёх настроений" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(x * 100)}" aria-valuetext="Горизонталь ${Math.round(x * 100)}, вертикаль ${Math.round(y * 100)}" data-x="${x}" data-y="${y}"><div class="pad-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></div>${corners.map((c, i) => `<span class="corner corner-${i}">${c}</span>`).join("")}<span class="pad-orbit orbit-a"></span><span class="pad-orbit orbit-b"></span><span class="mix-cursor" style="transform:translate(${x * 100}%,${y * 100}%)"><i></i></span><span class="pad-hint">Двигайте свет внутри</span></div></section>`;
}
export function soundControls(f, user, audio, voice = 0) {
  const mine =
      f.public.contributors?.[
        (f.public.solo || f.kind === "meditation") && voice
          ? user + ":voice" + voice
          : user
      ] || {},
    role = f.public.solo ? voice : soundRole(f, user),
    r = roles[role];
  return `<div class="instrument instrument-${r[2]}">${f.public.solo && f.kind !== "meditation" ? `<div class="voice-tabs" aria-label="Четыре одиночных пульта">${roles.map((r, i) => `<button data-party="voice" data-index="${i}" aria-pressed="${i === voice}">${r[0]}</button>`).join("")}</div>` : ``}<header class="instrument-title"><span class="instrument-sigil">${["◒", "⌁", "◉", "✧"][role]}</span><div><span class="eyebrow">ВАШ ПУЛЬТ / ${role + 1}</span><h3>${f.kind === "meditation" ? "Общее небо" : r[0]}</h3><p>${f.kind === "meditation" ? "Ваши голоса на одной плоскости" : r[1]}</p></div></header><button class="btn primary wide" data-party="sound">${icon(audio?.started ? "pause" : "play")} ${audio?.started ? "Пауза" : "Включить звук здесь"}</button>${
    f.kind === "soundgarden"
      ? pad(
          0,
          "Живой ландшафт",
          role % 2
            ? ["Листва", "Дождь", "Ночь", "Ветер"]
            : ["Берег", "Роса", "Ветер", "Лес"],
          mine.pads?.[0],
          r[2],
        ) +
        pad(
          1,
          "Гармонический сад",
          role % 2
            ? ["Хрусталь", "Туман", "Космос", "Тепло"]
            : ["Свет", "Земля", "Воздух", "Янтарь"],
          mine.pads?.[1] || [0.45, 0.65],
          r[2],
        ) +
        pad(
          2,
          "Мелодические тропы",
          ["Редкие ноты", "Переливы", "Низкий свет", "Высокие огни"],
          mine.pads?.[2],
          r[2],
        ) +
        pad(
          3,
          "Дыхание сада",
          ["Покой", "Пульсация", "Близко", "Далеко"],
          mine.pads?.[3],
          r[2],
        )
      : meditationPlane(f, user) +
        `<section class="constellation-field"><span class="eyebrow">ЗАЖГИТЕ СОЗВЕЗДИЕ</span><p>Удерживайте: ярче свет, сильнее отклик, дольше послезвучие.</p><div class="constellations">${assignedConstellations(
          f.public.players,
          user,
          f.public.solo,
        )
          .map(
            ({ name: n, hint, index: i }) =>
              `<button data-constellation="${i}" class="constellation constellation-${(i + role) % 4}" aria-label="Удерживать: ${n}">${starDrawing(i)}<span>${n}</span><small>${hint}</small><i></i></button>`,
          )
          .join("")}</div></section>`
  }<div class="sound-volume"><label>Громкость здесь<input type="range" data-sound-volume min="0" max="1" step=".01" value="${audio?.level ?? 0.55}"></label><p>Ваши пульты различаются. Каждый меняет свою часть общего звучания.</p></div></div>`;
}
export function soundWorld(f) {
  const entries = Object.entries(f.public.contributors || {});
  const points = entries.map(([id, c], i) => ({
    id,
    x: 10 + (c.pads?.[0]?.[0] ?? 0.5) * 80,
    y: 18 + (c.pads?.[0]?.[1] ?? 0.5) * 60,
    i,
    c,
  }));
  const colors = ["#a8d9ce", "#d5c39b", "#cbb4e8", "#e7b7c2"];
  const lines = points
    .flatMap((a, i) =>
      points
        .slice(i + 1)
        .map(
          (b) =>
            `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${colors[a.i % 4]}" stroke-width=".18" opacity=".25"/>`,
        ),
    )
    .join("");
  return `<div class="audio-visual world-${f.kind}"><svg class="shared-sound-scene" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${lines}${points.map((p) => `<g class="scene-voice" style="--voice-color:${colors[p.i % 4]};--delay:${p.i * 0.7}s"><circle class="voice-aura" cx="${p.x}" cy="${p.y}" r="${6 + (p.c.pads?.[1]?.[1] ?? 0.5) * 9}" fill="${colors[p.i % 4]}" opacity=".08"/><circle cx="${p.x}" cy="${p.y}" r="1.4" fill="${colors[p.i % 4]}"/><circle cx="${p.x}" cy="${p.y}" r="3" fill="none" stroke="${colors[p.i % 4]}" stroke-width=".15"/></g>`).join("")}</svg><span class="sound-seed">${f.kind === "meditation" ? "СЛУШАТЬ МЕЖДУ ЗВЁЗДАМИ" : "САД, КОТОРЫЙ РАСТЁТ ИЗ ВАС"}</span><div class="scene-constellations">${assignedConstellations(
    [{ id: "all" }],
    "all",
    true,
  )
    .map((star) => {
      const active = entries.some(([, c]) =>
        (c.stars || []).some(
          (s) => s.index === star.index && s.until > Date.now(),
        ),
      );
      const remembered = entries.some(
        ([, c]) => (c.memory?.[star.index] || 0) > 0.01,
      );
      return `<span class="scene-star ${active ? "lit" : remembered ? "remembered" : ""}" style="--star:${star.index}">${starDrawing(star.index)}<small>${star.name}</small></span>`;
    })
    .join(
      "",
    )}</div></div><div class="contribution-strip">${f.public.players.map((u, i) => `<span><i class="contribution-${i % 4}"></i>${esc(u.name)} · ${roles[i % 4][0]}</span>`).join("")}</div>`;
}
export function bindSoundControls(party) {
  for (const stop of party.soundCleanup || []) stop();
  party.soundCleanup = [];
  updateSoundConnections();
  for (const point of document.querySelectorAll(
    "[data-meditation-point]:not([disabled])",
  )) {
    let pointer = null;
    let last = 0;
    const select = () => {
      party.voice = Number(point.dataset.meditationPoint);
      for (const p of document.querySelectorAll("[data-meditation-point]"))
        p.classList.toggle("selected-point", p === point);
    };
    const update = (x, y, send = true) => {
      x = clamp(x);
      y = clamp(y);
      point.dataset.x = x;
      point.dataset.y = y;
      point.style.left = `${10 + x * 80}%`;
      point.style.top = `${10 + y * 80}%`;
      updateSoundConnections();
      if (send)
        party.input({
          action: "sound-pad",
          voice: Number(point.dataset.meditationPoint),
          bank: 0,
          x,
          y,
        });
    };
    const move = (e, force = false) => {
      if (pointer !== e.pointerId) return;
      const rect = point.parentElement.getBoundingClientRect();
      const send = force || performance.now() - last > 70;
      if (send) last = performance.now();
      update(
        ((e.clientX - rect.left) / rect.width - 0.1) / 0.8,
        ((e.clientY - rect.top) / rect.height - 0.1) / 0.8,
        send,
      );
    };
    point.onpointerdown = (e) => {
      select();
      pointer = e.pointerId;
      point.setPointerCapture(pointer);
      point.classList.add("dragging-point");
    };
    point.onpointermove = move;
    point.onpointerup = point.onpointercancel = (e) => {
      move(e, true);
      pointer = null;
      point.classList.remove("dragging-point");
    };
    point.onfocus = select;
    point.onkeydown = (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
        return;
      e.preventDefault();
      select();
      update(
        Number(point.dataset.x) +
          (e.key === "ArrowLeft" ? -0.05 : e.key === "ArrowRight" ? 0.05 : 0),
        Number(point.dataset.y) +
          (e.key === "ArrowUp" ? -0.05 : e.key === "ArrowDown" ? 0.05 : 0),
      );
    };
  }
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
        (e.clientX - r.left - 16) / (r.width - 32),
        (e.clientY - r.top - 16) / (r.height - 32),
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
        power: Math.min(1, 0.55 + hold * 0.32),
        hold,
        until: Date.now() + 2500 + hold * 3000,
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
        power: 0.55,
        hold: 0,
        until: Date.now() + 2500,
      });
      timer = setInterval(() => {
        const hold = Math.min(5, (performance.now() - started) / 1000);
        star.style.setProperty(
          "--charge",
          String(Math.min(1, 0.55 + hold * 0.32)),
        );
        navigator.vibrate?.(Math.round(10 + hold * 3));
        party.input({
          action: "star",
          voice: party.voice || 0,
          index: Number(star.dataset.constellation),
          power: Math.min(1, 0.55 + hold * 0.32),
          hold,
          until: Date.now() + 2500,
        });
      }, 160);
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
