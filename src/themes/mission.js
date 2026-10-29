// 1969 mission control. Same floor plan as the office:
//   lead's glass office → the flight director's raised tier, facing the big screen
//   desks               → grey-green consoles with green-phosphor CRTs (lit while working)
//   server racks        → tape-drive mainframes with spinning reels
//   research screens    → telemetry, launch TV and teletype panels
//   windows             → the big ground-track wall display
//   status board        → GO / HOLD / NO-GO lamps driven by real statuses
//                         (HOLD blinks while the lead waits for your go-ahead)
//   wall clocks         → your real local time and UTC
//   lounge              → mid-century sofas and a wood-cabinet TV
//   break room          → coffee urn and a soda machine
//   huddle table        → briefing table with binders and a red phone
//   time of day         → day / swing / night shift lighting
//   handoffs            → flight-plan binders; everyone wears a headset and tie
import * as THREE from 'three';
import * as L from '../layout.js';
import { NavGrid } from '../pathfinding.js';
import * as T from '../textures.js';
import { B, C, floorPlane, matte, glow, zoneTexture, lightBanks, keyLight, relabel, createCutaway } from './kit.js';

// ---------- floor plan: tiered mission control ----------
//   tier 0 (front, floor level): Booster + Guidance + a spare console, facing the big wall display
//   tier 1 (+0.3): Capcom + a spare console
//   tier 2 (+0.6): the flight director, then a glass partition and the raised viewing
//   gallery (sofas facing the screens, coffee corner, briefing table) behind it.
//   Ramps at both ends are the only way between tiers.
const RISER = [-4.0, -1.0], TIER_H = 0.3, GLASS_Z = 2.4;
const AISLES = [[-9.6, -8.4], [8.2, 9.4]];
const inAisle = (x) => AISLES.some(([a, b]) => x >= a && x <= b);
function heightAt(x, z) {
  if (inAisle(x)) {
    if (z >= RISER[0] - 0.3 && z <= RISER[0] + 0.3) return TIER_H * (z - (RISER[0] - 0.3)) / 0.6;
    if (z >= RISER[1] - 0.3 && z <= RISER[1] + 0.3) return TIER_H + TIER_H * (z - (RISER[1] - 0.3)) / 0.6;
  }
  return z < RISER[0] ? 0 : z < RISER[1] ? TIER_H : TIER_H * 2;
}
const DESKS = {
  'back-left':  { x: -5.4, z: -6.3, w: 2.4, d: 0.95, rot: Math.PI },
  'back-mid':   { x: -1.4, z: -6.3, w: 2.4, d: 0.95, rot: Math.PI },
  'back-right': { x: 2.6,  z: -6.3, w: 2.4, d: 0.95, rot: Math.PI },
  'mid-left':   { x: -3.4, z: -3.3, w: 2.4, d: 0.95, rot: Math.PI },
  'mid-right':  { x: 0.6,  z: -3.3, w: 2.4, d: 0.95, rot: Math.PI },
  'front-left': { x: 6.6,  z: -6.3, w: 2.4, d: 0.95, rot: Math.PI },
  'front-right':{ x: 4.6,  z: -3.3, w: 2.4, d: 0.95, rot: Math.PI },
  lead:         { x: -1.4, z: -0.1, w: 2.8, d: 0.95, rot: Math.PI },
};
const SOFAS = [{ x: -4.2, z: 4.2, w: 3.4 }, { x: 1.6, z: 4.2, w: 3.4 }];
const LOUNGE_SEATS = [];
for (const s of SOFAS) for (const dx of [-1.2, -0.4, 0.4, 1.2]) LOUNGE_SEATS.push(L.benchSeat(s.x + dx, s.z + 0.05, Math.PI, 1.0));
const SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
const COL = { body: '#7d8478', bodyDark: '#5d645a', panel: '#2c312d', wall: '#3a3d3e', walnut: '#5a3b24', teak: '#8a5a34', chrome: '#b8bec6', mustard: '#c8962c', orange: '#c4622d' };

