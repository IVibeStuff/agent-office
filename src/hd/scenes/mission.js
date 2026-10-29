// HD scene: mission control. Rows of consoles facing a giant orbit-map screen, the Flight
// Director (the lead) in the back row, a retro coffee lounge on the west side.
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { makeKit } from './kit.js';
import { UsageBoard } from '../../textures.js';

export default {
  id: 'mission',
  label: 'Mission Control',
  modes: [['walk', 'Walk'], ['instant', 'Instant']],
  defaultMode: 'walk',
  build,
};

function build({ scene, renderer, slotColors = [] }) {
  RectAreaLightUniformsLib.init();
  const K = makeKit(scene, renderer);
  const { mesh, box, std, glow, group } = K;

  // ---------- room ----------
  const RW = 10.4, RD = 7.2, WH = 3.4, WT = 0.22, BASE = 0.36;
  const x0 = -RW / 2, z0 = -RD / 2, zw = z0 + WT;
  const carpetTex = (() => { const S = 512, c = K.cv(S, S), g = c.getContext('2d'), r = K.rng(4); g.fillStyle = '#1c232e'; g.fillRect(0, 0, S, S); for (let i = 0; i < 20000; i++) { g.fillStyle = r() > 0.5 ? 'rgba(90,110,140,.12)' : 'rgba(0,0,0,.2)'; g.fillRect(r() * S, r() * S, 1.5, 1.5); } return K.texOf(c, [6, 5]); })();
  const panelTex = (() => { const W = 512, c = K.cv(W, W), g = c.getContext('2d'); g.fillStyle = '#4a5260'; g.fillRect(0, 0, W, W); g.fillStyle = '#3a414d'; for (let x = 0; x < W; x += 128) g.fillRect(x, 0, 3, W); g.fillStyle = '#2c323c'; g.fillRect(0, W * 0.7, W, W * 0.3); return K.texOf(c, [8, 1]); })();
  const wall = std('#ffffff', 0.7, { map: panelTex });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(RW, BASE, RD), [std('#20252d'), std('#20252d'), std('#ffffff', 0.95, { map: carpetTex }), std('#20252d'), std('#20252d'), std('#20252d')]);
  slab.position.y = -BASE / 2; slab.receiveShadow = true; scene.add(slab);
  mesh(new THREE.BoxGeometry(WT, WH, RD), wall, x0 + WT / 2, WH / 2, 0);
  mesh(new THREE.BoxGeometry(RW, WH, WT), wall, 0, WH / 2, z0 + WT / 2);
  mesh(new THREE.BoxGeometry(RW, 0.015, WT + 0.01), std('#6a7280', 0.5), 0, WH + 0.008, z0 + WT / 2);
  mesh(new THREE.BoxGeometry(WT + 0.01, 0.015, RD), std('#6a7280', 0.5), x0 + WT / 2, WH + 0.008, 0);

  // ---------- the big screen: orbit map ----------
  const mapTex = (() => {
    const W = 2048, H = 720, c = K.cv(W, H), g = c.getContext('2d'), r = K.rng(12);
    g.fillStyle = '#04122a'; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(80,140,220,.25)'; g.lineWidth = 2;
    for (let x = 0; x <= W; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 90) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // continents as soft blobs
    g.fillStyle = 'rgba(60,150,120,.55)';
    for (let k = 0; k < 9; k++) { const cx = r() * W, cy = 120 + r() * (H - 240); for (let i = 0; i < 18; i++) { g.beginPath(); g.ellipse(cx + (r() - 0.5) * 260, cy + (r() - 0.5) * 140, 30 + r() * 80, 20 + r() * 50, r() * 3, 0, 7); g.fill(); } }
    // three ground tracks
    for (const [col, ph] of [['#ffd23a', 0], ['#ff7a3a', 1.6], ['#7ad1ff', 3.1]]) {
      g.strokeStyle = col; g.lineWidth = 5; g.beginPath();
      for (let x = 0; x <= W; x += 8) g.lineTo(x, H / 2 + Math.sin(x / W * Math.PI * 4 + ph) * H * 0.3);
      g.stroke();
    }
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(W * 0.62, H / 2 + Math.sin(0.62 * Math.PI * 4) * H * 0.3, 14, 0, 7); g.fill();
    g.font = 'bold 48px monospace'; g.fillStyle = '#9ed0ff'; g.fillText('MET 042:17:33', 40, 70); g.fillText('GO', W - 140, 70);
    return K.texOf(c);
  })();
  const SW = 6.4, SH = 2.25, SY = 1.95, SX = 1.2;
  const big = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: mapTex, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.2) }));
  big.position.set(SX, SY, zw + 0.07); scene.add(big);
  box(SW + 0.16, SH + 0.16, 0.06, std('#111418', 0.4), SX, SY - SH / 2 - 0.08, zw + 0.01, 0.01);
  const bigLight = new THREE.RectAreaLight('#8fb8ff', 3.2, SW, SH); bigLight.position.set(SX, SY, zw + 0.06); bigLight.lookAt(SX, SY - 0.4, 5); scene.add(bigLight);
  // side screens: weekly usage on the left, a status list on the right
  const board = new UsageBoard({ bg: '#05101e', frame: '#123050', accent: '#3fd17a', big: '#e6f2ff', text: '#bcd6f2', muted: '#7d9cc0', faint: '#4a6a90', track: '#0f2236', title: 'PROPELLANT · WEEKLY USAGE' });
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.73), new THREE.MeshBasicMaterial({ map: board.texture, toneMapped: false, color: new THREE.Color(1.1, 1.1, 1.1) }));
    m.position.set(SX - SW / 2 - 1.05, SY + 0.35, zw + 0.06); scene.add(m);
    box(1.6, 0.83, 0.05, std('#111418', 0.4), m.position.x, m.position.y - 0.415, zw + 0.01, 0.01);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.1), new THREE.MeshBasicMaterial({ map: K.screenTex(140, 8, { bg: '#03140a', W: 256, H: 320 }), toneMapped: false }));
    s.position.set(SX + SW / 2 + 0.45, SY, zw + 0.03); scene.add(s);
  }
  // a wall clock row on the west wall
  for (let k = 0; k < 3; k++) {
    const c = K.cv(256, 96), g = c.getContext('2d'); g.fillStyle = '#060606'; g.fillRect(0, 0, 256, 96);
    g.font = 'bold 54px monospace'; g.fillStyle = ['#ff5a3a', '#ffd23a', '#7ad1ff'][k]; g.fillText(['14:03:27', '09:03:27', '22:03:27'][k], 12, 66);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.26), new THREE.MeshBasicMaterial({ map: K.texOf(c), toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) }));
    m.position.set(x0 + WT + 0.02, 2.55, -2.2 + k * 0.85); m.rotation.y = Math.PI / 2; scene.add(m);
  }

  // ---------- consoles ----------
  const cab = std('#5e6a7a', 0.55, { metalness: 0.2 }), cabDark = std('#2e353f', 0.6), deskTop = std('#8a929e', 0.4, { metalness: 0.3 });
  const SCREENS = [], RINGS = [], STATIONS = [];
  function chairAt(x, z, face) {
    const c = group(x, z, face);
    for (let i = 0; i < 5; i++) { const arm = new THREE.Group(); arm.rotation.y = (i / 5) * Math.PI * 2; c.add(arm); mesh(new THREE.BoxGeometry(0.3, 0.035, 0.05), K.metal('#9aa0a6'), 0.15, 0.08, 0, arm); }
    mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 12), K.metal('#9aa0a6'), 0, 0.26, 0, c);
    box(0.5, 0.09, 0.48, std('#c8641e', 0.85), 0, 0.42, -0.02, 0.04, c);     // orange vinyl, very 1969
    box(0.46, 0.5, 0.07, std('#c8641e', 0.85), 0, 0.58, -0.28, 0.04, c);
  }
  // one console position: desk with a CRT and button banks; the operator sits at (x, z + 0.65) facing north
  function console1(i, x, z, wide = false, label = '') {
    const W = wide ? 1.7 : 1.3;
    box(W, 0.7, 0.62, cab, x, 0, z, 0.02);
    const top = mesh(new THREE.BoxGeometry(W, 0.04, 0.5), deskTop, x, 0.74, z + 0.1); top.rotation.x = -0.12;
    box(W, 0.48, 0.26, cab, x, 0.72, z - 0.2, 0.02);                               // upper bank
    const crt = K.screenTex(wide ? 40 : 120 + i * 25, 30 + i, { bg: '#020a04', W: 320, H: 240 });
    const mat = new THREE.MeshBasicMaterial({ map: crt, toneMapped: false, color: new THREE.Color(0.25, 0.25, 0.25) });
    for (const dx of wide ? [-0.38, 0.38] : [0]) {
      box(0.5, 0.4, 0.06, cabDark, x + dx, 0.76, z - 0.06, 0.03);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), mat); s.position.set(x + dx, 0.96, z - 0.025); s.rotation.x = -0.08; scene.add(s);
    }
    // little indicator lamps (they come on with the console)
    const lamps = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb02a').multiplyScalar(0.2), toneMapped: false });
    for (let k = 0; k < (wide ? 10 : 7); k++) mesh(new THREE.BoxGeometry(0.04, 0.02, 0.03), k % 3 ? lamps : glow('#3fd17a', 0.35), x - W / 2 + 0.16 + k * 0.14, 0.775, z + 0.16, scene, false);
    if (label) {
      const c = K.cv(256, 64), g = c.getContext('2d'); g.fillStyle = '#d8d2c0'; g.fillRect(0, 0, 256, 64); g.font = 'bold 40px sans-serif'; g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.fillText(label, 128, 46);
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.09), std('#ffffff', 0.6, { map: K.texOf(c) })); p.position.set(x, 1.12, z - 0.06); scene.add(p);
    }
    chairAt(x, z + 0.68, Math.PI);
    STATIONS[i] = { x, z: z + 0.68, face: Math.PI, pose: (ag) => ag.sit(0.46, true) };
    SCREENS[i] = { mat, lamps }; RINGS[i] = K.stationRing(x, z + 0.68, slotColors[i] ?? '#3fd17a');
  }
  const COLS = [0.0, 1.6, 3.2];
  // place 1: Flight Director, back row centre (wide console); places 2-4 front row, 5-7 middle row, 8 back row right
  console1(0, COLS[1], 2.2, true, 'FLIGHT');
  COLS.forEach((x, k) => console1(1 + k, x, -1.4, false, ['FIDO', 'GUIDO', 'RETRO'][k]));
  COLS.forEach((x, k) => console1(4 + k, x, 0.4, false, ['EECOM', 'GNC', 'CAPCOM'][k]));
  console1(7, COLS[0], 2.2, false, 'NETWORK');
  // a low step under the back row, just for the look
  box(4.9, 0.03, 1.35, std('#262d38', 0.8), COLS[1], 0, 2.45, 0.01);

  // ---------- coffee lounge (west) ----------
  const SEATS = [];
  {
    const vinyl = std('#8a4a2a', 0.8), cream = std('#d9cbb0', 0.85);
    SEATS.push(...K.sofa(-3.5, -0.75, 0, 3, vinyl));
    SEATS.push(...K.sofa(-3.5, 2.15, Math.PI, 3, vinyl));
    for (const z of [0.3, 1.1]) SEATS.push(...K.sofa(-1.75, z, -Math.PI / 2, 1, cream).map((s) => ({ ...s, exit: [-1.15, z] })));
    // coffee table, coffee machine, water cooler, a mission-patch sign
    box(1.3, 0.04, 0.6, std('#ffffff', 0.5, { map: K.woodTex(30, 45, 34) }), -3.5, 0.38, 0.7, 0.01);
    for (const [dx, dz] of [[-0.55, -0.22], [0.55, -0.22], [-0.55, 0.22], [0.55, 0.22]]) mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.38, 8), K.metal('#9aa0a6'), -3.5 + dx, 0.19, 0.7 + dz);
    for (const dx of [-0.3, 0.1, 0.4]) mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 16), std(dx > 0 ? '#e6e2d6' : '#c8641e', 0.5), -3.5 + dx, 0.465, 0.7 + (dx > 0 ? 0.1 : -0.1));
    box(0.7, 0.9, 0.5, cabDark, x0 + WT + 0.35, 0, 2.95, 0.02);                    // counter
    box(0.35, 0.42, 0.3, std('#b8bcc4', 0.3, { metalness: 0.6 }), x0 + WT + 0.35, 0.9, 2.95, 0.03);   // coffee machine
    mesh(new THREE.SphereGeometry(0.03, 8, 6), glow('#ff3a2a', 1.5), x0 + WT + 0.35, 1.2, 3.12);
    box(0.32, 1.0, 0.32, std('#e6e2d6', 0.6), x0 + WT + 0.3, 0, -2.3, 0.03);       // water cooler
    mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 20), std('#a8d4ff', 0.1, { transparent: true, opacity: 0.6 }), x0 + WT + 0.3, 1.22, -2.3);
    const patch = K.cv(256, 256), g = patch.getContext('2d');
    g.fillStyle = '#0a1a3a'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.strokeStyle = '#ffd23a'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(150, 110, 30, 0, 7); g.fill(); g.strokeStyle = '#ff7a3a'; g.lineWidth = 6; g.beginPath(); g.ellipse(128, 140, 90, 34, -0.3, 0, 7); g.stroke();
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), std('#ffffff', 0.6, { map: K.texOf(patch) })); p.position.set(x0 + WT + 0.02, 1.8, 0.7); p.rotation.y = Math.PI / 2; scene.add(p);
    K.plant(-4.75, 0, -0.1, 1.4, '#c8641e');
    const fl = new THREE.PointLight('#ffb35c', 1.6, 4.5, 1.8); fl.position.set(-3.5, 2.0, 0.7); scene.add(fl);
    box(0.5, 0.04, 0.5, std('#d9cbb0', 0.6, { emissive: '#ffb35c', emissiveIntensity: 0.8 }), -3.5, 2.3, 0.7, 0.02);   // a hanging lamp
    mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.0, 6), std('#1a1a1a'), -3.5, 2.85, 0.7);
  }

  // ---------- light ----------
  scene.add(new THREE.HemisphereLight('#8fa8d8', '#0a0e18', 0.22));
  const key = new THREE.DirectionalLight('#dfe8ff', 0.35); key.position.set(6, 10, 8); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 4; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 34 }); scene.add(key);
  for (const z of [-1.0, 0.8, 2.6]) { const d = new THREE.SpotLight('#fff1dc', 9, 6, 0.75, 0.8, 1.6); d.position.set(COLS[1], 3.6, z); d.target.position.set(COLS[1], 0, z); scene.add(d, d.target); }

  // ---------- places + walkways ----------
  const slots = STATIONS.map((st, i) => ({ station: st, lounge: { ...SEATS[i], pose: (ag) => ag.sit(SEATS[i].seat ?? 0.5, false) } }));
  const walkway = [
    [[-0.9, -2.15], [-0.9, -0.25], [-0.9, 1.6], [-0.9, 3.25]],
    [[-0.9, -2.15], [4.3, -2.15]],
    [[-0.9, -0.25], [4.3, -0.25]],
    [[-0.9, 1.6], [4.3, 1.6]],
    [[-0.9, 3.25], [4.3, 3.25]],
    [[4.3, -2.15], [4.3, 3.25]],
  ];
  function setStation(i, state) {
    const S = SCREENS[i]; if (!S) return;
    const on = state !== 'off';
    S.mat.color.setScalar(on ? 1.5 : 0.25);
    S.lamps.color.set('#ffb02a').multiplyScalar(on ? 2.2 : 0.2);
    RINGS[i].set(state);
  }
  for (let i = 0; i < 8; i++) setStation(i, 'off');

  return {
    background: '#000000', exposure: 1.0, envIntensity: 0.12,
    bloom: { strength: 0.5, radius: 0.5, threshold: 1.0 },
    camera: { fov: 30, position: [14.4, 10.6, 15.6], target: [0, 0.6, 0], aspect: 1.5, minPolar: 0.45, maxPolar: 1.3, minAz: -0.25, maxAz: 1.85, minDist: 8, maxDist: 32 },
    slots, walkway, setStation,
    setUsage: (u) => board.draw(u),
    update() {},
    tagHeight: 2.0,
  };
}
