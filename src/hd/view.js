// HD view: renders one HD room with the team in it, driven by the same live
// (or simulated) status as the standard view. main.js talks to it through a
// small interface: apply / reset / tick / update / setUsage / select / setLooks.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makeAgent, lookFor } from './character.js';
import { Traveller, makeFX, loadMode, saveMode } from './travel.js';
import { effectiveState } from '../crew.js';
import office from './scenes/office.js';
import wizard from './scenes/wizard.js';
import starship from './scenes/starship.js';
import scriptorium from './scenes/scriptorium.js';
import mission from './scenes/mission.js';
import noir from './scenes/noir.js';

export const HD_SCENES = { office, wizard, starship, scriptorium, mission, noir };
const AT_STATION = new Set(['working', 'waiting', 'error', 'handoff']);

// Route along a room's walkways (a few polylines that may share corners): step off at
// `a`, join the network where it's nearest, take the shortest way, leave it nearest `b`.
// Rooms without walkways walk straight.
function walkwayRoute(lines, a, b) {
  if (!lines?.length) return [a, b];
  if (typeof lines[0][0] === 'number') lines = [lines];
  const key = (p) => p[0].toFixed(2) + ',' + p[1].toFixed(2);
  const nodes = new Map(), edges = new Map();
  const node = (p) => { const k = key(p); if (!nodes.has(k)) { nodes.set(k, p); edges.set(k, []); } return k; };
  const link = (p, q) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]), u = node(p), v = node(q); edges.get(u).push([v, d]); edges.get(v).push([u, d]); };
  const segs = [];
  for (const l of lines) for (let i = 0; i < l.length - 1; i++) segs.push([l[i], l[i + 1]]);
  const near = (p) => {
    let best = { d: Infinity };
    for (const [s1, s2] of segs) {
      const dx = s2[0] - s1[0], dz = s2[1] - s1[1], L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - s1[0]) * dx + (p[1] - s1[1]) * dz) / L2));
      const q = [s1[0] + dx * t, s1[1] + dz * t], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
      if (d < best.d) best = { d, q, s1, s2 };
    }
    return best;
  };
  const A = near(a), B = near(b);
  for (const [s1, s2] of segs) {
    const cuts = [A, B].filter((n) => n.s1 === s1 && n.s2 === s2).map((n) => n.q)
      .sort((p, q) => Math.hypot(p[0] - s1[0], p[1] - s1[1]) - Math.hypot(q[0] - s1[0], q[1] - s1[1]));
    let prev = s1; for (const c of cuts) { link(prev, c); prev = c; } link(prev, s2);
  }
  // Dijkstra (a handful of nodes)
  const start = key(A.q), goal = key(B.q), dist = new Map([[start, 0]]), from = new Map(), todo = new Set(nodes.keys());
  while (todo.size) {
    let u = null; for (const k of todo) if (dist.has(k) && (u === null || dist.get(k) < dist.get(u))) u = k;
    if (u === null || u === goal) break;
    todo.delete(u);
    for (const [v, d] of edges.get(u)) if (todo.has(v) && dist.get(u) + d < (dist.get(v) ?? Infinity)) { dist.set(v, dist.get(u) + d); from.set(v, u); }
  }
  const mid = []; for (let k = goal; k && k !== start; k = from.get(k)) mid.unshift(nodes.get(k));
  const pts = [a, A.q, ...mid, b];
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 0.05);
}
// where someone steps to when leaving a spot: given, or just behind a chair / in front of a sofa
const exitOf = (spot, kind) => spot.exit ?? spot.stand ?? (kind === 'station'
  ? [spot.x - Math.sin(spot.face) * 0.65, spot.z - Math.cos(spot.face) * 0.65]
  : [spot.x + Math.sin(spot.face) * 0.6, spot.z + Math.cos(spot.face) * 0.6]);

