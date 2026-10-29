// Medieval scriptorium. Same floor plan as the office:
//   lead's glass office → the abbot's raised study (oak balustrade, steps)
//   desks               → slanted scribe desks: the candle is lit and the
//                         manuscript fills with writing while someone works
//   server racks        → tall bookcases with flickering candle sconces
//   research screens    → hanging parchment map, star chart and ledger + an orrery
//   windows             → arched leaded windows (morning / vespers / candlelight)
//   lounge              → refectory benches around an iron brazier
//   break room          → kitchen with barrels, bread and a water butt
//   huddle table        → chapter table with candles and scrolls
//   handoffs            → rolled scrolls with red wax seals; everyone wears a hooded robe
import * as THREE from 'three';
import * as L from '../layout.js';
import { NavGrid } from '../pathfinding.js';
import * as T from '../textures.js';
import { B, C, floorPlane, matte, glow, zoneTexture, flame, relabel, keyLight, createCutaway } from './kit.js';

// ---------- floor plan: monastery ----------
//   nave (north-west): scribes' carrels under arched windows, pillars down the middle,
//     the abbot's raised apse at the west end, a library corner at the east end
//   refectory (north-east): hearth, long table, kitchen
//   cloister (south strip): garden with a well; idle monks sit on the benches
const NAVE = { minX: -11.75, maxX: 4.3, minZ: -8.75, maxZ: 1.4 };
const REF = { minX: 4.7, maxX: 11.75, minZ: -8.75, maxZ: 1.4 };
const CLOISTER = { minX: -11.75, maxX: 11.75, minZ: 1.8, maxZ: 8.75 };
const APSE = { x: -10.2, z: -3.6, r: 2.1, ramp: 0.45, h: 0.28 };
const WELL = { x: -3.6, z: 5.3, r: 0.9 };
const DESKS = {
  lead:         { x: -9.55, z: -3.6, w: 1.7, d: 0.7, rot: Math.PI / 2, approach: { x: -10.45, z: -2.35 } },
  'back-left':  { x: -7.4, z: -7.55, w: 1.8, d: 0.8, rot: Math.PI },
  'back-mid':   { x: -4.4, z: -7.55, w: 1.8, d: 0.8, rot: Math.PI },
  'back-right': { x: -1.4, z: -7.55, w: 1.8, d: 0.8, rot: Math.PI },
  'mid-left':   { x: -4.4, z: -0.6, w: 1.8, d: 0.8, rot: 0 },
  'mid-right':  { x: -1.4, z: -0.6, w: 1.8, d: 0.8, rot: 0 },
  'front-left': { x: -7.4, z: -0.6, w: 1.8, d: 0.8, rot: 0 },
  'front-right':{ x: 1.6,  z: -0.6, w: 1.8, d: 0.8, rot: 0 },
};
const PILLARS = [-7.4, -4.4, -1.4, 1.6].map((x) => ({ x: x + 1.5, z: -4.1 }));
const BENCHES = [0, 1, 2, 3].map((i) => {
  const a = i * Math.PI / 2 + Math.PI / 4, d = 2.45;
  return { x: WELL.x + Math.sin(a) * d, z: WELL.z + Math.cos(a) * d, rot: a + Math.PI }; // facing the well
});
const LOUNGE_SEATS = [];
for (const b of BENCHES) for (const off of [-0.45, 0.45]) {
  const rx = -Math.cos(b.rot), rz = Math.sin(b.rot);
  LOUNGE_SEATS.push(L.benchSeat(b.x + rx * off, b.z + rz * off, b.rot, 0.8));
}
function heightAt(x, z) {
  const d = Math.hypot(x - APSE.x, z - APSE.z);
  if (d <= APSE.r) return APSE.h;
  if (d < APSE.r + APSE.ramp) return APSE.h * (1 - (d - APSE.r) / APSE.ramp);
  return 0;
}
function grass() {
  const S = 512, c = T.canvas(S, S), g = c.getContext('2d'), r = T.rng(12);
  g.fillStyle = '#4f6b35'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `hsl(${85 + r() * 25}, ${30 + r() * 20}%, ${24 + r() * 18}%)`; g.fillRect(r() * S, r() * S, 2, 3 + r() * 5); }
  return T.tex(c, { repeat: [4, 2] });
}
const SERIF = 'Georgia, "Palatino Linotype", "Times New Roman", serif';
const COL = { oak: '#6b4a2f', oakDark: '#4a3220', oakLight: '#8a6443', iron: '#2b2a2a', parchment: '#eadfc4', stone: '#8c8476', red: '#7d2a22', gold: '#c9a24a', cushion: '#7a2d26' };

