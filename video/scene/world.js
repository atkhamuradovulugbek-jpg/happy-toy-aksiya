// Oddiy o'zbek oziq-ovqat do'koni interyeri.
import * as THREE from 'three';

// Atrof-muhit uchun yengil Lambert material (dasturiy GPU da PBR juda sekin)
const std = (color, o = {}) => {
  const { roughness, metalness, ...rest } = o;
  return new THREE.MeshLambertMaterial({ color, ...rest });
};

function box(w, h, d, mat, x, y, z, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

// Oddiy deterministik tasodifiy son
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function labelTexture(kind) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    if (kind === 'pack') {
      g.fillStyle = 'rgba(255,255,255,1)';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(0, h * 0.62, w, h * 0.38);
      g.fillStyle = '#fff8e6';
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.36, w * 0.3, h * 0.2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(w * 0.25, h * 0.33, w * 0.5, h * 0.06);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(w * 0.15, h * 0.72, w * 0.7, h * 0.05);
    } else if (kind === 'big') {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let i = 0; i < 6; i++) g.fillRect(0, i * 46, w, 6);
      g.fillStyle = '#fff4dc';
      g.fillRect(w * 0.1, h * 0.28, w * 0.8, h * 0.34);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(w * 0.2, h * 0.36, w * 0.6, h * 0.07);
      g.fillRect(w * 0.3, h * 0.48, w * 0.4, h * 0.05);
      g.fillStyle = 'rgba(0,0,0,0.2)';
      g.fillRect(0, h * 0.85, w, h * 0.15);
    } else if (kind === 'bottle') {
      g.fillStyle = 'rgba(255,255,255,0.0)';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff';
      g.fillRect(0, h * 0.4, w, h * 0.3);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(0, h * 0.5, w, h * 0.06);
    } else if (kind === 'cookie') {
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(0, 0, w, h * 0.2);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = '#d9a56b';
        g.beginPath();
        g.arc(w * (0.3 + i * 0.2), h * 0.55, w * 0.12, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = 'rgba(90,50,20,0.6)';
        g.beginPath();
        g.arc(w * (0.3 + i * 0.2) + 6, h * 0.53, 6, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(w * 0.1, h * 0.25, w * 0.8, h * 0.08);
    }
  });
}

