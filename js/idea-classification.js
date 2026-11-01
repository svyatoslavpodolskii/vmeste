import { topics } from "../data/topics.js";
import { esc } from "./ui.js";

export const ideaCategories = [
  "Дома",
  "Прогулки",
  "Игры",
  "Задания",
  "Еда",
  "Музыка",
  "Разговоры",
  "Творчество",
  "Свидания",
  "Спорт",
];
export const categoryLabel = (value) =>
  value === "Дома" ? "Уют и отдых" : value;
const options = (values, selected, label = (v) => v) =>
  values
    .map(
      (value) =>
        `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(label(value))}</option>`,
    )
    .join("");

export function ideaClassification(idea = {}) {
  const categories = [
    ...new Set([...ideaCategories, idea.category].filter(Boolean)),
  ];
  const themes = [
    ...new Set(
      [
        ...topics
          .map((t) => t.name)
          .filter((name) => !ideaCategories.includes(name)),
        idea.topic,
      ].filter(Boolean),
    ),
  ];
  return `<label>Категория<select name="category">${options(categories, idea.category || "Дома", categoryLabel)}</select></label><label>Тема · необязательно<select name="topic"><option value="">Без уточнения</option>${options(themes, idea.topic)}</select></label><p class="fine classification-hint">Категория — общий раздел, тема — уточнение: например, «Творчество → Рисование». Можно оставить только категорию.</p>`;
}

export function classificationFilter(ideas, selected = "Всё") {
  const categories = [
    ...new Set(ideas.map((i) => i.category).filter(Boolean)),
  ].sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), "ru"));
  const themes = [
    ...new Set(
      ideas.map((i) => i.topic).filter((v) => v && !categories.includes(v)),
    ),
  ].sort((a, b) => a.localeCompare(b, "ru"));
  return `<option value="Всё" ${selected === "Всё" ? "selected" : ""}>Все занятия</option><optgroup label="Категории">${options(categories, selected, categoryLabel)}</optgroup>${themes.length ? `<optgroup label="Темы · уточнение">${options(themes, selected)}</optgroup>` : ""}`;
}