// ---------- textures ----------
function flagstones() {
  const S = 1024, c = T.canvas(S, S), g = c.getContext('2d'), r = T.rng(21);
  g.fillStyle = '#4b453d'; g.fillRect(0, 0, S, S);
  let y = 0;
  while (y < S) {
    const rh = 120 + r() * 90; let x = -r() * 100;
    while (x < S) {
      const w = 140 + r() * 160, l = 42 + r() * 12, hue = 30 + r() * 12;
      g.fillStyle = `hsl(${hue}, ${8 + r() * 6}%, ${l}%)`;
      g.beginPath();
      const j = () => (r() - 0.5) * 8;
      g.moveTo(x + 5 + j(), y + 5 + j()); g.lineTo(x + w - 5 + j(), y + 5 + j()); g.lineTo(x + w - 5 + j(), y + rh - 5 + j()); g.lineTo(x + 5 + j(), y + rh - 5 + j());
      g.closePath(); g.fill();
      g.globalAlpha = 0.07;
      for (let k = 0; k < 40; k++) { g.fillStyle = r() > 0.5 ? '#fff' : '#000'; g.beginPath(); g.arc(x + r() * w, y + r() * rh, 1 + r() * 6, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      x += w;
    }
    y += rh;
  }
  return T.tex(c, { repeat: [5, 3.75] });
}

function ashlar(repeat) {
  const S = 512, c = T.canvas(S, S), g = c.getContext('2d'), r = T.rng(31);
  g.fillStyle = '#5a5248'; g.fillRect(0, 0, S, S);
  const rh = 64;
  for (let y = 0, row = 0; y < S; y += rh, row++) {
    let x = row % 2 ? -64 : 0;
    while (x < S) {
      const w = 110 + r() * 50;
      g.fillStyle = `hsl(${32 + r() * 8}, ${9 + r() * 5}%, ${44 + r() * 10}%)`;
      g.fillRect(x + 3, y + 3, w - 6, rh - 6);
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + 3, y + 3, w - 6, 4);
      x += w;
    }
  }
  return T.tex(c, { repeat });
}

// Shared animated manuscript: lines of script appear while the scribes work
class Manuscript {
  constructor() {
    this.c = T.canvas(512, 384); this.g = this.c.getContext('2d'); this.texture = T.tex(this.c);
    this.r = T.rng(4); this.lines = 0; this.acc = 0; this.page();
  }
  page() {
    const { g } = this;
    g.fillStyle = COL.parchment; g.fillRect(0, 0, 512, 384);
    g.fillStyle = 'rgba(120,90,50,.12)'; g.fillRect(0, 0, 512, 10); g.fillRect(0, 374, 512, 10);
    // illuminated initial
    g.fillStyle = '#2d4a8a'; g.fillRect(36, 36, 64, 64);
    g.strokeStyle = COL.gold; g.lineWidth = 4; g.strokeRect(40, 40, 56, 56);
    g.fillStyle = '#b23a2a'; g.font = `700 52px ${SERIF}`; g.fillText('Q', 46, 88);
    this.lines = 0;
    this.texture.needsUpdate = true;
  }
  step(dt) {
    this.acc += dt; if (this.acc < 0.45) return; this.acc = 0;
    if (this.lines >= 14) { this.page(); return; }
    const { g, r } = this, y = 52 + this.lines * 22, x0 = this.lines < 3 ? 116 : 36;
    g.strokeStyle = '#2a1d12'; g.lineWidth = 2.2; g.beginPath();
    let x = x0;
    g.moveTo(x, y);
    while (x < 470) {
      const w = 14 + r() * 26;
      for (let k = 0; k < w; k += 4) g.lineTo(x + k, y + Math.sin((x + k) * 0.9) * 3 - (r() > 0.92 ? 6 : 0));
      x += w + 8; g.moveTo(x, y);
    }
    g.stroke();
    this.lines++;
    this.texture.needsUpdate = true;
  }
}

function leadedWindow() {
  const W = 256, H = 384, c = T.canvas(W, H), g = c.getContext('2d');
  const t = T.tex(c);
  const draw = (tod) => {
    const sky = { day: ['#dfe9ef', '#bcd2de'], evening: ['#ffcf8a', '#e2895a'], night: ['#1b2440', '#0d1328'] }[tod];
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // coloured border panes
    const pane = ['#8a2a2a', '#2d4a8a', '#c9a24a', '#2f6b4a'];
    g.globalAlpha = tod === 'night' ? 0.35 : 0.6;
    for (let y = 0; y < H; y += 32) { g.fillStyle = pane[(y / 32) % 4]; g.fillRect(0, y, 20, 32); g.fillRect(W - 20, y, 20, 32); }
    g.globalAlpha = 1;
    // diamond leading
    g.strokeStyle = 'rgba(40,36,32,.85)'; g.lineWidth = 3;
    for (let k = -H; k < W + H; k += 36) {
      g.beginPath(); g.moveTo(k, 0); g.lineTo(k + H, H); g.stroke();
      g.beginPath(); g.moveTo(k, H); g.lineTo(k + H, 0); g.stroke();
    }
    if (tod === 'night') { g.fillStyle = 'rgba(240,240,220,.9)'; g.beginPath(); g.arc(170, 120, 18, 0, 7); g.fill(); }
    // stone outside the arch
    g.fillStyle = '#6a6256';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(W, W / 2); g.arc(W / 2, W / 2, W / 2, 0, Math.PI, true); g.lineTo(0, 0); g.fill();
    g.strokeStyle = '#3a342c'; g.lineWidth = 10;
    g.beginPath(); g.moveTo(5, H); g.lineTo(5, W / 2); g.arc(W / 2, W / 2, W / 2 - 5, Math.PI, 0); g.lineTo(W - 5, H); g.stroke();
    t.needsUpdate = true;
  };
  draw('day');
  return { texture: t, draw };
}

function shaftTexture() {
  const c = T.canvas(64, 256), g = c.getContext('2d');
  for (let x = 0; x < 64; x++) {
    const side = Math.sin((x / 63) * Math.PI) ** 2;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, `rgba(255,240,200,${0.5 * side})`); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.fillRect(x, 0, 1, 256);
  }
  return T.tex(c);
}

