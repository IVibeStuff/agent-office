// Starship bridge theme. Same floor plan and seats as the office, re-dressed:
//   lead's glass office → raised captain's dais facing the viewport
//   desks               → bridge consoles (screens light up while working)
//   server racks        → pulsing power core + blinking console banks
//   research screens    → holo sensor displays + star map
//   windows             → full-width viewport onto space (orbit / sunrise / deep space)
//   lounge              → observation lounge with a holo table
//   break room          → galley with a food replicator
//   huddle table        → tactical holo table
//   door                → airlock, plants → hydroponic pods
//   handoffs            → glowing data pads, bots wear uniform belts + badges
import * as THREE from 'three';
import * as L from '../layout.js';
import { NavGrid } from '../pathfinding.js';
import * as T from '../textures.js';
import { B, C, floorPlane, matte, accessory } from '../world.js';
import { lightBanks, keyLight, createCutaway } from './kit.js';

const DAIS_H = 0.22;
const COL = {
  deck: '#262d37', hull: '#2e3744', hullPanel: '#37424f', trim: '#46525f', console: '#343e4b',
  consoleTop: '#cfd6df', chair: '#1f252e', accent: '#38e1ff', accentDim: '#1a8fa8', warm: '#ffb547',
  sofa: '#d9dee5', sofaDark: '#a9b2bd',
};
const glow = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });

// ---------- floor plan: a circular bridge with side rooms ----------
//   bridge circle centred on O with radius R; viewscreen on the forward (north) arc
//   captain's chair on a raised platform in the middle, two forward stations,
//   wall stations around the sides; openings to the observation lounge (east),
//   engineering (south-west) and the turbolift (aft). Walls on the far side are
//   full height, walls facing the camera are cut down to waist height.
const O = { x: -1.5, z: -0.5 }, R = 7.6;
const CAP = { x: -1.5, z: 0.45, r: 1.7, ramp: 0.45, h: 0.18 };
const SCREEN_HALF = 0.8;
const OPENINGS = [[Math.PI / 2, 0.14], [0, 0.13], [-0.7, 0.13]]; // [angle, half-width]
const polar = (th, r) => ({ x: O.x + Math.sin(th) * r, z: O.z + Math.cos(th) * r });
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const ROOMS = {
  lounge: { minX: 6.4, maxX: 11.75, minZ: -8.75, maxZ: 0.0 },
  mess:   { minX: 6.4, maxX: 11.75, minZ: -0.9, maxZ: 7.5 },
  eng:    { minX: -11.75, maxX: -8.0, minZ: 3.0, maxZ: 7.5 },
  spurE:  { minX: 5.6, maxX: 6.8, minZ: -1.4, maxZ: 0.4 },
  spurW:  { minX: -8.3, maxX: -6.0, minZ: 4.6, maxZ: 6.0 },
  lift:   { minX: -2.5, maxX: -0.5, minZ: 6.6, maxZ: 8.5 },
};
const inRect = (r, x, z) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

const station = (th, r, w, d) => { const p = polar(th, r); return { x: p.x, z: p.z, w, d, rot: th }; };
const DESKS = {
  lead:         { x: CAP.x, z: CAP.z - 0.6, w: 1.4, d: 0.4, rot: Math.PI, chairGap: 0.35 },
  'back-mid':   { x: -3.4, z: -3.7, w: 1.8, d: 0.75, rot: Math.PI - 0.18 },
  'back-right': { x: 0.4,  z: -3.7, w: 1.8, d: 0.75, rot: Math.PI + 0.18 },
  'back-left':  station(-2.05, 5.9, 1.7, 0.75),
  'mid-left':   station(-1.35, 5.9, 1.7, 0.75),
  'mid-right':  station(1.05, 5.9, 1.7, 0.75),
  'front-left': station(2.0, 5.9, 1.7, 0.75),
  'front-right': station(0.45, 5.9, 1.7, 0.75),
};
const SOFAS = [{ x: 9.1, z: -5.6 }, { x: 9.1, z: -3.0 }];
const LOUNGE_SEATS = [];
for (const s of SOFAS) for (const dx of [-1.2, -0.4, 0.4, 1.2]) LOUNGE_SEATS.push(L.benchSeat(s.x + dx, s.z + 0.05, Math.PI, 1.05));

function heightAt(x, z) {
  const d = Math.hypot(x - CAP.x, z - CAP.z);
  if (d <= CAP.r) return CAP.h;
  if (d < CAP.r + CAP.ramp) return CAP.h * (1 - (d - CAP.r) / CAP.ramp);
  return 0;
}

// ---------- textures ----------
function deckTexture() {
  const S = 1024, c = T.canvas(S, S), g = c.getContext('2d'), r = T.rng(5);
  g.fillStyle = COL.deck; g.fillRect(0, 0, S, S);
  const P = 256;
  for (let y = 0; y < S; y += P) for (let x = 0; x < S; x += P) {
    const l = 19 + r() * 4;
    g.fillStyle = `hsl(215, 12%, ${l}%)`; g.fillRect(x + 3, y + 3, P - 6, P - 6);
    g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x + 3, y + 3, P - 6, 3); g.fillRect(x + 3, y + 3, 3, P - 6);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 3, y + P - 6, P - 6, 3); g.fillRect(x + P - 6, y + 3, 3, P - 6);
    g.fillStyle = 'rgba(160,175,195,.35)';
    for (const [rx, ry] of [[14, 14], [P - 18, 14], [14, P - 18], [P - 18, P - 18]]) { g.beginPath(); g.arc(x + rx, y + ry, 3.5, 0, 7); g.fill(); }
    if (r() > 0.6) { // vent grille
      g.fillStyle = 'rgba(0,0,0,.35)';
      for (let k = 0; k < 6; k++) g.fillRect(x + 70, y + 90 + k * 14, P - 140, 6);
    }
    g.globalAlpha = 0.04;
    for (let k = 0; k < 120; k++) { g.fillStyle = r() > 0.5 ? '#fff' : '#000'; g.fillRect(x + r() * P, y + r() * P, 2 + r() * 10, 1); }
    g.globalAlpha = 1;
  }
  return T.tex(c, { repeat: [6, 4.5] });
}

