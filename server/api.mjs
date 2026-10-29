// Office status API. Runs inside Vite (dev and preview) as middleware,
// so `npm run dev` is the only thing you need to start.
//
//   GET  /api/state            full snapshot
//   GET  /api/events           live updates (Server-Sent Events)
//   POST /api/status           {agent, state, text, to?, with?}
//   POST /api/usage            manual usage push
//   POST /api/usage/refresh    re-read Claude Code logs now
//   GET  /api/team             the team (title, lead, up to 8 agents)
//   POST /api/team             {title, leadId, team:[{id?, name, role, color, match?}]} (the HR page)
//   GET  /api/looks            HD agent looks (wardrobe)
//   POST /api/looks            {looks} save the wardrobe for every browser
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, loadEnv, readConfig, validateTeam, saveTeam, MAX_AGENTS, TEAM_FILE } from './env.mjs';
import { readClaudeCodeUsage } from './usage.mjs';

export const STATES = ['working', 'waiting', 'meeting', 'handoff', 'error', 'done', 'idle'];
const MAX_TEXT = 80;
const MAX_ACTIVITY = 200;

export function createOfficeApi() {
  // Vite restarts its server when the config changes; stop the previous copy first,
  // or its timers keep running and it eats inbox files into an old state.
  globalThis.__officeApiStop?.();
  const timers = [];
  const every = (fn, ms) => { const t = setInterval(fn, ms); t.unref?.(); timers.push(t); return t; };
  const env = loadEnv();
  let config = readConfig();
  let ids = new Set(config.team.map((t) => t.id));
  const dataDir = path.join(ROOT, 'data');
  const dataFile = path.join(dataDir, 'state.json');
  const password = env.OFFICE_PASSWORD || '';
  const token = env.OFFICE_TOKEN || '';
  const sessionValue = password
    ? crypto.createHmac('sha256', 'agent-office').update(password).digest('hex')
    : '';

  // ---------- state ----------
  let db = { agents: {}, activity: [], usage: null, lastStatusAt: null, looks: {} };
  try { db = { ...db, ...JSON.parse(fs.readFileSync(dataFile, 'utf8')) }; } catch { /* first run */ }
  for (const id of ids) db.agents[id] ??= { state: 'idle', text: '', updatedAt: null };
  for (const id of Object.keys(db.agents)) if (!ids.has(id)) delete db.agents[id];

  const health = { startedAt: new Date().toISOString(), lastHeartbeat: new Date().toISOString() };
  let saveTimer = null;
  const save = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
    }, 200);
  };

  const clients = new Set();
  const snapshot = () => ({
    title: config.title,
    leadId: config.leadId,
    team: config.team,
    settings: {
      staleWorkingMinutes: config.staleWorkingMinutes,
      quietWarningMinutes: config.quietWarningMinutes,
    },
    agents: db.agents,
    activity: db.activity.slice(-100),
    usage: db.usage,
    looks: db.looks,
    maxAgents: MAX_AGENTS,
    health: { ...health, lastStatusAt: db.lastStatusAt },
    serverTime: new Date().toISOString(),
  });
  const broadcast = (event, payload) => {
    const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of clients) res.write(msg);
  };

  // ---------- heartbeat + usage ----------
  const heartbeat = () => {
    health.lastHeartbeat = new Date().toISOString();
    broadcast('heartbeat', { health: { ...health, lastStatusAt: db.lastStatusAt }, serverTime: health.lastHeartbeat });
  };
  every(heartbeat, (config.heartbeatMinutes || 5) * 60_000);

  // Refreshed every few minutes and right after each Claude Code turn
  // (the hook pings /api/usage/refresh). Only changed log files are re-read.
  let lastUsageRead = 0;
  const refreshUsage = (force = false) => {
    if (env.USAGE_FROM_CLAUDE_CODE === '0') return;
    if (!force && Date.now() - lastUsageRead < 15_000) return; // debounce bursts
    lastUsageRead = Date.now();
    try {
      const u = readClaudeCodeUsage(env);
      if (!u) return;
      const changed = !db.usage || db.usage.usedTokens !== u.usedTokens || db.usage.resetsAt !== u.resetsAt;
      db.usage = u;
      if (changed) save();
      broadcast('usage', u); // also moves "read at" forward so the board shows it's live
    } catch (e) { console.warn('[office] usage read failed:', e.message); }
  };
  if (env.USAGE_FROM_CLAUDE_CODE !== '0') {
    setTimeout(() => refreshUsage(true), 1500).unref?.();
    every(() => refreshUsage(true), (config.usageRefreshMinutes || 5) * 60_000);
  }

  // ---------- status updates (shared by the API and the inbox) ----------
  function applyStatus(b) {
    const agent = String(b.agent || '').toLowerCase();
    const state = String(b.state || '').toLowerCase();
    if (!ids.has(agent)) return { error: `unknown agent "${agent}". Known: ${[...ids].join(', ')}` };
    if (!STATES.includes(state)) return { error: `state must be one of ${STATES.join(', ')}` };
    const to = b.to ? String(b.to).toLowerCase() : (state === 'handoff' ? config.leadId : null);
    const withId = b.with ? String(b.with).toLowerCase() : null;
    if (to && !ids.has(to)) return { error: `unknown "to" agent "${to}"` };
    if (withId && !ids.has(withId)) return { error: `unknown "with" agent "${withId}"` };
    if (state === 'meeting' && !withId) return { error: 'meeting needs "with"' };

    const now = new Date().toISOString();
    const text = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
    const id = crypto.randomUUID();
    db.agents[agent] = { state, text, updatedAt: now, to, with: withId, eventId: id };
    const item = { id, t: now, agent, state, text, to, with: withId };
    db.activity.push(item);
    if (db.activity.length > MAX_ACTIVITY) db.activity.splice(0, db.activity.length - MAX_ACTIVITY);
    db.lastStatusAt = now;
    save();
    broadcast('status', { agent, status: db.agents[agent], activity: item, health: { ...health, lastStatusAt: now } });
    return { agent, status: db.agents[agent] };
  }

  // ---------- inbox folder ----------
  // Anything that can write a file into <office>/inbox can report status,
  // e.g. Claude in Chat through a connected folder. Each *.json file holds
  // one status object (or an array of them) and is removed once read.
  // Files older than the stale window are dropped, never replayed.
  const inboxDir = path.join(ROOT, 'inbox');
  fs.mkdirSync(inboxDir, { recursive: true });
  const maxAgeMs = (config.staleWorkingMinutes || 10) * 60_000;
  const scanInbox = () => {
    let files = [];
    try { files = fs.readdirSync(inboxDir).filter((f) => f.endsWith('.json')).sort(); } catch { return; }
    for (const f of files) {
      const file = path.join(inboxDir, f);
      try {
        const stat = fs.statSync(file);
        const raw = fs.readFileSync(file, 'utf8');
        if (!raw.trim() && Date.now() - stat.mtimeMs < 5000) continue; // still being written
        const parsed = JSON.parse(raw);
        for (const b of Array.isArray(parsed) ? parsed : [parsed]) {
          const at = Date.parse(b?.at || '') || stat.mtimeMs;
          if (Date.now() - at > maxAgeMs) { console.warn(`[office] inbox: skipped old update in ${f}`); continue; }
          const r = applyStatus(b || {});
          if (r.error) console.warn(`[office] inbox: ${f}: ${r.error}`);
        }
        fs.unlinkSync(file);
      } catch (e) {
        if (e instanceof SyntaxError) {
          try { fs.renameSync(file, file + '.bad'); } catch { /* ignore */ }
          console.warn(`[office] inbox: ${f} is not valid JSON, renamed to ${f}.bad`);
        }
      }
    }
  };
  every(scanInbox, 2000);
  globalThis.__officeApiStop = () => {
    for (const t of timers) clearInterval(t);
    for (const res of clients) { try { res.end(); } catch { /* gone */ } }
    clients.clear();
  };
  scanInbox();

  // ---------- helpers ----------
  const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => {
    const i = c.indexOf('='); return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
  }));
  const hasSession = (req) => !password || cookies(req).office_session === sessionValue;
  const hasToken = (req) => token && req.headers.authorization === `Bearer ${token}`;
  const json = (res, code, body) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  };
  const readBody = (req) => new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); });
    req.on('end', () => {
      if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) {
        resolve(Object.fromEntries(new URLSearchParams(s)));
      } else { try { resolve(JSON.parse(s || '{}')); } catch { resolve(null); } }
    });
  });

  const loginPage = (failed) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${config.title} · Sign in</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e1116;color:#e6e8eb;font:15px system-ui,sans-serif}
