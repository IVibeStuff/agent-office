// HD scene: the office as a soft-lit diorama. Four workstations, a lounge corner,
// and the weekly usage board on the wall screen.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { UsageBoard } from '../../textures.js';

export default {
  id: 'office',
  label: 'Office',
  modes: [['walk', 'Walk'], ['instant', 'Instant']],
  defaultMode: 'walk',
  build,
};

function build({ scene, renderer }) {
  RectAreaLightUniformsLib.init();
  const ANISO = renderer.capabilities.getMaxAnisotropy();
  const cv = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const texOf = (c, rep, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
  const rbox = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 4, Math.min(r, Math.min(w, h, d) / 2.2));
  const mesh = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, r, parent) => mesh(rbox(w, h, d, r), mat, x, y + h / 2, z, parent); // y = bottom
  const std = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  const glow = (c, k = 1.6) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });

  // ---------- textures ----------
  function woodTex(base, rep) {
    const S = 1024, c = cv(S, S), g = c.getContext('2d'), r = rng(5);
    g.fillStyle = `hsl(${base[0]}, ${base[1]}%, ${base[2]}%)`; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `hsla(${base[0] - 4 + r() * 8}, ${base[1]}%, ${base[2] - 10 + r() * 16}%, ${0.18 + r() * 0.2})`;
      g.lineWidth = 1 + r() * 3; g.beginPath(); const y = r() * S; g.moveTo(0, y);
      for (let x = 0; x <= S; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6 + (r() - 0.5) * 4);
      g.stroke();
    }
    // plank seams
    if (rep) { g.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < S; y += S / 6) g.fillRect(0, y, S, 3); }
    return texOf(c, rep);
  }
  function plasterTex() {
    const S = 512, c = cv(S, S), g = c.getContext('2d'), r = rng(8);
    g.fillStyle = '#bdb8b0'; g.fillRect(0, 0, S, S);
    g.globalAlpha = 0.05; for (let i = 0; i < 9000; i++) { g.fillStyle = r() > 0.5 ? '#fff' : '#8a8478'; g.fillRect(r() * S, r() * S, 2, 2); }
    return texOf(c, [4, 2]);
  }
  function strataTex() {
    const c = cv(64, 256), g = c.getContext('2d'), r = rng(3); let y = 0;
    while (y < 256) { const h = 6 + r() * 14; g.fillStyle = `hsl(32, ${18 + r() * 10}%, ${30 + r() * 20}%)`; g.fillRect(0, y, 64, h); y += h; }
    return texOf(c, [10, 1]);
  }
  function codeTex(hue, seed) {
    const W = 512, H = 320, c = cv(W, H), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = '#0b0f17'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#141b28'; g.fillRect(0, 0, 90, H);
    for (let i = 0; i < 18; i++) {
      let x = 108 + (r() < 0.3 ? 24 : 0) + (r() < 0.2 ? 24 : 0);
      for (let k = 0; k < 4; k++) { const w = 20 + r() * 80; g.fillStyle = `hsla(${hue + (r() - 0.5) * 120}, 60%, ${55 + r() * 20}%, .9)`; g.fillRect(x, 14 + i * 16, w, 7); x += w + 10; if (x > W - 40) break; }
    }
    for (let i = 0; i < 10; i++) { g.fillStyle = 'rgba(160,170,190,.35)'; g.fillRect(14, 16 + i * 26, 60, 8); }
    return texOf(c);
  }
  function photoTex() {
    const W = 512, H = 384, c = cv(W, H), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#d8d8d8'); gr.addColorStop(1, '#7a7a7a');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = '#3a3a3a'; g.beginPath(); g.moveTo(0, H); g.lineTo(120, 170); g.lineTo(220, 240); g.lineTo(330, 120); g.lineTo(512, 280); g.lineTo(512, H); g.fill();
    g.fillStyle = '#5a5a5a'; g.beginPath(); g.moveTo(0, H); g.lineTo(200, 290); g.lineTo(512, 330); g.lineTo(512, H); g.fill();
    return texOf(c);
  }
  function rugTex() {
    const S = 512, c = cv(S, S), g = c.getContext('2d'), r = rng(12);
    g.fillStyle = '#2c3440'; g.fillRect(0, 0, S, S);
    g.strokeStyle = '#7a6a52'; g.lineWidth = 10; g.strokeRect(22, 22, S - 44, S - 44);
    g.strokeStyle = '#4a5566'; g.lineWidth = 4; g.strokeRect(46, 46, S - 92, S - 92);
    for (let i = 0; i < 16000; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.06)'; g.fillRect(r() * S, r() * S, 2, 2); }
    return texOf(c);
  }

  // ---------- room ----------
  const RW = 10.4, RD = 7.8, WH = 2.6, WT = 0.18, BASE = 0.34;
  const x0 = -RW / 2, z0 = -RD / 2;
  const strata = std('#ffffff', 0.95, { map: strataTex() });
  const floorTop = std('#ffffff', 0.55, { map: woodTex([30, 34, 40], [4, 3]) });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(RW, BASE, RD), [strata, strata, floorTop, strata, strata, strata]);
  slab.position.y = -BASE / 2; slab.receiveShadow = true; scene.add(slab);
  const plaster = std('#ffffff', 0.95, { map: plasterTex() });
  plaster.map.repeat.set(5, 2);
  const cap = std('#e2ded6', 0.9);
  mesh(new THREE.BoxGeometry(WT, WH, RD), plaster, x0 + WT / 2, WH / 2, 0);
  mesh(new THREE.BoxGeometry(RW, WH, WT), plaster, 0, WH / 2, z0 + WT / 2);
  mesh(new THREE.BoxGeometry(WT + 0.002, 0.012, RD), cap, x0 + WT / 2, WH + 0.006, 0);
  mesh(new THREE.BoxGeometry(RW, 0.012, WT + 0.002), cap, 0, WH + 0.006, z0 + WT / 2);
  box(0.02, 0.08, RD - WT, std('#9a958c'), x0 + WT + 0.01, 0, WT / 2, 0.005);
  box(RW - WT, 0.08, 0.02, std('#9a958c'), WT / 2, 0, z0 + WT + 0.01, 0.005);

  // ---------- shared furniture ----------
  const deskWood = std('#ffffff', 0.45, { map: woodTex([30, 48, 50]) });
  const metal = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.35, metalness: 0.8 });
  const dark = std('#1a1a1a', 0.5);
  const DT = 0.04, DH = 0.74;
  function officeChair(x, z, face) {
    const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = face; scene.add(c);
    const fabric = std('#26282c', 0.95);
    for (let i = 0; i < 5; i++) {
      const arm = new THREE.Group(); arm.rotation.y = (i / 5) * Math.PI * 2; c.add(arm);
      mesh(rbox(0.3, 0.035, 0.05, 0.015), metal, 0.15, 0.08, 0, arm);
      mesh(new THREE.SphereGeometry(0.03, 12, 8), dark, 0.29, 0.03, 0, arm);
    }
    mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.34, 16), metal, 0, 0.26, 0, c);
    box(0.5, 0.09, 0.48, fabric, 0, 0.43, -0.02, 0.04, c);
    box(0.46, 0.55, 0.07, fabric, 0, 0.6, -0.28, 0.04, c);
    for (const sx of [-1, 1]) { box(0.04, 0.2, 0.04, metal, sx * 0.26, 0.45, -0.04, 0.01, c); box(0.06, 0.03, 0.26, dark, sx * 0.26, 0.65, -0.04, 0.012, c); }
    return c;
  }
  function deskLamp(x, z) {
    mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.02, 28), std('#f2f0ec', 0.5), x, DH + 0.01, z);
    mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.36, 10), std('#f2f0ec', 0.5), x, DH + 0.19, z);
    const shadeMat = std('#f6efe2', 0.6, { side: THREE.DoubleSide, emissive: '#ffb066', emissiveIntensity: 0.05 });
    const shade = mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.13, 32, 1, true), shadeMat, x, DH + 0.42, z); shade.castShadow = false;
    const bulb = mesh(new THREE.SphereGeometry(0.04, 14, 10), glow('#fff1d0', 0.25), x, DH + 0.39, z); bulb.castShadow = false;
    const L = new THREE.PointLight('#ffb866', 0, 2.4, 2); L.position.set(x, DH + 0.34, z); scene.add(L);
    return { set: (k) => { L.intensity = 1.3 * k; shadeMat.emissiveIntensity = 0.05 + 0.6 * k; bulb.material.color.set('#fff1d0').multiplyScalar(0.25 + 1.8 * k); } };
  }
  function monitor(x, z, face, hue, seed) {
    const g = new THREE.Group(); g.position.set(x, DH, z); g.rotation.y = face; scene.add(g);
    mesh(new THREE.BoxGeometry(0.2, 0.012, 0.14), dark, 0, 0.006, 0, g);
    mesh(new THREE.BoxGeometry(0.03, 0.22, 0.03), dark, 0, 0.12, -0.02, g);
    box(0.64, 0.38, 0.03, std('#141414', 0.4), 0, 0.2, 0, 0.01, g);
    const mat = new THREE.MeshBasicMaterial({ map: codeTex(hue, seed), toneMapped: false, color: new THREE.Color(0.12, 0.12, 0.12) });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.34), mat); scr.position.set(0, 0.39, 0.017); g.add(scr);
    box(0.44, 0.015, 0.14, std('#2a2a2e', 0.6), 0, 0, 0.3, 0.005, g);
    box(0.06, 0.02, 0.1, std('#2a2a2e', 0.5), 0.34, 0, 0.3, 0.01, g);
    return mat;
  }
  const plantMat = std('#3f7a3a', 0.6, { side: THREE.DoubleSide });
  function plant(x, y, z, s = 1, pot = '#b0563a') {
    mesh(new THREE.CylinderGeometry(0.09 * s, 0.07 * s, 0.16 * s, 24), std(pot, 0.8), x, y + 0.08 * s, z);
    for (let i = 0; i < 11; i++) {
      const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.07 * s, 12), plantMat);
      const a = i * 0.7, rr = (0.05 + (i % 3) * 0.03) * s;
      leaf.scale.set(0.7, 1.5, 1); leaf.position.set(x + Math.cos(a) * rr, y + (0.22 + (i % 4) * 0.06) * s, z + Math.sin(a) * rr);
      leaf.rotation.set(-0.6 + Math.sin(i) * 0.4, a, 0.3); leaf.castShadow = true; scene.add(leaf);
    }
  }
  // a simple desk: top + four legs; the person sits facing `face`
  function desk(x, z, w, d, face, i, hue) {
    box(w, DT, d, deskWood, x, DH - DT, z, 0.012).rotation.y = face;
    const c = Math.cos(face), sn = Math.sin(face);
    for (const [lx, lz] of [[-w / 2 + 0.06, -d / 2 + 0.06], [w / 2 - 0.06, -d / 2 + 0.06], [-w / 2 + 0.06, d / 2 - 0.06], [w / 2 - 0.06, d / 2 - 0.06]])
      mesh(new THREE.CylinderGeometry(0.02, 0.02, DH - DT, 12), metal, x + lx * c + lz * sn, (DH - DT) / 2, z - lx * sn + lz * c);
    // person sits 0.95 from the desk centre, facing it; monitor faces them
    const fx = Math.sin(face), fz = Math.cos(face);
    SCREENS[i] = monitor(x + fx * 0.12, z + fz * 0.12, face + Math.PI, hue, 3 + i);
    LAMPS[i] = deskLamp(x + Math.cos(face) * (w / 2 - 0.18) + fx * 0.15, z - Math.sin(face) * (w / 2 - 0.18) + fz * 0.15);
    officeChair(x - fx * 0.95, z - fz * 0.95, face);
    STATIONS[i] = { x: x - fx * 0.95, z: z - fz * 0.95, face };
  }

  // ---------- place 1 (the lead): L-desk in the corner, under the usage screen ----------
  const STATIONS = [], LAMPS = [], SCREENS = [];
  {
    const ax = x0 + WT + 0.42, az0 = z0 + WT, az1 = z0 + 2.15;
    box(0.8, DT, az1 - az0, deskWood, ax, DH - DT, (az0 + az1) / 2, 0.012);
    for (const dx of [-0.32, 0.32]) mesh(new THREE.CylinderGeometry(0.022, 0.022, DH - DT, 16), metal, ax + dx, (DH - DT) / 2, az1 - 0.06);
    const bz = z0 + WT + 0.36, bx0 = ax + 0.4, bx1 = x0 + 3.15;
    box(bx1 - bx0, DT, 0.72, deskWood, (bx0 + bx1) / 2, DH - DT, bz, 0.012);
    const pedX = bx1 - 0.3;
    box(0.56, DH - DT, 0.66, deskWood, pedX, 0, bz, 0.01);
    for (let i = 0; i < 4; i++) { box(0.5, 0.15, 0.012, deskWood, pedX, 0.04 + i * 0.165, bz + 0.33, 0.004); mesh(new THREE.BoxGeometry(0.12, 0.012, 0.02), std('#2a2a2a', 0.4), pedX, 0.13 + i * 0.165, bz + 0.345); }
    const cz = (az0 + az1) / 2;
    box(0.16, 0.018, 0.46, std('#f2f0ec', 0.6), ax + 0.12, DH, cz, 0.006);
    for (let i = 0; i < 3; i++) box(0.24, 0.045, 0.32, std(['#3a3a3a', '#6b4a3a', '#2a3a4a'][i], 0.7), ax - 0.1, DH + i * 0.046, z0 + WT + 0.3, 0.006).rotation.y = i * 0.08;
    const lap = new THREE.Group(); lap.position.set(bx0 + 0.55, DH, bz + 0.02); scene.add(lap);
    box(0.42, 0.015, 0.3, std('#c8ccd0', 0.35, { metalness: 0.6 }), 0, 0, 0, 0.008, lap);
    const lid = new THREE.Group(); lid.position.set(0, 0.015, -0.15); lid.rotation.x = -0.32; lap.add(lid);
    box(0.42, 0.28, 0.01, std('#c8ccd0', 0.35, { metalness: 0.6 }), 0, 0, 0, 0.006, lid);
    const lapMat = new THREE.MeshBasicMaterial({ map: codeTex(230, 2), toneMapped: false, color: new THREE.Color(0.12, 0.12, 0.12) });
    const lapScr = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.24), lapMat); lapScr.position.set(0, 0.14, 0.006); lid.add(lapScr);
    SCREENS[0] = lapMat;
    LAMPS[0] = deskLamp(pedX, bz + 0.05);
    plant(ax - 0.05, DH, bz - 0.05, 1);
    officeChair(ax + 0.85, cz, -Math.PI / 2);
    STATIONS[0] = { x: ax + 0.85, z: cz, face: -Math.PI / 2 };
  }
  // ---------- the usage board: the glowing wall screen ----------
  const board = new UsageBoard({ bg: '#0b0e14', frame: '#1b2230', accent: '#7c8cff', big: '#ffffff', text: '#dfe4ee', muted: '#9aa3b5', faint: '#6a7385', track: '#1f2633' });
  {
    const W = 1.55, H = 0.75, x = x0 + WT + 0.02, y = 1.65, z = STATIONS[0].z;
    const mat = new THREE.MeshBasicMaterial({ map: board.texture, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.15) });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat); scr.position.set(x, y, z); scr.rotation.y = Math.PI / 2; scene.add(scr);
    box(0.03, H + 0.06, W + 0.06, dark, x0 + WT + 0.005, y - H / 2 - 0.03, z, 0.01);
    const L = new THREE.RectAreaLight('#dfe6ff', 2.5, W, H); L.position.set(x + 0.02, y, z); L.lookAt(5, y - 0.6, z); scene.add(L);
  }
  // ---------- places 2-5: desks along the back wall ----------
  const backZ = z0 + WT + 0.36;
  [-0.35, 1.25, 2.85, 4.45].forEach((x, k) => desk(x, backZ, 1.25, 0.72, Math.PI, 1 + k, [30, 170, 280, 120][k]));
  // ---------- places 6-7: desks along the side wall ----------
  const sideX = x0 + WT + 0.36;
  [0.0, 1.95].forEach((z, k) => desk(sideX, z, 1.3, 0.72, -Math.PI / 2, 5 + k, [330, 60][k]));
  // ---------- place 8: an island desk facing the room ----------
  desk(-1.4, 1.35, 1.35, 0.72, 0, 7, 200);

  // bookshelf between the lead's desk and the back row
  {
    const sx = -1.55, sz = z0 + WT + 0.18, W = 0.75, Hh = 2.0;
    for (const dx of [-W / 2, W / 2]) mesh(new THREE.BoxGeometry(0.04, Hh, 0.34), deskWood, sx + dx, Hh / 2, sz);
    mesh(new THREE.BoxGeometry(W + 0.04, 0.04, 0.34), deskWood, sx, Hh, sz);
    const r = rng(31), cols = ['#2f3b4c', '#7a3a2a', '#c9b48a', '#3d5a3a', '#1f1f24', '#8a6a3a'];
    for (let k = 0; k < 4; k++) {
      const y = 0.06 + k * 0.48; mesh(new THREE.BoxGeometry(W, 0.03, 0.32), deskWood, sx, y, sz);
      let x = sx - W / 2 + 0.03;
      while (x < sx + W / 2 - 0.08) { const w = 0.03 + r() * 0.04, h = 0.22 + r() * 0.12; mesh(new THREE.BoxGeometry(w, h, 0.22), std(cols[(r() * cols.length) | 0], 0.7), x + w / 2, y + 0.015 + h / 2, sz); x += w + 0.005; if (r() < 0.08) x += 0.1; }
    }
    plant(sx, Hh + 0.02, sz, 0.8, '#d8d3ca');
  }
  // framed photos above the back row, a pinboard on the side wall
  for (const x of [0.45, 3.65]) {
    box(0.66, 0.5, 0.03, dark, x, 1.3, z0 + WT + 0.015, 0.006);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.36), std('#ffffff', 0.7, { map: photoTex() })); p.position.set(x, 1.55, z0 + WT + 0.032); scene.add(p);
  }
  {
    box(0.03, 0.6, 1.4, std('#a88a62', 0.9), x0 + WT + 0.015, 1.25, 0.95, 0.004);
    const r = rng(7);
    for (let i = 0; i < 9; i++) { const n = mesh(new THREE.PlaneGeometry(0.14, 0.12), std(['#f3e38a', '#f2b8c6', '#bfe3f2', '#ffffff'][i % 4], 0.9), x0 + WT + 0.034, 1.35 + (r() - 0.5) * 0.4, 0.95 + (r() - 0.5) * 1.2); n.rotation.y = Math.PI / 2; n.rotation.x = (r() - 0.5) * 0.2; }
  }

  // ---------- lounge (front right): two sofas, two armchairs, a coffee table ----------
  const SEATS = [];
  {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.0), std('#ffffff', 1, { map: rugTex() }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(2.6, 0.004, 2.15); rug.receiveShadow = true; scene.add(rug);
    const sofaMat = std('#3d4b5e', 0.95), legM = std('#2a2018', 0.6);
    // a sofa or armchair at (x, z) facing `face`, `n` seats wide
    const seat = (x, z, face, n) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; scene.add(g);
      const W = n * 0.7 + 0.3;
      box(W, 0.3, 0.8, sofaMat, 0, 0.12, 0, 0.06, g);
      for (let i = 0; i < n; i++) box(0.66, 0.12, 0.66, sofaMat, (i - (n - 1) / 2) * 0.7, 0.42, 0.05, 0.05, g);
      box(W, 0.5, 0.2, sofaMat, 0, 0.4, -0.32, 0.07, g);
      for (const s of [-1, 1]) box(0.15, 0.32, 0.8, sofaMat, s * (W / 2 - 0.02), 0.32, 0, 0.06, g);
      for (const [dx, dz] of [[-W / 2 + 0.1, -0.32], [W / 2 - 0.1, -0.32], [-W / 2 + 0.1, 0.32], [W / 2 - 0.1, 0.32]]) mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.12, 10), legM, dx, 0.06, dz, g);
      const out = [];
      for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 0.7; out.push({ x: x + Math.cos(face) * o + Math.sin(face) * 0.06, z: z - Math.sin(face) * o + Math.cos(face) * 0.06, face }); }
      return out;
    };
    SEATS.push(...seat(2.4, 0.75, 0, 3));                    // faces the room (and you)
    SEATS.push(...seat(4.6, 2.3, -Math.PI / 2, 3));          // along the right edge
    for (const z of [2.3, 3.1]) SEATS.push(...seat(0.8, z, Math.PI / 2, 1).map((s) => ({ ...s, exit: [1.45, 2.7] })));
    for (const sd of [-1, 1]) box(0.36, 0.3, 0.12, std(sd < 0 ? '#c9a35a' : '#7a3a2a', 0.95), 2.4 + sd * 0.82, 0.52, 0.57, 0.05).rotation.z = sd * 0.15;
    const TX = 2.55, TZ = 2.2;
    box(1.1, 0.04, 0.6, deskWood, TX, 0.38, TZ, 0.012);
    for (const dx of [-0.48, 0.48]) for (const dz of [-0.24, 0.24]) mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.38, 10), metal, TX + dx, 0.19, TZ + dz);
    for (let i = 0; i < 2; i++) box(0.24, 0.03, 0.3, std(['#e6dccb', '#2a3a4a'][i], 0.7), TX - 0.25, 0.42 + i * 0.031, TZ, 0.004).rotation.y = i * 0.2;
    mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 20), std('#d8d3ca', 0.5), TX + 0.25, 0.465, TZ - 0.08);
    mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 20), std('#2f6f6a', 0.5), TX + 0.38, 0.465, TZ + 0.1);
    plant(4.85, 0, 0.45, 1.8, '#d8d3ca');
    plant(-4.7, 0, 3.4, 1.6, '#d8d3ca');
    const LX = 0.75, LZ = 0.55;
    mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.03, 28), dark, LX, 0.015, LZ);
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.55, 10), dark, LX, 0.79, LZ);
    const sh = mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.26, 32, 1, true), std('#f2e6d2', 0.7, { side: THREE.DoubleSide, emissive: '#ffb066', emissiveIntensity: 0.55 }), LX, 1.62, LZ); sh.castShadow = false;
    const fl = new THREE.PointLight('#ffb35c', 2.0, 5, 1.8); fl.position.set(LX, 1.5, LZ); fl.castShadow = true; fl.shadow.mapSize.set(512, 512); fl.shadow.radius = 4; fl.shadow.bias = -0.003; scene.add(fl);
  }

  // ---------- light ----------
  scene.add(new THREE.HemisphereLight('#c9d4e6', '#2a2420', 0.14));
  const key = new THREE.DirectionalLight('#dfe6f2', 0.32);
  key.position.set(7, 10, 8); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 5; key.shadow.blurSamples = 16; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 34 });
  scene.add(key);

  // ---------- places ----------
  const slots = STATIONS.map((st, i) => ({
    station: { ...st, pose: (ag) => ag.sit(0.46, true) },
    lounge: { ...SEATS[i], pose: (ag) => ag.sit(0.5, false) },
  }));
  const walkway = [
    [[-2.95, 2.9], [-2.95, -1.55], [0.0, -1.55], [4.9, -1.55]],
    [[0.0, -1.55], [0.0, 1.5], [3.95, 1.5]],
  ];
  const TINT = { working: [1.3, 1.3, 1.3], waiting: [1.5, 1.05, 0.45], error: [1.6, 0.5, 0.45], off: [0.12, 0.12, 0.12] };
  function setStation(i, state) {
    SCREENS[i]?.color.setRGB(...(TINT[state] ?? TINT.working));
    LAMPS[i]?.set(state === 'off' ? 0 : 1);
  }

  return {
    background: '#000000', exposure: 1.0, envIntensity: 0.08,
    bloom: { strength: 0.5, radius: 0.5, threshold: 1.05 },
    camera: { fov: 30, position: [13.2, 9.8, 14.4], target: [-0.1, 0.5, -0.1], aspect: 1.5, minPolar: 0.45, maxPolar: 1.3, minAz: -0.25, maxAz: 1.85, minDist: 8, maxDist: 30 },
    slots, walkway, setStation,
    update() {},
    setUsage: (u) => board.draw(u),
    tagHeight: 2.0,
  };
}
