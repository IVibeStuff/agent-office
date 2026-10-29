// Shared building blocks for themes. Every theme uses the same floor plan
// (src/layout.js), so these helpers take care of the parts that repeat:
// a raised lead platform, blinking light banks, signs, zone decals, the
// usage board mount and light presets.
import * as THREE from 'three';
import * as L from '../layout.js';
import * as T from '../textures.js';
export { B, C, floorPlane, matte, accessory } from '../world.js';
import { B, C } from '../world.js';

export const glow = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...extra });
export const rgbaOf = (color) => { const c = new THREE.Color(color); return (a) => `rgba(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0},${a})`; };

// Text painted onto a transparent plane (signs, labels, neon)
export function textTexture(text, { font = '700 54px system-ui, sans-serif', color = '#fff', w = 512, h = 96, shadow = null, spacing = 0.12, size = 54 } = {}) {
  const c = T.canvas(w, h), g = c.getContext('2d');
  if (shadow) { g.shadowColor = shadow; g.shadowBlur = 18; }
  g.font = font; g.fillStyle = color; g.textBaseline = 'middle';
  const chars = text.split('');
  const widths = chars.map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * size * (chars.length - 1);
  let x = (w - total) / 2;
  chars.forEach((ch, i) => { g.fillText(ch, x, h / 2); x += widths[i] + spacing * size; });
  return T.tex(c);
}
export function sign(root, text, opts, { w, h, x, y, z, rotY = 0, opacity = 1 }) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTexture(text, opts), transparent: true, toneMapped: false, opacity, depthWrite: false }));
  m.position.set(x, y, z); m.rotation.y = rotY; root.add(m);
  return m;
}

// Rectangular floor decal: tinted fill, border, optional corner brackets, label
export function zoneTexture(color, label, wU, dU, { fill = 0.08, border = 0.5, brackets = false, dashed = false, font = '700 {S}px system-ui, sans-serif', labelAlpha = 0.85, base = null, inset = 0.18 } = {}) {
  const ppu = 160, W = Math.min(2048, Math.round(wU * ppu)), H = Math.min(2048, Math.round(dU * ppu));
  const sx = W / wU, sy = H / dU;
  const c = T.canvas(W, H), g = c.getContext('2d');
  const rgba = rgbaOf(color);
  if (base) { g.fillStyle = base; g.fillRect(0, 0, W, H); }
  g.fillStyle = rgba(fill); g.fillRect(0, 0, W, H);
  const i = inset * sx;
  if (dashed) g.setLineDash([0.25 * sx, 0.2 * sx]);
  g.strokeStyle = rgba(border); g.lineWidth = 0.04 * sx;
  g.strokeRect(i, i, W - 2 * i, H - 2 * i);
  g.setLineDash([]);
  if (brackets) {
    g.strokeStyle = rgba(0.9); g.lineWidth = 0.07 * sx;
    const len = 0.6 * sx;
    for (const [x, y, dx, dy] of [[i, i, 1, 1], [W - i, i, -1, 1], [i, H - i, 1, -1], [W - i, H - i, -1, -1]]) {
      g.beginPath(); g.moveTo(x + dx * len, y); g.lineTo(x, y); g.lineTo(x, y + dy * len); g.stroke();
    }
  }
  const size = Math.round(0.4 * sy);
  g.font = font.replace('{S}', size);
  T.letter(g, label, W / 2, H - 0.55 * sy, size, rgba(labelAlpha));
  return T.tex(c);
}

