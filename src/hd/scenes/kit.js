// Shared building parts for HD rooms: textures, simple meshes and a few pieces of furniture.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function makeKit(scene, renderer) {
  const ANISO = renderer.capabilities.getMaxAnisotropy();
  const cv = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const texOf = (c, rep, srgb = true) => {
    const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = ANISO;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); }
    return t;
  };
  const rbox = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, Math.min(w, h, d) / 2.2));
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = scene, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, r = 0.01, parent = scene) => mesh(rbox(w, h, d, r), mat, x, y + h / 2, z, parent); // y = bottom
  const std = (color, roughness = 0.8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
  const metal = (color, roughness = 0.35) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.85 });
  const glow = (c, k = 1.6, extra = {}) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), toneMapped: false, ...extra });
  // a group at (x, z) turned to face `face` (local +z = facing direction)
  const group = (x, z, face = 0, parent = scene) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = face; parent.add(g); return g; };

  function woodTex(h = 28, s = 40, l = 30, rep, planks = 0) {
    const S = 1024, c = cv(S, S), g = c.getContext('2d'), r = rng(5 + h);
    g.fillStyle = `hsl(${h}, ${s}%, ${l}%)`; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 240; i++) {
      g.strokeStyle = `hsla(${h - 4 + r() * 8}, ${s}%, ${l - 10 + r() * 16}%, ${0.18 + r() * 0.2})`;
      g.lineWidth = 1 + r() * 3; g.beginPath(); const y = r() * S; g.moveTo(0, y);
      for (let x = 0; x <= S; x += 64) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 6 + (r() - 0.5) * 4);
      g.stroke();
    }
    if (planks) { g.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < S; y += S / planks) g.fillRect(0, y, S, 3); }
    return texOf(c, rep);
  }
  function stoneTex(light = 34, rep = [3, 2], rows = 8) {
    const S = 1024, c = cv(S, S), g = c.getContext('2d'), r = rng(3);
    g.fillStyle = '#16120f'; g.fillRect(0, 0, S, S);
    const rh = S / rows;
    for (let y = 0; y < rows; y++) {
      let x = -((y % 2) * 0.5 + r() * 0.3) * 180;
      while (x < S) {
        const w = 130 + r() * 120, m = 6, L = light - 8 + r() * 14, hue = 30 + r() * 12;
        g.fillStyle = `hsl(${hue}, ${8 + r() * 8}%, ${L}%)`; g.fillRect(x + m, y * rh + m, w - m * 2, rh - m * 2);
        for (let i = 0; i < 70; i++) { g.fillStyle = `hsla(${hue}, 10%, ${L + (r() - 0.5) * 18}%, .5)`; g.fillRect(x + m + r() * (w - m * 2), y * rh + m + r() * (rh - m * 2), 2 + r() * 5, 2 + r() * 5); }
        x += w;
      }
    }
    return texOf(c, rep);
  }
  function flagsTex(light = 26, rep = [3, 3]) {
    const S = 1024, c = cv(S, S), g = c.getContext('2d'), r = rng(11);
    g.fillStyle = '#0e0c0a'; g.fillRect(0, 0, S, S);
    const n = 5, s = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const L = light - 4 + r() * 10; g.fillStyle = `hsl(${25 + r() * 15}, 9%, ${L}%)`;
      g.fillRect(i * s + 5, j * s + 5, s - 10, s - 10);
      for (let k = 0; k < 120; k++) { g.fillStyle = `hsla(30, 8%, ${L + (r() - 0.5) * 16}%, .45)`; g.fillRect(i * s + r() * s, j * s + r() * s, 3, 3); }
    }
    return texOf(c, rep);
  }
  function screenTex(hue, seed, { bg = '#05070c', W = 512, H = 320 } = {}) {
    const c = cv(W, H), g = c.getContext('2d'), r = rng(seed);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) { g.fillStyle = `hsla(${hue + (r() - 0.5) * 40}, 70%, ${45 + r() * 25}%, ${0.5 + r() * 0.5})`; g.fillRect(r() * W * 0.85, r() * H * 0.85, 30 + r() * 140, 8 + r() * 40); }
    g.strokeStyle = `hsla(${hue}, 80%, 70%, .9)`; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x < W; x += 8) g.lineTo(x, H * 0.75 + Math.sin(x * 0.05 + seed) * 18);
    g.stroke();
    return texOf(c);
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
  // sofa / armchair: n seats wide at (x, z) facing `face`; returns the seat spots
  function sofa(x, z, face, n, mat, legMat = std('#2a2018', 0.6)) {
    const g = group(x, z, face);
    const W = n * 0.7 + 0.3;
    box(W, 0.3, 0.8, mat, 0, 0.12, 0, 0.06, g);
    for (let i = 0; i < n; i++) box(0.66, 0.12, 0.66, mat, (i - (n - 1) / 2) * 0.7, 0.42, 0.05, 0.05, g);
    box(W, 0.5, 0.2, mat, 0, 0.4, -0.32, 0.07, g);
    for (const s of [-1, 1]) box(0.15, 0.32, 0.8, mat, s * (W / 2 - 0.02), 0.32, 0, 0.06, g);
    for (const [dx, dz] of [[-W / 2 + 0.1, -0.32], [W / 2 - 0.1, -0.32], [-W / 2 + 0.1, 0.32], [W / 2 - 0.1, 0.32]]) mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.12, 10), legMat, dx, 0.06, dz, g);
    const out = [];
    for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 0.7; out.push({ x: x + Math.cos(face) * o + Math.sin(face) * 0.06, z: z - Math.sin(face) * o + Math.cos(face) * 0.06, face, seat: 0.5 }); }
    return out;
  }
  // a plain bench (no back) n places wide; returns the seat spots facing `face`
  function bench(x, z, face, n, mat) {
    const g = group(x, z, face), W = n * 0.62;
    box(W, 0.06, 0.36, mat, 0, 0.4, 0, 0.01, g);
    for (const s of [-1, 1]) box(0.06, 0.4, 0.3, mat, s * (W / 2 - 0.12), 0, 0, 0.01, g);
    const out = [];
    for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * 0.62; out.push({ x: x + Math.cos(face) * o + Math.sin(face) * 0.02, z: z - Math.sin(face) * o + Math.cos(face) * 0.02, face, seat: 0.46 }); }
    return out;
  }
  // a floor ring that lights up in an agent's colour while their station is in use
  function stationRing(x, z, color, r0 = 0.42, r1 = 0.5) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.014, z); scene.add(m);
    return {
      mat: m.material,
      set(state) { m.material.opacity = state === 'off' ? 0 : 0.8; m.material.color.set(state === 'waiting' ? '#f59e0b' : state === 'error' ? '#ef4444' : color).multiplyScalar(2); },
    };
  }
  // dust motes drifting in a light shaft from `top` to `hit`
  function dust(top, hit, n = 120, color = '#ffe6b8', width = 0.8) {
    const pos = new Float32Array(n * 3), seeds = [];
    for (let i = 0; i < n; i++) seeds.push([Math.random(), (Math.random() - 0.5) * width, (Math.random() - 0.5) * width, Math.random() * 6]);
    const pts = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ color: new THREE.Color(color).multiplyScalar(1.3), size: 0.009, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    scene.add(pts);
    return {
      update(t, lite) {
        pts.visible = !lite; if (lite) return;
        seeds.forEach((s, i) => {
          const k = (s[0] + t * 0.004) % 1;
          pos[i * 3] = top.x + (hit.x - top.x) * k + s[1] + Math.sin(t * 0.3 + s[3]) * 0.03;
          pos[i * 3 + 1] = top.y + (hit.y - top.y) * k + Math.sin(t * 0.21 + s[3]) * 0.05;
          pos[i * 3 + 2] = top.z + (hit.z - top.z) * k + s[2] + Math.cos(t * 0.27 + s[3]) * 0.03;
        });
        pts.geometry.attributes.position.needsUpdate = true;
      },
    };
  }
  const noise = (t) => Math.sin(t * 1.7) * 0.5 + Math.sin(t * 3.3 + 1) * 0.3 + Math.sin(t * 7.9 + 2) * 0.2;

  return { cv, rng, texOf, rbox, mesh, box, std, metal, glow, group, woodTex, stoneTex, flagsTex, screenTex, plant, sofa, bench, stationRing, dust, noise };
}
