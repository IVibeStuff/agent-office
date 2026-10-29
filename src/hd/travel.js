// How an HD agent gets from where they relax to where they work (and back).
// Modes: 'walk' (follow a path), 'beam' (sci-fi teleport shimmer),
// 'portal' (snap fingers, sink into a swirling portal, rise out of another),
// 'instant' (stand up, a beat, then appear at the other spot).
import * as THREE from 'three';

const cv = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });

// ---------- effects ----------
function beamFX(color) {
  const g = new THREE.Group(); g.visible = false;
  const c = cv(64, 256), x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.2, 'rgba(255,255,255,.55)'); gr.addColorStop(0.85, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,.2)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 256);
  const col = new THREE.Color(color).lerp(new THREE.Color('#bfe6ff'), 0.5);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 2.1, 32, 1, true), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.4), map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  tube.position.y = 1.05; g.add(tube);
  const pad = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.46, 48), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = 0.015; g.add(pad);
  const N = 90, pos = new Float32Array(N * 3), seed = [];
  for (let i = 0; i < N; i++) seed.push([Math.random() * Math.PI * 2, 0.08 + Math.random() * 0.32, Math.random() * 1.9, 0.6 + Math.random()]);
  const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
    new THREE.PointsMaterial({ color: col.clone().multiplyScalar(2.2), size: 0.03, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  g.add(pts);
  const L = new THREE.PointLight(col, 0, 3, 2);
  let t = 0;
  return {
    group: g, light: L,
    moveTo(x, z) { g.position.set(x, 0, z); L.position.set(x, 1.1, z); },
    set(k) { g.visible = k > 0.001; tube.material.opacity = 0.55 * k; pad.material.opacity = k; pts.material.opacity = k; L.intensity = 2.5 * k; },
    update(dt) {
      t += dt;
      seed.forEach(([a, r, y, s], i) => { pos[i * 3] = Math.cos(a + t * s * 2) * r; pos[i * 3 + 1] = (y + t * s * 0.9) % 1.95 + 0.05; pos[i * 3 + 2] = Math.sin(a + t * s * 2) * r; });
      pts.geometry.attributes.position.needsUpdate = true;
      tube.material.map.offset.y = (t * 0.6) % 1; tube.material.map.wrapT = THREE.RepeatWrapping;
    },
  };
}

function portalFX(color) {
  const g = new THREE.Group(); g.visible = false;
  const S = 256, c = cv(S, S), x = c.getContext('2d');
  const col = new THREE.Color(color);
  x.translate(S / 2, S / 2);
  const bg = x.createRadialGradient(0, 0, 4, 0, 0, S / 2);
  bg.addColorStop(0, 'rgba(0,0,0,1)'); bg.addColorStop(0.55, `rgba(${col.r * 120},${col.g * 120},${col.b * 120},.9)`); bg.addColorStop(0.92, `rgba(${col.r * 255},${col.g * 255},${col.b * 255},.9)`); bg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = bg; x.beginPath(); x.arc(0, 0, S / 2, 0, 7); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 3;
  for (let arm = 0; arm < 5; arm++) { x.beginPath(); for (let k = 0; k < 60; k++) { const a = arm * 1.2566 + k * 0.09, r = 8 + k * 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  // the disc is opaque-ish dark in the middle so the agent reads as dropping through it
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.55, 64), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1, depthWrite: false, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02; g.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 8, 64), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.5), toneMapped: false }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.025; g.add(rim);
  const L = new THREE.PointLight(col, 0, 3, 2);
  let t = 0;
  return {
    group: g, light: L,
    moveTo(x, z) { g.position.set(x, 0, z); L.position.set(x, 0.4, z); },
    set(k) { g.visible = k > 0.001; g.scale.setScalar(Math.max(0.001, k)); L.intensity = 3 * k; },
    update(dt) { t += dt; disc.rotation.z = t * 2.5; },
  };
}

