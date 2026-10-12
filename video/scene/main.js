// Rejissyor: vaqt jadvali bo'yicha kamera, personajlar va matnlarni boshqaradi.
// window.renderAt(frame) — bitta kadrni chizadi (deterministik).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Character, clamp, lerp } from './character.js';
import { buildWorld } from './world.js';

const TL = await (await fetch('/build/timeline.json')).json();
const W = TL.width;
const H = TL.height;
const FPS = TL.fps;

// --- Renderer ---
const canvas = document.getElementById('gl');
const Q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.get('aa') !== '0', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
const RS = +(Q.get('scale') || 1);
renderer.setSize(Math.round(W * RS), Math.round(H * RS), false);
renderer.shadowMap.enabled = Q.get('shadows') !== '0';
renderer.shadowMap.type = Q.get('soft') === '1' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe9ece4);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 40);
const world = buildWorld(scene, { shadow: +(Q.get('shadow') || 1024), points: Q.get('points') === '1' });

// --- Personajlar ---
const agent = new Character({
  skin: 0xc8946c, hair: 0x1b1714, brow: 0x1b1714, shirt: 0x2f6fd6, shirtDark: 0x22549f, pants: 0x262b38,
  shoes: 0x1a1a1a, lip: 0xa8645a, collar: 'polo', sleeves: 'short', badge: true, tablet: true, quiff: true,
  hairFront: 0.56, build: 'slim',
});
const shop = new Character({
  skin: 0xb98762, hair: 0x2a2421, hairGrey: 0x6d6863, brow: 0x2f2925, browThick: 0.0065, shirt: 0xefe8da,
  shirtDark: 0xd9cfbd, pants: 0x3b3833, shoes: 0x3a2a1e, lip: 0x9a5a50, collar: 'shirt', sleeves: 'rolled',
  mustache: 0x34302c, hairFront: 0.66, receding: true, build: 'stocky',
});
const customer = new Character({
  skin: 0xd0a07a, hair: 0x231c18, brow: 0x231c18, shirt: 0x5d6b3c, shirtDark: 0x4a5630, pants: 0x34465e,
  shoes: 0x2b2b2b, lip: 0xab6a5e, collar: 'polo', sleeves: 'short', hairFront: 0.6, build: 'slim',
});
scene.add(agent.root, shop.root, customer.root);

const SHOP_POS = new THREE.Vector3(0.1, 0, -0.62);
const AGENT_POS = new THREE.Vector3(-0.05, 0, 0.74);
const CUST_POS = new THREE.Vector3(-0.3, 0, 0.8);
const shopHead = new THREE.Vector3(0.1, 1.63, -0.62);
const agentHead = new THREE.Vector3(-0.05, 1.65, 0.74);
const tabletShowPos = new THREE.Vector3(-0.05, 1.12, 0.2);

// --- Yordamchi funksiyalar ---
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function blinkAt(t, seed) {
  const period = 3.4 + seed * 0.37;
  const k = Math.floor((t + seed) / period);
  const ph = (t + seed) - k * period - hash(k + seed * 13) * 1.2;
  return ph > 0 && ph < 0.16 ? Math.sin((ph / 0.16) * Math.PI) : 0;
}

const events = TL.events;
const lineEvents = events.filter((e) => e.t === 'line');
const byId = Object.fromEntries(events.map((e) => [e.id, e]));
const freezeT = byId.s1_l3.end - 0.04;
const rewindTarget = byId.s1_l1.start + 0.05;

function eventIndexAt(t) {
  for (let i = 0; i < events.length; i++) if (t >= events[i].start && t < events[i].end) return i;
  return events.length - 1;
}

// Real vaqtni "dunyo vaqti"ga o'giradi (freeze va orqaga qaytish uchun).
function worldTime(t) {
  const e = events[eventIndexAt(t)];
  if (e.t === 'freeze' || e.freeze) return freezeT;
  if (e.t === 'rewind') {
    const p = (t - e.start) / (e.end - e.start);
    const k = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    return freezeT - (freezeT - rewindTarget) * k;
  }
  return t;
}

function envAt(e, t) {
  if (!e || e.t !== 'line') return 0;
  const i = Math.floor((t - e.speech_start) * FPS);
  if (i < 0 || i >= e.env.length) return 0;
  return e.env[i];
}
function activity(e, t) {
  if (!e || e.t !== 'line') return 0;
  let s = 0;
  for (let k = -6; k <= 6; k++) s += envAt(e, t + k / FPS);
  return s / 13;
}

// --- Pozalar ---
function base(pos, yaw) {
  return {
    x: pos.x, z: pos.z, yaw, visible: true, walk: 0, walkPhase: 0, lean: 0, twist: 0, side: 0,
    headYaw: 0, headPitch: 0, headRoll: 0, look: null, lookW: 1, eyeLook: null, brow: 0, browKnit: 0,
    mouth: 0, smile: 0, blink: 0, breath: 0,
    armL: { fwd: 0.06, out: 0.12, twist: 0, bend: 0.18, wrist: 0, wristY: 0, wristZ: 0, point: 0 },
    armR: { fwd: 0.06, out: 0.12, twist: 0, bend: 0.18, wrist: 0, wristY: 0, wristZ: 0, point: 0 },
    aimL: null, aimLW: 0, aimR: null, aimRW: 0, ikL: null, ikLW: 0, ikR: null, ikRW: 0,
    tablet: true, tabPos: null, tabFace: null, gripL: 0, tapR: 0, tapX: 0.03, tapY: 0, tapLift: 0,
  };
}

