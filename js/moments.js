import { ownLiked, completedIdea } from "./plans.js";
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
function hash(text) {
  let n = 2166136261;
  for (const c of text) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
export function momentIdeas(store, date = new Date()) {
  const month = date.getMonth() + 1,
    hour = date.getHours(),
    season =
      month >= 3 && month <= 5
        ? "spring"
        : month >= 6 && month <= 8
          ? "summer"
          : month >= 9 && month <= 11
            ? "autumn"
            : "winter";
  const daypart =
    hour < 6 ? "night" : hour < 12 ? "morning" : hour < 18 ? "day" : "evening";
  const themes = {
    spring: [
      "🌱",
      "Маленькая весна",
      "Чуть больше воздуха, цвета и новых маршрутов.",
    ],
    summer: [
      "🍉",
      "День для маленьких приключений",
      "Прогулки, закат и время без спешки.",
    ],
    autumn: [
      "🍂",
      "Осень, которую хочется прожить",
      "Тёплые чашки, красивые истории и немного творчества.",
    ],
    winter: [
      "❄️",
      "Уютнее, когда вместе",
      "Соберите свой маленький остров тепла.",
    ],
  };
  let [symbol, title, description] = themes[season];
  if (month === 10 && date.getDate() >= 25) {
    symbol = "🎃";
    title = "Немного доброй магии";
    description = "Истории, загадки и уютный вечер с лёгкой мистикой.";
  }
  if (month === 12 && date.getDate() >= 20) {
    symbol = "✨";
    title = "Собираем праздничное настроение";
    description = "Традиции, маленькие сюрпризы и ваши планы на новый год.";
  }
  const labels = {
    night: "Тихие идеи для позднего часа",
    morning: "Начать день по-своему",
    day: "Чем наполнить сегодняшний день",
    evening: "Ваш вечер начинается здесь",
  };
  const liked = (i) =>
    store.data.reactions.some(
      (r) =>
        r.ideaId === i.id &&
        !r.deletedAt &&
        ["like", "favorite"].includes(r.reaction),
    );
  const fresh = (i) =>
    i.source === "user" && Date.now() - i.createdAt < 14 * 86400000;
  const score = (i) => {
    let n = liked(i) ? 4 : 0;
    if (fresh(i)) n += 5;
    if (
      ["evening", "night"].includes(daypart) &&
      ["Дома", "Где угодно"].includes(i.location)
    )
      n += 3;
    if (daypart === "morning" && i.duration <= 30) n += 3;
    if (daypart === "night" && ["Спокойно", "Уютно"].includes(i.mood)) n += 4;
    if (season === "summer" && i.location === "На улице") n += 3;
    if (
      ["autumn", "winter"].includes(season) &&
      ["Еда", "Творчество", "Дома", "Музыка"].includes(i.category)
    )
      n += 2;
    return n + (hash(localDay(date) + daypart + i.id) % 100) / 30;
  };
  const list = store.ideas
    .filter((i) => !ownLiked(store, i.id) && !completedIdea(store, i.id))
    .sort((a, b) => score(b) - score(a))
    .slice(0, 8);
  return {
    symbol,
    title,
    description,
    daypart: labels[daypart],
    list,
    season,
    seed: localDay(date),
  };
}
export function dailyOrder(list, date = new Date()) {
  const seed = localDay(date);
  return [...list].sort(
    (a, b) =>
      (b.source === "user") - (a.source === "user") ||
      hash(seed + a.id) - hash(seed + b.id),
  );
}