function zoneDecal(color, label, wU, dU) {
  const ppu = 160, W = Math.min(2048, Math.round(wU * ppu)), H = Math.min(2048, Math.round(dU * ppu));
  const sx = W / wU, sy = H / dU;
  const c = T.canvas(W, H), g = c.getContext('2d');
  const col = new THREE.Color(color);
  const rgba = (a) => `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${a})`;
  g.fillStyle = rgba(0.07); g.fillRect(0, 0, W, H);
  // corner brackets
  g.strokeStyle = rgba(0.85); g.lineWidth = 0.06 * sx;
  const i = 0.15 * sx, L1 = 0.7 * sx;
  for (const [x, y, dx, dy] of [[i, i, 1, 1], [W - i, i, -1, 1], [i, H - i, 1, -1], [W - i, H - i, -1, -1]]) {
    g.beginPath(); g.moveTo(x + dx * L1, y); g.lineTo(x, y); g.lineTo(x, y + dy * L1); g.stroke();
  }
  // dashed border
  g.setLineDash([0.25 * sx, 0.2 * sx]); g.lineWidth = 0.025 * sx; g.strokeStyle = rgba(0.35);
  g.strokeRect(i + 0.25 * sx, i + 0.25 * sy, W - 2 * i - 0.5 * sx, H - 2 * i - 0.5 * sy);
  g.setLineDash([]);
  T.letter(g, label, W / 2, H - 0.55 * sy, Math.round(0.4 * sy), rgba(0.9));
  return T.tex(c);
}

function ringDecal(color, label, rU) {
  const S = 2048, c = T.canvas(S, S), g = c.getContext('2d'), ppu = S / (rU * 2);
  const col = new THREE.Color(color);
  const rgba = (a) => `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${a})`;
  g.fillStyle = rgba(0.06); g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 4, 0, 7); g.fill();
  g.strokeStyle = rgba(0.8); g.lineWidth = 0.06 * ppu; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 0.1 * ppu, 0, 7); g.stroke();
  g.setLineDash([0.3 * ppu, 0.25 * ppu]); g.lineWidth = 0.03 * ppu; g.strokeStyle = rgba(0.4);
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 0.35 * ppu, 0, 7); g.stroke(); g.setLineDash([]);
  T.letter(g, label, S / 2, S / 2 + 1.6 * ppu, Math.round(0.4 * ppu), rgba(0.9));
  return T.tex(c);
}

function hazardTexture() {
  const c = T.canvas(256, 64), g = c.getContext('2d');
  g.fillStyle = '#1b1f26'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#d6a21e';
  for (let x = -64; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 16, 64); g.lineTo(x + 48, 0); g.lineTo(x + 32, 0); g.fill(); }
  return T.tex(c);
}

