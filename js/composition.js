// All performers use the same pitch vocabulary. Positions change phrasing,
// register and harmony, rather than detuning each listener's copy of the room.
export const constellations = [
  ["Комета", "Восходящий перелив", [0, 2, 4, 7], 0.24, 0],
  ["Колыбель", "Низкая мягкая опора", [0, 7, 4], 0.9, -12],
  ["Ручей", "Бегущие капли", [0, 4, 2, 7, 4], 0.19, 0],
  ["Аврора", "Раскрывающийся аккорд", [0, 4, 7, 11], 0.42, 0],
  ["Ласточки", "Два голоса навстречу", [7, 4, 2, 0, 4], 0.32, 0],
  ["Маяк", "Редкие тёплые огни", [0, 7, 12], 0.72, -12],
  ["Спираль", "Круговая мелодия", [0, 2, 4, 7, 4, 2], 0.28, 0],
  ["Луна", "Глубокий выдох", [7, 4, 0], 1.05, -12],
  ["Кристалл", "Короткие стеклянные блики", [12, 7, 4, 2], 0.3, 0],
  ["Парус", "Медленно плывущие созвучия", [0, 4, 9, 7], 0.66, -12],
  ["Эхо", "Ответ в другом регистре", [0, 7, 2, 9], 0.46, 0],
  ["Семя", "Новая ветвь мелодии", [0, 2, 7, 4, 9], 0.38, -12],
].map(([name, hint, notes, step, octave], index) => ({
  name,
  hint,
  notes,
  step,
  octave,
  index,
}));

export function assignedConstellations(players, user, solo = false) {
  const count = solo ? 1 : Math.max(1, Math.min(12, players.length));
  const seat = solo ? 0 : players.findIndex((p) => p.id === user);
  return constellations.filter((c) => seat >= 0 && c.index % count === seat);
}

export function compositionState(contributors) {
  const voices = Object.values(contributors || {});
  const points = voices
    .filter((c) => c.slot !== -1)
    .map((c) => c.pads?.[0] || [0.5, 0.5]);
  const mean = (axis) =>
    points.reduce((n, p) => n + p[axis], 0) / Math.max(1, points.length);
  const spread =
    points.reduce((n, p) => n + Math.hypot(p[0] - mean(0), p[1] - mean(1)), 0) /
    Math.max(1, points.length);
  const memory = voices.reduce(
    (sum, c) =>
      sum +
      (c.memory || []).reduce((s, m, i) => s + (Number(m) || 0) * (i + 1), 0),
    0,
  );
  return {
    root: [48, 50, 53, 55][Math.min(3, Math.floor(mean(0) * 4))],
    tempo: 0.65 + mean(1) * 0.8,
    intimacy: Math.max(0, 1 - spread * 1.6),
    branch: Math.floor(memory * 2) % 4,
  };
}

export function phraseNotes(index, contributors, power = 0.5) {
  const motif = constellations[index % 12];
  const shared = compositionState(contributors);
  const turns = [0, 2, 5, 7][shared.branch];
  return motif.notes.map((note, i) => ({
    frequency:
      440 * 2 ** ((shared.root + motif.octave + note + turns - 69) / 12),
    delay: (i * motif.step) / shared.tempo,
    duration: 0.7 + motif.step * 1.4 + shared.intimacy * 0.7,
    gain:
      (0.018 + Math.min(1, power) * 0.023) / Math.sqrt(motif.notes.length / 3),
    pan: Math.sin(i * 1.7 + index) * 0.65,
    bright: index % 3,
    timbre: index % 4,
  }));
}

// A small generative score: each performer supplies a motif, the other pads
// choose its common scale and answer. A 24-second chapter changes the contour
// even when nobody moves a control. No random notes outside the shared scale.
export function gardenPhrase(contributors, seat, chapter) {
  const voices = Object.values(contributors).filter((c) => c.slot !== -1);
  if (!voices.length) return [];
  const own = voices[seat % voices.length];
  const partner = voices[(seat + 1) % voices.length];
  const melody = own.pads?.[2] || [0.5, 0.5];
  const movement = own.pads?.[3] || [0.5, 0.5];
  const harmony =
    voices.reduce((sum, c) => sum + (c.pads?.[1]?.[0] ?? 0.45), 0) /
    voices.length;
  const scale = [
    [0, 2, 4, 7, 9],
    [0, 3, 5, 7, 10],
    [0, 2, 5, 7, 9],
    [0, 4, 7, 9, 11],
  ][Math.min(3, Math.floor(harmony * 4))];
  const shared = compositionState(contributors);
  const motif = constellations[(chapter + seat * 3 + shared.branch) % 12];
  const answer = Math.floor((partner.pads?.[0]?.[1] ?? 0.5) * 4);
  const count = 2 + Math.floor(melody[0] * 4);
  return Array.from({ length: count }, (_, i) => {
    let degree =
      (Math.round(motif.notes[i % motif.notes.length] / 2) +
        answer +
        Math.floor(chapter / 3)) %
      scale.length;
    if (chapter % 2) degree = scale.length - 1 - degree;
    const octave = melody[1] < 0.3 ? -12 : melody[1] > 0.7 ? 12 : 0;
    return {
      frequency: 440 * 2 ** ((shared.root + scale[degree] + octave - 69) / 12),
      delay: (i * (0.28 + (1 - movement[0]) * 0.65)) / shared.tempo,
      duration: 0.8 + (1 - movement[0]) * 2.4,
      gain: (0.027 + melody[0] * 0.012) / Math.sqrt(voices.length),
      pan: Math.sin(i * 1.7 + seat * 2) * (0.15 + movement[1] * 0.7),
      bright: seat % 3,
      timbre: seat % 4,
    };
  });
}
