import { writeFile } from "node:fs/promises";
const scenes = {
  tea: [
    "#dbe9df",
    '<path d="M58 110h106l-8 68q-45 20-88 0Z" fill="#f7e4d2"/><path d="M165 120q55-5 21 46h-27" fill="none" stroke="#f7e4d2" stroke-width="13"/><ellipse cx="111" cy="110" rx="53" ry="14" fill="#b68b65"/><path d="M90 80q-20-20 3-45m25 42q-16-22 7-42" fill="none" stroke="#fff5e5" stroke-width="5"/>',
  ],
  baking: [
    "#f2dfcd",
    '<path d="M45 144q0-56 80-56t80 56l-13 52H58Z" fill="#e6b08c"/><path d="M54 143q70 28 140 0" stroke="#fff1d5" stroke-width="8" fill="none"/><path d="m72 89 93 69m-78-92 93 69" stroke="#9e7c65" stroke-width="7"/><circle cx="172" cy="62" r="28" fill="#f6cf99"/><circle cx="167" cy="55" r="4"/><circle cx="183" cy="65" r="3"/>',
  ],
  puzzle: [
    "#e2dbef",
    '<path d="M52 58h61q-18 35 8 35t8-35h57v60q-33-18-33 7t33 9v58h-60q18-36-7-36t-9 36H52v-59q36 18 36-9T52 113Z" fill="#c0abd8" stroke="#8f78aa" stroke-width="3"/>',
  ],
  cards: [
    "#e6ddeb",
    '<g transform="rotate(-13 90 130)"><rect x="42" y="51" width="98" height="154" rx="15" fill="#e9b5c8"/><path d="M70 119q-20-25-20-1t34 38q40-40 26-49t-26 12Z" fill="#b27593"/></g><g transform="rotate(12 160 139)"><rect x="113" y="64" width="98" height="154" rx="15" fill="#f9e9cf"/><path d="m163 101 22 37-22 38-22-38Z" fill="#ba9acf"/></g>',
  ],
  painting: [
    "#eee2d4",
    '<ellipse cx="122" cy="139" rx="80" ry="65" fill="#dfbb92"/><circle cx="87" cy="111" r="16" fill="#dd8c9f"/><circle cx="130" cy="100" r="16" fill="#c1a6d3"/><circle cx="166" cy="126" r="16" fill="#9cbeab"/><circle cx="98" cy="162" r="13" fill="#f1d48c"/><path d="m152 181 50-122" stroke="#7b5d55" stroke-width="9"/>',
  ],
  stars: [
    "#d6d8eb",
    '<path d="m60 80 60-27 46 62 42 44-78 29Z" fill="none" stroke="#8a83ae" stroke-width="3"/> <g fill="#fff2c9"><circle cx="60" cy="80" r="8"/><circle cx="120" cy="53" r="6"/><circle cx="166" cy="115" r="9"/><circle cx="208" cy="159" r="6"/><circle cx="130" cy="188" r="8"/></g>',
  ],
  plant: [
    "#dde8d7",
    '<path d="m77 153 13 56h70l15-56Z" fill="#cfab8c"/><path d="M125 155V57" stroke="#719279" stroke-width="6"/><path d="M123 124Q60 132 61 76q55-4 62 48m4-18q64 2 59-55-59 5-59 55" fill="#9bb690"/>',
  ],
  photo: [
    "#e8d7ce",
    '<rect x="45" y="73" width="161" height="126" rx="24" fill="#d6afa6"/><rect x="68" y="55" width="52" height="30" rx="8" fill="#b78b88"/><circle cx="128" cy="135" r="42" fill="#6f727f"/><circle cx="128" cy="135" r="29" fill="#b5c1cf"/><circle cx="118" cy="124" r="10" fill="#eff2ed"/><rect x="173" y="94" width="17" height="12" rx="3" fill="#f5e3b9"/>',
  ],
  story: [
    "#e8e0d0",
    '<path d="M40 66q40-15 82 4v135q-42-15-82-4Zm82 4q42-19 86-4v135q-44-15-86 4Z" fill="#fff1d9"/><path d="M122 70v135M58 91h40m-40 22h43m-43 22h35m48-44h46m-46 22h39m-39 22h43" stroke="#cbb398" stroke-width="3"/><path d="m80 163 12 10-12 12-12-12Z" fill="#d4a1ad"/>',
  ],
  dance: [
    "#eadbea",
    '<circle cx="127" cy="99" r="58" fill="#c3a7d7"/><path d="M69 99h116M79 70h95m-95 58h95M127 41v116m-27-108q-22 50 0 100m54-100q22 50 0 100" stroke="#f4dff7" stroke-width="3" fill="none"/><path d="M127 41V14m-50 178q44-24 100 0" stroke="#a78db3" stroke-width="4"/><path d="m57 151 5 15 15 2-12 9 3 15-12-8-13 7 4-15-10-10 15-1Z" fill="#f2cb98"/>',
  ],
  paper: [
    "#dce5df",
    '<path d="m42 111 165-62-52 165-41-61Z" fill="#f3dfd6"/><path d="m42 111 72 42 93-104-55 119" stroke="#c8ada8" stroke-width="3" fill="none"/><path d="m70 192-24 8m43 2-17 15" stroke="#99aea2" stroke-width="3"/>',
  ],
  candle: [
    "#ead8c8",
    '<rect x="76" y="106" width="105" height="101" rx="22" fill="#fff1d1"/><path d="M129 114q-45-31 0-84 39 58 0 84" fill="#efbe87"/><path d="M129 106q-20-15 0-38 17 25 0 38" fill="#fff6c8"/><path d="M100 142q25 12 51 0" stroke="#dec3a1" stroke-width="3"/>',
  ],
  wind: [
    "#dce6ec",
    '<path d="M40 93h108q49-1 36-33t-46 2M31 121h142q60 0 26 45-22 15-39-6M50 150h68q37 0 21 32-15 16-29-1" fill="none" stroke="#91adb9" stroke-width="9" stroke-linecap="round"/>',
  ],
  telescope: [
    "#d9dced",
    '<path d="m65 113 105-59 30 48-104 59Z" fill="#bba3c9"/><path d="m171 55 28 48M112 151 73 214m39-63 47 63" stroke="#8e82a5" stroke-width="7"/><path d="m53 44 4 11 12 3-10 8 1 12-10-7-11 4 4-11-7-10 12 1Z" fill="#f3dca2"/>',
  ],
};
for (const [name, [bg, shape]] of Object.entries(scenes))
  await writeFile(
    `assets/${name}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 250"><defs><filter id="s"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#765a73" flood-opacity=".13"/></filter><radialGradient id="b"><stop stop-color="#fff9ec"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs><rect width="250" height="250" rx="30" fill="url(#b)"/><circle cx="205" cy="35" r="5" fill="#fff6df"/><circle cx="30" cy="171" r="3" fill="#fff6df"/><g filter="url(#s)">${shape}</g></svg>`,
  );