function parchmentSheet(kind) {
  const c = T.canvas(512, 400), g = c.getContext('2d'), r = T.rng(kind.length * 7);
  g.fillStyle = COL.parchment; g.fillRect(0, 0, 512, 400);
  g.strokeStyle = 'rgba(110,80,40,.5)'; g.lineWidth = 6; g.strokeRect(10, 10, 492, 380);
  g.fillStyle = '#3a2614'; g.font = `700 26px ${SERIF}`; g.fillText(kind === 'map' ? 'MAPPA MUNDI' : kind === 'stars' ? 'COELUM' : 'LIBER RATIONUM', 30, 46);
  if (kind === 'map') {
    g.fillStyle = 'rgba(80,110,90,.55)';
    for (let k = 0; k < 6; k++) { g.beginPath(); const cx = 80 + r() * 350, cy = 110 + r() * 230; for (let a = 0; a < 7; a += 0.5) { const rr = 30 + r() * 45; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7); } g.fill(); }
    g.strokeStyle = '#8b2e1f'; g.lineWidth = 2; g.beginPath(); g.arc(420, 320, 40, 0, 7); g.stroke();
    for (let a = 0; a < 8; a++) { g.beginPath(); g.moveTo(420, 320); g.lineTo(420 + Math.cos(a * Math.PI / 4) * 52, 320 + Math.sin(a * Math.PI / 4) * 52); g.stroke(); }
  } else if (kind === 'stars') {
    g.strokeStyle = 'rgba(60,40,20,.5)'; g.lineWidth = 2;
    for (const rad of [60, 110, 160]) { g.beginPath(); g.arc(256, 225, rad, 0, 7); g.stroke(); }
    g.fillStyle = '#2d4a8a';
    const pts = Array.from({ length: 16 }, () => [100 + r() * 312, 80 + r() * 290]);
    pts.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
    g.beginPath(); pts.slice(0, 6).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  } else {
    g.strokeStyle = '#2a1d12'; g.lineWidth = 2;
    for (let y = 80; y < 380; y += 24) { g.beginPath(); g.moveTo(30, y); g.lineTo(300 + r() * 100, y); g.stroke(); g.fillStyle = '#8b2e1f'; g.fillRect(430, y - 8, 40, 4); }
  }
  return T.tex(c);
}

function tapestry() {
  const c = T.canvas(320, 480), g = c.getContext('2d');
  g.fillStyle = '#5c1f1a'; g.fillRect(0, 0, 320, 480);
  g.strokeStyle = COL.gold; g.lineWidth = 10; g.strokeRect(14, 14, 292, 452);
  g.fillStyle = 'rgba(201,162,74,.85)';
  for (let y = 70; y < 440; y += 90) for (let x = 70; x < 300; x += 90) { g.beginPath(); g.moveTo(x, y - 26); g.lineTo(x + 22, y); g.lineTo(x, y + 26); g.lineTo(x - 22, y); g.fill(); }
  return T.tex(c);
}

