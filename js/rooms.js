export const roomEmoji = [
  "🌸",
  "🌻",
  "🌷",
  "🌺",
  "🪻",
  "🌼",
  "🍀",
  "🌿",
  "🌵",
  "🍄",
  "🌈",
  "⭐",
  "🌙",
  "☀️",
  "🪐",
  "☄️",
  "🦋",
  "🐝",
  "🐞",
  "🐳",
  "🐬",
  "🦊",
  "🐼",
  "🐻",
  "🐸",
  "🐧",
  "🦄",
  "🐲",
  "🐢",
  "🦉",
  "🐈",
  "🐕",
  "🍋",
  "🍊",
  "🍎",
  "🍒",
  "🍓",
  "🍉",
  "🍑",
  "🥝",
  "🧁",
  "🍩",
  "🍪",
  "🍯",
  "☕",
  "🫖",
  "🍵",
  "🍕",
  "🎸",
  "🎨",
  "🎭",
  "🎮",
  "🧩",
  "🎲",
  "🪁",
  "🎈",
  "🎁",
  "🧸",
  "🪄",
  "💎",
  "🪷",
  "🫧",
  "🕊️",
  "🐚",
];
export function roomSymbols(id) {
  let a = 2166136261,
    b = 5381;
  for (const c of id) {
    a = Math.imul(a ^ c.charCodeAt(0), 16777619) >>> 0;
    b = (Math.imul(b, 33) ^ c.charCodeAt(0)) >>> 0;
  }
  return Array.from(
    { length: 6 },
    (_, n) => roomEmoji[n < 5 ? (a >>> (n * 6)) & 63 : b & 63],
  ).join(" ");
}
export function savedRooms(identity) {
  try {
    return JSON.parse(localStorage.getItem("vmeste-rooms-" + identity)) || [];
  } catch {
    return [];
  }
}
export function rememberRoom(identity, record) {
  const rooms = savedRooms(identity).filter((r) => r.id !== record.id);
  rooms.unshift({ ...record, visited: Date.now() });
  localStorage.setItem(
    "vmeste-rooms-" + identity,
    JSON.stringify(rooms.slice(0, 100)),
  );
}