function holdTablet(p) {
  p.armL = { fwd: 0.42, out: 0.02, twist: -0.25, bend: 1.4, wrist: 0.0, wristY: 0, wristZ: 0.3, point: 0 };
  p.tabPos = new THREE.Vector3(0.03, 0.3, 0.27);
  p.gripL = 1;
}

function explainR(p, t, act, speed = 1, phase = 0, big = 1) {
  const s1 = Math.sin(t * 2.3 * speed + phase);
  const s2 = Math.sin(t * 3.7 * speed + phase * 1.7);
  p.armR = {
    fwd: 0.5 + 0.1 * s1 * big + act * 0.12,
    out: 0.16 + 0.05 * s2,
    twist: 0.25,
    bend: 1.15 + 0.28 * act * big + 0.08 * s2,
    wrist: -0.3 + 0.15 * s1,
    wristY: -0.9,
    wristZ: 0.1,
    point: 0,
  };
}
function explainL(p, t, act, speed = 1, phase = 0) {
  const s1 = Math.sin(t * 2.0 * speed + phase + 1.3);
  p.armL = { fwd: 0.42 + 0.08 * s1 + act * 0.1, out: 0.16, twist: 0.25, bend: 1.1 + 0.25 * act, wrist: -0.3, wristY: -0.9, wristZ: 0.1, point: 0 };
}
const COUNTER_L = new THREE.Vector3(0.34, 1.075, -0.27);
const COUNTER_R = new THREE.Vector3(-0.14, 1.075, -0.26);
const CHIN = new THREE.Vector3(0.07, 1.45, -0.44);
function handsOnCounter(p) {
  p.lean = 0.2;
  p.armL = { fwd: 0.32, out: 0.08, twist: 0.1, bend: 0.95, wrist: 0.5, wristY: 0, wristZ: 0, point: 0 };
  p.armR = { fwd: 0.32, out: 0.08, twist: 0.1, bend: 0.95, wrist: 0.5, wristY: 0, wristZ: 0, point: 0 };
  p.ikL = COUNTER_L;
  p.ikLW = 1;
  p.ikR = COUNTER_R;
  p.ikRW = 1;
}
function freeArms(p) {
  p.ikLW = 0;
  p.ikRW = 0;
}

