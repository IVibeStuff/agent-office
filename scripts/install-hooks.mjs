#!/usr/bin/env node
// Adds (or removes) the office hooks in your user-level Claude Code settings,
// so every project you open in Claude Code reports to the office.
//
//   npm run hooks:install      add the hooks (backs up settings.json first)
//   npm run hooks:remove       take them out again
//   npm run hooks:show         print what would be added, change nothing
//
// Only entries that point at this folder's claude-hook.mjs are touched;
// your other settings and hooks are left exactly as they are.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT } from '../server/env.mjs';

const EVENTS = ['UserPromptSubmit', 'SubagentStart', 'SubagentStop', 'Notification', 'Stop', 'SessionEnd'];
const MARK = 'claude-hook.mjs';
const script = path.join(ROOT, 'scripts', MARK).replace(/\\/g, '/');
const command = `node "${script}"`;

const configDir = process.env.CLAUDE_CONFIG_DIR?.split(/[,;]/)[0] || path.join(os.homedir(), '.claude');
const file = path.join(configDir, 'settings.json');
const mode = process.argv[2] || 'install';

const isOurs = (h) => typeof h?.command === 'string' && h.command.includes(MARK);

function withoutOurs(hooks = {}) {
  const out = {};
  for (const [event, groups] of Object.entries(hooks)) {
    const kept = (groups || [])
      .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) }))
      .filter((g) => g.hooks.length);
    if (kept.length) out[event] = kept;
  }
  return out;
}

function ours() {
  return Object.fromEntries(EVENTS.map((e) => [e, [{ hooks: [{ type: 'command', command, timeout: 5 }] }]]));
}

let settings = {};
if (fs.existsSync(file)) {
  try { settings = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error(`Could not read ${file}: ${e.message}\nFix or remove that file first; nothing was changed.`); process.exit(1); }
}

if (mode === 'show') {
  console.log(`Settings file: ${file}\nWould add:\n${JSON.stringify({ hooks: ours() }, null, 2)}`);
  process.exit(0);
}

const hooks = withoutOurs(settings.hooks);
if (mode === 'install') {
  for (const [event, groups] of Object.entries(ours())) hooks[event] = [...(hooks[event] || []), ...groups];
} else if (mode !== 'remove') {
  console.error('usage: node scripts/install-hooks.mjs [install|remove|show]');
  process.exit(2);
}

const next = { ...settings };
if (Object.keys(hooks).length) next.hooks = hooks; else delete next.hooks;

fs.mkdirSync(configDir, { recursive: true });
if (fs.existsSync(file)) {
  const backup = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(file, backup);
  console.log(`Backed up your settings to ${backup}`);
}
fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
console.log(mode === 'install'
  ? `Office hooks added to ${file}\nThey run: ${command}\nRestart any open Claude Code sessions to pick them up.`
  : `Office hooks removed from ${file}`);
