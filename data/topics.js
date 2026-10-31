// Concrete topics improve discovery while preserving broad category metadata.
export const topics = [
  {
    name: "Чайные ритуалы",
    art: "tea",
    match: /какао|чай|напиток|купаж|дегустац/i,
  },
  {
    name: "Выпечка",
    art: "baking",
    match: /печень|пицц|тест[оа]|сырник|торт/i,
  },
  { name: "Фотоистории", art: "photo", match: /фото|кадр|снимок|альбом/i },
  {
    name: "Бумага и письма",
    art: "paper",
    match: /письм|открытк|конверт|оригами|коллаж/i,
  },
  {
    name: "Головоломки",
    art: "puzzle",
    match: /квест|загад|пазл|головолом|морской бой/i,
  },
  {
    name: "Карточные игры",
    art: "cards",
    match:
      /вопрос|правд|ассоциац|кто скорее|что бы ты|викторин|угадай предмет/i,
  },
  {
    name: "Рисование",
    art: "painting",
    match: /рису|нарис|портрет|натюрморт|раскрас|глин|пластилин/i,
  },
  {
    name: "Танцы и ритм",
    art: "dance",
    match: /танц|караоке|дискотек|ритм|оркестр/i,
  },
  {
    name: "Истории",
    art: "story",
    match: /истори|детств|книг|читать|рассказ|интервью/i,
  },
  {
    name: "Маленький сад",
    art: "plant",
    match: /растен|цветоч|цвет[ыо]|зелень|горшок/i,
  },
  {
    name: "Небо и космос",
    art: "telescope",
    match: /зв[её]зд|созвезд|рассвет|закат|небо/i,
  },
  {
    name: "Уютные ритуалы",
    art: "candle",
    match: /плед|свеч|уют|спа|тишин|благодар|приятн/i,
  },
  {
    name: "Воздух и движение",
    art: "wind",
    match: /прогул|маршрут|птиц|улиц|ветер|облак/i,
  },
];
export function enrichIdea(idea) {
  const topic = topics.find((t) => t.match.test(idea.title));
  return topic
    ? { ...idea, topic: topic.name, image: `./assets/${topic.art}.svg` }
    : idea;
}