function agentPose(action, e, t) {
  const p = base(AGENT_POS, Math.PI);
  holdTablet(p);
  p.look = shopHead;
  p.eyeLook = shopHead;
  p.blink = blinkAt(t, 1.3);
  p.breath = Math.sin(t * 1.6);
  p.lean = 0.02 + 0.01 * Math.sin(t * 0.7);
  p.armR = { fwd: 0.08, out: 0.1, twist: 0, bend: 0.25, wrist: 0, wristY: 0, wristZ: 0, point: 0 };
  const lt = t - (e ? e.start : 0);
  const speaking = e && e.t === 'line' && e.who === 'agent';
  const mouth = speaking ? envAt(e, t) : 0;
  const act = speaking ? activity(e, t) : 0;
  p.mouth = mouth;
  p.headPitch = -0.05 * mouth;
  switch (action) {
    case 'walkin': {
      const from = new THREE.Vector3(-1.25, 0, 3.05);
      const k = smooth(0.4, 3.3, lt);
      p.x = lerp(from.x, AGENT_POS.x, k);
      p.z = lerp(from.z, AGENT_POS.z, k);
      const moving = lt > 0.4 && lt < 3.3 ? 1 : 0;
      const dirYaw = Math.atan2(AGENT_POS.x - from.x, AGENT_POS.z - from.z);
      p.yaw = lerp(dirYaw, Math.PI, smooth(2.8, 3.7, lt));
      p.walk = moving * smooth(0.4, 0.8, lt) * (1 - smooth(2.9, 3.3, lt));
      p.walkPhase = k * 2.7 * 2 * Math.PI * 1.15;
      p.look = lt < 2.8 ? new THREE.Vector3(0.1, 1.5, -0.62) : shopHead;
      p.lookW = 0.6;
      p.armR.fwd = Math.sin(p.walkPhase) * 0.25 * p.walk;
      break;
    }
    case 'talk_hurry':
      p.lean = 0.12 + 0.03 * Math.sin(t * 4);
      explainR(p, t, act, 1.6, 0, 1.4);
      p.brow = 0.8;
      p.headPitch += 0.04 * Math.sin(t * 5);
      p.smile = 0.3;
      break;
    case 'listen_hurry':
      p.lean = 0.1;
      explainR(p, t, 0.2, 1.4, 0, 0.6);
      p.brow = 0.6;
      break;
    case 'talk_calm':
      explainR(p, t, act, 1, 0.5, 0.9);
      p.brow = 0.25 + 0.2 * act;
      p.headRoll = 0.04;
      p.smile = 0.15;
      break;
    case 'talk_tablet': {
      explainR(p, t, act, 0.9, 1.2, 0.8);
      const glance = Math.sin(lt * 0.9) > 0.3 ? 1 : 0;
      p.look = glance ? new THREE.Vector3(-0.05, 1.1, 0.35) : shopHead;
      p.eyeLook = p.look;
      p.brow = 0.2;
      break;
    }
    case 'listen':
      p.headRoll = 0.05;
      p.brow = 0.1;
      p.headPitch += 0.03 * Math.sin(t * 0.8);
      break;
    case 'listen_nod': {
      const nod = Math.max(0, Math.sin(lt * 2.4)) * (Math.sin(lt * 0.9) > 0 ? 1 : 0);
      p.headPitch += 0.11 * nod;
      p.headRoll = 0.04;
      p.brow = 0.15;
      break;
    }
    case 'look_shelf_big':
      p.look = world.anchors.big;
      p.eyeLook = world.anchors.big;
      p.twist = 0.15;
      break;
    case 'look_shelf_gap':
      p.look = world.anchors.gap;
      p.eyeLook = world.anchors.gap;
      break;
    case 'tablet_show': {
      const k = smooth(0.2, 1.4, lt);
      p.lean = lerp(0.02, 0.14, k);
      p.tabPos = new THREE.Vector3(0.0, lerp(0.3, 0.17, k), lerp(0.27, 0.56, k));
      p.tabFace = new THREE.Vector3(p.x, 1.92, p.z).lerp(new THREE.Vector3(shopHead.x, shopHead.y + 0.3, shopHead.z), k);
      p.tapR = smooth(1.7, 2.4, lt) * (1 - smooth(4.6, 5.4, lt));
      p.tapX = 0.05 - 0.07 * smooth(2.4, 3.6, lt);
      p.tapY = 0.02 - 0.05 * smooth(2.4, 3.6, lt);
      p.look = tabletShowPos;
      p.eyeLook = lt > 3.8 ? shopHead : tabletShowPos;
      p.smile = 0.2;
      break;
    }
    case 'tablet_write': {
      p.lean = 0.06;
      p.tabPos = new THREE.Vector3(0.0, 0.29, 0.27);
      p.tabFace = new THREE.Vector3(p.x, 1.98, p.z + 0.1);
      p.tapR = smooth(0.2, 0.8, lt);
      p.tapX = 0.06 - 0.09 * ((lt * 0.35) % 1);
      p.tapY = 0.04 - 0.035 * Math.floor((lt * 0.35) % 3);
      p.tapLift = 0.014 * Math.max(0, Math.sin(lt * 10));
      p.look = new THREE.Vector3(p.x, 1.2, p.z - 0.3);
      p.eyeLook = p.look;
      break;
    }
    case 'away':
      p.visible = false;
      break;
    case 'idle':
    default:
      p.headPitch += 0.02 * Math.sin(t * 0.6);
      p.smile = 0.1;
      break;
  }
  if (!p.tabFace) p.tabFace = new THREE.Vector3(p.x, 1.92, p.z);
  return p;
}