// ---------- builder ----------
export function buildScriptorium({ team, leadId, desks }) {
  const root = new THREE.Group();
  const nav = new NavGrid();
  const updaters = [];
  const bySlot = Object.fromEntries(team.filter((t) => desks[t.id]).map((t) => [desks[t.id], t]));
  const labels = [[/architect|lead|chief/, 'Abbot'], [/build|engineer|develop/, 'Scribe'], [/review|qa/, 'Corrector'], [/freelanc/, 'Scholar']];
  const H = L.WALL_H, T_ = 0.3;

  // ---------- floors ----------
  const fw = L.FLOOR.maxX - L.FLOOR.minX, fd = L.FLOOR.maxZ - L.FLOOR.minZ;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.25, fd), [
    matte('#3d372f'), matte('#3d372f'), new THREE.MeshStandardMaterial({ map: flagstones(), roughness: 0.92 }),
    matte('#3d372f'), matte('#332e27'), matte('#332e27'),
  ]);
  floor.position.y = -0.125; floor.receiveShadow = true; root.add(floor);
  // garden lawn inside the cloister walk
  const lawn = { minX: -9.6, maxX: 2.4, minZ: 3.6, maxZ: 7.2 };
  floorPlane(root, lawn.maxX - lawn.minX, lawn.maxZ - lawn.minZ, grass(), (lawn.minX + lawn.maxX) / 2, (lawn.minZ + lawn.maxZ) / 2, 0.006);
  B(root, lawn.maxX - lawn.minX + 0.2, 0.08, 0.1, '#6a6256', (lawn.minX + lawn.maxX) / 2, 0, lawn.minZ - 0.05);
  B(root, lawn.maxX - lawn.minX + 0.2, 0.08, 0.1, '#6a6256', (lawn.minX + lawn.maxX) / 2, 0, lawn.maxZ + 0.05);
  B(root, 0.1, 0.08, lawn.maxZ - lawn.minZ, '#6a6256', lawn.minX - 0.05, 0, (lawn.minZ + lawn.maxZ) / 2);
  B(root, 0.1, 0.08, lawn.maxZ - lawn.minZ, '#6a6256', lawn.maxX + 0.05, 0, (lawn.minZ + lawn.maxZ) / 2);

  // carrel rugs with the role lettered in
  for (const [slot, d] of Object.entries(DESKS)) {
    if (slot === 'lead') continue;
    const m = bySlot[slot], color = m?.color || '#8a7b62';
    const w = d.w + 0.6, dd = 2.6;
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); g.rotation.y = d.rot - Math.PI; root.add(g);
    floorPlane(g, w, dd, zoneTexture(T.mix(color, COL.gold, 0.35), relabel(m, labels, 'Empty Carrel'), w, dd, { base: T.mix(color, '#3b2a20', 0.8), fill: 0, border: 0.75, font: `700 {S}px ${SERIF}` }), 0, dd / 2 - d.d / 2 - 0.1, 0.006);
  }
  floorPlane(root, 5.6, 1.2, zoneTexture('#c9b48a', 'Refectory', 5.6, 1.2, { fill: 0, border: 0, font: `700 {S}px ${SERIF}`, labelAlpha: 0.7 }), 8.2, 0.6, 0.006, { transparent: true, depthWrite: false });
  floorPlane(root, 5.0, 1.2, zoneTexture('#c9b48a', 'Cloister', 5.0, 1.2, { fill: 0, border: 0, font: `700 {S}px ${SERIF}`, labelAlpha: 0.7 }), -3.6, 8.1, 0.006, { transparent: true, depthWrite: false });

  // ---------- walls ----------
  const wallStone = (w, repeatX) => new THREE.MeshStandardMaterial({ map: ashlar([repeatX ?? w / 3, 1.1]), roughness: 0.95 });
  const wallZ = L.BACK_WALL_Z - T_ / 2, wallX = L.LEFT_WALL_X - T_ / 2;
  const cutaway = createCutaway();
  const westG = new THREE.Group(), northG = new THREE.Group(); root.add(westG, northG);
  const westDecor = [], northDecor = [];
  cutaway.add(westG, -1, 0, { decor: westDecor });
  cutaway.add(northG, 0, -1, { decor: northDecor });
  // west wall (nave) tall, cloister part low
  B(westG, T_, H, NAVE.maxZ - L.FLOOR.minZ + 0.3, wallStone(10), wallX, 0, (L.FLOOR.minZ + NAVE.maxZ + 0.3) / 2);
  B(root, T_, 1.1, L.FLOOR.maxZ - NAVE.maxZ, wallStone(3, 2), wallX, 0, (NAVE.maxZ + L.FLOOR.maxZ) / 2);
  // north wall: windows over the carrels, solid elsewhere
  const winFrom = -9.1, winTo = 0.2;
  const stoneMat = new THREE.MeshStandardMaterial({ map: ashlar([4, 0.4]), roughness: 0.95 });
  B(northG, winFrom - L.FLOOR.minX, H, T_, wallStone(winFrom - L.FLOOR.minX), (L.FLOOR.minX + winFrom) / 2, 0, wallZ);
  B(northG, L.FLOOR.maxX - winTo, H, T_, wallStone(L.FLOOR.maxX - winTo), (winTo + L.FLOOR.maxX) / 2, 0, wallZ);
  const winW = winTo - winFrom;
  B(northG, winW, 0.95, T_, stoneMat, winFrom + winW / 2, 0, wallZ);
  B(northG, winW, 0.45, T_, stoneMat, winFrom + winW / 2, H - 0.45, wallZ);
  const nWin = 3, ww = 1.7, wh = H - 1.4;
  const windows = leadedWindow();
  const shafts = [];
  const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35, side: THREE.DoubleSide });
  let px = winFrom;
  for (let i = 0; i < nWin; i++) {
    const cx = DESKS[['back-left', 'back-mid', 'back-right'][i]].x;
    B(northG, cx - ww / 2 - px, wh, T_, stoneMat, (px + cx - ww / 2) / 2, 0.95, wallZ);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: windows.texture }));
    win.position.set(cx, 0.95 + wh / 2, wallZ); root.add(win); northDecor.push(win);
    B(northG, ww + 0.1, 0.08, 0.35, COL.oakDark, cx, 0.9, wallZ + 0.12, { cast: false });
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(ww * 0.9, 3.6), shaftMat);
    shaft.position.set(cx + 0.2, 1.3, L.BACK_WALL_Z + 1.6); shaft.rotation.set(-1.0, 0, 0.08); root.add(shaft); shafts.push(shaft);
    px = cx + ww / 2;
  }
  B(northG, winTo - px, wh, T_, stoneMat, (px + winTo) / 2, 0.95, wallZ);
  // timber wall plates
  B(westG, 0.25, 0.25, NAVE.maxZ - L.FLOOR.minZ, COL.oakDark, L.LEFT_WALL_X + 0.1, H - 0.25, (L.FLOOR.minZ + NAVE.maxZ) / 2);
  B(northG, fw, 0.25, 0.25, COL.oakDark, 0, H - 0.25, L.BACK_WALL_Z + 0.1);

  // nave / refectory partition (low, with a doorway) and the nave's south arcade (low wall + arches)
  const lowWall = (x0, z0, x1, z1, h = 1.05) => {
    const len = Math.hypot(x1 - x0, z1 - z0), horiz = Math.abs(z1 - z0) < 0.01;
    B(root, horiz ? len : 0.35, h, horiz ? 0.35 : len, wallStone(len / 3, 0.4), (x0 + x1) / 2, 0, (z0 + z1) / 2);
    B(root, horiz ? len + 0.05 : 0.42, 0.08, horiz ? 0.42 : len + 0.05, '#7a7062', (x0 + x1) / 2, h, (z0 + z1) / 2, { cast: false });
    nav.blockRect(Math.min(x0, x1) - (horiz ? 0 : 0.18), Math.max(x0, x1) + (horiz ? 0 : 0.18), Math.min(z0, z1) - (horiz ? 0.18 : 0), Math.max(z0, z1) + (horiz ? 0.18 : 0), 0.3);
  };
  const PX = 4.5, PZ = 1.6;
  lowWall(PX, L.FLOOR.minZ, PX, -3.3); lowWall(PX, -1.9, PX, PZ);
  lowWall(L.FLOOR.minX, PZ, -6.6, PZ); lowWall(-5.2, PZ, -2.2, PZ); lowWall(-0.8, PZ, PX, PZ);
  lowWall(PX, PZ, 7.6, PZ); lowWall(8.9, PZ, L.FLOOR.maxX, PZ);
  // arcade columns along the cloister walk
  const column = (x, z, h = 2.6) => {
    C(root, 0.2, 0.24, 0.22, '#7a7062', x, 0, z, 16);
    C(root, 0.16, 0.16, h - 0.44, '#9a9080', x, 0.22, z, 16);
    C(root, 0.24, 0.18, 0.22, '#7a7062', x, h - 0.22, z, 16);
    nav.blockCircle(x, z, 0.22, 0.25);
  };
  for (let x = -10.6; x <= 3.5; x += 2.35) column(x, 2.6);
  for (let z = 4.0; z <= 7.6; z += 1.8) column(-10.6, z);

  // ---------- the abbot's apse ----------
  {
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(APSE.r, APSE.r + APSE.ramp, APSE.h, 48, 1, false, 0, Math.PI), matte('#5a4632'));
    plat.rotation.y = 0; plat.position.set(APSE.x, APSE.h / 2, APSE.z); plat.receiveShadow = true; plat.castShadow = true; root.add(plat);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(APSE.r, APSE.r + APSE.ramp, APSE.h, 48, 1, false, Math.PI, Math.PI), matte('#5a4632'));
    back.position.copy(plat.position); root.add(back);
    // red runner and a tapestry behind the abbot
    const rug = new THREE.Mesh(new THREE.CircleGeometry(APSE.r - 0.15, 48), new THREE.MeshStandardMaterial({ color: '#5c1f1a', roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(APSE.x, APSE.h + 0.004, APSE.z); root.add(rug);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(APSE.r - 0.3, 0.025, 6, 64), matte(COL.gold)); ring.rotation.x = -Math.PI / 2; ring.position.set(APSE.x, APSE.h + 0.01, APSE.z); root.add(ring);
    const tap = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.1), new THREE.MeshStandardMaterial({ map: tapestry(), roughness: 1 }));
    tap.rotation.y = Math.PI / 2; tap.position.set(L.LEFT_WALL_X + 0.05, 1.75, APSE.z); root.add(tap); westDecor.push(tap);
    // lectern with an open book
    const lx = -9.1, lz = -5.2, y0 = APSE.h;
    C(root, 0.22, 0.3, 0.06, COL.oakDark, lx, y0, lz);
    C(root, 0.06, 0.08, 1.0, COL.oak, lx, y0 + 0.06, lz, 10);
    const top = B(root, 0.6, 0.05, 0.45, COL.oak, lx, y0 + 1.06, lz); top.rotation.x = 0.35;
    const book = B(root, 0.5, 0.04, 0.36, COL.parchment, lx, y0 + 1.1, lz); book.rotation.x = 0.35;
    nav.blockCircle(lx, lz, 0.35, 0.25);
    for (const z of [-5.5, -1.7]) { C(root, 0.06, 0.08, 1.3, COL.iron, -10.9, y0, z, 8); C(root, 0.05, 0.05, 0.25, '#efe6cf', -10.9, y0 + 1.3, z, 8); flame(root, updaters, -10.9, y0 + 1.55, z, 1.2); nav.blockCircle(-10.9, z, 0.12, 0.25); }
  }

  // ---------- desks ----------
  const manuscript = new Manuscript();
  const writing = new THREE.MeshStandardMaterial({ map: manuscript.texture, roughness: 0.95 });
  const blank = new THREE.MeshStandardMaterial({ color: COL.parchment, roughness: 0.95 });
  const monitors = {};
  const candleLights = [];
  for (const [slot, d] of Object.entries(DESKS)) {
    const lead = slot === 'lead';
    const who = bySlot[slot];
    const y0 = lead ? APSE.h : 0;
    const wood = lead ? COL.oakDark : COL.oak;
    // local frame: desk at origin, the writer faces -z, stool at +z
    const g = new THREE.Group(); g.position.set(d.x, y0, d.z); g.rotation.y = d.rot - Math.PI; root.add(g);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) B(g, 0.08, 0.72, 0.08, COL.oakDark, dx * (d.w / 2 - 0.08), 0, dz * (d.d / 2 - 0.08));
    B(g, d.w - 0.2, 0.06, 0.06, COL.oakDark, 0, 0.18, 0);
    const a = 0.3;
    const top = B(g, d.w, 0.05, d.d, wood, 0, 0.74, 0); top.rotation.x = a;
    const ledge = B(g, d.w, 0.05, 0.05, COL.oakDark, 0, 0.66, d.d / 2); ledge.rotation.x = a;
    const page = new THREE.Mesh(new THREE.PlaneGeometry(d.w * 0.42, d.d * 0.62), blank);
    page.rotation.x = -Math.PI / 2 + a; page.position.set(-0.15, 0.795, 0.02); g.add(page);
    B(g, d.w, 0.04, 0.18, COL.oakDark, 0, 0.95, -(d.d / 2 - 0.05));
    C(g, 0.05, 0.055, 0.07, '#1a1a1e', 0.35, 0.99, -(d.d / 2 - 0.05), 12);
    const quill = C(g, 0.006, 0.006, 0.28, '#f1ece0', 0.37, 1.05, -(d.d / 2 - 0.05), 6); quill.rotation.z = 0.35;
    C(g, 0.045, 0.06, 0.03, COL.iron, -0.6, 0.99, -(d.d / 2 - 0.05), 12);
    C(g, 0.03, 0.03, 0.16, '#efe6cf', -0.6, 1.02, -(d.d / 2 - 0.05), 10);
    g.updateMatrixWorld();
    const candle = new THREE.Vector3(-0.6, 1.18, -(d.d / 2 - 0.05)).applyMatrix4(g.matrixWorld);
    const fl = flame(root, updaters, candle.x, candle.y, candle.z, 1.1);
    fl.set(false);
    const pl = new THREE.PointLight('#ffb35c', 0, 3.2, 2); pl.position.set(candle.x, candle.y + 0.2, candle.z); root.add(pl);
    candleLights.push(pl);
    monitors[slot] = (on) => { page.material = on ? writing : blank; fl.set(on); pl.userData.on = on; };
    // stool with a back (high-backed chair for the abbot)
    const seat = L.deskSeat(slot, DESKS);
    const sg = new THREE.Group(); sg.position.set(seat.x, y0, seat.z); sg.rotation.y = d.rot - Math.PI; root.add(sg);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) B(sg, 0.05, 0.42, 0.05, COL.oakDark, dx * 0.19, 0, dz * 0.19);
    B(sg, 0.48, 0.05, 0.46, wood, 0, 0.4, 0);
    B(sg, 0.46, lead ? 1.15 : 0.5, 0.05, COL.oakDark, 0, 0.45, 0.22);
    if (lead) B(sg, 0.1, 0.1, 0.1, COL.gold, 0, 1.6, 0.22);
    if (who?.color) B(sg, 0.4, 0.03, 0.4, T.mix(who.color, COL.cushion, 0.5), 0, 0.45, 0);
    nav.blockOBB(d.x, d.z, d.w, d.d, d.rot, 0.28);
    nav.blockCircle(seat.x, seat.z, 0.28, 0.15);
  }
  updaters.push((dt, t) => {
    manuscript.step(dt);
    candleLights.forEach((l, i) => { l.intensity = l.userData.on ? 1.6 + Math.sin(t * 13 + i) * 0.25 : 0; });
  });
  for (const p of PILLARS) column(p.x, p.z, H - 0.25);

  // ---------- library corner: bookcases, hanging sheets, orrery ----------
  const books = ['#7d2a22', '#2d4a8a', '#2f6b4a', '#6b4a2f', '#c9a24a', '#4a3a5a', '#8a6443'];
  const bookcase = (x, z, rot, w, h) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; root.add(g);
    B(g, w, h, 0.42, COL.oakDark, 0, 0, 0);
    const shelves = Math.floor((h - 0.2) / 0.42);
    for (let sh = 0; sh < shelves; sh++) {
      B(g, w - 0.1, 0.03, 0.36, COL.oak, 0, 0.12 + sh * 0.42, 0.04, { cast: false });
      let bx = -w / 2 + 0.08, k = sh * 5 + Math.round(x * 3);
      while (bx < w / 2 - 0.12) {
        const bw = 0.05 + ((k * 37) % 5) * 0.014, bh = 0.24 + ((k * 13) % 5) * 0.025;
        B(g, bw, bh, 0.26, books[Math.abs(k) % books.length], bx + bw / 2, 0.15 + sh * 0.42, 0.06, { cast: false });
        bx += bw + 0.01; k++;
        if (k % 9 === 0) bx += 0.1;
      }
    }
    nav.blockOBB(x, z, w, 0.42, rot, 0.28);
  };
  bookcase(1.3, -8.55, 0, 1.5, 2.6); bookcase(2.9, -8.55, 0, 1.5, 2.6);
  bookcase(4.1, -6.6, -Math.PI / 2, 1.8, 2.3);
  const sheets = [['map', 1.3], ['stars', 2.9]];
  for (const [kind, x] of sheets) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.86), new THREE.MeshStandardMaterial({ map: parchmentSheet(kind), roughness: 1 }));
    m.position.set(x, 2.85, L.BACK_WALL_Z + 0.04); m.scale.setScalar(0.8); root.add(m); northDecor.push(m);
  }
  {
    const ledger = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.94), new THREE.MeshStandardMaterial({ map: parchmentSheet('ledger'), roughness: 1 }));
    ledger.rotation.y = -Math.PI / 2; ledger.position.set(4.28, 1.75, -4.2); root.add(ledger);
    const ox = 2.4, oz = -5.4;
    C(root, 0.28, 0.36, 0.7, COL.oakDark, ox, 0, oz);
    C(root, 0.03, 0.03, 0.4, COL.gold, ox, 0.7, oz, 8);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), glow('#ffcf6a')); sun.position.set(ox, 1.15, oz); root.add(sun);
    const arms = [];
    [[0.22, '#8a8a92', 1.2], [0.34, '#2d4a8a', 0.7], [0.46, '#b05a3a', 0.45]].forEach(([r, col, sp]) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 6, 48), matte(COL.gold, { metalness: 0.6, roughness: 0.35 }));
      ring.rotation.x = Math.PI / 2; ring.position.copy(sun.position); root.add(ring);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), matte(col)); root.add(p);
      arms.push([p, r, sp]);
    });
    updaters.push((dt, t) => arms.forEach(([p, r, sp]) => p.position.set(ox + Math.cos(t * sp) * r, 1.15, oz + Math.sin(t * sp) * r)));
    nav.blockCircle(ox, oz, 0.5, 0.2);
  }

  // ---------- refectory ----------
  const usageBoard = new T.UsageBoard({ bg: COL.parchment, frame: '#6b4a2b', title: 'INK · WEEKLY USAGE', accent: '#8b2e1f', big: '#3a2614', text: '#4a3420', muted: '#6b5338', faint: '#8a7558', track: '#d6c8a4', font: SERIF });
  let fire;
  {
    // ink ledger (usage board) on the north wall
    const ux = 9.9, uw = 2.6, uh = 1.26;
    northDecor.push(B(root, uw + 0.16, uh + 0.16, 0.08, COL.oakDark, ux, 1.9 - uh / 2 - 0.08, L.BACK_WALL_Z + 0.04, { cast: false }));
    const ub = new THREE.Mesh(new THREE.PlaneGeometry(uw, uh), new THREE.MeshBasicMaterial({ map: usageBoard.texture, toneMapped: false, color: '#e8e2d4' }));
    ub.position.set(ux, 1.9, L.BACK_WALL_Z + 0.09); root.add(ub); northDecor.push(ub);
    // hearth
    const hx = 6.6, hz = L.BACK_WALL_Z + 0.45;
    B(root, 2.0, 1.4, 0.9, '#6a6256', hx, 0, hz);
    B(root, 1.3, 0.9, 0.5, '#1c1612', hx, 0.15, hz + 0.22);
    B(root, 2.2, 0.18, 1.0, '#7a7062', hx, 1.4, hz);
    B(root, 1.0, H - 1.58, 0.6, '#6a6256', hx, 1.58, hz - 0.1);
    for (let i = 0; i < 6; i++) flame(root, updaters, hx - 0.35 + (i % 3) * 0.35, 0.2, hz + 0.3 + Math.floor(i / 3) * 0.12, 2.6 + (i % 2), i % 2 ? '#ff8a3c' : '#ffb347');
    for (let i = 0; i < 3; i++) { const log = C(root, 0.06, 0.06, 0.7, '#4a3220', hx, 0.18, hz + 0.25 + i * 0.05, 8); log.rotation.z = Math.PI / 2; log.rotation.y = i * 0.4; }
    fire = new THREE.PointLight('#ff9a4a', 4, 7, 1.8); fire.position.set(hx, 0.9, hz + 1.0); fire.userData.base = 4; root.add(fire);
    updaters.push((dt, tt) => { fire.intensity = fire.userData.base * (0.85 + Math.sin(tt * 9) * 0.08 + Math.sin(tt * 17) * 0.07); });
    nav.blockBox(hx, hz, 2.2, 1.0, 0.25);
    // long table with benches
    const tx = 8.6, tz = -3.6, tw = 4.4;
    B(root, tw, 0.07, 1.0, COL.oakLight, tx, 0.72, tz);
    for (const dx of [-1, 1]) B(root, 0.12, 0.72, 0.8, COL.oakDark, tx + dx * (tw / 2 - 0.3), 0, tz);
    for (const dz of [-1, 1]) B(root, tw - 0.2, 0.42, 0.32, COL.oak, tx, 0, tz + dz * 0.85);
    for (let i = 0; i < 4; i++) { const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), matte('#b07a3a')); loaf.scale.set(1.4, 0.7, 1); loaf.position.set(tx - 1.5 + i, 0.8, tz); loaf.castShadow = true; root.add(loaf); }
    for (const dx of [-1.6, 1.6]) { C(root, 0.04, 0.05, 0.03, COL.iron, tx + dx, 0.79, tz, 10); C(root, 0.025, 0.025, 0.14, '#efe6cf', tx + dx, 0.82, tz, 8); flame(root, updaters, tx + dx, 0.96, tz, 0.9); }
    nav.blockBox(tx, tz, tw, 2.1, 0.25);
    // kitchen counter + barrels along the east edge
    B(root, 0.7, 0.86, 2.6, COL.oak, 11.3, 0, -6.4);
    B(root, 0.76, 0.06, 2.66, COL.oakLight, 11.3, 0.86, -6.4);
    C(root, 0.14, 0.14, 0.09, '#e6c86a', 11.3, 0.92, -7.1, 20);
    for (let i = 0; i < 3; i++) C(root, 0.06, 0.08, 0.2, ['#8a5a3a', '#6b6b5a', '#a0704a'][i], 11.25, 0.92, -6.2 + i * 0.18, 12);
    nav.blockBox(11.3, -6.4, 0.7, 2.6, 0.28);
    const barrel = (x, y, z, lying) => {
      const b = C(root, 0.3, 0.3, 0.75, '#7a5232', x, y, z, 20);
      if (lying) { b.rotation.x = Math.PI / 2; b.position.y = y + 0.3; }
      for (const k of [-0.25, 0.25]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.015, 6, 24), matte(COL.iron));
        if (lying) hoop.position.set(x, y + 0.3, z + k); else { hoop.rotation.x = Math.PI / 2; hoop.position.set(x, y + 0.375 + k, z); }
        root.add(hoop);
      }
    };
    barrel(11.2, 0, -1.8, false); barrel(11.2, 0, -0.9, false); barrel(10.4, 0, -0.6, true);
    nav.blockBox(10.9, -1.2, 1.4, 1.6, 0.25);
  }

  // ---------- cloister: well, benches, herb beds ----------
  {
    C(root, WELL.r, WELL.r + 0.05, 0.7, '#8c8476', WELL.x, 0, WELL.z, 32);
    C(root, WELL.r - 0.15, WELL.r - 0.15, 0.02, matte('#2a4a5a', { roughness: 0.15 }), WELL.x, 0.6, WELL.z, 32);
    for (const sgn of [-1, 1]) B(root, 0.12, 1.6, 0.12, COL.oakDark, WELL.x + sgn * (WELL.r - 0.1), 0.7, WELL.z);
    B(root, WELL.r * 2 + 0.2, 0.12, 0.14, COL.oakDark, WELL.x, 2.25, WELL.z);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(WELL.r + 0.4, 0.6, 4), matte('#6b3a2a')); roof.rotation.y = Math.PI / 4; roof.position.set(WELL.x, 2.65, WELL.z); roof.castShadow = true; root.add(roof);
    C(root, 0.12, 0.1, 0.2, '#7a5232', WELL.x, 1.4, WELL.z, 12);
    nav.blockCircle(WELL.x, WELL.z, WELL.r, 0.25);
    for (const b of BENCHES) {
      const g = new THREE.Group(); g.position.set(b.x, 0, b.z); g.rotation.y = b.rot; root.add(g);
      B(g, 1.6, 0.42, 0.45, COL.oak, 0, 0, 0);
      B(g, 1.6, 0.5, 0.08, COL.oakDark, 0, 0.42, -0.22);
      nav.blockOBB(b.x, b.z, 1.6, 0.45, b.rot, 0.2);
    }
    // herb beds in the kitchen yard
    const herb = [matte('#55804a', { flatShading: true }), matte('#6a9a55', { flatShading: true })];
    for (const [bx, bz] of [[6.4, 4.2], [9.4, 4.2], [6.4, 6.9], [9.4, 6.9]]) {
      B(root, 2.2, 0.25, 1.2, '#6b4a2f', bx, 0, bz);
      B(root, 2.0, 0.02, 1.0, '#3b2a1c', bx, 0.25, bz);
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17 + (i % 3) * 0.04, 0), herb[i % 2]);
        m.position.set(bx - 0.75 + (i % 3) * 0.75, 0.38, bz - 0.25 + Math.floor(i / 3) * 0.5); m.castShadow = true; root.add(m);
      }
      nav.blockBox(bx, bz, 2.2, 1.2, 0.25);
    }
    // potted herbs in the corners of the nave
    for (const [x, z, s] of [[-11.2, -7.9, 1], [-11.2, 0.9, 1], [3.9, 0.9, 0.9], [-0.2, 0.9, 0.8]]) {
      C(root, 0.24 * s, 0.17 * s, 0.38 * s, '#a8573a', x, 0, z, 16);
      [[0, 0.62, 0, 0.24], [0.12, 0.78, 0.05, 0.17], [-0.1, 0.74, -0.06, 0.18]].forEach(([bx, by, bz, r], i) => {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), herb[i % 2]); m.position.set(x + bx * s, by * s, z + bz * s); m.scale.setScalar(r * s); m.castShadow = true; root.add(m);
      });
      nav.blockCircle(x, z, 0.25 * s, 0.25);
    }
  }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight('#ffe9c9', '#2a1f16', 1.0);
  const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
  sun.position.set(6, 13, -16); sun.target.position.set(0, 0, 2);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera; sc.left = -17; sc.right = 17; sc.top = 15; sc.bottom = -15; sc.near = 1; sc.far = 50;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
  const front = new THREE.DirectionalLight('#ffe2b8', 0.8); front.position.set(8, 12, 12);
  const warm = [[-7.4, -5.5], [-1.4, -5.5], [-9.6, -3.6], [2.4, -5], [8.6, -3.6], [-3.6, 2.4], [7.5, 5.5]].map(([x, z]) => {
    const l = new THREE.PointLight('#ffb35c', 0.5, 7, 1.8); l.position.set(x, 2.6, z); return l;
  });
  root.add(hemi, sun, sun.target, front, ...warm);
  const TOD = {
    day:     { hemi: 1.2, sun: ['#fff1d6', 2.4], front: 0.9, warm: 0.4, fire: 2.5, shafts: 0.16 },
    evening: { hemi: 0.8,  sun: ['#ffae66', 1.7], front: 0.6, warm: 1.6, fire: 4, shafts: 0.22 },
    night:   { hemi: 0.42, sun: ['#8fa0d8', 0.45], front: 0.3, warm: 3.4, fire: 6, shafts: 0 },
  };
  function setTimeOfDay(tod) {
    const p = TOD[tod];
    hemi.intensity = p.hemi; sun.color.set(p.sun[0]); sun.intensity = p.sun[1]; front.intensity = p.front;
    warm.forEach((l) => { l.intensity = p.warm; });
    fire.userData.base = p.fire;
    shaftMat.opacity = p.shafts; shafts.forEach((s) => { s.visible = p.shafts > 0; });
    shaftMat.color.set(tod === 'evening' ? '#ffb070' : '#ffffff');
    windows.draw(tod);
  }
  setTimeOfDay('day');

  let time = 0;
  updaters.unshift((dt) => { time += dt; });

  return {
    root, nav, monitors, setTimeOfDay, heightAt, cutaway,
    layout: { desks: DESKS, loungeSeats: LOUNGE_SEATS },
    background: '#100c09',
    bloom: { strength: 0.22, radius: 0.4, threshold: 0.85 },
    todLabels: { day: 'Morning', evening: 'Vespers', night: 'Candlelight' },
    dressBot,
    setUsage: (u) => usageBoard.draw(u),
    update: (dt) => updaters.forEach((f) => f(dt, time)),
  };
}

