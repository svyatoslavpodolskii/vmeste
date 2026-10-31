import { esc, icon } from "./ui.js";
import {
  BEACON_RULES,
  beaconModules,
  colors,
  marks,
  materialNames,
  dirs,
} from "./beacon.js";
const paint = ["#e4bb76", "#9cc7ab", "#b1a1d1", "#99bbd1"];
const course = ["Север", "Восток", "Юг", "Запад"];
const lens = (n) =>
  `<span class="beacon-lens" style="--lens:${paint[n]}"><b>${marks[n]}</b><small>${colors[n]}</small></span>`;
const pulse = (n) => (n ? "—" : "·");
const cellName = (n) => "АБВГД"[n % 5] + (Math.floor(n / 5) + 1);
const button = (text, action, index, value, extra = "") =>
  `<button class="btn soft" data-party="beacon-action" data-beacon-action="${action}" data-index="${index}" data-value="${value}" ${extra}>${text}</button>`;
const progress = (p) => `${Math.min(p.turn + 1, p.total)} / ${p.total}`;

export function harborScene(h = { lights: [], ships: [], lens: 0 }) {
  const light = paint[h.lens || 0];
  return `<div class="harbor-scene" aria-label="Гавань: проведено судов ${h.ships?.length || 0}, восстановлено узлов ${h.lights?.length || 0}"><svg viewBox="0 0 800 430" role="img" aria-label="Свет маяка проводит суда к берегу"><path d="M0 0H800V430H0Z" fill="#172b3a"/><circle cx="660" cy="75" r="25" fill="#d6d5ba"/><path d="M665 50a25 25 0 0 0 0 50 28 28 0 0 1 0-50" fill="#172b3a"/>${Array.from({ length: 16 }, (_, i) => `<circle cx="${35 + ((i * 67) % 735)}" cy="${25 + ((i * 37) % 170)}" r="${i % 3 === 0 ? 1.8 : 1}" fill="#e1d8ba" opacity="${0.2 + (i % 4) * 0.15}"/>`).join("")}<g class="harbor-beam" style="--beam:${light};opacity:${0.15 + (h.lights?.length || 0) * 0.055}"><path d="M399 151 15 40 15 265Z M399 151 785 50 785 275Z" fill="${light}"/></g><path d="M0 285Q170 265 300 285T800 280V430H0Z" fill="#254653"/><g class="harbor-waves" fill="none" stroke="#83aaad" opacity=".22" stroke-width="2"><path d="M-40 318q80-17 160 0t160 0t160 0t160 0t220 0M-70 350q80-15 160 0t160 0t160 0t160 0t220 0M-20 390q80-15 160 0t160 0t160 0t160 0t220 0"/></g><path d="M290 354Q345 320 430 337L480 390H270Z" fill="#1a3037"/><path d="M349 330 367 170H430L449 330Z" fill="#c8bca2"/><path d="M361 218H437L440 243H358ZM354 286H445L448 310H351Z" fill="#c18370"/><path d="M359 165V132H438V165Z" fill="#33434b"/><path d="M366 140H431V157H366Z" fill="${light}" opacity="${0.5 + (h.lights?.length || 0) * 0.05}"/><path d="M352 132 398 98 445 132Z" fill="#9b776e"/><path d="M390 330V298q9-16 18 0v32Z" fill="#253b44"/><path d="M358 170H440" stroke="#e0c7a1" stroke-width="6"/><path d="M396 97V80" stroke="#d6c2a4" stroke-width="3"/>${(h.ships || []).map((ship, i) => `<g class="harbor-ship" style="--ship:${i}" transform="translate(${65 + i * 105} ${338 + (i % 2) * 30})"><path d="M0 10H64L52 29H12Z" fill="${paint[i % 4]}"/><path d="M20 8V-9H42V8M10 5H54" stroke="#d3d5bf" stroke-width="3" fill="none"/><circle cx="29" cy="0" r="2" fill="#ffe5b4"/><title>${esc(ship.name)}</title></g>`).join("")}<path d="M480 388H800" stroke="#50716d" stroke-width="8"/>${Array.from({ length: 9 }, (_, i) => `<circle cx="${500 + i * 31}" cy="381" r="5" fill="${i < (h.lights?.length || 0) ? light : "#3d5358"}"/>`).join("")}</svg><span class="harbor-caption">${h.ships?.length ? `Дома уже ${h.ships.length} ${h.ships.length === 1 ? "судно" : "судна"}` : "Здесь ждут вашего света"}</span></div>`;
}
function harborStats(h) {
  return `<div class="harbor-stats"><span>${icon("sun")} Тепло корпуса <b>${h.heat}</b></span><span>${icon("star")} Запас энергии <b>${h.fuel}</b></span></div>`;
}
export function beaconScreen(f, screen = false) {
  const p = f.public;
  return `<section class="beacon-shared ${screen ? "on-monitor" : p.phase === "repair" ? "beacon-compact" : ""}"><span class="eyebrow">ЗАЖЕЧЬ МАЯК · ОБЩАЯ ВАХТА</span>${harborScene(p.harbor)}${harborStats(p.harbor)}<div class="beacon-stage-title"><small>${f.finished ? "ВАХТА ЗАВЕРШЕНА" : p.phase === "voyage" ? "КАК ВЕДЁМ ДОМОЙ" : `УЗЕЛ ${progress(p)}`}</small><h2>${f.finished ? "Гавань живёт" : p.phase === "voyage" ? "Выберите общий путь" : esc(p.module.title)}</h2><p>${f.finished ? `Вы восстановили ${p.total} узлов и провели домой ${p.harbor.ships.length} судна.` : p.phase === "voyage" ? "Решение изменит запас энергии, тепло и течение следующей части вахты." : esc(p.module.task)}</p></div>${p.phase === "result" ? `<div class="beacon-result"><strong>+${p.result.score} общего света</strong><p>${esc(p.result.detail)}</p></div>` : ""}${p.feedback ? `<p class="beacon-feedback" role="status">${esc(p.feedback)}</p>` : ""}${!f.finished && p.phase !== "voyage" ? `<div class="beacon-crew">${p.players.map((u) => `<span>${esc(u.name)} <b>${u.id === p.engineer ? "у механизма" : "с книгой маяка"}</b></span>`).join("")}</div>` : ""}</section>`;
}
function observations(o, module) {
  const fields = {
    wind: ["Ветер у фонаря", dirs[o.wind]],
    tide: ["Метка прилива", o.tide],
    serial: ["Маркировка", o.serial],
    hot: ["Контур", o.hot ? "Горячий" : "Холодный"],
    salt: ["Вода", o.salt ? "Солёная" : "Пресная"],
    pressure: ["Давление", o.pressure],
    reserveLow: ["Резерв", o.reserveLow ? "Мигает · дефицит" : "Горит ровно"],
  };
  const needed = {
    prism: ["wind", "tide", "serial", "hot"],
    power: ["wind", "serial", "hot", "reserveLow"],
    coolant: ["salt", "pressure", "hot"],
    signal: ["wind", "serial"],
    pendulum: ["wind", "tide", "serial", "salt"],
    navigation: ["tide", "hot", "salt"],
  }[module];
  return `<section class="beacon-observations"><h3>Ваши показания</h3><div>${needed.map((key) => `<span><small>${fields[key][0]}</small><strong>${esc(fields[key][1])}</strong></span>`).join("")}</div><p>У навигатора другая половина задачи. Расскажите, что видите.</p></section>`;
}
function manualBody(module, m) {
  if (module === "prism")
    return `<h3>Кольцо линз</h3><div class="manual-lenses">${m.base.map(lens).join("")}</div><ol><li>Если ветер <b>западный</b> или контур <b>горячий</b>, читайте кольцо в обратную сторону. Если сработали оба условия — всё равно один раз.</li><li>Сложите обе цифры маркировки и номер прежнего света: ${colors[m.lens]} (${m.lens}). Остаток от деления на четыре задаёт первую линзу: ${colors.map((c, i) => `${i} — ${c}`).join("; ")}. Остальные идут по кольцу.</li><li>Начальный угол — метка прилива: 0 север, 1 восток, 2 юг, 3 запад. Нечётная маркировка: ещё 1 поворот по часовой; чётная: 3 поворота. Горячий контур добавляет ещё один.</li></ol>`;
  if (module === "power")
    return `<h3>Допуски генератора</h3><div class="manual-limits"><span>Света не менее <b>${m.baseLight}</b></span><span>Нагрева не более <b>${m.baseHeat}</b></span></div><ol><li>При <b>северном ветре</b> добавьте 2 к необходимому свету.</li><li>Если контур <b>горячий</b>, уменьшите допустимый нагрев на 3.</li><li>Если резерв <b>мигает</b>, третий банк должен стоять минимум на 2. Иначе при <b>чётной маркировке и горячем контуре</b> третий банк выключен. В других случаях он свободен.</li></ol><p>Коэффициенты банков видит только инженер. Обсуждайте сочетания; более экономная настройка оставляет больше энергии гавани.</p>`;
  if (module === "coolant")
    return `<h3>Какие каналы пропускают воду</h3><div class="manual-table"><span>Солёная вода <b>${materialNames[m.materialRules[1]]}</b></span><span>Пресная + горячий контур <b>${materialNames[m.materialRules[2]]}</b></span><span>Пресная + холодный контур <b>${materialNames[m.materialRules[0]]}</b></span></div><ol><li>Весь путь должен идти по подходящему материалу. Стальные вход, выход и охладитель принимают воду всегда.</li><li>При давлении <b>3 или 4</b> нельзя идти вверх. При <b>1 или 2</b> нельзя идти влево.</li><li>Обязательно пройдите через охладитель. Подходящие клетки и местоположение узлов видит инженер.</li></ol>`;
  if (module === "signal")
    return `<h3>Словарь этого рейса</h3><div class="manual-signal">${m.dictionary.map((bits, i) => `<span><b>${marks[i]}</b><strong>${bits.map(pulse).join(" ")}</strong></span>`).join("")}</div><ol><li>Попросите инженера назвать три наблюдаемых знака. При <b>западном ветре</b> читайте сами знаки справа налево.</li><li>Каждый знак превращается в пару импульсов. Соедините три пары в одну последовательность.</li><li>Если маркировка <b>нечётная</b>, поменяйте короткие и длинные импульсы местами во всей последовательности.</li></ol><p>· — короткий импульс; — — длинный. Сам словарь меняется от рейса к рейсу.</p>`;
  if (module === "pendulum")
    return `<h3>Передачи и фаза</h3><div class="manual-table"><span>Пресная вода <b>${m.ratioTable[0]} : 1</b></span><span>Солёная вода <b>${m.ratioTable[1]} : 1</b></span></div><ol><li>Первая передача, делённая на вторую, должна дать указанное отношение. Для 2 : 1 подойдут 2 и 1 или 4 и 2.</li><li>При ветре ${m.reverseWinds.map((v) => `«${dirs[v]}»`).join(" или ")} включите ход против часовой. В остальных случаях — по часовой.</li><li>Метка прилива задаёт нужную фазу по таблице ниже. Если маркировка нечётная, сдвиньте её ещё на четверть по часовой. Инженер останавливает луч в этом направлении.</li></ol><div class="manual-table">${m.phaseChart.map((phase, i) => `<span>Прилив ${i}<b>${course[phase]}</b></span>`).join("")}</div>`;
  return `<h3>Какой рейс принимает гавань</h3><div class="manual-table"><span>Горячий контур <b>${m.waterRules[2]} путь</b></span><span>Холодный + солёная вода <b>${m.waterRules[1]} путь</b></span><span>Холодный + пресная вода <b>${m.waterRules[0]} путь</b></span></div><ol><li>При чётной метке прилива нужен груз «${m.cargoRules[0]}», при нечётной — «${m.cargoRules[1]}».</li><li>Из подходящих по обоим условиям путей выбирайте самый экономный. При одинаковом расходе подойдёт любой.</li><li>Возьмите направление, написанное у выбранного пути. Поверните его по часовой на число четвертей, равное <b>метке прилива + ${m.courseOffset}</b>.</li></ol><p>Карту, стоимость и направления видит инженер. Не забудьте сверить и маршрут, и входной курс.</p>`;
}
function coolantGrid(m) {
  const route = m.path
    .map((cell) => `${10 + (cell % 5) * 20},${10 + Math.floor(cell / 5) * 20}`)
    .join(" ");
  return `<div class="coolant-grid-wrap"><svg class="coolant-route" viewBox="0 0 100 100" aria-hidden="true"><polyline points="${route}"/></svg><div class="coolant-grid">${m.materials.map((mat, i) => `<button class="material-${mat} ${m.path.includes(i) ? "on-route" : ""}" data-party="beacon-action" data-beacon-action="beacon-set" data-index="${i}" aria-label="${cellName(i)}: ${materialNames[mat]}"><small>${cellName(i)}</small><b>${i === 0 ? "↓" : i === m.exit ? "⌂" : i === m.cooler ? "❄" : ["△", "◇", "□", "○"][mat]}</b></button>`).join("")}</div></div><p class="beacon-fine">Нажимайте соседние клетки. Нажатие на уже пройденную клетку возвращает путь к ней.</p><div class="material-legend">${materialNames
    .slice(0, 3)
    .map(
      (name, i) =>
        `<span class="material-${i}">${["△", "◇", "□"][i]} ${name}</span>`,
    )
    .join("")}</div>`;
}
function machineBody(module, m) {
  if (module === "prism")
    return `<h3>Соберите кольцо</h3><div class="prism-controls">${m.order.map((color, i) => button(`${lens(color)}<small>Поменять с соседней</small>`, "beacon-set", i, 0)).join("")}</div>${button(`Угол луча: ${course[m.angle]} ${icon("refresh")}`, "beacon-set", 4, 0, 'style="width:100%"')}<p class="beacon-fine">Каждое нажатие меняет местами линзу и следующую. Последняя соединена с первой.</p>`;
  if (module === "power") {
    const light = m.levels.reduce(
        (n, v, i) => n + v * m.coefficients[i].light,
        0,
      ),
      heat = m.levels.reduce((n, v, i) => n + v * m.coefficients[i].heat, 0);
    return `<div class="machine-output"><span>Свет <b>${light}</b></span><span>Нагрев <b>${heat}</b></span></div><div class="power-banks">${m.coefficients.map((c, i) => `<section><h3>${["Основной", "Тихий", "Резервный"][i]} банк</h3><small>Уровень даёт ${c.light} света и ${c.heat} нагрева</small><div class="bank-level">${button("−", "beacon-set", i, -1)}<strong>${m.levels[i]}</strong>${button("+", "beacon-set", i, 1)}</div></section>`).join("")}</div>`;
  }
  if (module === "coolant") return coolantGrid(m);
  if (module === "signal")
    return `<h3>Наблюдаемые знаки</h3><div class="observed-signal">${m.observed.map((n) => `<b>${marks[n]}</b>`).join("")}</div><h3>Ваша последовательность</h3><div class="signal-controls">${m.signal.map((v, i) => button(`<small>${i + 1}</small><b>${pulse(v)}</b>`, "beacon-set", i, 0)).join("")}</div><p class="beacon-fine">Нажатие меняет короткий импульс на длинный и обратно.</p>`;
  if (module === "pendulum")
    return `<div class="beacon-clock" aria-label="Фаза маятника"><span class="clock-north">С</span><span class="clock-east">В</span><span class="clock-south">Ю</span><span class="clock-west">З</span><div class="beacon-needle" style="animation-duration:${m.period}ms;animation-delay:${m.clockStart - Date.now()}ms;animation-direction:${m.direction ? "reverse" : "normal"}"><i></i></div><b></b></div><div class="gear-controls">${button(`Первая передача <strong>${m.gears[0]}</strong>`, "beacon-set", 0, 0)}${button(`Вторая передача <strong>${m.gears[1]}</strong>`, "beacon-set", 1, 0)}${button(m.direction ? "Против часовой" : "По часовой", "beacon-set", 2, 0)}</div><p class="beacon-fine">Когда навигатор подтвердит условия, поймайте нужную фазу кнопкой запуска.</p>`;
  return `<div class="navigation-routes">${m.routes.map((r, i) => button(`<strong>${r.name}</strong><span>${r.water} · ${r.lit ? "есть огни" : "без огней"}</span><span>${r.cargo} · расход ${r.cost}</span><small>Носовой ориентир: ${course[r.bearing]}</small>`, "beacon-set", i, 0, `aria-pressed="${m.route === i}"`)).join("")}</div>${button(`Входной курс: ${course[m.bearing]} ${icon("refresh")}`, "beacon-set", 4, 0)}`;
}
export function beaconControls(f, user, secret = {}) {
  const p = f.public,
    ready = p.moduleReady?.includes(user),
    engineer = p.engineer === user;
  if (f.finished)
    return `<button class="btn primary wide" data-party="beacon-home">В гавань · ваши вахты</button>`;
  if (p.phase === "briefing")
    return `<div class="beacon-role-card"><span>${icon(engineer ? "settings" : "book")}</span><h3>${engineer ? "Вы у механизма" : "Вы с книгой маяка"}</h3><p>${engineer ? "У вас показания и оборудование. Попросите навигатора сверить правила, описывайте то, что видите, и настраивайте пульт." : "У вас условная инструкция. Спрашивайте инженера о показаниях, выбирайте подходящие условия и объясняйте настройку вслух."}</p><p>Ваши экраны дополняют друг друга. Роли сменятся после ремонта узла.</p></div><button class="btn primary wide" data-party="beacon-action" data-beacon-action="beacon-ready" ${ready ? "disabled" : ""}>${ready ? "Ждём команду" : "Начать настройку"}</button><p class="center fine">${p.moduleReady.length} / ${p.players.length} готовы</p>`;
  if (p.phase === "result")
    return `<p class="center">Этот узел работает. Можно обсудить, как вы его собрали, и двигаться дальше без спешки.</p><button class="btn primary wide" data-party="beacon-action" data-beacon-action="beacon-ready" ${ready ? "disabled" : ""}>${ready ? "Ждём остальных" : "Дальше вместе"}</button>`;
  if (p.phase === "voyage")
    return `<div class="voyage-choices">${[
      [
        "Тихая протока",
        "Остудит корпус и немного повернёт течение. Потребуется часть энергии.",
      ],
      [
        "Внешний фарватер",
        "Вернёт энергию, но нагреет корпус и сильнее изменит течение.",
      ],
    ]
      .map(([name, text], i) =>
        button(
          `<strong>${name}</strong><p>${text}</p>`,
          "beacon-voyage",
          0,
          i,
          `aria-pressed="${secret.vote === i}"`,
        ),
      )
      .join(
        "",
      )}</div><p class="fine center">${p.voted.length} / ${p.players.length} выбрали. Решение принимается, когда вы выберете один путь вместе.</p>`;
  if (!secret.role)
    return '<p class="center">Получаем вашу половину задачи…</p>';
  if (!engineer)
    return `<section class="beacon-guide"><span class="eyebrow">КНИГА МАЯКА · УСЛОВИЯ ЭТОЙ НАСТРОЙКИ</span>${manualBody(p.module.id, secret.manual)}<p class="manual-reminder">Не угадывайте показания. Спросите инженера и сверьте все условия.</p></section><button class="btn ${p.approved.includes(user) ? "soft" : "primary"} wide" data-party="beacon-action" data-beacon-action="beacon-guide-ready">${p.approved.includes(user) ? "Инструкция сверена · отменить" : "Инструкция сверена"}</button><p class="fine center">После изменения пульта подтверждение нужно дать снова.</p>`;
  return `<section class="beacon-machine">${observations(secret.observations, p.module.id)}<div class="machine-panel">${machineBody(p.module.id, secret.machine)}</div><div class="machine-launch"><p>${p.approved.length} / ${p.guides.length} навигаторов сверили настройку</p><button class="btn primary wide" data-party="beacon-action" data-beacon-action="beacon-launch" ${p.approved.length < p.guides.length ? "disabled" : ""}>${p.module.id === "pendulum" ? "Поймать фазу и запустить" : "Запустить узел"}</button></div></section>`;
}
export function beaconHome(store, active) {
  const records = store.data.plans
    .filter(
      (r) =>
        !r.deletedAt &&
        r.arcadeRecord?.kind === "beacon" &&
        r.arcadeRecord.rulesVersion === BEACON_RULES,
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  return `<section class="beacon-menu"><span class="eyebrow">МЕХАНИЗМ + УСЛОВНАЯ ИНСТРУКЦИЯ</span><h2>Зажечь маяк</h2>${harborScene()}<p>Ваша гавань осталась без света. Один видит оборудование, другой держит книгу с правилами. Соберите линзы, проведите охлаждение, настройте энергию и проводите суда домой. Каждый узел меняет следующую задачу.</p>${
    active && !active.finished
      ? '<button class="btn primary wide" data-party="beacon-resume">Вернуться на вахту</button>'
      : `<div class="beacon-lengths">${[
          [3, "Короткая смена"],
          [6, "Ночная вахта"],
          [9, "Длинная ночь"],
        ]
          .map(
            ([n, title]) =>
              `<button class="btn soft" data-party="beacon-start" data-length="${n}"><strong>${title}</strong><small>${n} узлов · без таймера</small></button>`,
          )
          .join("")}</div>`
  }<h3>Ваши сохранённые гавани</h3><div class="beacon-records">${records.map((r) => `<button class="beacon-record-card" data-party="beacon-record" data-id="${esc(r.id)}"><strong>${r.arcadeRecord.harbor.ships.length} судна дома</strong><p>${r.arcadeRecord.players.map((id) => esc(store.users.find((u) => u.localUserId === id)?.displayName || "Участник")).join(" + ")}</p><small>${r.arcadeRecord.beaconLength} узлов · ${new Date(r.createdAt).toLocaleDateString("ru-RU")}</small><span>Открыть историю ${icon("arrow")}</span></button>`).join("") || '<p class="muted">Законченная вахта сохранится здесь — со своими судами, решениями и общим результатом.</p>'}</div></section>`;
}
export function beaconRecordView(record, store) {
  const r = record.arcadeRecord;
  return `<section class="beacon-menu"><span class="eyebrow">СОХРАНЁННАЯ ГАВАНЬ</span><h2>Под вашим светом</h2>${harborScene(r.harbor)}<p>${r.players.map((id) => esc(store.users.find((u) => u.localUserId === id)?.displayName || "Участник")).join(" + ")} · ${(r.teamScore / r.beaconLength).toLocaleString("ru-RU", { maximumFractionDigits: 1 })}% общего света</p><div class="beacon-arrivals">${r.harbor.ships.map((ship) => `<article><span>${icon("home")}</span><div><strong>«${esc(ship.name)}» дома</strong><p>Прошло ${esc(ship.route)}.</p></div></article>`).join("")}</div><h3>Как вы вернули свет</h3><div class="beacon-journal">${r.journal.map((item) => `<article><small>${esc(store.users.find((u) => u.localUserId === item.engineer)?.displayName || "Инженер")} у механизма · +${item.score}</small><h3>${esc(beaconModules.find((m) => m.id === item.module)?.title || item.module)}</h3><p>${esc(item.detail)}</p></article>`).join("")}</div><button class="btn text wide" data-party="delete-record" data-id="${esc(record.id)}">${icon("trash")} Удалить эту вахту</button></section>`;
}