// Space outside the viewport, redrawn per "time of day"
function spaceView() {
  const W = 2048, H = 512, c = T.canvas(W, H), g = c.getContext('2d');
  const t = T.tex(c);
  const r0 = T.rng(77);
  const stars = Array.from({ length: 1100 }, () => [r0() * W, r0() * H, r0() ** 3 * 2.2 + 0.4, 0.35 + r0() * 0.65]);
  const nebula = (cx, cy, rad, color, a) => {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
    gr.addColorStop(0, color.replace('A', a)); gr.addColorStop(1, color.replace('A', 0));
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  };
  const draw = (tod) => {
    const bg = { day: ['#03060f', '#0b1934'], evening: ['#05040c', '#1c0f26'], night: ['#020309', '#060a19'] }[tod];
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, bg[0]); gr.addColorStop(1, bg[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const neb = tod === 'night' ? 0.32 : 0.16;
    nebula(450, 180, 520, 'rgba(107,63,160,A)', neb);
    nebula(900, 320, 420, 'rgba(31,122,140,A)', neb * 0.9);
    nebula(1750, 120, 380, 'rgba(160,50,110,A)', neb * 0.7);
    for (const [x, y, s, a] of stars) { g.fillStyle = `rgba(235,240,255,${a})`; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
    for (const [x, y, s] of stars.slice(0, 14)) { // a few bright stars with spikes
      g.strokeStyle = 'rgba(200,225,255,.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x - s * 6, y); g.lineTo(x + s * 6, y); g.moveTo(x, y - s * 6); g.lineTo(x, y + s * 6); g.stroke();
    }
    if (tod !== 'night') {
      const px = 1480, py = 760, pr = 560;
      // atmosphere glow
      const ag = g.createRadialGradient(px, py, pr * 0.96, px, py, pr * 1.12);
      ag.addColorStop(0, tod === 'day' ? 'rgba(110,190,255,.55)' : 'rgba(255,150,80,.6)'); ag.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = ag; g.beginPath(); g.arc(px, py, pr * 1.12, 0, 7); g.fill();
      // planet body
      const pg = g.createRadialGradient(px - pr * 0.45, py - pr * 0.55, pr * 0.1, px, py, pr);
      if (tod === 'day') { pg.addColorStop(0, '#5fa8d8'); pg.addColorStop(0.55, '#2b5f8e'); pg.addColorStop(1, '#0b1a2e'); }
      else { pg.addColorStop(0, '#2a2140'); pg.addColorStop(0.6, '#140f24'); pg.addColorStop(1, '#07060d'); }
      g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill();
      // cloud bands
      g.save(); g.beginPath(); g.arc(px, py, pr, 0, 7); g.clip();
      g.globalAlpha = tod === 'day' ? 0.22 : 0.08; g.strokeStyle = '#e8f4ff';
      for (let k = 0; k < 14; k++) { g.lineWidth = 6 + (k % 4) * 5; g.beginPath(); g.ellipse(px, py - pr + 90 + k * 34, pr * 1.1, 18, -0.08, 0, 7); g.stroke(); }
      g.restore(); g.globalAlpha = 1;
      if (tod === 'evening') { // sunrise rim
        g.strokeStyle = 'rgba(255,190,110,.9)'; g.lineWidth = 7;
        g.beginPath(); g.arc(px, py, pr - 2, Math.PI * 1.08, Math.PI * 1.52); g.stroke();
        nebula(px - pr * 0.72, py - pr * 0.7, 260, 'rgba(255,200,140,A)', 0.55);
      }
    } else {
      // distant moon
      const mg = g.createRadialGradient(1700, 140, 4, 1712, 150, 46);
      mg.addColorStop(0, '#c9ced8'); mg.addColorStop(1, '#3a3f4a');
      g.fillStyle = mg; g.beginPath(); g.arc(1712, 150, 46, 0, 7); g.fill();
    }
    t.needsUpdate = true;
  };
  draw('day');
  return { texture: t, draw };
}

class StarMap {
  constructor() {
    this.c = T.canvas(640, 400); this.g = this.c.getContext('2d'); this.texture = T.tex(this.c); this.t = 0;
    const r = T.rng(9); this.blips = Array.from({ length: 9 }, () => [r() * Math.PI * 2, 40 + r() * 140, (r() - 0.5) * 0.02]);
  }
  draw() {
    const { g } = this, cx = 320, cy = 215; this.t++;
    g.fillStyle = '#06111c'; g.fillRect(0, 0, 640, 400);
    g.fillStyle = '#6fb6cc'; g.font = '600 22px system-ui, sans-serif'; g.fillText('STAR MAP', 26, 40);
    g.strokeStyle = 'rgba(56,225,255,.25)'; g.lineWidth = 2;
    for (const rad of [50, 100, 150, 190]) { g.beginPath(); g.arc(cx, cy, rad, 0, 7); g.stroke(); }
    const sweep = (this.t * 0.05) % (Math.PI * 2);
    const sg = g.createConicGradient ? g.createConicGradient(sweep, cx, cy) : null;
    if (sg) { sg.addColorStop(0, 'rgba(56,225,255,.35)'); sg.addColorStop(0.12, 'rgba(56,225,255,0)'); g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, 190, 0, 7); g.fill(); }
    g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill();
    for (const b of this.blips) {
      b[0] += b[2];
      const x = cx + Math.cos(b[0]) * b[1], y = cy + Math.sin(b[0]) * b[1];
      g.fillStyle = '#38e1ff'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
    }
    this.texture.needsUpdate = true;
  }
}

function buttonsTexture(color) {
  const c = T.canvas(256, 128), g = c.getContext('2d'), r = T.rng(color.length * 13);
  g.fillStyle = '#121a24'; g.fillRect(0, 0, 256, 128);
  for (let y = 12; y < 120; y += 22) for (let x = 12; x < 248; x += 26) {
    g.fillStyle = r() > 0.75 ? color : r() > 0.5 ? '#2c6b80' : '#1f2b38';
    g.fillRect(x, y, 18, 12);
  }
  return T.tex(c);
}

// ---------- builders ----------
export function buildStarship({ team, leadId, desks }) {
  const root = new THREE.Group();
  const nav = new NavGrid();
  const updaters = [];
  const bySlot = Object.fromEntries(team.filter((t) => desks[t.id]).map((t) => [desks[t.id], t]));
  const pulse = [];
  const cutaway = createCutaway();
  const segDecor = []; // [angle, decor list] so wall displays hide with their wall

  // ---------- floors ----------
  const fw = L.FLOOR.maxX - L.FLOOR.minX, fd = L.FLOOR.maxZ - L.FLOOR.minZ;
  const base = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.25, fd), matte('#07090d'));
  base.position.y = -0.125; base.receiveShadow = true; root.add(base);
  const deckTex = deckTexture();
  const deckMat = (w, d) => { const t = deckTex.clone(); t.repeat.set(w / 4, d / 4); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.62, metalness: 0.35 }); };
  const deckPlane = (r) => {
    const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), deckMat(w, d));
    m.rotation.x = -Math.PI / 2; m.position.set((r.minX + r.maxX) / 2, 0.002, (r.minZ + r.maxZ) / 2); m.receiveShadow = true; root.add(m);
  };
  {
    const t = deckTex.clone(); t.repeat.set((R + 0.4) * 2 / 4, (R + 0.4) * 2 / 4); t.needsUpdate = true;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R + 0.4, 128), new THREE.MeshStandardMaterial({ map: t, roughness: 0.62, metalness: 0.35 }));
    disc.rotation.x = -Math.PI / 2; disc.position.set(O.x, 0.003, O.z); disc.receiveShadow = true; root.add(disc);
  }
  Object.values(ROOMS).forEach(deckPlane);
  // inner guide ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(R - 1.45, R - 1.4, 128), glow('#145f73'));
  ring.rotation.x = -Math.PI / 2; ring.position.set(O.x, 0.01, O.z); root.add(ring);

  // ---------- where bots may walk ----------
  nav.keepInside((x, z) => (Math.hypot(x - O.x, z - O.z) < R - 0.15) || Object.values(ROOMS).some((r) => inRect(r, x, z)));
  // lounge / mess partition with a door
  const PZ = -0.2; // partition between lounge and mess, door at x 8.6..9.6
  nav.blockRect(ROOMS.lounge.minX, 8.6, PZ - 0.1, PZ + 0.1, 0.3);
  nav.blockRect(9.6, 12, PZ - 0.1, PZ + 0.1, 0.3);

  // ---------- bridge ring wall ----------
  const H = L.WALL_H;
  const N = 64, chord = 2 * (R + 0.15) * Math.sin(Math.PI / N) + 0.03;
  const panelMat = matte(COL.hullPanel), hullMat = matte(COL.hull), capGlow = glow('#1a8fa8');
  for (let i = 0; i < N; i++) {
    const th = -Math.PI + (i + 0.5) * (2 * Math.PI / N);
    if (Math.abs(angDiff(th, Math.PI)) < SCREEN_HALF) continue;
    if (OPENINGS.some(([a, hw]) => Math.abs(angDiff(th, a)) < hw)) continue;
    const p = polar(th, R + 0.15);
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = th; root.add(g);
    B(g, chord, H, 0.3, hullMat, 0, 0, 0);
    if (i % 2 === 0) B(g, chord * 2 - 0.12, 2.4, 0.04, panelMat, 0, 0.3, -0.17, { cast: false });
    B(g, chord, 0.03, 0.04, capGlow, 0, 2.85, -0.17, { cast: false });
    B(g, chord, 0.03, 0.03, glow('#145f73'), 0, 0.1, -0.17, { cast: false });
    const decor = [];
    cutaway.add(g, Math.sin(th), Math.cos(th), { low: 0.33, decor });
    segDecor.push([th, decor]);
  }
  // door frames at the openings
  for (const [a, hw] of OPENINGS) {
    for (const sgn of [-1, 1]) {
      const p = polar(a + sgn * hw, R + 0.15);
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = a; root.add(g);
      B(g, 0.22, 2.5, 0.5, COL.trim, 0, 0, 0);
      B(g, 0.04, 2.2, 0.02, glow('#38e1ff'), 0, 0.15, -0.26, { cast: false });
      cutaway.add(g, Math.sin(a), Math.cos(a), { low: 0.4 });
    }
  }

  // ---------- curved viewscreen ----------
  const space = spaceView();
  {
    const sh = 2.55, y0 = 0.42;
    const scr = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.05, R + 0.05, sh, 64, 1, true, Math.PI - SCREEN_HALF, SCREEN_HALF * 2),
      new THREE.MeshBasicMaterial({ map: space.texture, toneMapped: false, side: THREE.DoubleSide, color: '#d8dde6' }));
    scr.position.set(O.x, y0 + sh / 2, O.z); root.add(scr);
    const screenDecor = [scr];
    cutaway.add(new THREE.Object3D(), 0, -1, { decor: screenDecor });
    // frame below and above the screen, built from the same wall segments as the ring
    for (let i = 0; i < N; i++) {
      const th = -Math.PI + (i + 0.5) * (2 * Math.PI / N);
      if (Math.abs(angDiff(th, Math.PI)) >= SCREEN_HALF) continue;
      const p = polar(th, R + 0.2);
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = th; root.add(g);
      B(g, chord, y0, 0.3, hullMat, 0, 0, 0);
      const top = new THREE.Group(); root.add(top); top.position.copy(g.position); top.rotation.copy(g.rotation);
      B(top, chord, H - y0 - sh, 0.3, hullMat, 0, y0 + sh, 0);
      screenDecor.push(top);
    }
    for (const y of [y0 - 0.02, y0 + sh]) {
      const strip = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.02, R - 0.02, 0.03, 64, 1, true, Math.PI - SCREEN_HALF, SCREEN_HALF * 2), new THREE.MeshBasicMaterial({ color: '#1d9fbf', toneMapped: false, side: THREE.DoubleSide }));
      strip.position.set(O.x, y, O.z); root.add(strip); screenDecor.push(strip);
    }
    for (const sgn of [-1, 1]) {
      const p = polar(Math.PI + sgn * SCREEN_HALF, R + 0.1);
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = Math.PI + sgn * SCREEN_HALF; root.add(g);
      B(g, 0.35, H, 0.55, COL.trim, 0, 0, 0);
      B(g, 0.05, 2.6, 0.02, glow('#38e1ff'), 0, 0.3, -0.29, { cast: false });
      cutaway.add(g, Math.sin(Math.PI + sgn * SCREEN_HALF), Math.cos(Math.PI + sgn * SCREEN_HALF), { low: 0.33 });
    }
  }

  // ---------- captain's platform ----------
  {
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(CAP.r, CAP.r + CAP.ramp, CAP.h, 64), matte('#2a333f'));
    plat.position.set(CAP.x, CAP.h / 2, CAP.z); plat.receiveShadow = true; plat.castShadow = true; root.add(plat);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(CAP.r, 0.018, 6, 96), glow(COL.warm));
    edge.rotation.x = Math.PI / 2; edge.position.set(CAP.x, CAP.h + 0.005, CAP.z); root.add(edge);
    const lead = bySlot.lead;
    const deco = new THREE.Mesh(new THREE.CircleGeometry(CAP.r - 0.05, 96), new THREE.MeshStandardMaterial({ map: ringDecal(lead?.color || '#ffb547', 'Command', CAP.r - 0.05), transparent: true, depthWrite: false, roughness: 0.6 }));
    deco.rotation.x = -Math.PI / 2; deco.position.set(CAP.x, CAP.h + 0.004, CAP.z); root.add(deco);
  }

  // ---------- stations ----------
  const code = new T.CodeScreen();
  const codeMat = new THREE.MeshBasicMaterial({ map: code.texture, toneMapped: false, color: '#9fe8ff' });
  const offMat = new THREE.MeshStandardMaterial({ color: '#0d151e', roughness: 0.4, metalness: 0.2 });
  const monitors = {};
  for (const [slot, d] of Object.entries(DESKS)) {
    const who = bySlot[slot];
    const lead = slot === 'lead';
    const y0 = lead ? CAP.h : 0;
    const accent = who?.color || '#4b5a6b';
    // local frame: desk at origin, the seated person faces -z, chair at +z
    const g = new THREE.Group(); g.position.set(d.x, y0, d.z); g.rotation.y = d.rot - Math.PI; root.add(g);
    const ped = lead ? 0.5 : 0.68;
    B(g, d.w * 0.86, ped, d.d * 0.55, COL.console, 0, 0, -d.d * 0.12);
    B(g, d.w, 0.06, d.d, lead ? '#3b4656' : '#c9d0d9', 0, ped, 0);
    B(g, d.w, 0.025, 0.03, glow(accent), 0, ped - 0.02, d.d / 2 + 0.005, { cast: false });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(d.w * 0.7, Math.min(0.26, d.d * 0.6)), new THREE.MeshBasicMaterial({ map: buttonsTexture(accent), toneMapped: false, color: '#9aa4b0' }));
    panel.rotation.x = -Math.PI / 2 + 0.35; panel.position.set(0, ped + 0.08, d.d * 0.18); g.add(panel);
    const sw = lead ? 0.9 : 1.0, sh = lead ? 0.34 : 0.52;
    B(g, sw + 0.08, sh + 0.08, 0.05, '#11161d', 0, ped + 0.14, -d.d * 0.32);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), offMat);
    scr.position.set(0, ped + 0.18 + sh / 2, -d.d * 0.32 + 0.027); g.add(scr);
    B(g, sw + 0.08, 0.02, 0.06, glow(accent), 0, ped + 0.22 + sh, -d.d * 0.32, { cast: false });
    monitors[slot] = (on) => { scr.material = on ? codeMat : offMat; };
    if (who?.accessory && !lead) accessory(g, who.accessory, d.w / 2 - 0.25, ped + 0.03, 0.05, who.color, 1);
    // chair
    const seat = L.deskSeat(slot, DESKS);
    const cg = new THREE.Group(); cg.position.set(seat.x, y0, seat.z); cg.rotation.y = d.rot - Math.PI; root.add(cg);
    starChair(cg, 0, 0, 0, who?.color, lead);
    // floor decal behind the chair with the station's name
    if (!lead) {
      const dw = d.w + 0.7, dd = 2.5;
      const dg = new THREE.Group(); dg.position.set(d.x, 0, d.z); dg.rotation.y = d.rot - Math.PI; root.add(dg);
      floorPlane(dg, dw, dd, zoneDecal(who?.color || '#6b7a8c', who?.department || 'Open Station', dw, dd), 0, dd / 2 - d.d / 2 - 0.15, 0.006, { transparent: true, depthWrite: false });
    }
    nav.blockOBB(d.x, d.z, d.w, d.d, d.rot, 0.28);
    nav.blockCircle(seat.x, seat.z, 0.3, 0.15);
  }

  // ---------- wall displays (tall walls) ----------
  const screens = { chart: new T.ChartScreen(), map: new StarMap(), terminal: new T.TerminalScreen() };
  const wallPlane = (th, w, h, y, mat) => {
    const p = polar(th, R - 0.12);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(p.x, y, p.z); m.rotation.y = th + Math.PI; root.add(m);
    const f = polar(th, R - 0.09);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.04), matte('#11161d'));
    fr.position.set(f.x, y, f.z); fr.rotation.y = th + Math.PI; root.add(fr);
    let best = segDecor[0];
    for (const sd of segDecor) if (Math.abs(angDiff(sd[0], th)) < Math.abs(angDiff(best[0], th))) best = sd;
    best[1].push(m, fr);
    return m;
  };
  wallPlane(-2.05, 1.4, 0.86, 2.3, new THREE.MeshBasicMaterial({ map: screens.chart.texture, toneMapped: false, color: '#a8ecff' }));
  wallPlane(-1.7, 1.2, 0.74, 2.3, new THREE.MeshBasicMaterial({ map: screens.terminal.texture, toneMapped: false, color: '#a8ecff' }));
  wallPlane(-1.35, 1.4, 0.86, 2.3, new THREE.MeshBasicMaterial({ map: screens.map.texture, toneMapped: false, color: '#a8ecff' }));
  const usageBoard = new T.UsageBoard({ bg: '#07111a', frame: '#1d6077', title: 'POWER · WEEKLY USAGE', accent: '#38e1ff', big: '#e6fbff' });
  wallPlane(-0.98, 2.0, 0.97, 1.9, new THREE.MeshBasicMaterial({ map: usageBoard.texture, toneMapped: false, color: '#cfe9f2' }));
  let st = 0;
  updaters.push((dt) => { st += dt; if (st > 0.16) { st = 0; screens.chart.draw(); screens.map.draw(); screens.terminal.draw(); code.draw(); } });

  // ---------- engineering ----------
  {
    const r = ROOMS.eng;
    const ew = new THREE.Group(); root.add(ew); cutaway.add(ew, -1, 0);
    B(ew, 0.3, H, r.maxZ - r.minZ + 0.3, hullMat, r.minX - 0.25, 0, (r.minZ + r.maxZ) / 2);
    B(root, r.maxX - r.minX + 0.3, 1.0, 0.3, hullMat, (r.minX + r.maxX) / 2 - 0.1, 0, r.minZ - 0.15);
    B(root, r.maxX - r.minX + 0.3, 0.03, 0.32, capGlow, (r.minX + r.maxX) / 2 - 0.1, 1.0, r.minZ - 0.15, { cast: false });
    B(root, 0.3, 1.0, r.maxZ - ROOMS.spurW.maxZ, hullMat, r.maxX + 0.15, 0, (ROOMS.spurW.maxZ + r.maxZ) / 2);
    B(root, 0.3, 1.0, ROOMS.spurW.minZ - r.minZ, hullMat, r.maxX + 0.15, 0, (r.minZ + ROOMS.spurW.minZ) / 2);
    B(root, r.maxX - r.minX + 0.3, 1.0, 0.3, hullMat, (r.minX + r.maxX) / 2, 0, r.maxZ + 0.15);
    floorPlane(root, r.maxX - r.minX, r.maxZ - r.minZ, zoneDecal('#38e1ff', 'Engineering', r.maxX - r.minX, r.maxZ - r.minZ), (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, 0.006, { transparent: true, depthWrite: false });
    const cx = -9.7, cz = 4.9;
    C(root, 0.85, 0.95, 0.28, '#2a323e', cx, 0, cz, 32);
    C(root, 0.6, 0.6, 0.12, glow('#1d9fbf'), cx, 0.28, cz, 32);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 2.5, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#7fe6ff', transparent: true, opacity: 0.18, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }));
    tube.position.set(cx, 1.65, cz); root.add(tube);
    const plasmaMat = glow('#38e1ff');
    const plasma = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 2.4, 20), plasmaMat);
    plasma.position.set(cx, 1.65, cz); root.add(plasma);
    pulse.push([plasmaMat, new THREE.Color('#38e1ff'), 0, 1.6]);
    const rings = [];
    for (let i = 0; i < 4; i++) {
      const m = glow('#5fe3ff', { transparent: true, opacity: 0.8 });
      const rr = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 8, 40), m);
      rr.rotation.x = Math.PI / 2; root.add(rr); rings.push([rr, m]);
    }
    updaters.push((dt, t) => rings.forEach(([rr, m], i) => { const k = ((t * 0.45 + i / 4) % 1); rr.position.set(cx, 0.5 + k * 2.4, cz); m.opacity = Math.sin(k * Math.PI) * 0.85; }));
    C(root, 0.62, 0.62, 0.3, '#2a323e', cx, 2.9, cz, 32);
    const coreLight = new THREE.PointLight('#38e1ff', 3.5, 7, 1.8); coreLight.position.set(cx + 0.8, 1.6, cz + 0.6); root.add(coreLight);
    updaters.push((dt, t) => { coreLight.intensity = 3.2 + Math.sin(t * 1.6) * 0.8; });
    nav.blockCircle(cx, cz, 0.95, 0.25);
    lightBanks(root, nav, updaters, [{ x: -11.55, z: 6.5, w: 1.5, rot: Math.PI / 2 }, { x: -9.9, z: 3.2, w: 1.6, rot: 0 }],
      { body: COL.console, face: '#141b24', colors: ['#38e1ff', '#ffb547', '#5ef2a0'], off: '#13202a' });
  }

  // ---------- observation lounge ----------
  const loungeView = spaceView();
  {
    const r = ROOMS.lounge, w = r.maxX - r.minX;
    floorPlane(root, w, r.maxZ - r.minZ, zoneDecal('#38e1ff', 'Observation', w, r.maxZ - r.minZ), (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, 0.006, { transparent: true, depthWrite: false });
    // window wall (north) with ribs
    const wz = L.BACK_WALL_Z - 0.15;
    const lw = new THREE.Group(); root.add(lw);
    const lwDecor = [];
    cutaway.add(lw, 0, -1, { decor: lwDecor });
    B(lw, w + 0.3, 0.35, 0.3, hullMat, (r.minX + r.maxX) / 2, 0, wz);
    lwDecor.push(B(root, w + 0.3, 0.28, 0.3, hullMat, (r.minX + r.maxX) / 2, H - 0.28, wz));
    const view = new THREE.Mesh(new THREE.PlaneGeometry(w, H - 0.63), new THREE.MeshBasicMaterial({ map: loungeView.texture, toneMapped: false, color: '#d8dde6' }));
    view.position.set((r.minX + r.maxX) / 2, 0.35 + (H - 0.63) / 2, wz - 0.1); root.add(view); lwDecor.push(view);
    for (let i = 0; i <= 3; i++) {
      const x = r.minX + (w * i) / 3;
      B(lw, 0.2, H - 0.63, 0.34, COL.trim, x, 0.35, wz, { cast: false });
      lwDecor.push(B(root, 0.04, H - 0.7, 0.02, glow('#1a8fa8'), x, 0.38, wz + 0.18, { cast: false }));
    }
    // low partition walls (west, south with a door to the mess)
    const gap0 = ROOMS.spurE.minZ; // west wall stops where the corridor from the bridge comes in
    B(root, 0.25, 1.0, gap0 - r.minZ, hullMat, r.minX - 0.12, 0, (r.minZ + gap0) / 2);
    B(root, 0.25, 0.03, gap0 - r.minZ, capGlow, r.minX - 0.12, 1.0, (r.minZ + gap0) / 2, { cast: false });
    const PZ = -0.2;
    B(root, 8.6 - r.minX + 0.25, 1.0, 0.2, hullMat, (r.minX - 0.25 + 8.6) / 2, 0, PZ);
    B(root, r.maxX - 9.6, 1.0, 0.2, hullMat, (9.6 + r.maxX) / 2, 0, PZ);
    B(root, 8.6 - r.minX + 0.25, 0.03, 0.22, capGlow, (r.minX - 0.25 + 8.6) / 2, 1.0, PZ, { cast: false });
    B(root, r.maxX - 9.6, 0.03, 0.22, capGlow, (9.6 + r.maxX) / 2, 1.0, PZ, { cast: false });
    for (const s of SOFAS) loungeSofa(root, { x: s.x, z: s.z, w: 3.4, d: 0.95 }, 'z-', nav);
  }

  // ---------- mess ----------
  {
    const r = ROOMS.mess;
    floorPlane(root, r.maxX - r.minX, r.maxZ - r.minZ, zoneDecal('#9aa7b6', 'Mess', r.maxX - r.minX, r.maxZ - r.minZ), (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, 0.005, { transparent: true, depthWrite: false });
    B(root, 0.25, 1.0, r.maxZ - (ROOMS.spurE.maxZ), hullMat, r.minX - 0.12, 0, (ROOMS.spurE.maxZ + r.maxZ) / 2);
    B(root, r.maxX - r.minX + 0.25, 1.0, 0.25, hullMat, (r.minX + r.maxX) / 2, 0, r.maxZ + 0.12);
    // replicator against the west partition
    const rx = r.minX + 0.35, rz = 1.6;
    B(root, 0.55, 1.75, 1.0, '#2a323e', rx, 0, rz);
    B(root, 0.02, 0.45, 0.6, glow('#ffb547'), rx + 0.28, 0.95, rz, { cast: false });
    B(root, 0.3, 0.02, 0.5, '#3a4656', rx + 0.2, 0.9, rz);
    C(root, 0.05, 0.04, 0.1, '#f5f2ec', rx + 0.22, 0.92, rz, 12);
    nav.blockBox(rx, rz, 0.55, 1.0, 0.25);
    // round table with a hologram, stools
    const tx = 9.2, tz = 3.2;
    C(root, 0.85, 0.85, 0.05, '#e4e8ee', tx, 0.72, tz, 40);
    C(root, 0.08, 0.14, 0.72, '#3a4656', tx, 0, tz, 16);
    C(root, 0.8, 0.8, 0.01, glow('#0f4d5e'), tx, 0.715, tz, 40);
    const planet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), new THREE.MeshBasicMaterial({ color: '#4fbfd8', wireframe: true, transparent: true, opacity: 0.35, toneMapped: false }));
    planet.position.set(tx, 1.2, tz); root.add(planet);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glow('#ffd27a')); root.add(moon);
    updaters.push((dt, t) => { planet.rotation.y += dt * 0.4; moon.position.set(tx + Math.cos(t * 0.7) * 0.55, 1.25, tz + Math.sin(t * 0.7) * 0.55); });
    nav.blockCircle(tx, tz, 0.85, 0.25);
    for (let i = 0; i < 5; i++) {
      const a = i * (Math.PI * 2 / 5) + 0.3, sx = tx + Math.cos(a) * 1.35, sz = tz + Math.sin(a) * 1.35;
      C(root, 0.2, 0.2, 0.06, '#3a4656', sx, 0.5, sz, 20);
      C(root, 0.03, 0.05, 0.5, '#8a96a5', sx, 0, sz, 10);
      nav.blockCircle(sx, sz, 0.2, 0.15);
    }
  }

  // ---------- turbolift ----------
  {
    const r = ROOMS.lift, cx = (r.minX + r.maxX) / 2, z = r.maxZ;
    B(root, 0.3, 1.0, r.maxZ - r.minZ, hullMat, r.minX - 0.15, 0, (r.minZ + r.maxZ) / 2 + 0.2);
    B(root, 0.3, 1.0, r.maxZ - r.minZ, hullMat, r.maxX + 0.15, 0, (r.minZ + r.maxZ) / 2 + 0.2);
    B(root, r.maxX - r.minX + 0.6, 2.7, 0.3, COL.trim, cx, 0, z + 0.15);
    B(root, (r.maxX - r.minX) / 2 - 0.05, 2.25, 0.08, '#46525f', cx - (r.maxX - r.minX) / 4, 0.05, z - 0.02);
    B(root, (r.maxX - r.minX) / 2 - 0.05, 2.25, 0.08, '#46525f', cx + (r.maxX - r.minX) / 4, 0.05, z - 0.02);
    B(root, 0.03, 2.1, 0.03, glow('#38e1ff'), cx, 0.12, z - 0.07, { cast: false });
    const sign = T.canvas(512, 96), sg = sign.getContext('2d');
    T.letter(sg, 'Turbolift', 256, 50, 50, '#9fdcea');
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.26), new THREE.MeshBasicMaterial({ map: T.tex(sign), transparent: true, toneMapped: false }));
    sm.position.set(cx, 2.45, z - 0.08); sm.rotation.y = Math.PI; root.add(sm);
  }

  // ---------- hydroponic pods ----------
  const podGlass = new THREE.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false });
  const leaf = [matte('#3f9a55', { flatShading: true }), matte('#4fb062', { flatShading: true })];
  for (const [px, pz, s] of [[6.9, -8.2, 1], [11.3, -8.2, 1.1], [11.3, -1.5, 0.9], [11.3, 7.0, 1], [6.9, 6.9, 0.9], [-8.5, 7.0, 0.9], [-11.2, 3.5, 1]]) {
    C(root, 0.26 * s, 0.3 * s, 0.22, '#2a323e', px, 0, pz, 24);
    C(root, 0.24 * s, 0.24 * s, 0.02, glow('#5ef2a0'), px, 0.22, pz, 24);
    C(root, 0.24 * s, 0.24 * s, 0.9 * s, podGlass, px, 0.24, pz, 24);
    const geo = new THREE.IcosahedronGeometry(1, 0);
    [[0, 0.45, 0, 0.17], [0.07, 0.65, 0.03, 0.13], [-0.06, 0.6, -0.05, 0.12], [0.02, 0.82, 0, 0.1]].forEach(([bx, by, bz, r], i) => {
      const m = new THREE.Mesh(geo, leaf[i % 2]); m.position.set(px + bx * s, 0.24 + by * s, pz + bz * s); m.scale.setScalar(r * s); m.castShadow = true; root.add(m);
    });
    C(root, 0.24 * s, 0.24 * s, 0.03, '#2a323e', px, 0.24 + 0.9 * s, pz, 24);
    nav.blockCircle(px, pz, 0.3 * s, 0.25);
  }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight('#8fb0d8', '#141820', 1.9);
  const key = keyLight('#dfeaff', 2.3);
  const planetLight = new THREE.DirectionalLight('#7fb8ff', 0.8); planetLight.position.set(2, 6, -20);
  const capLight = new THREE.PointLight(COL.warm, 1.8, 6, 1.8); capLight.position.set(CAP.x, 2.6, CAP.z);
  const fill = [[O.x, O.z - 3], [O.x - 4, O.z + 1], [O.x + 3.5, O.z + 2], [9.1, -4.5], [9.1, 3.2], [-9.8, 5.2]].map(([x, z]) => { const l = new THREE.PointLight('#8fd8ff', 1.4, 8, 1.8); l.position.set(x, 2.8, z); return l; });
  root.add(hemi, key, key.target, planetLight, capLight, ...fill);
  const TOD = {
    day:     { hemi: 1.9, key: ['#dfeaff', 2.3], planet: ['#7fb8ff', 1.0], fill: 2.0 },
    evening: { hemi: 1.5, key: ['#ffd7b0', 1.9], planet: ['#ff9a5a', 1.2], fill: 2.6 },
    night:   { hemi: 1.0, key: ['#9fb4ff', 1.0], planet: ['#6f5cff', 0.35], fill: 3.6 },
  };
  function setTimeOfDay(tod) {
    const p = TOD[tod];
    hemi.intensity = p.hemi;
    key.color.set(p.key[0]); key.intensity = p.key[1];
    planetLight.color.set(p.planet[0]); planetLight.intensity = p.planet[1];
    fill.forEach((l) => { l.intensity = p.fill; });
    space.draw(tod); loungeView.draw(tod);
  }
  setTimeOfDay('day');

  let time = 0;
  updaters.unshift((dt) => { time += dt; });
  updaters.push(() => { for (const [m, b, ph, sp] of pulse) m.color.copy(b).multiplyScalar(0.8 + 0.2 * Math.sin(time * sp + ph)); });

  return {
    root, nav, monitors, setTimeOfDay, heightAt, cutaway,
    layout: { desks: DESKS, loungeSeats: LOUNGE_SEATS },
    background: '#05070c',
    bloom: { strength: 0.24, radius: 0.35, threshold: 0.82 },
    todLabels: { day: 'Orbit', evening: 'Sunrise', night: 'Deep space' },
    dressBot,
    setUsage: (u) => usageBoard.draw(u),
    update: (dt) => updaters.forEach((f) => f(dt, time)),
  };
}

