// HD scene: a monastery scriptorium at golden hour. Stone walls, three tall arched windows,
// candlelit writing desks, the lead at a great lectern, a refectory table for the lounge.
import * as THREE from 'three';
import { makeKit } from './kit.js';

export default {
  id: 'scriptorium',
  label: 'Scriptorium',
  modes: [['walk', 'Walk'], ['instant', 'Instant']],
  defaultMode: 'walk',
  build,
};

function build({ scene, renderer, slotColors = [] }) {
  const K = makeKit(scene, renderer);
  const { mesh, box, std, glow, group } = K;

  // ---------- room ----------
  const RW = 8.4, RD = 6.6, WH = 3.5, WT = 0.3, BASE = 0.4;
  const x0 = -RW / 2, z0 = -RD / 2, zw = z0 + WT;            // zw: inside face of the north wall
  const stone = std('#ffffff', 0.95, { map: K.stoneTex(40, [4, 2]) });
  const floorMat = std('#ffffff', 0.85, { map: K.flagsTex(30, [4, 3]) });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(RW, BASE, RD), [stone, stone, floorMat, stone, stone, stone]);
  slab.position.y = -BASE / 2; slab.receiveShadow = true; scene.add(slab);
  // west wall (solid) and north wall built round three window openings
  mesh(new THREE.BoxGeometry(WT, WH, RD), stone, x0 + WT / 2, WH / 2, 0);
  const WINS = [-1.8, 0, 1.8], WW = 0.9, SILL = 1.25, WTOP = 2.75;
  const wallSeg = (xa, xb, ya, yb) => mesh(new THREE.BoxGeometry(xb - xa, yb - ya, WT), stone, (xa + xb) / 2, (ya + yb) / 2, z0 + WT / 2);
  let xPrev = x0;
  for (const wx of WINS) { wallSeg(xPrev, wx - WW / 2, 0, WH); wallSeg(wx - WW / 2, wx + WW / 2, 0, SILL); wallSeg(wx - WW / 2, wx + WW / 2, WTOP + 0.35, WH); xPrev = wx + WW / 2; }
  wallSeg(xPrev, -x0, 0, WH);
  const dressed = std('#6a5c4c', 0.9);
  const sky = (() => {
    const c = K.cv(256, 512), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#3a2a4a'); gr.addColorStop(0.55, '#e0884a'); gr.addColorStop(1, '#ffd08a');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 512); return K.texOf(c);
  })();
  for (const wx of WINS) {
    // pointed arch: two leaning stones closing the top of the opening
    for (const s of [-1, 1]) { const a = mesh(new THREE.BoxGeometry(WW * 0.62, 0.12, WT * 0.9), dressed, wx + s * WW * 0.24, WTOP + 0.16, z0 + WT / 2); a.rotation.z = -s * 0.62; }
    mesh(new THREE.BoxGeometry(WW + 0.16, 0.08, WT + 0.16), dressed, wx, SILL, z0 + WT / 2);
    // leaded glass (lets the sun through; the lead strips cast the pattern) and the evening sky behind
    const lead = std('#1a1612', 0.6);
    mesh(new THREE.BoxGeometry(0.03, WTOP - SILL + 0.25, 0.03), lead, wx, (SILL + WTOP + 0.25) / 2, z0 + WT / 2);
    for (let y = SILL + 0.3; y < WTOP + 0.2; y += 0.32) mesh(new THREE.BoxGeometry(WW, 0.025, 0.025), lead, wx, y, z0 + WT / 2);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(WW + 0.4, WTOP - SILL + 0.8), new THREE.MeshBasicMaterial({ map: sky, toneMapped: false, color: new THREE.Color(1.25, 1.2, 1.15) }));
    back.position.set(wx, (SILL + WTOP + 0.35) / 2, z0 - 0.15); scene.add(back);
  }
  // timber beams resting on the walls
  const timber = std('#ffffff', 0.8, { map: K.woodTex(24, 35, 16) });
  for (const bx of [-2.7, -0.9, 0.9, 2.7]) mesh(new THREE.BoxGeometry(0.18, 0.22, 0.6), timber, bx, WH - 0.2, zw + 0.28);
  mesh(new THREE.BoxGeometry(0.6, 0.22, 0.18), timber, x0 + WT + 0.28, WH - 0.2, 0.8);

  // ---------- furniture ----------
  const oak = std('#ffffff', 0.7, { map: K.woodTex(30, 40, 26) });
  const darkOak = std('#ffffff', 0.75, { map: K.woodTex(24, 35, 15) });
  const iron = K.metal('#1c1a18', 0.55);
  const parchment = (seed, gold) => {
    const c = K.cv(256, 360), g = c.getContext('2d'), r = K.rng(seed);
    g.fillStyle = '#e8dcbc'; g.fillRect(0, 0, 256, 360);
    g.fillStyle = 'rgba(60,40,20,.55)';
    for (let y = 70; y < 340; y += 14) { let x = 24; while (x < 232) { const w = 8 + r() * 30; g.fillRect(x, y, Math.min(w, 232 - x), 3); x += w + 6; } }
    g.fillStyle = gold; g.fillRect(24, 20, 44, 44); g.fillStyle = '#7a1f1f'; g.fillRect(30, 26, 32, 32);
    for (let k = 0; k < 4; k++) { g.strokeStyle = gold; g.lineWidth = 3; g.strokeRect(16 + k, 12 + k, 224 - k * 2, 336 - k * 2); }
    return K.texOf(c);
  };
  const STATIONS = [], CANDLES = [], PAGES = [], RINGS = [];
  // the flame of a candle; its light is on only while the desk is in use
  function candle(parent, x, y, z) {
    mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.14, 14), std('#efe3c4', 0.6), x, y + 0.07, z, parent);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), glow('#ffb050', 3.4)); f.scale.set(1, 2.4, 1); f.position.set(x, y + 0.17, z); parent.add(f);
    const L = new THREE.PointLight('#ffa040', 0, 2.6, 2); L.position.set(x, y + 0.22, z); parent.add(L);
    return { f, L };
  }
  // a slanted writing desk (carrel) with a stool; the scribe faces `face`
  function carrel(i, x, z, face) {
    const g = group(x, z, face);
    box(0.95, 0.04, 0.6, oak, 0, 0.72, 0.42, 0.01, g);                               // flat shelf
    // the writing slope rises away from the scribe, so the page faces them
    const slope = mesh(new THREE.BoxGeometry(0.85, 0.035, 0.5), oak, 0, 0.88, 0.3, g); slope.rotation.x = -0.42;
    for (const sx of [-0.42, 0.42]) box(0.05, 0.9, 0.55, darkOak, sx, 0, 0.42, 0.01, g);
    box(0.9, 0.5, 0.03, darkOak, 0, 0.9, 0.7, 0.01, g);                              // back board
    const mat = new THREE.MeshStandardMaterial({ map: parchment(7 + i, '#c9a032'), roughness: 0.9, emissive: '#ffcf70', emissiveMap: null, emissiveIntensity: 0 });
    const page = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.44), mat); page.position.set(0, 0.91, 0.29); page.rotation.x = -Math.PI / 2 - 0.42; g.add(page);
    mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.05, 12), std('#1a1a1a', 0.4), 0.36, 0.74, 0.55, g);  // inkwell
    const q = mesh(new THREE.CylinderGeometry(0.004, 0.002, 0.24, 6), std('#e8e2d0', 0.8), 0.34, 0.86, 0.55, g); q.rotation.z = 0.5;
    const c = candle(g, -0.36, 0.74, 0.55);
    // stool
    const st = group(x, z, face);
    mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 20), darkOak, 0, 0.44, -0.02, st);
    for (let k = 0; k < 3; k++) { const a = k * 2.09; const l = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.42, 8), darkOak, Math.sin(a) * 0.12, 0.21, Math.cos(a) * 0.12 - 0.02, st); l.rotation.set(Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12); }
    STATIONS[i] = { x, z, face, pose: (ag) => ag.sit(0.46, true) };
    CANDLES[i] = c; PAGES[i] = mat; RINGS[i] = K.stationRing(x, z, slotColors[i] ?? '#ffcf70');
  }
  // place 1: the great lectern in the middle of the room, read standing
  {
    const x = -0.5, z = -0.5, face = Math.PI;      // faces the windows
    const g = group(x, z, face);
    box(0.5, 0.06, 0.5, darkOak, 0, 0, 0.55, 0.01, g);
    mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.0, 12), darkOak, 0, 0.5, 0.55, g);
    const top = mesh(new THREE.BoxGeometry(0.8, 0.05, 0.6), oak, 0, 1.12, 0.52, g); top.rotation.x = -0.5;
    const mat = new THREE.MeshStandardMaterial({ map: parchment(3, '#d9b040'), roughness: 0.9, emissive: '#ffcf70', emissiveIntensity: 0 });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.46), mat); p.position.set(s * 0.18, 1.155, 0.5); p.rotation.set(-Math.PI / 2 - 0.5, 0, s * 0.05); g.add(p); }
    // a pair of tall iron candlesticks either side
    const cs = [];
    for (const s of [-1, 1]) {
      const cg = group(x + s * 0.7, z - 0.55);
      mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.04, 16), iron, 0, 0.02, 0, cg);
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.25, 8), iron, 0, 0.64, 0, cg);
      cs.push(candle(cg, 0, 1.27, 0));
    }
    STATIONS[0] = { x, z, face, pose: (ag) => { ag.stand(); for (const j of ag.rig.sh) j.rotation.x = -0.75; for (const j of ag.rig.el) j.rotation.x = -0.5; ag.rig.head.rotation.x = 0.3; } };
    CANDLES[0] = { group: cs }; PAGES[0] = mat; RINGS[0] = K.stationRing(x, z, slotColors[0] ?? '#ffcf70');
  }
  // places 2-5 along the north wall (between the windows' light), 6-8 along the west wall
  [-2.7, -0.9, 0.9, 2.7].forEach((x, k) => carrel(1 + k, x, zw + 0.98, Math.PI));
  [-1.2, 0.5, 2.2].forEach((z, k) => carrel(5 + k, x0 + WT + 0.98, z, -Math.PI / 2));

  // ---------- refectory table: the lounge ----------
  const SEATS = [];
  {
    const TX = 1.9, TZ = 1.75;
    box(2.7, 0.07, 0.9, oak, TX, 0.72, TZ, 0.01);
    for (const sx of [-1.15, 1.15]) { box(0.1, 0.72, 0.7, darkOak, TX + sx, 0, TZ, 0.01); }
    box(2.3, 0.08, 0.1, darkOak, TX, 0.2, TZ, 0.01);
    // bread, a jug and cups
    mesh(new THREE.SphereGeometry(0.1, 16, 10), std('#b07a3a', 0.9), TX - 0.6, 0.83, TZ).scale.set(1.3, 0.6, 1);
    mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.22, 16), std('#7a4a2a', 0.5), TX + 0.2, 0.86, TZ - 0.1);
    for (const dx of [-0.2, 0.55, 0.9]) mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.08, 12), std('#8a6a4a', 0.5), TX + dx, 0.79, TZ + 0.2);
    const n = K.bench(TX, TZ - 0.72, 0, 4, darkOak).map((s) => ({ ...s, exit: [s.x, 0.3] }));
    const sth = K.bench(TX, TZ + 0.72, Math.PI, 4, darkOak).map((s) => ({ ...s, exit: [s.x, 3.1] }));
    SEATS.push(...n, ...sth);
  }
  // a brazier by the table
  const fires = [];
  {
    const bx = 0.15, bz = 1.8;
    mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.22, 20, 1, true), std('#1c1a18', 0.5, { metalness: 0.7, side: THREE.DoubleSide }), bx, 0.62, bz);
    for (let k = 0; k < 3; k++) { const a = k * 2.09; const l = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 8), iron, bx + Math.sin(a) * 0.2, 0.27, bz + Math.cos(a) * 0.2); l.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25); }
    mesh(new THREE.CircleGeometry(0.27, 24), glow('#ff5a1a', 1.6), bx, 0.68, bz).rotation.x = -Math.PI / 2;
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 12), glow('#ffa040', 2.2, { transparent: true, opacity: 0.85 })); fl.position.set(bx, 0.85, bz); scene.add(fl);
    const L = new THREE.PointLight('#ff8a3a', 2.4, 6, 1.8); L.position.set(bx, 1.05, bz); L.castShadow = true; L.shadow.mapSize.set(512, 512); L.shadow.radius = 4; L.shadow.bias = -0.004; scene.add(L);
    fires.push({ L, fl, base: 2.4 });
  }
  // shelves of codices on the west wall's far end, a cross-free niche with a pot of herbs
  {
    const g = group(x0 + WT + 0.2, -2.55, Math.PI / 2);
    box(1.1, 2.0, 0.35, darkOak, 0, 0, 0, 0.01, g);
    const r = K.rng(4), cols = ['#5a1e1e', '#3a2a1a', '#6b4a22', '#1f3a2a', '#2a2f55'];
    for (let k = 0; k < 4; k++) { let x = -0.48; while (x < 0.45) { const w = 0.05 + r() * 0.06, h = 0.24 + r() * 0.16; box(w, h, 0.26, std(cols[(r() * 5) | 0], 0.8), x + w / 2, 0.1 + k * 0.47, 0.05, 0.004, g); x += w + 0.01; } }
    K.plant(x0 + WT + 0.3, 0, 3.0, 1.2, '#8a6a4a');
  }

  // ---------- light ----------
  scene.add(new THREE.HemisphereLight('#c9b8a0', '#1a120c', 0.18));
  // low evening sun through the windows: long warm shafts across the floor
  const sun = new THREE.SpotLight('#ffb36a', 180, 26, 0.42, 0.35, 1.4);
  sun.position.set(-3.5, 6.2, z0 - 6.5); sun.target.position.set(0.8, 0, 1.2);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 2; sun.shadow.bias = -0.0004; sun.shadow.camera.near = 2;
  scene.add(sun, sun.target);
  const motes = WINS.map((wx) => {
    const top = new THREE.Vector3(wx, (SILL + WTOP) / 2, z0 + WT);
    const dir = new THREE.Vector3().subVectors(top, sun.position).normalize();
    const hit = top.clone().addScaledVector(dir, top.y / -dir.y);
    return K.dust(top, hit, 70, '#ffd8a0', 0.7);
  });

  // ---------- places + walkways ----------
  const slots = STATIONS.map((st, i) => ({ station: st, lounge: { ...SEATS[i], pose: (ag) => ag.sit(SEATS[i].seat ?? 0.46, false) } }));
  const walkway = [
    [[-2.5, 3.1], [-2.5, 0.3], [-2.5, -1.6], [3.6, -1.6], [3.6, 0.3], [3.6, 3.1]],
    [[-2.5, 0.3], [3.6, 0.3]],
    [[-2.5, 3.1], [3.6, 3.1]],
  ];
  function setStation(i, state) {
    const on = state !== 'off', c = CANDLES[i];
    for (const cc of c?.group ?? [c]) { if (!cc) continue; cc.f.visible = on; cc.L.intensity = on ? 1.1 : 0; }
    if (PAGES[i]) { PAGES[i].emissiveMap = PAGES[i].map; PAGES[i].emissiveIntensity = on ? 0.35 : 0; }
    RINGS[i]?.set(state === 'waiting' || state === 'error' ? state : 'off');
  }
  for (let i = 0; i < 8; i++) setStation(i, 'off');

  return {
    background: '#000000', exposure: 1.05, envIntensity: 0.06,
    bloom: { strength: 0.55, radius: 0.5, threshold: 1.0 },
    camera: { fov: 30, position: [13.0, 9.6, 14.4], target: [-0.2, 0.6, -0.2], aspect: 1.5, minPolar: 0.45, maxPolar: 1.3, minAz: -0.25, maxAz: 1.85, minDist: 8, maxDist: 30 },
    slots, walkway, setStation,
    update(dt, t, lite) {
      for (const f of fires) { const n = K.noise(t * 3); f.L.intensity = f.base * (0.85 + 0.15 * n); f.fl.scale.set(1, 1 + 0.15 * n, 1); }
      for (const c of CANDLES.flatMap((c) => c?.group ?? [c])) if (c?.f.visible) { const n = K.noise(t * 2.4 + c.L.id); c.L.intensity = 1.1 * (0.85 + 0.15 * n); c.f.scale.set(1, 2.4 + n * 0.4, 1); }
      for (const m of motes) m.update(t, lite);
    },
    tagHeight: 2.0,
  };
}
