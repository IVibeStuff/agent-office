// 1940s detective agency, with its own floor plan:
//   bullpen (north-west): detectives' desks in facing pairs, green banker's lamps
//     that switch on while someone works, typewriters, an evidence board with
//     red string, filing cabinets
//   chief's office (north-east): frosted-glass partition with the title on the door,
//     big desk, whiskey cart, oscillating fan
//   windows: rain streaming down, venetian blinds throwing striped light, a red
//     neon sign blinking outside at night
//   waiting room (south-west): leather sofas and a radio; idle bots wait here
//   reception (south-middle): secretary's desk and coffee percolator
//   interview room (south-east): table under a single hanging lamp
//   handoffs are manila case files; everyone wears a fedora
import * as THREE from 'three';
import * as L from '../layout.js';
import { NavGrid } from '../pathfinding.js';
import * as T from '../textures.js';
import { B, C, floorPlane, matte, glow, zoneTexture, relabel, keyLight, createCutaway, textTexture } from './kit.js';

const SERIF = 'Georgia, "Times New Roman", serif';
const COL = { oak: '#5a3a22', oakDark: '#3a2516', oakLight: '#7a5232', brass: '#b8913a', green: '#1f5a3a', leather: '#5a2a1c', leatherDark: '#3e1d14', wall: '#4a4436', plaster: '#8a7f68', steel: '#6b6e6a', frost: '#d8e2e6', paper: '#efe6cf', folder: '#c9a564' };

// ---------- floor plan ----------
const CHIEF = { minX: 3.6, maxX: 11.75, minZ: -8.75, maxZ: -2.6, doorMinX: 4.6, doorMaxX: 5.7 };
const WAIT = { minX: -11.75, maxX: -3.2, minZ: 1.9, maxZ: 8.75, gateMinX: -6.3, gateMaxX: -5.2 };
const INTERVIEW = { minX: 4.6, maxX: 11.75, minZ: -0.6, maxZ: 8.75, doorMinZ: 1.0, doorMaxZ: 2.1 };
const DESKS = {
  lead:         { x: 8.2, z: -6.5, w: 2.3, d: 1.0, rot: 0, approach: { x: 10.05, z: -7.45 } },
  'back-left':  { x: -8.0, z: -6.5, w: 1.8, d: 0.9, rot: 0, approach: { x: -9.55, z: -7.45 } },
  'back-mid':   { x: -4.4, z: -6.5, w: 1.8, d: 0.9, rot: 0, approach: { x: -2.85, z: -7.45 } },
  'back-right': { x: -0.8, z: -6.5, w: 1.8, d: 0.9, rot: 0, approach: { x: 0.75, z: -7.45 } },
  'mid-left':   { x: -4.4, z: -4.1, w: 1.8, d: 0.9, rot: Math.PI },
  'mid-right':  { x: -0.8, z: -4.1, w: 1.8, d: 0.9, rot: Math.PI },
  'front-left': { x: -8.0, z: -4.1, w: 1.8, d: 0.9, rot: Math.PI },
  'front-right':{ x: 2.4,  z: -4.1, w: 1.8, d: 0.9, rot: Math.PI },
};
const LOUNGE_SEATS = [
  L.benchSeat(-9.6, 2.75, 0, 1.0), L.benchSeat(-8.6, 2.75, 0, 1.0), L.benchSeat(-7.6, 2.75, 0, 1.0),
  L.benchSeat(-11.1, 5.3, Math.PI / 2, 1.0), L.benchSeat(-11.1, 6.3, Math.PI / 2, 1.0), L.benchSeat(-11.1, 7.3, Math.PI / 2, 1.0),
  L.benchSeat(-4.4, 6.4, -Math.PI / 2, 1.0), L.benchSeat(-4.4, 4.95, -Math.PI / 2, 1.0),
];
const heightAt = () => 0;