// ---------- textures ----------
function carpetTiles() {
  const S = 512, c = T.canvas(S, S), g = c.getContext('2d'), r = T.rng(12);
  for (let y = 0; y < S; y += 128) for (let x = 0; x < S; x += 128) {
    g.fillStyle = `hsl(212, 14%, ${21 + r() * 4}%)`; g.fillRect(x, y, 128, 128);
    g.globalAlpha = 0.08;
    for (let k = 0; k < 260; k++) { g.fillStyle = r() > 0.5 ? '#9fb0c8' : '#000'; g.fillRect(x + r() * 128, y + r() * 128, 2, 2); }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y, 128, 2); g.fillRect(x, y, 2, 128);
  }
  return T.tex(c, { repeat: [12, 9] });
}
function walnutPanels(repeat) {
  const c = T.canvas(512, 512), g = c.getContext('2d'), r = T.rng(8);
  for (let x = 0; x < 512; x += 64) {
    g.fillStyle = `hsl(25, 38%, ${22 + r() * 6}%)`; g.fillRect(x, 0, 64, 512);
    g.globalAlpha = 0.12; g.strokeStyle = '#1a0f08';
    for (let k = 0; k < 8; k++) { g.lineWidth = 1 + r() * 2; g.beginPath(); const xx = x + 6 + r() * 52; g.moveTo(xx, 0); g.bezierCurveTo(xx + 8, 170, xx - 8, 340, xx + 4, 512); g.stroke(); }
    g.globalAlpha = 1; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, 0, 3, 512);
  }
  return T.tex(c, { repeat });
}
function acoustic(repeat) {
  const c = T.canvas(256, 256), g = c.getContext('2d');
  g.fillStyle = COL.wall; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(0,0,0,.25)';
  for (let y = 8; y < 256; y += 16) for (let x = 8; x < 256; x += 16) { g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 0, 256, 3); g.fillRect(0, 0, 3, 256);
  return T.tex(c, { repeat });
}
function lampPanel() {
  const c = T.canvas(256, 96), g = c.getContext('2d'), r = T.rng(3);
  g.fillStyle = COL.panel; g.fillRect(0, 0, 256, 96);
  for (let y = 10; y < 90; y += 20) for (let x = 10; x < 250; x += 20) {
    const k = r(); g.fillStyle = k > 0.85 ? '#e8b84a' : k > 0.75 ? '#5ad16a' : k > 0.7 ? '#e05a4a' : '#ddd6c4';
    g.fillRect(x, y, 13, 11);
  }
  return T.tex(c);
}