// Raised platform where the lead's area is, with steps at the door gap.
export const daisHeight = (h) => (x, z) => {
  const o = L.LEAD_OFFICE;
  if (x > o.minX && x < o.maxX + 1 && z > o.minZ - 1 && z < o.maxZ) return h;
  if (x >= o.doorMinX && x <= o.doorMaxX && z >= o.maxZ && z < o.maxZ + 0.7) return h * (1 - (z - o.maxZ) / 0.7);
  return 0;
};
export function buildDais(root, nav, { h, top, edge = null, step, post, bar, barGlow = null, panel = null, railH = 0.92 }) {
  const o = L.LEAD_OFFICE, dw = o.maxX - o.minX, dd = o.maxZ - o.minZ;
  B(root, dw, h, dd, top, o.minX + dw / 2, 0, o.minZ + dd / 2);
  if (edge) {
    B(root, 0.04, 0.03, dd, edge, o.minX + 0.02, h - 0.05, o.minZ + dd / 2, { cast: false });
    B(root, dw, 0.03, 0.04, edge, o.minX + dw / 2, h - 0.05, o.maxZ - 0.02, { cast: false });
  }
  for (let i = 0; i < 3; i++) B(root, o.doorMaxX - o.doorMinX, h * (3 - i) / 3, 0.24, step, (o.doorMinX + o.doorMaxX) / 2, 0, o.maxZ + 0.12 + i * 0.22);
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, horiz = Math.abs(z1 - z0) < 0.01;
    B(root, horiz ? len : 0.07, 0.07, horiz ? 0.07 : len, bar, cx, h + railH, cz);
    if (barGlow) B(root, horiz ? len : 0.03, 0.025, horiz ? 0.03 : len, barGlow, cx, h + railH - 0.04, cz, { cast: false });
    const n = Math.max(2, Math.round(len / 1.2));
    for (let i = 0; i <= n; i++) B(root, 0.07, railH, 0.07, post, x0 + (x1 - x0) * i / n, h, z0 + (z1 - z0) * i / n);
    if (panel) B(root, horiz ? len : 0.02, railH * 0.75, horiz ? 0.02 : len, panel, cx, h + 0.1, cz, { cast: false });
  };
  rail(o.minX, o.minZ + 0.4, o.minX, o.maxZ);
  rail(o.minX, o.maxZ, o.doorMinX, o.maxZ);
  rail(o.doorMaxX, o.maxZ, o.maxX - 0.1, o.maxZ);
  nav.blockRect(o.minX - 0.02, o.minX + 0.02, o.minZ, o.maxZ, 0.3);
  nav.blockRect(o.minX, o.doorMinX, o.maxZ - 0.02, o.maxZ + 0.02, 0.3);
  nav.blockRect(o.doorMaxX, o.maxX + 1, o.maxZ - 0.02, o.maxZ + 0.02, 0.3);
}

// Banks of little lights that blink at random (racks, panels, consoles)
export function lightBanks(root, nav, updaters, banks, { body, face, colors, off, rows = 8, cols = 16, lamp = [0.07, 0.04], depth = 0.38, height = 1.9 }) {
  const dummy = new THREE.Object3D(), leds = [], mats = [];
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(lamp[0], lamp[1], 0.012), new THREE.MeshBasicMaterial({ toneMapped: false }), banks.length * rows * cols);
  let k = 0;
  for (const bk of banks) {
    const g = new THREE.Group(); g.position.set(bk.x, bk.y || 0, bk.z); g.rotation.y = bk.rot || 0; root.add(g);
    B(g, bk.w, bk.h || height, depth, body, 0, 0, 0);
    B(g, bk.w - 0.12, (bk.h || height) - 0.4, 0.01, face, 0, 0.25, depth / 2 + 0.005, { cast: false });
    g.updateMatrixWorld();
    const hh = (bk.h || height) - 0.6;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      dummy.position.set(-bk.w / 2 + 0.14 + c * ((bk.w - 0.28) / Math.max(1, cols - 1)), 0.35 + r * (hh / Math.max(1, rows - 1)), depth / 2 + 0.015);
      dummy.updateMatrix();
      inst.setMatrixAt(k++, new THREE.Matrix4().multiplyMatrices(g.matrixWorld, dummy.matrix));
      leds.push(Math.random() > 0.5);
    }
    if (!bk.noBlock) {
      const horiz = Math.abs(Math.sin(bk.rot || 0)) < 0.5;
      nav.blockBox(bk.x, bk.z, horiz ? bk.w : depth, horiz ? depth : bk.w, 0.28);
    }
  }
  const on = colors.map((c) => new THREE.Color(c)), offC = new THREE.Color(off);
  const paint = () => leds.forEach((l, i) => inst.setColorAt(i, l ? on[i % on.length] : offC));
  paint(); root.add(inst);
  let acc = 0;
  updaters.push((dt) => {
    acc += dt; if (acc < 0.12) return; acc = 0;
    for (let i = 0; i < Math.max(6, leds.length / 40); i++) { const j = (Math.random() * leds.length) | 0; leds[j] = !leds[j]; }
    paint(); inst.instanceColor.needsUpdate = true;
  });
  return mats;
}

