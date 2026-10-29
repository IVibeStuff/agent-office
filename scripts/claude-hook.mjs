#!/usr/bin/env node
// Claude Code hook → office status.
//
// Claude Code runs this on hook events and passes the event as JSON on stdin.
// It maps the event to a teammate and posts a short, generic status line.
// It prints nothing and always exits 0, so it can never block or change
// what Claude does. If the office isn't running, it quietly does nothing.
//
//   UserPromptSubmit      → lead: working
//   SubagentStart         → matching teammate: working
//   SubagentStop          → matching teammate: handoff → lead
//   Notification          → whoever is asking: waiting (permission / input)
//   Stop                  → lead: done
//   SessionEnd            → lead: idle
//
// Teammates are matched by their "Recognise" words (Team page → Advanced) against
// the subagent type (e.g. data-fetcher) and the prompt the lead gave it
// (e.g. "You are Cleo").
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEnv, readConfig } from '../server/env.mjs';

const STATE_FILE = path.join(os.tmpdir(), 'agent-office-hooks.json');
const MAX_TEXT = 80;

async function main() {
  const raw = await readStdin();
  if (!raw) return;
  const ev = JSON.parse(raw);
  const env = loadEnv();
  const config = readConfig();
  const lead = config.leadId;
  const project = String(ev.cwd || '').split(/[\\/]+/).filter(Boolean).pop() || '';
  const say = (t) => (project ? `${project}: ${t}` : t).slice(0, MAX_TEXT);

  switch (ev.hook_event_name) {
    case 'UserPromptSubmit':
      if (!ev.agent_id) await post(env, { agent: lead, state: 'working', text: say('working on your request') });
      break;

    case 'SubagentStart': {
      const hit = identifyStart(ev, config);
      if (!hit) break;
      remember(ev.agent_id, hit);
      await post(env, { agent: hit.member.id, state: 'working', text: say(verb(hit.member, 'start', hit.step)) });
      break;
    }

    case 'SubagentStop': {
      const hit = recall(ev.agent_id) || identifyStop(ev, config);
      if (!hit) break;
      forget(ev.agent_id);
      const m = member(config, hit);
      if (!m) break;
      await post(env, { agent: m.id, state: 'handoff', to: lead, text: say(verb(m, 'stop', hit.step)) });
      break;
    }

    case 'Notification': {
      const kind = ev.notification_type;
      if (kind && !['permission_prompt', 'elicitation_dialog'].includes(kind)) break; // idle reminders etc. are normal
      if (!kind && !/permission|approv|input/i.test(ev.message || '')) break;
      const hit = ev.agent_id ? recall(ev.agent_id) : null;
      const who = (hit && member(config, hit)?.id) || lead;
      await post(env, { agent: who, state: 'waiting', text: say(kind === 'elicitation_dialog' ? 'needs your input' : 'needs your approval') });
      break;
    }

    case 'Stop':
      if (!ev.agent_id) {
        await post(env, { agent: lead, state: 'done', text: say('turn finished') });
        await post(env, null, '/api/usage/refresh'); // tokens were just spent: update the wall board
      }
      break;

    case 'SessionEnd':
      await post(env, { agent: lead, state: 'idle', text: say('session ended') });
      break;

    default:
      break;
  }
}

// ---------- who is this? ----------
function matchMember(config, texts) {
  const hay = texts.filter(Boolean).join('\n').toLowerCase();
  if (!hay) return null;
  for (const m of config.team) {
    if (m.id === config.leadId) continue;
    for (const pat of m.match || []) if (hay.includes(String(pat).toLowerCase())) return m;
  }
  return null;
}

function stepOf(text) {
  const m = /\bstep\s+(\d+[a-z]?)\b/i.exec(text || '');
  return m ? m[1] : null;
}

function identifyStart(ev, config) {
  // 1. a dedicated subagent type (data-fetcher, qa-reviewer…)
  let m = matchMember(config, [ev.agent_type]);
  // 2. the prompt the lead just gave a subagent, from the main transcript
  const call = lastSubagentCall(ev.transcript_path, ev.agent_type);
  if (!m && call) m = matchMember(config, [call.prompt, call.description]);
  return m ? { member: m, memberId: m.id, step: stepOf(call?.prompt || call?.description) } : null;
}