// hooded robe + rope belt; the abbot wears a gold medallion; handoffs are sealed scrolls
function dressBot(bot, member, isLead) {
  const hoodColor = T.mix(member.color, '#2a1d14', 0.45);
  const add = (mat, geo, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.userData.botId = member.id; bot.body.add(m); return m; };
  const hood = new THREE.MeshLambertMaterial({ color: hoodColor });
  add(hood, new THREE.BoxGeometry(0.36, 0.3, 0.12), 0, 1.05, -0.17);     // hood back
  add(hood, new THREE.BoxGeometry(0.36, 0.06, 0.34), 0, 1.21, -0.02);    // hood top
  add(hood, new THREE.BoxGeometry(0.46, 0.1, 0.28), 0, 0.84, -0.01);     // collar drape
  add(new THREE.MeshLambertMaterial({ color: '#c8b48a' }), new THREE.BoxGeometry(0.44, 0.04, 0.27), 0, 0.5, 0); // rope belt
  if (isLead) add(new THREE.MeshLambertMaterial({ color: COL.gold, emissive: '#3a2a08' }), new THREE.CylinderGeometry(0.05, 0.05, 0.015, 16).rotateX(Math.PI / 2), 0, 0.7, 0.13);
  bot.paper.geometry = new THREE.CylinderGeometry(0.045, 0.045, 0.28, 12).rotateZ(Math.PI / 2);
  bot.paper.material = new THREE.MeshLambertMaterial({ color: COL.parchment });
  bot.paper.scale.set(1, 1, 1);
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 12).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#a51d1d' }));
  seal.position.set(0, 0, 0.046); bot.paper.add(seal);
}
