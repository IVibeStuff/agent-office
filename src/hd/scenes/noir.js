// HD scene: a 1940s detective agency at night. Venetian blinds stripe the streetlight across
// the desks, a pink neon sign glows outside, the Chief (the lead) works behind frosted glass,
// green banker's lamps come on at the desks in use, and idle detectives wait on chesterfields.
import * as THREE from 'three';
import { makeKit } from './kit.js';

export default {
  id: 'noir',
  label: 'Detective Agency',
  modes: [['walk', 'Walk'], ['instant', 'Instant']],
  defaultMode: 'walk',
  build,
};

function build({ scene, renderer, slotColors = [] }) {
  const K = makeKit(scene, renderer);
  const { mesh, box, std, glow, group } = K;

  // ---------- room ----------
  const RW = 8.8, RD = 6.8, WH = 3.2, WT = 0.22, BASE = 0.36;
  const x0 = -RW / 2, z0 = -RD / 2, zw = z0 + WT, xw = x0 + WT;
  const paper = (() => {
    const S = 512, c = K.cv(S, S), g = c.getContext('2d');
    g.fillStyle = '#1f2a24'; g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(200,180,120,.06)';
    for (let x = 0; x < S; x += 64) g.fillRect(x, 0, 18, S);
    for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) { g.beginPath(); g.ellipse(x + 41, y + 32, 6, 12, 0, 0, 7); g.fill(); }
    return K.texOf(c, [6, 2]);
  })();
  const wallpaper = std('#ffffff', 0.9, { map: paper });
  const panel = std('#ffffff', 0.6, { map: K.woodTex(22, 45, 18) });
  const floorMat = std('#ffffff', 0.5, { map: K.woodTex(24, 40, 20, [4, 4], 8) });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(RW, BASE, RD), [std('#1a120c'), std('#1a120c'), floorMat, std('#1a120c'), std('#1a120c'), std('#1a120c')]);
  slab.position.y = -BASE / 2; slab.receiveShadow = true; scene.add(slab);
  // west wall: wallpaper above wood panelling
  mesh(new THREE.BoxGeometry(WT, WH, RD), wallpaper, x0 + WT / 2, WH / 2, 0);
  box(0.03, 1.1, RD - WT, panel, xw + 0.015, 0, WT / 2, 0.005);
  // north wall with a wide window (blinds)
  const W0 = -1.0, W1 = 3.4, SILL = 1.05, WTOP = 2.75;
  const seg = (xa, xb, ya, yb) => mesh(new THREE.BoxGeometry(xb - xa, yb - ya, WT), wallpaper, (xa + xb) / 2, (ya + yb) / 2, z0 + WT / 2);
  seg(x0, W0, 0, WH); seg(W1, -x0, 0, WH); seg(W0, W1, 0, SILL); seg(W0, W1, WTOP, WH);
  box(W0 - x0 - WT, 1.1, 0.03, panel, (x0 + WT + W0) / 2, 0, zw + 0.015, 0.005);
  box(-x0 - W1, 1.1, 0.03, panel, (W1 - x0) / 2, 0, zw + 0.015, 0.005);
  box(W1 - W0, SILL, 0.03, panel, (W0 + W1) / 2, 0, zw + 0.015, 0.005);
  const frame = std('#2a1a10', 0.5);
  mesh(new THREE.BoxGeometry(W1 - W0 + 0.1, 0.08, WT + 0.1), frame, (W0 + W1) / 2, SILL, z0 + WT / 2);
  for (const x of [W0, (W0 + W1) / 2, W1]) mesh(new THREE.BoxGeometry(0.06, WTOP - SILL, 0.08), frame, x, (SILL + WTOP) / 2, z0 + WT / 2);
  // the blinds: thin slats, slightly open; they cast the stripes
  const slat = std('#c9bfa6', 0.6);
  for (let y = SILL + 0.06; y < WTOP - 0.02; y += 0.085) { const s = mesh(new THREE.BoxGeometry(W1 - W0, 0.006, 0.07), slat, (W0 + W1) / 2, y, zw - 0.05); s.rotation.x = 0.55; }
  // the city outside: dark towers, lit windows, a pink neon sign
  {
    const W = 1536, H = 640, c = K.cv(W, H), g = c.getContext('2d'), r = K.rng(31);
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#04060e'); sky.addColorStop(1, '#1a1830'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 14; k++) {
      const bx = r() * W, bw = 80 + r() * 160, bh = 200 + r() * 380;
      g.fillStyle = '#07080c'; g.fillRect(bx, H - bh, bw, bh);
      for (let y = H - bh + 20; y < H - 10; y += 26) for (let x = bx + 10; x < bx + bw - 10; x += 22) if (r() < 0.22) { g.fillStyle = r() < 0.5 ? '#e8c27a' : '#c9a35a'; g.fillRect(x, y, 10, 14); }
    }
    g.font = 'bold 120px Georgia, serif'; g.textAlign = 'center'; g.shadowColor = '#ff3d8a'; g.shadowBlur = 30; g.fillStyle = '#ffb3d1';
    g.fillText('HOTEL', W * 0.62, H * 0.42);
    const city = new THREE.Mesh(new THREE.PlaneGeometry(W1 - W0 + 1.2, (WTOP - SILL) + 0.9), new THREE.MeshBasicMaterial({ map: K.texOf(c), toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1) }));
    city.position.set((W0 + W1) / 2, (SILL + WTOP) / 2 + 0.1, z0 - 0.6); scene.add(city);
  }

  // ---------- furniture ----------
  const oak = std('#ffffff', 0.45, { map: K.woodTex(20, 50, 22) });
  const brassM = K.metal('#b08a3e', 0.35);
  const STATIONS = [], LAMPS = [], RINGS = [];
  // a banker's lamp: green glass shade that glows and a warm light, both on while the desk is in use
  function bankers(parent, x, y, z, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; parent.add(g);
    mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 20), brassM, 0, 0.01, 0, g);
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), brassM, 0, 0.16, 0, g);
    const shadeMat = new THREE.MeshStandardMaterial({ color: '#1f6a3a', roughness: 0.3, emissive: '#2fd17a', emissiveIntensity: 0.05, side: THREE.DoubleSide });
    const shade = mesh(new THREE.CylinderGeometry(0.06, 0.13, 0.08, 24, 1, true, 0, Math.PI), shadeMat, 0, 0.31, 0, g); shade.rotation.z = Math.PI / 2; shade.rotation.y = Math.PI / 2; shade.scale.set(1, 1, 1.6);
    const L = new THREE.PointLight('#ffd08a', 0, 2.4, 2); L.position.set(0, 0.25, 0.05); g.add(L);
    return { set: (k) => { L.intensity = 1.6 * k; shadeMat.emissiveIntensity = 0.05 + 0.9 * k; } };
  }
  function typewriter(parent, x, y, z) {
    box(0.36, 0.1, 0.3, std('#141414', 0.35), x, y, z, 0.03, parent);
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 12), std('#1a1a1a', 0.3), x, y + 0.13, z - 0.08, parent).rotation.z = Math.PI / 2;
    const p = mesh(new THREE.PlaneGeometry(0.2, 0.22), std('#f2efe6', 0.9), x, y + 0.22, z - 0.1, parent); p.rotation.x = -0.25;
  }
  function deskChair(x, z, face) {
    const c = group(x, z, face), leather = std('#3a1f12', 0.55);
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 10), K.metal('#2a2a2a'), 0, 0.2, 0, c);
    for (let k = 0; k < 4; k++) { const a = new THREE.Group(); a.rotation.y = k * Math.PI / 2 + 0.4; c.add(a); mesh(new THREE.BoxGeometry(0.28, 0.03, 0.04), K.metal('#2a2a2a'), 0.14, 0.04, 0, a); }
    box(0.5, 0.09, 0.48, leather, 0, 0.42, -0.02, 0.04, c);
    box(0.48, 0.42, 0.08, leather, 0, 0.56, -0.27, 0.05, c);
  }
  // a detective's desk; the detective sits at (x, z) facing `face`, the desk in front
  function desk(i, x, z, face) {
    const g = group(x, z, face);
    box(1.25, 0.05, 0.7, oak, 0, 0.71, 0.62, 0.01, g);
    box(0.4, 0.7, 0.62, oak, -0.4, 0, 0.62, 0.01, g); box(0.4, 0.7, 0.62, oak, 0.4, 0, 0.62, 0.01, g);
    typewriter(g, 0.05, 0.76, 0.6);
    LAMPS[i] = bankers(g, 0.45, 0.76, 0.75, Math.PI);
    box(0.24, 0.05, 0.3, std('#c9b48a', 0.8), -0.42, 0.76, 0.62, 0.005, g); box(0.24, 0.04, 0.3, std('#e6dccb', 0.8), -0.4, 0.81, 0.6, 0.005, g);   // case files
    mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 16), std('#1a1a1a', 0.3), -0.2, 0.8, 0.85, g);                                           // phone base
    deskChair(x, z, face);
    STATIONS[i] = { x, z, face, pose: (ag) => ag.sit(0.46, true) };
    RINGS[i] = K.stationRing(x, z, slotColors[i] ?? '#ffd08a');
  }

  // ---------- place 1: the Chief's office behind frosted glass (north-west corner) ----------
  {
    const PX = -1.8, PZ = -1.0, glassM = new THREE.MeshStandardMaterial({ color: '#dfe8e6', roughness: 0.35, transparent: true, opacity: 0.32, depthWrite: false });
    // partition: wood base, frosted glass above; a door gap in the south side
    const part = (xa, za, xb, zb) => {
      const len = Math.hypot(xb - xa, zb - za), cx = (xa + xb) / 2, cz = (za + zb) / 2, rot = Math.atan2(xb - xa, zb - za);
      const g = group(cx, cz, rot + Math.PI / 2);
      box(len, 1.0, 0.08, oak, 0, 0, 0, 0.01, g);
      const gl = mesh(new THREE.BoxGeometry(len, 1.4, 0.03), glassM, 0, 1.7, 0, g, false); gl.castShadow = false;
      box(len, 0.06, 0.1, oak, 0, 2.4, 0, 0.01, g);
      return g;
    };
    part(PX, zw, PX, PZ);                    // east side
    part(xw, PZ, -3.05, PZ);                 // south side, west of the door
    part(-2.15, PZ, PX, PZ);                 // south side, east of the door
    // "CHIEF" lettered on the glass by the door
    const c = K.cv(512, 128), g = c.getContext('2d'); g.font = 'bold 84px Georgia, serif'; g.fillStyle = '#1a1208'; g.textAlign = 'center'; g.fillText('CHIEF', 256, 96);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.19), new THREE.MeshBasicMaterial({ map: K.texOf(c), transparent: true })); sign.position.set(-1.98, 1.9, PZ + 0.05); scene.add(sign);
    // the big desk, facing the door
    const dx = -3.15, dz = -2.15;
    const dg = group(dx, dz, 0);
    box(1.4, 0.06, 0.85, oak, 0, 0.72, 0.62, 0.01, dg);
    box(1.4, 0.7, 0.06, oak, 0, 0, 0.98, 0.01, dg);
    for (const s of [-1, 1]) box(0.45, 0.7, 0.8, oak, s * 0.47, 0, 0.62, 0.01, dg);
    LAMPS[0] = bankers(dg, -0.5, 0.78, 0.75, Math.PI);
    mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 16), std('#1a1a1a', 0.3), 0.45, 0.82, 0.6, dg);                   // phone
    box(0.3, 0.06, 0.24, std('#c9b48a', 0.8), 0.1, 0.78, 0.6, 0.005, dg);
    mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 16), std('#d9cfb8', 0.4, { transparent: true, opacity: 0.6 }), 0.35, 0.83, 0.82, dg);  // a glass of water
    // the Chief's chair (bigger) and a filing cabinet
    const cg = group(dx, dz, 0), leather = std('#2a1408', 0.5);
    box(0.6, 0.1, 0.55, leather, 0, 0.4, -0.02, 0.05, cg); box(0.6, 0.75, 0.1, leather, 0, 0.5, -0.3, 0.06, cg);
    for (const s of [-1, 1]) box(0.08, 0.25, 0.5, leather, s * 0.32, 0.45, 0, 0.03, cg);
    box(0.5, 1.35, 0.6, std('#4a4a3e', 0.5, { metalness: 0.5 }), xw + 0.3, 0, -2.75, 0.01);
    STATIONS[0] = { x: dx, z: dz, face: 0, exit: [-2.12, -2.35], pose: (ag) => ag.sit(0.46, true) };
    RINGS[0] = K.stationRing(dx, dz, slotColors[0] ?? '#ffd08a');
  }
  // places 2-4 under the window, 5-6 along the west wall, 7-8 at the partners' desk in the middle
  [-0.1, 1.2, 2.5].forEach((x, k) => desk(1 + k, x, zw + 1.28, Math.PI));
  [0.25, 1.95].forEach((z, k) => desk(4 + k, xw + 1.28, z, -Math.PI / 2));
  desk(6, 0.3, 0.43, 0);
  desk(7, 0.3, 2.37, Math.PI);
  // filing cabinets and a coat stand
  for (const x of [-1.45, 3.95]) box(0.5, 1.35, 0.6, std('#4a4a3e', 0.5, { metalness: 0.5 }), x, 0, zw + 0.32, 0.01);
  {
    const cs = group(-1.3, -0.65);
    mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.75, 8), oak, 0, 0.88, 0, cs);
    for (let k = 0; k < 3; k++) mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 3), oak, 0, 0.02, 0, cs).rotation.y = k;
    mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 24), std('#3a3226', 0.8), 0, 1.78, 0, cs);   // a hat left on it
    mesh(new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), std('#3a3226', 0.8), 0, 1.78, 0, cs).scale.y = 0.8;
  }

  // ---------- waiting room: the lounge ----------
  const SEATS = [];
  {
    const chesterfield = std('#5a2414', 0.45), rug = (() => { const c = K.cv(512, 512), g = c.getContext('2d'); g.fillStyle = '#3a1418'; g.fillRect(0, 0, 512, 512); g.strokeStyle = '#a8803a'; g.lineWidth = 12; g.strokeRect(24, 24, 464, 464); g.lineWidth = 3; g.strokeRect(52, 52, 408, 408); return K.texOf(c); })();
    const r = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.9), std('#ffffff', 1, { map: rug })); r.rotation.x = -Math.PI / 2; r.position.set(2.85, 0.004, 1.62); r.receiveShadow = true; scene.add(r);
    SEATS.push(...K.sofa(2.85, 0.4, 0, 3, chesterfield));
    SEATS.push(...K.sofa(2.85, 2.85, Math.PI, 3, chesterfield));
    SEATS.push(...K.sofa(4.0, 1.62, -Math.PI / 2, 1, chesterfield).map((s) => ({ ...s, exit: [3.5, 1.2] })));
    SEATS.push(...K.sofa(1.7, 1.62, Math.PI / 2, 1, chesterfield));
    box(0.9, 0.04, 0.5, oak, 2.85, 0.4, 1.62, 0.01);
    for (const [ddx, ddz] of [[-0.38, -0.18], [0.38, -0.18], [-0.38, 0.18], [0.38, 0.18]]) mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.4, 8), oak, 2.85 + ddx, 0.2, 1.62 + ddz);
    mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.03, 16), brassM, 2.7, 0.455, 1.6);
    box(0.25, 0.03, 0.18, std('#e6dccb', 0.8), 3.0, 0.44, 1.66, 0.004).rotation.y = 0.3;   // a newspaper
    K.plant(4.1, 0, 0.0, 1.6, '#3a2a1a');
    // a pendant light over the waiting room
    mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.9, 6), std('#1a1a1a'), 2.85, 2.75, 1.62);
    mesh(new THREE.CylinderGeometry(0.12, 0.28, 0.2, 24, 1, true), std('#e6d0a0', 0.5, { emissive: '#ffb35c', emissiveIntensity: 0.7, side: THREE.DoubleSide }), 2.85, 2.25, 1.62);
    const L = new THREE.PointLight('#ffb35c', 1.6, 4.5, 1.8); L.position.set(2.85, 2.05, 1.62); scene.add(L);
  }

  // ---------- light ----------
  scene.add(new THREE.HemisphereLight('#7a8ab8', '#120c08', 0.14));
  // streetlight through the blinds: hard-edged stripes over the desks and floor
  const street = new THREE.SpotLight('#a8c0ff', 120, 22, 0.45, 0.25, 1.4);
  street.position.set(1.6, 6.0, z0 - 4.5); street.target.position.set(1.0, 0, 0.8);
  street.castShadow = true; street.shadow.mapSize.set(2048, 2048); street.shadow.radius = 1.5; street.shadow.bias = -0.0003; street.shadow.camera.near = 2;
  scene.add(street, street.target);
  const neon = new THREE.PointLight('#ff3d8a', 3.2, 7, 1.6); neon.position.set(2.2, 2.1, z0 - 0.5); scene.add(neon);

  // ---------- places + walkways ----------
  const slots = STATIONS.map((st, i) => ({ station: st, lounge: { ...SEATS[i], pose: (ag) => ag.sit(SEATS[i].seat ?? 0.5, false) } }));
  const walkway = [
    [[-2.12, -2.35], [-2.12, -1.3], [-2.6, -0.55], [-2.6, 3.1]],
    [[-2.6, -0.55], [-1.3, -0.55], [-1.3, -1.45]],
    [[-1.3, -1.45], [1.25, -1.45], [3.9, -1.45]],
    [[1.25, -1.45], [1.25, 3.1]],
    [[-2.6, 3.1], [1.25, 3.1]],
  ];
  function setStation(i, state) {
    LAMPS[i]?.set(state === 'off' ? 0 : 1);
    RINGS[i]?.set(state === 'waiting' || state === 'error' ? state : 'off');
  }
  for (let i = 0; i < 8; i++) setStation(i, 'off');

  return {
    background: '#000000', exposure: 1.05, envIntensity: 0.06,
    bloom: { strength: 0.55, radius: 0.5, threshold: 1.0 },
    camera: { fov: 30, position: [13.0, 9.8, 14.4], target: [-0.2, 0.6, -0.1], aspect: 1.5, minPolar: 0.45, maxPolar: 1.3, minAz: -0.25, maxAz: 1.85, minDist: 8, maxDist: 30 },
    slots, walkway, setStation,
    update(dt, t) { neon.intensity = 3.2 * (Math.sin(t * 13) > -0.97 ? 1 : 0.25); },   // the odd flicker
    tagHeight: 2.0,
  };
}
