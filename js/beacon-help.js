import { esc, icon } from "./ui.js";
import { colors, marks, materialNames, dirs } from "./beacon.js";
const courses = ["Север", "Восток", "Юг", "Запад"];
const fields = {
  wind: ["Откуда ветер?", dirs],
  tide: ["Какая метка прилива?", ["0", "1", "2", "3"]],
  serial: ["Какая маркировка?", null],
  hot: ["Контур горячий?", ["Холодный", "Горячий"]],
  salt: ["Какая вода?", ["Пресная", "Солёная"]],
  pressure: ["Какое давление?", ["1", "2", "3", "4"]],
};
export const guideFields = {
  prism: ["wind", "hot", "serial", "tide"],
  power: ["wind", "hot", "serial", "reserveLow"],
  coolant: ["salt", "hot", "pressure"],
  signal: ["wind", "serial"],
  pendulum: ["salt", "wind", "tide", "serial"],
  navigation: ["hot", "salt", "tide"],
};
fields.reserveLow = ["Как горит резерв?", ["Ровно", "Мигает"]];
export function resolveBeaconGuide(module, manual, o) {
  if ((guideFields[module] || []).some((key) => !Number.isFinite(o[key])))
    return null;
  if (module === "prism") {
    const ring =
      o.wind === 3 || o.hot ? [...manual.base].reverse() : [...manual.base];
    const anchor =
      (Math.floor(o.serial / 10) + (o.serial % 10) + manual.lens) % 4;
    const start = ring.indexOf(anchor);
    return {
      order: ring.slice(start).concat(ring.slice(0, start)),
      angle: (o.tide + (o.serial % 2 ? 1 : 3) + (o.hot ? 1 : 0)) % 4,
    };
  }
  if (module === "power")
    return {
      minLight: manual.baseLight + (o.wind === 0 ? 2 : 0),
      maxHeat: manual.baseHeat - (o.hot ? 3 : 0),
      reserve: o.reserveLow
        ? "Не ниже уровня 2"
        : o.serial % 2 === 0 && o.hot
          ? "Выключен · уровень 0"
          : "Любой уровень",
    };
  if (module === "coolant")
    return {
      material: manual.materialRules[o.salt ? 1 : o.hot ? 2 : 0],
      forbidden: o.pressure >= 3 ? "вверх" : "влево",
    };
  if (module === "signal")
    return {
      reversed: o.wind === 3,
      dictionary: manual.dictionary.map((bits) =>
        bits.map((v) => (o.serial % 2 ? 1 - v : v)),
      ),
    };
  if (module === "pendulum")
    return {
      ratio: manual.ratioTable[o.salt],
      direction: manual.reverseWinds.includes(o.wind),
      phase: (manual.phaseChart[o.tide] + (o.serial % 2 ? 1 : 0)) % 4,
    };
  return {
    water: manual.waterRules[o.hot ? 2 : o.salt ? 1 : 0],
    cargo: manual.cargoRules[o.tide % 2],
    courses: courses.map(
      (_, bearing) => (bearing + o.tide + manual.courseOffset) % 4,
    ),
  };
}
function resolvedView(module, r) {
  if (!r)
    return "<p>Сначала спросите инженера о показаниях выше. Они остаются на его экране.</p>";
  if (module === "prism")
    return `<h3>Передайте порядок линз</h3><div class="guide-sequence">${r.order.map((n, i) => `<span><small>${i + 1}</small><b>${marks[n]}</b>${colors[n]}</span>`).join("")}</div><p>Угол луча: <strong>${courses[r.angle]}</strong>. Инженер меняет линзы местами соседними нажатиями.</p>`;
  if (module === "power")
    return `<h3>Ваши условия</h3><p>Свет: <strong>не меньше ${r.minLight}</strong>.<br>Нагрев: <strong>не больше ${r.maxHeat}</strong>.<br>Резерв: <strong>${r.reserve}</strong>.</p><p>Инженер видит, сколько дают банки. Найдите сочетание по его шкалам.</p>`;
  if (module === "coolant")
    return `<h3>Проведите воду</h3><p>Подходит материал: <strong>${materialNames[r.material]}</strong>.<br>Нельзя двигаться <strong>${r.forbidden}</strong>.</p><p>От входа через снежинку-охладитель к домику-выходу. Стальные узлы всегда подходят.</p>`;
  if (module === "signal")
    return `<h3>Готовый словарь импульсов</h3><div class="guide-sequence">${r.dictionary.map((bits, i) => `<span><b>${marks[i]}</b><strong>${bits.map((v) => (v ? "—" : "·")).join(" ")}</strong></span>`).join("")}</div><p>Попросите назвать знаки <strong>${r.reversed ? "справа налево" : "слева направо"}</strong>. Для каждого передайте пару из словаря. Больше ничего менять не нужно.</p>`;
  if (module === "pendulum")
    return `<h3>Соберите движение</h3><p>Передачи: <strong>${r.ratio} : 1</strong>.<br>Движение: <strong>${r.direction ? "против часовой" : "по часовой"}</strong>.<br>Ловим луч на <strong>${courses[r.phase]}</strong>.</p><p>Подтвердите инструкцию, затем инженер нажмёт запуск в нужном направлении.</p>`;
  return `<h3>Нужен такой путь</h3><p><strong>${esc(r.water)}</strong> · груз <strong>${esc(r.cargo)}</strong>. Из подходящих выберите самый экономный.</p><div class="guide-sequence">${r.courses.map((target, i) => `<span>${courses[i]}<b>↓</b>${courses[target]}</span>`).join("")}</div><p>Сверху — ориентир выбранного пути, снизу — нужный входной курс.</p>`;
}
export function beaconAssistant(f) {
  const module = f.public.module.id;
  return `<section class="beacon-assistant" data-beacon-assistant data-key="${esc(f.round + ":" + f.public.turn)}"><span class="eyebrow">1 · СПРОСИТЕ ИНЖЕНЕРА</span><p>Он называет показания, вы отмечаете их здесь. Книга сама развернёт правила в понятные шаги.</p><div class="form-grid">${guideFields[
    module
  ]
    .map((key) => {
      const [label, choices] = fields[key];
      return `<label>${label}${choices ? `<select data-guide-field="${key}"><option value="">Выберите показание</option>${choices.map((v, i) => `<option value="${key === "pressure" ? i + 1 : i}">${esc(v)}</option>`).join("")}</select>` : `<input data-guide-field="${key}" type="number" inputmode="numeric" min="10" max="99" placeholder="Две цифры">`}</label>`;
    })
    .join(
      "",
    )}</div><span class="eyebrow">2 · ОБЪЯСНИТЕ НАСТРОЙКУ</span><div class="guide-resolution" aria-live="polite"></div><p class="fine">Если показание изменилось — поправьте его здесь. Настройка не отправляется инженеру автоматически: расскажите её друг другу.</p></section>`;
}
export function bindBeaconAssistant(f, secret) {
  const box = document.querySelector("[data-beacon-assistant]");
  if (!box || !secret.manual) return;
  const key = "vmeste:guide:" + box.dataset.key;
  let draft = {};
  try {
    draft = JSON.parse(sessionStorage.getItem(key)) || {};
  } catch {}
  const inputs = [...box.querySelectorAll("[data-guide-field]")];
  for (const input of inputs)
    if (draft[input.dataset.guideField] != null)
      input.value = draft[input.dataset.guideField];
  const update = () => {
    draft = Object.fromEntries(
      inputs.map((input) => [input.dataset.guideField, input.value]),
    );
    const values = Object.fromEntries(
      inputs.map((input) => [
        input.dataset.guideField,
        input.value !== "" && input.checkValidity() ? Number(input.value) : NaN,
      ]),
    );
    box.querySelector(".guide-resolution").innerHTML = resolvedView(
      f.public.module.id,
      resolveBeaconGuide(f.public.module.id, secret.manual, values),
    );
    try {
      sessionStorage.setItem(key, JSON.stringify(draft));
    } catch {}
  };
  for (const input of inputs) input.oninput = input.onchange = update;
  update();
}
