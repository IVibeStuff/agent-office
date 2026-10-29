// Wizard's tower: a round stone room.
//   archmage (lead): raised platform under the great round window, telescope, owl on a perch
//   alchemy benches around the walls: flasks glow and bubble while someone works
//   centre: a glowing magic circle with spell books orbiting above it
//   fireplace corner with a sofa and armchairs: idle wizards rest here
//   scrying mirror on the wall = weekly usage
//   pointed hats for everyone; handoffs are glowing scrolls
// Every wall section is registered for the cutaway, so the room works from any angle.
import * as THREE from 'three';
import * as L from '../layout.js';
import { NavGrid } from '../pathfinding.js';
import * as T from '../textures.js';
import { B, C, floorPlane, matte, glow, zoneTexture, relabel, keyLight, createCutaway, flame } from './kit.js';

const SERIF = '"Palatino Linotype", Palatino, Georgia, serif';
const COL = { stone: '#6a6470', stoneDark: '#4a4552', wood: '#5a3a24', woodDark: '#3a2516', gold: '#d8b04a', purple: '#5a3a8a', velvet: '#4a1f5a', velvetDark: '#33143f', brass: '#b8913a', parchment: '#eadfc4' };

// ---------- floor plan ----------
const O = { x: -1.0, z: -0.3 }, R = 8.4;
const polar = (th, r) => ({ x: O.x + Math.sin(th) * r, z: O.z + Math.cos(th) * r });
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const PLAT = { x: O.x, z: -5.9, r: 2.0, ramp: 0.45, h: 0.3 };
const WINDOW_TH = Math.PI;
const HEARTH_TH = -0.95;
const bench = (th, r = 6.5) => { const p = polar(th, r); return { x: p.x, z: p.z, w: 1.8, d: 0.75, rot: th }; };
const DESKS = {
  lead: { x: PLAT.x, z: PLAT.z + 0.45, w: 2.0, d: 0.85, rot: 0, approach: { x: PLAT.x + 1.45, z: PLAT.z - 0.45 } },
  'back-left': bench(-2.45),
  'back-mid': bench(-1.75),
  'back-right': bench(2.45),
  'mid-right': bench(1.75),
  'mid-left': bench(-0.1),
  'front-left': bench(0.55),
  'front-right': bench(1.15),
};
// fireplace corner
const tng = (th) => ({ x: Math.cos(th), z: -Math.sin(th) });
const HEARTH = polar(HEARTH_TH, R - 0.35);
const RUG = polar(HEARTH_TH, 5.2);
const SOFA = { ...polar(HEARTH_TH, 3.85), rot: HEARTH_TH };
const ARMCHAIRS = [1, -1].map((sg) => {
  const t = tng(HEARTH_TH), x = RUG.x + t.x * 2.75 * sg, z = RUG.z + t.z * 2.75 * sg;
  return { x, z, rot: Math.atan2(HEARTH.x - x, HEARTH.z - z) };
});
const LOUNGE_SEATS = [
  ...[-1.2, -0.4, 0.4, 1.2].map((k) => { const t = tng(HEARTH_TH); return L.benchSeat(SOFA.x + t.x * k, SOFA.z + t.z * k, HEARTH_TH, 1.0); }),
  // two-seat settles either side of the rug
  ...ARMCHAIRS.flatMap((a) => [-0.45, 0.45].map((k) => L.benchSeat(a.x - Math.cos(a.rot) * k, a.z + Math.sin(a.rot) * k, a.rot, 0.95))),
];
function heightAt(x, z) {
  const d = Math.hypot(x - PLAT.x, z - PLAT.z);
  if (d <= PLAT.r) return PLAT.h;
  if (d < PLAT.r + PLAT.ramp) return PLAT.h * (1 - (d - PLAT.r) / PLAT.ramp);
  return 0;
}

