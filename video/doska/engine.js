// Doska (whiteboard) animatsiya dvigateli: qo'l yozadi, chizadi, kamera sirpanadi.
// Sahna fayli: { duration, height, camera: [{t, y, zoom}], items: [...] }
// window.renderAt(frame) — bitta kadrni chizadi (deterministik).
const W = 1080;
const H = 1920;
const FPS = 30;
const HAND_TIP = 44;
const NS = 'http://www.w3.org/2000/svg';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const prog = (T, t, d) => clamp((T - t) / d, 0, 1);

export const C = { white: '#f5f1e8', yellow: '#f7c548', pink: '#ff5c8a', green: '#52d6a0', blue: '#7cc4ff', dim: '#b9b0d6' };

// --- Chizma yordamchilari (SVG path satrlari) ---
export const draw = {
  line: (x1, y1, x2, y2) => `M${x1} ${y1} L${x2} ${y2}`,
  wave: (x1, y, x2) => {
    const n = 6;
    let d = `M${x1} ${y}`;
    for (let i = 1; i <= n; i++) d += ` Q${x1 + ((x2 - x1) * (i - 0.5)) / n} ${y + (i % 2 ? 5 : -5)} ${x1 + ((x2 - x1) * i) / n} ${y}`;
    return d;
  },
  arrow: (x1, y1, x2, y2) => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const h = 22;
    const p1 = [x2 - h * Math.cos(a - 0.5), y2 - h * Math.sin(a - 0.5)];
    const p2 = [x2 - h * Math.cos(a + 0.5), y2 - h * Math.sin(a + 0.5)];
    return [`M${x1} ${y1} L${x2} ${y2}`, `M${p1[0]} ${p1[1]} L${x2} ${y2} L${p2[0]} ${p2[1]}`];
  },
  ellipse: (cx, cy, rx, ry) =>
    `M${cx + rx} ${cy} A${rx} ${ry} 0 1 1 ${cx - rx} ${cy + 2} A${rx} ${ry} 0 1 1 ${cx + rx * 0.96} ${cy - ry * 0.18}`,
  cross: (x, y, s) => [`M${x - s} ${y - s} L${x + s} ${y + s}`, `M${x + s} ${y - s} L${x - s} ${y + s}`],
  check: (x, y, s) => `M${x - s} ${y} L${x - s * 0.25} ${y + s * 0.7} L${x + s} ${y - s * 0.8}`,
  rect: (x, y, w, h, r = 18) =>
    `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`,
  bubble: (x, y, w, h) =>
    `M${x + 22} ${y} H${x + w - 22} Q${x + w} ${y} ${x + w} ${y + 22} V${y + h - 22} Q${x + w} ${y + h} ${x + w - 22} ${y + h} H${x + 90} L${x + 46} ${y + h + 40} L${x + 58} ${y + h} H${x + 22} Q${x} ${y + h} ${x} ${y + h - 22} V${y + 22} Q${x} ${y} ${x + 22} ${y} Z`,
  question: (x, y, s) => [
    `M${x - s * 0.55} ${y - s * 0.55} Q${x - s * 0.5} ${y - s * 1.15} ${x + s * 0.05} ${y - s * 1.12} Q${x + s * 0.65} ${y - s * 1.05} ${x + s * 0.6} ${y - s * 0.55} Q${x + s * 0.55} ${y - s * 0.15} ${x} ${y + s * 0.05} L${x} ${y + s * 0.35}`,
    `M${x - 2} ${y + s * 0.72} L${x + 2} ${y + s * 0.74}`,
  ],
  person: (x, y, s) => [
    `M${x + s * 0.28} ${y - s * 0.62} A${s * 0.28} ${s * 0.3} 0 1 1 ${x + s * 0.27} ${y - s * 0.6}`,
    `M${x - s * 0.6} ${y + s * 0.55} Q${x - s * 0.58} ${y - s * 0.15} ${x} ${y - s * 0.18} Q${x + s * 0.58} ${y - s * 0.15} ${x + s * 0.6} ${y + s * 0.55}`,
  ],
  shop: (x, y, s) => [
    `M${x - s} ${y + s * 0.7} V${y - s * 0.2} H${x + s} V${y + s * 0.7} Z`,
    `M${x - s * 1.1} ${y - s * 0.2} L${x - s * 0.9} ${y - s * 0.7} H${x + s * 0.9} L${x + s * 1.1} ${y - s * 0.2}`,
    `M${x - s * 0.25} ${y + s * 0.7} V${y + s * 0.15} H${x + s * 0.25} V${y + s * 0.7}`,
  ],
};

