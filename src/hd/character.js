// HD agent: a jointed mannequin that can stand, walk and sit, dressed per theme
// from a "look" (data), so the same look drives every theme and the customiser.
// Faces +z. Feet on y = 0. Height ~1.8.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// ---------- the look data ----------
export const OPTIONS = {
  skin: { Mannequin: '#d9d9db', Porcelain: '#f1d9c8', Warm: '#dcb594', Olive: '#b98b62', Brown: '#8a5a3c', Deep: '#5a3a28' },
  hairStyle: ['none', 'buzz', 'short', 'curly', 'bun', 'ponytail', 'long'],
  hairColor: { Black: '#16120f', Brown: '#4a2e1c', Auburn: '#7a3420', Blonde: '#c9a35a', Grey: '#9a9a9a', White: '#e6e3dc', Blue: '#2f4fd6', Pink: '#e0569a' },
  beard: ['none', 'stubble', 'full'],
  officeTop: ['blazer', 'hoodie', 'sweater', 'cardigan', 'tee'],
  officeBottom: ['trousers', 'jeans', 'skirt'],
};
// Eight starting looks; an agent gets the one matching their place in the team
// (the HR page changes anything).
export const PRESETS = [
  { skin: '#d9d9db', hair: { style: 'short', color: '#9a9a9a' }, beard: 'stubble', glasses: true,
    office: { top: 'blazer', topColor: '#1f2a44', bottom: 'trousers', bottomColor: '#3a3d44', shoeColor: '#141414' },
    wizard: { robe: '#27234a', trim: '#b8902f', hood: true }, starship: { dept: '#b3202a' } },
  { skin: '#d9d9db', hair: { style: 'curly', color: '#4a2e1c' }, beard: 'full', glasses: false,
    office: { top: 'hoodie', topColor: '#d98a1f', bottom: 'jeans', bottomColor: '#2f4a6e', shoeColor: '#e8e6e1' },
    wizard: { robe: '#5a3518', trim: '#a8742a', hood: true }, starship: { dept: '#d9a521' } },
  { skin: '#d9d9db', hair: { style: 'buzz', color: '#16120f' }, beard: 'none', glasses: true,
    office: { top: 'sweater', topColor: '#1f6f6a', bottom: 'trousers', bottomColor: '#b9a588', shoeColor: '#5a3a24' },
    wizard: { robe: '#173a38', trim: '#9aa8a0', hood: true }, starship: { dept: '#2a8f9a' } },
  { skin: '#d9d9db', hair: { style: 'bun', color: '#7a3420' }, beard: 'none', glasses: false,
    office: { top: 'cardigan', topColor: '#c75a6e', bottom: 'skirt', bottomColor: '#1d1d22', shoeColor: '#2a1d1d' },
    wizard: { robe: '#4a1626', trim: '#b8902f', hood: false }, starship: { dept: '#7d5bd6' } },
  { skin: '#d9d9db', hair: { style: 'long', color: '#c9a35a' }, beard: 'none', glasses: false,
    office: { top: 'tee', topColor: '#6d5bd0', bottom: 'jeans', bottomColor: '#24324a', shoeColor: '#f0eee8' },
    wizard: { robe: '#2e1f4a', trim: '#c9b48a', hood: true }, starship: { dept: '#d9a521' } },
  { skin: '#d9d9db', hair: { style: 'ponytail', color: '#16120f' }, beard: 'none', glasses: true,
    office: { top: 'sweater', topColor: '#2f7d4a', bottom: 'trousers', bottomColor: '#3a3d44', shoeColor: '#1a1a1a' },
    wizard: { robe: '#1f3a24', trim: '#b8902f', hood: true }, starship: { dept: '#2a8f9a' } },
  { skin: '#d9d9db', hair: { style: 'none', color: '#16120f' }, beard: 'full', glasses: false,
    office: { top: 'blazer', topColor: '#3a3d44', bottom: 'trousers', bottomColor: '#1f2228', shoeColor: '#3a2416' },
    wizard: { robe: '#3a2a1a', trim: '#8a6a3a', hood: true }, starship: { dept: '#b3202a' } },
  { skin: '#d9d9db', hair: { style: 'short', color: '#e0569a' }, beard: 'none', glasses: false,
    office: { top: 'hoodie', topColor: '#2a6fb0', bottom: 'skirt', bottomColor: '#2a2a30', shoeColor: '#e8e6e1' },
    wizard: { robe: '#1f2f4a', trim: '#9aa8a0', hood: false }, starship: { dept: '#3f7fd9' } },
];
const KEY = 'office.looks';
const merge = (a, b) => { const o = structuredClone(a); for (const k in b ?? {}) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) ? merge(a[k] ?? {}, b[k]) : b[k]; return o; };
// outfits for the later rooms, picked by place in the team (each still editable in the Wardrobe)
const HABITS = ['#4a3a2a', '#5a4632', '#3a3a3a', '#6b5a44', '#2e2a26', '#7a6a52', '#4a4038', '#5c4a3c'];
const SHIRTS = ['#f2f2ee', '#f2f2ee', '#dfe8f2', '#f2f2ee', '#eef0e6', '#f2f2ee', '#e6eef2', '#f2efe6'];
const TIES = ['#1f2a44', '#7a1f2a', '#2a4a2a', '#3a3d44', '#5a2a5a', '#1f3a4a', '#7a5a1f', '#2a2a2e'];
const COATS = ['#8a7a5a', '#5a5246', '#3a3d44', '#7a6a4a', '#2a2a2e', '#6a5a3a', '#4a4a50', '#8a8070'];
const SUITS = ['#2a2a2e', '#3a3226', '#1f2228', '#3a3d44', '#2e2a26', '#26303a', '#3a2e26', '#2a2a30'];
const extraFor = (i) => ({
  scriptorium: { habit: HABITS[i % 8], cord: '#d8c8a0', hood: i % 3 === 1 },
  mission: { shirt: SHIRTS[i % 8], tie: TIES[i % 8], trousers: SUITS[(i + 3) % 8], headset: true },
  noir: { coat: COATS[i % 8], suit: SUITS[i % 8], hat: SUITS[(i + 1) % 8], tie: TIES[(i + 1) % 8], coatOn: i % 2 === 0 },
});
export const presetFor = (index = 0) => {
  const i = ((index % PRESETS.length) + PRESETS.length) % PRESETS.length;
  return { ...extraFor(i), ...PRESETS[i] };
};
// Looks live on the office server (shared by every browser); localStorage is the offline fallback.
export function lookFor(id, saved = {}, index = 0) { return merge(presetFor(index), saved?.[id]); }
export function cachedLooks() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
export async function fetchLooks() {
  try { const r = await fetch('/api/looks'); if (r.ok) { const { looks } = await r.json(); saveLocal(looks); return looks; } } catch {}
  return null;
}
const saveLocal = (looks) => { try { localStorage.setItem(KEY, JSON.stringify(looks)); } catch {} };
let pushTimer = null;
export function saveLooks(looks, onSaved) {
  saveLocal(looks);
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const r = await fetch('/api/looks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ looks }) });
      onSaved?.(r.ok);
    } catch { onSaved?.(false); }
  }, 400);
}