function shopPose(action, e, t) {
  const p = base(SHOP_POS, 0);
  p.look = agentHead;
  p.eyeLook = agentHead;
  p.blink = blinkAt(t, 0.4);
  p.breath = Math.sin(t * 1.4 + 1);
  p.tablet = false;
  handsOnCounter(p);
  p.lean = 0.12;
  const lt = t - (e ? e.start : 0);
  const speaking = e && e.t === 'line' && e.who === 'shop';
  const mouth = speaking ? envAt(e, t) : 0;
  const act = speaking ? activity(e, t) : 0;
  p.mouth = mouth;
  p.headPitch = -0.05 * mouth;
  switch (action) {
    case 'notebook':
      p.lean = 0.28;
      p.ikR = new THREE.Vector3(0.06 + 0.025 * Math.sin(t * 2.2), 1.08 + 0.004 * Math.sin(t * 9), -0.17);
      p.look = world.anchors.notebook;
      p.eyeLook = world.anchors.notebook;
      break;
    case 'notebook_talk': {
      const up = smooth(0.0, 0.7, lt);
      p.lean = lerp(0.28, 0.16, up);
      p.ikR = new THREE.Vector3(0.06, 1.08, -0.17);
      p.look = up > 0.5 ? agentHead : world.anchors.notebook;
      p.lookW = 1;
      p.headPitch += lerp(0.25, 0, up);
      p.brow = -0.2;
      p.browKnit = 0.4;
      break;
    }
    case 'listen_cold':
      p.lean = 0.05;
      p.brow = -0.35;
      p.browKnit = 0.7;
      p.headRoll = -0.03;
      break;
    case 'refuse': {
      p.lean = 0.0;
      const k = smooth(0.0, 0.35, lt);
      p.ikRW = 1 - k;
      p.armR = { fwd: lerp(0.32, 0.55, k), out: 0.1, twist: 0.1, bend: lerp(0.95, 1.55, k), wrist: lerp(0.2, -0.9, k), wristY: 0, wristZ: 0, point: 0 };
      p.headYaw = 0.12 * Math.sin(lt * 9) * (1 - smooth(0.6, 1.0, lt));
      p.brow = -0.5;
      p.browKnit = 0.9;
      break;
    }
    case 'talk_explain':
      p.lean = 0.08;
      freeArms(p);
      explainR(p, t, act, 0.9, 2.0, 1);
      explainL(p, t, act * 0.7, 0.9, 0.7);
      p.brow = 0.1 + 0.3 * act;
      p.headRoll = -0.04 * Math.sin(t * 0.7);
      break;
    case 'talk_nod': {
      p.lean = 0.1;
      const nod = Math.max(0, Math.sin(lt * 4.5)) * (1 - smooth(0.9, 1.4, lt));
      p.headPitch += 0.14 * nod;
      p.smile = 0.2;
      p.ikRW = 0;
      explainR(p, t, act * 0.6, 0.8, 0.3, 0.6);
      break;
    }
    case 'talk_think':
      p.lean = 0.06;
      p.ikR = CHIN;
      p.armR = { ...p.armR, wrist: 1.2 };
      p.headRoll = 0.06;
      p.look = new THREE.Vector3(agentHead.x + 0.4, agentHead.y + 0.25, agentHead.z);
      p.lookW = 0.7;
      p.brow = 0.2;
      break;
    case 'listen_think':
      p.lean = 0.06;
      p.ikR = CHIN;
      p.armR = { ...p.armR, wrist: 1.2 };
      p.headRoll = 0.05;
      p.brow = 0.1;
      p.browKnit = 0.3;
      break;
    case 'talk_sorry':
      p.lean = 0.06;
      freeArms(p);
      explainR(p, t, act, 0.7, 1.0, 0.8);
      explainL(p, t, act, 0.7, 0.4);
      p.brow = 0.35;
      p.browKnit = -0.4;
      p.headRoll = 0.06;
      break;
    case 'point_big': {
      const k = smooth(0.0, 0.7, lt);
      p.lean = 0.02;
      p.twist = lerp(0, -0.55, k);
      p.look = k > 0.4 ? world.anchors.big : agentHead;
      p.eyeLook = p.look;
      p.aimR = world.anchors.big;
      p.ikRW = 1 - k;
      p.aimRW = k * (1 - smooth(lt > 0 ? 2.4 : 99, 3.0, lt) * 0.6);
      p.armR = { ...p.armR, bend: 0.12, point: k };
      p.headYaw = 0;
      break;
    }
    case 'point_gap': {
      const k = smooth(0.0, 0.7, lt);
      p.lean = 0.02;
      p.twist = lerp(0, 0.55, k);
      p.look = k > 0.4 ? world.anchors.gap : agentHead;
      p.eyeLook = p.look;
      p.aimL = world.anchors.gap;
      p.ikLW = 1 - k;
      p.aimLW = k * 0.95;
      p.armL = { ...p.armL, bend: 0.12, point: k };
      break;
    }
    case 'look_tablet': {
      const k = smooth(0.4, 1.6, lt);
      p.lean = lerp(0.12, 0.3, k);
      p.look = k > 0.3 ? tabletShowPos : agentHead;
      p.eyeLook = p.look;
      p.brow = 0.2;
      break;
    }
    case 'imagine':
      p.lean = 0.05;
      freeArms(p);
      p.look = new THREE.Vector3(CUST_POS.x, 1.6, CUST_POS.z);
      p.brow = 0.2;
      p.browKnit = -0.3;
      explainR(p, t, 0.2, 0.5, 0, 0.5);
      explainL(p, t, 0.2, 0.5, 0);
      break;
    case 'listen':
      p.headRoll = -0.03;
      p.headPitch += 0.02 * Math.sin(t * 0.7);
      break;
    case 'idle':
    default:
      break;
  }
  return p;
}

function customerPose(action, e, t) {
  const p = base(CUST_POS, Math.PI);
  p.visible = action === 'leave';
  p.tablet = false;
  if (!p.visible) return p;
  const lt = t - e.start;
  p.blink = blinkAt(t, 2.1);
  p.look = world.gaps[1];
  p.eyeLook = world.gaps[1];
  p.headYaw = lt > 1.0 && lt < 2.0 ? 0.15 * Math.sin((lt - 1.0) * 8) : 0;
  p.brow = 0.3;
  p.browKnit = -0.3;
  const turn = smooth(2.0, 2.7, lt);
  const door = new THREE.Vector3(-1.25, 0, 3.15);
  const dirYaw = Math.atan2(door.x - CUST_POS.x, door.z - CUST_POS.z);
  p.yaw = lerp(Math.PI, dirYaw, turn);
  const k = smooth(2.4, 5.0, lt);
  p.x = lerp(CUST_POS.x, door.x, k);
  p.z = lerp(CUST_POS.z, door.z, k);
  p.walk = lt > 2.4 && lt < 5.0 ? smooth(2.4, 2.8, lt) : 0;
  p.walkPhase = k * 2.6 * 2 * Math.PI * 1.15;
  if (turn > 0.3) {
    p.look = null;
    p.eyeLook = null;
  }
  p.armR.fwd = Math.sin(p.walkPhase) * 0.25 * p.walk;
  p.armL.fwd = -Math.sin(p.walkPhase) * 0.25 * p.walk;
  return p;
}

