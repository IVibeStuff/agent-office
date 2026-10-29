// Agent wardrobe: style each agent's look per theme, with a live HD preview.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { makeAgent, lookFor, cachedLooks, saveLooks, fetchLooks, OPTIONS } from './hd/character.js';

const qs = new URLSearchParams(location.search);
// the team comes from the office server (set up on the Team page)
const state = {
  team: [],
  looks: cachedLooks(),       // only what's been changed; everything else comes from the agent's preset
  agent: qs.get('agent'),
  theme: qs.get('theme') ?? 'office',
  pose: qs.get('pose') ?? 'stand',
  view: qs.get('view') ?? 'one',
};

// ---------- renderer ----------
const stageEl = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stageEl.prepend(renderer.domElement);
const scene = new THREE.Scene(); scene.background = new THREE.Color('#000');
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
camera.position.set(0.9, 1.5, 4.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.95, 0); controls.enableDamping = true; controls.minDistance = 1.6; controls.maxDistance = 9;
controls.maxPolarAngle = 1.55;
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.5, 1.0));
composer.addPass(new OutputPass());
function resize() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---------- themed plinth + lights ----------
const THEMES = {
  office: { label: 'Office', plinth: '#6b4a2c', rimC: '#ffd9a8', keyC: '#fff4e6', fill: '#9fb4d9', env: 0.25, glowC: null, stool: '#26282c' },
  wizard: { label: "Wizard's Tower", plinth: '#3a332d', rimC: '#7f9cff', keyC: '#ffd2a0', fill: '#3dff6a', env: 0.06, glowC: '#b14dff', stool: '#3a2414' },
  starship: { label: 'Starship', plinth: '#2a2e36', rimC: '#5ad1ff', keyC: '#e6eeff', fill: '#5b6cf0', env: 0.18, glowC: '#2fd8ff', stool: '#1a1d22' },
  scriptorium: { label: 'Scriptorium', plinth: '#6a5a44', rimC: '#ffd28a', keyC: '#ffe2b8', fill: '#c98a3a', env: 0.1, glowC: null, stool: '#4a3420' },
  mission: { label: 'Mission Control', plinth: '#2a2d33', rimC: '#7fb4ff', keyC: '#f2f4f8', fill: '#3fd17a', env: 0.2, glowC: '#3fd17a', stool: '#1a1d22' },
  noir: { label: 'Detective Agency', plinth: '#3a2a1e', rimC: '#ff5a8a', keyC: '#ffe6c0', fill: '#5a7ab0', env: 0.08, glowC: null, stool: '#2a1a10' },
};
let set = new THREE.Group(); scene.add(set);
function buildSet() {
  scene.remove(set); set = new THREE.Group(); scene.add(set);
  const T = THEMES[state.theme];
  scene.environmentIntensity = T.env;
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.3, 0.18, 96), new THREE.MeshStandardMaterial({ color: T.plinth, roughness: state.theme === 'starship' ? 0.35 : 0.85, metalness: state.theme === 'starship' ? 0.6 : 0 }));
  plinth.position.y = -0.09; plinth.receiveShadow = true; set.add(plinth);
  if (T.glowC) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.012, 8, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(T.glowC).multiplyScalar(2), toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.005; set.add(ring);
  }
  const key = new THREE.SpotLight(T.keyC, 30, 12, 0.5, 0.6, 1.6); key.position.set(2.2, 4.2, 2.6); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 4; key.shadow.bias = -0.0005; set.add(key, key.target);
  const rim = new THREE.SpotLight(T.rimC, 26, 10, 0.6, 0.7, 1.6); rim.position.set(-2.4, 3, -2.6); set.add(rim, rim.target);
  const fill = new THREE.PointLight(T.fill, 1.2, 5, 2); fill.position.set(-1.8, 0.5, 1.5); set.add(fill);
  set.add(new THREE.HemisphereLight('#8090b0', '#100c08', 0.15));
  return T;
}
function stool(color) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 28), m); seat.position.y = 0.43;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.42, 12), m); leg.position.y = 0.21;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 24), m); base.position.y = 0.015;
  for (const o of [seat, leg, base]) { o.castShadow = o.receiveShadow = true; g.add(o); }
  return g;
}