// ---------- materials + helpers ----------
const cloth = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.88, sheen: 0.6, sheenRoughness: 0.7, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35), ...extra });
const solid = (color, roughness = 0.6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const skinMat = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.6 });
const glow = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
function part(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
}
const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const ring = (r, tube, mat, parent, y, sy = 0.75, z = 0) => { const m = part(new THREE.TorusGeometry(r, tube, 8, 40), mat, parent, 0, y, z); m.rotation.x = Math.PI / 2; m.scale.y = sy; return m; };
const torsoProfile = (k = 1, from = 0, to = 1) =>
  [[0.15, 0], [0.135, 0.14], [0.155, 0.26], [0.172, 0.36], [0.165, 0.44], [0.12, 0.5], [0.05, 0.53]]
    .filter(([, y]) => y >= from * 0.53 - 1e-6 && y <= to * 0.53 + 1e-6).map(([r, y]) => new THREE.Vector2(r * k, y));

// ---------- the rig ----------
function buildRig(m) {
  const root = new THREE.Group();
  const hips = joint(root, 0, 0.95, 0);
  const spine = joint(hips, 0, 0.06, 0);
  const neck = joint(spine, 0, 0.5, 0.0);
  const head = joint(neck, 0, 0.17, 0.01);
  const sh = [-1, 1].map((s) => joint(spine, s * 0.215, 0.42, 0));
  const el = sh.map((j) => joint(j, 0, -0.29, 0));
  const wr = el.map((j) => joint(j, 0, -0.26, 0));
  const th = [-1, 1].map((s) => joint(hips, s * 0.095, -0.04, 0));
  const kn = th.map((j) => joint(j, 0, -0.43, 0));
  const an = kn.map((j) => joint(j, 0, -0.42, 0));
  const P = {};
  P.pelvis = part(new THREE.SphereGeometry(0.15, 28, 18), m.pelvis, hips); P.pelvis.scale.set(1.1, 0.72, 0.82);
  P.torso = part(new THREE.LatheGeometry(torsoProfile(), 36), m.torso, spine, 0, -0.03, 0); P.torso.scale.z = 0.7;
  P.neck = part(new THREE.CapsuleGeometry(0.045, 0.08, 6, 14), m.neck, neck);
  P.head = part(new THREE.SphereGeometry(0.115, 32, 24), m.head, head); P.head.scale.set(0.92, 1.12, 1);
  P.upper = sh.map((j) => { part(new THREE.SphereGeometry(0.058, 16, 12), m.upper, j); return part(new THREE.CapsuleGeometry(0.05, 0.2, 6, 14), m.upper, j, 0, -0.14, 0); });
  P.fore = el.map((j) => part(new THREE.CapsuleGeometry(0.043, 0.19, 6, 14), m.fore, j, 0, -0.12, 0));
  P.hand = wr.map((j) => { const h = part(new THREE.SphereGeometry(0.046, 16, 12), m.hand, j, 0, -0.04, 0); h.scale.set(0.75, 1.25, 0.55); return h; });
  P.elbow = el.map((j) => part(new THREE.SphereGeometry(0.046, 14, 10), m.upper, j));
  P.knee = kn.map((j) => part(new THREE.SphereGeometry(0.06, 14, 10), m.thigh, j));
  P.hipJ = th.map((j) => part(new THREE.SphereGeometry(0.074, 14, 10), m.thigh, j, 0, -0.04, 0));
  P.thigh = th.map((j) => part(new THREE.CapsuleGeometry(0.072, 0.29, 6, 14), m.thigh, j, 0, -0.21, 0));
  P.shin = kn.map((j) => part(new THREE.CapsuleGeometry(0.056, 0.31, 6, 14), m.shin, j, 0, -0.2, 0));
  P.foot = an.map((j) => part(new RoundedBoxGeometry(0.095, 0.07, 0.24, 3, 0.03), m.foot, j, 0, -0.03, 0.05));
  return { root, hips, spine, neck, head, sh, el, wr, th, kn, an, P, extras: { standOnly: [], sitOnly: [] } };
}