function lerpPose(a, b, k) {
  if (k >= 1) return b;
  if (k <= 0) return a;
  const o = { ...b };
  for (const key of Object.keys(b)) {
    const va = a[key];
    const vb = b[key];
    if (typeof vb === 'number' && typeof va === 'number') o[key] = lerp(va, vb, k);
    else if (vb && vb.isVector3 && va && va.isVector3) o[key] = va.clone().lerp(vb, k);
    else if (!vb && va && va.isVector3) o[key] = va;
    else if (key.startsWith('arm') && va && vb) {
      o[key] = {};
      for (const f of Object.keys(vb)) o[key][f] = lerp(va[f] ?? 0, vb[f] ?? 0, k);
    }
  }
  return o;
}

function posed(fn, key, idx, wt) {
  const e = events[idx];
  const cur = fn(e[key] || 'idle', e, wt);
  if (idx === 0) return cur;
  const prevE = events[idx - 1];
  const k = smooth(0, 0.5, wt - e.start);
  if (k >= 1) return cur;
  const prev = fn(prevE[key] || 'idle', prevE, wt);
  if (prev.visible !== cur.visible) return cur;
  return lerpPose(prev, cur, k);
}

// --- Kamera planlari ---
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SHOTS = {
  walkin: { pos: V(1.45, 1.95, -1.25), tgt: V(-0.55, 1.25, 1.7), fov: 52, drift: V(-0.03, 0, 0.03) },
  cu_shop: { pos: V(-0.8, 1.68, 1.42), tgt: V(0.1, 1.46, -0.62), fov: 31, drift: V(0.01, 0, -0.025) },
  cu_agent: { pos: V(0.8, 1.68, -1.22), tgt: V(-0.05, 1.5, 0.74), fov: 31, drift: V(-0.01, 0, 0.022) },
  two: { pos: V(1.0, 2.05, 2.25), tgt: V(0.0, 1.3, -0.25), fov: 44, drift: V(-0.02, 0, -0.02) },
  wide: { pos: V(1.55, 2.25, 3.05), tgt: V(-0.1, 1.2, -0.55), fov: 55, drift: V(-0.03, -0.01, -0.04) },
  wide_slow: { pos: V(-1.3, 2.2, 2.9), tgt: V(0.15, 1.25, -0.5), fov: 52, drift: V(0.025, -0.008, -0.04) },
  shelf_big: { pos: V(0.9, 1.72, 1.25), tgt: V(0.1, 1.45, -0.62), tgt2: V(1.5, 1.4, -0.85), pan: [1.0, 2.2], fov: 50, drift: V(0, 0, -0.015) },
  shelf_gap: { pos: V(-0.9, 1.62, 1.2), tgt: V(-0.2, 1.45, -1.1), fov: 52, drift: V(0.015, 0, -0.02) },
  shelf_both: { pos: V(-1.5, 1.9, 3.3), tgt: V(0.18, 1.45, -0.32), fov: 58, drift: V(0.015, 0, -0.03) },
  imagine: { pos: V(1.05, 1.85, -1.45), tgt: V(-0.55, 1.35, 1.35), fov: 50, drift: V(-0.01, 0, 0.02) },
  tablet: { pos: V(0.5, 1.88, -0.92), tgtTablet: true, fov: 27, drift: V(0, -0.01, 0.015) },
  tablet_note: { pos: V(-0.05, 1.74, 0.6), tgtTablet: true, fov: 58, drift: V(0, -0.01, -0.012) },
  final: { pos: V(1.6, 2.3, 3.2), tgt: V(0.0, 1.3, -0.45), fov: 56, drift: V(0.02, 0.01, 0.04) },
};

function shotAt(idx) {
  const e = events[idx];
  let name = e.shot;
  let i = idx;
  if (!name) {
    // freeze/rewind: avvalgi planni ishlatamiz
    while (i > 0 && !events[i].shot) i--;
    name = events[i].shot;
  }
  let runStart = events[i].start;
  for (let j = i - 1; j >= 0 && events[j].shot === name; j--) runStart = events[j].start;
  return { name, runStart };
}

function placeCamera(idx, wt, t) {
  const { name, runStart } = shotAt(idx);
  const s = SHOTS[name] || SHOTS.wide;
  const el = Math.min(wt - runStart, 14);
  const pos = s.pos.clone().addScaledVector(s.drift, el);
  const tgt = s.tgtTablet ? agent.tablet.getWorldPosition(new THREE.Vector3()) : s.tgt.clone();
  if (s.tgt2) tgt.lerp(s.tgt2, smooth(s.pan[0], s.pan[1], wt - runStart));
  if (name === 'walkin') {
    const lt = wt - runStart;
    tgt.lerp(V(-0.05, 1.45, 0.74), smooth(1.0, 3.6, lt));
  }
  pos.x += 0.006 * Math.sin(t * 0.9);
  pos.y += 0.004 * Math.sin(t * 1.3 + 1);
  camera.position.copy(pos);
  camera.fov = s.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(tgt);
  return name;
}