// ---------- agents ----------
let actors = [];
function buildAgents() {
  for (const a of actors) set.remove(a.holder);
  actors = [];
  const T = THEMES[state.theme];
  const ids = state.view === 'all' ? state.team.map((r) => r.id) : [state.agent];
  const spread = Math.min(0.42, 1.5 / Math.max(1, ids.length - 1));
  ids.forEach((id, i) => {
    const holder = new THREE.Group(); set.add(holder);
    if (ids.length > 1) { const a = (i - (ids.length - 1) / 2) * spread; holder.position.set(Math.sin(a) * 2.4, 0, Math.cos(a) * 2.4 - 2.6); holder.rotation.y = a * 0.6; }
    const m = member(id);
    const ag = makeAgent({ id, theme: state.theme, look: lookOf(id), color: m.color, index: indexOf(id) });
    if (state.pose === 'sit') { holder.add(stool(T.stool)); ag.sit(0.46, false); ag.object.position.z = 0.02; }
    else if (state.pose === 'walk') ag.walk(); else ag.stand();
    holder.add(ag.object);
    if (ids.length > 1 && id === state.agent) {
      const sel = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.4, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(member(id).color).multiplyScalar(1.8), toneMapped: false }));
      sel.rotation.x = -Math.PI / 2; sel.position.y = 0.006; holder.add(sel);
    }
    actors.push({ holder, ag });
  });
  controls.target.set(0, state.pose === 'sit' ? 0.75 : 0.95, ids.length > 1 ? -0.4 : 0);
  camera.position.copy(controls.target).add(new THREE.Vector3(ids.length > 1 ? 1.2 : 1.0, ids.length > 1 ? 1.0 : 0.5, ids.length > 1 ? 7.2 : 4.6));
}
function rebuild(all = false) { if (all) buildSet(); buildAgents(); }

// ---------- UI ----------
const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => { const e = Object.assign(document.createElement(tag), attrs); for (const k of kids) e.append(k); return e; };
function seg(target, items, key, onChange) {
  target.innerHTML = '';
  for (const [v, label] of items) target.append(el('button', { textContent: label, className: state[key] === v ? 'on' : '', onclick: () => { state[key] = v; onChange(); renderUI(); } }));
}
const member = (id) => state.team.find((m) => m.id === id) ?? { id, name: id, color: '#8b93a7' };
const indexOf = (id) => Math.max(0, state.team.findIndex((m) => m.id === id));
const lookOf = (id) => lookFor(id, state.looks, indexOf(id));
// editing writes the agent's full look into state.looks (so it's saved as a whole)
const look = () => (state.looks[state.agent] = lookOf(state.agent));
let saveMsg = '';
const NOTE = 'The person (skin, hair, glasses) carries across every theme; outfits are per theme. ';
const saved = (ok) => { saveMsg = ok ? 'Saved to the office, so every browser sees it.' : 'Saved in this browser only (the office server could not be reached).'; const n = document.querySelector('.note'); if (n) n.textContent = NOTE + saveMsg; };
const commit = () => { saveLooks(state.looks, saved); buildAgents(); renderPanel(); };
const swatches = (map, cur, set) => el('div', { className: 'sw' }, ...Object.entries(map).map(([n, c]) => el('button', { title: n, className: cur === c ? 'on' : '', style: `background:${c}`, onclick: () => { set(c); commit(); } })));
const chips = (list, cur, set) => el('div', { className: 'chips' }, ...list.map((v) => el('button', { textContent: v, className: cur === v ? 'on' : '', onclick: () => { set(v); commit(); } })));
const color = (cur, set) => el('input', { type: 'color', value: cur, oninput: (e) => { set(e.target.value); saveLooks(state.looks, saved); buildAgents(); } });
const toggle = (cur, set) => el('button', { className: 'toggle' + (cur ? ' on' : ''), onclick: () => { set(!cur); commit(); } });
const row = (label, ctl) => el('div', { className: 'row' }, el('label', { textContent: label }), ctl);
const block = (label, ctl) => el('div', {}, el('div', { className: 'row' }, el('label', { textContent: label })), ctl);