// ---------- head: hair, beard, glasses ----------
function dressHead(r, look) {
  const h = r.head, hc = look.hair.color, hm = cloth(hc, { sheen: 1, sheenRoughness: 0.4, roughness: 0.75 });
  const cap = (rad, back = 0.35, thetaLen = 0.56) => {
    const c = part(new THREE.SphereGeometry(rad, 36, 18, 0, Math.PI * 2, 0, Math.PI * thetaLen), hm, h, 0, 0.012, -0.01);
    c.scale.set(0.96, 1.12, 1.04); c.rotation.x = -back; return c;
  };
  const s = look.hair.style;
  if (s === 'buzz') cap(0.119, 0.3, 0.5);
  if (s === 'short') { cap(0.126, 0.35); part(new THREE.SphereGeometry(0.05, 14, 10), hm, h, 0.05, 0.1, 0.06).scale.set(1.3, 0.6, 1); }
  if (s === 'curly') {
    cap(0.13, 0.3);
    for (let i = 0; i < 34; i++) {
      const a = i * 2.39996, y = 1 - (i / 34) * 1.1, rr = Math.sqrt(Math.max(0, 1 - y * y));
      const p = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
      if (p.z > 0.55 && p.y < 0.45) continue; // keep the face clear
      part(new THREE.SphereGeometry(0.042, 10, 8), hm, h, p.x * 0.125, 0.02 + p.y * 0.14, p.z * 0.125 - 0.012);
    }
  }
  if (s === 'bun') { cap(0.124, 0.35); part(new THREE.SphereGeometry(0.058, 18, 12), hm, h, 0, 0.13, -0.09); }
  if (s === 'ponytail') { cap(0.124, 0.35); const t = part(new THREE.CapsuleGeometry(0.034, 0.2, 6, 12), hm, h, 0, -0.04, -0.14); t.rotation.x = 0.35; part(new THREE.SphereGeometry(0.03, 10, 8), hm, h, 0, 0.06, -0.12); }
  if (s === 'long') {
    cap(0.127, 0.3);
    const back = part(new THREE.CylinderGeometry(0.115, 0.14, 0.34, 28, 1, true, Math.PI * 0.42, Math.PI * 1.16), cloth(hc, { side: THREE.DoubleSide, sheen: 1, roughness: 0.75 }), h, 0, -0.1, -0.012);
    back.scale.z = 0.95;
  }
  for (const o of h.children) if (o !== r.P.head) o.userData.hair = true; // hats hide these
  if (look.beard === 'stubble') {
    const b = part(new THREE.SphereGeometry(0.117, 28, 14, Math.PI * 0.5 - 1.0, 2.0, Math.PI * 0.64, Math.PI * 0.24), cloth(hc, { transparent: true, opacity: 0.55 }), h);
    b.scale.set(0.95, 1.12, 1.02);
  }
  if (look.beard === 'full') {
    const b = part(new THREE.SphereGeometry(0.085, 24, 16), hm, h, 0, -0.072, 0.045); b.scale.set(1.18, 1.0, 0.85);
    for (const sx of [-1, 1]) part(new THREE.CapsuleGeometry(0.022, 0.08, 6, 10), hm, h, sx * 0.095, -0.02, 0.03);
    part(new THREE.CapsuleGeometry(0.012, 0.06, 6, 8), hm, h, 0, -0.035, 0.112).rotation.z = Math.PI / 2; // moustache
  }
  if (look.glasses) {
    const frame = solid('#151515', 0.3, 0.6);
    for (const x of [-0.042, 0.042]) part(new THREE.TorusGeometry(0.028, 0.0045, 8, 24), frame, h, x, 0.018, 0.108);
    part(new THREE.BoxGeometry(0.03, 0.005, 0.005), frame, h, 0, 0.022, 0.112);
    for (const x of [-1, 1]) part(new THREE.BoxGeometry(0.004, 0.004, 0.1), frame, h, x * 0.07, 0.02, 0.06);
  }
}

