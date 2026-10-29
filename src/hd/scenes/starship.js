// HD scene: starship bridge with a conference room behind it.
import * as THREE from 'three';

export default {
  id: 'starship',
  label: 'Starship',
  modes: [['walk', 'Walk'], ['beam', 'Beam'], ['instant', 'Instant']],
  defaultMode: 'beam',
  build,
};

function build({ scene, renderer, slotColors = [] }) {
  // ---------- helpers ----------
  const cv = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const texOf = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; };
  const add = (m, parent = scene, cast = true) => { m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  const mesh = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return add(m, parent); };
  const std = (color, roughness = 0.6, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
  const glow = (c, k = 1.6) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false });
  // bridge polar coords: φ = 0 is the viewscreen (+x), φ = π the back door
  const Q = (phi, r) => [Math.cos(phi), Math.sin(phi)].map((v) => v * r);
  const deg = (d) => (d * Math.PI) / 180;
  // CylinderGeometry arc covering φ0..φ1 (its own angle runs the other way)
  const arcGeo = (r, h, p0, p1, open = true, seg) => new THREE.CylinderGeometry(r, r, h, seg ?? Math.max(6, Math.ceil((p1 - p0) * 20)), 1, open, Math.PI / 2 - p1, p1 - p0);

  // ---------- materials ----------
  const hull = std('#b9c2cf', 0.45, 0.2);
  const hullDark = std('#5d6878', 0.5, 0.3);
  const trimMetal = std('#8c96a6', 0.3, 0.8);
  function carpetTex() {
    const S = 512, c = cv(S, S), g = c.getContext('2d'), r = rng(9);
    g.fillStyle = '#16264d'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 26000; i++) { g.fillStyle = r() > 0.5 ? 'rgba(60,90,160,.18)' : 'rgba(5,10,25,.25)'; g.fillRect(r() * S, r() * S, 1.5, 1.5); }
    return texOf(c, [6, 6]);
  }
  const carpet = std('#ffffff', 0.95, 0, { map: carpetTex() });
  function wallPanelTex() {
    const W = 512, H = 512, c = cv(W, H), g = c.getContext('2d');
    g.fillStyle = '#c7cfda'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#9aa5b5'; g.fillRect(0, H * 0.62, W, H * 0.38);                 // dado
    g.fillStyle = '#7d8899'; for (let x = 0; x < W; x += 128) g.fillRect(x, 0, 4, H); // seams
    g.fillStyle = '#e8eef7'; g.fillRect(0, H * 0.6, W, 6);
    return texOf(c, [10, 1]);
  }
  const wallMat = std('#ffffff', 0.55, 0.1, { map: wallPanelTex(), side: THREE.DoubleSide });

  // console screen texture: abstract panels (not any real show's interface)
  function screenTex(hue, seed) {
    const W = 512, H = 256, c = cv(W, H), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = '#05070c'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 16; i++) {
      const x = r() * W * 0.85, y = r() * H * 0.85, w = 30 + r() * 140, h = 10 + r() * 50;
      g.fillStyle = `hsla(${hue + (r() - 0.5) * 50}, 70%, ${45 + r() * 25}%, ${0.5 + r() * 0.5})`;
      g.beginPath(); g.roundRect(x, y, w, h, 6); g.fill();
    }
    g.strokeStyle = `hsla(${hue}, 80%, 70%, .9)`; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x < W; x += 8) g.lineTo(x, H * 0.75 + Math.sin(x * 0.05 + seed) * 18);
    g.stroke();
    return texOf(c);
  }
  function starTex(W = 2048, H = 512) {
    const c = cv(W, H), g = c.getContext('2d'), r = rng(4);
    g.fillStyle = '#01020a'; g.fillRect(0, 0, W, H);
    const neb = g.createRadialGradient(W * 0.62, H * 0.45, 10, W * 0.62, H * 0.45, H * 0.9);
    neb.addColorStop(0, 'rgba(120,70,200,.45)'); neb.addColorStop(0.5, 'rgba(40,80,180,.18)'); neb.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = neb; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) { const s = r() < 0.05 ? 2.4 : 1.1; g.fillStyle = `rgba(${200 + r() * 55},${210 + r() * 45},255,${0.35 + r() * 0.65})`; g.fillRect(r() * W, r() * H, s, s); }
    // a planet limb
    const px = W * 0.3, py = H * 1.25, pr = H * 0.75;
    const pg = g.createRadialGradient(px - pr * 0.3, py - pr * 0.5, pr * 0.2, px, py, pr);
    pg.addColorStop(0, '#5aa0d8'); pg.addColorStop(0.7, '#1c3b6b'); pg.addColorStop(1, '#0a1428');
    g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill();
    g.strokeStyle = 'rgba(140,200,255,.6)'; g.lineWidth = 6; g.beginPath(); g.arc(px, py, pr, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    const t = texOf(c); t.wrapS = THREE.RepeatWrapping; return t;
  }

  // ---------- shell ----------
  const R = 4.4, H = 2.9, LOW = 0.55, DOOR = deg(11);
  const TALL0 = -Math.PI + DOOR, TALL1 = deg(42);   // tall walls: north side round to just past the screen
  const LOW0 = deg(42), LOW1 = Math.PI - DOOR;      // cut-down walls on the camera side
  // floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 0.2, 96), carpet); floor.rotation.x = -Math.PI / 2; add(floor, scene, false);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.35, R + 0.45, 0.4, 96), hullDark); base.position.y = -0.215; add(base, scene, false); // top just under the carpet (avoids z-fighting)
  // walls
  const wallTall = new THREE.Mesh(arcGeo(R, H, TALL0, TALL1), wallMat); wallTall.position.y = H / 2; add(wallTall);
  const wallLow = new THREE.Mesh(arcGeo(R, LOW, LOW0, LOW1), wallMat); wallLow.position.y = LOW / 2; add(wallLow);
  for (const [p0, p1, h] of [[TALL0, TALL1, H], [LOW0, LOW1, LOW]]) {
    const outer = new THREE.Mesh(arcGeo(R + 0.25, h, p0, p1), hullDark); outer.position.y = h / 2; add(outer);
    const cap = new THREE.Mesh(new THREE.RingGeometry(R, R + 0.25, 64, 1, Math.PI / 2 - p1 - Math.PI / 2 + Math.PI, p1 - p0), trimMetal);
    cap.rotation.x = -Math.PI / 2; cap.position.y = h + 0.002; scene.add(cap);
  }
  // fix cap orientation: RingGeometry angle a maps to (cos a, 0, -sin a) after rotation; we want (cos φ, sin φ) => a = -φ
  scene.children.filter((o) => o.geometry?.type === 'RingGeometry').forEach((o, i) => {
    const [p0, p1] = i === 0 ? [TALL0, TALL1] : [LOW0, LOW1];
    o.geometry.dispose(); o.geometry = new THREE.RingGeometry(R, R + 0.25, 64, 1, -p1, p1 - p0);
  });
  // ribs + a light strip around the tall wall
  for (let p = TALL0 + 0.12; p < TALL1 - 0.05; p += deg(15)) {
    if (Math.abs(p) < deg(34)) continue; // keep the viewscreen clear
    const [x, z] = Q(p, R - 0.06); const rib = mesh(new THREE.BoxGeometry(0.12, H, 0.1), hull, x, H / 2, z); rib.rotation.y = -p;
  }
  {
    const strip = new THREE.Mesh(new THREE.TorusGeometry(R - 0.04, 0.018, 6, 160, TALL1 - TALL0), glow('#cfe3ff', 1.3));
    strip.rotation.x = Math.PI / 2; strip.rotation.z = TALL0; strip.position.y = 2.5; scene.add(strip);
    const strip2 = new THREE.Mesh(new THREE.TorusGeometry(R - 0.04, 0.012, 6, 160, LOW1 - LOW0), glow('#cfe3ff', 1.1));
    strip2.rotation.x = Math.PI / 2; strip2.rotation.z = LOW0; strip2.position.y = LOW - 0.08; scene.add(strip2);
  }
  // door frame into the conference room
  for (const s of [-1, 1]) { const [x, z] = Q(Math.PI - s * DOOR, R + 0.12); mesh(new THREE.BoxGeometry(0.3, s < 0 ? H : LOW + 0.2, 0.18), hull, x, (s < 0 ? H : LOW + 0.2) / 2, z); }
  mesh(new THREE.BoxGeometry(0.3, 0.25, 1.75), hull, -R - 0.12, H - 0.125, 0);

  // ---------- viewscreen ----------
  const stars = starTex();
  const screen = new THREE.Mesh(arcGeo(R - 0.08, 1.75, deg(-30), deg(30), true, 64), new THREE.MeshBasicMaterial({ map: stars, side: THREE.BackSide, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.2) }));
  screen.position.y = 1.55; scene.add(screen);
  for (const y of [0.66, 2.44]) {
    const fr = new THREE.Mesh(new THREE.TorusGeometry(R - 0.1, 0.035, 8, 64, deg(62)), trimMetal); fr.rotation.x = Math.PI / 2; fr.rotation.z = deg(-31); fr.position.y = y; add(fr);
  }
  const screenLight = new THREE.PointLight('#8fb4ff', 2.2, 7, 1.8); screenLight.position.set(R - 1.0, 1.6, 0); scene.add(screenLight);

  // ---------- turbolift ----------
  {
    const [x, z] = Q(deg(-140), R + 0.45);
    const tube = mesh(new THREE.CylinderGeometry(0.75, 0.75, H + 0.2, 48, 1, true, 0, Math.PI * 2), std('#9aa6b8', 0.35, 0.5, { side: THREE.DoubleSide }), x, (H + 0.2) / 2, z);
    void tube;
    for (const y of [0.4, 1.2, 2.0, 2.8]) { const ring = mesh(new THREE.TorusGeometry(0.76, 0.02, 6, 48), glow('#ffd28a', 1.4), x, y, z); ring.rotation.x = Math.PI / 2; }
    const [dx, dz] = Q(deg(-140), R - 0.02);
    const door = mesh(new THREE.BoxGeometry(0.9, 2.2, 0.06), std('#d8c48a', 0.4, 0.6), dx, 1.1, dz); door.rotation.y = -deg(-140) + Math.PI / 2;
  }

  // ---------- tactical rail (horseshoe behind the command area) ----------
  const RAIL_R = 2.35, RAIL0 = deg(128), RAIL1 = deg(232);
  {
    const top = new THREE.Mesh(new THREE.TorusGeometry(RAIL_R, 0.05, 10, 96, RAIL1 - RAIL0), trimMetal);
    top.rotation.x = Math.PI / 2; top.rotation.z = -RAIL1; top.position.y = 1.05; add(top);
    // console top along the rail
    const desk = new THREE.Mesh(new THREE.RingGeometry(RAIL_R - 0.2, RAIL_R + 0.12, 64, 1, -RAIL1, RAIL1 - RAIL0), hull);
    desk.rotation.x = -Math.PI / 2; desk.position.y = 1.0; add(desk);
    const panel = new THREE.Mesh(arcGeo(RAIL_R + 0.1, 1.0, RAIL0, RAIL1), std('#8893a5', 0.5, 0.3, { side: THREE.DoubleSide })); panel.position.y = 0.5; add(panel);
    for (let p = RAIL0 + 0.15; p < RAIL1 - 0.1; p += 0.26) {
      const [x, z] = Q(p, RAIL_R - 0.05);
      const s = mesh(new THREE.PlaneGeometry(0.28, 0.12), new THREE.MeshBasicMaterial({ map: screenTex(200 + p * 40, Math.round(p * 100)), toneMapped: false }), x, 1.012, z);
      s.rotation.set(-Math.PI / 2, 0, -p - Math.PI / 2);
    }
  }
  // glow ring around the command area
  { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.014, 6, 128), glow('#5ad1ff', 1.3)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.012; scene.add(ring); }

  // ---------- chairs + stations ----------
  const seatMat = std('#2b3d66', 0.85), shellMat = std('#a7b2c2', 0.35, 0.4);
  function chair(x, z, face, big = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; scene.add(g);
    const w = big ? 0.6 : 0.5;
    mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.38, 16), shellMat, 0, 0.19, -0.03, g);
    mesh(new THREE.BoxGeometry(w, 0.09, 0.5), seatMat, 0, 0.42, -0.02, g);
    mesh(new THREE.BoxGeometry(w + 0.06, 0.05, 0.54), shellMat, 0, 0.37, -0.02, g);
    const back = mesh(new THREE.BoxGeometry(w, big ? 0.75 : 0.55, 0.09), seatMat, 0, big ? 0.83 : 0.72, -0.28, g); back.rotation.x = -0.12;
    mesh(new THREE.BoxGeometry(w + 0.06, big ? 0.8 : 0.6, 0.05), shellMat, 0, big ? 0.83 : 0.72, -0.33, g).rotation.x = -0.12;
    if (big) for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.08, 0.06, 0.42), shellMat, s * 0.34, 0.62, 0.0, g);
    return g;
  }
  // a station "lights up" by brightening its screens (and a floor ring in its agent's colour):
  // no extra lights, so eight crew don't slow the bridge down
  const stationGlow = [];
  function consoleFor(g, hue, seed) {
    // angled console in front of a chair (chair-local +z)
    const c = new THREE.Group(); c.position.set(0, 0, 0.62); g.add(c);
    mesh(new THREE.BoxGeometry(0.75, 0.68, 0.32), shellMat, 0, 0.34, 0.04, c);
    const top = mesh(new THREE.BoxGeometry(0.8, 0.04, 0.42), hull, 0, 0.74, 0, c); top.rotation.x = -0.35;
    const mat = new THREE.MeshBasicMaterial({ map: screenTex(hue, seed), toneMapped: false, color: new THREE.Color(0.35, 0.35, 0.35) });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.34), mat); scr.position.set(0, 0.765, 0); scr.rotation.x = -Math.PI / 2 - 0.35; c.add(scr);
    return [mat];
  }
  function armConsole(g, hue, seed) {
    // small screen on the chair's arm (for the seats beside the command chair)
    const mat = new THREE.MeshBasicMaterial({ map: screenTex(hue, seed), toneMapped: false, color: new THREE.Color(0.35, 0.35, 0.35) });
    mesh(new THREE.BoxGeometry(0.1, 0.1, 0.32), shellMat, 0.33, 0.6, 0.05, g);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.26), mat); scr.rotation.x = -Math.PI / 2; scr.position.set(0.33, 0.652, 0.05); g.add(scr);
    return [mat];
  }
  function wallStation(phi, hue, seed) {
    const [x, z] = Q(phi, R - 1.05);
    const face = Math.atan2(Math.cos(phi), Math.sin(phi)); // chair faces the wall
    const g = chair(x, z, face); const mats = consoleFor(g, hue, seed);
    const [wx, wz] = Q(phi, R - 0.07);
    const dm = new THREE.MeshBasicMaterial({ map: screenTex(hue, seed + 7), toneMapped: false, color: new THREE.Color(0.35, 0.35, 0.35) });
    const d = mesh(new THREE.PlaneGeometry(1.1, 0.6), dm, wx, 1.75, wz); d.rotation.y = -phi - Math.PI / 2;
    return { spot: { x, z, face }, mats: [...mats, dm] };
  }
  const ringAt = (x, z, i) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(slotColors[i] ?? '#5ad1ff').multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.014, z); scene.add(m); return m.material;
  };

  // eight places, in order: 1 the command chair, 2-3 the forward consoles, 4-5 wall stations,
  // 6-7 the seats beside the command chair, 8 standing at the tactical rail
  const STATIONS = [];
  const add8 = (i, spot, mats, typing = true) => { STATIONS[i] = { ...spot, pose: spot.pose ?? ((ag) => ag.sit(0.46, typing)) }; stationGlow[i] = { mats, ring: ringAt(spot.x, spot.z, i) }; };
  chair(0.25, 0, Math.PI / 2, true);
  add8(0, { x: 0.25, z: 0, face: Math.PI / 2 }, [], false);
  add8(1, { x: 1.9, z: -0.75, face: Math.PI / 2 }, consoleFor(chair(1.9, -0.75, Math.PI / 2), 45, 3));
  add8(2, { x: 1.9, z: 0.75, face: Math.PI / 2 }, consoleFor(chair(1.9, 0.75, Math.PI / 2), 275, 5));
  { const w = wallStation(deg(-78), 180, 11); add8(3, w.spot, w.mats); }
  { const w = wallStation(deg(-108), 210, 13); add8(4, w.spot, w.mats); }
  for (const [i, sz] of [[5, -1], [6, 1]]) {
    const face = Math.PI / 2 - sz * 0.15, g = chair(0.05, sz * 1.0, face);
    add8(i, { x: 0.05, z: sz * 1.0, face }, armConsole(g, sz < 0 ? 120 : 330, 20 + i), false);
  }
  {
    // the tactical rail: stand behind it, hands on the console, facing the screen
    const x = -2.8, z = 0;
    const mats = [];
    for (let k = -1; k <= 1; k++) {
      const mat = new THREE.MeshBasicMaterial({ map: screenTex(0, 40 + k), toneMapped: false, color: new THREE.Color(0.35, 0.35, 0.35) });
      const [sx, sz] = Q(Math.PI + k * 0.12, RAIL_R + 0.02);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.14), mat); sc.rotation.set(-Math.PI / 2, 0, -(Math.PI + k * 0.12) - Math.PI / 2); sc.position.set(sx, 1.016, sz); scene.add(sc); mats.push(mat);
    }
    add8(7, { x, z, face: Math.PI / 2, pose: (ag) => { ag.stand(); for (const j of ag.rig.sh) j.rotation.x = -0.75; for (const j of ag.rig.el) j.rotation.x = -0.35; } }, mats);
  }
  { const [x, z] = Q(deg(-55), R - 0.35); const panel = mesh(new THREE.BoxGeometry(0.5, 1.1, 0.25), shellMat, x, 0.55, z); panel.rotation.y = -deg(-55) + Math.PI / 2; }

  // ---------- conference room behind the bridge ----------
  const CX0 = -9.0, CX1 = -R - 0.2, CZ = 2.1;
  {
    const f = mesh(new THREE.BoxGeometry(CX1 - CX0, 0.02, CZ * 2), carpet, (CX0 + CX1) / 2, -0.005, 0); f.castShadow = false;
    mesh(new THREE.BoxGeometry(CX1 - CX0 + 0.2, 0.4, CZ * 2 + 0.3), hullDark, (CX0 + CX1) / 2, -0.21, 0).castShadow = false;
    const north = mesh(new THREE.BoxGeometry(CX1 - CX0, H, 0.2), wallMat, (CX0 + CX1) / 2, H / 2, -CZ - 0.1); void north;
    mesh(new THREE.BoxGeometry(CX1 - CX0, LOW, 0.2), wallMat, (CX0 + CX1) / 2, LOW / 2, CZ + 0.1);
    // west wall with a long window
    mesh(new THREE.BoxGeometry(0.2, 0.9, CZ * 2 + 0.4), wallMat, CX0 - 0.1, 0.45, 0);
    mesh(new THREE.BoxGeometry(0.2, 0.5, CZ * 2 + 0.4), wallMat, CX0 - 0.1, H - 0.25, 0);
    const win = mesh(new THREE.PlaneGeometry(CZ * 2, H - 1.4), new THREE.MeshBasicMaterial({ map: (() => { const t = starTex(1024, 384); t.repeat.set(0.5, 1); return t; })(), toneMapped: false }), CX0 - 0.15, 0.9 + (H - 1.4) / 2, 0);
    win.rotation.y = Math.PI / 2;
    for (const z of [-1.0, 0, 1.0]) mesh(new THREE.BoxGeometry(0.12, H - 1.4, 0.06), hull, CX0 - 0.05, 0.9 + (H - 1.4) / 2, z);
    // the table with a soft holo glow
    const TX = -6.65;
    mesh(new THREE.BoxGeometry(2.7, 0.07, 1.15), std('#7b8494', 0.25, 0.5), TX, 0.74, 0);
    mesh(new THREE.BoxGeometry(2.3, 0.7, 0.4), hullDark, TX, 0.35, 0);
    mesh(new THREE.PlaneGeometry(1.5, 0.4), glow('#5ad1ff', 0.5), TX, 0.778, 0).rotation.x = -Math.PI / 2;
    const tl = new THREE.PointLight('#bcd6ff', 1.2, 4, 1.8); tl.position.set(TX, 2.2, 0); scene.add(tl);
    // wall art: a ship silhouette plaque
    const plaque = mesh(new THREE.BoxGeometry(1.6, 0.7, 0.04), std('#2a3140', 0.5, 0.4), TX, 1.7, -CZ + 0.02); void plaque;
    mesh(new THREE.BoxGeometry(1.2, 0.08, 0.02), glow('#e6eeff', 0.9), TX, 1.72, -CZ + 0.05);
  }
  // eight seats round the conference table: three each side and one at each end
  const SEATS = [];
  {
    const TX = -6.65;
    for (const x of [TX + 0.85, TX, TX - 0.85]) for (const zs of [-1, 1]) { const z = zs * 0.95, face = zs < 0 ? 0 : Math.PI; chair(x, z, face); SEATS.push({ x, z, face }); }
    for (const [x, face] of [[TX + 1.62, -Math.PI / 2], [TX - 1.62, Math.PI / 2]]) { chair(x, 0, face); SEATS.push({ x, z: 0, face }); }
  }

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight('#a8c0ff', '#0a0e18', 0.25));
  const key = new THREE.DirectionalLight('#e8f0ff', 0.7); key.position.set(3, 10, 6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 4; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 8, bottom: -8, near: 1, far: 30 }); scene.add(key);
  for (const [x, z] of [[-1.5, -1.5], [1.2, -1.2], [-1.2, 1.5], [1.4, 1.4]]) { const d = new THREE.SpotLight('#fff3e0', 6, 6, 0.7, 0.8, 1.6); d.position.set(x, 3.4, z); d.target.position.set(x, 0, z); scene.add(d, d.target); }


  // ---------- places + walkways ----------
  const slots = STATIONS.map((st, i) => ({ station: st, lounge: { ...SEATS[i], pose: (ag) => ag.sit(0.46, false) } }));
  // a loop round the conference table, the doorway, a ring behind the rail and round the
  // walls, and an inner loop round the command area, joined by four spokes
  const ringPts = [], inner = [];
  for (let d = 30; d <= 330; d += 15) ringPts.push(Q(deg(d), 3.0));
  for (let d = 0; d <= 360; d += 30) inner.push(Q(deg(d), 1.55));
  const walkway = [
    [[-8.75, -1.55], [-4.95, -1.55], [-4.95, 0], [-4.95, 1.55], [-8.75, 1.55], [-8.75, -1.55]],
    [[-4.95, 0], Q(Math.PI, 3.0)],
    ringPts, inner,
    ...[60, 120, 240, 300].map((d) => [Q(deg(d), 3.0), Q(deg(d), 1.55)]),
  ];
  function setStation(i, state) {
    const S = stationGlow[i]; if (!S) return;
    const on = state !== 'off';
    for (const m of S.mats) m.color.setScalar(on ? 1.6 : 0.35);
    S.ring.opacity = on ? 0.85 : 0;
    S.ring.color.set(state === 'waiting' ? '#f59e0b' : state === 'error' ? '#ef4444' : slotColors[i] ?? '#5ad1ff').multiplyScalar(2);
  }
  function update(dt) { stars.offset.x = (stars.offset.x + dt * 0.004) % 1; }

  return {
    background: '#000000', exposure: 1.05, envIntensity: 0.12,
    bloom: { strength: 0.6, radius: 0.5, threshold: 1.0 },
    camera: { fov: 30, position: [1.5, 10.5, 12.5], target: [-2.2, 0.6, -0.4], aspect: 1.6, minPolar: 0.35, maxPolar: 1.3, minDist: 6, maxDist: 26 },
    slots, walkway, setStation, update,
    tagHeight: 1.95,
  };
}
