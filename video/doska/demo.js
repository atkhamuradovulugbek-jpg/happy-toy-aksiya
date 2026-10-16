// 22 soniyalik namuna: "Ruchkani sotib ber" g'oyasi doska uslubida.
import { C, draw } from './engine.js';

const pen = `<svg viewBox="0 0 452 254" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="wd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c79a6b"/><stop offset="1" stop-color="#9c6e45"/></linearGradient></defs>
  <rect width="452" height="254" fill="url(#wd)"/>
  <g stroke="rgba(80,50,25,.25)" stroke-width="3">${[30, 80, 140, 200].map((y) => `<path d="M0 ${y} Q226 ${y + 14} 452 ${y - 6}" fill="none"/>`).join('')}</g>
  <rect x="40" y="40" width="190" height="170" rx="8" fill="#f4efe2" transform="rotate(-6 135 125)"/>
  <g stroke="#b9c6e0" stroke-width="3" transform="rotate(-6 135 125)">${[80, 105, 130, 155, 180].map((y) => `<line x1="58" y1="${y}" x2="212" y2="${y}"/>`).join('')}</g>
  <g transform="rotate(-28 300 130)">
    <rect x="170" y="118" width="250" height="24" rx="12" fill="#1f3c88"/>
    <rect x="170" y="118" width="70" height="24" rx="10" fill="#d9dde6"/>
    <polygon points="150,130 172,119 172,141" fill="#2b2b2b"/>
    <rect x="300" y="110" width="80" height="8" rx="4" fill="#c9ced8"/>
  </g>
</svg>`;

const Y1 = 1250;
const Y2 = 1900;
const Y3 = 2560;

export default {
  duration: 22,
  height: 3000,
  fade: [[0, 0.35, 1, 0], [21.3, 22, 0, 1]],
  camera: [
    { t: 0, y: 0 },
    { t: 5.8, y: 650, move: 1.2 },
    { t: 10.6, y: 950, move: 1.0 },
    { t: 20.1, y: 540, zoom: 0.75, move: 1.2 },
  ],
  items: [
    { type: 'text', font: 'title', text: 'Ruchkani sotib ber', x: 540, y: 420, size: 108, align: 'center', t: 0.3, d: 1.3, underline: C.pink },
    { type: 'text', text: 'Sotuvning asosiy testi', x: 540, y: 545, size: 58, align: 'center', color: C.yellow, t: 2.2, d: 1.0 },
    { type: 'photo', x: 300, y: 640, w: 480, h: 270, caption: 'Jordan Belfort usuli', rot: -2.5, t: 3.4, svg: pen },

    { type: 'text', font: 'title', text: 'Ko‘pchilik nima qiladi?', x: 90, y: Y1, size: 70, t: 4.8, d: 1.1 },
    { type: 'text', text: '«Zo‘r ruchka!»', x: 150, y: Y1 + 115, size: 60, color: C.dim, t: 6.1, d: 0.7 },
    { type: 'text', text: '«Juda arzon!»', x: 150, y: Y1 + 205, size: 60, color: C.dim, t: 6.9, d: 0.6 },
    { type: 'text', text: '«Hamma olyapti!»', x: 150, y: Y1 + 295, size: 60, color: C.dim, t: 7.6, d: 0.8 },
    { type: 'path', d: draw.cross(330, Y1 + 185, 150), color: C.pink, width: 11, t: 8.6, dur: 0.5 },
    { type: 'stamp', text: 'Xato', x: 700, y: Y1 + 120, size: 84, color: C.pink, rot: -10, t: 9.2 },

    { type: 'text', font: 'title', text: 'To‘g‘ri yo‘l:', x: 90, y: Y2, size: 70, t: 10.6, d: 0.8 },
    { type: 'path', d: draw.check(640, Y2 - 25, 34), color: C.green, width: 10, t: 11.5, dur: 0.3 },
    { type: 'text', font: 'title', text: 'Savol bering', x: 100, y: Y2 + 115, size: 82, color: '#2a1663', mark: C.yellow, t: 11.9, d: 0.8 },
    { type: 'path', d: draw.bubble(70, Y2 + 180, 940, 230), color: C.white, width: 5, t: 12.9, dur: 0.7 },
    { type: 'text', text: 'Qachondan beri ruchka qidiryapsiz?', x: 110, y: Y2 + 268, size: 52, t: 13.7, d: 1.2 },
    { type: 'text', text: 'Ish uchunmi yoki o‘zingiz uchun?', x: 110, y: Y2 + 358, size: 52, color: C.yellow, t: 15.0, d: 1.1 },

    { type: 'path', d: draw.question(150, Y3 + 20, 90), color: C.pink, width: 16, t: 16.3, dur: 0.55 },
    { type: 'text', font: 'title', text: 'Avval ehtiyoj —', x: 270, y: Y3, size: 72, t: 16.9, d: 0.9 },
    { type: 'text', font: 'title', text: 'keyin taklif', x: 270, y: Y3 + 100, size: 72, color: C.yellow, t: 17.9, d: 0.7, underline: C.green },
  ],
};