// ---------- wardrobes ----------
function dressOffice(r, look) {
  const L = look.office, top = r.P.torso.material, white = cloth('#f2f2f0');
  if (L.top === 'blazer') {
    ring(0.06, 0.018, white, r.neck, -0.02, 1);
    const v = new THREE.Shape(); v.moveTo(-0.055, 0); v.lineTo(0.055, 0); v.lineTo(0, -0.17); v.closePath();
    part(new THREE.ShapeGeometry(v), white, r.spine, 0, 0.49, 0.118).rotation.x = -0.18;
    part(new THREE.BoxGeometry(0.028, 0.14, 0.005), cloth('#7a1f2a'), r.spine, 0, 0.405, 0.135).rotation.x = -0.18;
    const lap = cloth(new THREE.Color(L.topColor).multiplyScalar(0.7));
    for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.012, 0.2, 0.01), lap, r.spine, s * 0.045, 0.4, 0.122).rotation.set(-0.18, 0, s * 0.3);
  } else if (L.top === 'hoodie') {
    const hood = part(new THREE.TorusGeometry(0.1, 0.045, 10, 28, Math.PI * 1.3), top, r.neck, 0, -0.02, -0.02);
    hood.rotation.set(Math.PI / 2, 0, Math.PI * 0.85); hood.scale.set(1, 1.15, 0.9);
    for (const s of [-1, 1]) part(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6), white, r.spine, s * 0.03, 0.4, 0.125);
    part(new THREE.BoxGeometry(0.18, 0.08, 0.01), top, r.spine, 0, 0.12, 0.103);
  } else if (L.top === 'sweater') {
    ring(0.062, 0.016, top, r.neck, -0.02, 1);
    for (const j of r.wr) part(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), top, j, 0, 0.02, 0);
    ring(0.152, 0.012, top, r.spine, -0.02, 0.7);
  } else if (L.top === 'cardigan') {
    const edge = cloth(new THREE.Color(L.topColor).multiplyScalar(0.8));
    for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.012, 0.42, 0.01), edge, r.spine, s * 0.03, 0.22, 0.12).rotation.x = -0.05;
    for (let i = 0; i < 4; i++) part(new THREE.SphereGeometry(0.008, 8, 6), solid('#e8e2d0', 0.4), r.spine, 0.03, 0.12 + i * 0.09, 0.128);
  } else if (L.top === 'tee') {
    for (const j of r.sh) part(new THREE.CylinderGeometry(0.062, 0.058, 0.08, 16), top, j, 0, -0.1, 0);
  }
  if (L.bottom === 'skirt') {
    const pts = [[0.165, 0.06], [0.2, -0.15], [0.25, -0.42], [0.255, -0.43]].map(([x, y]) => new THREE.Vector2(x, y));
    const sk = part(new THREE.LatheGeometry(pts, 36), cloth(L.bottomColor, { side: THREE.DoubleSide }), r.hips); sk.scale.z = 0.85;
    r.extras.standOnly.push(sk);
  } else {
    ring(0.155, 0.014, solid('#1a1410', 0.5), r.hips, 0.05, 0.8);
    if (L.bottom === 'jeans') for (const j of r.kn) part(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 16), cloth('#c9a35a'), j, 0, -0.37, 0); // cuffs
  }
}