// --- Planshet ekrani ---
let tabletState = '';
function drawTablet(mode, prog) {
  const key = mode + ':' + (mode === 'note' ? Math.floor(prog * 60) : '');
  if (key === tabletState) return;
  tabletState = key;
  const c = agent.tabletCanvas;
  const g = c.getContext('2d');
  const w = c.width;
  const h = c.height;
  g.fillStyle = '#f5f7fb';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#2f6fd6';
  g.fillRect(0, 0, w, 96);
  g.fillStyle = '#fff';
  g.font = '700 46px Montserrat';
  g.textBaseline = 'middle';
  const title = { home: 'Buyurtma', calc: 'Hisob-kitob', note: 'Eslatma' }[mode];
  g.fillText(title, 36, 50);
  g.font = '600 30px Montserrat';
  g.textAlign = 'right';
  g.fillText(mode === 'calc' ? 'qoralama' : '', w - 36, 52);
  g.textAlign = 'left';
  if (mode === 'home') {
    for (let i = 0; i < 5; i++) {
      const y = 130 + i * 104;
      g.fillStyle = '#ffffff';
      g.fillRect(30, y, w - 60, 86);
      g.fillStyle = ['#f2a922', '#e2453c', '#33a36b', '#3f8fdb', '#9b59b6'][i];
      g.fillRect(48, y + 16, 54, 54);
      g.fillStyle = '#c9d1de';
      g.fillRect(128, y + 22, 380 - i * 30, 16);
      g.fillRect(128, y + 50, 220, 12);
    }
  } else if (mode === 'calc') {
    const rows = [
      ['Budjet chegarasi', '300 000 so‘mgacha', '#1c7c4a'],
      ['Sotilgan miqdor', 'ko‘rib chiqamiz', '#8a94a6'],
      ['Tokchadagi qoldiq', 'ko‘rib chiqamiz', '#8a94a6'],
      ['Narx va ombor', 'tekshiramiz', '#8a94a6'],
    ];
    rows.forEach(([a, b, col], i) => {
      const y = 128 + i * 112;
      g.fillStyle = '#ffffff';
      g.fillRect(30, y, w - 60, 96);
      g.fillStyle = '#1d2433';
      g.font = '700 38px Montserrat';
      g.fillText(a, 56, y + 48);
      g.fillStyle = col;
      g.font = '600 34px Montserrat';
      g.textAlign = 'right';
      g.fillText(b, w - 56, y + 48);
      g.textAlign = 'left';
    });
    g.fillStyle = '#e4e8ef';
    g.fillRect(30, h - 104, w - 60, 80);
    g.fillStyle = '#5b6578';
    g.font = '700 34px Montserrat';
    g.textAlign = 'center';
    g.fillText('Buyurtma — faqat rozilikdan keyin', w / 2, h - 63);
    g.textAlign = 'left';
  } else if (mode === 'note') {
    const lines = ['Juma, soat 15:00 — qayta bog‘lanish', 'Bu buyurtma emas', 'Payshanbadan keyin hisobini ko‘radi'];
    const total = lines.join('').length;
    let shown = Math.floor(prog * total * 1.15);
    lines.forEach((ln, i) => {
      const y = 150 + i * 120;
      g.fillStyle = '#ffffff';
      g.fillRect(30, y - 46, w - 60, 96);
      g.fillStyle = i === 0 ? '#1d2433' : '#46536b';
      g.font = (i === 0 ? '800 ' : '600 ') + (i === 0 ? '46px' : '42px') + ' Montserrat';
      const part = ln.slice(0, Math.max(0, Math.min(ln.length, shown)));
      shown -= ln.length;
      g.fillText(part, 56, y + 2);
    });
    g.fillStyle = '#2f6fd6';
    g.fillRect(w - 250, h - 110, 210, 74);
    g.fillStyle = '#fff';
    g.font = '700 32px Montserrat';
    g.textAlign = 'center';
    g.fillText('Saqlash', w - 145, h - 72);
    g.textAlign = 'left';
  }
  agent.tabletTex.needsUpdate = true;
}

// --- Matn qatlamlari (DOM) ---
const $ = (id) => document.getElementById(id);
const ov = {
  intro: $('intro'), chip: $('chip'), spin: $('spin'), spinName: $('spinName'), card: $('card'), cardLetter: $('cardLetter'),
  cardName: $('cardName'), cardHint: $('cardHint'), sub: $('sub'), subWho: $('subWho'), subText: $('subText'),
  mistake: $('mistake'), rewind: $('rewind'), imagine: $('imagine'), insight: $('insight'), consent: $('consent'),
  flash: $('flash'), note: $('note'), final: $('final'), finalLines: [...document.querySelectorAll('#final .fl')], vignette: $('vignette'),
  labelBig: $('labelBig'), labelGap: $('labelGap'), glitch: $('glitch'), wrongChip: $('wrongChip'),
};
const pills = [...document.querySelectorAll('#spin .pill')];
const INSIGHT = {
  s2_n1: 'S · Asosiy xavotir — yangi tovar ham turib qolishi',
  s4_n1: 'I · Ta’sirni do‘konchi o‘zi aytdi',
  s5_n1: 'N · Foydani do‘konchi o‘zi aytdi',
};

