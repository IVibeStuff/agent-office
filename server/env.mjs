// Tiny .env loader (no dependency). Values already in process.env win.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadEnv() {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
  return process.env;
}

// office.config.json holds the defaults that ship with the app. The team you set up
// on the HR page is saved to data/office.json (git-ignored) and wins over them.
export const MAX_AGENTS = 8;
export const TEAM_FILE = path.join(ROOT, 'data', 'office.json');

export function readConfig() {
  const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'office.config.json'), 'utf8'));
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(TEAM_FILE, 'utf8')); } catch { /* not set up yet */ }
  const cfg = { ...base, ...pick(saved, ['title', 'leadId', 'team']) };
  // the role doubles as the department label on desk carpets and zone signs
  cfg.team = (cfg.team || []).slice(0, MAX_AGENTS).map((m) => ({ match: [], ...m, department: m.role || m.department || 'Agent' }));
  if (!cfg.team.some((m) => m.id === cfg.leadId)) cfg.leadId = cfg.team[0]?.id;
  return cfg;
}
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

export const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
const HEX = /^#[0-9a-f]{6}$/i;
export const PALETTE = ['#5b6cf0', '#f59e0b', '#14b8a6', '#fb7185', '#a78bfa', '#22c55e', '#38bdf8', '#f97316'];

// Check a team sent from the HR page. Returns { config } or { error }.
export function validateTeam(body, current) {
  const title = String(body?.title ?? current.title ?? '').trim().slice(0, 40) || 'Agent Office';
  const list = Array.isArray(body?.team) ? body.team : null;
  if (!list || list.length < 1) return { error: 'team must have at least one agent' };
  if (list.length > MAX_AGENTS) return { error: `at most ${MAX_AGENTS} agents` };
  const seen = new Set(), team = [];
  for (const raw of list) {
    const name = String(raw?.name || '').trim().slice(0, 24);
    if (!name) return { error: 'every agent needs a name' };
    let id = slug(raw.id || name) || 'agent';
    if (seen.has(id)) { let n = 2; while (seen.has(`${id}-${n}`)) n++; id = `${id}-${n}`; }
    seen.add(id);
    const prev = current.team.find((m) => m.id === id) || {};
    team.push({
      ...prev,
      id, name,
      role: String(raw.role ?? prev.role ?? '').trim().slice(0, 32) || 'Agent',
      color: HEX.test(raw.color) ? raw.color.toLowerCase() : prev.color || PALETTE[team.length % PALETTE.length],
      match: Array.isArray(raw.match) ? raw.match.map(String).filter(Boolean).slice(0, 12).map((x) => x.slice(0, 80)) : prev.match || [],
    });
  }
  const leadId = team.some((m) => m.id === body.leadId) ? body.leadId : team[0].id;
  return { config: { title, leadId, team } };
}

export function saveTeam(cfg) {
  fs.mkdirSync(path.dirname(TEAM_FILE), { recursive: true });
  fs.writeFileSync(TEAM_FILE, JSON.stringify({ title: cfg.title, leadId: cfg.leadId, team: cfg.team }, null, 2));
}