export function mount(scene) {
  const board = document.getElementById('board');
  const ink = document.getElementById('ink');
  const hand = document.getElementById('hand');
  const fade = document.getElementById('fade');
  board.style.height = scene.height + 'px';
  ink.setAttribute('width', W);
  ink.setAttribute('height', scene.height);

  // Har bir chizma "zarba" (stroke): [t0, t1, nuqtaFn(p)], ovoz uchun ham ishlatiladi.
  const strokes = [];
  const updaters = [];

  for (const it of scene.items) {
    if (it.type === 'text') {
      const el = document.createElement('div');
      el.className = 't ' + (it.font || 'body');
      el.textContent = it.text;
      el.style.fontSize = it.size + 'px';
      el.style.color = it.color || C.white;
      board.appendChild(el);
      const w = el.getBoundingClientRect().width;
      const x = it.align === 'center' ? it.x - w / 2 : it.align === 'right' ? it.x - w : it.x;
      el.style.left = x + 'px';
      el.style.top = it.y - it.size * 0.8 + 'px';
      const d = it.d ?? Math.max(0.35, it.text.length * 0.055);
      const t1 = it.t + d;
      strokes.push({ t0: it.t, t1, kind: 'text', at: (p) => [x + w * p, it.y - it.size * 0.3 + Math.sin(p * d * 38) * it.size * 0.16] });
      updaters.push((T) => {
        const p = prog(T, it.t, d);
        el.style.visibility = p > 0 ? 'visible' : 'hidden';
        el.style.clipPath = `inset(-30% ${(1 - p) * 100}% -30% -5%)`;
      });
      if (it.underline) {
        const ut = t1 + 0.05;
        addPath({ d: draw.wave(x - 6, it.y + it.size * 0.2, x + w + 6), color: it.underline, width: 7, t: ut, dur: 0.45 });
      }
      if (it.mark) {
        const m = document.createElement('div');
        m.className = 'mark';
        m.style.background = it.mark;
        Object.assign(m.style, { left: x - 12 + 'px', top: it.y - it.size * 0.78 + 'px', width: w + 24 + 'px', height: it.size * 1.05 + 'px' });
        board.insertBefore(m, el);
        const mt = it.t - 0.35;
        updaters.push((T) => {
          const p = ease(prog(T, mt, 0.3));
          m.style.transform = `scaleX(${p})`;
          m.style.opacity = p > 0 ? 0.9 : 0;
        });
      }
    } else if (it.type === 'path') {
      addPath(it);
    } else if (it.type === 'photo') {
      const el = document.createElement('div');
      el.className = 'photo';
      Object.assign(el.style, { left: it.x + 'px', top: it.y + 'px', width: it.w + 'px', height: it.h + 'px' });
      el.innerHTML = `<div class="img">${it.svg || ''}</div><div class="cap">${it.caption || ''}</div><div class="tape"></div>`;
      board.appendChild(el);
      updaters.push((T) => {
        const p = prog(T, it.t, 0.45);
        const k = ease(p);
        el.style.opacity = p > 0 ? 1 : 0;
        el.style.transform = `rotate(${it.rot || 0}deg) scale(${1.25 - 0.25 * k}) translateY(${(1 - k) * -40}px)`;
        el.style.filter = `brightness(${0.6 + 0.4 * k})`;
      });
    } else if (it.type === 'stamp') {
      const el = document.createElement('div');
      el.className = 'stamp';
      el.textContent = it.text;
      Object.assign(el.style, { left: it.x + 'px', top: it.y + 'px', color: it.color || C.pink, fontSize: it.size + 'px' });
      board.appendChild(el);
      updaters.push((T) => {
        const p = prog(T, it.t, 0.25);
        el.style.opacity = p > 0 ? 1 : 0;
        el.style.transform = `rotate(${it.rot || -8}deg) scale(${1.8 - 0.8 * ease(p)})`;
      });
    }
  }

  function addPath(it) {
    const parts = Array.isArray(it.d) ? it.d : [it.d];
    let t = it.t;
    const each = (it.dur ?? 0.5) / parts.length;
    for (const d of parts) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', it.color || C.white);
      p.setAttribute('stroke-width', it.width || 5);
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      ink.appendChild(p);
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len} ${len}`;
      const t0 = t;
      strokes.push({ t0, t1: t0 + each, kind: 'path', at: (q) => { const pt = p.getPointAtLength(len * q); return [pt.x, pt.y]; } });
      updaters.push((T) => {
        const q = prog(T, t0, each);
        p.style.strokeDashoffset = len * (1 - q);
        p.style.visibility = q > 0 ? 'visible' : 'hidden';
      });
      t += each + 0.04;
    }
  }

  strokes.sort((a, b) => a.t0 - b.t0);
  window.STROKES = strokes.map((s) => [s.t0, s.t1, s.kind]);

  function camAt(T) {
    const k = scene.camera;
    let cur = k[0];
    for (let i = 0; i < k.length; i++) {
      if (T >= k[i].t) cur = k[i];
      const nx = k[i + 1];
      if (nx && T >= k[i].t && T < nx.t) {
        const mv = nx.move ?? 1.0;
        const q = ease(clamp((T - (nx.t - mv)) / mv, 0, 1));
        return { y: lerp(k[i].y, nx.y, q), zoom: lerp(k[i].zoom ?? 1, nx.zoom ?? 1, q) };
      }
    }
    return { y: cur.y, zoom: cur.zoom ?? 1 };
  }

  // Qo'l: chizayotganda ruchka uchi chiziqda; oraliqda keyingi joyga suriladi yoki ekrandan chiqadi.
  const REST = [W + 260, H + 300];
  function handBoardPos(T) {
    for (const s of strokes) if (T >= s.t0 && T <= s.t1) return { p: s.at(prog(T, s.t0, s.t1 - s.t0)), on: true };
    let prev = null;
    let next = null;
    for (const s of strokes) {
      if (s.t1 < T) prev = s;
      else if (s.t0 > T) { next = s; break; }
    }
    return { prev, next };
  }

  window.renderAt = (frame) => {
    const T = frame / FPS;
    for (const u of updaters) u(T);
    const cam = camAt(T);
    const z = cam.zoom;
    board.style.transform = `translate(${W / 2}px, ${H / 2}px) scale(${z}) translate(${-W / 2}px, ${-(cam.y + H / 2)}px)`;
    const toScreen = ([bx, by]) => [(bx - W / 2) * z + W / 2, (by - (cam.y + H / 2)) * z + H / 2];
    let sp;
    const hp = handBoardPos(T);
    if (hp.on) sp = toScreen(hp.p);
    else {
      const { prev, next } = hp;
      const a = prev ? toScreen(prev.at(1)) : REST;
      const b = next ? toScreen(next.at(0)) : REST;
      const gap = (next ? next.t0 : Infinity) - (prev ? prev.t1 : -Infinity);
      if (gap < 1.1) {
        const q = ease(clamp((T - prev.t1) / gap, 0, 1));
        sp = [lerp(a[0], b[0], q), lerp(a[1], b[1], q) - Math.sin(q * Math.PI) * 40];
      } else {
        const out = prev ? ease(clamp((T - prev.t1) / 0.45, 0, 1)) : 1;
        const inn = next ? ease(clamp((next.t0 - T) / 0.45, 0, 1)) : 1;
        if (next && next.t0 - T < 0.45) sp = [lerp(b[0], REST[0], inn), lerp(b[1], REST[1], inn)];
        else sp = [lerp(a[0], REST[0], out), lerp(a[1], REST[1], out)];
      }
    }
    hand.style.transform = `translate(${sp[0] - HAND_TIP}px, ${sp[1] - HAND_TIP}px)`;
    const f = scene.fade || [];
    let fo = 0;
    for (const [t0, t1, a0, a1] of f) if (T >= t0 && T <= t1) fo = lerp(a0, a1, (T - t0) / (t1 - t0));
    fade.style.opacity = fo;
    return T;
  };
  window.TOTAL_FRAMES = Math.ceil(scene.duration * FPS);
  window.ready = true;
}