// uniform belt + collar + badge, data pad instead of paper
function dressBot(bot, member, isLead) {
  const dark = new THREE.MeshLambertMaterial({ color: '#1b2029' });
  const metal = new THREE.MeshLambertMaterial({ color: isLead ? '#f2c46b' : '#c9d3df', emissive: isLead ? '#3a2a08' : '#111' });
  const add = (mat, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.userData.botId = member.id; bot.body.add(m); return m;
  };
  add(dark, 0.43, 0.06, 0.26, 0, 0.47, 0);   // belt
  add(dark, 0.43, 0.05, 0.26, 0, 0.84, 0);   // collar
  add(metal, 0.07, 0.07, 0.02, -0.11, 0.74, 0.13); // badge
  if (isLead) { add(metal, 0.12, 0.025, 0.26, -0.25, 0.83, 0); add(metal, 0.12, 0.025, 0.26, 0.25, 0.83, 0); } // shoulder stripes
  bot.paper.material = new THREE.MeshBasicMaterial({ color: '#5fe3ff', toneMapped: false });
  bot.paper.scale.set(0.2, 0.025, 0.14);
}

function starChair(root, x, z, y0, accent, big) {
  const tint = accent ? new THREE.Color(accent).lerp(new THREE.Color('#1f252e'), 0.45).getStyle() : '#2a323e';
  C(root, big ? 0.3 : 0.24, big ? 0.34 : 0.26, 0.05, '#2a323e', x, y0, z, 24);
  C(root, 0.05, 0.05, 0.36, '#8a96a5', x, y0 + 0.05, z, 10);
  B(root, big ? 0.62 : 0.5, 0.08, 0.5, COL.chair, x, y0 + 0.4, z);
  B(root, big ? 0.62 : 0.5, big ? 0.85 : 0.7, 0.08, tint, x, y0 + 0.46, z + 0.26);
  B(root, big ? 0.62 : 0.5, 0.025, 0.02, new THREE.MeshBasicMaterial({ color: accent || '#38e1ff', toneMapped: false }), x, y0 + (big ? 1.28 : 1.13), z + 0.30, { cast: false });
  if (big) {
    for (const s of [-1, 1]) {
      B(root, 0.1, 0.06, 0.48, '#2a323e', x + s * 0.36, y0 + 0.62, z);
      B(root, 0.08, 0.005, 0.18, new THREE.MeshBasicMaterial({ color: '#ffb547', toneMapped: false }), x + s * 0.36, y0 + 0.68, z - 0.1, { cast: false });
    }
  }
}

