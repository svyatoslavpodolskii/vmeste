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
  // Four movable voices stay on the plane; larger groups still each have
  // their own constellation actions and musical memory.
  if (!state.solo)
    for (const player of state.players) {
      if (state.contributors[player.id]) continue;
      const saved = previous.find((c) => c.performer === player.id) || {};
      state.contributors[player.id] = {
        ...saved,
        performer: player.id,
        slot: -1,
        pads: [],
        layers: Array(8).fill(0),
        moods: [0.5, 0.5, 0.5, 0.5],
      };
    }
}
function meditationPlane(f, user) {
  return `<section class="meditation-mixer"><header><span class="eyebrow">ЧЕТЫРЕ ГОЛОСА · ОДНО НЕБО</span><h3>Характер музыки</h3></header><p>${meditationVoices(f.public).some((v) => v.owner === user) ? "Двигайте свои огни: сближение переплетает фразы, положение меняет общую гармонию." : "Огни двигают другие участники. Ваш вклад — созвездия ниже."}</p><div class="plane-labels"><span>Прозрачно</span><span>Тепло</span></div><div class="meditation-plane" aria-label="Общая плоскость четырёх голосов"><div class="pad-grid" aria-hidden="true"><i></i><i></i></div>${meditationVoices(
    { ...f.public, kind: f.kind },
  )
    .filter((v) => v.owner === user)
    .map((v) => {
      const point = f.public.contributors?.[v.id]?.pads?.[0] || [0.5, 0.5];
      return `<button class="meditation-point point-${v.index} ${v.owner === user ? "own-point" : "remote-point"}" data-meditation-point="${v.voice}" data-point-slot="${v.index}" data-owner="${esc(v.owner)}" data-x="${point[0]}" data-y="${point[1]}" style="left:${10 + point[0] * 80}%;top:${10 + point[1] * 80}%" aria-label="${v.name}: ${v.owner === user ? "ваш голос, двигайте стрелками или касанием" : "голос другого участника"}" ${v.owner === user ? "" : "disabled"}><i></i><span>${v.name}</span></button>`;
    })
    .join(
      "",
    )}</div><div class="plane-labels"><span>Текуче</span><span>Глубоко</span></div><div class="plane-legend">${meditationVoices(
    f.public,
  )
    .filter((v) => v.owner === user)
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
const banks = [
  ["Среда", "Темнее ← → светлее · вверх — воздух, вниз — глубина", "#74cbb9"],
  ["Гармония", "Мягче ← → светлее · вверх — близко, вниз — простор", "#bea0e3"],
  [
    "Мелодия",
    "Редкие ноты ← → переливы · вверх — низко, вниз — высоко",
    "#e6be73",
  ],
  [
    "Движение",
    "Покой ← → пульсация · вверх — близко, вниз — далеко",
    "#eb9bb6",
  ],
];
function gardenPlane(mine) {
  return `<section class="garden-mixer"><h3>Четыре краски одного сада</h3><p class="garden-description" aria-live="polite">${banks[0][1]}</p><div class="garden-plane" aria-label="Ваш музыкальный сад">${banks
    .map(([name, hint, color], bank) => {
      const [x, y] =
        mine.pads?.[bank] ||
        [
          [0.25, 0.35],
          [0.7, 0.35],
          [0.35, 0.7],
          [0.75, 0.75],
        ][bank];
      return `<button class="garden-point" data-garden-bank="${bank}" data-x="${x}" data-y="${y}" style="--point-color:${color};left:${10 + x * 80}%;top:${10 + y * 80}%" aria-label="${name}: ${hint}"><i></i><span>${name}</span></button>`;
    })
    .join(
      "",
    )}</div><div class="garden-legend">${banks.map(([name, , color], bank) => `<button data-garden-select="${bank}" style="--point-color:${color}" aria-pressed="${bank === 0}"><i></i>${name}</button>`).join("")}</div><p class="fine">Выберите цвет и двигайте его. Все четыре точки продолжают звучать вместе.</p></section>`;
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
  return `<div class="instrument instrument-${r[2]}">${f.public.solo && f.kind !== "meditation" ? `<div class="voice-tabs" aria-label="Четыре одиночных пульта">${roles.map((r, i) => `<button data-party="voice" data-index="${i}" aria-pressed="${i === voice}">${r[0]}</button>`).join("")}</div>` : ``}<header class="instrument-title"><span class="instrument-sigil">${["◒", "⌁", "◉", "✧"][role]}</span><div><span class="eyebrow">${f.kind === "meditation" ? "ВАШИ СОЗВЕЗДИЯ · " + assignedConstellations(f.public.players, user, f.public.solo, `${f.round}:${f.public.musicShift || 0}`).length : "ВАШ ПУЛЬТ / " + (role + 1)}</span><h3>${f.kind === "meditation" ? "Общее небо" : r[0]}</h3><p>${f.kind === "meditation" ? "У каждого свой отклик в общей музыке" : r[1]}</p></div></header><button class="btn primary wide" data-party="sound">${icon(audio?.started ? "pause" : "play")} ${audio?.started ? "Пауза для всех" : "Включить звук здесь"}</button><button class="btn text wide" data-party="local-mute" aria-pressed="${!!audio?.muted}">${audio?.muted ? "Вернуть звук здесь" : "Выключить звук только здесь"}</button>${
    f.kind === "soundgarden"
      ? gardenPlane(mine)
      : meditationPlane(f, user) +
        `<section class="constellation-field"><button class="btn text" data-party="music-shuffle">Поменяться созвездиями</button><span class="eyebrow">ЗАЖГИТЕ СОЗВЕЗДИЕ</span><p>Удерживайте: ярче свет, сильнее отклик, дольше послезвучие.</p><div class="constellations">${assignedConstellations(
          f.public.players,
          user,
          f.public.solo,
          `${f.round}:${f.public.musicShift || 0}`,
        )
          .sort((a, b) => b.index - a.index)
          .map(
            ({ name: n, hint, index: i }) =>
              `<button data-constellation="${i}" class="constellation constellation-${(i + role) % 4}" aria-label="Удерживать: ${n}">${starDrawing(i)}<span>${n}</span><small>${hint}</small><i></i></button>`,
          )
          .join("")}</div></section>`
  }<div class="sound-volume"><label>Громкость здесь<input type="range" data-sound-volume min="0" max="1" step=".01" value="${audio?.level ?? 0.55}"></label><p>Ваши пульты различаются. Каждый меняет свою часть общего звучания.</p></div></div>`;
}
function scenePoints(f) {
  const voices = Object.entries(f.public.contributors || {}).filter(
    ([, c]) => c.slot !== -1,
  );
  const columns = Math.max(1, Math.min(3, voices.length));
  const rows = Math.max(1, Math.ceil(voices.length / columns));
  return voices.flatMap(([id, c], seat) =>
    (f.kind === "soundgarden" ? [0, 1, 2, 3] : [0]).map((bank) => {
      const [x, y] = c.pads?.[bank] || [0.5, 0.5];
      return {
        id,
        c,
        bank,
        i: f.kind === "soundgarden" ? bank : (c.slot ?? seat),
        x:
          f.kind === "soundgarden"
            ? 5 + (((seat % columns) + 0.12 + x * 0.76) * 90) / columns
            : 10 + x * 80,
        y:
          f.kind === "soundgarden"
            ? 12 + ((Math.floor(seat / columns) + 0.12 + y * 0.76) * 76) / rows
            : 18 + y * 60,
      };
    }),
  );
}
export function soundWorld(f) {
  const entries = Object.entries(f.public.contributors || {});
  const points = scenePoints(f);
  const voices = entries.filter(([, c]) => c.slot !== -1);
  const columns = Math.max(1, Math.min(3, voices.length));
  const rows = Math.max(1, Math.ceil(voices.length / columns));
  const owners =
    f.kind === "soundgarden"
      ? voices
          .map(
            ([id], seat) =>
              `<text class="scene-owner" x="${5 + (((seat % columns) + 0.5) * 90) / columns}" y="${14 + (Math.floor(seat / columns) * 76) / rows}">${esc(f.public.players.find((u) => u.id === id.split(":voice")[0])?.name || "Голос")}</text>`,
          )
          .join("")
      : "";
  const colors = ["#74cbb9", "#bea0e3", "#e6be73", "#eb9bb6"];
  const lines = points
    .flatMap((a, i) =>
      points
        .slice(i + 1)
        .filter((b) => b.id === a.id)
        .map(
          (b) =>
            `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${colors[a.i % 4]}" stroke-width=".18" opacity=".25"/>`,
        ),
    )
    .join("");
  return `<div class="audio-visual world-${f.kind}" data-sound-round="${esc(f.round || "")}"><svg class="shared-sound-scene" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${owners}${lines}${points.map((p) => `<g class="scene-voice" data-scene-point="${esc(p.id)}:${p.i}" style="--voice-color:${colors[p.i % 4]};--delay:${p.i * 0.7}s"><title>${esc(f.public.players.find((u) => u.id === p.id.split(":voice")[0])?.name || "Голос")} · ${banks[p.i % 4][0]}</title><circle class="voice-aura" cx="${p.x}" cy="${p.y}" r="${6 + (p.c.pads?.[1]?.[1] ?? 0.5) * 9}" fill="${colors[p.i % 4]}" opacity=".08"/><circle cx="${p.x}" cy="${p.y}" r="1.4" fill="${colors[p.i % 4]}"/><circle cx="${p.x}" cy="${p.y}" r="3" fill="none" stroke="${colors[p.i % 4]}" stroke-width=".15"/></g>`).join("")}</svg><span class="sound-seed">${f.kind === "meditation" ? "СЛУШАТЬ МЕЖДУ ЗВЁЗДАМИ" : "САД, КОТОРЫЙ РАСТЁТ ИЗ ВАС"}</span><div class="scene-constellations">${assignedConstellations(
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
      return `<span data-scene-star="${star.index}" class="scene-star ${active ? "lit" : remembered ? "remembered" : ""}" style="--star:${star.index}">${starDrawing(star.index)}<small>${star.name}</small></span>`;
    })
    .join(
      "",
    )}</div></div><div class="contribution-strip">${f.kind === "soundgarden" ? banks.map(([name, , color]) => `<span><i style="background:${color}"></i>${name}</span>`).join("") : f.public.players.map((u, i) => `<span><i class="contribution-${i % 4}"></i>${esc(u.name)} · ${roles[i % 4][0]}</span>`).join("")}</div>`;
}
// Patch the living scene in place: rebuilding SVG on every hold packet resets
// animations and competes with sound on slower phones.
export function refreshSoundWorld(root, f) {
  if (!f || f.finished || f.stage !== "running" || f.ownerOffline) return false;
  const scene = root?.querySelector(".audio-visual");
  if (
    !scene ||
    scene.dataset.soundRound !== String(f.round || "") ||
    !scene.classList.contains(`world-${f.kind}`)
  )
    return false;
  const entries = Object.entries(f.public.contributors || {});
  const points = scenePoints(f);
  const nodes = [...scene.querySelectorAll("[data-scene-point]")];
  if (nodes.length !== points.length) return false;
  for (const [i, p] of points.entries()) {
    if (nodes[i].dataset.scenePoint !== `${p.id}:${p.i}`) return false;
    for (const circle of nodes[i].querySelectorAll("circle")) {
      circle.setAttribute("cx", p.x);
      circle.setAttribute("cy", p.y);
    }
  }
  // Lines have the same stable per-owner order as the initial scene.
  let lineIndex = 0;
  const lines = scene.querySelectorAll(".shared-sound-scene > line");
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) {
      if (points[i].id !== points[j].id) continue;
      const line = lines[lineIndex++];
      if (!line) continue;
      for (const [suffix, p] of [
        [1, points[i]],
        [2, points[j]],
      ]) {
        line.setAttribute(`x${suffix}`, p.x);
        line.setAttribute(`y${suffix}`, p.y);
      }
    }
  let memory = 0;
  for (const element of scene.querySelectorAll("[data-scene-star]")) {
    const index = Number(element.dataset.sceneStar);
    const active = entries.some(([, c]) =>
      (c.stars || []).some((s) => s.index === index && s.until > Date.now()),
    );
    const strength = entries.reduce(
      (n, [, c]) => n + (c.memory?.[index] || 0),
      0,
    );
    memory += strength;
    element.classList.toggle("lit", active);
    element.classList.toggle("remembered", strength > 0.01);
  }
  scene.style.setProperty("--garden-memory", `${Math.min(35, memory * 2)}deg`);
  return true;
}
export function bindSoundControls(party) {
  for (const stop of party.soundCleanup || []) stop();
  party.soundCleanup = [];
  updateSoundConnections();
  const garden = document.querySelector(".garden-plane");
  const choose = (bank) => {
    const description = document.querySelector(".garden-description");
    if (description) description.textContent = banks[bank][1];
    if (garden) garden.style.setProperty("--active-color", banks[bank][2]);
    for (const button of document.querySelectorAll("[data-garden-select]"))
      button.setAttribute(
        "aria-pressed",
        String(Number(button.dataset.gardenSelect) === bank),
      );
  };
  for (const button of document.querySelectorAll("[data-garden-select]"))
    button.onclick = () => {
      choose(Number(button.dataset.gardenSelect));
      garden
        ?.querySelector(`[data-garden-bank="${button.dataset.gardenSelect}"]`)
        ?.focus();
    };
  for (const point of document.querySelectorAll("[data-garden-bank]")) {
    let active = false,
      last = 0;
    const bank = Number(point.dataset.gardenBank);
    const update = (x, y, send = true) => {
      x = clamp(x);
      y = clamp(y);
      point.dataset.x = x;
      point.dataset.y = y;
      point.style.left = `${10 + x * 80}%`;
      point.style.top = `${10 + y * 80}%`;
      if (send)
        party.input({
          action: "sound-pad",
          voice: party.voice || 0,
          bank,
          x,
          y,
        });
    };
    const move = (e) => {
      if (!active) return;
      const r = garden.getBoundingClientRect();
      const send = performance.now() - last > 80;
      if (send) last = performance.now();
      update(
        ((e.clientX - r.left) / r.width - 0.1) / 0.8,
        ((e.clientY - r.top) / r.height - 0.1) / 0.8,
        send,
      );
    };
    point.onpointerdown = (e) => {
      active = true;
      choose(bank);
      point.classList.add("dragging-point");
      point.setPointerCapture(e.pointerId);
      move(e);
    };
    point.onpointermove = move;
    point.onpointerup = point.onpointercancel = () => {
      if (active) update(Number(point.dataset.x), Number(point.dataset.y));
      active = false;
      point.classList.remove("dragging-point");
    };
    point.onkeydown = (e) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
        return;
      e.preventDefault();
      choose(bank);
      update(
        Number(point.dataset.x) +
          (e.key === "ArrowLeft" ? -0.04 : e.key === "ArrowRight" ? 0.04 : 0),
        Number(point.dataset.y) +
          (e.key === "ArrowUp" ? -0.04 : e.key === "ArrowDown" ? 0.04 : 0),
      );
    };
  }
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
      gesture,
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
        gesture,
        holding: false,
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
      gesture = crypto.randomUUID();
      star.classList.add("holding");
      star.classList.remove("afterglow");
      party.input({
        action: "star",
        gesture,
        holding: true,
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
          gesture,
          holding: true,
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