form{background:#161a21;border:1px solid #262c36;border-radius:14px;padding:28px;width:min(320px,calc(100vw - 32px));display:grid;gap:12px}
h1{font-size:17px;margin:0 0 4px}input,button{font:inherit;padding:10px 12px;border-radius:9px;border:1px solid #2b3240;background:#0e1116;color:inherit}
button{background:#5b6cf0;border:0;color:#fff;cursor:pointer}p{margin:0;color:#f87171;font-size:13px}</style></head>
<body><form method="post" action="/api/login"><h1>${config.title}</h1>
<input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password">
${failed ? '<p>Wrong password.</p>' : ''}<button>Enter</button></form></body></html>`;

  // ---------- middleware ----------
  return async function officeApi(req, res, next) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;

    // Password lock (only when OFFICE_PASSWORD is set)
    if (password) {
      if (p === '/login') { res.setHeader('Content-Type', 'text/html'); return res.end(loginPage(url.searchParams.has('failed'))); }
      if (p === '/api/login' && req.method === 'POST') {
        const body = await readBody(req);
        if (body?.password === password) {
          res.setHeader('Set-Cookie', `office_session=${sessionValue}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
          res.statusCode = 303; res.setHeader('Location', '/'); return res.end();
        }
        res.statusCode = 303; res.setHeader('Location', '/login?failed'); return res.end();
      }
      const isPush = req.method === 'POST' && (p === '/api/status' || p.startsWith('/api/usage'));
      if (!hasSession(req) && !(isPush && hasToken(req))) {
        if (p.startsWith('/api/')) return json(res, 401, { error: 'locked' });
        res.statusCode = 303; res.setHeader('Location', '/login'); return res.end();
      }
    }

    if (!p.startsWith('/api/')) return next();

    // Writes need the token when one is configured (or a signed-in browser).
    // (the wardrobe is a browser setting, not a status push, so it doesn't need the token)
    if (req.method === 'POST' && token && p !== '/api/looks' && p !== '/api/team' && !hasToken(req) && !(password && hasSession(req))) {
      return json(res, 401, { error: 'missing or wrong OFFICE_TOKEN' });
    }

    if (p === '/api/state' && req.method === 'GET') return json(res, 200, snapshot());

    if (p === '/api/events' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`retry: 3000\nevent: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`);
      clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }

    if (p === '/api/status' && req.method === 'POST') {
      const b = await readBody(req);
      if (!b) return json(res, 400, { error: 'invalid JSON' });
      const r = applyStatus(b);
      return r.error ? json(res, 400, r) : json(res, 200, { ok: true, ...r });
    }

    if (p === '/api/usage' && req.method === 'POST') {
      const b = await readBody(req);
      const used = Number(b?.usedTokens);
      if (!Number.isFinite(used) || used < 0) return json(res, 400, { error: 'usedTokens (number) required' });
      db.usage = {
        source: String(b.source || 'manual').slice(0, 40),
        usedTokens: used,
        limitTokens: Number(b.limitTokens) || null,
        resetsAt: b.resetsAt || null,
        readAt: new Date().toISOString(),
      };
      save(); broadcast('usage', db.usage);
      return json(res, 200, { ok: true, usage: db.usage });
    }

    // ---------- team (the HR page) ----------
    if (p === '/api/team' && req.method === 'GET') return json(res, 200, { title: config.title, leadId: config.leadId, team: config.team, maxAgents: MAX_AGENTS, configured: fs.existsSync(TEAM_FILE) });
    // what the Team page needs to show connection instructions (never the token itself)
    if (p === '/api/info' && req.method === 'GET') {
      const port = Number(env.OFFICE_PORT) || 5180;
      return json(res, 200, { root: ROOT, url: `http://localhost:${port}`, tokenRequired: !!token, passwordSet: !!password, inbox: path.join(ROOT, 'inbox'), mcp: path.join(ROOT, 'mcp', 'server.mjs'), skill: path.join(ROOT, 'skills', 'agent-office', 'SKILL.md') });
    }
    if (p === '/api/team' && req.method === 'POST') {
      const b = await readBody(req);
      const r = validateTeam(b, config);
      if (r.error) return json(res, 400, r);
      saveTeam(r.config);
      config = readConfig();
      ids = new Set(config.team.map((t) => t.id));
      for (const id of ids) db.agents[id] ??= { state: 'idle', text: '', updatedAt: null };
      for (const id of Object.keys(db.agents)) if (!ids.has(id)) delete db.agents[id];
      for (const id of Object.keys(db.looks || {})) if (!ids.has(id)) delete db.looks[id];
      save(); broadcast('config', snapshot());
      return json(res, 200, { ok: true, title: config.title, leadId: config.leadId, team: config.team });
    }

    if (p === '/api/looks' && req.method === 'GET') return json(res, 200, { looks: db.looks || {} });
    if (p === '/api/looks' && req.method === 'POST') {
      const b = await readBody(req);
      const looks = b?.looks;
      if (!looks || typeof looks !== 'object' || Array.isArray(looks)) return json(res, 400, { error: 'looks (object) required' });
      if (JSON.stringify(looks).length > 50_000) return json(res, 400, { error: 'looks too large' });
      db.looks = Object.fromEntries(Object.entries(looks).filter(([id, v]) => ids.has(id) && v && typeof v === 'object'));
      save(); broadcast('looks', db.looks);
      return json(res, 200, { ok: true, looks: db.looks });
    }

    if (p === '/api/usage/refresh' && req.method === 'POST') {
      refreshUsage(false);
      return json(res, 200, { ok: true, usage: db.usage });
    }

    return json(res, 404, { error: 'not found' });
  };
}