function instanced(geo, mat, items, colorFn) {
  const im = new THREE.InstancedMesh(geo, mat, items.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3(1, 1, 1);
  items.forEach((it, i) => {
    q.setFromEuler(new THREE.Euler(it.rx || 0, it.ry || 0, it.rz || 0));
    s.set(it.sx || 1, it.sy || 1, it.sz || 1);
    m4.compose(new THREE.Vector3(it.x, it.y, it.z), q, s);
    im.setMatrixAt(i, m4);
    im.setColorAt(i, new THREE.Color(colorFn ? colorFn(it, i) : it.color));
  });
  im.castShadow = false;
  im.receiveShadow = true;
  im.instanceMatrix.needsUpdate = true;
  return im;
}

export function buildWorld(scene, opts = {}) {
  const W = { anchors: {} };
  const rand = rng(7);
  const rand2 = rng(11);

  // --- Pol, devorlar, shift ---
  const floorTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#d8cbb6';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const v = 200 + ((x + y) % 2) * 10 + Math.floor(rand2() * 6);
        g.fillStyle = `rgb(${v + 16},${v + 6},${v - 12})`;
        g.fillRect(x * 128 + 2, y * 128 + 2, 124, 124);
      }
  }, [6, 6]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 7), std(0xffffff, { map: floorTex, roughness: 0.45 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0.6);
  floor.receiveShadow = true;
  scene.add(floor);

  const wallM = std(0xeef0e4, { roughness: 0.95 });
  const wallLow = std(0x6f9e8f, { roughness: 0.9 });
  const back = box(6, 3.1, 0.1, wallM, 0, 1.55, -2.0, false);
  scene.add(back);
  const left = box(0.1, 3.1, 7, wallM, -2.45, 1.55, 0.6, false);
  scene.add(left);
  const right = box(0.1, 3.1, 7, wallM, 2.45, 1.55, 0.6, false);
  scene.add(right);
  const front = box(6, 3.1, 0.1, wallM, 0, 1.55, 3.6, false);
  scene.add(front);
  // Pastki panel (devor bo'yi)
  scene.add(box(6, 0.9, 0.02, wallLow, 0, 0.45, -1.94, false));
  scene.add(box(0.02, 0.9, 7, wallLow, -2.39, 0.45, 0.6, false));
  scene.add(box(0.02, 0.9, 7, wallLow, 2.39, 0.45, 0.6, false));
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(6, 7), new THREE.MeshBasicMaterial({ color: 0xe4e1d8 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 3.05, 0.6);
  scene.add(ceil);
  const lampM = new THREE.MeshBasicMaterial({ color: 0xfffbf0 });
  for (const [x, z] of [[-0.9, -0.6], [0.9, -0.6], [-0.9, 1.6], [0.9, 1.6]]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), lampM);
    l.rotation.x = Math.PI / 2;
    l.position.set(x, 3.04, z);
    scene.add(l);
  }

  // --- Eshik va deraza (old devor) ---
  const glassDay = new THREE.MeshBasicMaterial({ color: 0xcfe6f5 });
  const frameM = std(0x3d4a52, { roughness: 0.4, metalness: 0.3 });
  const door = new THREE.Group();
  door.add(box(1.0, 2.15, 0.02, glassDay, 0, 1.075, 0, false));
  door.add(box(1.08, 0.06, 0.06, frameM, 0, 2.17, 0));
  door.add(box(0.06, 2.2, 0.06, frameM, -0.52, 1.1, 0));
  door.add(box(0.06, 2.2, 0.06, frameM, 0.52, 1.1, 0));
  door.add(box(0.03, 0.4, 0.04, frameM, 0.38, 1.05, -0.04));
  door.position.set(-1.25, 0, 3.53);
  scene.add(door);
  // Ko'cha ko'rinishi: daraxt va bino siluetlari
  const street = canvasTex(512, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#bfe0f5');
    grd.addColorStop(0.6, '#e8f3f8');
    grd.addColorStop(1, '#d9d4c6');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9c2b0';
    g.fillRect(0, h * 0.42, w * 0.45, h * 0.3);
    g.fillStyle = '#b7c9a0';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(80 + i * 100, h * 0.45, 55, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#9aa28e';
    g.fillRect(0, h * 0.72, w, h * 0.28);
  });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.3), new THREE.MeshBasicMaterial({ map: street }));
  win.position.set(0.85, 1.55, 3.54);
  win.rotation.y = Math.PI;
  scene.add(win);
  scene.add(box(1.8, 0.06, 0.08, frameM, 0.85, 2.22, 3.52));
  scene.add(box(1.8, 0.06, 0.08, frameM, 0.85, 0.88, 3.52));
  scene.add(box(0.05, 1.36, 0.08, frameM, 0.85, 1.55, 3.52));
  const doorGlass = door.children[0];
  doorGlass.material = new THREE.MeshBasicMaterial({ map: street });
  W.door = new THREE.Vector3(-1.25, 0, 3.2);

  // --- Peshtaxta ---
  const wood = std(0x9a6a43, { roughness: 0.55 });
  const woodDark = std(0x6e4a2e, { roughness: 0.6 });
  const counter = new THREE.Group();
  counter.add(box(2.3, 0.94, 0.58, woodDark, 0, 0.47, 0));
  counter.add(box(2.42, 0.06, 0.72, wood, 0, 0.97, 0));
  // Old tarafdagi panel naqshi
  const panelM = std(0x7d5536, { roughness: 0.6 });
  for (let i = 0; i < 4; i++) counter.add(box(0.48, 0.6, 0.02, panelM, -0.84 + i * 0.56, 0.48, 0.3, false));
  scene.add(counter);
  W.counterTop = 1.0;

  // Kassa apparati
  const reg = new THREE.Group();
  reg.add(box(0.32, 0.12, 0.3, std(0x2b2f36, { roughness: 0.4 }), 0, 0.06, 0));
  const scr = box(0.22, 0.14, 0.02, std(0x2b2f36), 0, 0.2, -0.05);
  scr.rotation.x = -0.3;
  reg.add(scr);
  const scrFace = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.11), new THREE.MeshBasicMaterial({ color: 0x7fd2c2 }));
  scrFace.position.set(0, 0.2, -0.038);
  scrFace.rotation.x = -0.3;
  scrFace.rotation.y = Math.PI;
  reg.add(scrFace);
  reg.position.set(0.85, 1.0, -0.08);
  reg.rotation.y = -0.3;
  scene.add(reg);

  // Hisob daftari va ruchka
  const book = new THREE.Group();
  const pageTex = canvasTex(256, 360, (g, w, h) => {
    g.fillStyle = '#fbf8ef';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a8c3e0';
    g.lineWidth = 2;
    for (let y = 30; y < h; y += 22) {
      g.beginPath();
      g.moveTo(10, y);
      g.lineTo(w - 10, y);
      g.stroke();
    }
    g.strokeStyle = '#3550a0';
    g.lineWidth = 3;
    for (let y = 52; y < h - 60; y += 22) {
      g.beginPath();
      g.moveTo(22, y - 4);
      for (let x = 22; x < 22 + 60 + ((y * 7) % 120); x += 8) g.lineTo(x, y - 4 - ((x * 3 + y) % 5));
      g.stroke();
    }
  });
  const pageM = std(0xffffff, { map: pageTex, roughness: 0.9 });
  const pageL = box(0.2, 0.012, 0.28, pageM, -0.1, 0.006, 0, false);
  const pageR = box(0.2, 0.012, 0.28, pageM, 0.1, 0.006, 0, false);
  book.add(box(0.42, 0.008, 0.3, std(0x223a6b), 0, 0.0, 0, false));
  book.add(pageL, pageR);
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.14, 8), std(0x1d4fb8, { roughness: 0.3 }));
  pen.rotation.z = Math.PI / 2;
  pen.rotation.y = 0.5;
  pen.position.set(0.12, 0.02, 0.06);
  book.add(pen);
  book.position.set(0.12, 1.003, -0.12);
  book.rotation.y = 0.08;
  scene.add(book);
  W.anchors.notebook = new THREE.Vector3(0.12, 1.0, -0.12);

  // Peshtaxta ustidagi mayda konfetlar idishi
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.08, 24, 1, true), std(0xdfeef5, { transparent: true, opacity: 0.55, roughness: 0.1 }));
  bowl.position.set(-0.75, 1.04, 0.05);
  scene.add(bowl);
  const candies = [];
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 0.085;
    candies.push({ x: -0.75 + Math.cos(a) * r, y: 1.02 + rand() * 0.05, z: 0.05 + Math.sin(a) * r, rx: rand() * 3, ry: rand() * 3, color: ['#e94b3c', '#f7b733', '#2fa86b', '#4a7fe0', '#e05fa0'][i % 5] });
  }
  scene.add(instanced(new THREE.CapsuleGeometry(0.012, 0.025, 4, 8), std(0xffffff, { roughness: 0.3 }), candies));

  // --- Orqa javon (do'konchi ortida) ---
  const shelfM = std(0xf3efe6, { roughness: 0.6 });
  const shelfEdge = std(0xd23b3b, { roughness: 0.5 });
  const SH = { x0: -1.55, x1: 1.55, z: -1.72, d: 0.42, rows: [0.18, 0.6, 1.02, 1.42, 1.82, 2.22] };
  const shelf = new THREE.Group();
  for (const y of SH.rows) {
    shelf.add(box(SH.x1 - SH.x0, 0.03, SH.d, shelfM, 0, y, 0));
    shelf.add(box(SH.x1 - SH.x0, 0.035, 0.012, shelfEdge, 0, y + 0.005, SH.d / 2 + 0.006, false));
  }
  for (const x of [SH.x0, 0, SH.x1]) shelf.add(box(0.04, 2.5, SH.d, shelfM, x, 1.25, 0));
  shelf.add(box(SH.x1 - SH.x0 + 0.04, 2.5, 0.02, std(0xe8e2d4), 0, 1.25, -SH.d / 2));
  shelf.position.set(0, 0, SH.z);
  scene.add(shelf);

  const fz = SH.z + 0.04;
  const palette = ['#e2453c', '#f2a922', '#3f8fdb', '#33a36b', '#9b59b6', '#e86aa6', '#f06d2f', '#1fa3a3'];
  // 1.42 qator — mayda shirinliklar, ayrim joylar bo'sh (tugagan)
  const small = [];
  const gapSlots = [6, 7, 11];
  const priceTags = [];
  const nSmall = 18;
  const step = (SH.x1 - SH.x0 - 0.12) / nSmall;
  W.gaps = [];
  for (let i = 0; i < nSmall; i++) {
    const x = SH.x0 + 0.1 + i * step + step / 2;
    priceTags.push({ x, y: 1.42 - 0.012, z: SH.z + SH.d / 2 + 0.014, color: '#ffffff' });
    if (gapSlots.includes(i)) {
      W.gaps.push(new THREE.Vector3(x, 1.5, SH.z + 0.05));
      continue;
    }
    for (let k = 0; k < 2; k++) small.push({ x, y: 1.435 + 0.065, z: fz - k * 0.12, ry: (rand() - 0.5) * 0.12, color: palette[i % palette.length] });
  }
  const packTex = labelTexture('pack');
  scene.add(instanced(new THREE.BoxGeometry(step * 0.82, 0.13, 0.06), std(0xffffff, { map: packTex, roughness: 0.45 }), small));
  scene.add(instanced(new THREE.PlaneGeometry(0.06, 0.028), std(0xffffff, { roughness: 0.8 }), priceTags));

  // 1.82 qator — pechenye qutilari
  const cookieTex = labelTexture('cookie');
  const cookies = [];
  for (let i = 0; i < 12; i++) {
    const x = SH.x0 + 0.17 + i * 0.255;
    cookies.push({ x, y: 1.82 + 0.085, z: fz, color: ['#f2c46d', '#e98b5d', '#c9e0f2', '#f5e1a4'][i % 4] });
  }
  scene.add(instanced(new THREE.BoxGeometry(0.22, 0.14, 0.08), std(0xffffff, { map: cookieTex, roughness: 0.5 }), cookies));

  // 2.22 qator — jele bankalari
  const jars = [];
  const lids = [];
  for (let i = 0; i < 22; i++) {
    const x = SH.x0 + 0.12 + i * 0.137;
    const c = ['#ff5a5f', '#ffb400', '#7ed957', '#a46cff', '#ff7ab6'][i % 5];
    jars.push({ x, y: 2.22 + 0.06, z: fz, color: c });
    lids.push({ x, y: 2.22 + 0.125, z: fz, color: '#f0f0f0' });
  }
  scene.add(instanced(new THREE.CylinderGeometry(0.048, 0.048, 0.1, 18), std(0xffffff, { roughness: 0.15, transparent: true, opacity: 0.92 }), jars));
  scene.add(instanced(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 18), std(0xffffff, { roughness: 0.4 }), lids));

  // 1.02 qator — shokolad plitkalari (ustma-ust)
  const bars = [];
  for (let i = 0; i < 9; i++)
    for (let k = 0; k < 4; k++) bars.push({ x: SH.x0 + 0.2 + i * 0.33, y: 1.02 + 0.03 + k * 0.038, z: fz, color: ['#5a2d1a', '#7a3a1f', '#2f5fa8', '#c0392b'][i % 4] });
  scene.add(instanced(new THREE.BoxGeometry(0.26, 0.034, 0.1), std(0xffffff, { roughness: 0.35 }), bars));

  // 0.6 va 0.18 qatorlar — pechenye rulonlari va ichimlik bloklari
  const rolls = [];
  for (let i = 0; i < 16; i++) rolls.push({ x: SH.x0 + 0.13 + i * 0.185, y: 0.6 + 0.07, z: fz, rx: Math.PI / 2, color: ['#e9c46a', '#f4a261', '#e76f51', '#2a9d8f'][i % 4] });
  scene.add(instanced(new THREE.CylinderGeometry(0.055, 0.055, 0.2, 16), std(0xffffff, { map: packTex, roughness: 0.4 }), rolls));
  const crates = [];
  for (let i = 0; i < 7; i++) crates.push({ x: SH.x0 + 0.24 + i * 0.43, y: 0.18 + 0.11, z: fz, color: ['#3a86ff', '#ff006e', '#fb5607', '#8338ec'][i % 4] });
  scene.add(instanced(new THREE.BoxGeometry(0.38, 0.2, 0.28), std(0xffffff, { map: labelTexture('big'), roughness: 0.6 }), crates));

  // --- O'ng devor: katta qadoqlar (ortiqcha zaxira) ---
  const bigShelf = new THREE.Group();
  const bx = 2.1;
  for (const y of [0.1, 0.75, 1.4, 2.05]) bigShelf.add(box(0.5, 0.035, 1.5, std(0x8f9aa3, { roughness: 0.4, metalness: 0.4 }), 0, y, 0));
  for (const z of [-0.74, 0.74]) bigShelf.add(box(0.05, 2.3, 0.05, std(0x5c656d, { metalness: 0.5, roughness: 0.4 }), -0.22, 1.15, z));
  bigShelf.position.set(bx, 0, -1.0);
  scene.add(bigShelf);
  const bigTex = labelTexture('big');
  const bigs = [];
  for (const y of [0.1, 0.75, 1.4])
    for (let k = 0; k < 4; k++)
      for (let s = 0; s < (y < 1 ? 2 : 2); s++) bigs.push({ x: bx - 0.02, y: y + 0.0175 + 0.145 + s * 0.29, z: -1.0 - 0.54 + k * 0.36, ry: -Math.PI / 2 + (rand() - 0.5) * 0.1, color: '#f08a24' });
  // Pol ustida qo'shimcha qadoqlar
  for (let s = 0; s < 3; s++) bigs.push({ x: 1.55, y: 0.145 + s * 0.29, z: -0.95, ry: -Math.PI / 2 + 0.2, color: '#f08a24' });
  for (let s = 0; s < 2; s++) bigs.push({ x: 1.5, y: 0.145 + s * 0.29, z: -0.5, ry: -Math.PI / 2 - 0.15, color: '#f08a24' });
  scene.add(instanced(new THREE.BoxGeometry(0.34, 0.28, 0.4), std(0xffffff, { map: bigTex, roughness: 0.55 }), bigs));
  W.anchors.big = new THREE.Vector3(2.05, 1.25, -1.0);
  W.anchors.bigLabel = new THREE.Vector3(2.0, 2.05, -0.8);

  // --- Chap devor: ichimliklar muzlatkichi ---
  const fridge = new THREE.Group();
  fridge.add(box(0.7, 2.0, 1.2, std(0xe9edf0, { roughness: 0.3, metalness: 0.2 }), 0, 1.0, 0));
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.6), new THREE.MeshBasicMaterial({ color: 0xe9f6ff }));
  inside.rotation.y = Math.PI / 2;
  inside.position.set(0.2, 1.05, 0);
  fridge.add(inside);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.08, 1.66), std(0xbfe3ff, { transparent: true, opacity: 0.18, roughness: 0.05 }));
  glass.rotation.y = Math.PI / 2;
  glass.position.set(0.36, 1.05, 0);
  fridge.add(glass);
  const topSign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.22), new THREE.MeshBasicMaterial({ color: 0x1f7ae0 }));
  topSign.rotation.y = Math.PI / 2;
  topSign.position.set(0.36, 1.98, 0);
  fridge.add(topSign);
  fridge.position.set(-2.05, 0, -1.0);
  scene.add(fridge);
  const bottles = [];
  for (let r = 0; r < 4; r++)
    for (let i = 0; i < 7; i++) bottles.push({ x: -1.85, y: 0.4 + r * 0.42, z: -1.45 + i * 0.15, color: ['#ff6b35', '#2ec4b6', '#e71d36', '#ffd166', '#06d6a0'][(i + r) % 5] });
  scene.add(instanced(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 14), std(0xffffff, { roughness: 0.15, transparent: true, opacity: 0.95, map: labelTexture('bottle') }), bottles));

  // --- Yoritish ---
  const hemi = new THREE.HemisphereLight(0xfff7ec, 0x8c7b66, opts.points === false ? 1.6 : 1.25);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1df, 2.1);
  key.position.set(1.8, 3.6, 2.6);
  key.target.position.set(0, 1, -0.4);
  key.castShadow = true;
  key.shadow.mapSize.set(opts.shadow || 2048, opts.shadow || 2048);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 9;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xdfeaff, 0.7);
  fill.position.set(-2, 2.2, 3);
  scene.add(fill);
  const rim = new THREE.PointLight(0xffe2b8, 6, 6, 1.6);
  rim.position.set(0, 2.7, -1.3);
  if (opts.points !== false) scene.add(rim);
  const frontLight = new THREE.PointLight(0xfff4e6, 5, 6, 1.6);
  frontLight.position.set(0, 2.6, 1.8);
  if (opts.points !== false) scene.add(frontLight);

  // --- Ta'kidlash (highlight) qatlamlari ---
  const hlBig = new THREE.Mesh(new THREE.BoxGeometry(0.62, 2.0, 1.6), new THREE.MeshBasicMaterial({ color: 0xffb547, transparent: true, opacity: 0, depthWrite: false }));
  hlBig.position.set(2.08, 1.2, -1.0);
  scene.add(hlBig);
  const hlEdges = new THREE.LineSegments(new THREE.EdgesGeometry(hlBig.geometry), new THREE.LineBasicMaterial({ color: 0xffb547, transparent: true, opacity: 0 }));
  hlEdges.position.copy(hlBig.position);
  scene.add(hlEdges);
  const gapMarks = W.gaps.map((g) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(step * 0.86, 0.15), new THREE.MeshBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(g.x, 1.505, SH.z + SH.d / 2 + 0.02);
    scene.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: 0xff4d4d, transparent: true, opacity: 0 }));
    e.position.copy(m.position);
    scene.add(e);
    return [m, e];
  });
  W.setHighlight = (big, gap, t) => {
    const pulse = 0.75 + 0.25 * Math.sin(t * 5);
    hlBig.material.opacity = 0.22 * big * pulse;
    hlEdges.material.opacity = 0.95 * big;
    for (const [m, e] of gapMarks) {
      m.material.opacity = 0.5 * gap * pulse;
      e.material.opacity = 0.95 * gap;
    }
  };
  W.anchors.gap = W.gaps[0].clone().lerp(W.gaps[1], 0.5).setZ(SH.z + 0.1);
  W.anchors.gapLabel = W.gaps[0].clone().lerp(W.gaps[1], 0.5).add(new THREE.Vector3(0, 0.03, 0.03));
  W.anchors.shelfCenter = new THREE.Vector3(0, 1.5, SH.z);
  return W;
}
