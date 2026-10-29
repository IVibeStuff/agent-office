// Builds the office: floor, walls, zones, furniture, screens, lights.
import * as THREE from 'three';
import * as L from './layout.js';
import { NavGrid } from './pathfinding.js';
import { createCutaway } from './themes/kit.js';
import * as T from './textures.js';

const mats = new Map();
export function matte(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...extra }));
  return mats.get(key);
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

// box with bottom at y
export function B(parent, w, h, d, mat, x, y, z, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(boxGeo, typeof mat === 'string' ? matte(mat) : mat);
  m.scale.set(w, h, d);
  m.position.set(x, y + h / 2, z);
  m.castShadow = cast; m.receiveShadow = receive;
  parent.add(m);
  return m;
}
export function C(parent, rTop, rBot, h, mat, x, y, z, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), typeof mat === 'string' ? matte(mat) : mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function floorPlane(parent, w, d, map, x, z, y, extra = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({
    map, roughness: 0.95, metalness: 0, transparent: !!extra.transparent, polygonOffset: true, polygonOffsetFactor: -1 - y * 100, polygonOffsetUnits: -1,
    ...extra,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const COL = {
  wall: '#3b4556', wallTrim: '#4b5566', base: '#1f252f', desk: '#d9d2c4', deskDark: '#5a4636', leg: '#3d4450',
  chair: '#2a303a', screenFrame: '#14181f', sofa: '#4a6670', sofaDark: '#3d5660', wood: '#8a6243', metal: '#9aa3ad',
  pot: '#d8d2c8', leaf: '#3f8a4f', leaf2: '#4f9e5c', rack: '#191e27',
};

export function buildWorld({ team, leadId, desks }) {
  const root = new THREE.Group();
  const nav = new NavGrid();
  const updaters = [];
  // slot → team member sitting there
  const bySlot = Object.fromEntries(team.filter((t) => desks[t.id]).map((t) => [desks[t.id], t]));

  // ---------- floor ----------
  const fw = L.FLOOR.maxX - L.FLOOR.minX, fd = L.FLOOR.maxZ - L.FLOOR.minZ;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.25, fd), [
    matte('#6b4a30'), matte('#6b4a30'), new THREE.MeshStandardMaterial({ map: T.woodFloor(), roughness: 0.8, metalness: 0 }),
    matte('#6b4a30'), matte('#5a3e28'), matte('#5a3e28'),
  ]);
  floor.position.set(0, -0.125, 0);
  floor.receiveShadow = true;
  root.add(floor);

  // ---------- zones (carpets with lettering) ----------
  for (const [slot, z] of Object.entries(L.ZONES)) {
    const w = z.maxX - z.minX, d = z.maxZ - z.minZ;
    const m = bySlot[slot];
    floorPlane(root, w, d, T.carpet(m?.color || '#7d8796', m?.department || 'Open Desk', w, d), (z.minX + z.maxX) / 2, (z.minZ + z.maxZ) / 2, 0.004);
  }
  // break room tiles + label
  {
    const b = L.BREAK, w = b.maxX - b.minX, d = b.maxZ - b.minZ;
    floorPlane(root, w, d, T.tiles(), (b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, 0.004);
    floorPlane(root, 4, 0.8, T.floorLabel(b.label, '#8f8a80', 4, 0.8), (b.minX + b.maxX) / 2, b.maxZ - 0.5, 0.008, { transparent: true });
  }
  // lounge rug
  {
    const rug = new THREE.Mesh(new THREE.CircleGeometry(L.LOUNGE.r, 96), new THREE.MeshStandardMaterial({
      map: T.roundRug('#3d7556', 'Lounge', L.LOUNGE.r), roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2,
    }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(L.LOUNGE.cx, 0.005, L.LOUNGE.cz);
    rug.receiveShadow = true;
    root.add(rug);
  }

  // ---------- walls ----------
  const H = L.WALL_H, T_ = 0.3;
  const wallZ = L.BACK_WALL_Z - T_ / 2, wallX = L.LEFT_WALL_X - T_ / 2;
  // outer walls drop to waist height when they're between the camera and the room
  const cutaway = createCutaway();
  const westG = new THREE.Group(), northG = new THREE.Group(); root.add(westG, northG);
  const westDecor = [], northDecor = [];
  cutaway.add(westG, -1, 0, { decor: westDecor });
  cutaway.add(northG, 0, -1, { decor: northDecor });
  // left wall (full)
  B(westG, T_, H, fd, COL.wall, wallX, 0, 0);
  B(westG, 0.04, 0.12, fd - 0.3, COL.base, L.LEFT_WALL_X + 0.02, 0, 0.15, { cast: false });
  // back wall solid part
  const solidW = L.WINDOWS_FROM_X - L.FLOOR.minX;
  B(northG, solidW, H, T_, COL.wall, L.FLOOR.minX + solidW / 2, 0, wallZ);
  B(northG, solidW - 0.3, 0.12, 0.04, COL.base, L.FLOOR.minX + 0.15 + (solidW - 0.3) / 2, 0, L.BACK_WALL_Z + 0.02, { cast: false });
  // back wall windows
  const winW = L.FLOOR.maxX - L.WINDOWS_FROM_X, winCx = L.WINDOWS_FROM_X + winW / 2;
  B(northG, winW, 0.5, T_, COL.wall, winCx, 0, wallZ);
  B(northG, winW, 0.3, T_, COL.wall, winCx, H - 0.3, wallZ);
  const nMull = Math.round(winW / 1.6);
  for (let i = 0; i <= nMull; i++) B(northG, 0.1, H - 0.8, 0.18, '#3b4453', L.WINDOWS_FROM_X + (winW * i) / nMull, 0.5, wallZ, { cast: false });
  B(northG, winW, 0.06, 0.4, '#3b4453', winCx, 0.5, wallZ + 0.05);
  const sky = T.skyTexture(), skyline = T.skylineTexture();
  const skyMat = new THREE.MeshBasicMaterial({ map: sky.texture, color: '#d6dde4', toneMapped: true });
  const skyPlane = new THREE.Mesh(new THREE.PlaneGeometry(winW, H - 0.8), skyMat);
  skyPlane.position.set(winCx, 0.5 + (H - 0.8) / 2, wallZ - 0.12);
  root.add(skyPlane); northDecor.push(skyPlane);
  const skylineMat = new THREE.MeshBasicMaterial({ map: skyline.texture, transparent: true, color: '#cfd6dd' });
  const skylinePlane = new THREE.Mesh(new THREE.PlaneGeometry(winW, 1.2), skylineMat);
  skylinePlane.position.set(winCx, 0.5 + 0.6, wallZ - 0.1);
  root.add(skylinePlane); northDecor.push(skylinePlane);
  // wall caps
  B(westG, T_ + 0.02, 0.05, fd, COL.wallTrim, wallX, H, 0, { cast: false });
  B(northG, fw, 0.05, T_ + 0.02, COL.wallTrim, 0, H, wallZ, { cast: false });

  // door on left wall
  {
    const z = L.DOOR.z;
    westDecor.push(
      B(root, 0.05, 2.25, L.DOOR.w + 0.16, '#1b2029', L.LEFT_WALL_X + 0.02, 0, z, { cast: false }),
      B(root, 0.06, 2.15, L.DOOR.w, '#6d5440', L.LEFT_WALL_X + 0.04, 0, z, { cast: false }),
      B(root, 0.08, 0.04, 0.2, COL.metal, L.LEFT_WALL_X + 0.1, 1.0, z + L.DOOR.w / 2 - 0.2, { cast: false }),
    );
  }
  // framed art on left wall
  {
    const c = document.createElement('canvas'); c.width = 512; c.height = 384;
    const g = c.getContext('2d');
    g.fillStyle = '#e9e4da'; g.fillRect(0, 0, 512, 384);
    [['#5b6cf0', 90, 120, 120], ['#14b8a6', 260, 200, 90], ['#f59e0b', 380, 110, 60], ['#fb7185', 170, 280, 50]].forEach(([col, x, y, r]) => {
      g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    westDecor.push(B(root, 0.05, 1.0, 1.3, '#1a1e26', L.LEFT_WALL_X + 0.025, 1.35, 3.85, { cast: false }));
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.88), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
    art.rotation.y = Math.PI / 2; art.position.set(L.LEFT_WALL_X + 0.07, 1.85, 3.85);
    root.add(art); westDecor.push(art);
  }

  // ---------- glass corner office ----------
  {
    const o = L.LEAD_OFFICE;
    const glass = new THREE.MeshStandardMaterial({ color: '#b9d3ea', transparent: true, opacity: 0.16, roughness: 0.2, metalness: 0, depthWrite: false });
    const frame = matte('#2a313d');
    const gh = 2.5;
    const pane = (x0, x1, z0, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, gh, 0.03), glass);
      m.position.set((x0 + x1) / 2, gh / 2, (z0 + z1) / 2);
      m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      root.add(m);
    };
    // west wall (x = minX)
    pane(o.minX, o.minX, o.minZ, o.maxZ);
    B(root, 0.07, gh, 0.07, frame, o.minX, 0, o.maxZ);
    B(root, 0.06, 0.06, o.maxZ - o.minZ, frame, o.minX, gh, (o.minZ + o.maxZ) / 2, { cast: false });
    B(root, 0.06, 0.05, o.maxZ - o.minZ, frame, o.minX, 0, (o.minZ + o.maxZ) / 2, { cast: false });
    for (let z = o.minZ + 1.8; z < o.maxZ - 0.5; z += 1.8) B(root, 0.04, gh, 0.04, frame, o.minX, 0, z, { cast: false });
    // south wall (z = maxZ) with a door gap
    pane(o.minX, o.doorMinX, o.maxZ, o.maxZ);
    pane(o.doorMaxX, o.maxX, o.maxZ, o.maxZ);
    B(root, o.doorMinX - o.minX, 0.06, 0.06, frame, (o.minX + o.doorMinX) / 2, gh, o.maxZ, { cast: false });
    B(root, o.maxX - o.doorMaxX, 0.06, 0.06, frame, (o.doorMaxX + o.maxX) / 2, gh, o.maxZ, { cast: false });
    B(root, o.doorMaxX - o.doorMinX, 0.06, 0.06, frame, (o.doorMinX + o.doorMaxX) / 2, 2.2, o.maxZ, { cast: false });
    for (const x of [o.doorMinX, o.doorMaxX, o.maxX - 0.03]) B(root, 0.07, gh, 0.07, frame, x, 0, o.maxZ);
    for (let x = o.doorMaxX + 1.6; x < o.maxX - 0.5; x += 1.6) B(root, 0.04, gh, 0.04, frame, x, 0, o.maxZ, { cast: false });
    // navigation
    nav.blockRect(o.minX - 0.02, o.minX + 0.02, o.minZ, o.maxZ, 0.3);
    nav.blockRect(o.minX, o.doorMinX, o.maxZ - 0.02, o.maxZ + 0.02, 0.3);
    nav.blockRect(o.doorMaxX, o.maxX + 1, o.maxZ - 0.02, o.maxZ + 0.02, 0.3);
  }

  // ---------- desks ----------
  const codeScreen = new T.CodeScreen();
  const codeMat = new THREE.MeshBasicMaterial({ map: codeScreen.texture, toneMapped: false, color: '#c9cfda' });
  const offMat = new THREE.MeshStandardMaterial({ color: '#0e131b', roughness: 0.6 });
  const monitors = {};
  for (const [id, d] of Object.entries(L.DESKS)) {
    const s = d.north ? -1 : 1; // +1: chair is south (+z)
    const lead = id === 'lead';
    const who = bySlot[id];
    const top = lead ? COL.deskDark : COL.desk;
    B(root, d.w, 0.05, d.d, top, d.x, 0.7, d.z);
    B(root, 0.05, 0.7, d.d - 0.06, COL.leg, d.x - d.w / 2 + 0.05, 0, d.z);
    B(root, 0.05, 0.7, d.d - 0.06, COL.leg, d.x + d.w / 2 - 0.05, 0, d.z);
    B(root, d.w - 0.12, 0.38, 0.03, COL.leg, d.x, 0.3, d.z - s * (d.d / 2 - 0.06));
    // monitor
    const mz = d.z - s * d.d * 0.2;
    B(root, 0.05, 0.16, 0.05, '#2a2f38', d.x, 0.75, mz - s * 0.03);
    B(root, 0.24, 0.02, 0.16, '#2a2f38', d.x, 0.75, mz - s * 0.03);
    B(root, 0.82, 0.48, 0.04, COL.screenFrame, d.x, 0.88, mz);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.42), offMat);
    scr.position.set(d.x, 0.88 + 0.24, mz + s * 0.021);
    scr.rotation.y = s > 0 ? 0 : Math.PI;
    root.add(scr);
    monitors[id] = (on) => { scr.material = on ? codeMat : offMat; };
    // keyboard
    B(root, 0.46, 0.015, 0.15, '#3a404b', d.x, 0.75, d.z + s * d.d * 0.18);
    // chair
    const seat = L.deskSeat(id);
    chair(root, seat.x, seat.z, s, who?.color);
    nav.blockBox(d.x, d.z, d.w, d.d, 0.28);
    nav.blockBox(seat.x, seat.z, 0.5, 0.5, 0.2);
    // accessory
    accessory(root, who?.accessory, d.x + s * (d.w / 2 - 0.28), 0.75, d.z + s * 0.12, who?.color, s);
  }

  // ---------- research wall screens ----------
  const screens = { chart: new T.ChartScreen(), map: new T.MapScreen(), terminal: new T.TerminalScreen() };
  for (const s of L.WALL_SCREENS) {
    northDecor.push(B(root, 1.5, 0.95, 0.06, COL.screenFrame, s.x, 1.55, L.BACK_WALL_Z + 0.03, { cast: false }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 0.87), new THREE.MeshBasicMaterial({ map: screens[s.kind].texture, toneMapped: false, color: '#c9cfda' }));
    m.position.set(s.x, 2.025, L.BACK_WALL_Z + 0.065);
    root.add(m); northDecor.push(m);
  }
  let screenT = 0;
  updaters.push((dt) => {
    screenT += dt;
    if (screenT > 0.16) { screenT = 0; screens.chart.draw(); screens.map.draw(); screens.terminal.draw(); codeScreen.draw(); }
  });

  // ---------- server racks with blinking LEDs ----------
  {
    const ledGeo = new THREE.BoxGeometry(0.035, 0.025, 0.01);
    const ledMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    const leds = [];
    const perRack = 4 * 14;
    const inst = new THREE.InstancedMesh(ledGeo, ledMat, L.RACKS.length * perRack);
    const dummy = new THREE.Object3D();
    let k = 0;
    for (const r of L.RACKS) {
      B(root, L.RACK.w, L.RACK.h, L.RACK.d, COL.rack, r.x, 0, L.RACK.z);
      B(root, L.RACK.w - 0.08, L.RACK.h - 0.14, 0.01, '#232a35', r.x, 0.07, L.RACK.z + L.RACK.d / 2 + 0.005, { cast: false });
      for (let row = 0; row < 14; row++) {
        B(root, L.RACK.w - 0.14, 0.008, 0.012, '#2e3644', r.x, 0.2 + row * 0.13 + 0.07, L.RACK.z + L.RACK.d / 2 + 0.012, { cast: false });
        for (let c = 0; c < 4; c++) {
          dummy.position.set(r.x - 0.2 + c * 0.06, 0.2 + row * 0.13, L.RACK.z + L.RACK.d / 2 + 0.015);
          dummy.updateMatrix();
          inst.setMatrixAt(k, dummy.matrix);
          leds.push({ on: Math.random() > 0.4, kind: c === 0 ? 'blue' : 'green' });
          k++;
        }
      }
      nav.blockBox(r.x, L.RACK.z, L.RACK.w, L.RACK.d, 0.28);
    }
    const on = { green: new THREE.Color('#4ade80'), blue: new THREE.Color('#60a5fa') }, off = new THREE.Color('#1b2a22');
    const paint = () => leds.forEach((l, i) => inst.setColorAt(i, l.on ? on[l.kind] : off));
    paint();
    root.add(inst);
    let acc = 0;
    updaters.push((dt) => {
      acc += dt;
      if (acc < 0.12) return;
      acc = 0;
      for (let i = 0; i < 18; i++) { const l = leds[(Math.random() * leds.length) | 0]; l.on = !l.on; }
      paint(); inst.instanceColor.needsUpdate = true;
    });
  }

  // ---------- usage board on the left wall ----------
  const usageBoard = new T.UsageBoard();
  {
    const u = L.USAGE_BOARD;
    westDecor.push(B(root, 0.06, u.h + 0.1, u.w + 0.1, '#1a1f28', L.LEFT_WALL_X + 0.03, u.y - u.h / 2 - 0.05, u.z, { cast: false }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(u.w, u.h), new THREE.MeshBasicMaterial({ map: usageBoard.texture, toneMapped: false, color: '#d4d8df' }));
    m.rotation.y = Math.PI / 2;
    m.position.set(L.LEFT_WALL_X + 0.08, u.y, u.z); // 2 cm clear of the frame
    root.add(m); westDecor.push(m);
  }
  // bookshelf in research
  bookshelf(root, -11.55, -6.2, Math.PI / 2, nav);

  // ---------- lounge ----------
  sofa(root, L.SOFA_A, 'z+', nav);
  sofa(root, L.SOFA_B, 'x+', nav);
  {
    const a = L.ARMCHAIR;
    B(root, a.w, 0.4, a.d, COL.sofa, a.x, 0, a.z);
    B(root, 0.22, 0.85, a.d, COL.sofaDark, a.x + a.w / 2 - 0.11, 0, a.z);
    B(root, a.w, 0.6, 0.18, COL.sofaDark, a.x, 0, a.z - a.d / 2 + 0.09);
    B(root, a.w, 0.6, 0.18, COL.sofaDark, a.x, 0, a.z + a.d / 2 - 0.09);
    nav.blockBox(a.x, a.z, a.w, a.d, 0.25);
    const t = L.COFFEE_TABLE;
    B(root, t.w, 0.05, t.d, COL.wood, t.x, 0.36, t.z);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) B(root, 0.05, 0.36, 0.05, '#2a2f38', t.x + dx * (t.w / 2 - 0.08), 0, t.z + dz * (t.d / 2 - 0.08));
    C(root, 0.07, 0.06, 0.1, '#e9e4da', t.x - 0.4, 0.41, t.z + 0.1, 16);
    B(root, 0.3, 0.03, 0.22, '#5b6cf0', t.x + 0.35, 0.41, t.z - 0.05);
    nav.blockBox(t.x, t.z, t.w, t.d, 0.25);
    // floor lamp
    C(root, 0.16, 0.18, 0.04, '#2a2f38', -0.55, 0, 4.3, 20);
    C(root, 0.02, 0.02, 1.55, '#2a2f38', -0.55, 0.04, 4.3, 8);
    C(root, 0.16, 0.26, 0.32, matte('#efe3c8', { emissive: '#3a2f1a' }), -0.55, 1.5, 4.3, 24);
    nav.blockBox(-0.55, 4.3, 0.36, 0.36, 0.2);
  }

  // ---------- break room ----------
  {
    const c = L.COUNTER;
    B(root, c.w, 0.88, c.d, '#e6e1d8', c.x, 0, c.z);
    B(root, c.w + 0.04, 0.05, c.d + 0.04, '#4a505b', c.x, 0.88, c.z);
    for (let i = 0; i < 4; i++) B(root, 0.01, 0.7, 0.015, '#bdb6aa', c.x - c.w / 2 - 0.005, 0.08, c.z - c.d / 2 + (c.d / 4) * (i + 0.5), { cast: false });
    // coffee machine (faces west, into the room)
    B(root, 0.34, 0.45, 0.36, '#22262e', c.x + 0.05, 0.93, c.z - 0.9);
    B(root, 0.12, 0.08, 0.2, '#8b5a3c', c.x - 0.16, 1.05, c.z - 0.9);
    C(root, 0.05, 0.04, 0.1, '#f5f2ec', c.x - 0.14, 0.95, c.z - 0.9, 12);
    // kettle + mugs
    C(root, 0.09, 0.11, 0.24, '#c9ced6', c.x, 0.93, c.z + 0.2, 16);
    for (let i = 0; i < 3; i++) C(root, 0.045, 0.04, 0.09, ['#5b6cf0', '#f59e0b', '#14b8a6'][i], c.x - 0.08, 0.93, c.z + 0.7 + i * 0.14, 12);
    nav.blockBox(c.x, c.z, c.w, c.d, 0.28);
    const f = L.FRIDGE;
    B(root, f.w, 1.85, f.d, '#d9dde3', f.x, 0, f.z);
    B(root, 0.04, 0.5, 0.03, '#8d949e', f.x - f.w / 2 - 0.02, 1.05, f.z - f.d / 2 + 0.1);
    B(root, 0.04, 0.4, 0.03, '#8d949e', f.x - f.w / 2 - 0.02, 0.4, f.z - f.d / 2 + 0.1);
    nav.blockBox(f.x, f.z, f.w, f.d, 0.28);
    const t = L.BREAK_TABLE;
    C(root, t.r, t.r, 0.04, '#ece7de', t.x, 0.72, t.z, 32);
    C(root, 0.04, 0.04, 0.72, '#3a404b', t.x, 0, t.z, 12);
    C(root, 0.25, 0.25, 0.03, '#3a404b', t.x, 0, t.z, 24);
    nav.blockBox(t.x, t.z, t.r * 2, t.r * 2, 0.25);
    for (const s of L.STOOLS) {
      C(root, 0.19, 0.19, 0.05, '#e08a3c', s.x, 0.62, s.z, 20);
      C(root, 0.03, 0.03, 0.62, '#3a404b', s.x, 0, s.z, 8);
      C(root, 0.16, 0.16, 0.02, '#3a404b', s.x, 0, s.z, 16);
      nav.blockBox(s.x, s.z, 0.38, 0.38, 0.15);
    }
    const w = L.WATER;
    B(root, 0.36, 0.95, 0.36, '#e6e8eb', w.x, 0, w.z);
    C(root, 0.15, 0.15, 0.42, matte('#7fb9e8', { transparent: true, opacity: 0.7 }), w.x, 0.95, w.z, 20);
    nav.blockBox(w.x, w.z, 0.36, 0.36, 0.25);
  }

  // ---------- huddle table ----------
  {
    const h = L.HUDDLE;
    B(root, h.w, 0.05, h.d, '#e6e0d4', h.x, 0.72, h.z);
    B(root, 0.08, 0.72, 0.6, '#3a404b', h.x - h.w / 2 + 0.3, 0, h.z);
    B(root, 0.08, 0.72, 0.6, '#3a404b', h.x + h.w / 2 - 0.3, 0, h.z);
    for (const dx of [-0.6, 0.6]) {
      chair(root, h.x + dx, h.z - h.d / 2 - 0.42, -1, null);
      chair(root, h.x + dx, h.z + h.d / 2 + 0.42, 1, null);
    }
    B(root, 0.4, 0.02, 0.3, '#f5f2ec', h.x - 0.3, 0.77, h.z);
    nav.blockBox(h.x, h.z, h.w, h.d + 1.5, 0.25);
  }

  // ---------- plants ----------
  for (const p of L.PLANTS) plant(root, p.x, p.z, p.s, nav);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight('#dfe8f5', '#4a3a2c', 1.2);
  root.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3e2', 2.0);
  sun.position.set(9, 16, 10);
  sun.target.position.set(-1, 0, -1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera; sc.left = -17; sc.right = 17; sc.top = 15; sc.bottom = -15; sc.near = 1; sc.far = 50;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  root.add(sun, sun.target);
  const interior = [];
  for (const [x, z] of [[-8, -5], [-1, -5], [8, -5.5], [-7, 0.5], [2, 0.5], [8.5, 0.5], [-3, 6], [8, 6]]) {
    const l = new THREE.PointLight('#ffd9a8', 0, 9, 1.6);
    l.position.set(x, 2.9, z);
    root.add(l);
    interior.push(l);
  }
  const lampLight = new THREE.PointLight('#ffcf8a', 0, 4, 2);
  lampLight.position.set(-0.55, 1.5, 4.3);
  root.add(lampLight);

  const TOD = {
    day:     { hemi: ['#e3ecf7', '#6a5442', 1.9], sun: ['#fff3e2', 2.5], interior: 0, lamp: 0, sky: 'day' },
    evening: { hemi: ['#e8c9b8', '#4a382e', 1.15], sun: ['#ffb27a', 1.4], interior: 4.5, lamp: 1.6, sky: 'evening' },
    night:   { hemi: ['#6d7aa0', '#241f20', 0.7], sun: ['#9fb4ff', 0.45], interior: 9, lamp: 3.0, sky: 'night' },
  };
  function setTimeOfDay(tod) {
    const p = TOD[tod];
    hemi.color.set(p.hemi[0]); hemi.groundColor.set(p.hemi[1]); hemi.intensity = p.hemi[2];
    sun.color.set(p.sun[0]); sun.intensity = p.sun[1];
    interior.forEach((l) => { l.intensity = p.interior; });
    lampLight.intensity = p.lamp;
    sky.draw(p.sky); skyline.draw(p.sky);
    skyMat.color.set(tod === 'day' ? '#cfd7df' : '#ffffff');
  }
  setTimeOfDay('day');

  return {
    root, nav, monitors, setTimeOfDay, cutaway,
    layout: { desks: L.DESKS, loungeSeats: L.LOUNGE_SEATS },
    setUsage: (u) => usageBoard.draw(u),
    update: (dt) => updaters.forEach((f) => f(dt)),
  };
}

// ---------- furniture helpers ----------
function chair(root, x, z, s, accent) {
  // s=+1: the chair sits south of its desk, back on the +z side
  B(root, 0.5, 0.07, 0.48, COL.chair, x, 0.4, z);
  B(root, 0.48, 0.52, 0.06, accent ? new THREE.Color(accent).lerp(new THREE.Color(COL.chair), 0.55).getStyle() : '#3a404b', x, 0.5, z + s * 0.24);
  C(root, 0.03, 0.03, 0.36, '#2a2f38', x, 0.04, z, 8);
  C(root, 0.24, 0.24, 0.04, '#2a2f38', x, 0, z, 20);
}

function sofa(root, s, facing, nav) {
  const along = facing === 'z+';
  B(root, s.w, 0.4, s.d, COL.sofa, s.x, 0, s.z);
  if (along) {
    B(root, s.w, 0.82, 0.22, COL.sofaDark, s.x, 0, s.z - s.d / 2 + 0.11);
    B(root, 0.22, 0.6, s.d, COL.sofaDark, s.x - s.w / 2 + 0.11, 0, s.z);
    B(root, 0.22, 0.6, s.d, COL.sofaDark, s.x + s.w / 2 - 0.11, 0, s.z);
    for (let i = 0; i < 4; i++) B(root, (s.w - 0.5) / 4 - 0.04, 0.08, s.d - 0.3, '#56747e', s.x - s.w / 2 + 0.25 + ((s.w - 0.5) / 4) * (i + 0.5), 0.4, s.z + 0.08, { cast: false });
  } else {
    B(root, 0.22, 0.82, s.d, COL.sofaDark, s.x - s.w / 2 + 0.11, 0, s.z);
    B(root, s.w, 0.6, 0.22, COL.sofaDark, s.x, 0, s.z - s.d / 2 + 0.11);
    B(root, s.w, 0.6, 0.22, COL.sofaDark, s.x, 0, s.z + s.d / 2 - 0.11);
    for (let i = 0; i < 3; i++) B(root, s.w - 0.3, 0.08, (s.d - 0.5) / 3 - 0.04, '#56747e', s.x + 0.08, 0.4, s.z - s.d / 2 + 0.25 + ((s.d - 0.5) / 3) * (i + 0.5), { cast: false });
  }
  nav.blockBox(s.x, s.z, s.w, s.d, 0.25);
}

function bookshelf(root, x, z, rot, nav) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = rot;
  B(g, 1.6, 1.9, 0.35, '#3b3329', 0, 0, 0);
  const cols = ['#5b6cf0', '#14b8a6', '#f59e0b', '#a855f7', '#e2e8f0', '#fb7185', '#22c55e', '#64748b'];
  for (let sh = 0; sh < 4; sh++) {
    B(g, 1.5, 0.03, 0.3, '#4d4236', 0, 0.12 + sh * 0.45, 0.03, { cast: false });
    let bx = -0.68;
    let k = sh * 3;
    while (bx < 0.66) {
      const bw = 0.05 + ((k * 37) % 5) * 0.012, bh = 0.26 + ((k * 13) % 4) * 0.03;
      B(g, bw, bh, 0.22, cols[k % cols.length], bx + bw / 2, 0.15 + sh * 0.45, 0.05, { cast: false });
      bx += bw + 0.012; k++;
      if (k % 7 === 0) bx += 0.12;
    }
  }
  root.add(g);
  const horiz = Math.abs(Math.sin(rot)) < 0.5;
  nav.blockBox(x, z, horiz ? 1.6 : 0.35, horiz ? 0.35 : 1.6, 0.28);
}

function plant(root, x, z, s, nav) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.scale.setScalar(s);
  C(g, 0.24, 0.18, 0.42, COL.pot, 0, 0, 0, 20);
  C(g, 0.22, 0.22, 0.02, '#4a3a2c', 0, 0.42, 0, 20);
  const leafMat = [matte(COL.leaf, { flatShading: true }), matte(COL.leaf2, { flatShading: true }), matte('#367a45', { flatShading: true })];
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const blobs = [[0, 0.85, 0, 0.32], [0.17, 1.08, 0.06, 0.24], [-0.15, 1.02, -0.08, 0.26], [0.04, 1.3, -0.04, 0.2], [-0.05, 0.7, 0.18, 0.22]];
  blobs.forEach(([bx, by, bz, r], i) => {
    const m = new THREE.Mesh(geo, leafMat[i % 3]);
    m.position.set(bx, by, bz); m.scale.setScalar(r); m.rotation.set(i, i * 2, 0);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  });
  root.add(g);
  nav.blockBox(x, z, 0.5 * s, 0.5 * s, 0.25);
}

