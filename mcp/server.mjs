#!/usr/bin/env node
// Agent Office MCP server (stdio, no dependencies).
// Gives any MCP-capable AI three tools: report_status, list_agents, get_office.
//
//   node mcp/server.mjs
//
// Settings (environment, or the office's own .env / .env.local):
//   OFFICE_URL    where the office runs           (default http://localhost:<OFFICE_PORT or 5180>)
//   OFFICE_TOKEN  needed only if the office sets one
//   OFFICE_AGENT  optional: the agent this AI always is, so it can leave `agent` out
import readline from 'node:readline';
import { loadEnv } from '../server/env.mjs';

const env = loadEnv();
const URL_BASE = (env.OFFICE_URL || `http://localhost:${Number(env.OFFICE_PORT) || 5180}`).replace(/\/+$/, '');
const TOKEN = env.OFFICE_TOKEN || '';
const DEFAULT_AGENT = (env.OFFICE_AGENT || '').toLowerCase();
const VERSION = '1.0.0';
const STATES = ['working', 'waiting', 'handoff', 'meeting', 'error', 'done', 'idle'];
const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = `This connects you to the user's Agent Office: a live 3D office where each AI agent is shown at its desk.
Report what you're doing with report_status so the user can see it at a glance:
- "working" when you start a task (and at meaningful milestones; an update older than 10 minutes counts as stale),
- "waiting" when you need the user's answer or approval,
- "handoff" (with "to") when you pass work to another agent, "meeting" (with "with") when working with one,
- "error" when you're stuck, "done" when you deliver.
Keep "text" short and generic (under 80 characters): the kind of work, never private content, names or secrets.
${DEFAULT_AGENT ? `You are agent "${DEFAULT_AGENT}"; you can leave "agent" out.` : 'Use list_agents to see who is who, and report as the agent the user assigned to you.'}`;

const TOOLS = [
  {
    name: 'report_status',
    title: 'Report status to the office',
    description: 'Show what you are doing in the Agent Office. Call when you start work, at milestones, when you need the user, when you hand off, and when you finish.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: `Agent id (see list_agents).${DEFAULT_AGENT ? ` Defaults to "${DEFAULT_AGENT}".` : ''}` },
        state: { type: 'string', enum: STATES, description: 'working | waiting (needs the user) | handoff (needs "to") | meeting (needs "with") | error | done | idle' },
        text: { type: 'string', maxLength: 80, description: 'Short, generic description of the work, e.g. "Drafting the report". No private details.' },
        to: { type: 'string', description: 'For handoff: the agent id receiving the work (defaults to the lead).' },
        with: { type: 'string', description: 'For meeting: the agent id you are working with.' },
      },
      required: ['state'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'list_agents',
    title: 'List the agents',
    description: 'The agents in the office: id, name, role, who leads, and what each is doing now.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_office',
    title: 'Look at the office',
    description: 'A summary of the office right now: who is working on what, who needs the user, recent activity and weekly usage.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

// ---------- talking to the office ----------
async function api(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  let res;
  try {
    res = await fetch(URL_BASE + path, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers });
  } catch {
    throw new Error(`Can't reach the office at ${URL_BASE}. Is it running (npm run dev)? Set OFFICE_URL if it runs elsewhere.`);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error(data.error === 'locked' ? 'The office is password-protected: set OFFICE_TOKEN for this server.' : 'The office needs OFFICE_TOKEN (set it in this server\'s environment).');
  if (!res.ok) throw new Error(data.error || `office answered ${res.status}`);
  return data;
}
const ago = (iso) => {
  if (!iso) return '';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

async function callTool(name, args = {}) {
  if (name === 'report_status') {
    const agent = String(args.agent || DEFAULT_AGENT || '').toLowerCase();
    if (!agent) {
      const s = await api('/api/state');
      return `Which agent are you? Pass "agent" (one of: ${s.team.map((m) => `${m.id} = ${m.name}`).join(', ')}).`;
    }
    const r = await api('/api/status', { agent, state: args.state, text: args.text, to: args.to, with: args.with });
    return `Office updated: ${agent} is ${r.status.state}${r.status.text ? ` (${r.status.text})` : ''}.`;
  }
  if (name === 'list_agents') {
    const s = await api('/api/state');
    return s.team.map((m) => {
      const st = s.agents[m.id] || {};
      return `${m.id}: ${m.name}, ${m.role}${m.id === s.leadId ? ' (lead)' : ''} — ${st.state || 'idle'}${st.text ? `: ${st.text}` : ''}${st.updatedAt ? ` (${ago(st.updatedAt)})` : ''}`;
    }).join('\n');
  }
  if (name === 'get_office') {
    const s = await api('/api/state');
    const lines = [`${s.title}: ${s.team.length} agents.`];
    const by = (st) => s.team.filter((m) => s.agents[m.id]?.state === st);
    const working = by('working'), waiting = by('waiting');
    lines.push(working.length ? `Working: ${working.map((m) => `${m.name} (${s.agents[m.id].text || '…'})`).join('; ')}` : 'Nobody is working right now.');
    if (waiting.length) lines.push(`Needs the user: ${waiting.map((m) => `${m.name} (${s.agents[m.id].text || '…'})`).join('; ')}`);
    const recent = (s.activity || []).slice(-8).reverse().map((a) => `- ${ago(a.t)}: ${s.team.find((m) => m.id === a.agent)?.name || a.agent} ${a.state}${a.text ? `: ${a.text}` : ''}`);
    if (recent.length) lines.push('Recent:', ...recent);
    if (s.usage?.usedTokens != null) lines.push(`Weekly usage: ${s.usage.usedTokens.toLocaleString('en')} tokens${s.usage.limitTokens ? ` of ${s.usage.limitTokens.toLocaleString('en')}` : ''}.`);
    return lines.join('\n');
  }
  throw Object.assign(new Error(`unknown tool ${name}`), { code: -32602 });
}

// ---------- JSON-RPC over stdio (one JSON message per line) ----------
const send = (msg) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
async function handle(msg) {
  const { id, method, params } = msg;
  const reply = (result) => id !== undefined && send({ id, result });
  const fail = (code, message) => id !== undefined && send({ id, error: { code, message } });
  try {
    switch (method) {
      case 'initialize': {
        const asked = params?.protocolVersion;
        return reply({
          protocolVersion: SUPPORTED.includes(asked) ? asked : SUPPORTED[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'agent-office', title: 'Agent Office', version: VERSION },
          instructions: INSTRUCTIONS,
        });
      }
      case 'ping': return reply({});
      case 'tools/list': return reply({ tools: TOOLS });
      case 'tools/call': {
        const tool = TOOLS.find((t) => t.name === params?.name);
        if (!tool) return fail(-32602, `Unknown tool: ${params?.name}`);
        try {
          const text = await callTool(tool.name, params.arguments || {});
          return reply({ content: [{ type: 'text', text }] });
        } catch (e) {
          return reply({ content: [{ type: 'text', text: e.message }], isError: true });
        }
      }
      default:
        if (method?.startsWith('notifications/')) return; // nothing to do
        return fail(-32601, `Method not found: ${method}`);
    }
  } catch (e) {
    return fail(-32603, e.message);
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return send({ id: null, error: { code: -32700, message: 'Parse error' } }); }
  for (const m of Array.isArray(msg) ? msg : [msg]) handle(m);
});
rl.on('close', () => process.exit(0));
process.stderr.write(`[agent-office] MCP server ready, talking to ${URL_BASE}\n`);
