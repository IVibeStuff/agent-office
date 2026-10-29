import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { THEMES as THEME_LIST } from './themes/index.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Crew } from './crew.js';
import { UI } from './ui.js';
import { Simulation } from './sim.js';
import { setMaxAnisotropy } from './textures.js';
import { assignDesks } from './layout.js';
import { createHDView, HD_SCENES } from './hd/view.js';

// The team lives on the server (set up on the HR page), so load it first.
// first run: nobody has set up a team yet, so start on the Team page
if (!new URLSearchParams(location.search).has('demo')) fetch('/api/team').then((r) => r.json()).then((t) => { if (t && t.configured === false) location.replace('/team.html?welcome'); }).catch(() => {});
const boot = () => fetch('/api/state').then((r) => {
  if (r.status === 401) { location.href = '/login'; throw new Error('locked'); }
  return r.json();
}).then((s) => start({
  title: s.title, leadId: s.leadId, team: s.team,
  staleWorkingMinutes: s.settings?.staleWorkingMinutes, quietWarningMinutes: s.settings?.quietWarningMinutes,
})).catch((e) => {
  if (e.message === 'locked') return;
  document.getElementById('feed-warning').hidden = false;
  document.getElementById('feed-warning').textContent = 'Can’t reach the office server. Is `npm run dev` running? Retrying…';
  setTimeout(boot, 3000);
});
boot();