export function accessory(root, kind, x, y, z, color, s) {
  const c = color || '#999';
  switch (kind) {
    case 'clipboard':
      B(root, 0.24, 0.015, 0.32, '#8a6243', x, y, z); B(root, 0.2, 0.004, 0.26, '#f4f1ea', x, y + 0.015, z + 0.01);
      B(root, 0.08, 0.02, 0.03, '#9aa3ad', x, y + 0.015, z - s * 0.14); break;
    case 'magnifier': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 10, 28), matte('#2a2f38'));
      ring.rotation.x = -Math.PI / 2; ring.position.set(x, y + 0.015, z); root.add(ring);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.064, 28), matte('#a9d5f0', { transparent: true, opacity: 0.6 }));
      lens.rotation.x = -Math.PI / 2; lens.position.set(x, y + 0.016, z); root.add(lens);
      const h = B(root, 0.025, 0.025, 0.14, c, x + 0.08, y + 0.003, z + 0.08); h.rotation.y = Math.PI / 4; break;
    }
    case 'pen': {
      C(root, 0.05, 0.045, 0.12, c, x, y, z, 14);
      for (const [dx, dz, r] of [[0.01, 0, 0.15], [-0.015, 0.01, -0.2]]) {
        const p = C(root, 0.007, 0.007, 0.18, '#1f2430', x + dx, y + 0.05, z + dz, 8); p.rotation.z = r;
      }
      B(root, 0.16, 0.01, 0.22, '#f4f1ea', x - s * 0.18, y, z); break;
    }
    case 'laptop': {
      B(root, 0.34, 0.02, 0.23, '#9aa3ad', x - s * 0.08, y, z);
      const lid = B(root, 0.34, 0.22, 0.012, '#9aa3ad', x - s * 0.08, y + 0.01, z - s * 0.11);
      lid.rotation.x = s * -0.25;
      B(root, 0.06, 0.06, 0.01, c, x - s * 0.08, y + 0.1, z - s * 0.105 - s * 0.012); break;
    }
    case 'calculator':
      B(root, 0.14, 0.02, 0.2, '#2a2f38', x, y, z); B(root, 0.11, 0.003, 0.045, '#9fd8b8', x, y + 0.02, z - s * 0.06);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) B(root, 0.025, 0.006, 0.025, j === 2 && i === 2 ? c : '#5b6370', x - 0.035 + i * 0.035, y + 0.02, z + s * (0.0 + j * 0.035), { cast: false });
      break;
    case 'clock': {
      const body = C(root, 0.085, 0.085, 0.05, c, x, y + 0.085, z, 28); body.rotation.x = Math.PI / 2;
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.07, 28), matte('#f4f1ea'));
      face.position.set(x, y + 0.11, z + s * 0.026); face.rotation.y = s > 0 ? 0 : Math.PI; root.add(face);
      B(root, 0.006, 0.05, 0.004, '#1f2430', x, y + 0.11, z + s * 0.03, { cast: false });
      const mh = B(root, 0.006, 0.035, 0.004, '#1f2430', x, y + 0.11, z + s * 0.03, { cast: false }); mh.rotation.z = 1.2;
      break;
    }
    default: break;
  }
}