// Usage board on the left wall
export function mountUsage(root, board, { frame = '#11161d', edge = null, tint = '#d4d8df' } = {}) {
  const u = L.USAGE_BOARD;
  B(root, 0.08, u.h + 0.14, u.w + 0.14, frame, L.LEFT_WALL_X + 0.04, u.y - u.h / 2 - 0.07, u.z, { cast: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(u.w, u.h), new THREE.MeshBasicMaterial({ map: board.texture, toneMapped: false, color: tint }));
  m.rotation.y = Math.PI / 2; m.position.set(L.LEFT_WALL_X + 0.1, u.y, u.z); root.add(m); // 2 cm clear of the frame
  if (edge) B(root, 0.03, 0.025, u.w + 0.14, edge, L.LEFT_WALL_X + 0.09, u.y + u.h / 2 + 0.07, u.z, { cast: false });
}

// Standard key light with soft shadows covering the whole floor
export function keyLight(color, intensity) {
  const key = new THREE.DirectionalLight(color, intensity);
  key.position.set(9, 16, 10); key.target.position.set(-1, 0, -1);
  key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
  const sc = key.shadow.camera; sc.left = -17; sc.right = 17; sc.top = 15; sc.bottom = -15; sc.near = 1; sc.far = 50;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  return key;
}

// Flickering flame (candles, brazier, torches)
export function flame(root, updaters, x, y, z, s = 1, color = '#ffb347') {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.035 * s, 0.11 * s, 8), glow(color));
  m.position.set(x, y + 0.055 * s, z); root.add(m);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.022 * s, 8, 6), glow('#fff3c4'));
  core.position.set(x, y + 0.03 * s, z); root.add(core);
  const ph = Math.random() * 10;
  updaters.push((dt, t) => { const f = 0.85 + Math.sin(t * 11 + ph) * 0.08 + Math.sin(t * 23 + ph * 2) * 0.06; m.scale.set(1, f, 1); m.rotation.z = Math.sin(t * 7 + ph) * 0.06; });
  return { mesh: m, core, set: (on) => { m.visible = core.visible = on; } };
}

// Map a member to a theme-specific zone name (falls back to the department)
export function relabel(member, map, empty) {
  if (!member) return empty;
  const key = `${member.role} ${member.department}`.toLowerCase();
  for (const [re, label] of map) if (re.test(key)) return label;
  return member.department;
}

// ---------- cutaway walls (for full 360° rotation) ----------
// Register an outer wall with its outward normal (pointing out of the room).
// Each frame, walls that sit between the camera and the room shrink to waist
// height; the far walls stand at full height. Decor on a wall (windows,
// screens, boards) is hidden while the wall is down.
export function createCutaway() {
  const items = [];
  return {
    add(obj, nx, nz, { low = 0.33, decor = [] } = {}) { items.push({ obj, nx, nz, low, decor, s: 1 }); return obj; },
    update(cam, dt, instant = false) {
      for (const it of items) {
        const target = it.nx * cam.x + it.nz * cam.z > 0.12 ? it.low : 1;
        it.s = instant ? target : it.s + (target - it.s) * Math.min(1, dt * 6);
        it.obj.scale.y = it.s;
        const show = it.s > 0.75;
        for (const d of it.decor) d.visible = show;
      }
    },
  };
}