export function createHDView({ host, labelsHost, theme, team, leadId, onSelect, looks = {} }) {
  const def = HD_SCENES[theme];
  // the lead takes place 1 (the lead's station), everyone else follows in team order
  const order = [...team.filter((m) => m.id === leadId), ...team.filter((m) => m.id !== leadId)];

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.style.pointerEvents = 'none';
  labelsHost.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const room = def.build({ scene, renderer, slotColors: order.map((m) => m.color) });
  scene.background = new THREE.Color(room.background ?? '#000');
  scene.environmentIntensity = room.envIntensity ?? 0.1;
  renderer.toneMappingExposure = room.exposure ?? 1;

  // ---------- camera ----------
  const C = room.camera;
  const camera = new THREE.PerspectiveCamera(C.fov ?? 30, 1, 0.1, 120);
  camera.position.set(...C.position);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...C.target);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.rotateSpeed = 0.6;
  controls.minPolarAngle = C.minPolar ?? 0.4; controls.maxPolarAngle = C.maxPolar ?? 1.3;
  if (C.minAz != null) { controls.minAzimuthAngle = C.minAz; controls.maxAzimuthAngle = C.maxAz; }
  controls.minDistance = C.minDist ?? 4; controls.maxDistance = C.maxDist ?? 30;
  controls.update();

  // ---------- post ----------
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), room.bloom?.strength ?? 0.5, room.bloom?.radius ?? 0.5, room.bloom?.threshold ?? 1);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  // pull the camera back on narrower windows so the whole room fits (until the user moves it)
  const baseOffset = camera.position.clone().sub(controls.target);
  let touched = false;
  renderer.domElement.addEventListener('pointerdown', () => { touched = true; });
  renderer.domElement.addEventListener('wheel', () => { touched = true; }, { passive: true });
  function fit() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h); labels.setSize(w, h); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (!touched) camera.position.copy(controls.target).addScaledVector(baseOffset, Math.max(1, Math.min(1.8, (C.aspect ?? 1.6) / camera.aspect)));
  }
  fit();
  const ro = new ResizeObserver(fit); ro.observe(host);

  // ---------- who sits where ----------
  const slotOf = {}, indexOf = {};
  order.forEach((m, i) => { if (room.slots[i]) { slotOf[m.id] = { ...room.slots[i], index: i }; indexOf[m.id] = i; } });
  const members = order.filter((m) => slotOf[m.id]);
  if (members.length < team.length) console.info(`[office] HD ${theme} has ${room.slots.length} places; not shown: ${team.filter((m) => !slotOf[m.id]).map((m) => m.name).join(', ')}`);
  // empty places stay dark
  for (let i = members.length; i < room.slots.length; i++) room.setStation(i, 'off');

  // ---------- agents ----------
  const crew = {}, fxSets = {};
  let mode = loadMode(theme, def.defaultMode);
  const markMat = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false });
  function addAgent(m, at = 'lounge') {
    const slot = slotOf[m.id];
    const ag = makeAgent({ id: m.id, theme, look: lookFor(m.id, looks, indexOf[m.id]), color: m.color, index: indexOf[m.id] });
    scene.add(ag.object);
    ag.object.traverse((o) => { if (o.isMesh) o.userData.agentId = m.id; });
    fxSets[m.id] ??= makeFX(scene, m.color, def.modes.map(([k]) => k));
    const tr = new Traveller({ scene, ag, color: m.color, fx: fxSets[m.id] });
    // name tag
    const el = document.createElement('div'); el.className = 'tag hd';
    el.innerHTML = `<span class="d"></span><span class="ico"></span><span class="n"></span><span class="full"></span>`;
    el.querySelector('.n').textContent = m.name;
    el.addEventListener('click', () => onSelect?.(m.id));
    const tag = new CSS2DObject(el); ag.object.add(tag);
    tr.place(at === 'station' ? slot.station : slot.lounge);
    return { m, slot, ag, tr, tag, el, at, want: at, eff: 'idle' };
  }
  // needs-you / error marker at each station (pulses while shown)
  const markers = {};
  for (const m of members) {
    const s = slotOf[m.id].station;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 48), markMat('#f59e0b'));
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, 0.02, s.z); ring.visible = false; scene.add(ring);
    // glow only (bloom does the rest): eight more lights would slow every room down
    markers[m.id] = { ring, state: null };
  }
  for (const m of members) crew[m.id] = addAgent(m);
  // build every shader up front (effects, see-through agents), so nothing compiles mid-animation
  function warmup(list, markersToo = false) {
    for (const c of list) c.tr.warmup(true);
    if (markersToo) for (const mk of Object.values(markers)) mk.ring.visible = true;
    // compile for the off-screen buffer the composer really draws into (linear, no tone
    // mapping), not the screen, or the cached shaders won't match and still compile later
    try { renderer.setRenderTarget(composer.renderTarget1); renderer.compile(scene, camera); }
    catch (e) { console.warn('[office] HD warm-up skipped', e); }
    finally { renderer.setRenderTarget(null); }
    for (const c of list) c.tr.warmup(false);
    if (markersToo) for (const mk of Object.values(markers)) mk.ring.visible = false;
  }
  warmup(Object.values(crew), true);

  let lastAgents = {}, lastSettings = {}, first = true;
  function decide(c, instant) {
    const st = lastAgents[c.m.id];
    const eff = effectiveState(st, lastSettings);
    c.eff = eff;
    // tag
    const shown = eff === 'stale' ? 'idle' : eff;
    c.el.querySelector('.d').className = 'd ' + shown;
    const ico = c.el.querySelector('.ico'); ico.className = 'ico ' + shown; ico.textContent = shown === 'waiting' ? '?' : shown === 'error' ? '!' : '';
    c.el.querySelector('.full').textContent = ` · ${c.m.role}${eff === 'stale' ? ' — No update for a while' : st?.text ? ' — ' + st.text : ''}`;
    c.want = AT_STATION.has(eff) ? 'station' : 'lounge';
    if (instant && !c.tr.busy) { c.tr.place(c.want === 'station' ? c.slot.station : c.slot.lounge); c.at = c.want; }
    lightStation(c);
  }
  function lightStation(c) {
    const here = c.at === 'station' && !c.tr.busy;
    room.setStation(c.slot.index, here ? (c.eff === 'waiting' || c.eff === 'error' ? c.eff : 'working') : 'off');
    const mk = markers[c.m.id];
    mk.state = here && (c.eff === 'waiting' || c.eff === 'error') ? c.eff : null;
    mk.ring.visible = !!mk.state;
    if (mk.state) { const col = mk.state === 'error' ? '#ef4444' : '#f59e0b'; mk.ring.material.color.set(col).multiplyScalar(2.6); }
  }
  function travel(c) {
    if (c.tr.busy || c.at === c.want) return;
    const to = c.want;
    if (to === 'lounge') { room.setStation(c.slot.index, 'off'); markers[c.m.id].ring.visible = false; markers[c.m.id].state = null; }
    const from = to === 'station' ? c.slot.lounge : c.slot.station, dest = to === 'station' ? c.slot.station : c.slot.lounge;
    const path = walkwayRoute(room.walkway, exitOf(from, to === 'station' ? 'lounge' : 'station'), exitOf(dest, to));
    c.tr.go(dest, {
      mode, path,
      onArrive: () => { c.at = to; lightStation(c); },
    });
  }

  // ---------- picking ----------
  const ray = new THREE.Raycaster(); let downAt = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(Object.values(crew).map((c) => c.ag.object), true).find((h) => h.object.userData.agentId);
    if (hit) onSelect?.(hit.object.userData.agentId);
  });

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let fpsT = 0, frames = 0, slow = 0, lite = false;
  renderer.setAnimationLoop(() => {
    // keep movement in real time even when the browser throttles a background window:
    // big gaps are replayed in small steps (up to 10 s), so agents arrive when they should
    const raw = Math.min(clock.getDelta(), 10), t = clock.elapsedTime;
    const n = Math.max(1, Math.ceil(raw / 0.05)), dt = raw / n;
    controls.update();
    room.update(Math.min(raw, 0.05), t, lite);
    for (const c of Object.values(crew)) {
      for (let i = 0; i < n; i++) { c.tr.update(dt); travel(c); }
      c.tag.position.y = (c.ag.pose === 'sit' ? (room.tagHeight ?? 2) - 0.42 : room.tagHeight ?? 2);
      c.el.style.visibility = c.ag.object.visible ? '' : 'hidden';
    }
    for (const mk of Object.values(markers)) if (mk.state) { const k = 0.5 + 0.5 * Math.sin(t * 4); mk.ring.material.opacity = 0.45 + 0.5 * k; }
    composer.render();
    labels.render(scene, camera);
    // frame-rate guard: drop bloom first, then the extras and resolution
    fpsT += raw; frames++;
    if (fpsT >= 2) {
      // under ~8 fps the browser is throttling a hidden/background window: not the GPU's fault
      const fps = frames / fpsT; slow = fps < 40 && fps > 8 && !document.hidden ? slow + 1 : 0;
      if (slow >= 2 && bloom.enabled && !window.__noGuard) { bloom.enabled = false; slow = 0; console.info('[office] HD: bloom off to keep frame rate'); }
      else if (slow >= 2 && !lite && !window.__noGuard) { lite = true; renderer.setPixelRatio(1); fit(); console.info('[office] HD: lighter effects to keep frame rate'); }
      fpsT = 0; frames = 0;
    }
  });

  return {
    kind: 'hd',
    modes: def.modes,
    get mode() { return mode; },
    setMode(m) { mode = m; saveMode(theme, m); },
    todLabels: null,
    apply(agents, settings) { lastAgents = agents; lastSettings = settings; for (const c of Object.values(crew)) decide(c, first); first = false; },
    reset() { first = true; },
    tick() { for (const c of Object.values(crew)) decide(c, false); },
    setUsage(u) { room.setUsage?.(u); },
    setTimeOfDay() {},
    select(id) { for (const c of Object.values(crew)) c.el.classList.toggle('open', c.m.id === id); },
    setLooks(next) {
      looks = next || {};
      for (const c of Object.values(crew)) {
        if (c.tr.busy) continue; // swap them once they've arrived
        scene.remove(c.ag.object); c.el.remove();
        const n = addAgent(c.m, c.at); n.eff = c.eff; n.want = c.want;
        crew[c.m.id] = n; lightStation(n); warmup([n]);
      }
    },
    debug: { scene, camera, controls, crew, room, renderer },
  };
}