function loungeSofa(root, s, facing, nav) {
  if (facing === 'z-') {
    B(root, s.w, 0.4, s.d, COL.sofa, s.x, 0, s.z);
    B(root, s.w, 0.85, 0.2, COL.sofaDark, s.x, 0, s.z + s.d / 2 - 0.1);
    B(root, 0.2, 0.58, s.d, COL.sofaDark, s.x - s.w / 2 + 0.1, 0, s.z);
    B(root, 0.2, 0.58, s.d, COL.sofaDark, s.x + s.w / 2 - 0.1, 0, s.z);
    B(root, s.w - 0.1, 0.02, 0.02, new THREE.MeshBasicMaterial({ color: '#1d9fbf', toneMapped: false }), s.x, 0.03, s.z - s.d / 2, { cast: false });
    nav.blockBox(s.x, s.z, s.w, s.d, 0.25);
    return;
  }
  const along = facing === 'z+';
  B(root, s.w, 0.4, s.d, COL.sofa, s.x, 0, s.z);
  if (along) {
    B(root, s.w, 0.85, 0.2, COL.sofaDark, s.x, 0, s.z - s.d / 2 + 0.1);
    B(root, 0.2, 0.58, s.d, COL.sofaDark, s.x - s.w / 2 + 0.1, 0, s.z);
    B(root, 0.2, 0.58, s.d, COL.sofaDark, s.x + s.w / 2 - 0.1, 0, s.z);
    B(root, s.w - 0.1, 0.02, 0.02, new THREE.MeshBasicMaterial({ color: '#1d9fbf', toneMapped: false }), s.x, 0.03, s.z + s.d / 2, { cast: false });
  } else {
    B(root, 0.2, 0.85, s.d, COL.sofaDark, s.x - s.w / 2 + 0.1, 0, s.z);
    B(root, s.w, 0.58, 0.2, COL.sofaDark, s.x, 0, s.z - s.d / 2 + 0.1);
    B(root, s.w, 0.58, 0.2, COL.sofaDark, s.x, 0, s.z + s.d / 2 - 0.1);
    B(root, 0.02, 0.02, s.d - 0.1, new THREE.MeshBasicMaterial({ color: '#1d9fbf', toneMapped: false }), s.x + s.w / 2, 0.03, s.z, { cast: false });
  }
  nav.blockBox(s.x, s.z, s.w, s.d, 0.25);
}
