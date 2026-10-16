// 1 daqiqalik dars: "Ruchkani sotib ber" g'oyasi Dumpling o'yinchog'i misolida.
// Vaqtlar diktor ovozidan olinadi (build/dumpling/voice.json).
import { C, draw } from './engine.js';

const V = await (await fetch('/doska/build/dumpling/voice.json')).json();
const SEG = Object.fromEntries(V.segments.map((s) => [s.id, s]));
// Bo'lak ichidagi nisbiy vaqt: 0 — gap boshi, 1 — gap oxiri
const at = (id, f = 0) => SEG[id].start + (SEG[id].end - SEG[id].start) * f;
const len = (id, a = 0, b = 1) => Math.max(0.35, (SEG[id].end - SEG[id].start) * (b - a) * 0.9);

const dumplingIcon = (x, y, s) => [
  `M${x - s} ${y + s * 0.3} Q${x} ${y - s * 1.15} ${x + s} ${y + s * 0.3} Q${x} ${y + s * 0.75} ${x - s} ${y + s * 0.3} Z`,
  `M${x - s * 0.45} ${y - s * 0.35} l${s * 0.12} ${s * 0.3} M${x} ${y - s * 0.55} l0 ${s * 0.32} M${x + s * 0.45} ${y - s * 0.35} l${-s * 0.12} ${s * 0.3}`,
];

const penPhoto = `<svg viewBox="0 0 452 254" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <rect width="452" height="254" fill="#b98557"/>
  <rect x="40" y="38" width="190" height="172" rx="8" fill="#f4efe2" transform="rotate(-6 135 125)"/>
  <g stroke="#b9c6e0" stroke-width="3" transform="rotate(-6 135 125)">${[80, 105, 130, 155, 180].map((y) => `<line x1="58" y1="${y}" x2="212" y2="${y}"/>`).join('')}</g>
  <g transform="rotate(-28 300 130)"><rect x="170" y="118" width="250" height="24" rx="12" fill="#1f3c88"/><rect x="170" y="118" width="70" height="24" rx="10" fill="#d9dde6"/><polygon points="150,130 172,119 172,141" fill="#2b2b2b"/></g>
</svg>`;

const toyPhoto = `<svg viewBox="0 0 392 274" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="bg" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="#ffe3ec"/><stop offset="1" stop-color="#f7b9cc"/></radialGradient>
  <radialGradient id="dm" cx=".45" cy=".35" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#efe6da"/></radialGradient></defs>
  <rect width="392" height="274" fill="url(#bg)"/>
  ${[[110, 190, 0.7], [290, 195, 0.7], [196, 165, 1]].map(([x, y, k]) => `
  <g transform="translate(${x} ${y}) scale(${k})">
    <ellipse cx="0" cy="58" rx="98" ry="14" fill="rgba(150,60,90,.25)"/>
    <path d="M-100 30 Q0 -120 100 30 Q0 75 -100 30 Z" fill="url(#dm)" stroke="#d8c6b4" stroke-width="4"/>
    <path d="M-48 -20 q8 14 4 30 M-16 -36 q6 16 2 32 M16 -36 q-6 16 -2 32 M48 -20 q-8 14 -4 30" stroke="#d8c6b4" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="-26" cy="20" r="7" fill="#2b2233"/><circle cx="26" cy="20" r="7" fill="#2b2233"/>
    <circle cx="-23" cy="17" r="2.2" fill="#fff"/><circle cx="29" cy="17" r="2.2" fill="#fff"/>
    <ellipse cx="-44" cy="34" rx="11" ry="6" fill="#ff9bb5"/><ellipse cx="44" cy="34" rx="11" ry="6" fill="#ff9bb5"/>
    <path d="M-9 32 q9 9 18 0" stroke="#2b2233" stroke-width="4" fill="none" stroke-linecap="round"/>
  </g>`).join('')}
</svg>`;

// Bo'limlarning doskadagi balandligi
const S1 = 1260;
const S2 = 1780;
const S3 = 2960;
const S4 = 3610;
const S5 = 4330;
const S6 = 5020;

