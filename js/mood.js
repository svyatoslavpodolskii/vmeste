import { esc, sheet, icon, toast } from "./ui.js";
export const moodMetrics = [
  ["mood", "Настроение", "☀️"],
  ["energy", "Энергия", "⚡"],
  ["calm", "Спокойствие", "🌊"],
];
export function moodDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export class MoodJournal {
  constructor(getStore) {
    this.getStore = getStore;
    this.limit = 30;
    document.addEventListener("click", (event) => {
      if (event.target.closest('[data-action="mood-journal"]')) this.open();
      if (event.target.closest('[data-action="mood-more"]')) {
        this.limit += 30;
        this.open();
      }
    });
    document.addEventListener("submit", async (event) => {
      if (event.target.id !== "mood-form") return;
      event.preventDefault();
      const form = event.target,
        store = getStore(),
        data = new FormData(form),
        day = data.get("day");
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        await store.save("plans", {
          id: `${store.roomId}:mood:${store.userId}:${day}`,
          title: "Настроение дня",
          items: [],
          moodEntry: {
            day,
            note: String(data.get("note") || "")
              .trim()
              .slice(0, 1500),
            ...Object.fromEntries(
              moodMetrics.map(([key]) => [key, Number(data.get(key))]),
            ),
          },
        });
        this.open();
        toast("День сохранён. Ваш человек увидит его после синхронизации");
      } catch (error) {
        toast(error.message);
        button.disabled = false;
      }
    });
  }
  changed() {
    if (
      document.querySelector("#mood-form") &&
      !document.querySelector("#mood-form:focus-within")
    )
      this.open();
  }
  open() {
    const store = this.getStore();
    if (!store || store.authViewer) return;
    const today = moodDay(),
      entries = store.data.plans
        .filter((p) => p.moodEntry && !p.deletedAt)
        .sort(
          (a, b) =>
            b.moodEntry.day.localeCompare(a.moodEntry.day) ||
            a.authorId.localeCompare(b.authorId),
        );
    const own =
      entries.find(
        (p) => p.moodEntry.day === today && p.authorId === store.userId,
      )?.moodEntry || {};
    sheet(
      `<div class="mood-journal"><span class="eyebrow">КАК ВЫ СЕГОДНЯ?</span><h2>Погода внутри</h2><p>Три маленькие отметки и, если хочется, несколько слов. Общая история помогает замечать друг друга.</p><form id="mood-form"><input type="hidden" name="day" value="${today}">${moodMetrics.map(([key, label, symbol]) => `<fieldset class="mood-metric"><legend>${symbol} ${label}</legend><div>${[1, 2, 3, 4, 5].map((v) => `<label><input type="radio" name="${key}" value="${v}" ${v === (own[key] || 3) ? "checked" : ""}><span>${v}</span></label>`).join("")}</div><small>1 — мало · 5 — много</small></fieldset>`).join("")}<label>Мысль дня · необязательно<textarea name="note" maxlength="1500" placeholder="Что хочется сохранить или рассказать?">${esc(own.note || "")}</textarea></label><button type="submit" class="btn primary wide">${icon("check")} Сохранить сегодня</button></form><h3>Ваши дни</h3><div class="mood-history">${
        entries
          .slice(0, this.limit)
          .map(
            (p) =>
              `<article><small>${esc(p.moodEntry.day.split("-").reverse().join("."))} · ${esc(store.users.find((u) => u.localUserId === p.authorId)?.displayName || "Вы")}</small><p>${moodMetrics.map(([key, label, symbol]) => `<span title="${label}">${symbol} ${p.moodEntry[key]}/5</span>`).join(" · ")}</p>${p.moodEntry.note ? `<p class="mood-note">${esc(p.moodEntry.note)}</p>` : ""}</article>`,
          )
          .join("") || "<p>Первый день можно сохранить прямо сейчас.</p>"
      }</div>${entries.length > this.limit ? '<button class="btn soft wide" data-action="mood-more">Более ранние дни</button>' : ""}<p class="fine">Записи доступны участникам комнаты. Они сохраняются без сети и объединяются, когда устройства на связи.</p></div>`,
    );
  }
}