function sparkFX(color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.5).multiplyScalar(4), toneMapped: false, transparent: true }));
  m.visible = false;
  return { group: m, set(k) { m.visible = k > 0.001; m.scale.setScalar(0.5 + k * 1.5); m.material.opacity = k; } };
}

// ---------- the traveller ----------
const ease = (t) => t * t * (3 - 2 * t);

// Effects are made up front and their lights stay in the scene (just dark) for good:
// in three.js, adding a light or showing a new kind of material makes every shader
// in the scene recompile, which is a big stall the first time an effect plays.
export function makeFX(scene, color, kinds = []) {
  const fx = {};
  if (kinds.includes('beam')) fx.beam = beamFX(color);
  if (kinds.includes('portal')) { fx.portal = portalFX(color); fx.spark = sparkFX(color); }
  for (const [k, f] of Object.entries(fx)) { if (k !== 'spark') scene.add(f.group); if (f.light) scene.add(f.light); }
  return fx;
}

export class Traveller {
  // spot: { x, z, face, pose(ag) }   ag: Agent from character.js   fx: from makeFX (shared across look changes)
  constructor({ scene, ag, color, fx }) {
    this.scene = scene; this.ag = ag; this.color = color; this.seq = null; this.wait = 0;
    this.mats = []; ag.object.traverse((o) => { if (o.material) { o.material.userData.o0 = o.material.opacity; o.material.userData.t0 = o.material.transparent; this.mats.push(o.material); } });
    this.fx = fx ?? makeFX(scene, color, []);
    if (this.fx.spark) { ag.rig.wr[1].add(this.fx.spark.group); this.fx.spark.group.position.set(0, -0.08, 0); }
  }
  // show every effect and the see-through variant of the agent's materials, so one
  // renderer.compile() at load builds all the shaders they'll ever need
  warmup(on) {
    for (const f of Object.values(this.fx)) f.group.visible = on;
    for (const m of this.mats) { const t = on || m.userData.t0; if (t !== m.transparent) { m.transparent = t; m.needsUpdate = true; } }
  }
  get busy() { return !!this.seq; }
  place(spot) { const o = this.ag.object; o.position.set(spot.x, 0, spot.z); o.rotation.y = spot.face; spot.pose(this.ag); }
  go(spot, { mode = 'walk', path = [], onArrive } = {}) {
    if (this.seq) return false;
    const gen = { walk: this.walkSeq, beam: this.beamSeq, portal: this.portalSeq, instant: this.instantSeq }[mode] ?? this.walkSeq;
    this.seq = gen.call(this, spot, path, onArrive); this.wait = 0; return true;
  }
  update(dt) {
    this.ag.update(dt);
    for (const f of Object.values(this.fx)) f.update?.(dt);
    if (!this.seq) return;
    if (this.wait > 0) { this.wait -= dt; return; }
    const r = this.seq.next(dt);
    if (r.done) this.seq = null; else this.wait = r.value || 0;
  }
  opacity(a) { for (const m of this.mats) { const t = a < 0.999 || m.userData.t0; if (t !== m.transparent) { m.transparent = t; m.needsUpdate = true; } m.opacity = m.userData.o0 * a; } }
  *tween(sec, fn) { let t = 0; while (t < sec) { t += (yield 0) ?? 0.016; fn(ease(Math.min(1, t / sec))); } fn(1); }
  finish(spot, onArrive) { this.place(spot); onArrive?.(); }

