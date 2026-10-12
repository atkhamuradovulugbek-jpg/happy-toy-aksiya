// Primitivlardan yig'ilgan stilizatsiyalangan 3D personaj.
// Lokal koordinata: personaj +Z tomonga qaraydi, oyoq ostida y = 0.
import * as THREE from 'three';

const std = (color, o = {}) => {
  const { roughness = 0.75, metalness, ...rest } = o;
  return new THREE.MeshPhongMaterial({ color, shininess: Math.round(4 + (1 - roughness) * 60), specular: 0x1a1a1a, ...rest });
};

function mesh(geo, mat, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

const UP = new THREE.Vector3(0, -1, 0);
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;


// Bitta silliq bosh shakli: sferani deformatsiya qilamiz (jag', yonoq, ko'z chuqurchasi).
function makeHeadGeometry(stocky) {
  const R = 0.105;
  const g = new THREE.SphereGeometry(R, 72, 56);
  const pos = g.attributes.position;
  const dir = new Float32Array(pos.count * 3);
  const gauss = (d2, s) => Math.exp(-d2 / (2 * s * s));
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / R;
    const v = pos.getY(i) / R;
    const w = pos.getZ(i) / R;
    dir[i * 3] = u;
    dir[i * 3 + 1] = v;
    dir[i * 3 + 2] = w;
    let x = u * 0.9;
    let y = v * 1.1;
    let z = w * 0.99;
    if (v < 0) {
      const k = Math.pow(-v, 1.5);
      x *= 1 - (stocky ? 0.16 : 0.24) * k;
      z *= 1 - 0.1 * k * (w < 0 ? 1.6 : 0.4);
    }
    x *= 1 + (stocky ? 0.05 : 0.03) * gauss((v + 0.12) ** 2, 0.18);
    if (w > 0) {
      // ko'z chuqurchasi va qosh suyagi
      for (const su of [0.34, -0.34]) {
        z -= 0.045 * gauss((u - su) ** 2 + (v - 0.1) ** 2, 0.11) * w;
      }
      z += 0.025 * gauss((v - 0.36) ** 2, 0.08) * gauss(u * u, 0.4) * w;
      // iyak oldinga
      z += 0.035 * gauss((v + 0.78) ** 2, 0.12) * gauss(u * u, 0.25) * w;
      // og'iz atrofi
      z += 0.02 * gauss((v + 0.5) ** 2, 0.12) * gauss(u * u, 0.25) * w;
    }
    pos.setXYZ(i, x * R, y * R, z * R);
  }
  g.setAttribute('dir', new THREE.BufferAttribute(dir, 3));
  g.computeVertexNormals();
  return g;
}

