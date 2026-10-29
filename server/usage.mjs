// Real weekly usage, read from Claude Code's own local session logs
// (~/.claude/projects/**/*.jsonl). Nothing is estimated: if no logs exist,
// the board says so. A weekly limit is only shown if you set one in .env.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function weekWindow(now = new Date(), resetDay = 1, resetHour = 0) {
  const start = new Date(now);
  start.setHours(resetHour, 0, 0, 0);
  const diff = (start.getDay() - resetDay + 7) % 7;
  start.setDate(start.getDate() - diff);
  if (start > now) start.setDate(start.getDate() - 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function claudeDirs() {
  const dirs = [];
  if (process.env.CLAUDE_CONFIG_DIR) {
    for (const d of process.env.CLAUDE_CONFIG_DIR.split(/[,;]/)) dirs.push(path.join(d.trim(), 'projects'));
  }
  dirs.push(path.join(os.homedir(), '.claude', 'projects'));
  dirs.push(path.join(os.homedir(), '.config', 'claude', 'projects'));
  return [...new Set(dirs)].filter((d) => fs.existsSync(d));
}

function* walk(dir) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.jsonl')) yield p;
  }
}

// Parsed rows per log file, so a refresh only re-reads files that changed.
const fileCache = new Map(); // path -> { mtimeMs, size, rows: [[key, tMs, in, out, cw, cr]] }

function parseFile(file, stat) {
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.includes('"usage"')) continue;
    let row; try { row = JSON.parse(line); } catch { continue; }
    const u = row?.message?.usage;
    if (!u || !row.timestamp) continue;
    rows.push([
      `${row.message.id ?? ''}:${row.requestId ?? ''}`, Date.parse(row.timestamp),
      u.input_tokens || 0, u.output_tokens || 0, u.cache_creation_input_tokens || 0, u.cache_read_input_tokens || 0,
    ]);
  }
  fileCache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, rows });
}

export function readClaudeCodeUsage(env = process.env) {
  const resetDay = Number(env.USAGE_RESET_DAY ?? 1);
  const resetHour = Number(env.USAGE_RESET_HOUR ?? 0);
  const { start, end } = weekWindow(new Date(), resetDay, resetHour);
  const dirs = claudeDirs();
  if (!dirs.length) return null;

  const live = new Set();
  let reparsed = 0;
  for (const dir of dirs) {
    for (const file of walk(dir)) {
      try {
        const stat = fs.statSync(file);
        if (stat.mtime < start) continue; // untouched this week
        live.add(file);
        const c = fileCache.get(file);
        if (!c || c.mtimeMs !== stat.mtimeMs || c.size !== stat.size) { parseFile(file, stat); reparsed++; }
      } catch { /* unreadable file: skip */ }
    }
  }
  for (const f of fileCache.keys()) if (!live.has(f)) fileCache.delete(f);

  const seen = new Set();
  let input = 0, output = 0, cacheWrite = 0, cacheRead = 0, messages = 0;
  const s0 = start.getTime(), e0 = end.getTime();
  for (const { rows } of fileCache.values()) {
    for (const [key, t, i, o, cw, cr] of rows) {
      if (t < s0 || t >= e0) continue;
      if (key !== ':' && seen.has(key)) continue;
      seen.add(key);
      input += i; output += o; cacheWrite += cw; cacheRead += cr; messages++;
    }
  }
  const used = input + output + cacheWrite;
  const limit = Number(env.USAGE_WEEKLY_LIMIT_TOKENS) || null;
  return {
    source: 'Claude Code logs',
    usedTokens: used,
    breakdown: { input, output, cacheWrite, cacheRead, messages },
    limitTokens: limit,
    windowStart: start.toISOString(),
    resetsAt: end.toISOString(),
    readAt: new Date().toISOString(),
    filesReread: reparsed,
  };
}