function renderPanel() {
  const L = look(), P = $('#panel'); P.innerHTML = '';
  P.append(el('div', { className: 'agents' }, ...state.team.map((r) => el('button', {
    className: r.id === state.agent ? 'on' : '', style: `--c:${r.color}`, onclick: () => { state.agent = r.id; buildAgents(); renderPanel(); },
  }, el('i', { style: `background:${r.color}` }), r.name))));
  P.append(el('h3', { textContent: 'Person' }));
  P.append(block('Skin', swatches(OPTIONS.skin, L.skin, (c) => (L.skin = c))));
  P.append(block('Hair', chips(OPTIONS.hairStyle, L.hair.style, (v) => (L.hair.style = v))));
  if (L.hair.style !== 'none' || L.beard !== 'none') P.append(block('Hair colour', swatches(OPTIONS.hairColor, L.hair.color, (c) => (L.hair.color = c))));
  P.append(block('Beard', chips(OPTIONS.beard, L.beard, (v) => (L.beard = v))));
  P.append(row('Glasses', toggle(L.glasses, (v) => (L.glasses = v))));
  P.append(el('h3', { textContent: `${THEMES[state.theme].label} outfit` }));
  if (state.theme === 'office') {
    const O = L.office;
    P.append(block('Top', chips(OPTIONS.officeTop, O.top, (v) => (O.top = v))));
    P.append(row('Top colour', color(O.topColor, (c) => (O.topColor = c))));
    P.append(block('Bottom', chips(OPTIONS.officeBottom, O.bottom, (v) => (O.bottom = v))));
    P.append(row('Bottom colour', color(O.bottomColor, (c) => (O.bottomColor = c))));
    P.append(row('Shoes', color(O.shoeColor, (c) => (O.shoeColor = c))));
  } else if (state.theme === 'wizard') {
    const W = L.wizard;
    P.append(row('Robe', color(W.robe, (c) => (W.robe = c))));
    P.append(row('Trim', color(W.trim, (c) => (W.trim = c))));
    P.append(row('Hood up', toggle(W.hood, (v) => (W.hood = v))));
  } else if (state.theme === 'scriptorium') {
    const S = L.scriptorium;
    P.append(row('Habit', color(S.habit, (c) => (S.habit = c))));
    P.append(row('Cord', color(S.cord, (c) => (S.cord = c))));
    P.append(row('Hood up', toggle(S.hood, (v) => (S.hood = v))));
  } else if (state.theme === 'mission') {
    const S = L.mission;
    P.append(row('Shirt', color(S.shirt, (c) => (S.shirt = c))));
    P.append(row('Tie', color(S.tie, (c) => (S.tie = c))));
    P.append(row('Trousers', color(S.trousers, (c) => (S.trousers = c))));
    P.append(row('Headset', toggle(S.headset, (v) => (S.headset = v))));
  } else if (state.theme === 'noir') {
    const S = L.noir;
    P.append(row('Suit', color(S.suit, (c) => (S.suit = c))));
    P.append(row('Tie', color(S.tie, (c) => (S.tie = c))));
    P.append(row('Hat', color(S.hat, (c) => (S.hat = c))));
    P.append(row('Trench coat', toggle(S.coatOn, (v) => (S.coatOn = v))));
    if (S.coatOn) P.append(row('Coat colour', color(S.coat, (c) => (S.coat = c))));
  } else {
    const S = L.starship;
    P.append(block('Shoulder colour', swatches({ Command: '#b3202a', Operations: '#d9a521', Science: '#2a8f9a', Medical: '#3f7fd9', Special: '#7d5bd6', Security: '#4a4f58' }, S.dept, (c) => (S.dept = c))));
    P.append(row('Custom', color(S.dept, (c) => (S.dept = c))));
  }
  P.append(el('div', { className: 'foot' },
    el('button', { textContent: 'Reset this agent', onclick: () => { delete state.looks[state.agent]; commit(); } }),
    el('button', { textContent: 'Reset all', onclick: () => { state.looks = {}; commit(); } })));
  P.append(el('div', { className: 'note', textContent: NOTE + (saveMsg || 'Changes save automatically.') }));
}
function renderUI() {
  // back to the office, in the theme you were styling (HD, since that's where these looks show)
  $('#back').href = `/?theme=${state.theme}&quality=hd`;
  seg($('#themes'), Object.entries(THEMES).map(([k, t]) => [k, t.label]), 'theme', () => rebuild(true));
  seg($('#poses'), [['stand', 'Stand'], ['walk', 'Walk'], ['sit', 'Sit']], 'pose', () => buildAgents());
  seg($('#views'), [['one', 'One'], ['all', state.team.length > 1 ? `All ${state.team.length}` : 'All']], 'view', () => buildAgents());
  renderPanel();
}

Promise.all([fetch('/api/team').then((r) => r.json()).catch(() => null), fetchLooks()]).then(([t, server]) => {
  state.team = t?.team?.length ? [...t.team.filter((m) => m.id === t.leadId), ...t.team.filter((m) => m.id !== t.leadId)] : [{ id: 'agent', name: 'Agent', color: '#5b6cf0' }];
  if (!state.team.some((m) => m.id === state.agent)) state.agent = state.team[0].id;
  if (!THEMES[state.theme]) state.theme = 'office';
  if (server) state.looks = server;
  rebuild(true); renderUI(); resize();
});
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  for (const a of actors) a.ag.update(dt);
  controls.update(); composer.render();
});
window.wardrobe = { state, scene, camera };