// ---------- textures ----------
function parquet() {
  const S = 1024, c = T.canvas(S, S), g = c.getContext('2d'), r = T.rng(17);
  g.fillStyle = '#4a3020'; g.fillRect(0, 0, S, S);
  const bw = 32, bl = 128;
  for (let y = -bl; y < S + bl; y += bw) for (let x = -bl; x < S + bl; x += bl * 2) {
    const off = ((y / bw) % 2) * bl;
    for (const [px, py, w, h] of [[x + off, y, bl, bw], [x + off + bl, y - bl + bw, bw, bl]]) {
      g.fillStyle = `hsl(${25 + r() * 5}, ${34 + r() * 8}%, ${27 + r() * 5}%)`;
      g.fillRect(px + 1, py + 1, w - 2, h - 2);
    }
  }
  return T.tex(c, { repeat: [5, 4] });
}
function checker(a, b, n = 8) {
  const S = 512, c = T.canvas(S, S), g = c.getContext('2d'), t = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * t, j * t, t, t); }
  return T.tex(c, { repeat: [3, 3] });
}
function wainscot() {
  const c = T.canvas(512, 256), g = c.getContext('2d');
  g.fillStyle = COL.oak; g.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 128) { g.fillStyle = '#4a2f1b'; g.fillRect(x + 14, 20, 100, 200); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + 14, 20, 100, 6); }
  return T.tex(c, { repeat: [4, 1] });
}
function plaster(repeat) {
  const c = T.canvas(256, 256), g = c.getContext('2d'), r = T.rng(5);
  g.fillStyle = COL.plaster; g.fillRect(0, 0, 256, 256);
  g.globalAlpha = 0.06; for (let i = 0; i < 3000; i++) { g.fillStyle = r() > 0.5 ? '#fff' : '#000'; g.fillRect(r() * 256, r() * 256, 2, 2); }
  return T.tex(c, { repeat });
}
// window view: city in the rain (day: overcast, evening: amber, night: neon)
function rainyWindow() {
  const W = 512, H = 640, c = T.canvas(W, H), g = c.getContext('2d'), t = T.tex(c), r = T.rng(9);
  const drops = Array.from({ length: 140 }, () => ({ x: r() * W, y: r() * H, v: 120 + r() * 260, l: 10 + r() * 30 }));
  const bldg = Array.from({ length: 9 }, (_, i) => [i * 60 - 10, 200 + r() * 260, 50 + r() * 30]);
  const lights = []; for (const [bx, top, w] of bldg) for (let y = top + 14; y < H - 10; y += 22) for (let x = bx + 6; x < bx + w - 8; x += 14) if (r() > 0.55) lights.push([x, y]);
  let tod = 'night', neonOn = true;
  const draw = (dt = 0) => {
    const sky = { day: ['#8c96a0', '#b4b8b8'], evening: ['#5a4a5a', '#d08a5a'], night: ['#0b0f1c', '#1a1830'] }[tod];
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = tod === 'day' ? '#6a707a' : tod === 'evening' ? '#3a3040' : '#11141e';
    for (const [bx, top, w] of bldg) g.fillRect(bx, top, w, H - top);
    if (tod !== 'day') { g.fillStyle = tod === 'night' ? 'rgba(255,205,120,.75)' : 'rgba(255,205,120,.35)'; for (const [x, y] of lights) g.fillRect(x, y, 6, 9); }
    if (tod === 'night') { // neon sign across the street
      g.save(); g.shadowColor = '#ff3a4a'; g.shadowBlur = neonOn ? 30 : 0;
      g.fillStyle = neonOn ? '#ff5a68' : '#5a2228'; g.font = `700 64px ${SERIF}`; g.fillText('HOTEL', 150, 190); g.restore();
    }
    g.strokeStyle = tod === 'night' ? 'rgba(180,200,255,.35)' : 'rgba(255,255,255,.35)'; g.lineWidth = 1.5;
    for (const d of drops) { d.y += d.v * dt; if (d.y > H) { d.y = -d.l; d.x = r() * W; } g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - 2, d.y + d.l); g.stroke(); }
    t.needsUpdate = true;
  };
  draw();
  return { texture: t, draw, setTod: (x) => { tod = x; }, setNeon: (on) => { neonOn = on; } };
}
function blindsTexture() {
  const c = T.canvas(64, 256), g = c.getContext('2d');
  for (let y = 0; y < 256; y += 16) { g.fillStyle = 'rgba(200,190,160,.92)'; g.fillRect(0, y, 64, 9); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y + 8, 64, 1); }
  const t = T.tex(c); t.wrapT = THREE.RepeatWrapping; return t;
}
function stripesTexture() {
  const c = T.canvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#fff'; for (let y = 4; y < 256; y += 22) g.fillRect(0, y, 256, 11);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function evidenceBoard() {
  const W = 1024, H = 640, c = T.canvas(W, H), g = c.getContext('2d'), r = T.rng(33);
  g.fillStyle = '#a07a4a'; g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.2; for (let i = 0; i < 9000; i++) { g.fillStyle = r() > 0.5 ? '#5a3a1a' : '#d8b080'; g.fillRect(r() * W, r() * H, 2, 2); } g.globalAlpha = 1;
  const pins = [];
  for (let i = 0; i < 9; i++) {
    const x = 70 + (i % 3) * 320 + r() * 80, y = 60 + Math.floor(i / 3) * 190 + r() * 40, w = i % 2 ? 150 : 120, h = i % 2 ? 110 : 150;
    g.save(); g.translate(x + w / 2, y + h / 2); g.rotate((r() - 0.5) * 0.12);
    g.fillStyle = i % 3 === 0 ? '#e8e2d2' : '#d8d0b8'; g.fillRect(-w / 2, -h / 2, w, h);
    if (i % 2) { g.fillStyle = '#3a3a38'; g.fillRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 40); } // photo
    else { g.fillStyle = '#5a5a58'; for (let k = 0; k < 6; k++) g.fillRect(-w / 2 + 12, -h / 2 + 16 + k * 18, w - 30 - r() * 30, 4); }
    g.restore();
    pins.push([x + w / 2, y + 8]);
  }
  g.strokeStyle = '#c0201a'; g.lineWidth = 4;
  for (const [a, b] of [[0, 4], [4, 8], [1, 4], [2, 4], [3, 7], [5, 7], [6, 4]]) { g.beginPath(); g.moveTo(...pins[a]); g.lineTo(...pins[b]); g.stroke(); }
  g.fillStyle = '#d02a20'; for (const [x, y] of pins) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
  return T.tex(c);
}
class TypedPage {
  constructor() { this.c = T.canvas(256, 320); this.g = this.c.getContext('2d'); this.texture = T.tex(this.c); this.r = T.rng(6); this.line = 0; this.acc = 0; this.clear(); }
  clear() { const { g } = this; g.fillStyle = COL.paper; g.fillRect(0, 0, 256, 320); this.line = 0; this.texture.needsUpdate = true; }
  step(dt) {
    this.acc += dt; if (this.acc < 0.35) return; this.acc = 0;
    if (this.line > 15) return this.clear();
    const { g, r } = this; g.fillStyle = '#2a2a2a';
    let x = 18; const y = 24 + this.line * 18;
    while (x < 230) { const w = 8 + r() * 30; g.fillRect(x, y, w, 5); x += w + 6; }
    this.line++; this.texture.needsUpdate = true;
  }
}