function dressRobe(r, look, role) {
  const L = look.wizard, trim = solid(L.trim, 0.35, 0.85), leather = solid('#2a1a10', 0.7);
  const robeD = (k) => cloth(new THREE.Color(L.robe).multiplyScalar(k), { side: THREE.DoubleSide });
  if (L.hood) {
    for (const o of [...r.head.children]) o.visible = o === r.P.head; // hood replaces hair/glasses
    const hood = part(new THREE.SphereGeometry(0.17, 32, 20, Math.PI * 0.5 + Math.PI * 0.2, Math.PI * 1.6, 0, Math.PI * 0.74), robeD(0.8), r.head, 0, 0.03, -0.025);
    hood.scale.set(1, 1.12, 1.1);
    const rimH = part(new THREE.TorusGeometry(0.105, 0.014, 8, 32, Math.PI * 1.15), robeD(0.6), r.head, 0, 0.03, 0.11); rimH.rotation.z = -Math.PI * 0.075; rimH.scale.set(1, 1.25, 1);
    part(new THREE.ConeGeometry(0.1, 0.16, 20), robeD(0.8), r.head, 0, 0.1, -0.13).rotation.x = -1.9;
    r.P.head.material = solid('#0b0908', 0.9);
    const eye = glow(role, 2.2);
    for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.009, 8, 6), eye, r.head, s * 0.035, 0.0, 0.1);
  }
  part(new THREE.LatheGeometry([[0.07, 0.1], [0.13, 0.07], [0.2, 0.02], [0.24, -0.05], [0.25, -0.12]].map(([x, y]) => new THREE.Vector2(x, y)), 36), robeD(0.7), r.spine, 0, 0.45, 0).scale.z = 0.8; // mantle
  ring(0.25, 0.011, trim, r.spine, 0.33, 0.8);
  part(new THREE.SphereGeometry(0.022, 14, 10), glow(role, 1.6), r.spine, 0, 0.47, 0.12);                  // clasp gem
  for (const j of r.el) part(new THREE.CylinderGeometry(0.055, 0.11, 0.24, 24, 1, true), robeD(1), j, 0, -0.17, 0); // sleeves
  ring(0.15, 0.02, leather, r.spine, 0.08, 0.72);
  part(new THREE.BoxGeometry(0.05, 0.045, 0.015), trim, r.spine, 0, 0.08, 0.112);
  const sash = part(new THREE.BoxGeometry(0.06, 0.38, 0.012), cloth(role), r.hips, 0.05, -0.15, 0.135); sash.rotation.z = 0.05;
  const skirtPts = [[0.17, 0], [0.2, -0.25], [0.27, -0.6], [0.33, -0.88], [0.335, -0.9]].map(([x, y]) => new THREE.Vector2(x, y));
  const skirt = part(new THREE.LatheGeometry(skirtPts, 40), robeD(1), r.hips, 0, 0.04, 0); skirt.scale.z = 0.85;
  const hem = ring(0.333, 0.012, trim, r.hips, -0.855, 0.85);
  r.extras.standOnly.push(sash, skirt, hem);
  const drape = part(new THREE.CylinderGeometry(0.21, 0.25, 0.46, 28, 1, true, -Math.PI * 0.42, Math.PI * 0.84), robeD(1), r.hips, 0, -0.27, 0.29);
  r.extras.sitOnly.push(drape);
}

function dressUniform(r, look) {
  const yoke = cloth(look.starship.dept, { sheen: 0.3 });
  part(new THREE.LatheGeometry(torsoProfile(1.035, 0.62, 1), 36), yoke, r.spine, 0, -0.03, 0).scale.z = 0.7;
  for (const j of r.sh) { part(new THREE.SphereGeometry(0.064, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), yoke, j); part(new THREE.CapsuleGeometry(0.053, 0.06, 6, 14), yoke, j, 0, -0.06, 0); }
  ring(0.172, 0.006, solid('#6b6f78', 0.3, 0.8), r.spine, 0.31, 0.7);
  part(new THREE.CylinderGeometry(0.058, 0.062, 0.05, 20), cloth('#5a5d64'), r.neck, 0, -0.02, 0);
  part(new THREE.SphereGeometry(0.022, 16, 10), solid('#d9dde4', 0.2, 1), r.spine, -0.085, 0.37, 0.115).scale.set(1, 1.3, 0.35); // plain comm badge
  for (const j of r.kn) part(new THREE.CylinderGeometry(0.06, 0.058, 0.2, 16), solid('#0b0c0e', 0.25, 0.1), j, 0, -0.32, 0);
}