const items = [
  // n1 — sarlavha
  { type: 'text', font: 'title', text: 'Ruchkani sotib ber', x: 540, y: 420, size: 108, align: 'center', t: at('n1', 0.0), d: len('n1', 0, 0.55), underline: C.pink },
  { type: 'text', text: 'Sotuvning eng mashhur testi', x: 540, y: 545, size: 58, align: 'center', color: C.yellow, t: at('n1', 0.62), d: len('n1', 0.6, 1) },
  { type: 'photo', x: 300, y: 640, w: 480, h: 270, caption: 'Jordan Belfort usuli', rot: -2.5, t: at('n1', 0.9), svg: penPhoto },

  // n2–n3 — ko'pchilik maqtaydi, Belfort savol beradi
  { type: 'text', font: 'title', text: 'Ko‘pchilik', x: 90, y: S1, size: 64, t: at('n2', 0.0), d: len('n2', 0, 0.35) },
  { type: 'path', d: draw.arrow(470, S1 - 22, 590, S1 - 22), color: C.white, width: 5, t: at('n2', 0.4), dur: 0.35 },
  { type: 'text', font: 'title', text: 'Maqtaydi', x: 620, y: S1, size: 64, color: C.pink, t: at('n2', 0.55), d: len('n2', 0.5, 0.95) },
  { type: 'path', d: draw.cross(985, S1 - 22, 24), color: C.pink, width: 8, t: at('n2', 1.0), dur: 0.3 },
  { type: 'text', font: 'title', text: 'Belfort', x: 90, y: S1 + 150, size: 64, t: at('n3', 0.0), d: len('n3', 0, 0.3) },
  { type: 'path', d: draw.arrow(470, S1 + 128, 590, S1 + 128), color: C.white, width: 5, t: at('n3', 0.35), dur: 0.35 },
  { type: 'text', font: 'title', text: 'Savol beradi', x: 620, y: S1 + 150, size: 58, color: C.green, t: at('n3', 0.6), d: len('n3', 0.6, 1), underline: C.green },

  // n4–n6 — bizning mahsulot
  { type: 'text', font: 'title', text: 'Bizning ishimizda', x: 540, y: S2, size: 80, align: 'center', t: at('n4', 0.0), d: len('n4'), underline: C.yellow },
  { type: 'photo', x: 80, y: S2 + 80, w: 420, h: 294, caption: 'Dumpling o‘yinchog‘i', rot: -3, t: at('n5', 0.05), svg: toyPhoto },
  { type: 'text', text: '1 blok =', x: 580, y: S2 + 190, size: 62, t: at('n5', 0.55), d: 0.45 },
  { type: 'text', font: 'title', text: '12 dona', x: 580, y: S2 + 290, size: 84, color: C.yellow, t: at('n5', 0.72), d: len('n5', 0.72, 1) },
  ...Array.from({ length: 12 }, (_, i) => ({
    type: 'path', d: dumplingIcon(130 + (i % 6) * 164, S2 + 520 + Math.floor(i / 6) * 110, 46), color: C.white, width: 4,
    t: at('n5', 1.0) - 0.1 + i * 0.07, dur: 0.065,
  })),
  { type: 'text', text: '1 dona = 15 000 so‘m', x: 90, y: S2 + 800, size: 64, t: at('n6', 0.12), d: len('n6', 0.12, 0.45) },
  { type: 'text', font: 'title', text: '1 blok = 180 000 so‘m', x: 100, y: S2 + 920, size: 76, color: '#2a1663', mark: C.yellow, t: at('n6', 0.55), d: len('n6', 0.55, 1) },

  // n7–n8 — xato yo'l
  { type: 'text', font: 'title', text: 'Ko‘p agentlar:', x: 90, y: S3, size: 68, t: at('n7', 0.0), d: len('n7', 0, 0.25) },
  { type: 'text', text: '«Zo‘r o‘yinchoq!»', x: 130, y: S3 + 105, size: 60, color: C.dim, t: at('n7', 0.33), d: len('n7', 0.33, 0.55) },
  { type: 'text', text: '«Juda arzon!»', x: 130, y: S3 + 195, size: 60, color: C.dim, t: at('n7', 0.58), d: len('n7', 0.58, 0.75) },
  { type: 'text', text: '«Hamma olyapti!»', x: 130, y: S3 + 285, size: 60, color: C.dim, t: at('n7', 0.78), d: len('n7', 0.78, 1) },
  { type: 'path', d: draw.cross(330, S3 + 175, 150), color: C.pink, width: 11, t: at('n8', 0.0), dur: 0.45 },
  { type: 'stamp', text: 'Xato', x: 700, y: S3 + 110, size: 84, color: C.pink, rot: -10, t: at('n8', 0.12) },
  { type: 'text', text: 'Do‘konchi buni har kuni eshitadi', x: 90, y: S3 + 420, size: 50, color: C.yellow, t: at('n8', 0.35), d: len('n8', 0.35, 1) },

  // n9–n12 — to'g'ri yo'l: savollar
  { type: 'text', font: 'title', text: 'To‘g‘ri yo‘l:', x: 90, y: S4, size: 70, t: at('n9', 0.0), d: len('n9', 0, 0.5) },
  { type: 'path', d: draw.check(640, S4 - 25, 34), color: C.green, width: 10, t: at('n9', 0.5), dur: 0.25 },
  { type: 'text', font: 'title', text: 'Savol bering', x: 100, y: S4 + 115, size: 82, color: '#2a1663', mark: C.yellow, t: at('n9', 0.65), d: len('n9', 0.6, 1) },
  { type: 'path', d: draw.bubble(70, S4 + 180, 940, 320), color: C.white, width: 5, t: at('n10', 0.0) - 0.45, dur: 0.45 },
  { type: 'text', text: 'Qaysi o‘yinchoqlar tez sotiladi?', x: 110, y: S4 + 268, size: 50, t: at('n10', 0.05), d: len('n10') },
  { type: 'text', text: 'Xaridorlar qanday narxdagisini so‘raydi?', x: 110, y: S4 + 358, size: 46, color: C.yellow, t: at('n11', 0.05), d: len('n11') },
  { type: 'text', text: 'Javoningizda nima yetishmayapti?', x: 110, y: S4 + 448, size: 50, t: at('n12', 0.05), d: len('n12') },

  // n13–n14 — qiziqmasa, majburlamaslik
  { type: 'path', d: draw.person(170, S5 + 110, 110), color: C.white, width: 6, t: at('n13', 0.0), dur: 0.5 },
  { type: 'path', d: draw.bubble(320, S5 - 40, 680, 130), color: C.white, width: 5, t: at('n13', 0.2), dur: 0.4 },
  { type: 'text', text: '«Menga kerak emas»', x: 360, y: S5 + 45, size: 58, t: at('n13', 0.3), d: len('n13', 0.3, 0.65) },
  { type: 'text', font: 'title', text: 'Majburlamang!', x: 90, y: S5 + 300, size: 76, color: C.pink, t: at('n13', 0.68), d: len('n13', 0.68, 1), underline: C.pink },
  { type: 'text', font: 'title', text: 'Rahmat', x: 90, y: S5 + 470, size: 64, color: C.green, t: at('n14', 0.0), d: len('n14', 0, 0.3) },
  { type: 'path', d: draw.arrow(330, S5 + 448, 470, S5 + 448), color: C.white, width: 5, t: at('n14', 0.32), dur: 0.3 },
  { type: 'path', d: draw.shop(560, S5 + 445, 50), color: C.white, width: 5, t: at('n14', 0.45), dur: 0.4 },
  { type: 'text', text: 'Keyingi do‘kon', x: 650, y: S5 + 470, size: 54, color: C.yellow, t: at('n14', 0.62), d: len('n14', 0.62, 1) },

  // n15 — xulosa
  { type: 'text', font: 'title', text: 'Xulosa', x: 540, y: S6, size: 92, align: 'center', t: at('n15', 0.0) - 0.2, d: 0.6, underline: C.yellow },
  { type: 'path', d: draw.check(140, S6 + 115, 30), color: C.green, width: 10, t: at('n15', 0.3), dur: 0.2 },
  { type: 'text', font: 'title', text: 'Avval ehtiyoj', x: 200, y: S6 + 140, size: 76, t: at('n15', 0.35), d: len('n15', 0.35, 0.68) },
  { type: 'path', d: draw.check(140, S6 + 235, 30), color: C.green, width: 10, t: at('n15', 0.7), dur: 0.2 },
  { type: 'text', font: 'title', text: 'Keyin taklif', x: 200, y: S6 + 260, size: 76, color: C.yellow, t: at('n15', 0.74), d: len('n15', 0.74, 1) },
];

const endT = V.duration;
const overview = endT + 0.3;

export default {
  duration: overview + 3.4,
  height: 5500,
  fade: [[0, 0.35, 1, 0], [overview + 2.7, overview + 3.4, 0, 1]],
  camera: [
    { t: 0, y: 0 },
    { t: at('n2') - 0.1, y: 430, move: 0.9 },
    { t: at('n4') - 0.05, y: 1280, move: 0.9 },
    { t: at('n7') - 0.1, y: 2200, move: 0.9 },
    { t: at('n9') - 0.1, y: 2875, move: 0.9 },
    { t: at('n13') - 0.1, y: 3585, move: 0.9 },
    { t: at('n15') - 0.25, y: 4190, move: 0.9 },
    { t: overview + 1.3, y: 1790, zoom: 0.36, move: 1.6 },
  ],
  voice: '/doska/build/dumpling/voice.wav',
  items,
};