  *walkSeq(spot, path, onArrive) {
    const o = this.ag.object; this.ag.walk();
    for (const [tx, tz] of [...path, [spot.x, spot.z]]) {
      for (;;) {
        const dt = (yield 0) ?? 0.016;
        const dx = tx - o.position.x, dz = tz - o.position.z, d = Math.hypot(dx, dz), step = 1.15 * dt;
        const want = Math.atan2(dx, dz), diff = ((want - o.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        if (d > 0.01) o.rotation.y += diff * Math.min(1, dt * 8);
        if (d <= step) { o.position.x = tx; o.position.z = tz; break; }
        o.position.x += (dx / d) * step; o.position.z += (dz / d) * step;
      }
    }
    this.finish(spot, onArrive);
  }
  *instantSeq(spot, path, onArrive) {
    this.ag.stand(); yield 1.0;
    this.ag.object.visible = false; yield 0.15;
    this.place(spot); this.ag.object.visible = true; onArrive?.();
  }
  *beamSeq(spot, path, onArrive) {
    const o = this.ag.object, fx = (this.fx.beam ??= makeFX(this.scene, this.color, ['beam']).beam);
    this.ag.stand(); yield 0.45;
    fx.moveTo(o.position.x, o.position.z);
    yield* this.tween(0.45, (k) => fx.set(k));
    yield* this.tween(1.0, (k) => { this.opacity(1 - k); o.scale.set(1 + Math.sin(k * 40) * 0.015 * (1 - k), 1, 1); });
    o.visible = false;
    yield* this.tween(0.35, (k) => fx.set(1 - k));
    this.place(spot); // materialise already in place (seated at the station)
    fx.moveTo(spot.x, spot.z); yield 0.2;
    yield* this.tween(0.35, (k) => fx.set(k));
    o.visible = true; this.opacity(0);
    yield* this.tween(1.0, (k) => { this.opacity(k); o.scale.set(1 + Math.sin(k * 40) * 0.015 * (1 - k), 1, 1); });
    this.opacity(1); o.scale.set(1, 1, 1);
    yield* this.tween(0.45, (k) => fx.set(1 - k));
    this.finish(spot, onArrive);
  }
  *portalSeq(spot, path, onArrive) {
    const o = this.ag.object, r = this.ag.rig;
    if (!this.fx.portal) { Object.assign(this.fx, makeFX(this.scene, this.color, ['portal'])); r.wr[1].add(this.fx.spark.group); }
    const pf = this.fx.portal, sp = this.fx.spark;
    this.ag.stand(); yield 0.3;
    // raise the right hand, snap
    yield* this.tween(0.3, (k) => { r.sh[1].rotation.x = -1.9 * k; r.sh[1].rotation.z = 0.1 + 0.25 * k; r.el[1].rotation.x = -0.15 - 0.55 * k; });
    yield 0.12;
    yield* this.tween(0.08, (k) => { r.wr[1].rotation.z = 0.5 * k; sp.set(k); });
    yield* this.tween(0.25, (k) => { r.wr[1].rotation.z = 0.5 * (1 - k); sp.set(1 - k); });
    // portal opens under them, they drop through
    pf.moveTo(o.position.x, o.position.z);
    yield* this.tween(0.4, (k) => pf.set(k));
    yield* this.tween(0.25, (k) => { r.sh[1].rotation.x = -1.9 * (1 - k); r.el[1].rotation.x = -0.7 * (1 - k); });
    yield* this.tween(0.6, (k) => { o.position.y = -2.0 * k * k; });
    o.visible = false;
    yield* this.tween(0.3, (k) => pf.set(1 - k));
    yield 0.25;
    // and rise out of another at the destination
    const [ax, az] = spot.stand ?? [spot.x, spot.z];
    o.position.set(ax, -2.0, az); o.rotation.y = spot.face;
    pf.moveTo(ax, az);
    yield* this.tween(0.35, (k) => pf.set(k));
    o.visible = true;
    yield* this.tween(0.6, (k) => { o.position.y = -2.0 * (1 - k) * (1 - k); });
    o.position.y = 0;
    yield* this.tween(0.35, (k) => pf.set(1 - k));
    this.finish(spot, onArrive);
  }
}

export const MODES = {
  office: [['walk', 'Walk'], ['instant', 'Instant']],
  starship: [['walk', 'Walk'], ['beam', 'Beam'], ['instant', 'Instant']],
  wizard: [['walk', 'Walk'], ['portal', 'Portal'], ['instant', 'Instant']],
};
export function loadMode(theme, fallback) { try { return localStorage.getItem('office.travel.' + theme) || fallback; } catch { return fallback; } }
export function saveMode(theme, m) { try { localStorage.setItem('office.travel.' + theme, m); } catch {} }