// Scriptorium: a plain monk's habit, rope cord, scapular, hood up or down
function dressHabit(r, look) {
  const L = look.scriptorium, habit = (k = 1) => cloth(new THREE.Color(L.habit).multiplyScalar(k), { side: THREE.DoubleSide });
  const cord = solid(L.cord, 0.9);
  if (L.hood) {
    for (const o of [...r.head.children]) if (o !== r.P.head && !o.userData.keepUnderHood) o.visible = false;
    const hood = part(new THREE.SphereGeometry(0.165, 32, 20, Math.PI * 0.7, Math.PI * 1.6, 0, Math.PI * 0.72), habit(0.85), r.head, 0, 0.03, -0.025); hood.scale.set(1, 1.1, 1.08);
  } else {
    const cowl = part(new THREE.TorusGeometry(0.12, 0.05, 10, 32, Math.PI * 1.4), habit(0.85), r.neck, 0, -0.03, -0.02);
    cowl.rotation.set(Math.PI / 2, 0, Math.PI * 0.8); cowl.scale.set(1.05, 1.2, 0.8);
  }
  part(new THREE.BoxGeometry(0.2, 0.62, 0.012), habit(0.75), r.spine, 0, 0.18, 0.115);                // scapular (front)
  for (const j of r.el) part(new THREE.CylinderGeometry(0.055, 0.1, 0.24, 24, 1, true), habit(1), j, 0, -0.17, 0);
  ring(0.15, 0.014, cord, r.spine, 0.08, 0.72);
  const ends = [-0.03, 0.03].map((x) => part(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 8), cord, r.hips, x, -0.13, 0.13));
  const skirtPts = [[0.17, 0], [0.21, -0.3], [0.29, -0.7], [0.32, -0.9]].map(([x, y]) => new THREE.Vector2(x, y));
  const skirt = part(new THREE.LatheGeometry(skirtPts, 40), habit(1), r.hips, 0, 0.04, 0); skirt.scale.z = 0.85;
  r.extras.standOnly.push(skirt, ...ends);
  r.extras.sitOnly.push(part(new THREE.CylinderGeometry(0.21, 0.25, 0.46, 28, 1, true, -Math.PI * 0.42, Math.PI * 0.84), habit(1), r.hips, 0, -0.27, 0.29));
}

// Mission Control: short-sleeved white shirt, narrow tie, slacks, a headset
function dressMission(r, look) {
  const L = look.mission, shirt = r.P.torso.material;
  for (const j of r.sh) part(new THREE.CylinderGeometry(0.062, 0.058, 0.09, 16), shirt, j, 0, -0.1, 0);
  for (const s of [-1, 1]) { const c = part(new THREE.BoxGeometry(0.06, 0.012, 0.05), shirt, r.neck, s * 0.035, -0.03, 0.045); c.rotation.set(0.5, 0, s * 0.5); }
  const tie = part(new THREE.BoxGeometry(0.03, 0.3, 0.006), cloth(L.tie), r.spine, 0, 0.33, 0.125); tie.rotation.x = -0.12;
  part(new THREE.BoxGeometry(0.008, 0.035, 0.01), solid('#c9ccd2', 0.3, 0.9), r.spine, 0, 0.3, 0.135);   // tie bar
  part(new THREE.BoxGeometry(0.07, 0.05, 0.006), solid('#f2f2ee', 0.6), r.spine, 0.075, 0.33, 0.12);     // pocket
  part(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6), solid('#1f2a44', 0.4), r.spine, 0.06, 0.36, 0.125); // pen
  ring(0.155, 0.014, solid('#1a1410', 0.5), r.hips, 0.05, 0.8);
  if (L.headset) {
    const band = part(new THREE.TorusGeometry(0.125, 0.008, 8, 32, Math.PI), solid('#1a1a1a', 0.4), r.head, 0, 0.02, 0); band.rotation.z = 0;
    band.userData.keepUnderHood = true;
    const ear = part(new THREE.CylinderGeometry(0.035, 0.035, 0.025, 16), solid('#1a1a1a', 0.4), r.head, 0.12, 0.0, 0); ear.rotation.z = Math.PI / 2;
    const boom = part(new THREE.CylinderGeometry(0.005, 0.005, 0.14, 6), solid('#1a1a1a', 0.4), r.head, 0.1, -0.06, 0.06); boom.rotation.set(0.9, 0, 0.35);
    part(new THREE.SphereGeometry(0.012, 10, 8), solid('#2a2a2a', 0.5), r.head, 0.065, -0.1, 0.11);
  }
}

