// HD scene: the wizard's tower. Moonlit cutaway, alchemy bench, cauldron, lounge round a crystal ball.
import * as THREE from 'three';

export default {
  id: 'wizard',
  label: "Wizard's Tower",
  modes: [['walk', 'Walk'], ['portal', 'Portal'], ['instant', 'Instant']],
  defaultMode: 'portal',
  build,
};

function build({ scene, renderer, slotColors = [] }) {
  let dustState = null;
  // ---------- helpers ----------
  const cv = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const texOf = (c, srgb = true) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const add = (m, parent = scene, cast = true) => { m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  const mesh = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return add(m, parent); };
  const std = (color, roughness = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  const glowMat = (hex, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });

  // Tower convention (same as CylinderGeometry): P(θ, r) = (r sinθ, r cosθ)
  const P = (th, r) => [r * Math.sin(th), r * Math.cos(th)];

  // ---------- textures ----------
  function stoneCanvas(seed = 3, light = 34) {
    const S = 1024, c = cv(S, S), g = c.getContext('2d'), r = rng(seed);
    const b = cv(S, S), gb = b.getContext('2d'); // bump: white stone, dark mortar
    g.fillStyle = '#16120f'; g.fillRect(0, 0, S, S);
    gb.fillStyle = '#000'; gb.fillRect(0, 0, S, S);
    const rows = 8, rh = S / rows;
    for (let y = 0; y < rows; y++) {
      let x = -((y % 2) * 0.5 + r() * 0.3) * 180;
      while (x < S) {
        const w = 130 + r() * 120, m = 7;
        const L = light - 8 + r() * 14, hue = 28 + r() * 14;
        g.fillStyle = `hsl(${hue}, ${8 + r() * 8}%, ${L}%)`;
        g.fillRect(x + m, y * rh + m, w - m * 2, rh - m * 2);
        // weathering speckle per block
        for (let i = 0; i < 90; i++) {
          g.fillStyle = `hsla(${hue}, 10%, ${L + (r() - 0.5) * 18}%, .5)`;
          g.fillRect(x + m + r() * (w - m * 2), y * rh + m + r() * (rh - m * 2), 2 + r() * 5, 2 + r() * 5);
        }
        const gr = gb.createLinearGradient(0, y * rh, 0, y * rh + rh);
        gr.addColorStop(0, '#bbb'); gr.addColorStop(0.5, '#fff'); gr.addColorStop(1, '#999');
        gb.fillStyle = gr; gb.fillRect(x + m, y * rh + m, w - m * 2, rh - m * 2);
        x += w;
      }
    }
    return { map: c, bump: b };
  }
  function flagstoneCanvas() {
    const S = 1024, c = cv(S, S), g = c.getContext('2d'), r = rng(11);
    g.fillStyle = '#0e0c0a'; g.fillRect(0, 0, S, S);
    const n = 6, s = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const L = 22 + r() * 12;
      g.fillStyle = `hsl(${25 + r() * 15}, 9%, ${L}%)`;
      g.fillRect(i * s + 5 + r() * 4, j * s + 5 + r() * 4, s - 12, s - 12);
      for (let k = 0; k < 120; k++) { g.fillStyle = `hsla(30, 8%, ${L + (r() - 0.5) * 16}%, .45)`; g.fillRect(i * s + r() * s, j * s + r() * s, 3, 3); }
    }
    return c;
  }
  function woodCanvas(h = 24, l = 20) {
    const S = 512, c = cv(S, S), g = c.getContext('2d'), r = rng(7);
    g.fillStyle = `hsl(${h}, 35%, ${l}%)`; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = `hsla(${h}, 35%, ${l - 8 + r() * 14}%, .35)`; g.lineWidth = 1 + r() * 3; g.beginPath();
      const y = r() * S; g.moveTo(0, y); for (let x = 0; x <= S; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 4); g.stroke();
    }
    return c;
  }
  function skyCanvas() {
    const W = 512, H = 768, c = cv(W, H), g = c.getContext('2d'), r = rng(5);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#02040c'); gr.addColorStop(1, '#0d1a38');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(220,230,255,${0.3 + r() * 0.7})`; const s = r() < 0.08 ? 2.5 : 1.2; g.fillRect(r() * W, r() * H * 0.85, s, s); }
    // moon
    const mx = 330, my = 200, mg = g.createRadialGradient(mx, my, 10, mx, my, 120);
    mg.addColorStop(0, 'rgba(200,215,255,.35)'); mg.addColorStop(1, 'rgba(200,215,255,0)'); g.fillStyle = mg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#eef2ff'; g.beginPath(); g.arc(mx, my, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(150,160,190,.35)'; for (const [dx, dy, rr] of [[-12, -8, 10], [14, 10, 7], [4, -20, 5]]) { g.beginPath(); g.arc(mx + dx, my + dy, rr, 0, 7); g.fill(); }
    return c;
  }

  // ---------- tower shell ----------
  const R = 4.3, WT = 0.45, H = 3.7, PL = 0.55;          // inner radius, wall thickness, height, plinth
  const camTh = Math.atan2(8.2, 9.3), TC = camTh + Math.PI; // TC: the wall straight across from the camera
  const A0 = TC - 1.5, A1 = TC + 1.5;                     // arc of standing wall
  const WIN = TC + 0.19, WHW = 0.12, SILL = 1.15, WTOP = 2.85; // window: centre angle, half-width (rad), sill, top

  const stone = stoneCanvas(3, 36);
  function stoneMat(arcLen, h, offU = 0) {
    const map = texOf(stone.map), bump = texOf(stone.bump, false);
    for (const t of [map, bump]) { t.repeat.set(arcLen / 2.2, h / 1.6); t.offset.set(offU / 2.2, 0); }
    return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 3, roughness: 0.95, shadowSide: THREE.DoubleSide });
  }
  function wallPiece(t0, t1, y0, y1) {
    const h = y1 - y0, len = t1 - t0;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R, R, h, Math.max(4, Math.ceil(len * 24)), 1, true, t0, len),
      stoneMat(len * R, h, t0 * R)); inner.material.side = THREE.BackSide;
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(R + WT, R + WT, h, Math.max(4, Math.ceil(len * 24)), 1, true, t0, len),
      stoneMat(len * (R + WT), h, t0 * (R + WT)));
    for (const m of [inner, outer]) { m.position.y = y0 + h / 2; add(m); }
  }
  wallPiece(A0, WIN - WHW, 0, H);
  wallPiece(WIN + WHW, A1, 0, H);
  wallPiece(WIN - WHW, WIN + WHW, 0, SILL);
  wallPiece(WIN - WHW, WIN + WHW, WTOP, H);
  // wall top + the two cut ends, in a lighter dressed stone
  const capStone = std('#4a4038', 0.9);
  {
    const ring = new THREE.Mesh(new THREE.RingGeometry(R, R + WT, 64, 1, A0 - Math.PI / 2, A1 - A0), capStone);
    ring.rotation.x = -Math.PI / 2; ring.position.y = H; add(ring);
    for (const t of [A0, A1]) {
      const [x, z] = P(t, R + WT / 2);
      const end = mesh(new THREE.BoxGeometry(WT, H, 0.02), capStone, x, H / 2, z); end.rotation.y = t + Math.PI / 2;
    }
  }
  // window reveals, sill, mullion + transom (they cast the long cross shadow)
  {
    const reveal = std('#3a332d', 0.95);
    for (const s of [-1, 1]) {
      const t = WIN + s * WHW, [x, z] = P(t, R + WT / 2);
      const b = mesh(new THREE.BoxGeometry(0.03, WTOP - SILL, WT), reveal, x, (SILL + WTOP) / 2, z); b.rotation.y = t;
    }
    const [sx, sz] = P(WIN, R + WT / 2 - 0.04);
    const sill = mesh(new THREE.BoxGeometry(WHW * 2 * R + 0.1, 0.06, WT + 0.12), reveal, sx, SILL, sz); sill.rotation.y = WIN;
    const lintel = mesh(new THREE.BoxGeometry(WHW * 2 * R, 0.05, WT), reveal, sx, WTOP, sz); lintel.rotation.y = WIN;
    const iron = std('#15130f', 0.5, { metalness: 0.6 });
    const [mx, mz] = P(WIN, R + 0.12);
    mesh(new THREE.BoxGeometry(0.035, WTOP - SILL, 0.035), iron, mx, (SILL + WTOP) / 2, mz).rotation.y = WIN;
    for (const y of [1.65, 2.2]) mesh(new THREE.BoxGeometry(WHW * 2 * R, 0.03, 0.03), iron, mx, y, mz).rotation.y = WIN;
    // night sky beyond the window
    const [kx, kz] = P(WIN, R + WT + 0.5);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.4), new THREE.MeshBasicMaterial({ map: texOf(skyCanvas()), toneMapped: false }));
    sky.position.set(kx, 2.0, kz); sky.lookAt(0, 2.0, 0); scene.add(sky);
  }
  // floor + plinth
  {
    const ft = texOf(flagstoneCanvas()); ft.repeat.set(3.4, 3.4);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R + WT, 96), std('#ffffff', 0.9, { map: ft }));
    floor.rotation.x = -Math.PI / 2; add(floor, scene, false);
    const st = texOf(stone.map); st.repeat.set(13, 0.35);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(R + WT + 0.02, R + WT + 0.14, PL, 96, 1, false), [std('#fff', 0.95, { map: st }), std('#2a2420'), std('#2a2420')]);
    plinth.position.y = -PL / 2 - 0.001; add(plinth, scene, false);
  }

  // ---------- rug with a faint magic circle ----------
  {
    const c = cv(1024, 1024), g = c.getContext('2d');
    g.fillStyle = '#3a0f14'; g.beginPath(); g.arc(512, 512, 510, 0, 7); g.fill();
    g.strokeStyle = '#b8892f'; g.lineWidth = 10; g.beginPath(); g.arc(512, 512, 470, 0, 7); g.stroke();
    g.lineWidth = 4; g.beginPath(); g.arc(512, 512, 430, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(184,137,47,.8)'; g.lineWidth = 5; g.beginPath();
    for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * (Math.PI * 4 / 5); const x = 512 + Math.cos(a) * 400, y = 512 + Math.sin(a) * 400; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.font = '42px serif'; g.fillStyle = '#c99a3a'; g.textAlign = 'center';
    'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'.split('').forEach((ch, i) => { const a = (i / 12) * Math.PI * 2; g.save(); g.translate(512 + Math.cos(a) * 450, 512 + Math.sin(a) * 450); g.rotate(a + Math.PI / 2); g.fillText(ch, 0, 14); g.restore(); });
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), std('#ffffff', 1, { map: texOf(c), emissive: '#ffffff', emissiveMap: texOf(c), emissiveIntensity: 0.035 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, 0); add(rug, scene, false);
  }

  // ---------- furniture ----------
  const darkWood = std('#ffffff', 0.7, { map: texOf(woodCanvas(22, 17)) });
  const oak = std('#ffffff', 0.65, { map: texOf(woodCanvas(28, 26)) });
  const brass = new THREE.MeshStandardMaterial({ color: '#b08a3e', roughness: 0.35, metalness: 1 });
  const iron = new THREE.MeshStandardMaterial({ color: '#1c1a18', roughness: 0.55, metalness: 0.7 });

  // A group standing against the wall at angle th; local -z faces the room centre.
  function againstWall(th, depth) {
    const g = new THREE.Group(); const [x, z] = P(th, R - depth / 2 - 0.04);
    g.position.set(x, 0, z); g.rotation.y = th; scene.add(g); return g;
  }
  const at = (th, r, face = th) => { const [x, z] = P(th, r); return { x, z, face }; };
  const lights = [];
  const glass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, transmission: 1, thickness: 0.04, ior: 1.45, transparent: true, opacity: 0.35, specularIntensity: 1, envMapIntensity: 4 });
  const flaskPts = (s) => [[0, 0], [0.5, 0.05], [0.85, 0.25], [1, 0.55], [0.85, 0.85], [0.45, 1.05], [0.28, 1.2], [0.26, 1.7], [0.32, 1.75]].map(([x, y]) => new THREE.Vector2(x * s, y * s));
  const liquidPts = (s, fill) => [[0, 0.02], [0.48, 0.07], [0.8, 0.26], [0.94, 0.55]].filter(([, y]) => y <= fill + 0.01).concat([[0, 0]]).map(([x, y]) => new THREE.Vector2(x * s * 0.95, y * s));
  // a glass vessel of something glowing; `light` adds a small coloured light (used sparingly)
  function potion(parent, kind, x, y, z, s, hex, light = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    if (kind === 'bowl') {
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(s, 40, 20, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.68), glass); bowl.position.y = s; g.add(bowl);
      const liq = new THREE.Mesh(new THREE.SphereGeometry(s * 0.93, 40, 16, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), glowMat(hex, 1.5)); liq.position.y = s; g.add(liq);
      const top = new THREE.Mesh(new THREE.CircleGeometry(s * 0.93 * Math.sin(Math.PI * 0.55), 40), glowMat(hex, 3.2));
      top.rotation.x = -Math.PI / 2; top.position.y = s + s * 0.93 * Math.cos(Math.PI * 0.55); g.add(top);
    } else {
      g.add(new THREE.Mesh(new THREE.LatheGeometry(flaskPts(s), 32), glass));
      g.add(new THREE.Mesh(new THREE.LatheGeometry(liquidPts(s, 0.55), 32), glowMat(hex, 2.2)));
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.27, s * 0.24, s * 0.25, 12), std('#7a5a3a')); cork.position.y = s * 1.82; g.add(cork);
    }
    if (light) { const L = new THREE.PointLight(hex, light, 1.8, 2); L.position.set(0, s * 1.3, -0.05); g.add(L); lights.push({ L, base: light, ph: Math.random() * 10, speed: 1.2 + Math.random() }); }
  }
  const flames = [];
  function candle(parent, x, y, z, h = 0.18, r = 0.025, opts = {}) {
    mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 16), std('#efe3c4', 0.6, { emissive: '#ff9a4a', emissiveIntensity: 0.08 }), x, y + h / 2, z, parent);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), glowMat('#ffb050', 3.5)); f.scale.set(1, 2.4, 1); f.position.set(x, y + h + 0.03, z); parent.add(f);
    let L = null;
    if (opts.light !== false) {
      L = new THREE.PointLight('#ff9a3c', opts.power ?? 0.55, 2.8, 2); L.position.set(x, y + h + 0.06, z); parent.add(L);
      if (opts.shadow) { L.castShadow = true; L.shadow.mapSize.set(512, 512); L.shadow.radius = 3; L.shadow.bias = -0.003; }
    }
    flames.push({ f, L, base: L?.intensity ?? 0, ph: Math.random() * 10 });
  }
  const book = (parent, x, y, z, rot = 0, col = '#e6d8b8') => {
    const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = rot; parent.add(b);
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(0.18, 0.025, 0.26), std(col, 0.9), s * 0.095, 0.02, 0, b).rotation.z = -s * 0.08;
    mesh(new THREE.BoxGeometry(0.4, 0.02, 0.3), std('#4a1f1f', 0.8), 0, 0.005, 0, b);
  };
  const stoolAt = (x, z) => {
    const st = new THREE.Group(); st.position.set(x, 0, z); scene.add(st);
    mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), darkWood, 0, 0.43, 0, st);
    for (let i = 0; i < 3; i++) { const a = i * 2.09; const l = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.42, 8), darkWood, Math.sin(a) * 0.13, 0.2, Math.cos(a) * 0.13, st); l.rotation.set(Math.cos(a) * 0.15, 0, -Math.sin(a) * 0.15); }
  };
  // standing poses
  const arms = (sh, el, extra) => (ag) => { ag.stand(); for (const j of ag.rig.sh) j.rotation.x = sh; for (const j of ag.rig.el) j.rotation.x = el; extra?.(ag); };

  // ---------- eight stations round the wall (1 is the lead's) ----------
  const STATIONS = [];
  const D = [-0.19, -0.57, 0.57, -0.95, 0.19, 0.95, -1.33, 1.33];   // offsets from the back wall, in place order
  // 1: the archmage's writing desk
  {
    const th = TC + D[0], G = againstWall(th, 0.8);
    mesh(new THREE.BoxGeometry(1.4, 0.07, 0.8), oak, 0, 0.76, 0, G);
    for (const [x, z] of [[-0.64, -0.33], [0.64, -0.33], [-0.64, 0.33], [0.64, 0.33]]) mesh(new THREE.BoxGeometry(0.08, 0.72, 0.08), darkWood, x, 0.36, z, G);
    book(G, 0, 0.8, -0.1, 0.1);
    mesh(new THREE.CylinderGeometry(0.004, 0.002, 0.24, 6), std('#e8e2d0', 0.8), 0.32, 0.9, -0.05, G).rotation.z = 0.6;   // quill
    mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.05, 12), std('#1a1a1a', 0.4), 0.38, 0.82, 0.05, G);                   // ink
    for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.26, 0.05, 0.34), std(['#5a1e1e', '#2a2f55', '#1f3a2a', '#6b4a22'][i], 0.8), -0.52, 0.825 + i * 0.05, 0.12, G).rotation.y = i * 0.15;
    candle(G, 0.55, 0.795, 0.2, 0.16, 0.025, { shadow: true });
    // high-backed chair
    const s = at(th, R - 0.8 - 0.75);
    const C = new THREE.Group(); C.position.set(s.x, 0, s.z); C.rotation.y = th; scene.add(C);
    mesh(new THREE.BoxGeometry(0.56, 0.08, 0.52), darkWood, 0, 0.42, -0.02, C);
    for (const [x, z] of [[-0.24, -0.22], [0.24, -0.22], [-0.24, 0.2], [0.24, 0.2]]) mesh(new THREE.BoxGeometry(0.05, 0.42, 0.05), darkWood, x, 0.21, z, C);
    mesh(new THREE.BoxGeometry(0.56, 1.1, 0.06), darkWood, 0, 0.98, -0.27, C);
    STATIONS[0] = { ...s, pose: (ag) => { ag.sit(0.46, true); } };
  }
  // 2: the alchemy bench with the glowing concoctions
  {
    const th = TC + D[1], B = againstWall(th, 0.7), BH = 0.9;
    mesh(new THREE.BoxGeometry(1.5, 0.07, 0.7), oak, 0, BH - 0.035, 0, B);
    for (const [x, z] of [[-0.68, -0.3], [0.68, -0.3], [-0.68, 0.3], [0.68, 0.3]]) mesh(new THREE.BoxGeometry(0.08, BH - 0.07, 0.08), darkWood, x, (BH - 0.07) / 2, z, B);
    mesh(new THREE.BoxGeometry(1.4, 0.04, 0.6), darkWood, 0, 0.18, 0, B);
    mesh(new THREE.BoxGeometry(1.4, 0.05, 0.26), darkWood, 0, 1.72, 0.2, B);
    for (const x of [-0.6, 0.6]) mesh(new THREE.BoxGeometry(0.04, 0.2, 0.2), iron, x, 1.62, 0.22, B);
    potion(B, 'bowl', -0.4, BH, -0.08, 0.13, '#39ff88', 0.9);
    potion(B, 'flask', -0.05, BH, 0.08, 0.12, '#b14dff', 0.7);
    potion(B, 'bowl', 0.25, BH, -0.12, 0.09, '#29d6ff');
    potion(B, 'flask', 0.5, BH, 0.12, 0.09, '#ff6a2a', 0.6);
    potion(B, 'flask', -0.45, 1.745, 0.2, 0.07, '#29d6ff');
    potion(B, 'flask', -0.15, 1.745, 0.22, 0.06, '#39ff88');
    potion(B, 'flask', 0.35, 1.745, 0.22, 0.075, '#ff3d8a');
    mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.07, 20), std('#6e6a64', 0.8), 0.62, BH + 0.035, -0.15, B);
    STATIONS[1] = { ...at(th, R - 1.2), pose: arms(-0.75, -0.55) };
  }
  // 3: the cauldron over embers
  const bubbles = [];
  {
    const th = TC + D[2], [x, z] = P(th, R - 1.25);
    const C = new THREE.Group(); C.position.set(x, 0, z); scene.add(C);
    mesh(new THREE.SphereGeometry(0.36, 40, 24, 0, Math.PI * 2, Math.PI * 0.18, Math.PI * 0.82), new THREE.MeshStandardMaterial({ color: '#141312', roughness: 0.45, metalness: 0.8, side: THREE.DoubleSide }), 0, 0.5, 0, C);
    const rim = mesh(new THREE.TorusGeometry(0.2, 0.03, 12, 40), iron, 0, 0.5 + 0.36 * Math.cos(Math.PI * 0.18), 0, C); rim.rotation.x = Math.PI / 2;
    const brew = new THREE.Mesh(new THREE.CircleGeometry(0.2, 40), glowMat('#3dff6a', 2.4));
    brew.rotation.x = -Math.PI / 2; brew.position.y = 0.5 + 0.36 * Math.cos(Math.PI * 0.18) - 0.04; C.add(brew);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const l = mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.3, 8), iron, Math.sin(a) * 0.26, 0.15, Math.cos(a) * 0.26, C); l.rotation.set(Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.2); }
    for (let i = 0; i < 4; i++) { const log = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.36, 8), std('#2a1a10', 0.9, { emissive: '#ff4a10', emissiveIntensity: 0.6 }), 0, 0.04, 0, C); log.rotation.set(Math.PI / 2, i * 0.8, 0); }
    const green = new THREE.PointLight('#3dff6a', 1.6, 3.0, 2); green.position.set(0, 1.0, 0); C.add(green);
    const fire = new THREE.PointLight('#ff6a1a', 1.4, 1.6, 2); fire.position.set(0, 0.15, 0); C.add(fire);
    lights.push({ L: green, base: 1.6, ph: 1, speed: 2 }, { L: fire, base: 1.4, ph: 3, speed: 7 });
    const bm = glowMat('#7dffa0', 1.6);
    for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.018 + Math.random() * 0.02, 10, 8), bm); C.add(b); bubbles.push({ b, t: Math.random(), y0: brew.position.y, a: Math.random() * 6, r: Math.random() * 0.14 }); }
    STATIONS[2] = { ...at(th, R - 1.9), pose: arms(-0.2, -0.15, (ag) => { ag.rig.sh[1].rotation.x = -1.0; ag.rig.el[1].rotation.x = -0.6; }) };
  }
  // 4: the bookshelf, reading a tome
  const tomes = [];
  {
    const th = TC + D[3], SH = againstWall(th, 0.42), W = 1.15, Hh = 2.5;
    for (const x of [-W / 2, W / 2]) mesh(new THREE.BoxGeometry(0.05, Hh, 0.4), darkWood, x, Hh / 2, 0, SH);
    mesh(new THREE.BoxGeometry(W + 0.05, 0.05, 0.42), darkWood, 0, Hh, 0, SH);
    mesh(new THREE.BoxGeometry(W, Hh, 0.02), darkWood, 0, Hh / 2, 0.19, SH);
    const r = rng(21), cols = ['#5a1e1e', '#1f3a2a', '#2a2f55', '#6b4a22', '#3a2a1a', '#4a1f3d', '#203c46'];
    for (let k = 0; k < 5; k++) {
      const y = 0.08 + k * 0.49;
      mesh(new THREE.BoxGeometry(W, 0.03, 0.38), darkWood, 0, y, 0, SH);
      let x = -W / 2 + 0.04;
      while (x < W / 2 - 0.08) {
        const w = 0.03 + r() * 0.045, h = 0.24 + r() * 0.14, lean = r() < 0.08 ? 0.25 : 0;
        const b = mesh(new THREE.BoxGeometry(w, h, 0.26 + r() * 0.06), std(cols[(r() * cols.length) | 0], 0.75), x + w / 2, y + 0.015 + h / 2, 0.02, SH);
        b.rotation.z = lean; x += w + 0.004 + lean * 0.1; if (r() < 0.06) x += 0.12;
      }
    }
    const tome = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.32), std('#5a1e1e', 0.7)); tome.position.set(0, -0.3, 0.06); tome.rotation.x = -0.9; tome.visible = false;
    tomes[3] = tome;
    STATIONS[3] = { ...at(th, R - 1.1, th + 0.3), pose: arms(-0.9, -0.9, (ag) => { ag.rig.head.rotation.x = 0.35; ag.rig.wr[0].add(tome); tome.visible = true; }) };
  }
  // 5: the telescope at the window, from a stool
  {
    const [x, z] = P(WIN + 0.09, R - 0.75);
    const T = new THREE.Group(); T.position.set(x, 0, z); scene.add(T);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3, leg = mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.25, 8), darkWood, Math.sin(a) * 0.22, 0.6, Math.cos(a) * 0.22, T);
      leg.rotation.set(Math.cos(a) * 0.32, 0, -Math.sin(a) * 0.32);
    }
    const tube = new THREE.Group(); tube.position.y = 1.22; T.add(tube);
    const dir = new THREE.Vector3(...[P(WIN, 1)].flatMap(([a, b]) => [a, 0.55, b])).normalize();
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.95, 24), brass, 0, 0.15, 0, tube);
    mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.05, 24), brass, 0, 0.62, 0, tube);
    const s = at(WIN - 0.04, R - 1.35), st = at(WIN - 0.04, R - 1.85);
    stoolAt(s.x, s.z);
    STATIONS[4] = { ...s, stand: [st.x, st.z], pose: (ag) => { ag.sit(0.46, false); ag.rig.sh[1].rotation.x = -1.3; ag.rig.el[1].rotation.x = -0.3; ag.rig.head.rotation.x = -0.25; } };
  }
  // 6: the scrying orb on a pedestal
  const orbs = [];
  {
    const th = TC + D[5], [x, z] = P(th, R - 1.25);
    const O = new THREE.Group(); O.position.set(x, 0, z); scene.add(O);
    mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.12, 24), std('#3a332d', 0.9), 0, 0.06, 0, O);
    mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.85, 16), std('#3a332d', 0.9), 0, 0.55, 0, O);
    mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.08, 24), brass, 0, 1.0, 0, O);
    const orbMat = new THREE.MeshPhysicalMaterial({ color: '#bfe6ff', roughness: 0.05, transmission: 0.5, thickness: 0.3, emissive: '#2fa8ff', emissiveIntensity: 0.6 });
    mesh(new THREE.SphereGeometry(0.15, 32, 20), orbMat, 0, 1.17, 0, O);
    orbs.push(orbMat);
    STATIONS[5] = { ...at(th, R - 1.9), pose: arms(-1.15, -0.45) };
  }
  // 7: the map table, leaning over a chart
  {
    const th = TC + D[6], [x, z] = P(th, R - 1.05);
    const M = new THREE.Group(); M.position.set(x, 0, z); M.rotation.y = th; scene.add(M);
    mesh(new THREE.BoxGeometry(1.1, 0.06, 0.75), oak, 0, 0.84, 0, M);
    for (const [lx, lz] of [[-0.48, -0.3], [0.48, -0.3], [-0.48, 0.3], [0.48, 0.3]]) mesh(new THREE.BoxGeometry(0.07, 0.81, 0.07), darkWood, lx, 0.405, lz, M);
    const c = cv(512, 352), g = c.getContext('2d'), r = rng(44);
    g.fillStyle = '#d9c79e'; g.fillRect(0, 0, 512, 352);
    g.strokeStyle = 'rgba(90,60,30,.6)'; g.lineWidth = 3;
    for (let i = 0; i < 5; i++) { g.beginPath(); let px = r() * 512, py = r() * 352; g.moveTo(px, py); for (let k = 0; k < 8; k++) { px += (r() - 0.5) * 120; py += (r() - 0.5) * 90; g.lineTo(px, py); } g.stroke(); }
    g.fillStyle = 'rgba(122,30,30,.8)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(r() * 512, r() * 352, 6, 0, 7); g.fill(); }
    const map = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.62), std('#ffffff', 0.9, { map: texOf(c) })); map.rotation.x = -Math.PI / 2; map.position.set(0, 0.874, 0); M.add(map);
    candle(M, -0.45, 0.87, 0.25, 0.1, 0.02, { light: false });
    STATIONS[6] = { ...at(th, R - 1.75), pose: arms(-0.85, -0.5, (ag) => { ag.rig.spine.rotation.x = 0.28; ag.rig.head.rotation.x = 0.3; }) };
  }
  // 8: the apothecary rack, reaching for a jar
  {
    const th = TC + D[7], A = againstWall(th, 0.4), W = 1.2, Hh = 2.2;
    mesh(new THREE.BoxGeometry(W, Hh, 0.38), darkWood, 0, Hh / 2, 0.02, A);
    const r = rng(9), cols = ['#39ff88', '#b14dff', '#29d6ff', '#ffb34a'];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      mesh(new THREE.BoxGeometry(0.26, 0.2, 0.02), std('#4a3220', 0.8), -0.42 + col * 0.28, 0.25 + row * 0.24, -0.18, A);
      mesh(new THREE.SphereGeometry(0.015, 8, 6), brass, -0.42 + col * 0.28, 0.25 + row * 0.24 + 0.1, -0.2, A);
    }
    for (let k = 0; k < 7; k++) { const jx = -0.5 + k * 0.17, jh = 0.12 + r() * 0.08; mesh(new THREE.CylinderGeometry(0.05, 0.05, jh, 16), glass, jx, 1.0 + jh / 2, -0.12, A); mesh(new THREE.CylinderGeometry(0.044, 0.044, jh * 0.6, 16), glowMat(cols[k % 4], 0.9), jx, 1.0 + jh * 0.3, -0.12, A); }
    for (let k = 0; k < 5; k++) { const jx = -0.45 + k * 0.22; mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 16), std(['#6b4a22', '#3a2a1a', '#8a6a3a'][k % 3], 0.6), jx, 1.62, -0.12, A); }
    mesh(new THREE.BoxGeometry(W, 0.03, 0.3), darkWood, 0, 1.0, -0.1, A);
    mesh(new THREE.BoxGeometry(W, 0.03, 0.3), darkWood, 0, 1.54, -0.1, A);
    STATIONS[7] = { ...at(th, R - 1.05), pose: arms(-0.2, -0.15, (ag) => { ag.rig.sh[1].rotation.x = -2.3; ag.rig.el[1].rotation.x = -0.2; ag.rig.head.rotation.x = -0.25; }) };
  }
  // candles: a tall iron stand and a cluster on the floor
  {
    const [x, z] = P(TC - 0.38, R - 0.45);
    const S = new THREE.Group(); S.position.set(x, 0, z); scene.add(S);
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.35, 10), iron, 0, 0.68, 0, S);
    mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.03, 20), iron, 0, 0.015, 0, S);
    mesh(new THREE.CylinderGeometry(0.12, 0.06, 0.03, 20), iron, 0, 1.36, 0, S);
    candle(S, 0, 1.375, 0, 0.22, 0.03);
    const [fx, fz] = P(TC + 0.38, R - 0.35);
    const F = new THREE.Group(); F.position.set(fx, 0, fz); scene.add(F);
    candle(F, 0, 0, 0, 0.3, 0.035, { power: 0.8 }); candle(F, 0.1, 0, 0.07, 0.2, 0.03, { light: false }); candle(F, -0.06, 0, 0.1, 0.12, 0.028, { light: false });
  }
  // each station glows with a rune circle in its agent's colour while in use
  const RUNES = STATIONS.map((s, i) => {
    const c = cv(256, 256), g = c.getContext('2d');
    g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.arc(128, 128, 100, 0, 7); g.stroke();
    g.font = '22px serif'; g.fillStyle = '#fff'; g.textAlign = 'center';
    'ᚠᚢᚦᚨᚱᚲᚷᚹ'.split('').forEach((ch, k) => { const a = (k / 8) * Math.PI * 2; g.save(); g.translate(128 + Math.cos(a) * 109, 128 + Math.sin(a) * 109); g.rotate(a + Math.PI / 2); g.fillText(ch, 0, 8); g.restore(); });
    const mat = new THREE.MeshBasicMaterial({ map: texOf(c), color: new THREE.Color(slotColors[i] ?? '#8a6bff').multiplyScalar(1.6), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), mat); m.rotation.x = -Math.PI / 2; m.position.set(s.x, 0.012, s.z); scene.add(m);
    return mat;
  });

  // ---------- lounge: eight chairs round the crystal ball ----------
  const LOUNGE = (() => { const [x, z] = P(camTh, 1.7); return { x, z }; })();
  const SEATS = [];
  {
    const T = new THREE.Group(); T.position.set(LOUNGE.x, 0, LOUNGE.z); scene.add(T);
    mesh(new THREE.CylinderGeometry(0.55, 0.48, 0.06, 40), darkWood, 0, 0.5, 0, T);
    mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.48, 12), darkWood, 0, 0.24, 0, T);
    mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.04, 16), brass, 0, 0.55, 0, T);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 32, 20), new THREE.MeshPhysicalMaterial({ color: '#c9b8ff', roughness: 0.05, transmission: 0.6, thickness: 0.2, emissive: '#6a3dff', emissiveIntensity: 1.6 }));
    orb.position.y = 0.68; T.add(orb);
    const orbL = new THREE.PointLight('#8a6bff', 1.1, 3.0, 2); orbL.position.y = 0.85; T.add(orbL);
    lights.push({ L: orbL, base: 1.1, ph: 5, speed: 0.8 });
    const cushion = std('#4a1f2a', 0.95);
    for (let i = 0; i < 8; i++) {
      const a = camTh + Math.PI / 8 + (i * Math.PI) / 4;  // offset so no chair sits square in front of you
      const x = LOUNGE.x + Math.sin(a) * 1.05, z = LOUNGE.z + Math.cos(a) * 1.05, face = a + Math.PI;
      const C = new THREE.Group(); C.position.set(x, 0, z); C.rotation.y = face; scene.add(C);
      mesh(new THREE.BoxGeometry(0.5, 0.1, 0.48), cushion, 0, 0.41, -0.02, C);
      mesh(new THREE.BoxGeometry(0.54, 0.06, 0.52), darkWood, 0, 0.34, -0.02, C);
      for (const [lx, lz] of [[-0.23, -0.21], [0.23, -0.21], [-0.23, 0.19], [0.23, 0.19]]) mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), darkWood, lx, 0.17, lz, C);
      mesh(new THREE.BoxGeometry(0.54, 0.4, 0.07), darkWood, 0, 0.6, -0.27, C).rotation.x = -0.1;
      SEATS.push({ x, z, face, stand: [LOUNGE.x + Math.sin(a) * 1.55, LOUNGE.z + Math.cos(a) * 1.55] });
    }
  }
  // seat order: give the lead the chair facing you, then round the table
  const seatOrder = [4, 3, 5, 2, 6, 1, 7, 0];

  // ---------- light ----------
  // moonlight through the window: low, cold, long hard-edged shadows
  const [mxL, mzL] = P(WIN, R + 2.6);
  const moon = new THREE.SpotLight('#9db8ff', 60, 14, 0.3, 0.3, 1.2);
  moon.position.set(mxL, 3.9, mzL);
  const [tx, tz] = P(WIN, -0.5); moon.target.position.set(tx, 0, tz);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.radius = 2; moon.shadow.bias = -0.0004; moon.shadow.camera.near = 0.5;
  scene.add(moon, moon.target);
  // visible light shaft + dust motes
  {
    const top = new THREE.Vector3(...[P(WIN, R)].flatMap(([a, b]) => [a, (SILL + WTOP) / 2, b]));
    const hit = moon.position.clone().lerp(top, 1 + top.y / (moon.position.y - top.y));
    const len = top.distanceTo(hit);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, len, 4, 1, true), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { c: { value: new THREE.Color('#7f9cff') } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      // pow(0,x) is NaN on some Windows GPUs and bloom smears NaN into a black block, so keep inputs > 0
      fragmentShader: 'uniform vec3 c; varying vec2 vUv; void main(){ float y = clamp(vUv.y, 0.001, 1.); float e = max(sin(fract(vUv.x*4.)*3.14159), 0.); gl_FragColor = vec4(c * 0.07 * y * sqrt(y) * e, 1.); }',
    }));
    beam.position.copy(top).lerp(hit, 0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(hit).normalize());
    beam.rotation.y += 0; scene.add(beam);
    const N = 140, pos = new Float32Array(N * 3), seeds = [];
    for (let i = 0; i < N; i++) { const t = Math.random(); seeds.push([t, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, Math.random() * 6]); }
    const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ color: new THREE.Color('#cfdcff').multiplyScalar(1.4), size: 0.008, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    scene.add(dust);
    dustState = { dust, seeds, top, hit };
  }
  scene.add(new THREE.HemisphereLight('#6a7fb8', '#1a120c', 0.2));
  // two torches on the wall light the bigger room
  for (const d of [-1.14, 1.14]) {
    const th = TC + d, [x, z] = P(th, R - 0.12);
    const T = new THREE.Group(); T.position.set(x, 2.15, z); T.rotation.y = th; scene.add(T);
    mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), iron, 0, 0, 0, T);
    const arm = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8), iron, 0, 0.08, -0.15, T); arm.rotation.x = 0.6;
    mesh(new THREE.CylinderGeometry(0.06, 0.035, 0.12, 12), iron, 0, 0.26, -0.27, T);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), glowMat('#ffa040', 3)); f.scale.set(1, 1.8, 1); f.position.set(0, 0.38, -0.27); T.add(f);
    const L = new THREE.PointLight('#ff9a3c', 2.2, 7, 1.7); L.position.set(0, 0.42, -0.4); T.add(L);
    flames.push({ f, L, base: 2.2, ph: Math.random() * 10 });
  }
  const rim = new THREE.DirectionalLight('#8aa0e0', 0.12); rim.position.set(-4, 8, -6); scene.add(rim);

  // ---------- places + walkways ----------
  const slots = STATIONS.map((st, i) => ({
    station: st,
    lounge: { ...SEATS[seatOrder[i]], pose: (ag) => { if (tomes[i]) tomes[i].visible = false; ag.sit(0.46, false); } },
  }));
  // a path round the inside of the wall, a loop round the lounge, and two links between them
  const ring = []; for (let d = -1.42; d <= 1.4201; d += 0.142) ring.push(P(TC + d, R - 2.15));
  const loop = []; for (let k = 0; k <= 16; k++) { const a = camTh + (k / 16) * Math.PI * 2; loop.push([LOUNGE.x + Math.sin(a) * 1.55, LOUNGE.z + Math.cos(a) * 1.55]); }
  const nearestOnLoop = (p) => loop.reduce((b, q) => (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.hypot(b[0] - p[0], b[1] - p[1]) ? q : b));
  const walkway = [ring, loop, [ring[0], nearestOnLoop(ring[0])], [ring[ring.length - 1], nearestOnLoop(ring[ring.length - 1])], [ring[10], nearestOnLoop(ring[10])]];
  function setStation(i, state) {
    if (!RUNES[i]) return;
    RUNES[i].opacity = state === 'off' ? 0 : 0.85;
    RUNES[i].color.set(state === 'waiting' ? '#f59e0b' : state === 'error' ? '#ef4444' : slotColors[i] ?? '#8a6bff').multiplyScalar(1.6);
    if (i === 5) orbs[0].emissiveIntensity = state === 'off' ? 0.6 : 2.2;
    if (state === 'off' && tomes[i]) tomes[i].visible = false;
  }

  const noise = (t) => Math.sin(t * 1.7) * 0.5 + Math.sin(t * 3.3 + 1) * 0.3 + Math.sin(t * 7.9 + 2) * 0.2;
  function update(dt, t, lite) {
    for (const f of flames) { const n = noise(t * 2.2 + f.ph); if (f.L) f.L.intensity = f.base * (0.85 + 0.15 * n); f.f.scale.set(1, 2.4 + n * 0.4, 1); }
    for (const l of lights) l.L.intensity = l.base * (0.88 + 0.12 * noise(t * l.speed + l.ph));
    for (const b of bubbles) {
      b.t += dt * 0.5; if (b.t > 1) { b.t = 0; b.a = Math.random() * 6; b.r = Math.random() * 0.14; }
      b.b.position.set(Math.sin(b.a) * b.r, b.y0 + b.t * 0.35, Math.cos(b.a) * b.r); b.b.scale.setScalar(1 - b.t * 0.6);
    }
    const { dust, seeds, top, hit } = dustState;
    dust.visible = !lite;
    if (lite) return;
    const arr = dust.geometry.attributes.position.array;
    seeds.forEach((s, i) => {
      const k = (s[0] + t * 0.004) % 1, w = 0.55 + k * 0.3;
      arr[i * 3] = top.x + (hit.x - top.x) * k + s[1] * w + Math.sin(t * 0.3 + s[3]) * 0.03;
      arr[i * 3 + 1] = top.y + (hit.y - top.y) * k + Math.sin(t * 0.21 + s[3]) * 0.05;
      arr[i * 3 + 2] = top.z + (hit.z - top.z) * k + s[2] * w + Math.cos(t * 0.27 + s[3]) * 0.03;
    });
    dust.geometry.attributes.position.needsUpdate = true;
  }

  return {
    background: '#000000', exposure: 1.1, envIntensity: 0.03,
    bloom: { strength: 0.75, radius: 0.55, threshold: 1.0 },
    camera: { fov: 30, position: [10.1, 7.6, 11.4], target: [0, 0.9, -0.6], aspect: 1.5, minPolar: 0.5, maxPolar: 1.35, minAz: camTh - 0.95, maxAz: camTh + 0.95, minDist: 8, maxDist: 28 },
    slots, walkway, setStation, update,
    tagHeight: 2.05,
  };
}