// ---------- textures ----------
function stoneFloor() {
  const S = 1024, c = T.canvas(S, S), g = c.getContext('2d'), r = T.rng(41);
  g.fillStyle = '#3a3640'; g.fillRect(0, 0, S, S);
  const cx = S / 2, cy = S / 2;
  for (let ring = 0; ring < 12; ring++) {
    const r0 = ring * 44, r1 = r0 + 44, n = Math.max(6, Math.round((2 * Math.PI * (r0 + 22)) / 70));
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2 + ring * 0.3, a1 = ((k + 1) / n) * Math.PI * 2 + ring * 0.3;
      g.fillStyle = `hsl(${255 + r() * 20}, ${6 + r() * 6}%, ${30 + r() * 10}%)`;
      g.beginPath(); g.arc(cx, cy, r1 - 2, a0 + 0.01, a1 - 0.01); g.arc(cx, cy, Math.max(0, r0 + 2), a1 - 0.01, a0 + 0.01, true); g.closePath(); g.fill();
    }
  }
  return T.tex(c);
}
function ashlarWall(repeatX) {
  const S = 512, c = T.canvas(S, S), g = c.getContext('2d'), r = T.rng(13);
  g.fillStyle = '#4a4552'; g.fillRect(0, 0, S, S);
  for (let y = 0, row = 0; y < S; y += 64, row++) {
    let x = row % 2 ? -60 : 0;
    while (x < S) { const w = 100 + r() * 60; g.fillStyle = `hsl(${258 + r() * 16}, ${7 + r() * 5}%, ${38 + r() * 10}%)`; g.fillRect(x + 3, y + 3, w - 6, 58); x += w; }
  }
  return T.tex(c, { repeat: [repeatX, 1.1] });
}
function runeCircle() {
  const S = 1024, c = T.canvas(S, S), g = c.getContext('2d');
  const cx = S / 2, rr = S / 2 - 10;
  g.strokeStyle = 'rgba(160,120,255,.95)'; g.lineWidth = 8;
  for (const k of [1, 0.86, 0.5]) { g.beginPath(); g.arc(cx, cx, rr * k, 0, 7); g.stroke(); }
  g.lineWidth = 5; g.beginPath();
  for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; const x = cx + Math.cos(a) * rr * 0.84, y = cx + Math.sin(a) * rr * 0.84; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  g.fillStyle = 'rgba(200,170,255,.95)'; g.font = `700 54px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.save(); g.translate(cx + Math.cos(a) * rr * 0.93, cx + Math.sin(a) * rr * 0.93); g.rotate(a + Math.PI / 2); g.fillText(runes[i], 0, 0); g.restore(); }
  return T.tex(c);
}
function skyDisc() {
  const S = 512, c = T.canvas(S, S), g = c.getContext('2d'), t = T.tex(c), r0 = T.rng(3);
  const stars = Array.from({ length: 220 }, () => [r0() * S, r0() * S, r0() * 1.8 + 0.4]);
  const draw = (tod) => {
    const sky = { day: ['#7fb2e6', '#d6e8f4'], evening: ['#3a2a5a', '#f09a5a'], night: ['#070a1c', '#1a1440'] }[tod];
    const gr = g.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    if (tod === 'day') { g.fillStyle = 'rgba(255,255,255,.75)'; for (const [x, y, w] of [[90, 140, 120], [300, 220, 160], [180, 330, 100]]) { g.beginPath(); g.ellipse(x, y, w / 2, w / 5, 0, 0, 7); g.fill(); } }
    if (tod !== 'day') { for (const [x, y, s] of stars) { g.fillStyle = `rgba(255,255,255,${tod === 'night' ? 0.9 : 0.4})`; g.beginPath(); g.arc(x, y * (tod === 'night' ? 1 : 0.6), s, 0, 7); g.fill(); } }
    if (tod === 'night') { g.fillStyle = '#f2ecd0'; g.beginPath(); g.arc(360, 150, 46, 0, 7); g.fill(); g.fillStyle = '#1a1440'; g.beginPath(); g.arc(380, 138, 42, 0, 7); g.fill(); }
    // mullions
    g.strokeStyle = '#2a2530'; g.lineWidth = 14;
    g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2, S); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
    g.lineWidth = 8; g.beginPath(); g.arc(S / 2, S / 2, S * 0.22, 0, 7); g.stroke();
    t.needsUpdate = true;
  };
  draw('day');
  return { texture: t, draw };
}

// ---------- builder ----------
export function buildWizard({ team, leadId, desks }) {
  const root = new THREE.Group();
  const nav = new NavGrid();
  const updaters = [];
  const cutaway = createCutaway();
  const bySlot = Object.fromEntries(team.filter((t) => desks[t.id]).map((t) => [desks[t.id], t]));
  const labels = [[/architect|lead|chief/, 'Archmage'], [/build|engineer|develop/, 'Alchemist'], [/review|qa/, 'Seer'], [/freelanc/, 'Wanderer']];
  const H = 3.4;
  let time = 0;

  // ---------- floor ----------
  const fw = L.FLOOR.maxX - L.FLOOR.minX, fd = L.FLOOR.maxZ - L.FLOOR.minZ;
  const base = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.25, fd), matte('#0b0a10'));
  base.position.y = -0.125; base.receiveShadow = true; root.add(base);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(R + 0.3, 128), new THREE.MeshStandardMaterial({ map: stoneFloor(), roughness: 0.85 }));
  disc.rotation.x = -Math.PI / 2; disc.position.set(O.x, 0.003, O.z); disc.receiveShadow = true; root.add(disc);
  nav.keepInside((x, z) => Math.hypot(x - O.x, z - O.z) < R - 0.2);

  // magic circle in the middle
  const runeMat = new THREE.MeshBasicMaterial({ map: runeCircle(), transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending, color: '#9a7aff' });
  const runes = new THREE.Mesh(new THREE.CircleGeometry(2.1, 96), runeMat);
  runes.rotation.x = -Math.PI / 2; runes.position.set(O.x, 0.012, O.z); root.add(runes);
  const runeLight = new THREE.PointLight('#8a6aff', 2.5, 6, 1.8); runeLight.position.set(O.x, 0.8, O.z); root.add(runeLight);
  updaters.push((dt, t) => { runes.rotation.z += dt * 0.08; runeMat.opacity = 0.75 + Math.sin(t * 1.3) * 0.2; runeLight.intensity = 2.2 + Math.sin(t * 1.3) * 0.6; });
  // floating spell books orbiting above the circle
  const books = [];
  for (let i = 0; i < 6; i++) {
    const g = new THREE.Group(); root.add(g);
    const col = ['#7d2a22', '#2d4a8a', '#2f6b4a', '#5a3a8a', '#8a6443', '#c9a24a'][i];
    const half = (sg) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.3), matte(col)); m.position.x = sg * 0.11; m.rotation.z = sg * 0.35; m.castShadow = true; g.add(m); };
    half(-1); half(1);
    const pages = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.27), matte(COL.parchment)); pages.position.y = 0.03; g.add(pages);
    books.push({ g, a: (i / 6) * Math.PI * 2, r: 1.2 + (i % 2) * 0.35, y: 1.5 + (i % 3) * 0.25 });
  }
  updaters.push((dt, t) => books.forEach((b, i) => {
    const a = b.a + t * 0.25;
    b.g.position.set(O.x + Math.cos(a) * b.r, b.y + Math.sin(t * 1.4 + i) * 0.08, O.z + Math.sin(a) * b.r);
    b.g.rotation.y = -a; b.g.rotation.x = Math.sin(t + i) * 0.15;
  }));

  // labels on the floor in front of each bench
  for (const [slot, d] of Object.entries(DESKS)) {
    if (slot === 'lead') continue;
    const m = bySlot[slot], w = d.w + 0.4, dd = 1.6;
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); g.rotation.y = d.rot - Math.PI; root.add(g);
    floorPlane(g, w, dd, zoneTexture(m?.color || '#9a8ab8', relabel(m, labels, 'Empty Bench'), w, dd, { fill: 0.06, border: 0.35, font: `italic 700 {S}px ${SERIF}`, labelAlpha: 0.75 }), 0, d.d / 2 + dd / 2 - 0.05, 0.008, { transparent: true, depthWrite: false });
  }

  // ---------- round wall (every segment can be cut away) ----------
  const N = 56, chord = 2 * (R + 0.18) * Math.sin(Math.PI / N) + 0.04;
  const wallMat = new THREE.MeshStandardMaterial({ map: ashlarWall(0.5), roughness: 0.95 });
  const decorFor = (th) => { // decor list of the segment nearest an angle
    let best = null, bd = 9;
    for (const s of segs) { const d = Math.abs(angDiff(s.th, th)); if (d < bd) { bd = d; best = s; } }
    return best.decor;
  };
  const segs = [];
  for (let i = 0; i < N; i++) {
    const th = -Math.PI + (i + 0.5) * (2 * Math.PI / N);
    const p = polar(th, R + 0.18);
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = th; root.add(g);
    const winHere = Math.abs(angDiff(th, WINDOW_TH)) < 0.2;
    if (winHere) { B(g, chord, 0.75, 0.36, wallMat, 0, 0, 0); B(g, chord, 0.3, 0.36, wallMat, 0, H - 0.3, 0); }
    else B(g, chord, H, 0.36, wallMat, 0, 0, 0);
    B(g, chord + 0.02, 0.12, 0.44, '#3a3542', 0, H, 0, { cast: false });
    const decor = [];
    cutaway.add(g, Math.sin(th), Math.cos(th), { low: 0.3, decor });
    segs.push({ th, decor });
  }
  // the great round window
  const sky = skyDisc();
  {
    const p = polar(WINDOW_TH, R + 0.2);
    const win = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), new THREE.MeshBasicMaterial({ map: sky.texture }));
    win.position.set(p.x, 2.05, p.z); win.rotation.y = WINDOW_TH + Math.PI; root.add(win);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.08, 10, 64), matte('#3a3542'));
    const pr = polar(WINDOW_TH, R - 0.02); ring.position.set(pr.x, 2.05, pr.z); ring.rotation.y = WINDOW_TH + Math.PI; root.add(ring);
    decorFor(WINDOW_TH).push(win, ring);
  }

  // ---------- archmage's platform ----------
  {
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(PLAT.r, PLAT.r + PLAT.ramp, PLAT.h, 64), matte('#3e3946'));
    plat.position.set(PLAT.x, PLAT.h / 2, PLAT.z); plat.receiveShadow = true; plat.castShadow = true; root.add(plat);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(PLAT.r - 0.12, 64), matte(COL.velvet));
    rug.rotation.x = -Math.PI / 2; rug.position.set(PLAT.x, PLAT.h + 0.004, PLAT.z); root.add(rug);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(PLAT.r - 0.2, 0.02, 6, 64), matte(COL.gold)); edge.rotation.x = Math.PI / 2; edge.position.set(PLAT.x, PLAT.h + 0.01, PLAT.z); root.add(edge);
    // telescope on a tripod, aimed at the window
    const tx = PLAT.x - 1.2, tz = PLAT.z - 1.35, y0 = PLAT.h;
    for (let i = 0; i < 3; i++) { const leg = B(root, 0.035, 1.15, 0.035, COL.woodDark, tx + Math.cos(i * 2.1) * 0.22, y0, tz + Math.sin(i * 2.1) * 0.22); leg.rotation.set(Math.sin(i * 2.1) * 0.18, 0, -Math.cos(i * 2.1) * 0.18); }
    const tube = C(root, 0.07, 0.1, 1.1, COL.brass, tx, y0 + 1.05, tz - 0.25, 16); tube.rotation.x = -1.0;
    nav.blockCircle(tx, tz, 0.35, 0.2);
    // owl on a perch
    const ox = PLAT.x + 1.4, oz = PLAT.z - 1.0;
    C(root, 0.025, 0.025, 1.5, COL.woodDark, ox, y0, oz, 8); C(root, 0.15, 0.18, 0.04, COL.woodDark, ox, y0, oz, 12);
    const bar = C(root, 0.02, 0.02, 0.5, COL.woodDark, ox, y0 + 1.5, oz, 8); bar.rotation.z = Math.PI / 2;
    const owl = new THREE.Group(); owl.position.set(ox, y0 + 1.52, oz); root.add(owl);
    const feather = matte('#8a6a4a');
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), feather); body.scale.set(1, 1.25, 0.9); body.position.y = 0.15; body.castShadow = true; owl.add(body);
    const head = new THREE.Group(); head.position.y = 0.34; owl.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), feather));
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), matte('#d8c8a8')); face.position.z = 0.085; head.add(face);
    const eyes = [];
    for (const sx of [-0.035, 0.035]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), glow('#ffb020')); e.position.set(sx, 0.01, 0.095); head.add(e); eyes.push(e); }
    for (const sx of [-1, 1]) { const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 6), feather); tuft.position.set(sx * 0.06, 0.1, 0); tuft.rotation.z = -sx * 0.4; head.add(tuft); }
    let blinkT = 2, lookT = 3, look = 0;
    updaters.push((dt, t) => {
      blinkT -= dt; if (blinkT < 0) { eyes.forEach((e) => { e.scale.y = 0.1; }); if (blinkT < -0.12) { eyes.forEach((e) => { e.scale.y = 1; }); blinkT = 2 + Math.random() * 4; } }
      lookT -= dt; if (lookT < 0) { look = (Math.random() - 0.5) * 2.4; lookT = 2 + Math.random() * 4; }
      head.rotation.y += (look - head.rotation.y) * Math.min(1, dt * 4);
    });
    nav.blockCircle(ox, oz, 0.2, 0.2);
    owl.rotation.y = Math.PI * 0.85;
  }

  // ---------- desks: archmage's desk + alchemy benches ----------
  const monitors = {};
  const brewLights = [];
  const bubbles = [];
  for (const [slot, d] of Object.entries(DESKS)) {
    const lead = slot === 'lead', who = bySlot[slot], y0 = heightAt(d.x, d.z);
    const g = new THREE.Group(); g.position.set(d.x, y0, d.z); g.rotation.y = d.rot - Math.PI; root.add(g);
    const accent = who?.color || '#8a7ab8';
    B(g, d.w, 0.08, d.d, lead ? COL.woodDark : COL.wood, 0, 0.72, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.09, 0.72, 0.09, COL.woodDark, sx * (d.w / 2 - 0.1), 0, sz * (d.d / 2 - 0.1));
    B(g, d.w - 0.2, 0.05, d.d - 0.2, COL.woodDark, 0, 0.2, 0);
    // flasks: liquid glows and bubbles while working
    const liquidOn = [], liquidOff = new THREE.MeshStandardMaterial({ color: '#2a2a3a', roughness: 0.3 });
    const flaskGlass = new THREE.MeshStandardMaterial({ color: '#cfe8f0', transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false });
    const cols = [accent, '#5af0a0', '#c05aff'];
    const flasks = lead ? [[-0.6, -0.15], [0.55, -0.2]] : [[-0.55, -0.12], [-0.2, -0.18], [0.15, -0.12]];
    flasks.forEach(([fx, fz], i) => {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), flaskGlass); bulb.position.set(fx, 0.88, fz); g.add(bulb);
      const neck = C(g, 0.03, 0.03, 0.18, flaskGlass, fx, 0.95, fz, 10); void neck;
      const liq = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10, 0, Math.PI * 2, Math.PI / 2.4, Math.PI), liquidOff); liq.position.set(fx, 0.88, fz); g.add(liq);
      liquidOn.push([liq, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], toneMapped: false })]);
      for (let k = 0; k < 3; k++) { const bb = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 5), glow('#ffffff', { transparent: true, opacity: 0.8 })); bb.visible = false; g.add(bb); bubbles.push({ m: bb, x: fx, z: fz, ph: Math.random(), on: false, owner: slot }); }
    });
    // book stack, candle, (crystal ball on the archmage's desk)
    for (let i = 0; i < 3; i++) B(g, 0.32, 0.07, 0.24, ['#7d2a22', '#2d4a8a', '#5a3a8a'][i], d.w / 2 - 0.3, 0.76 + i * 0.07, 0.15, { cast: false });
    C(g, 0.04, 0.05, 0.03, COL.brass, -d.w / 2 + 0.2, 0.76, 0.2, 10); C(g, 0.025, 0.025, 0.14, '#efe6cf', -d.w / 2 + 0.2, 0.79, 0.2, 8);
    g.updateMatrixWorld();
    const cpos = new THREE.Vector3(-d.w / 2 + 0.2, 0.93, 0.2).applyMatrix4(g.matrixWorld);
    const fl = flame(root, updaters, cpos.x, cpos.y, cpos.z, 0.9); fl.set(false);
    const lpos = new THREE.Vector3(0, 1.2, -0.1).applyMatrix4(g.matrixWorld);
    const brew = new THREE.PointLight(accent, 0, 3.0, 2); brew.position.copy(lpos); root.add(brew); brewLights.push(brew);
    if (lead) {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), new THREE.MeshStandardMaterial({ color: '#b8a8ff', transparent: true, opacity: 0.55, roughness: 0.05, emissive: '#3a2a8a' }));
      orb.position.set(0.05, 0.92, 0.0); g.add(orb);
      C(g, 0.1, 0.12, 0.06, COL.gold, 0.05, 0.76, 0.0, 16);
      updaters.push((dt, t) => { orb.material.emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.4; });
    }
    monitors[slot] = (on) => {
      liquidOn.forEach(([m, mat]) => { m.material = on ? mat : liquidOff; });
      bubbles.forEach((b) => { if (b.owner === slot) b.on = on; });
      fl.set(on); brew.userData.on = on;
    };
    // chair: high-backed throne for the archmage, stools for the others
    const seat = L.deskSeat(slot, DESKS);
    const cg = new THREE.Group(); cg.position.set(seat.x, y0, seat.z); cg.rotation.y = d.rot - Math.PI; root.add(cg);
    if (lead) {
      B(cg, 0.6, 0.45, 0.55, COL.woodDark, 0, 0, 0); B(cg, 0.56, 0.08, 0.5, COL.velvet, 0, 0.45, 0);
      B(cg, 0.62, 1.4, 0.12, COL.woodDark, 0, 0.45, 0.25); B(cg, 0.48, 1.1, 0.04, COL.velvet, 0, 0.6, 0.18);
      const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), matte(COL.gold)); finial.position.set(0, 1.95, 0.25); cg.add(finial);
    } else {
      C(cg, 0.22, 0.24, 0.06, COL.wood, 0, 0.42, 0, 16);
      for (let i = 0; i < 3; i++) B(cg, 0.04, 0.42, 0.04, COL.woodDark, Math.cos(i * 2.1) * 0.15, 0, Math.sin(i * 2.1) * 0.15);
    }
    nav.blockOBB(d.x, d.z, d.w, d.d, d.rot, 0.28);
    nav.blockCircle(seat.x, seat.z, 0.28, 0.15);
  }
  updaters.push((dt, t) => {
    brewLights.forEach((l, i) => { l.intensity = l.userData.on ? 1.4 + Math.sin(t * 5 + i) * 0.3 : 0; });
    bubbles.forEach((b) => {
      b.m.visible = b.on;
      if (!b.on) return;
      const k = (t * 0.7 + b.ph) % 1;
      b.m.position.set(b.x + Math.sin(k * 20 + b.ph * 9) * 0.02, 0.92 + k * 0.32, b.z);
      b.m.material.opacity = 0.9 * (1 - k);
    });
  });

  // ---------- bookshelves along the far wall, cauldron, potion shelf ----------
  const shelfAt = (th, w = 1.7, h = 2.6) => {
    const p = polar(th, R - 0.3);
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = th + Math.PI; root.add(g);
    B(g, w, h, 0.4, COL.woodDark, 0, 0, 0);
    const bk = ['#7d2a22', '#2d4a8a', '#2f6b4a', '#5a3a8a', '#c9a24a', '#8a6443', '#3a3a5a'];
    for (let sh = 0; sh < Math.floor((h - 0.2) / 0.45); sh++) {
      B(g, w - 0.1, 0.03, 0.34, COL.wood, 0, 0.12 + sh * 0.45, 0.04, { cast: false });
      let bx = -w / 2 + 0.08, k = sh * 7 + Math.round(th * 10);
      while (bx < w / 2 - 0.12) { const bw = 0.05 + (Math.abs(k * 37) % 5) * 0.014, bh = 0.26 + (Math.abs(k * 13) % 5) * 0.025; B(g, bw, bh, 0.24, bk[Math.abs(k) % bk.length], bx + bw / 2, 0.15 + sh * 0.45, 0.06, { cast: false }); bx += bw + 0.012; k++; if (k % 8 === 0) bx += 0.12; }
    }
    nav.blockOBB(p.x, p.z, w, 0.4, th + Math.PI, 0.28);
    return g;
  };
  for (const th of [-2.7, 2.7, -2.1, 2.1]) shelfAt(th);
  {
    // bubbling cauldron near the alchemists
    const p = polar(-2.1, 4.4);
    C(root, 0.5, 0.42, 0.55, '#1f1d22', p.x, 0.12, p.z, 24);
    for (let i = 0; i < 3; i++) B(root, 0.06, 0.18, 0.06, '#1f1d22', p.x + Math.cos(i * 2.1) * 0.35, 0, p.z + Math.sin(i * 2.1) * 0.35);
    const brew = new THREE.Mesh(new THREE.CircleGeometry(0.44, 24), glow('#4af08a')); brew.rotation.x = -Math.PI / 2; brew.position.set(p.x, 0.62, p.z); root.add(brew);
    const cl = new THREE.PointLight('#4af08a', 1.6, 4, 2); cl.position.set(p.x, 1.0, p.z); root.add(cl);
    const puffs = Array.from({ length: 6 }, (_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glow('#9affc0', { transparent: true, opacity: 0.6 })); root.add(m); return { m, ph: i / 6 }; });
    updaters.push((dt, t) => puffs.forEach((pf) => { const k = (t * 0.35 + pf.ph) % 1; pf.m.position.set(p.x + Math.sin(k * 9 + pf.ph * 6) * 0.15, 0.65 + k * 1.2, p.z + Math.cos(k * 7 + pf.ph * 4) * 0.15); pf.m.scale.setScalar(0.6 + k * 1.5); pf.m.material.opacity = 0.55 * (1 - k); }));
    for (let i = 0; i < 4; i++) flame(root, updaters, p.x + Math.cos(i * 1.6) * 0.18, 0.02, p.z + Math.sin(i * 1.6) * 0.18, 1.8, '#ff8a3c');
    nav.blockCircle(p.x, p.z, 0.55, 0.25);
  }

  // ---------- fireplace corner ----------
  let fire;
  {
    const g = new THREE.Group(); g.position.set(HEARTH.x, 0, HEARTH.z); g.rotation.y = HEARTH_TH + Math.PI; root.add(g);
    B(g, 2.2, 1.35, 0.8, '#5a5462', 0, 0, 0);
    B(g, 1.4, 0.95, 0.5, '#151318', 0, 0.12, 0.2);
    B(g, 2.4, 0.16, 0.95, '#6a6470', 0, 1.35, 0);
    B(g, 1.2, H - 1.51, 0.6, '#5a5462', 0, 1.51, -0.1);
    for (let i = 0; i < 6; i++) flame(g, updaters, -0.35 + (i % 3) * 0.35, 0.18, 0.28 + Math.floor(i / 3) * 0.1, 2.6 + (i % 2), i % 2 ? '#ff8a3c' : '#ffb347');
    g.updateMatrixWorld();
    const fp = new THREE.Vector3(0, 0.9, 1.1).applyMatrix4(g.matrixWorld);
    fire = new THREE.PointLight('#ff9a4a', 4, 8, 1.8); fire.position.copy(fp); fire.userData.base = 4; root.add(fire);
    updaters.push((dt, tt) => { fire.intensity = fire.userData.base * (0.85 + Math.sin(tt * 9) * 0.08 + Math.sin(tt * 17) * 0.07); });
    nav.blockOBB(HEARTH.x, HEARTH.z, 2.4, 1.0, HEARTH_TH + Math.PI, 0.25);
    // rug, sofa and armchairs facing the fire
    const rc = T.canvas(512, 512), rg = rc.getContext('2d');
    rg.fillStyle = '#5a1f2a'; rg.beginPath(); rg.ellipse(256, 256, 250, 250, 0, 0, 7); rg.fill();
    rg.strokeStyle = COL.gold; rg.lineWidth = 10; rg.beginPath(); rg.ellipse(256, 256, 220, 220, 0, 0, 7); rg.stroke();
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.0, 48), new THREE.MeshStandardMaterial({ map: T.tex(rc), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(RUG.x, 0.008, RUG.z); root.add(rug);
    const seatBlock = (x, z, rot, w, d, backH) => {
      const sg = new THREE.Group(); sg.position.set(x, 0, z); sg.rotation.y = rot; root.add(sg);
      B(sg, w, 0.42, d, COL.velvet, 0, 0, 0);
      B(sg, w, backH, 0.22, COL.velvetDark, 0, 0, -d / 2 + 0.11);
      for (const sx of [-1, 1]) B(sg, 0.2, 0.62, d, COL.velvetDark, sx * (w / 2 - 0.1), 0, 0);
      nav.blockOBB(x, z, w, d, rot, 0.22);
    };
    seatBlock(SOFA.x, SOFA.z, SOFA.rot, 3.4, 0.95, 0.95);
    for (const a of ARMCHAIRS) seatBlock(a.x, a.z, a.rot, 1.95, 0.95, 1.15);
    floorPlane(root, 3.0, 0.8, T.floorLabel('Hearth', '#c9a24a', 3.0, 0.8), RUG.x + tng(HEARTH_TH).x * 0, RUG.z, 0.012, { transparent: true });
  }

  // ---------- scrying mirror (usage) on the far wall ----------
  const usageBoard = new T.UsageBoard({ bg: '#1a1230', frame: '#8a6a2a', title: 'SCRYING MIRROR · WEEKLY USAGE', accent: '#b88aff', big: '#efe6ff', text: '#d8ccf0', muted: '#a898c8', faint: '#7a6a98', track: '#2e2448', font: SERIF });
  {
    const th = -2.47, p = polar(th, R - 0.08);
    const uw = 2.2, uh = 1.06;
    const fr = new THREE.Mesh(new THREE.BoxGeometry(uw + 0.22, uh + 0.22, 0.06), matte(COL.gold, { metalness: 0.5, roughness: 0.35 }));
    fr.position.set(p.x, 2.35, p.z); fr.rotation.y = th + Math.PI; root.add(fr);
    const pm = polar(th, R - 0.12);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(uw, uh), new THREE.MeshBasicMaterial({ map: usageBoard.texture, toneMapped: false, color: '#e0d8f0' }));
    m.position.set(pm.x, 2.35, pm.z); m.rotation.y = th + Math.PI; root.add(m);
    decorFor(th).push(fr, m);
  }

  // ---------- floating candles ----------
  const candles = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, r = 3.2 + (i % 3) * 1.2, x = O.x + Math.sin(a) * r, z = O.z + Math.cos(a) * r, y = 2.7 + (i % 4) * 0.15;
    const c = C(root, 0.03, 0.03, 0.2, '#efe6cf', x, y, z, 8);
    const f = flame(root, updaters, x, y + 0.2, z, 0.9);
    candles.push({ c, f, x, y, z, ph: i });
  }
  updaters.push((dt, t) => candles.forEach((cd) => {
    const dy = Math.sin(t * 0.8 + cd.ph) * 0.06;
    cd.c.position.y = cd.y + 0.1 + dy; cd.f.mesh.position.y = cd.y + 0.2 + 0.055 * 0.9 + dy; cd.f.core.position.y = cd.y + 0.2 + 0.03 * 0.9 + dy;
  }));

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight('#c8b8f0', '#1a1420', 1.1);
  const key = keyLight('#f0e6ff', 1.2);
  const winLight = new THREE.SpotLight('#cfe0ff', 30, 20, 0.5, 0.6, 1.2);
  { const p = polar(WINDOW_TH, R + 2); winLight.position.set(p.x, 3.6, p.z); winLight.target.position.set(O.x, 0, O.z - 2); }
  const warm = [[O.x - 3, O.z], [O.x + 3, O.z], [O.x, O.z + 3.5], [O.x, O.z - 4]].map(([x, z]) => { const l = new THREE.PointLight('#ffc890', 0.8, 7, 1.8); l.position.set(x, 2.9, z); return l; });
  root.add(hemi, key, key.target, winLight, winLight.target, ...warm);
  const TOD = {
    day:     { hemi: 1.3, key: ['#fff4e6', 1.4], win: ['#dfeaff', 40], warm: 0.5, fire: 2.5 },
    evening: { hemi: 0.9, key: ['#ffb07a', 1.0], win: ['#ff9a6a', 30], warm: 1.3, fire: 4 },
    night:   { hemi: 0.55, key: ['#8a8aff', 0.4], win: ['#9aa8ff', 12], warm: 2.2, fire: 5.5 },
  };
  function setTimeOfDay(tod) {
    const p = TOD[tod];
    hemi.intensity = p.hemi; key.color.set(p.key[0]); key.intensity = p.key[1];
    winLight.color.set(p.win[0]); winLight.intensity = p.win[1];
    warm.forEach((l) => { l.intensity = p.warm; });
    fire.userData.base = p.fire;
    sky.draw(tod);
  }
  setTimeOfDay('day');

  updaters.unshift((dt) => { time += dt; });

  return {
    root, nav, monitors, setTimeOfDay, heightAt, cutaway,
    layout: { desks: DESKS, loungeSeats: LOUNGE_SEATS },
    background: '#0b0910',
    bloom: { strength: 0.26, radius: 0.4, threshold: 0.8 },
    todLabels: { day: 'Dawn', evening: 'Dusk', night: 'Starlight' },
    dressBot,
    setUsage: (u) => usageBoard.draw(u),
    update: (dt) => updaters.forEach((f) => f(dt, time)),
  };
}

// pointed hat + robe collar; the archmage's hat is taller with a gold band and star
function dressBot(bot, member, isLead) {
  const add = (mat, geo, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.userData.botId = member.id; bot.body.add(m); return m; };
  const hat = new THREE.MeshLambertMaterial({ color: T.mix(member.color, '#1a1430', 0.45) });
  add(hat, new THREE.CylinderGeometry(0.3, 0.3, 0.025, 20), 0, 1.205, 0);                  // brim
  const cone = add(hat, new THREE.ConeGeometry(0.17, isLead ? 0.62 : 0.46, 18), 0, 1.22 + (isLead ? 0.31 : 0.23), 0);
  cone.rotation.z = isLead ? 0.12 : 0.18;
  if (isLead) {
    add(new THREE.MeshLambertMaterial({ color: COL.gold, emissive: '#3a2a08' }), new THREE.CylinderGeometry(0.172, 0.172, 0.05, 18), 0, 1.24, 0);
    add(new THREE.MeshBasicMaterial({ color: '#ffe08a' }), new THREE.OctahedronGeometry(0.04), 0.05, 1.42, 0.12);
  }
  add(new THREE.MeshLambertMaterial({ color: T.mix(member.color, '#1a1430', 0.55) }), new THREE.BoxGeometry(0.47, 0.1, 0.28), 0, 0.84, -0.01); // robe collar
  add(new THREE.MeshLambertMaterial({ color: COL.gold }), new THREE.BoxGeometry(0.44, 0.04, 0.27), 0, 0.5, 0);                           // sash
  bot.paper.geometry = new THREE.CylinderGeometry(0.045, 0.045, 0.3, 12).rotateZ(Math.PI / 2);
  bot.paper.material = new THREE.MeshBasicMaterial({ color: '#ffe8a8', toneMapped: false });
  bot.paper.scale.set(1, 1, 1);
}