const CONTINENTS = [
  [[-168, 65], [-140, 70], [-95, 72], [-65, 60], [-55, 50], [-80, 25], [-97, 18], [-110, 23], [-125, 40], [-135, 58]],
  [[-80, 10], [-60, 10], [-35, -5], [-40, -22], [-70, -55], [-75, -40], [-80, -5]],
  [[-10, 36], [-10, 44], [0, 50], [10, 58], [30, 70], [40, 65], [30, 45], [20, 38]],
  [[-17, 15], [-5, 35], [10, 37], [32, 31], [43, 12], [51, 11], [40, -15], [20, -35], [12, -17], [9, 4]],
  [[40, 65], [70, 73], [140, 72], [170, 65], [140, 45], [120, 22], [105, 10], [90, 22], [77, 8], [60, 25], [45, 30], [30, 45]],
  [[114, -22], [130, -12], [143, -11], [153, -27], [146, -39], [115, -34]],
];
class GroundTrack {
  constructor() { this.c = T.canvas(1600, 480); this.g = this.c.getContext('2d'); this.texture = T.tex(this.c); this.t = 0; this.draw(); }
  draw() {
    const { g } = this, W = 1600, H = 480, px = (lon) => 40 + ((lon + 180) / 360) * (W - 80), py = (lat) => 60 + ((90 - lat) / 180) * (H - 100);
    g.fillStyle = '#0b1a2e'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(120,170,220,.18)'; g.lineWidth = 1.5;
    for (let lon = -180; lon <= 180; lon += 30) { g.beginPath(); g.moveTo(px(lon), py(90)); g.lineTo(px(lon), py(-90)); g.stroke(); }
    for (let lat = -60; lat <= 60; lat += 30) { g.beginPath(); g.moveTo(px(-180), py(lat)); g.lineTo(px(180), py(lat)); g.stroke(); }
    g.fillStyle = '#28486a';
    for (const poly of CONTINENTS) { g.beginPath(); poly.forEach(([lo, la], i) => (i ? g.lineTo(px(lo), py(la)) : g.moveTo(px(lo), py(la)))); g.closePath(); g.fill(); }
    const track = (phase, color, dash) => {
      g.strokeStyle = color; g.lineWidth = 3; g.setLineDash(dash); g.beginPath();
      for (let lon = -180; lon <= 180; lon += 3) { const la = 32 * Math.sin(((lon + phase) * Math.PI) / 180); lon === -180 ? g.moveTo(px(lon), py(la)) : g.lineTo(px(lon), py(la)); }
      g.stroke(); g.setLineDash([]);
    };
    track(40, 'rgba(255,210,120,.35)', [8, 10]);
    track(17, 'rgba(255,210,120,.6)', [12, 8]);
    track(-6, 'rgba(255,220,140,.95)', []);
    const lon = ((this.t * 0.6) % 360) - 180, la = 32 * Math.sin(((lon - 6) * Math.PI) / 180);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(px(lon), py(la), 9, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(px(lon), py(la), 18 + (this.t % 20), 0, 7); g.stroke();
    g.fillStyle = '#d8e4f0'; g.font = `700 30px ${SANS}`; g.fillText('GROUND TRACK', 50, 42);
    this.t++; this.texture.needsUpdate = true;
  }
}
class Clocks {
  constructor() { this.c = T.canvas(800, 160); this.g = this.c.getContext('2d'); this.texture = T.tex(this.c); this.last = ''; this.draw(); }
  draw() {
    const now = new Date();
    const loc = now.toLocaleTimeString([], { hour12: false });
    if (loc === this.last) return; this.last = loc;
    const utc = now.toISOString().slice(11, 19);
    const { g } = this;
    g.fillStyle = '#0d0f0e'; g.fillRect(0, 0, 800, 160);
    g.fillStyle = '#9aa29a'; g.font = `700 26px ${SANS}`; g.fillText('LOCAL', 40, 44); g.fillText('UTC', 440, 44);
    g.fillStyle = '#ff7a3a'; g.font = '700 74px "Courier New", monospace'; g.fillText(loc, 30, 128); g.fillText(utc, 430, 128);
    this.texture.needsUpdate = true;
  }
}
class GoBoard {
  constructor() { this.c = T.canvas(800, 220); this.g = this.c.getContext('2d'); this.texture = T.tex(this.c); this.state = 'idle'; this.blink = true; this.draw(); }
  draw() {
    const { g } = this;
    g.fillStyle = '#121413'; g.fillRect(0, 0, 800, 220);
    const lamp = (x, label, on, col) => {
      g.fillStyle = on ? col : '#2a2d2b'; g.fillRect(x, 40, 220, 140);
      g.fillStyle = on ? '#111' : '#555'; g.font = `800 52px ${SANS}`; g.textAlign = 'center'; g.fillText(label, x + 110, 128); g.textAlign = 'left';
    };
    lamp(30, 'GO', this.state === 'go', '#4ad66a');
    lamp(290, 'HOLD', this.state === 'hold' && this.blink, '#f0b43a');
    lamp(550, 'NO-GO', this.state === 'nogo', '#e8483a');
    this.texture.needsUpdate = true;
  }
}
class LaunchTV {
  constructor() { this.c = T.canvas(400, 300); this.g = this.c.getContext('2d'); this.texture = T.tex(this.c); this.t = 0; }
  draw() {
    const { g } = this; this.t++;
    const gr = g.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#7b8a96'); gr.addColorStop(1, '#c9c2b2');
    g.fillStyle = gr; g.fillRect(0, 0, 400, 300);
    g.fillStyle = '#4a4a48'; g.fillRect(150, 70, 30, 200); // tower
    for (let y = 80; y < 260; y += 20) g.fillRect(140, y, 50, 3);
    g.fillStyle = '#efefe8'; g.fillRect(205, 60, 34, 190); g.beginPath(); g.moveTo(205, 60); g.lineTo(222, 25); g.lineTo(239, 60); g.fill();
    g.fillStyle = '#222'; g.fillRect(205, 130, 34, 6); g.fillRect(205, 190, 34, 6);
    g.fillStyle = 'rgba(255,255,255,.08)';
    for (let k = 0; k < 400; k++) g.fillRect(Math.random() * 400, Math.random() * 300, 2, 2); // grain
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, (this.t * 7) % 300, 400, 10); // roll bar
    this.texture.needsUpdate = true;
  }
}
class PhosphorText {
  constructor() { this.c = T.canvas(320, 240); this.g = this.c.getContext('2d'); this.texture = T.tex(this.c); this.rows = []; this.r = T.rng(19); }
  draw() {
    const words = ['GUID', 'NAV', 'PWR', 'O2', 'H2', 'TEMP', 'ALT', 'VEL', 'ATT', 'RCS', 'SPS', 'CMD'];
    const r = this.r;
    this.rows.push(`${words[(r() * words.length) | 0]} ${String((r() * 9999) | 0).padStart(4, '0')} ${r() > 0.5 ? '+' : '-'}${(r() * 99).toFixed(1)}`);
    if (this.rows.length > 9) this.rows.shift();
    const { g } = this;
    g.fillStyle = '#06140a'; g.fillRect(0, 0, 320, 240);
    g.fillStyle = '#7dff9a'; g.font = '700 22px "Courier New", monospace';
    this.rows.forEach((row, i) => g.fillText(row, 14, 30 + i * 24));
    this.texture.needsUpdate = true;
  }
}