// Detective Agency: 1940s suit and tie, fedora, and (optionally) a belted trench coat
function dressNoir(r, look) {
  const L = look.noir, suit = r.P.torso.material;
  // hide the top of the hair under the hat brim, keep beard/glasses
  const hatMat = cloth(L.hat, { sheen: 0.3 });
  for (const o of r.head.children) if (o.userData.hair && o.position.y > 0.05) o.visible = false; // tufts/bun go under the hat
  const hat = new THREE.Group(); hat.position.set(0, 0.1, -0.005); hat.rotation.x = -0.06; r.head.add(hat);
  const brim = part(new THREE.CylinderGeometry(0.19, 0.19, 0.01, 40), hatMat, hat); brim.scale.z = 0.9; brim.rotation.x = 0.06;
  const crown = part(new THREE.SphereGeometry(0.118, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), hatMat, hat, 0, 0.0, 0); crown.scale.set(1, 0.78, 0.92);
  const pinch = part(new THREE.BoxGeometry(0.1, 0.02, 0.05), cloth(new THREE.Color(L.hat).multiplyScalar(0.8)), hat, 0, 0.088, 0.02); pinch.rotation.x = -0.2; // the dent
  part(new THREE.CylinderGeometry(0.119, 0.119, 0.022, 32), cloth('#141414'), hat, 0, 0.012, 0).scale.z = 0.92;
  const shirt = cloth('#efece4');
  const v = new THREE.Shape(); v.moveTo(-0.05, 0); v.lineTo(0.05, 0); v.lineTo(0, -0.16); v.closePath();
  part(new THREE.ShapeGeometry(v), shirt, r.spine, 0, 0.49, 0.118).rotation.x = -0.18;
  part(new THREE.BoxGeometry(0.034, 0.15, 0.005), cloth(L.tie), r.spine, 0, 0.41, 0.135).rotation.x = -0.18;
  const lap = cloth(new THREE.Color(L.suit).multiplyScalar(0.75));
  for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.014, 0.22, 0.01), lap, r.spine, s * 0.047, 0.39, 0.122).rotation.set(-0.18, 0, s * 0.32);
  if (L.coatOn) {
    const coat = (k = 1) => cloth(new THREE.Color(L.coat).multiplyScalar(k), { side: THREE.DoubleSide });
    // open-fronted coat body from chest to knee, worn over the suit
    const pts = [[0.18, 0.46], [0.185, 0.3], [0.17, 0.1], [0.2, -0.2], [0.25, -0.5], [0.27, -0.56]].map(([x, y]) => new THREE.Vector2(x, y));
    const body = part(new THREE.LatheGeometry(pts, 40, Math.PI * 0.62, Math.PI * 1.76), coat(1), r.spine, 0, 0, 0); body.scale.z = 0.78;
    r.extras.standOnly.push(body);
    const upper = part(new THREE.LatheGeometry(pts.slice(0, 3), 40, Math.PI * 0.62, Math.PI * 1.76), coat(1), r.spine, 0, 0, 0); upper.scale.z = 0.78;
    r.extras.sitOnly.push(upper);
    for (const s of [-1, 1]) part(new THREE.BoxGeometry(0.05, 0.24, 0.012), coat(0.85), r.spine, s * 0.08, 0.4, 0.13).rotation.set(-0.2, 0, s * 0.42); // wide lapels
    ring(0.185, 0.018, coat(0.8), r.spine, 0.1, 0.8);                                                 // belt
    for (const j of r.sh) part(new THREE.CapsuleGeometry(0.058, 0.2, 6, 14), coat(1), j, 0, -0.14, 0);
    for (const j of r.el) part(new THREE.CapsuleGeometry(0.05, 0.19, 6, 14), coat(1), j, 0, -0.12, 0);
  }
  void suit;
}