// ---------- builder ----------
export function buildNoir({ team, leadId, desks, title = 'Agent Office' }) {
  const root = new THREE.Group();
  const nav = new NavGrid();
  const updaters = [];
  const cutaway = createCutaway();
  const bySlot = Object.fromEntries(team.filter((t) => desks[t.id]).map((t) => [desks[t.id], t]));
  const labels = [[/architect|lead|chief/, 'Chief'], [/build|engineer|develop/, 'Detective'], [/review|qa/, 'Forensics'], [/freelanc/, 'Informant']];
  const H = L.WALL_H, T_ = 0.3;
  const fw = L.FLOOR.maxX - L.FLOOR.minX, fd = L.FLOOR.maxZ - L.FLOOR.minZ;

  // ---------- floors ----------
  const floor = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.25, fd), [matte('#2a1c12'), matte('#2a1c12'), new THREE.MeshStandardMaterial({ map: parquet(), roughness: 0.55 }), matte('#2a1c12'), matte('#22160e'), matte('#22160e')]);
  floor.position.y = -0.125; floor.receiveShadow = true; root.add(floor);
  const rect = (r) => [r.maxX - r.minX, r.maxZ - r.minZ, (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2];
  { const [w, d, x, z] = rect(CHIEF); floorPlane(root, w - 1.2, d - 1.2, null, x + 0.3, z, 0.004, { color: '#5a1c18', map: null, roughness: 1 }); }
  { const [w, d, x, z] = rect(WAIT); floorPlane(root, w, d, checker('#2a2622', '#c8bfa8'), x, z, 0.003, { roughness: 0.4 }); }
  { const [w, d, x, z] = rect(INTERVIEW); floorPlane(root, w, d, null, x, z, 0.003, { color: '#5a5650', map: null, roughness: 0.9 }); }
  // desk name plates on the floor
  for (const [slot, d] of Object.entries(DESKS)) {
    if (slot === 'lead') continue;
    const m = bySlot[slot], w = d.w + 0.4, dd = 1.5;
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); g.rotation.y = d.rot - Math.PI; root.add(g);
    floorPlane(g, w, dd, zoneTexture(T.mix(m?.color || '#a89878', '#e8d8a8', 0.3), relabel(m, labels, 'Vacant'), w, dd, { fill: 0.05, border: 0.25, font: `italic 700 {S}px ${SERIF}`, labelAlpha: 0.7 }), 0, d.d / 2 + dd / 2 - 0.05, 0.006, { transparent: true, depthWrite: false });
  }

  // ---------- exterior walls (cutaway) ----------
  const wallX = L.LEFT_WALL_X - T_ / 2, wallZ = L.BACK_WALL_Z - T_ / 2;
  const plasterMat = (w) => new THREE.MeshStandardMaterial({ map: plaster([w / 3, 1]), roughness: 0.95 });
  // west wall
  const west = new THREE.Group(); root.add(west);
  B(west, T_, H, fd, plasterMat(fd), wallX, 0, 0);
  B(west, 0.06, 1.0, fd, new THREE.MeshStandardMaterial({ map: wainscot(), roughness: 0.6 }), L.LEFT_WALL_X + 0.03, 0, 0, { cast: false });
  B(west, 0.08, 0.06, fd, COL.oakDark, L.LEFT_WALL_X + 0.04, 1.0, 0, { cast: false });
  const westDecor = [];
  cutaway.add(west, -1, 0, { decor: westDecor });
  // north wall with three tall windows behind the bullpen + one in the chief's office
  const north = new THREE.Group(); root.add(north);
  const northDecor = [];
  cutaway.add(north, 0, -1, { decor: northDecor });
  const view = rainyWindow();
  const blinds = blindsTexture();
  const winXs = [-8.0, -4.4, -0.8, 8.2], ww = 1.7, wy0 = 0.85, wh = 2.0;
  let px = L.FLOOR.minX;
  for (const cx of winXs) {
    B(north, cx - ww / 2 - px, H, T_, plasterMat(cx - ww / 2 - px), (px + cx - ww / 2) / 2, 0, wallZ);
    B(north, ww, wy0, T_, plasterMat(ww), cx, 0, wallZ);
    B(north, ww, H - wy0 - wh, T_, plasterMat(ww), cx, wy0 + wh, wallZ);
    B(north, ww + 0.16, 0.06, 0.3, COL.oakDark, cx, wy0 - 0.06, wallZ + 0.12, { cast: false });
    const glassV = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: view.texture, toneMapped: true }));
    glassV.position.set(cx, wy0 + wh / 2, wallZ - 0.05); root.add(glassV); northDecor.push(glassV);
    const bl = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh * 0.55), new THREE.MeshStandardMaterial({ map: blinds, transparent: true, roughness: 0.8, alphaTest: 0.05 }));
    bl.position.set(cx, wy0 + wh - wh * 0.275, L.BACK_WALL_Z + 0.04); root.add(bl); northDecor.push(bl);
    for (const sgn of [-1, 1]) { const f = B(root, 0.07, wh, 0.12, COL.oakDark, cx + sgn * (ww / 2 + 0.035), wy0, L.BACK_WALL_Z + 0.04, { cast: false }); northDecor.push(f); }
    px = cx + ww / 2;
  }
  B(north, L.FLOOR.maxX - px, H, T_, plasterMat(L.FLOOR.maxX - px), (px + L.FLOOR.maxX) / 2, 0, wallZ);
  B(north, fw, 1.0, 0.06, new THREE.MeshStandardMaterial({ map: wainscot(), roughness: 0.6 }), 0, 0, L.BACK_WALL_Z + 0.03, { cast: false });
  // striped light through the blinds
  const stripeLight = new THREE.SpotLight('#ffe8c0', 40, 30, 0.5, 0.15, 1.0);
  stripeLight.position.set(-3.0, 3.3, -13.5); stripeLight.target.position.set(-3.5, 0, -3.0);
  stripeLight.map = stripesTexture(); stripeLight.castShadow = true; stripeLight.shadow.mapSize.set(1024, 1024);
  root.add(stripeLight, stripeLight.target);

  // ---------- evidence board, filing cabinets, usage chalkboard (west wall) ----------
  {
    const eb = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.25), new THREE.MeshStandardMaterial({ map: evidenceBoard(), roughness: 1 }));
    eb.rotation.y = Math.PI / 2; eb.position.set(L.LEFT_WALL_X + 0.085, 1.95, -4.1); root.add(eb); westDecor.push(eb); // clear of its frame (no z-fighting)
    const ef = B(root, 0.06, 2.4, 3.75, COL.oakDark, L.LEFT_WALL_X + 0.03, 0.75, -4.1, { cast: false }); westDecor.push(ef);
  }
  const cabinet = (x, z, rot) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; root.add(g);
    B(g, 0.55, 1.35, 0.65, COL.steel, 0, 0, 0);
    for (let i = 0; i < 4; i++) { B(g, 0.5, 0.29, 0.02, '#7d807b', 0, 0.08 + i * 0.32, 0.33, { cast: false }); B(g, 0.16, 0.03, 0.03, COL.brass, 0, 0.26 + i * 0.32, 0.35, { cast: false }); }
    nav.blockOBB(x, z, 0.55, 0.65, rot, 0.25);
    return g;
  };
  for (const z of [-8.3, -7.65]) cabinet(-11.35, z, Math.PI / 2);
  cabinet(-11.35, -0.6, Math.PI / 2);
  const usageBoard = new T.UsageBoard({ bg: '#22271f', frame: '#5a3a22', title: 'CASE LEDGER · WEEKLY USAGE', accent: '#e8e0c8', big: '#f2eedf', text: '#d8d2bc', muted: '#a8a28c', faint: '#7a7664', track: '#3a4034', font: SERIF });
  {
    const uz = 0.75, uw = 2.4, uh = 1.16, uy = 2.05;
    const fr = B(root, 0.08, uh + 0.14, uw + 0.14, COL.oak, L.LEFT_WALL_X + 0.04, uy - uh / 2 - 0.07, uz, { cast: false }); westDecor.push(fr);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(uw, uh), new THREE.MeshBasicMaterial({ map: usageBoard.texture, toneMapped: false, color: '#dcd8c8' }));
    m.rotation.y = Math.PI / 2; m.position.set(L.LEFT_WALL_X + 0.1, uy, uz); root.add(m); westDecor.push(m);
  }

  // ---------- chief's office: wainscot + frosted glass, title on the door ----------
  const frost = new THREE.MeshStandardMaterial({ color: COL.frost, transparent: true, opacity: 0.38, roughness: 0.6, depthWrite: false });
  const partition = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), horiz = Math.abs(z1 - z0) < 0.01;
    const w = horiz ? len : 0.12, d = horiz ? 0.12 : len, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    B(root, w, 1.05, d, COL.oak, cx, 0, cz);
    B(root, horiz ? len : 0.03, 1.35, horiz ? 0.03 : len, frost, cx, 1.05, cz, { cast: false });
    B(root, w + 0.02, 0.08, d + 0.02, COL.oakDark, cx, 2.4, cz);
    const n = Math.max(1, Math.round(len / 1.3));
    for (let i = 0; i <= n; i++) B(root, 0.07, 1.35, 0.07, COL.oakDark, x0 + (x1 - x0) * i / n, 1.05, z0 + (z1 - z0) * i / n, { cast: false });
    nav.blockRect(Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1), 0.3);
  };
  partition(CHIEF.minX, CHIEF.minZ, CHIEF.minX, CHIEF.maxZ);
  partition(CHIEF.minX, CHIEF.maxZ, CHIEF.doorMinX, CHIEF.maxZ);
  partition(CHIEF.doorMaxX, CHIEF.maxZ, CHIEF.maxX, CHIEF.maxZ);
  {
    const lead = bySlot.lead;
    const name = lead ? `${lead.name.toUpperCase()} · CHIEF` : 'CHIEF';
    const dw = CHIEF.doorMaxX - CHIEF.doorMinX, dx = (CHIEF.doorMinX + CHIEF.doorMaxX) / 2;
    B(root, 0.08, 2.4, 0.14, COL.oakDark, CHIEF.doorMinX, 0, CHIEF.maxZ); B(root, 0.08, 2.4, 0.14, COL.oakDark, CHIEF.doorMaxX, 0, CHIEF.maxZ);
    const door = new THREE.Group(); door.position.set(CHIEF.doorMinX + 0.04, 0, CHIEF.maxZ); door.rotation.y = -1.1; root.add(door); // standing ajar
    B(door, dw - 0.08, 1.05, 0.05, COL.oak, (dw - 0.08) / 2, 0, 0);
    B(door, dw - 0.08, 1.2, 0.03, frost, (dw - 0.08) / 2, 1.05, 0, { cast: false });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(dw - 0.15, 0.3), new THREE.MeshBasicMaterial({ map: textTexture(name, { font: `700 44px ${SERIF}`, color: '#1a1a1a', w: 512, h: 96, size: 44, spacing: 0.06 }), transparent: true, depthWrite: false }));
    sign.position.set((dw - 0.08) / 2, 1.7, 0.03); door.add(sign);
    const sign2 = sign.clone(); sign2.position.z = -0.03; sign2.rotation.y = Math.PI; door.add(sign2);
    void dx;
  }

  // ---------- desks ----------
  const page = new TypedPage();
  const typed = new THREE.MeshStandardMaterial({ map: page.texture, roughness: 0.95 });
  const blankPage = new THREE.MeshStandardMaterial({ color: COL.paper, roughness: 0.95 });
  const shadeMat = new THREE.MeshStandardMaterial({ color: COL.green, roughness: 0.4, metalness: 0.2 });
  const monitors = {};
  const lampLights = [];
  for (const [slot, d] of Object.entries(DESKS)) {
    const lead = slot === 'lead', who = bySlot[slot];
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); g.rotation.y = d.rot - Math.PI; root.add(g);
    // pedestal desk: two drawer stacks and a top
    B(g, d.w, 0.06, d.d, lead ? COL.oakDark : COL.oak, 0, 0.72, 0);
    for (const sx of [-1, 1]) { B(g, 0.45, 0.72, d.d - 0.06, lead ? COL.oakDark : COL.oakLight, sx * (d.w / 2 - 0.25), 0, 0); for (let i = 0; i < 3; i++) B(g, 0.12, 0.025, 0.02, COL.brass, sx * (d.w / 2 - 0.25), 0.15 + i * 0.22, d.d / 2 - 0.02, { cast: false }); }
    B(g, d.w - 0.9, 0.5, 0.04, lead ? COL.oakDark : COL.oak, 0, 0.22, -d.d / 2 + 0.03);
    B(g, d.w * 0.5, 0.012, d.d * 0.5, '#2f4a32', 0, 0.75, 0.05, { cast: false }); // blotter
    // typewriter with a page that fills while working (not on the chief's desk)
    let pageMesh = null;
    if (!lead) {
      B(g, 0.46, 0.13, 0.36, '#1a1a1a', -0.15, 0.75, 0.0);
      const roller = C(g, 0.04, 0.04, 0.5, '#2a2a2a', -0.15, 0.9, -0.12, 10); roller.rotation.z = Math.PI / 2; roller.position.y = 0.92;
      pageMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.36), blankPage);
      pageMesh.position.set(-0.15, 1.08, -0.15); pageMesh.rotation.x = -0.25; g.add(pageMesh);
    } else {
      B(g, 0.3, 0.04, 0.4, COL.folder, -0.5, 0.75, 0.1);
      B(g, 0.32, 0.03, 0.42, COL.folder, -0.52, 0.79, 0.12);
      C(g, 0.045, 0.04, 0.1, '#e8e2d2', 0.85, 0.75, 0.25, 12); // coffee cup
      B(g, 0.22, 0.08, 0.16, '#151515', 0.55, 0.75, -0.25); // telephone
      C(g, 0.02, 0.02, 0.22, '#151515', 0.55, 0.86, -0.25, 8).rotation.z = Math.PI / 2;
    }
    // green banker's lamp
    const lx = d.w / 2 - 0.35, lz = -d.d / 2 + 0.22;
    C(g, 0.09, 0.11, 0.03, COL.brass, lx, 0.75, lz, 16);
    C(g, 0.012, 0.012, 0.3, COL.brass, lx, 0.78, lz, 6);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.12, 16, 1, true, 0, Math.PI), shadeMat);
    shade.rotation.z = Math.PI / 2; shade.rotation.y = Math.PI / 2; shade.position.set(lx, 1.1, lz); shade.castShadow = true; g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#3a3a30' }));
    bulb.position.set(lx, 1.06, lz); g.add(bulb);
    g.updateMatrixWorld();
    const lp = new THREE.Vector3(lx, 1.0, lz + 0.15).applyMatrix4(g.matrixWorld);
    const light = new THREE.PointLight('#ffd890', 0, 3.2, 2); light.position.copy(lp); root.add(light); lampLights.push(light);
    monitors[slot] = (on) => {
      bulb.material.color.set(on ? '#fff3c4' : '#3a3a30');
      light.userData.on = on;
      if (pageMesh) pageMesh.material = on ? typed : blankPage;
    };
    // chair: leather swivel for the chief, wooden for the others
    const seat = L.deskSeat(slot, DESKS);
    const cg = new THREE.Group(); cg.position.set(seat.x, 0, seat.z); cg.rotation.y = d.rot - Math.PI; root.add(cg);
    C(cg, 0.24, 0.26, 0.04, '#2a2a2a', 0, 0, 0, 5);
    C(cg, 0.03, 0.03, 0.36, '#2a2a2a', 0, 0.04, 0, 8);
    B(cg, 0.52, 0.09, 0.48, lead ? COL.leather : COL.oakLight, 0, 0.4, 0);
    B(cg, 0.5, lead ? 0.85 : 0.5, lead ? 0.14 : 0.06, lead ? COL.leatherDark : COL.oak, 0, 0.48, 0.23);
    if (lead) for (const sx of [-1, 1]) B(cg, 0.08, 0.25, 0.42, COL.leatherDark, sx * 0.28, 0.48, 0.02);
    nav.blockOBB(d.x, d.z, d.w, d.d, d.rot, 0.28);
    nav.blockCircle(seat.x, seat.z, 0.28, 0.15);
  }
  updaters.push((dt, t) => {
    page.step(dt);
    lampLights.forEach((l) => { l.intensity = l.userData.on ? 1.8 : 0; });
  });

  // ---------- chief's office extras ----------
  {
    // whiskey cart
    const wx = 10.6, wz = -4.5;
    B(root, 0.8, 0.04, 0.5, COL.brass, wx, 0.75, wz); B(root, 0.8, 0.04, 0.5, COL.brass, wx, 0.35, wz);
    for (const [ex, ez] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(root, 0.015, 0.015, 0.77, COL.brass, wx + ex * 0.37, 0, wz + ez * 0.22, 6);
    for (let i = 0; i < 3; i++) C(root, 0.05, 0.06, 0.26, ['#7a3a12', '#3a5a2a', '#c9a24a'][i], wx - 0.25 + i * 0.2, 0.79, wz - 0.05, 12);
    for (let i = 0; i < 2; i++) C(root, 0.035, 0.03, 0.07, matte('#cfe0e6', { transparent: true, opacity: 0.6 }), wx + 0.25, 0.79, wz + 0.1 - i * 0.12, 10);
    nav.blockBox(wx, wz, 0.8, 0.5, 0.25);
    // coat rack with the chief's coat
    const cx = 11.25, cz = -3.15;
    C(root, 0.2, 0.22, 0.04, COL.oakDark, cx, 0, cz, 12); C(root, 0.025, 0.025, 1.8, COL.oakDark, cx, 0.04, cz, 8);
    B(root, 0.3, 0.6, 0.18, '#6b5a40', cx + 0.12, 1.15, cz);
    nav.blockCircle(cx, cz, 0.25, 0.2);
    cabinet(11.35, -8.2, -Math.PI / 2); cabinet(11.35, -7.55, -Math.PI / 2);
    // oscillating desk fan on a side table
    const fx = 4.6, fz = -8.3;
    B(root, 0.6, 0.7, 0.5, COL.oak, fx, 0, fz);
    const fan = new THREE.Group(); fan.position.set(fx, 0.95, fz); root.add(fan);
    C(root, 0.1, 0.12, 0.04, '#2a2a2a', fx, 0.7, fz, 12); C(root, 0.015, 0.015, 0.2, '#2a2a2a', fx, 0.74, fz, 6);
    const cage = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.008, 6, 24), matte('#3a3a3a')); fan.add(cage);
    const blades = new THREE.Group(); fan.add(blades);
    for (let i = 0; i < 3; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.01), matte('#4a4a4a')); bl.position.y = 0.06; const p = new THREE.Group(); p.rotation.z = i * 2.09; p.add(bl); blades.add(p); }
    updaters.push((dt, t) => { blades.rotation.z += dt * 18; fan.rotation.y = Math.sin(t * 0.6) * 0.7; });
    nav.blockBox(fx, fz, 0.6, 0.5, 0.25);
  }

  // ---------- waiting room ----------
  {
    // low rail between bullpen and waiting room, with a swing gate
    const railRun = (x0, x1) => {
      B(root, x1 - x0, 0.95, 0.1, COL.oak, (x0 + x1) / 2, 0, WAIT.minZ);
      B(root, x1 - x0 + 0.04, 0.06, 0.16, COL.oakDark, (x0 + x1) / 2, 0.95, WAIT.minZ);
      nav.blockRect(x0, x1, WAIT.minZ - 0.05, WAIT.minZ + 0.05, 0.3);
    };
    railRun(WAIT.minX, WAIT.gateMinX); railRun(WAIT.gateMaxX, WAIT.maxX);
    const wallEnd = WAIT.maxZ - 2.5; // gap at the south end opens to reception
    B(root, 0.1, 1.0, wallEnd - WAIT.minZ, COL.oak, WAIT.maxX, 0, (WAIT.minZ + wallEnd) / 2);
    B(root, 0.16, 0.06, wallEnd - WAIT.minZ, COL.oakDark, WAIT.maxX, 1.0, (WAIT.minZ + wallEnd) / 2);
    nav.blockRect(WAIT.maxX - 0.05, WAIT.maxX + 0.05, WAIT.minZ, wallEnd, 0.3);
    // chesterfield sofas
    const sofa = (x, z, rot, w) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; root.add(g);
      B(g, w, 0.4, 0.9, COL.leather, 0, 0, 0);
      B(g, w, 0.82, 0.22, COL.leatherDark, 0, 0, -0.34);
      for (const sx of [-1, 1]) B(g, 0.22, 0.62, 0.9, COL.leatherDark, sx * (w / 2 - 0.11), 0, 0);
      for (let i = 0; i < 3; i++) B(g, (w - 0.5) / 3 - 0.04, 0.1, 0.62, '#6a3424', -w / 2 + 0.25 + (w - 0.5) / 6 + i * (w - 0.5) / 3, 0.4, 0.08, { cast: false });
      nav.blockOBB(x, z, w, 0.9, rot, 0.22);
    };
    sofa(-8.6, 2.6, 0, 3.4);
    sofa(-11.25, 6.3, Math.PI / 2, 3.4);
    // armchair facing west
    for (const az of [6.4, 4.95]) {
      const ag = new THREE.Group(); ag.position.set(-4.25, 0, az); ag.rotation.y = -Math.PI / 2; root.add(ag);
      B(ag, 0.95, 0.4, 0.9, COL.leather, 0, 0, 0); B(ag, 0.95, 0.85, 0.22, COL.leatherDark, 0, 0, -0.34);
      for (const sx of [-1, 1]) B(ag, 0.2, 0.62, 0.9, COL.leatherDark, sx * 0.38, 0, 0);
      nav.blockOBB(-4.25, az, 0.95, 0.9, -Math.PI / 2, 0.22);
    }
    // coffee table with magazines, radio cabinet with a glowing dial
    B(root, 1.4, 0.05, 0.8, COL.oakDark, -8.2, 0.42, 5.6);
    for (const [ex, ez] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(root, 0.05, 0.42, 0.05, COL.oakDark, -8.2 + ex * 0.62, 0, 5.6 + ez * 0.32);
    B(root, 0.3, 0.02, 0.22, '#b22a22', -8.5, 0.47, 5.55); B(root, 0.28, 0.02, 0.2, '#e8e2d2', -8.0, 0.47, 5.65);
    nav.blockBox(-8.2, 5.6, 1.4, 0.8, 0.25);
    const rx = -6.4, rz = 8.3;
    B(root, 1.0, 1.0, 0.45, COL.oak, rx, 0, rz);
    const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.12), glow('#ffb84a'));
    dial.position.set(rx, 0.8, rz - 0.23); dial.rotation.y = Math.PI; root.add(dial);
    B(root, 0.7, 0.4, 0.02, '#3a2a1a', rx, 0.3, rz - 0.23, { cast: false });
    updaters.push((dt, t) => { dial.material.color.setScalar(0.85 + Math.sin(t * 3) * 0.08); dial.material.color.multiply(new THREE.Color('#ffb84a')); });
    nav.blockBox(rx, rz, 1.0, 0.45, 0.25);
    // entrance door on the west wall with lettering
    const dz = 7.4, dw = 1.2;
    const dr = B(root, 0.06, 2.25, dw, COL.oak, L.LEFT_WALL_X + 0.04, 0, dz, { cast: false }); westDecor.push(dr);
    const dg = B(root, 0.03, 1.0, dw - 0.25, frost, L.LEFT_WALL_X + 0.08, 1.05, dz, { cast: false }); westDecor.push(dg);
    const ds = new THREE.Mesh(new THREE.PlaneGeometry(dw - 0.3, 0.3), new THREE.MeshBasicMaterial({ map: textTexture(`${String(title).toUpperCase()} · INVESTIGATIONS`, { font: `700 34px ${SERIF}`, color: '#1a1a1a', w: 640, h: 96, size: 34, spacing: 0.04 }), transparent: true, depthWrite: false }));
    ds.rotation.y = Math.PI / 2; ds.position.set(L.LEFT_WALL_X + 0.1, 1.7, dz); root.add(ds); westDecor.push(ds);
    floorPlane(root, 4, 0.9, T.floorLabel('Waiting Room', '#8a7f68', 4, 0.9), -8.0, 8.25, 0.008, { transparent: true });
  }

  // ---------- reception ----------
  {
    const rx = 0.4, rz = 4.2;
    const g = new THREE.Group(); g.position.set(rx, 0, rz); root.add(g);
    B(g, 2.6, 1.05, 0.6, COL.oak, 0, 0, 0); B(g, 2.7, 0.05, 0.7, COL.oakDark, 0, 1.05, 0);
    B(g, 0.46, 0.13, 0.36, '#1a1a1a', -0.6, 1.1, 0.05);
    C(g, 0.13, 0.1, 0.32, '#c9c6bb', 0.8, 1.1, 0, 16); C(g, 0.04, 0.04, 0.12, '#2a2a2a', 0.8, 1.42, 0, 8); // percolator
    B(g, 0.12, 0.1, 0.12, '#151515', 0.3, 1.1, -0.1);
    nav.blockBox(rx, rz, 2.6, 0.6, 0.25);
    floorPlane(root, 3, 0.8, T.floorLabel('Reception', '#8a7f68', 3, 0.8), 0.4, 6.3, 0.008, { transparent: true });
    for (const [x, z] of [[-2.6, 8.2], [3.9, 8.2]]) { // potted palms
      C(root, 0.22, 0.18, 0.45, '#8a5a3a', x, 0, z, 16);
      for (let i = 0; i < 7; i++) { const leaf = B(root, 0.06, 0.7, 0.015, matte(i % 2 ? '#3f6a32' : '#55803f'), x + Math.cos(i) * 0.08, 0.45, z + Math.sin(i) * 0.08); leaf.rotation.set(Math.sin(i * 1.7) * 0.6, i, Math.cos(i * 1.3) * 0.6); }
      nav.blockCircle(x, z, 0.25, 0.25);
    }
  }

  // ---------- interview room ----------
  {
    const r = INTERVIEW;
    const wall = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0), horiz = Math.abs(z1 - z0) < 0.01;
      B(root, horiz ? len : 0.15, 1.05, horiz ? 0.15 : len, plasterMat(len), (x0 + x1) / 2, 0, (z0 + z1) / 2);
      B(root, horiz ? len : 0.2, 0.05, horiz ? 0.2 : len, COL.oakDark, (x0 + x1) / 2, 1.05, (z0 + z1) / 2, { cast: false });
      nav.blockRect(Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1), 0.3);
    };
    wall(r.minX, r.minZ, r.maxX, r.minZ);
    wall(r.minX, r.minZ, r.minX, r.doorMinZ); wall(r.minX, r.doorMaxZ, r.minX, r.maxZ);
    const tx = 8.4, tz = 4.4;
    B(root, 1.8, 0.05, 1.0, '#6b6e6a', tx, 0.74, tz);
    for (const [ex, ez] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(root, 0.04, 0.74, 0.04, '#3a3a3a', tx + ex * 0.82, 0, tz + ez * 0.42);
    B(root, 0.3, 0.02, 0.4, COL.folder, tx - 0.2, 0.79, tz);
    C(root, 0.06, 0.05, 0.06, '#9aa0a6', tx + 0.5, 0.79, tz - 0.2, 10); // ashtray
    for (const sz of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(tx, 0, tz + sz * 0.95); g.rotation.y = sz > 0 ? 0 : Math.PI; root.add(g);
      for (const [ex, ez] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(g, 0.04, 0.44, 0.04, '#3a3a3a', ex * 0.19, 0, ez * 0.19);
      B(g, 0.44, 0.04, 0.44, '#6b6e6a', 0, 0.44, 0); B(g, 0.44, 0.45, 0.04, '#6b6e6a', 0, 0.48, 0.2);
    }
    nav.blockBox(tx, tz, 1.8, 2.6, 0.25);
    // the single hanging lamp
    C(root, 0.006, 0.006, 1.2, '#1a1a1a', tx, 2.0, tz, 4);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.22, 20, 1, true), matte('#2a2a2a', { side: THREE.DoubleSide }));
    shade.position.set(tx, 2.0, tz); root.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glow('#fff2c8')); bulb.position.set(tx, 1.92, tz); root.add(bulb);
    const lamp = new THREE.SpotLight('#ffe8b8', 18, 6, 0.75, 0.6, 1.5);
    lamp.position.set(tx, 1.95, tz); lamp.target.position.set(tx, 0, tz); root.add(lamp, lamp.target);
    floorPlane(root, 3.4, 0.8, T.floorLabel('Interview', '#8a8478', 3.4, 0.8), 8.4, 8.25, 0.008, { transparent: true });
  }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight('#e8e0d0', '#2a1e14', 1.2);
  const key = keyLight('#fff0dc', 1.4);
  const ceiling = [[-8, -5.3], [-2.6, -5.3], [8.2, -5.0], [-8, 5.0], [0.4, 4.5], [8.4, 4.4]].map(([x, z]) => { const l = new THREE.PointLight('#ffd8a0', 0.6, 7, 1.8); l.position.set(x, 2.9, z); return l; });
  const neon = new THREE.PointLight('#ff3a4a', 0, 9, 1.6); neon.position.set(-3.5, 2.4, -7.6);
  root.add(hemi, key, key.target, neon, ...ceiling);
  const TOD = {
    day:     { hemi: 1.35, key: ['#e6ecf2', 1.5], stripe: ['#e8f0ff', 90], ceil: 0.4, neon: 0 },
    evening: { hemi: 0.95, key: ['#ffc48a', 1.2], stripe: ['#ffb060', 160], ceil: 1.2, neon: 0 },
    night:   { hemi: 0.5,  key: ['#8ea0d8', 0.45], stripe: ['#7f9cff', 50], ceil: 1.8, neon: 3.2 },
  };
  let todNow = 'day';
  function setTimeOfDay(tod) {
    todNow = tod;
    const p = TOD[tod];
    hemi.intensity = p.hemi; key.color.set(p.key[0]); key.intensity = p.key[1];
    stripeLight.color.set(p.stripe[0]); stripeLight.intensity = p.stripe[1];
    ceiling.forEach((l) => { l.intensity = p.ceil; });
    view.setTod(tod);
  }
  setTimeOfDay('day');
  let neonT = 0, neonOn = true;
  updaters.push((dt) => {
    view.draw(dt);
    if (todNow !== 'night') { neon.intensity = 0; return; }
    neonT -= dt;
    if (neonT < 0) { // mostly on, with the odd stutter
      neonOn = neonOn ? Math.random() > 0.35 : true;
      neonT = neonOn ? 0.6 + Math.random() * 2.5 : 0.06 + Math.random() * 0.14;
    }
    view.setNeon(neonOn); neon.intensity = neonOn ? TOD.night.neon : 0.3;
  });

  let time = 0;
  updaters.unshift((dt) => { time += dt; });

  return {
    root, nav, monitors, setTimeOfDay, heightAt, cutaway,
    layout: { desks: DESKS, loungeSeats: LOUNGE_SEATS },
    background: '#0c0a08',
    bloom: { strength: 0.2, radius: 0.4, threshold: 0.86 },
    todLabels: { day: 'Overcast', evening: 'Dusk', night: 'Midnight' },
    dressBot,
    setUsage: (u) => usageBoard.draw(u),
    update: (dt) => updaters.forEach((f) => f(dt, time)),
  };
}