// ---------- builder ----------
export function buildMission({ team, leadId, desks }) {
  const root = new THREE.Group();
  const nav = new NavGrid();
  const updaters = [];
  const bySlot = Object.fromEntries(team.filter((t) => desks[t.id]).map((t) => [desks[t.id], t]));
  const labels = [[/architect|lead|chief/, 'Flight'], [/build|engineer|develop/, 'Booster'], [/review|qa/, 'Guidance'], [/freelanc/, 'Capcom']];
  const H = L.WALL_H, T_ = 0.3;
  const fw = L.FLOOR.maxX - L.FLOOR.minX, fd = L.FLOOR.maxZ - L.FLOOR.minZ;

  // ---------- floor + tiers ----------
  const carpet = carpetTiles();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.25, fd), [matte('#2a2e33'), matte('#2a2e33'), new THREE.MeshStandardMaterial({ map: carpet, roughness: 1 }), matte('#2a2e33'), matte('#22262a'), matte('#22262a')]);
  floor.position.y = -0.125; floor.receiveShadow = true; root.add(floor);
  const tierMat = (d) => { const t = carpet.clone(); t.repeat.set(12, 9 * d / fd); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 1 }); };
  const tier = (z0, z1, h) => {
    const d = z1 - z0;
    const m = new THREE.Mesh(new THREE.BoxGeometry(fw, h, d), [matte('#2a2e33'), matte('#2a2e33'), tierMat(d), matte('#2a2e33'), matte('#33373d'), matte('#33373d')]);
    m.position.set(0, h / 2, (z0 + z1) / 2); m.receiveShadow = true; m.castShadow = true; root.add(m);
    B(root, fw, 0.025, 0.03, glow('#e8b84a'), 0, h - 0.04, z0 - 0.005, { cast: false }); // riser edge light
  };
  tier(RISER[0], L.FLOOR.maxZ, TIER_H);
  tier(RISER[1], L.FLOOR.maxZ, TIER_H * 2);
  // ramps in the aisles (steps you can see; bots glide up smoothly)
  for (const [a, b] of AISLES) for (const [rz, base] of [[RISER[0], 0], [RISER[1], TIER_H]]) {
    for (let i = 0; i < 3; i++) B(root, b - a, base + TIER_H * (i + 1) / 3, 0.2, '#3a3f46', (a + b) / 2, 0, rz - 0.3 + 0.1 + i * 0.2);
    for (const x of [a, b]) B(root, 0.05, 0.9, 0.05, COL.chrome, x, base, rz);
  }
  nav.blockWhere(-99, 99, RISER[0] - 0.05, RISER[0] + 0.05, (x) => !inAisle(x));
  nav.blockWhere(-99, 99, RISER[1] - 0.05, RISER[1] + 0.05, (x) => !inAisle(x));
  nav.blockWhere(-99, 99, GLASS_Z - 0.05, GLASS_Z + 0.05, (x) => !inAisle(x));
  // station labels on the floor behind each chair
  for (const [slot, d] of Object.entries(DESKS)) {
    const m = bySlot[slot], y = heightAt(d.x, d.z) + 0.006;
    const w = d.w + 0.2, dd = 1.6;
    floorPlane(root, w, dd, zoneTexture(m?.color || '#9aa29a', slot === 'lead' ? 'Flight' : relabel(m, labels, 'Spare'), w, dd, { fill: 0.07, border: 0.3, font: `700 {S}px ${SANS}`, labelAlpha: 0.6 }), d.x, d.z + d.d / 2 + dd / 2 - 0.05, y, { transparent: true, depthWrite: false });
  }

  // ---------- walls ----------
  const wallZ = L.BACK_WALL_Z - T_ / 2, wallX = L.LEFT_WALL_X - T_ / 2;
  const cutaway = createCutaway();
  const westG = new THREE.Group(), northG = new THREE.Group(); root.add(westG, northG);
  const westDecor = [], northDecor = [];
  cutaway.add(westG, -1, 0, { decor: westDecor, low: 0.4 });
  cutaway.add(northG, 0, -1, { decor: northDecor });
  B(westG, T_, H + 0.6, fd, new THREE.MeshStandardMaterial({ map: walnutPanels([9, 1]), roughness: 0.6 }), wallX, 0, 0);
  B(northG, fw, H, T_, new THREE.MeshStandardMaterial({ map: acoustic([24, 6.4]), roughness: 1 }), 0, 0, wallZ);
  B(northG, fw, 0.14, 0.05, '#1c1d1e', 0, 0, L.BACK_WALL_Z + 0.02, { cast: false });
  B(northG, fw, 0.06, T_ + 0.02, '#2a2b2c', 0, H, wallZ, { cast: false });

  // ---------- the big board ----------
  const track = new GroundTrack(), clocks = new Clocks(), go = new GoBoard();
  const screens = { chart: new T.ChartScreen(), map: new LaunchTV(), terminal: new PhosphorText() };
  const panel = (x, y, w, h, tex, tint = '#e8e8e0') => {
    northDecor.push(B(root, w + 0.16, h + 0.16, 0.08, '#141516', x, y - h / 2 - 0.08, L.BACK_WALL_Z + 0.04, { cast: false }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: tint }));
    m.position.set(x, y, L.BACK_WALL_Z + 0.085); root.add(m); northDecor.push(m);
  };
  panel(0, 1.7, 11.0, 1.8, track.texture, '#c9d4e0');
  panel(0, 2.92, 2.2, 0.44, clocks.texture, '#ffffff');
  panel(-7.6, 2.3, 1.5, 0.95, screens.map.texture);
  panel(-7.6, 1.15, 1.5, 0.95, screens.terminal.texture, '#b8ffc8');
  panel(7.6, 2.3, 1.5, 0.95, screens.chart.texture, '#9fe8b0');
  panel(7.6, 1.15, 1.5, 0.41, go.texture, '#dddddd');
  let st = 0;
  updaters.push((dt) => { st += dt; if (st > 0.2) { st = 0; screens.chart.draw(); screens.map.draw(); screens.terminal.draw(); track.draw(); crt.draw(); clocks.draw(); } });

  // ---------- consoles ----------
  const crt = new PhosphorText();
  const crtOn = new THREE.MeshBasicMaterial({ map: crt.texture, toneMapped: false, color: '#b8ffc8' });
  const crtOff = new THREE.MeshStandardMaterial({ color: '#1b2a20', roughness: 0.3 });
  const lamps = new THREE.MeshBasicMaterial({ map: lampPanel(), toneMapped: false, color: '#b8b2a2' });
  const monitors = {};
  for (const [slot, d] of Object.entries(DESKS)) {
    const who = bySlot[slot], lead = slot === 'lead', y0 = heightAt(d.x, d.z);
    const g = new THREE.Group(); g.position.set(d.x, y0, d.z); g.rotation.y = d.rot - Math.PI; root.add(g);
    B(g, d.w, 0.7, d.d * 0.7, COL.body, 0, 0, -d.d * 0.15);
    B(g, d.w + 0.04, 0.04, d.d, '#4a4d48', 0, 0.7, 0);
    B(g, d.w * 0.92, 0.62, d.d * 0.42, COL.bodyDark, 0, 0.74, -d.d * 0.27);
    const nCrt = lead ? 2 : 1;
    for (let i = 0; i < nCrt; i++) {
      const cx = nCrt === 1 ? -0.3 : (i ? 0.55 : -0.55);
      B(g, 0.62, 0.48, 0.05, COL.panel, cx, 0.8, -d.d * 0.06);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.38), crtOff);
      scr.position.set(cx, 1.04, -d.d * 0.06 + 0.027); g.add(scr);
      monitors[slot] = ((prev) => (on) => { prev?.(on); scr.material = on ? crtOn : crtOff; })(monitors[slot]);
    }
    const lp = new THREE.Mesh(new THREE.PlaneGeometry(lead ? 0.5 : 0.62, 0.28), lamps);
    lp.position.set(lead ? 0 : 0.45, 0.98, -d.d * 0.06 + 0.028); g.add(lp);
    const slope = new THREE.Mesh(new THREE.PlaneGeometry(d.w * 0.8, 0.22), lamps);
    slope.rotation.x = -Math.PI / 2 + 0.5; slope.position.set(0, 0.77, d.d * 0.12); g.add(slope);
    C(g, 0.045, 0.04, 0.1, '#e8e2d2', d.w / 2 - 0.2, 0.72, 0.2, 12);
    B(g, 0.24, 0.05, 0.3, who?.color ? T.mix(who.color, '#1f2a44', 0.5) : '#1f3a6b', -d.w / 2 + 0.25, 0.72, 0.15);
    if (lead) { B(g, 0.22, 0.08, 0.16, '#b22a22', 0.85, 0.72, 0.25); C(g, 0.03, 0.03, 0.22, '#b22a22', 0.85, 0.82, 0.25, 8).rotation.z = Math.PI / 2; }
    const seat = L.deskSeat(slot, DESKS);
    const cg = new THREE.Group(); cg.position.set(seat.x, y0, seat.z); cg.rotation.y = d.rot - Math.PI; root.add(cg);
    C(cg, 0.26, 0.26, 0.03, COL.chrome, 0, 0, 0, 5);
    C(cg, 0.03, 0.03, 0.38, COL.chrome, 0, 0.03, 0, 8);
    B(cg, 0.5, 0.08, 0.48, '#1f1f20', 0, 0.4, 0);
    B(cg, 0.48, lead ? 0.75 : 0.55, 0.08, '#262627', 0, 0.5, 0.25);
    nav.blockOBB(d.x, d.z, d.w, d.d, d.rot, 0.28);
    nav.blockCircle(seat.x, seat.z, 0.28, 0.15);
  }

  // ---------- tape-drive mainframes (west wall) ----------
  const reels = [];
  for (const z of [-7.9, -7.1, -6.3]) {
    const x = -11.35;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.PI / 2; root.add(g);
    B(g, 0.74, 1.95, 0.7, '#c9c6bb', 0, 0, 0);
    B(g, 0.66, 0.8, 0.02, '#20232a', 0, 1.0, 0.355, { cast: false });
    for (const dx of [-0.17, 0.17]) {
      const rg = new THREE.Group(); rg.position.set(dx, 1.42, 0.37); g.add(rg);
      rg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 28).rotateX(Math.PI / 2), matte('#2a2620')));
      for (let k = 0; k < 3; k++) { const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.025), matte('#9aa0a6')); spoke.rotation.z = (k * Math.PI) / 3; spoke.position.z = 0.012; rg.add(spoke); }
      reels.push({ g: rg, speed: 0, target: 0, dir: dx < 0 ? 1 : -1, next: Math.random() * 3 });
    }
    B(g, 0.5, 0.06, 0.02, '#20232a', 0, 0.55, 0.36, { cast: false });
    nav.blockBox(x, z, 0.7, 0.74, 0.28);
  }
  updaters.push((dt) => reels.forEach((r) => {
    r.next -= dt;
    if (r.next < 0) { r.target = Math.random() > 0.35 ? (1 + Math.random() * 5) * r.dir : 0; r.next = 0.6 + Math.random() * 2.5; }
    r.speed += (r.target - r.speed) * Math.min(1, dt * 4);
    r.g.rotation.z += r.speed * dt;
  }));
  lightBanks(root, nav, updaters, [{ x: -11.55, y: TIER_H, z: -2.5, w: 1.6, rot: Math.PI / 2 }], { body: '#7d8478', face: '#1d211e', colors: ['#f0b43a', '#ddd6c4', '#5ad16a', '#e05a4a'], off: '#2c2f2c', rows: 7, cols: 12 });

  // ---------- fuel board (usage) on the west wall, top tier ----------
  const usageBoard = new T.UsageBoard({ bg: '#141814', frame: '#5c5a4a', title: 'FUEL · WEEKLY USAGE', accent: '#e0b23a', big: '#f0e6c8', text: '#d8d0b0', muted: '#a8a088', faint: '#7a7460', track: '#2c2e28', font: SANS });
  {
    const uz = 0.6, uw = 2.6, uh = 1.26, uy = 2.45;
    westDecor.push(B(root, 0.08, uh + 0.14, uw + 0.14, '#2a2b2c', L.LEFT_WALL_X + 0.04, uy - uh / 2 - 0.07, uz, { cast: false }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(uw, uh), new THREE.MeshBasicMaterial({ map: usageBoard.texture, toneMapped: false, color: '#e0ddd2' }));
    m.rotation.y = Math.PI / 2; m.position.set(L.LEFT_WALL_X + 0.085, uy, uz); root.add(m); westDecor.push(m);
  }

  // ---------- glass partition + viewing gallery ----------
  const G0 = TIER_H * 2;
  {
    const glass = new THREE.MeshStandardMaterial({ color: '#b9d3ea', transparent: true, opacity: 0.14, roughness: 0.1, depthWrite: false });
    const runs = [[L.FLOOR.minX, AISLES[0][0]], [AISLES[0][1], AISLES[1][0]], [AISLES[1][1], L.FLOOR.maxX]];
    for (const [a, b] of runs) {
      B(root, b - a, 0.5, 0.18, COL.walnut, (a + b) / 2, G0, GLASS_Z);
      B(root, b - a, 1.2, 0.03, glass, (a + b) / 2, G0 + 0.5, GLASS_Z, { cast: false });
      B(root, b - a, 0.05, 0.08, COL.chrome, (a + b) / 2, G0 + 1.7, GLASS_Z, { cast: false });
    }
    floorPlane(root, 7, 1.0, T.floorLabel('Viewing Gallery', '#b8b2a2', 7, 1.0), -1.3, 8.2, G0 + 0.006, { transparent: true });
    // sofas facing the big board
    for (const s of SOFAS) {
      const g = new THREE.Group(); g.position.set(s.x, G0, s.z); root.add(g);
      B(g, s.w, 0.16, 0.95, COL.teak, 0, 0.18, 0);
      for (const dx of [-1, 1]) for (const dz of [-1, 1]) B(g, 0.05, 0.18, 0.05, COL.teak, dx * (s.w / 2 - 0.1), 0, dz * 0.37);
      B(g, s.w - 0.1, 0.1, 0.7, s === SOFAS[0] ? COL.mustard : COL.orange, 0, 0.34, -0.08);
      B(g, s.w - 0.1, 0.5, 0.18, s === SOFAS[0] ? COL.mustard : COL.orange, 0, 0.34, 0.36);
      nav.blockBox(s.x, s.z, s.w, 0.95, 0.25);
    }
    // wood-cabinet TV between the sofas
    const tv = { x: -1.3, z: 5.4 };
    B(root, 0.9, 0.75, 0.55, COL.walnut, tv.x, G0, tv.z);
    const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.38), new THREE.MeshBasicMaterial({ map: screens.map.texture, toneMapped: false, color: '#cfcfc8' }));
    tvScreen.position.set(tv.x, G0 + 0.42, tv.z + 0.28); root.add(tvScreen);
    nav.blockBox(tv.x, tv.z, 0.9, 0.6, 0.2);
  }

  // ---------- coffee corner (gallery, east) ----------
  {
    const cx = 11.25, cz = 5.2;
    B(root, 0.6, 0.88, 2.6, '#d8d2c0', cx, G0, cz);
    B(root, 0.64, 0.04, 2.64, '#5a9a94', cx, G0 + 0.88, cz);
    C(root, 0.16, 0.16, 0.5, COL.chrome, cx, G0 + 0.92, cz - 0.8, 20);
    C(root, 0.1, 0.16, 0.06, COL.chrome, cx, G0 + 1.42, cz - 0.8, 20);
    for (let i = 0; i < 4; i++) C(root, 0.045, 0.04, 0.09, '#f2eee4', cx - 0.08, G0 + 0.92, cz + 0.2 + i * 0.16, 12);
    nav.blockBox(cx, cz, 0.6, 2.6, 0.28);
    const fx = 11.2, fz = 7.9;
    B(root, 0.75, 1.85, 0.75, '#b8282a', fx, G0, fz);
    const pn = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), glow('#f5ecd8', { transparent: true, opacity: 0.85 }));
    pn.rotation.y = -Math.PI / 2; pn.position.set(fx - 0.38, G0 + 1.15, fz); root.add(pn);
    nav.blockBox(fx, fz, 0.75, 0.75, 0.28);
    const tx = 8.6, tz = 6.4;
    C(root, 0.55, 0.55, 0.04, '#f2eee4', tx, G0 + 0.72, tz, 32);
    C(root, 0.05, 0.25, 0.72, '#f2eee4', tx, G0, tz, 24);
    nav.blockCircle(tx, tz, 0.55, 0.25);
    for (const [sx, sz] of [[7.7, 6.6], [9.5, 6.6], [8.6, 5.5]]) { C(root, 0.2, 0.2, 0.05, '#c4622d', sx, G0 + 0.45, sz, 20); C(root, 0.04, 0.16, 0.45, '#f2eee4', sx, G0, sz, 16); nav.blockCircle(sx, sz, 0.2, 0.15); }
    floorPlane(root, 3, 0.8, T.floorLabel('Coffee', '#8f8a80', 3, 0.8), 9.2, 8.3, G0 + 0.008, { transparent: true });
  }

  // ---------- briefing table (gallery, west) ----------
  {
    const hx = -8.6, hz = 5.8, hw = 2.6, hd = 1.2;
    B(root, hw, 0.05, hd, COL.teak, hx, G0 + 0.72, hz);
    for (const dx of [-1, 1]) B(root, 0.08, 0.72, 0.7, '#3a3d3e', hx + dx * (hw / 2 - 0.3), G0, hz);
    for (let i = 0; i < 3; i++) B(root, 0.24, 0.05, 0.3, ['#1f3a6b', '#6b1f1f', '#2a5a3a'][i], hx - 0.7 + i * 0.6, G0 + 0.77, hz - 0.1);
    B(root, 0.2, 0.08, 0.15, '#1a1a1a', hx + 0.95, G0 + 0.77, hz + 0.25);
    for (const dx of [-0.7, 0.7]) for (const sz of [-1, 1]) {
      const z = hz + sz * (hd / 2 + 0.42);
      const g = new THREE.Group(); g.position.set(hx + dx, G0, z); g.rotation.y = sz > 0 ? 0 : Math.PI; root.add(g);
      C(g, 0.2, 0.2, 0.03, COL.chrome, 0, 0, 0, 5); C(g, 0.03, 0.03, 0.4, COL.chrome, 0, 0.03, 0, 8);
      B(g, 0.46, 0.07, 0.44, '#1f1f20', 0, 0.43, 0); B(g, 0.44, 0.45, 0.07, '#262627', 0, 0.5, 0.22);
    }
    nav.blockBox(hx, hz, hw, hd + 1.6, 0.25);
    floorPlane(root, 3, 0.8, T.floorLabel('Briefing', '#8f8a80', 3, 0.8), hx, 8.3, G0 + 0.008, { transparent: true });
  }

  // ---------- planters ----------
  for (const [px, pz, s] of [[-11.2, -4.7, 1], [11.2, -8.2, 1], [11.2, -1.6, 0.9], [-11.2, 3.2, 1], [-6.6, 7.9, 0.9], [4.2, 7.9, 0.9]]) {
    const y0 = heightAt(px, pz);
    C(root, 0.22 * s, 0.2 * s, 0.4 * s, '#e8e2d2', px, y0 + 0.18, pz, 20);
    for (let i = 0; i < 3; i++) B(root, 0.025, 0.2, 0.025, '#2a2b2c', px + Math.cos(i * 2.1) * 0.15 * s, y0, pz + Math.sin(i * 2.1) * 0.15 * s);
    for (let i = 0; i < 7; i++) {
      const leaf = B(root, 0.05 * s, (0.5 + (i % 3) * 0.15) * s, 0.015, matte(i % 2 ? '#3f7a3a' : '#5a8f45'), px + Math.cos(i) * 0.07 * s, y0 + 0.55 * s, pz + Math.sin(i) * 0.07 * s);
      leaf.rotation.set(Math.sin(i) * 0.2, i, Math.cos(i) * 0.2);
    }
    nav.blockCircle(px, pz, 0.25 * s, 0.25);
  }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight('#eef2f8', '#3a3530', 1.6);
  const key = keyLight('#f4f6ff', 1.8);
  const screenGlow = new THREE.PointLight('#8fb4e8', 2.5, 10, 1.6); screenGlow.position.set(0, 2, -7);
  const fluor = [[-6, -6], [0, -6], [6, -6], [-4, -2.5], [2, -2.5], [-1.4, 0.8], [-4, 5], [3, 5], [9, 6], [-8.6, 6]].map(([x, z]) => { const l = new THREE.PointLight('#f2f6ff', 1, 8, 1.8); l.position.set(x, 3.0, z); return l; });
  root.add(hemi, key, key.target, screenGlow, ...fluor);
  const TOD = {
    day:     { hemi: 1.7, key: ['#f4f6ff', 1.9], fluor: 1.0, glow: 2.0 },
    evening: { hemi: 1.15, key: ['#ffe6c4', 1.4], fluor: 1.4, glow: 2.6 },
    night:   { hemi: 0.55, key: ['#a8b8e0', 0.6], fluor: 0.6, glow: 3.6 },
  };
  function setTimeOfDay(tod) {
    const p = TOD[tod];
    hemi.intensity = p.hemi; key.color.set(p.key[0]); key.intensity = p.key[1];
    fluor.forEach((l) => { l.intensity = p.fluor; }); screenGlow.intensity = p.glow;
  }
  setTimeOfDay('day');

  // GO / HOLD / NO-GO from real statuses
  let blinkT = 0;
  updaters.push((dt) => { blinkT += dt; if (go.state === 'hold' && blinkT > 0.5) { blinkT = 0; go.blink = !go.blink; go.draw(); } });
  function onAgents(agents, eff) {
    const states = Object.entries(agents).map(([, st]) => eff(st));
    const leadState = eff(agents[leadId]);
    const next = states.includes('error') ? 'nogo' : leadState === 'waiting' ? 'hold' : states.some((s) => ['working', 'meeting', 'handoff'].includes(s)) ? 'go' : 'idle';
    if (next !== go.state) { go.state = next; go.blink = true; go.draw(); }
  }

  let time = 0;
  updaters.unshift((dt) => { time += dt; });

  return {
    root, nav, monitors, setTimeOfDay, heightAt, onAgents, cutaway,
    layout: { desks: DESKS, loungeSeats: LOUNGE_SEATS },
    background: '#0e0f10',
    bloom: { strength: 0.16, radius: 0.35, threshold: 0.9 },
    todLabels: { day: 'Day shift', evening: 'Swing shift', night: 'Night shift' },
    dressBot,
    setUsage: (u) => usageBoard.draw(u),
    update: (dt) => updaters.forEach((f) => f(dt, time)),
  };
}

// headset + tie; flight-plan binders for handoffs
function dressBot(bot, member, isLead) {
  const add = (color, w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color })); m.position.set(x, y, z); m.castShadow = true; m.userData.botId = member.id; bot.body.add(m); return m; };
  add('#f2f2ec', 0.18, 0.06, 0.02, 0, 0.83, 0.126);                 // shirt collar
  add(isLead ? '#a51d1d' : '#1f2a44', 0.06, 0.26, 0.02, 0, 0.7, 0.13); // tie
  add('#1a1a1a', 0.36, 0.03, 0.05, 0, 1.22, 0);                      // headband
  add('#1a1a1a', 0.04, 0.12, 0.12, -0.18, 1.06, 0);                  // earcup
  add('#1a1a1a', 0.02, 0.02, 0.17, -0.17, 0.98, 0.09);               // boom mic
  bot.paper.material = new THREE.MeshLambertMaterial({ color: '#1f3a6b' });
  bot.paper.scale.set(0.24, 0.05, 0.2);
}