// ---------- factory ----------
export function makeAgent({ id = 'agent', theme = 'office', look, color = '#8b93a7', index = 0 } = {}) {
  look = look ?? presetFor(index);
  const skin = skinMat(look.skin);
  let m;
  if (theme === 'office') {
    const top = cloth(look.office.topColor), bottom = cloth(look.office.bottomColor), shoe = solid(look.office.shoeColor, 0.4);
    m = { pelvis: bottom, torso: top, neck: skin, head: skin, upper: top, fore: look.office.top === 'tee' ? skin : top, hand: skin, thigh: bottom, shin: bottom, foot: shoe };
  } else if (theme === 'wizard') {
    const robe = cloth(look.wizard.robe);
    m = { pelvis: robe, torso: robe, neck: skin, head: skin, upper: robe, fore: robe, hand: skin, thigh: robe, shin: robe, foot: solid('#1c140e', 0.7) };
  } else if (theme === 'scriptorium') {
    const habit = cloth(look.scriptorium.habit);
    m = { pelvis: habit, torso: habit, neck: skin, head: skin, upper: habit, fore: habit, hand: skin, thigh: habit, shin: habit, foot: solid('#3a2416', 0.8) };
  } else if (theme === 'mission') {
    const shirt = cloth(look.mission.shirt), pants = cloth(look.mission.trousers);
    m = { pelvis: pants, torso: shirt, neck: skin, head: skin, upper: shirt, fore: skin, hand: skin, thigh: pants, shin: pants, foot: solid('#141414', 0.35) };
  } else if (theme === 'noir') {
    const suit = cloth(look.noir.suit, { sheen: 0.4 });
    m = { pelvis: suit, torso: suit, neck: skin, head: skin, upper: suit, fore: suit, hand: skin, thigh: suit, shin: suit, foot: solid('#2a1a10', 0.3) };
  } else {
    const suit = cloth('#121418', { sheen: 0.3 });
    m = { pelvis: suit, torso: suit, neck: skin, head: skin, upper: suit, fore: suit, hand: skin, thigh: suit, shin: suit, foot: solid('#0b0c0e', 0.25, 0.1) };
  }
  const rig = buildRig(m);
  dressHead(rig, look);
  if (theme === 'office') dressOffice(rig, look);
  else if (theme === 'wizard') dressRobe(rig, look, color);
  else if (theme === 'scriptorium') dressHabit(rig, look);
  else if (theme === 'mission') dressMission(rig, look);
  else if (theme === 'noir') dressNoir(rig, look);
  else dressUniform(rig, look);
  rig.root.name = id;
  return new Agent(rig);
}

// ---------- poses ----------
export class Agent {
  constructor(rig) { this.rig = rig; this.object = rig.root; this.t = Math.random() * 10; this.stand(); }
  reset() {
    const r = this.rig;
    for (const g of [r.hips, r.spine, r.neck, r.head, ...r.sh, ...r.el, ...r.wr, ...r.th, ...r.kn, ...r.an]) g.rotation.set(0, 0, 0);
    r.hips.position.y = 0.95;
  }
  setExtras(sitting) {
    for (const o of this.rig.extras.standOnly) o.visible = !sitting;
    for (const o of this.rig.extras.sitOnly) o.visible = sitting;
  }
  stand() {
    this.pose = 'stand'; this.reset(); this.setExtras(false);
    const r = this.rig;
    r.sh[0].rotation.z = -0.1; r.sh[1].rotation.z = 0.1; r.el[0].rotation.x = r.el[1].rotation.x = -0.15;
  }
  sit(seatY = 0.46, typing = true) {
    this.pose = 'sit'; this.typing = typing; this.reset(); this.setExtras(true);
    const r = this.rig;
    r.hips.position.y = seatY + 0.08;
    for (const j of r.th) j.rotation.x = -Math.PI / 2;
    for (const j of r.kn) j.rotation.x = Math.PI / 2 - 0.05;
    r.th[0].rotation.y = 0.06; r.th[1].rotation.y = -0.06;
    r.spine.rotation.x = 0.04;
    if (typing) { for (const j of r.sh) j.rotation.x = -0.55; for (const j of r.el) j.rotation.x = -1.05; }
    else { for (const j of r.sh) j.rotation.x = -0.15; for (const j of r.el) j.rotation.x = -1.25; r.sh[0].rotation.z = -0.18; r.sh[1].rotation.z = 0.18; }
  }
  walk() { this.pose = 'walk'; this.reset(); this.setExtras(false); }
  update(dt) {
    this.t += dt; const r = this.rig, t = this.t;
    if (this.pose === 'walk') {
      const s = Math.sin(t * 6.5);
      r.th[0].rotation.x = s * 0.45; r.th[1].rotation.x = -s * 0.45;
      r.kn[0].rotation.x = Math.max(0, -s) * 0.7; r.kn[1].rotation.x = Math.max(0, s) * 0.7;
      r.sh[0].rotation.x = -s * 0.35; r.sh[1].rotation.x = s * 0.35;
      r.hips.position.y = 0.95 + Math.abs(Math.cos(t * 6.5)) * 0.025;
    } else if (this.pose === 'stand') {
      r.spine.rotation.x = Math.sin(t * 1.3) * 0.012; r.head.rotation.y = Math.sin(t * 0.4) * 0.15;
    } else {
      r.head.rotation.x = Math.sin(t * 0.7) * 0.04;
      if (this.typing) { r.wr[0].rotation.x = Math.sin(t * 11) * 0.12; r.wr[1].rotation.x = Math.sin(t * 13 + 1) * 0.12; }
    }
  }
}