function setOpacity(el, v) {
  el.style.opacity = String(clamp(v, 0, 1));
  el.style.visibility = v <= 0.001 ? 'hidden' : 'visible';
}
const fadeWin = (t, a, b, f = 0.3) => Math.min(smooth(a, a + f, t), 1 - smooth(b - f, b, t));

function sceneAt(t) {
  for (const s of TL.scenes) if (t >= s.start && t < s.end) return s;
  return TL.scenes[TL.scenes.length - 1];
}

function projectTo(v) {
  const p = v.clone().project(camera);
  return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H, p.z < 1];
}

function updateOverlays(t, idx, wt, shotName) {
  const e = events[idx];
  const sc = sceneAt(t);

  // Kirish sarlavhasi
  const intro = byId.s1_intro;
  setOpacity(ov.intro, fadeWin(t, intro.start + 0.2, intro.end + 0.2, 0.5));
  ov.intro.style.transform = `translateY(${(1 - smooth(intro.start, intro.start + 0.8, t)) * 30}px)`;

  // 1-sahna belgisi
  setOpacity(ov.wrongChip, sc.id === 1 && t > intro.end ? fadeWin(t, intro.end, byId.s1_freeze.start + 0.01, 0.3) : 0);

  // SPIN paneli
  const spinOn = sc.id >= 2 && sc.id <= 6;
  const imE = byId.s4_imagine;
  const hideSpin = 1 - fadeWin(t, imE.start, imE.end, 0.3);
  setOpacity(ov.spin, (spinOn ? (sc.id > 2 ? 1 : smooth(sc.start + 1.6, sc.start + 2.1, t)) : 0) * hideSpin);
  const order = { S: 0, P: 1, I: 2, N: 3 };
  const cur = sc.letter in order ? order[sc.letter] : sc.id === 6 ? 4 : -1;
  pills.forEach((pl, i) => {
    pl.classList.toggle('on', i === cur);
    pl.classList.toggle('done', i < cur);
  });
  ov.spinName.textContent = sc.id === 6 ? 'IMKONIYATGA MOS TAKLIF' : sc.name || '';

  // Sahna sarlavha kartasi
  if (e.t === 'title') {
    const lt = t - e.start;
    const d = e.end - e.start;
    setOpacity(ov.card, Math.min(smooth(0, 0.3, lt), 1 - smooth(d - 0.35, d, lt)));
    ov.card.style.transform = `translate(-50%,-50%) scale(${0.92 + 0.08 * smooth(0, 0.4, lt)})`;
    const special = sc.id >= 6;
    ov.card.classList.toggle('special', special);
    ov.card.classList.toggle('warn', sc.id === 7);
    ov.cardLetter.textContent = special ? (sc.id === 7 ? '!' : '₊') : sc.letter;
    ov.cardLetter.style.display = special ? 'none' : 'flex';
    if (sc.id === 7) {
      ov.cardName.innerHTML = 'BOSHQA HOLAT:<br>XARIDGA MABLAG‘ YO‘Q';
    } else if (sc.id === 6) {
      ov.cardName.innerHTML = 'BUDJET <span>+</span> TALAB<br><span>+</span> TO‘G‘RI MIQDOR';
    } else {
      ov.cardName.textContent = `${sc.letter} — ${sc.name}`;
    }
    ov.cardHint.textContent = sc.hint || '';
  } else setOpacity(ov.card, 0);

  // Subtitr
  let sub = null;
  let who = null;
  for (const le of lineEvents) {
    for (let i = 0; i < le.subs.length; i++) {
      const s = le.subs[i];
      const next = le.subs[i + 1];
      const endT = next ? next.start : Math.min(s.end + 0.35, le.end);
      if (t >= s.start - 0.06 && t < endT) {
        sub = s;
        who = le.who;
      }
    }
  }
  if (sub) {
    setOpacity(ov.sub, 1);
    const sp = TL.speakers[who];
    ov.subWho.textContent = sp.label;
    ov.subWho.style.color = sp.color;
    ov.subWho.style.setProperty('--dot', sp.color);
    if (ov.subText.textContent !== sub.text) ov.subText.textContent = sub.text;
    ov.sub.classList.toggle('narr', who === 'narr');
  } else setOpacity(ov.sub, 0);

  // Xato muhri (freeze)
  const fr = byId.s1_freeze;
  const frEnd = byId.s1_n1.end;
  const mk = t >= fr.start && t < frEnd ? 1 : 0;
  setOpacity(ov.mistake, mk ? Math.min(smooth(fr.start + 0.1, fr.start + 0.25, t), 1 - smooth(frEnd - 0.25, frEnd, t)) : 0);
  ov.mistake.style.transform = `translate(-50%,0) rotate(-5deg) scale(${1.35 - 0.35 * smooth(fr.start + 0.1, fr.start + 0.28, t)})`;

  // Orqaga qaytish
  const rw = byId.s1_rewind;
  const inRw = t >= rw.start && t < rw.end;
  setOpacity(ov.rewind, inRw ? 1 : 0);
  setOpacity(ov.glitch, inRw ? 0.9 : 0);
  if (inRw) {
    const f = Math.floor(t * FPS);
    ov.glitch.style.backgroundPosition = `0 ${(f * 37) % 400}px`;
  }

  // Tasavvur
  const im = byId.s4_imagine;
  const imOn = t >= im.start && t < im.end;
  setOpacity(ov.imagine, imOn ? fadeWin(t, im.start, im.end, 0.3) : 0);

  // Asosiy xulosa kartasi
  const ins = INSIGHT[e.id];
  if (ins && e.t === 'line') {
    setOpacity(ov.insight, fadeWin(t, e.speech_start + 0.4, e.end + 0.2, 0.35));
    ov.insight.textContent = ins;
  } else setOpacity(ov.insight, 0);

  // Rozilik banneri
  const cs = byId.s6_tablet;
  setOpacity(ov.consent, fadeWin(t, cs.start + 1.0, cs.end, 0.4));

  // Eslatma kartasi
  const nt = byId.s7_note;
  setOpacity(ov.note, fadeWin(t, nt.start + 0.6, nt.end, 0.35));

  // 7-sahna chaqnashi
  const s7 = byId.s7_title;
  setOpacity(ov.flash, t >= s7.start && t < s7.start + 0.7 ? 1 - smooth(s7.start, s7.start + 0.7, t) : 0);

  // Yakuniy ekran
  const fi = byId.s7_final;
  if (t >= fi.start) {
    setOpacity(ov.final, smooth(fi.start, fi.start + 0.8, t));
    ov.finalLines.forEach((el, i) => {
      const a = fi.start + 0.5 + i * 0.7;
      setOpacity(el, smooth(a, a + 0.4, t));
      el.style.transform = `translateY(${(1 - smooth(a, a + 0.5, t)) * 40}px)`;
    });
  } else setOpacity(ov.final, 0);

  // Javondagi yorliqlar (3D nuqtadan ekranga)
  const showBig = (e.highlight === 'big' || e.highlight === 'both') && !(e.t === 'freeze');
  const showGap = e.highlight === 'gap' || e.highlight === 'both';
  const kH = smooth(0, 0.6, wt - (e.start + 0.4));
  if (showBig) {
    const [x, y, vis] = projectTo(world.anchors.bigLabel);
    ov.labelBig.style.left = `${clamp(x, 240, W - 240)}px`;
    ov.labelBig.style.top = `${clamp(y, 340, H - 600)}px`;
    setOpacity(ov.labelBig, vis ? kH : 0);
  } else setOpacity(ov.labelBig, 0);
  if (showGap) {
    const [x, y, vis] = projectTo(world.anchors.gapLabel);
    ov.labelGap.style.left = `${clamp(x, 160, W - 160)}px`;
    ov.labelGap.style.top = `${clamp(y, 340, H - 600)}px`;
    setOpacity(ov.labelGap, vis ? kH : 0);
  } else setOpacity(ov.labelGap, 0);
  world.setHighlight(showBig ? kH : 0, showGap ? kH : 0, t);

  // Kanvas filtri
  let filter = 'none';
  if (t >= fr.start && t < frEnd) filter = `grayscale(${0.9 * smooth(fr.start, fr.start + 0.25, t)}) brightness(0.82)`;
  else if (inRw) filter = 'saturate(0.55) contrast(1.25) brightness(1.08)';
  else if (imOn) filter = `sepia(${0.5 * fadeWin(t, im.start, im.end, 0.3)}) saturate(0.85)`;
  else if (t >= fi.start) filter = `blur(${7 * smooth(fi.start, fi.start + 0.8, t)}px) brightness(${1 - 0.35 * smooth(fi.start, fi.start + 0.8, t)})`;
  canvas.style.filter = filter;
  canvas.style.transform = inRw ? `translateX(${Math.sin(t * 90) * 8}px)` : 'none';
  setOpacity(ov.vignette, imOn ? fadeWin(t, im.start, im.end, 0.3) : 0);
}

window.renderAt = (frame) => {
  const t = frame / FPS;
  const wt = worldTime(t);
  const realIdx = eventIndexAt(t);
  const idx = eventIndexAt(wt);
  const e = events[idx];
  const ap = posed(agentPose, 'agent', idx, wt);
  const sp = posed(shopPose, 'shop', idx, wt);
  const cp = customerPose(e.customer || 'none', e, wt);
  agent.apply(ap);
  shop.apply(sp);
  customer.apply(cp);
  const shotName = placeCamera(idx, wt, t);
  // Planshet ekrani
  if (e.agent === 'tablet_write') drawTablet('note', clamp((wt - e.start - 0.6) / 3.2, 0, 1));
  else if (e.id === 's6_tablet' || e.id === 's6_l3' || e.id === 's6_l4') drawTablet('calc', 0);
  else if (events[idx].scene === 7 && idx > eventIndexAt(byId.s7_note.start)) drawTablet('note', 1);
  else drawTablet('home', 0);
  updateOverlays(t, realIdx, wt, shotName);
  renderer.render(scene, camera);
  return { t, wt, id: e.id, shot: shotName };
};
window.TOTAL_FRAMES = TL.frames;
await document.fonts.ready;
window.ready = true;
