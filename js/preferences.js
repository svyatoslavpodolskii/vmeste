import { esc, icon, btn } from "./ui.js";
import { savedRooms, roomSymbols } from "./rooms.js";
export function appTile(label, action, symbol, color = "rose", extra = "") {
  return `<button class="utility-app" data-action="${action}" ${extra}><span class="utility-icon utility-${color}">${icon(symbol)}</span><strong>${label}</strong></button>`;
}
export function roomMenu(identity, current) {
  return `<div class="room-switcher"><span class="eyebrow">ВАШИ МАЛЕНЬКИЕ МИРЫ</span><h2>Комнаты</h2><div class="rooms-list">${savedRooms(
    identity,
  )
    .map(
      (r) =>
        `<button class="room-choice ${r.id === current ? "current-room" : ""}" data-action="switch-room" data-id="${esc(r.id)}"><span>${roomSymbols(r.id)}</span><strong>${esc(r.name || "Наша комната")}</strong><small>${r.id === current ? "Сейчас здесь" : r.viewer ? "Общий экран" : r.capacity === 10 ? "Компания" : "Для двоих"}</small>${r.id === current ? icon("check") : ""}</button>`,
    )
    .join(
      "",
    )}</div><div class="utility-grid">${appTile("Новая комната", "new-room", "plus", "mint")}${appTile("По приглашению", "join", "link", "blue")}${appTile("Настройки", "settings", "settings", "lavender")}</div></div>`;
}
export function settingsHome() {
  return `<span class="eyebrow">ВСЁ НУЖНОЕ РЯДОМ</span><h2>Настройки</h2><div class="utility-grid">${appTile("Резервная копия", "settings-files", "folder", "blue")}${appTile("История и выставки", "game-records", "gallery", "lavender")}${appTile("Общий экран", "screen-mode", "screen", "mint")}${appTile("Связь и приватность", "connection", "shield", "rose")}${appTile("Обновление", "update-app", "refresh", "mint")}${appTile("На главный экран", "install", "home", "yellow")}</div><section class="settings-group"><h3>Эта комната</h3><button class="settings-row" data-action="leave">${icon("back")}Выйти из комнаты${icon("arrow")}</button><details class="advanced-settings"><summary>Хранилище на этом устройстве</summary><p>Удаление копии не затронет устройство вашего человека.</p>${btn("Очистить локальную копию", "clear", "text danger")}</details></section>`;
}
export function backupSettings() {
  return `<span class="eyebrow">СОХРАНИТЬ ВАШЕ</span><h2>Резервная копия</h2><p>Сохраните идеи, реакции и планы одним файлом. Файл можно перенести на другое устройство.</p><div class="backup-actions">${btn(icon("download") + " Скачать копию", "export", "primary wide")}<label class="btn lavender wide file-label">${icon("folder")} Восстановить из файла<input type="file" id="import-file" accept="application/json,.json"></label></div><p class="fine">Копия относится к этой комнате. Восстановление объединяет записи, сохраняя более новые изменения.</p>${btn(icon("back") + " Настройки", "settings", "text wide")}`;
}