// fedora + trench-coat collar; the chief's hat has a red band; handoffs are manila case files
function dressBot(bot, member, isLead) {
  const add = (mat, geo, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.userData.botId = member.id; bot.body.add(m); return m; };
  const hatCol = T.mix(member.color, '#2a2420', 0.65);
  const felt = new THREE.MeshLambertMaterial({ color: hatCol });
  add(felt, new THREE.CylinderGeometry(0.3, 0.3, 0.025, 20), 0, 1.205, 0);          // brim
  add(felt, new THREE.CylinderGeometry(0.15, 0.18, 0.17, 16), 0, 1.3, 0);            // crown
  add(new THREE.MeshLambertMaterial({ color: isLead ? '#a51d1d' : '#1a1612' }), new THREE.CylinderGeometry(0.182, 0.182, 0.04, 16), 0, 1.24, 0); // band
  add(new THREE.MeshLambertMaterial({ color: '#b8a582' }), new THREE.BoxGeometry(0.46, 0.1, 0.28), 0, 0.84, -0.01); // trench collar
  add(new THREE.MeshLambertMaterial({ color: '#8a7a5a' }), new THREE.BoxGeometry(0.44, 0.05, 0.27), 0, 0.5, 0);      // belt
  bot.paper.material = new THREE.MeshLambertMaterial({ color: COL.folder });
  bot.paper.scale.set(0.24, 0.04, 0.32);
}