function start(config) {
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const params = new URLSearchParams(location.search);
  const host = document.getElementById('canvas-host');
  const labelsHost = document.getElementById('labels-host');

  // ---------- theme + quality ----------
  const THEMES = Object.fromEntries(THEME_LIST.map((t) => [t.id, t.build]));
  const urlTheme = params.get('theme');
  const theme = THEMES[urlTheme] ? urlTheme : (THEMES[store.get('office.theme')] ? store.get('office.theme') : 'office');
  const hdAvailable = theme in HD_SCENES;
  const quality = ['hd', 'standard'].includes(params.get('quality')) ? params.get('quality') : (store.get('office.quality') || 'standard');
  const isHD = quality === 'hd' && hdAvailable;
  document.body.dataset.theme = theme;
  document.body.dataset.quality = isHD ? 'hd' : 'standard';

  const reloadWith = (key, value) => {
    const url = new URL(location.href);
    url.searchParams.set(key, value);
    location.href = url.toString(); // rebuild the scene; live status comes straight back from the server
  };
  {
    const sel = document.getElementById('theme');
    sel.innerHTML = THEME_LIST.map((t) => `<option value="${t.id}">${t.label}${t.id in HD_SCENES ? ' · HD' : ''}</option>`).join('');
    sel.value = theme;
    sel.addEventListener('change', () => { store.set('office.theme', sel.value); reloadWith('theme', sel.value); });
  }
  {
    const seg = document.getElementById('quality');
    for (const b of seg.querySelectorAll('button')) {
      const q = b.dataset.q;
      b.setAttribute('aria-checked', String((q === 'hd') === isHD));
      if (q === 'hd' && !hdAvailable) { b.disabled = true; b.title = 'HD is available for Office, Wizard’s Tower and Starship'; }
      b.addEventListener('click', () => { if (b.disabled || (q === 'hd') === isHD) return; store.set('office.quality', q); reloadWith('quality', q); });
    }
    const wardrobe = document.getElementById('wardrobe-link');
    if (wardrobe) wardrobe.href = `/agents.html?theme=${theme in HD_SCENES ? theme : 'office'}`;
  }

  // ---------- the view: standard (the original world) or HD ----------
  let selected = null;
  const selectBot = (id) => { selected = ui.select(id); view.select(selected); };
  const cachedLooks = (() => { try { return JSON.parse(store.get('office.looks') || '{}'); } catch { return {}; } })();
  const view = isHD
    ? createHDView({ host, labelsHost, theme, team: config.team, leadId: config.leadId, onSelect: (id) => selectBot(id), looks: cachedLooks })
    : createStandardView();

  {
    const move = document.getElementById('move');
    if (isHD && move) {
      move.innerHTML = view.modes.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
      move.value = view.mode;
      move.addEventListener('change', () => view.setMode(move.value));
    }
  }

  function createStandardView() {
    // ---------- renderer ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(window.devicePixelRatio); // never below the screen's own resolution
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy());

    const labels = new CSS2DRenderer();
    labels.domElement.style.pointerEvents = 'none';
    labelsHost.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d1015');

    // ---------- camera ----------
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    const target = new THREE.Vector3(0, 0.6, 0);
    const camDir = new THREE.Vector3(1, 0.95, 1.15).normalize();
    camera.position.copy(target).addScaledVector(camDir, 60);
    camera.lookAt(target);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;
    // full 360° orbit; the walls between you and the room drop out of the way (cutaway)
    controls.minAzimuthAngle = -Infinity;
    controls.maxAzimuthAngle = Infinity;
    controls.rotateSpeed = 0.6;
    controls.minPolarAngle = 0.55;
    controls.maxPolarAngle = 1.15;
    controls.minZoom = 0.85;
    controls.maxZoom = 3.2;
    controls.update();

    let composer = null, bloom = null, useBloom = true;
    // fit the whole office into view for any aspect ratio
    function fit() {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h);
      labels.setSize(w, h);
      composer?.setSize(w, h);
      bloom?.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
      camera.updateMatrixWorld();
      const inv = camera.matrixWorldInverse;
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const x of [-12.2, 12.2]) for (const y of [0, 3.25]) for (const z of [-9.2, 9.2]) {
        const v = new THREE.Vector3(x, y, z).applyMatrix4(inv);
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      }
      const padTop = 0.07, padBottom = 0.09, padX = 0.0;
      let hw = (maxX - minX) / 2 * (1 + padX * 2), hh = (maxY - minY) / 2 * (1 + padTop + padBottom);
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2 - (maxY - minY) * (padTop - padBottom) / 2;
      if (hw / hh > w / h) hh = hw / (w / h); else hw = hh * (w / h);
      camera.left = cx - hw; camera.right = cx + hw; camera.top = cy + hh; camera.bottom = cy - hh;
      camera.updateProjectionMatrix();
    }

    // ---------- world ----------
    const desks = assignDesks(config.team, config.leadId);
    const world = THEMES[theme]({ team: config.team, leadId: config.leadId, desks, title: config.title });
    if (world.background) scene.background = new THREE.Color(world.background);
    if (world.environment) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = world.environment.intensity ?? 0.3;
    }
    scene.add(world.root);
    const crew = new Crew({ team: config.team, leadId: config.leadId, world, scene, desks });

    // ---------- post (light bloom only; dropped first if the GPU struggles) ----------
    {
      const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
      composer = new EffectComposer(renderer, rt);
      composer.addPass(new RenderPass(scene, camera));
      bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), world.bloom?.strength ?? 0.18, world.bloom?.radius ?? 0.35, world.bloom?.threshold ?? 0.92);
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    }
    fit();
    new ResizeObserver(fit).observe(host);

    for (const b of Object.values(crew.bots)) b.tagEl.addEventListener('click', () => selectBot(b.id));

    // ---------- picking bots ----------
    const ray = new THREE.Raycaster();
    let downAt = null;
    renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hits = ray.intersectObjects(Object.values(crew.bots).map((b) => b.group), true);
      const id = hits.find((h) => h.object.userData.botId)?.object.userData.botId;
      if (id) selectBot(id); else if (selected) selectBot(selected);
    });

    // ---------- loop ----------
    const clock = new THREE.Clock();
    let firstFrame = true;
    let fpsT = 0, frames = 0, slow = 0;
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      controls.update();
      if (world.cutaway) {
        const cx = camera.position.x - controls.target.x, cz = camera.position.z - controls.target.z, l = Math.hypot(cx, cz) || 1;
        world.cutaway.update({ x: cx / l, z: cz / l }, dt, firstFrame);
        firstFrame = false;
      }
      world.update(dt);
      crew.update(dt);
      composer.render();
      labels.render(scene, camera);
      // effects go before resolution does
      fpsT += dt; frames++;
      if (fpsT >= 2) {
        const fps = frames / fpsT;
        slow = fps < 40 ? slow + 1 : 0;
        if (slow >= 2 && useBloom && !window.__noGuard) { useBloom = false; bloom.enabled = false; console.info('[office] bloom off to keep frame rate'); }
        fpsT = 0; frames = 0;
      }
    });

    return {
      kind: 'standard',
      todLabels: world.todLabels,
      apply: (agents, settings, opts) => crew.apply(agents, settings, opts),
      reset: () => crew.reset(),
      tick: () => crew.tick(),
      setUsage: (u) => world.setUsage(u),
      setTimeOfDay(tod) { world.setTimeOfDay(tod); renderer.toneMappingExposure = tod === 'night' ? 1.1 : 1.08; },
      select(id) { for (const b of Object.values(crew.bots)) b.tagEl.classList.toggle('open', b.id === id); },
      setLooks() {},
      debug: { crew, world, camera, controls, desks },
    };
  }

  // ---------- UI + data ----------
  const ui = new UI({
    title: config.title,
    team: config.team,
    onSelect: (id) => selectBot(id),
  });

  const live = {
    agents: Object.fromEntries(config.team.map((m) => [m.id, { state: 'idle', text: '' }])),
    activity: [], usage: null, health: null, looks: null,
    settings: { staleWorkingMinutes: config.staleWorkingMinutes, quietWarningMinutes: config.quietWarningMinutes },
    connected: false, lostSince: Date.now(), everConnected: false,
  };
  const sim = { running: false, agents: null, activity: [] };
  const simulation = new Simulation(config.team, config.leadId, (agents, item) => {
    sim.agents = agents;
    if (item) { sim.activity.push(item); if (sim.activity.length > 100) sim.activity.shift(); }
    show();
  });

  function show() {
    if (sim.running) {
      view.apply(sim.agents, live.settings, { simulated: true });
      ui.render(sim.agents, live.settings, sim.activity, true);
    } else {
      view.apply(live.agents, live.settings);
      ui.render(live.agents, live.settings, live.activity, false);
    }
  }

  function setSim(on) {
    if (on === sim.running) return;
    sim.running = on;
    view.reset();
    if (on) { sim.activity = []; simulation.start(); } else { simulation.stop(); show(); }
    ui.simulating(on);
    const url = new URL(location.href);
    if (on) url.searchParams.set('simulate', '1'); else url.searchParams.delete('simulate');
    history.replaceState(null, '', url);
  }
  document.getElementById('sim-btn').addEventListener('click', () => setSim(!sim.running));

  let shownLooks = JSON.stringify(cachedLooks);
  function setLooks(looks) {
    const next = looks || {}, key = JSON.stringify(next);
    live.looks = next;
    if (key === shownLooks) return;
    shownLooks = key;
    store.set('office.looks', key);
    view.setLooks(next);
  }

  function applySnapshot(s) {
    if (s.agents) live.agents = s.agents;
    if (s.activity) live.activity = s.activity;
    if (s.settings) live.settings = s.settings;
    if ('usage' in s) { live.usage = s.usage; view.setUsage(s.usage); ui.usage(s.usage); }
    if (s.health) live.health = s.health;
    if ('looks' in s) setLooks(s.looks);
  }

  function connect() {
    const es = new EventSource('/api/events');
    es.addEventListener('snapshot', (e) => {
      applySnapshot(JSON.parse(e.data));
      onConnected();
      // first real data (or a reconnect): place everyone, don't replay old handoffs
      if (!sim.running) view.reset();
      show();
    });
    es.addEventListener('status', (e) => {
      const d = JSON.parse(e.data);
      live.agents = { ...live.agents, [d.agent]: d.status };
      live.activity.push(d.activity);
      if (live.activity.length > 200) live.activity.shift();
      live.health = d.health;
      onConnected();
      if (!sim.running) show();
    });
    es.addEventListener('usage', (e) => { live.usage = JSON.parse(e.data); view.setUsage(live.usage); ui.usage(live.usage); });
    es.addEventListener('looks', (e) => setLooks(JSON.parse(e.data)));
    es.addEventListener('config', () => location.reload()); // HR changed the team
    es.addEventListener('heartbeat', (e) => { live.health = JSON.parse(e.data).health; onConnected(); checkFeed(); });
    es.onerror = () => {
      if (live.connected) { live.connected = false; live.lostSince = Date.now(); }
      checkFeed();
    };
  }
  function onConnected() { live.connected = true; live.everConnected = true; checkFeed(); }

  // Only warn when the feed itself fails or goes quiet. Idle agents are normal.
  function checkFeed() {
    const quietMin = live.settings.quietWarningMinutes ?? 45;
    if (!live.connected) {
      const down = (Date.now() - live.lostSince) / 1000;
      ui.live('bad', 'Offline');
      ui.warning(down > 20 ? 'Can’t reach the status feed. Is `npm run dev` still running?' : '');
      return;
    }
    const hb = live.health?.lastHeartbeat ? (Date.now() - Date.parse(live.health.lastHeartbeat)) / 60000 : 0;
    if (hb >= quietMin) { ui.live('bad', 'Quiet'); ui.warning(`Status feed has been quiet for ${Math.floor(hb)} min.`); }
    else { ui.live('live', 'Live'); ui.warning(''); }
  }
  setInterval(() => { checkFeed(); view.tick(); if (!sim.running) ui.render(live.agents, live.settings, live.activity, false); if (live.usage) ui.usage(live.usage); }, 30_000);
  ui.usage(null);
  show();
  connect();
  setTimeout(checkFeed, 21_000);

  // ---------- time of day (standard view only; HD rooms set their own mood) ----------
  const todButtons = [...document.querySelectorAll('#tod button')];
  if (view.todLabels) todButtons.forEach((b) => { if (view.todLabels[b.dataset.tod]) b.textContent = view.todLabels[b.dataset.tod]; });
  let todMode = store.get('office.tod') || 'now';
  const nowTod = () => { const h = new Date().getHours(); return h >= 7 && h < 17 ? 'day' : h >= 17 && h < 21 ? 'evening' : 'night'; };
  function applyTod() {
    const tod = todMode === 'now' ? nowTod() : todMode;
    view.setTimeOfDay(tod);
    todButtons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tod === todMode)));
  }
  todButtons.forEach((b) => b.addEventListener('click', () => { todMode = b.dataset.tod; store.set('office.tod', todMode); applyTod(); }));
  applyTod();
  setInterval(() => { if (todMode === 'now') applyTod(); }, 60_000);

  // ---------- one-time hint ----------
  if (!store.get('office.hint360')) {
    const hint = document.createElement('div');
    hint.className = 'hint'; hint.textContent = 'Drag to rotate · scroll to zoom · right-drag to pan';
    host.parentElement.appendChild(hint);
    const done = () => { hint.classList.add('gone'); store.set('office.hint360', '1'); setTimeout(() => hint.remove(), 600); };
    host.addEventListener('pointerdown', done, { once: true });
    setTimeout(done, 9000);
  }

  if (params.get('simulate') === '1') setSim(true);

  // handy for debugging in the console
  window.office = { view, setSim, live, sim, ...view.debug };
}