// Soch qobig'i: bosh geometriyasini biroz kattalashtirib, faqat soch o'sadigan qismini qoldiramiz.
function makeHairGeometry(headGeo, o) {
  const src = headGeo.toNonIndexed();
  const pos = src.attributes.position;
  const nrm = src.attributes.normal;
  const dir = src.attributes.dir;
  const front = o.hairFront ?? 0.62;
  const out = [];
  const cols = [];
  const base = new THREE.Color(o.hair);
  const grey = new THREE.Color(o.hairGrey || o.hair);
  const tmp = new THREE.Color();
  const hairAmt = (u, v, w) => {
    const au = Math.abs(u);
    const frontY = front + 0.12 * au * au + (o.receding ? 0.1 * Math.max(0, au - 0.15) : 0);
    const sideY = 0.16 * smoothstepJS(-0.55, -0.25, w) + -0.62 * (1 - smoothstepJS(-0.55, -0.25, w));
    const blend = smoothstepJS(0.1, 0.65, w);
    const lim = sideY * (1 - blend) + frontY * blend;
    let a = smoothstepJS(lim - 0.04, lim + 0.04, v);
    // quloq atrofi ochiq
    const ear = smoothstepJS(0.72, 0.86, au) * smoothstepJS(0.2, 0.08, v) * smoothstepJS(-0.5, -0.35, v) * smoothstepJS(-0.5, -0.32, w) * smoothstepJS(0.4, 0.25, w);
    a *= 1 - ear;
    return a;
  };
  for (let t = 0; t < pos.count; t += 3) {
    let any = false;
    const amts = [0, 1, 2].map((k) => hairAmt(dir.getX(t + k), dir.getY(t + k), dir.getZ(t + k)));
    for (const a of amts) if (a > 0.01) any = true;
    if (!any) continue;
    for (let k = 0; k < 3; k++) {
      const i = t + k;
      const u = dir.getX(i);
      const v = dir.getY(i);
      const w = dir.getZ(i);
      let th = 0.0045 + 0.007 * Math.max(0, v);
      if (o.quiff) th += 0.014 * smoothstepJS(0.35, 0.8, v) * smoothstepJS(-0.1, 0.6, w);
      th = th * amts[k] - 0.006 * (1 - amts[k]);
      out.push(pos.getX(i) + nrm.getX(i) * th, pos.getY(i) + nrm.getY(i) * th, pos.getZ(i) + nrm.getZ(i) * th);
      const g = o.hairGrey ? smoothstepJS(0.45, 0.15, v) * smoothstepJS(0.45, 0.85, Math.abs(u)) * 0.85 : 0;
      tmp.copy(base).lerp(grey, g);
      cols.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}
function lowLimit(w) {
  return w > 0 ? 0.2 : -0.6;
}
function smoothstepJS(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export class Character {
  constructor(o) {
    this.o = o;
    this.root = new THREE.Group();
    const skin = std(o.skin, { roughness: 0.55 });
    const hairM = std(o.hair, { roughness: 0.9 });
    const greyM = std(o.hairGrey || o.hair, { roughness: 0.9 });
    const shirt = std(o.shirt, { roughness: 0.85 });
    const shirtDark = std(o.shirtDark, { roughness: 0.85 });
    const pants = std(o.pants, { roughness: 0.9 });
    const shoes = std(o.shoes, { roughness: 0.5 });
    const lip = std(o.lip, { roughness: 0.5 });
    this.mats = { skin, hairM, shirt, pants };
    const stocky = o.build === 'stocky';

    // --- Son-suyak va oyoqlar ---
    this.hips = new THREE.Group();
    this.hips.position.y = 0.93;
    this.root.add(this.hips);
    const pelvis = mesh(new THREE.SphereGeometry(0.16, 24, 16), pants);
    pelvis.scale.set(stocky ? 1.12 : 1.0, 0.62, 0.72);
    pelvis.position.y = 0.0;
    this.hips.add(pelvis);
    const belt = mesh(new THREE.TorusGeometry(0.152, 0.018, 8, 32), std(o.belt || 0x2a1d14, { roughness: 0.5 }));
    belt.rotation.x = Math.PI / 2;
    belt.scale.set(stocky ? 1.13 : 1.0, 0.74, 1);
    belt.position.y = 0.06;
    this.hips.add(belt);

    this.legs = [];
    for (const side of [1, -1]) {
      const leg = new THREE.Group();
      leg.position.set(0.09 * side, -0.02, 0);
      const thigh = mesh(new THREE.CapsuleGeometry(stocky ? 0.074 : 0.068, 0.34, 6, 16), pants);
      thigh.position.y = -0.21;
      leg.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.43;
      leg.add(knee);
      const shin = mesh(new THREE.CapsuleGeometry(0.056, 0.33, 6, 16), pants);
      shin.position.y = -0.2;
      knee.add(shin);
      const foot = mesh(new THREE.BoxGeometry(0.1, 0.07, 0.26, 2, 2, 2), shoes);
      foot.position.set(0, -0.43, 0.05);
      knee.add(foot);
      this.hips.add(leg);
      this.legs.push({ leg, knee });
    }

    // --- Tana ---
    this.spine = new THREE.Group();
    this.spine.position.y = 0.04;
    this.hips.add(this.spine);
    const prof = stocky
      ? [[0.0, 0], [0.15, 0.0], [0.168, 0.06], [0.178, 0.16], [0.176, 0.28], [0.185, 0.4], [0.19, 0.47], [0.165, 0.53], [0.095, 0.572], [0.05, 0.585]]
      : [[0.0, 0], [0.138, 0.0], [0.148, 0.06], [0.145, 0.18], [0.158, 0.3], [0.178, 0.42], [0.184, 0.48], [0.158, 0.535], [0.09, 0.574], [0.05, 0.585]];
    const torsoGeo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 40);
    const torso = mesh(torsoGeo, shirt);
    torso.scale.set(1.06, 1, stocky ? 0.72 : 0.62);
    this.spine.add(torso);
    this.torso = torso;

    // Yoqa va tugmalar
    if (o.collar === 'polo') {
      const collar = mesh(new THREE.TorusGeometry(0.064, 0.011, 8, 32), shirtDark);
      collar.rotation.x = Math.PI / 2 - 0.25;
      collar.position.set(0, 0.565, 0.012);
      collar.scale.set(1.15, 1.0, 1);
      this.spine.add(collar);
      const placket = mesh(new THREE.BoxGeometry(0.03, 0.1, 0.006), shirtDark, false);
      placket.position.set(0, 0.49, 0.113);
      placket.rotation.x = -0.32;
      this.spine.add(placket);
      for (const y of [0.515, 0.475]) {
        const b = mesh(new THREE.SphereGeometry(0.0055, 8, 6), std(0xf2f2f2), false);
        b.position.set(0, y, 0.12 + (0.515 - y) * 0.33);
        this.spine.add(b);
      }
      // Ko'krakdagi kichik logotip
      const logo = mesh(new THREE.CircleGeometry(0.016, 20), std(0xffffff, { roughness: 0.6 }), false);
      logo.position.set(0.085, 0.43, 0.118);
      logo.rotation.x = -0.12;
      logo.rotation.y = 0.32;
      this.spine.add(logo);
    } else {
      for (const s of [1, -1]) {
        const flap = mesh(new THREE.BoxGeometry(0.06, 0.05, 0.008), shirt);
        flap.position.set(0.035 * s, 0.548, 0.07);
        flap.rotation.set(-0.7, 0.5 * s, 0.55 * s);
        this.spine.add(flap);
      }
      const btnM = std(0xd9d2c3);
      for (let i = 0; i < 4; i++) {
        const b = mesh(new THREE.SphereGeometry(0.005, 8, 6), btnM, false);
        const y = 0.5 - i * 0.1;
        b.position.set(0, y, (stocky ? 0.132 : 0.115) + (y < 0.3 ? 0.008 : 0));
        this.spine.add(b);
      }
      // Cho'ntak va ruchka
      const pocket = mesh(new THREE.BoxGeometry(0.07, 0.075, 0.004), shirtDark, false);
      pocket.position.set(0.085, 0.41, 0.126);
      pocket.rotation.y = 0.33;
      pocket.rotation.x = -0.1;
      this.spine.add(pocket);
      const pen = mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.07, 8), std(0x1d4fb8, { roughness: 0.3 }), false);
      pen.position.set(0.075, 0.445, 0.131);
      this.spine.add(pen);
    }
    if (o.badge) {
      const strap = mesh(new THREE.TorusGeometry(0.1, 0.0045, 6, 32, Math.PI), std(0x173a7a), false);
      strap.rotation.set(-0.35, 0, Math.PI);
      strap.position.set(0, 0.51, 0.06);
      strap.scale.set(0.62, 1.45, 1);
      this.spine.add(strap);
      const card = mesh(new THREE.BoxGeometry(0.052, 0.072, 0.003), std(0xffffff, { roughness: 0.4 }), false);
      card.position.set(0, 0.36, 0.122);
      card.rotation.x = -0.05;
      this.spine.add(card);
      const stripe = mesh(new THREE.PlaneGeometry(0.05, 0.016), std(0x2a6fdb), false);
      stripe.position.set(0, 0.385, 0.1237);
      this.spine.add(stripe);
    }

    // --- Qo'llar ---
    this.arms = {};
    for (const [name, side] of [['L', 1], ['R', -1]]) {
      const sh = new THREE.Group();
      sh.position.set(0.182 * side, 0.495, 0);
      this.spine.add(sh);
      const cap = mesh(new THREE.SphereGeometry(stocky ? 0.058 : 0.052, 20, 14), shirt);
      sh.add(cap);
      const upper = mesh(new THREE.CapsuleGeometry(stocky ? 0.05 : 0.046, 0.2, 6, 14), o.sleeves === 'short' ? skin : shirt);
      upper.position.y = -0.14;
      sh.add(upper);
      if (o.sleeves === 'short') {
        const sleeve = mesh(new THREE.CylinderGeometry(0.06, 0.064, 0.15, 18, 1, true), shirt);
        sleeve.material = shirt.clone();
        sleeve.material.side = THREE.DoubleSide;
        sleeve.position.y = -0.07;
        sh.add(sleeve);
        const hem = mesh(new THREE.TorusGeometry(0.062, 0.007, 6, 20), shirtDark);
        hem.rotation.x = Math.PI / 2;
        hem.position.y = -0.145;
        sh.add(hem);
      }
      const elbow = new THREE.Group();
      elbow.position.y = -0.285;
      sh.add(elbow);
      const fore = mesh(new THREE.CapsuleGeometry(0.04, 0.19, 6, 14), skin);
      fore.position.y = -0.125;
      elbow.add(fore);
      if (o.sleeves === 'rolled') {
        const roll = mesh(new THREE.TorusGeometry(0.047, 0.016, 8, 20), shirt);
        roll.rotation.x = Math.PI / 2;
        roll.position.y = -0.035;
        elbow.add(roll);
        const foreSleeve = mesh(new THREE.CylinderGeometry(0.05, 0.047, 0.05, 16), shirt);
        foreSleeve.position.y = -0.005;
        elbow.add(foreSleeve);
      }
      const hand = new THREE.Group();
      hand.position.y = -0.265;
      elbow.add(hand);
      const palm = mesh(new THREE.SphereGeometry(0.045, 16, 12), skin);
      palm.scale.set(0.95, 1.1, 0.5);
      palm.position.y = -0.035;
      hand.add(palm);
      const fingers = mesh(new THREE.CapsuleGeometry(0.03, 0.035, 4, 10), skin);
      fingers.scale.set(1.35, 1, 0.55);
      fingers.position.set(0, -0.085, 0.004);
      hand.add(fingers);
      const thumb = mesh(new THREE.CapsuleGeometry(0.011, 0.035, 4, 8), skin);
      thumb.position.set(0.035 * side, -0.04, 0.018);
      thumb.rotation.z = 0.6 * side;
      thumb.rotation.x = -0.3;
      hand.add(thumb);
      const index = mesh(new THREE.CapsuleGeometry(0.0095, 0.06, 4, 8), skin);
      index.position.set(-0.012 * side, -0.115, 0.006);
      index.visible = false;
      hand.add(index);
      this.arms[name] = { sh, elbow, hand, fingers, index, side };
    }

    // --- Bo'yin va bosh ---
    this.neck = new THREE.Group();
    this.neck.position.y = 0.56;
    this.spine.add(this.neck);
    const neckM = mesh(new THREE.CylinderGeometry(0.048, 0.054, 0.12, 16), skin);
    neckM.position.y = 0.04;
    this.neck.add(neckM);
    this.head = new THREE.Group();
    this.head.position.y = 0.13;
    this.head.rotation.order = 'YXZ';
    this.neck.add(this.head);
    const H = this.head;
    const headGeo = makeHeadGeometry(stocky);
    const skull = mesh(headGeo, skin);
    H.add(skull);
    // Yuz yuzasining chuqurligi (z) — detallarni teriga aniq joylash uchun
    const ray = new THREE.Raycaster();
    const probe = new THREE.Mesh(headGeo);
    probe.updateMatrixWorld(true);
    const surf = (x, y) => {
      ray.set(new THREE.Vector3(x, y, 0.5), new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObject(probe)[0];
      return hit ? hit.point.z : 0.09;
    };
    const side = (y, z) => {
      ray.set(new THREE.Vector3(0.5, y, z), new THREE.Vector3(-1, 0, 0));
      const hit = ray.intersectObject(probe)[0];
      return hit ? hit.point.x : 0.095;
    };
    for (const s of [1, -1]) {
      const ear = mesh(new THREE.SphereGeometry(0.03, 16, 12), skin);
      ear.scale.set(0.38, 0.82, 0.6);
      ear.position.set((side(-0.012, -0.008) + 0.004) * s, -0.012, -0.008);
      ear.rotation.y = -0.25 * s;
      H.add(ear);
    }
    const nose = mesh(new THREE.SphereGeometry(0.0138, 18, 14), skin);
    nose.scale.set(1.0, 0.9, 0.95);
    nose.position.set(0, -0.026, surf(0, -0.026) + 0.004);
    H.add(nose);
    const bridge = mesh(new THREE.CapsuleGeometry(0.0078, 0.034, 4, 10), skin);
    bridge.position.set(0, -0.004, surf(0, -0.004) - 0.002);
    bridge.rotation.x = -0.28;
    H.add(bridge);
    for (const s of [1, -1]) {
      const wing = mesh(new THREE.SphereGeometry(0.0068, 12, 10), skin);
      wing.position.set(0.0105 * s, -0.03, surf(0.0105, -0.03) - 0.001);
      H.add(wing);
    }

    // Ko'zlar
    this.eyes = [];
    const white = std(0xf6f3ee, { roughness: 0.25 });
    const irisM = std(o.iris || 0x3a2414, { roughness: 0.25 });
    const pupilM = std(0x0b0806, { roughness: 0.2 });
    const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lidM = std(o.lidColor || o.skin, { roughness: 0.6 });
    const ER = 0.0158;
    for (const s of [1, -1]) {
      const eg = new THREE.Group();
      const ex = 0.034 * s;
      const ey = 0.01;
      eg.position.set(ex, ey, surf(ex, ey) - ER * 0.62);
      H.add(eg);
      const ball = mesh(new THREE.SphereGeometry(ER, 24, 16), white, false);
      ball.scale.set(1.05, 0.92, 1);
      eg.add(ball);
      const look = new THREE.Group();
      eg.add(look);
      const iris = mesh(new THREE.SphereGeometry(ER * 0.7, 20, 12, 0, Math.PI * 2, 0, 0.85), irisM, false);
      iris.rotation.x = Math.PI / 2;
      iris.position.z = ER * 0.36;
      look.add(iris);
      const pupil = mesh(new THREE.CircleGeometry(ER * 0.3, 16), pupilM, false);
      pupil.position.z = ER * 1.012;
      look.add(pupil);
      const gl = new THREE.Mesh(new THREE.CircleGeometry(ER * 0.11, 8), glint);
      gl.position.set(ER * 0.22, ER * 0.24, ER * 1.02);
      look.add(gl);
      const lid = mesh(new THREE.SphereGeometry(ER * 1.07, 24, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), lidM, false);
      lid.scale.set(1.05, 1, 1);
      eg.add(lid);
      const lash = mesh(new THREE.TorusGeometry(ER * 1.06, 0.0011, 4, 24, Math.PI), std(0x1a1410), false);
      lash.rotation.set(0, 0, 0);
      lid.add(lash);
      lash.rotation.x = Math.PI / 2;
      lash.rotation.z = Math.PI;
      const lidLow = mesh(new THREE.SphereGeometry(ER * 1.05, 24, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), lidM, false);
      lidLow.rotation.x = 0.5;
      eg.add(lidLow);
      const brow = mesh(new THREE.CapsuleGeometry(o.browThick || 0.0042, 0.026, 4, 8), std(o.brow || o.hair, { roughness: 0.95 }), false);
      brow.rotation.z = Math.PI / 2;
      brow.scale.set(1, 1, 0.7);
      const bx = 0.035 * s;
      brow.position.set(bx, 0.038, surf(bx, 0.038) + 0.002);
      H.add(brow);
      this.eyes.push({ eg, look, lid, brow, side: s, by: 0.038 });
    }

    // Og'iz
    this.mouth = new THREE.Group();
    this.mouth.position.set(0, -0.058, surf(0, -0.058) - 0.002);
    H.add(this.mouth);
    const inner = mesh(new THREE.SphereGeometry(0.018, 20, 12), std(0x3a1212, { roughness: 0.9 }), false);
    inner.scale.set(1.0, 0.08, 0.45);
    this.mouth.add(inner);
    this.mouthInner = inner;
    const teeth = mesh(new THREE.BoxGeometry(0.022, 0.005, 0.004), std(0xefebe2, { roughness: 0.4 }), false);
    teeth.position.set(0, 0.002, 0.005);
    this.mouth.add(teeth);
    this.teeth = teeth;
    const upperLip = mesh(new THREE.CapsuleGeometry(0.0038, 0.024, 4, 10), lip, false);
    upperLip.rotation.z = Math.PI / 2;
    upperLip.scale.set(1, 1, 0.7);
    upperLip.position.set(0, 0.0035, 0.004);
    this.mouth.add(upperLip);
    const lowerLip = mesh(new THREE.CapsuleGeometry(0.0046, 0.02, 4, 10), lip, false);
    lowerLip.rotation.z = Math.PI / 2;
    lowerLip.scale.set(1, 1, 0.75);
    lowerLip.position.set(0, -0.004, 0.004);
    this.mouth.add(lowerLip);
    this.lowerLip = lowerLip;
    this.upperLip = upperLip;

    if (o.mustache) {
      const mm = std(o.mustache, { roughness: 0.95 });
      const z = surf(0, -0.044) + 0.003;
      const mid = mesh(new THREE.CapsuleGeometry(0.006, 0.03, 4, 10), mm, false);
      mid.rotation.z = Math.PI / 2;
      mid.scale.set(1, 1, 0.75);
      mid.position.set(0, -0.045, z);
      H.add(mid);
      for (const s of [1, -1]) {
        const end = mesh(new THREE.CapsuleGeometry(0.0052, 0.014, 4, 8), mm, false);
        end.position.set(0.022 * s, -0.051, z - 0.004);
        end.rotation.z = 0.9 * s;
        end.scale.set(1, 1, 0.75);
        H.add(end);
      }
    }

    // Soch: bosh shaklidan olingan qobiq
    const hair = mesh(makeHairGeometry(headGeo, o), std(0xffffff, { roughness: 0.92, vertexColors: true, side: THREE.DoubleSide }));
    H.add(hair);

    // Planshet (faqat agentda)
    if (o.tablet) {
      this.tablet = new THREE.Group();
      const body = mesh(new THREE.BoxGeometry(0.25, 0.175, 0.01), std(0x1b1d22, { roughness: 0.35 }));
      this.tablet.add(body);
      this.tabletCanvas = document.createElement('canvas');
      this.tabletCanvas.width = 1000;
      this.tabletCanvas.height = 680;
      this.tabletTex = new THREE.CanvasTexture(this.tabletCanvas);
      this.tabletTex.colorSpace = THREE.SRGBColorSpace;
      this.tabletTex.anisotropy = 4;
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.234, 0.159), new THREE.MeshBasicMaterial({ map: this.tabletTex, toneMapped: false }));
      screen.position.z = 0.0052;
      this.tablet.add(screen);
      this.spine.add(this.tablet);
    }

    this.root.traverse((m) => {
      if (m.isMesh) m.frustumCulled = false;
    });
  }

  // Ikki bo'g'imli IK: bilakni nishon nuqtaga yetkazadi (tirsak pastga-tashqariga qaraydi).
  solveIK(a, target, w) {
    const L1 = 0.285;
    const L2 = 0.265;
    const T = this.spine.worldToLocal(tmpV.copy(target)).sub(a.sh.position);
    const d = clamp(T.length(), 0.12, L1 + L2 - 0.002);
    const tn = T.normalize();
    const A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const bend = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    const pole = new THREE.Vector3(a.side * 0.55, -1, -0.45);
    pole.sub(tn.clone().multiplyScalar(pole.dot(tn))).normalize();
    const u = tn.clone().multiplyScalar(Math.cos(A)).add(pole.multiplyScalar(Math.sin(A)));
    const f = tn.clone().multiplyScalar(d).sub(u.clone().multiplyScalar(L1)).normalize();
    const y = u.clone().negate();
    const z = f.sub(u.clone().multiplyScalar(f.dot(u))).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    tmpQ.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    a.sh.quaternion.slerp(tmpQ, w);
    a.elbow.rotation.x = lerp(a.elbow.rotation.x, -bend, w);
  }

  // Pozani qo'llash. p — oddiy obyekt (main.js dagi base())
  apply(p, world) {
    const r = this.root;
    r.position.set(p.x, 0, p.z);
    r.rotation.y = p.yaw;
    r.visible = p.visible !== false;
    const walk = p.walk || 0;
    const ph = p.walkPhase || 0;
    this.hips.position.y = 0.93 + Math.abs(Math.sin(ph)) * 0.025 * walk + (p.breath || 0) * 0.002;
    this.legs[0].leg.rotation.x = Math.sin(ph) * 0.45 * walk;
    this.legs[1].leg.rotation.x = -Math.sin(ph) * 0.45 * walk;
    this.legs[0].knee.rotation.x = Math.max(0, -Math.sin(ph + 0.6)) * 0.7 * walk;
    this.legs[1].knee.rotation.x = Math.max(0, Math.sin(ph + 0.6)) * 0.7 * walk;

    this.spine.rotation.set(p.lean || 0, p.twist || 0, p.side || 0);
    this.neck.rotation.set((p.lean || 0) * -0.4, 0, 0);
    this.root.updateMatrixWorld(true);

    // Planshet: tanaga nisbatan joy, ekran tomoni — tomoshabinga
    if (this.tablet) {
      const vis = p.tablet !== false && !!p.tabPos;
      this.tablet.visible = vis;
      if (vis) {
        this.tablet.position.copy(p.tabPos);
        this.tablet.updateMatrixWorld(true);
        this.tablet.lookAt(p.tabFace);
        this.tablet.updateMatrixWorld(true);
      }
    }

    for (const name of ['L', 'R']) {
      const a = this.arms[name];
      const ap = p['arm' + name];
      const s = a.side;
      tmpE.set(-ap.fwd, ap.twist * s || 0, (ap.out || 0) * s, 'XYZ');
      a.sh.quaternion.setFromEuler(tmpE);
      a.elbow.rotation.set(-ap.bend, 0, 0);
      const aim = p['aim' + name];
      if (aim && p['aim' + name + 'W'] > 0) {
        const local = this.spine.worldToLocal(tmpV.copy(aim)).sub(a.sh.position).normalize();
        tmpQ.setFromUnitVectors(UP, local);
        a.sh.quaternion.slerp(tmpQ, p['aim' + name + 'W']);
      }
      let ik = p['ik' + name];
      let ikW = p['ik' + name + 'W'] || 0;
      let pointing = (ap.point || 0) > 0.5;
      if (this.tablet && this.tablet.visible) {
        const shW = a.sh.getWorldPosition(new THREE.Vector3());
        if (name === 'L' && (p.gripL || 0) > 0) {
          const e1 = this.tablet.localToWorld(new THREE.Vector3(0.118, -0.035, -0.006));
          const e2 = this.tablet.localToWorld(new THREE.Vector3(-0.118, -0.035, -0.006));
          const edge = e1.distanceTo(shW) < e2.distanceTo(shW) ? e1 : e2;
          ik = edge.add(shW.sub(edge).normalize().multiplyScalar(0.075));
          ikW = p.gripL;
        }
        if (name === 'R' && (p.tapR || 0) > 0) {
          const tap = this.tablet.localToWorld(new THREE.Vector3(p.tapX || 0.03, p.tapY || 0, 0.012 + (p.tapLift || 0)));
          ik = tap.add(shW.sub(tap).normalize().multiplyScalar(0.165));
          ikW = p.tapR;
          pointing = p.tapR > 0.4;
        }
      }
      if (ik && ikW > 0) this.solveIK(a, ik, ikW);
      a.hand.rotation.set(ap.wrist || 0, ap.wristY || 0, (ap.wristZ || 0) * s);
      a.index.visible = pointing;
      a.fingers.scale.y = pointing ? 0.55 : 1;
      a.fingers.position.y = pointing ? -0.07 : -0.085;
    }

    // Bosh qarashi
    this.root.updateMatrixWorld(true);
    let yaw = 0;
    let pitch = 0;
    if (p.look) {
      const lt = this.neck.worldToLocal(tmpV.copy(p.look));
      lt.y -= this.head.position.y;
      yaw = Math.atan2(lt.x, lt.z);
      pitch = -Math.atan2(lt.y, Math.hypot(lt.x, lt.z));
      yaw = clamp(yaw, -1.2, 1.2) * (p.lookW ?? 1);
      pitch = clamp(pitch, -0.7, 0.6) * (p.lookW ?? 1);
    }
    this.head.rotation.set(pitch + (p.headPitch || 0), yaw + (p.headYaw || 0), p.headRoll || 0);
    this.root.updateMatrixWorld(true);

    // Ko'z qorachig'i
    let ey = 0;
    let ex = 0;
    if (p.eyeLook) {
      const lt = this.head.worldToLocal(tmpV.copy(p.eyeLook));
      ey = clamp(Math.atan2(lt.x, lt.z), -0.35, 0.35);
      ex = clamp(-Math.atan2(lt.y - 0.012, Math.hypot(lt.x, lt.z)), -0.3, 0.3);
    }
    const blink = p.blink || 0;
    for (const e of this.eyes) {
      e.look.rotation.set(ex, ey, 0);
      e.lid.rotation.x = lerp(-0.42, 1.05, clamp(blink + Math.max(0, ex) * 0.5 + (p.lidDrop || 0), 0, 1));
      const bu = p.brow || 0;
      e.brow.position.y = e.by + bu * 0.006;
      e.brow.rotation.z = Math.PI / 2 + (p.browKnit || 0) * 0.25 * e.side;
    }

    // Og'iz
    const m = clamp(p.mouth || 0, 0, 1);
    this.mouthInner.scale.set(1.0 - m * 0.12, 0.08 + m * 0.62, 0.45);
    this.mouthInner.position.y = -m * 0.006;
    this.teeth.visible = m > 0.15;
    this.lowerLip.position.y = -0.005 - m * 0.013;
    const smile = p.smile || 0;
    this.upperLip.rotation.x = 0;
    this.mouth.scale.x = 1 + smile * 0.12;
    this.mouth.position.y = -0.06 + smile * 0.002;

  }
}
