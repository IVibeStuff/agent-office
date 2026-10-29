#!/usr/bin/env node
// Report an agent's status to the office.
//
//   node scripts/status.mjs <agent> <state> "<short generic text>" [--to <agent>] [--with <agent>]
//
// states: working | waiting | meeting | handoff | error | done | idle
// examples:
//   node scripts/status.mjs ben working "Building step 4"
//   node scripts/status.mjs ben meeting "Clarifying the brief" --with ada
//   node scripts/status.mjs cleo handoff "Step 4 is clear" --to ada
//   node scripts/status.mjs ada done "Step 4 deployed"
import { loadEnv } from '../server/env.mjs';

const env = loadEnv();
const args = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) flags[args[i].slice(2)] = args[++i];
  else pos.push(args[i]);
}
const [agent, state, ...rest] = pos;
if (!agent || !state) {
  console.error('usage: node scripts/status.mjs <agent> <state> "<text>" [--to agent] [--with agent]');
  process.exit(2);
}
const url = (env.OFFICE_URL || `http://localhost:${env.OFFICE_PORT || 5180}`).replace(/\/$/, '');
const headers = { 'Content-Type': 'application/json' };
if (env.OFFICE_TOKEN) headers.Authorization = `Bearer ${env.OFFICE_TOKEN}`;

try {
  const res = await fetch(`${url}/api/status`, {
    method: 'POST', headers,
    body: JSON.stringify({ agent, state, text: rest.join(' '), to: flags.to, with: flags.with }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { console.error(`office: ${res.status} ${body.error || ''}`); process.exit(1); }
  console.log(`office: ${agent} → ${state}`);
} catch (e) {
  // Never block the agent's real work if the office is offline.
  console.error(`office: not reachable at ${url} (${e.cause?.code || e.message})`);
  process.exit(0);
}