function identifyStop(ev, config) {
  let m = matchMember(config, [ev.agent_type]);
  const first = firstUserText(ev.agent_transcript_path);
  if (!m) m = matchMember(config, [first]);
  return m ? { member: m, memberId: m.id, step: stepOf(first) } : null;
}

const member = (config, hit) => hit.member || config.team.find((t) => t.id === hit.memberId);

function verb(m, phase, step) {
  const s = step ? ` step ${step}` : '';
  const role = `${m.role} ${m.department}`.toLowerCase();
  if (/review|qa/.test(role)) return phase === 'start' ? `reviewing${s}` : `review${s} done`;
  if (/build|engineer|develop/.test(role)) return phase === 'start' ? `building${s}` : `${s ? `step ${step}` : 'build'} ready for review`;
  return phase === 'start' ? `working${s}` : `work${s} ready`;
}

// ---------- transcripts (read only the part we need) ----------
function readTail(file, bytes = 512 * 1024) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, bytes);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    return buf.toString('utf8');
  } finally { fs.closeSync(fd); }
}
function readHead(file, bytes = 128 * 1024) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n).toString('utf8');
  } finally { fs.closeSync(fd); }
}

function lastSubagentCall(transcript, agentType) {
  if (!transcript || !fs.existsSync(transcript)) return null;
  const lines = readTail(transcript).split('\n').reverse();
  let fallback = null;
  for (const line of lines) {
    if (!line.includes('"tool_use"')) continue;
    let row; try { row = JSON.parse(line); } catch { continue; }
    const blocks = row?.message?.content;
    if (!Array.isArray(blocks)) continue;
    for (const b of [...blocks].reverse()) {
      if (b?.type !== 'tool_use' || !['Agent', 'Task'].includes(b.name)) continue;
      const input = b.input || {};
      const type = input.subagent_type || 'general-purpose';
      if (!agentType || type === agentType) return input;
      fallback ??= input;
    }
  }
  return fallback;
}

function firstUserText(transcript) {
  if (!transcript || !fs.existsSync(transcript)) return '';
  for (const line of readHead(transcript).split('\n')) {
    if (!line.includes('"user"')) continue;
    let row; try { row = JSON.parse(line); } catch { continue; }
    if (row?.type !== 'user') continue;
    const c = row.message?.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.filter((x) => x?.type === 'text').map((x) => x.text).join('\n');
  }
  return '';
}

// ---------- agent_id → teammate memory between Start and Stop ----------
function loadState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } }
function saveState(s) { try { fs.writeFileSync(STATE_FILE, JSON.stringify(s)); } catch { /* ignore */ } }
function remember(id, hit) {
  if (!id) return;
  const s = loadState();
  const now = Date.now();
  for (const [k, v] of Object.entries(s)) if (now - v.t > 86_400_000) delete s[k];
  s[id] = { memberId: hit.member.id, step: hit.step, t: now };
  saveState(s);
}
function recall(id) { return id ? loadState()[id] || null : null; }
function forget(id) { if (!id) return; const s = loadState(); delete s[id]; saveState(s); }

// ---------- io ----------
function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { s += c; });
    process.stdin.on('end', () => resolve(s.trim()));
    setTimeout(() => resolve(s.trim()), 2000);
  });
}

async function post(env, body, route = '/api/status') {
  const url = (env.OFFICE_URL || `http://localhost:${env.OFFICE_PORT || 5180}`).replace(/\/$/, '');
  const headers = { 'Content-Type': 'application/json' };
  if (env.OFFICE_TOKEN) headers.Authorization = `Bearer ${env.OFFICE_TOKEN}`;
  try {
    await fetch(`${url}${route}`, { method: 'POST', headers, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(1500) });
  } catch { /* office not running: fine */ }
  if (env.OFFICE_HOOK_DEBUG && body) fs.appendFileSync(path.join(os.tmpdir(), 'agent-office-hooks.log'), `${new Date().toISOString()} ${JSON.stringify(body)}\n`);
}

main().catch(() => {}).finally(() => process.exit(0));
