// Team page: name the office, set up 1-8 agents, and show how to connect an AI to them.
const $ = (s) => document.querySelector(s);
const PALETTE = ['#5b6cf0', '#f59e0b', '#14b8a6', '#fb7185', '#a78bfa', '#22c55e', '#38bdf8', '#f97316'];
const NAMES = ['Ada', 'Ben', 'Cleo', 'Dex', 'Eve', 'Finn', 'Gus', 'Hana'];
const ROLES = ['Lead', 'Builder', 'Reviewer', 'Researcher', 'Writer', 'Tester', 'Designer', 'Analyst'];
const state = { title: '', team: [], leadId: null, max: 8, info: null, tab: 'skill', dirty: false };
const params = new URLSearchParams(location.search);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
// an agent's id is fixed once saved; new agents get one from their name when saved
const idOf = (a) => a.id || slug(a.name) || 'agent';

function renderAgents() {
  const box = $('#agents'); box.innerHTML = '';
  state.team.forEach((a, i) => {
    const row = document.createElement('div'); row.className = 'agent';
    row.innerHTML = `
      <label class="sw" style="background:${esc(a.color)}" title="Colour"><input type="color" value="${esc(a.color)}" /></label>
      <input type="text" class="name" maxlength="24" placeholder="Name" value="${esc(a.name)}" />
      <input type="text" class="role" maxlength="32" placeholder="Role" value="${esc(a.role)}" />
      <label class="lead" title="The lead takes the lead's desk"><input type="radio" name="lead" ${state.leadId === a.key ? 'checked' : ''} /> Lead</label>
      <button class="x" title="Remove" ${state.team.length <= 1 ? 'disabled' : ''}>✕</button>
      <div class="match"><input type="text" class="m" placeholder="Recognise this agent in Claude Code by… (comma separated, e.g. reviewer, You are Cleo)" value="${esc((a.match || []).join(', '))}" /></div>`;
    row.querySelector('input[type=color]').oninput = (e) => { a.color = e.target.value; row.querySelector('.sw').style.background = a.color; dirty(); };
    row.querySelector('.name').oninput = (e) => { a.name = e.target.value; dirty(); renderIds(); };
    row.querySelector('.role').oninput = (e) => { a.role = e.target.value; dirty(); };
    row.querySelector('input[type=radio]').onchange = () => { state.leadId = a.key; dirty(); };
    row.querySelector('.m').oninput = (e) => { a.match = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); dirty(); };
    row.querySelector('.x').onclick = () => { state.team.splice(i, 1); if (state.leadId === a.key) state.leadId = state.team[0]?.key; dirty(); renderAgents(); renderIds(); };
    box.append(row);
  });
  $('#count').textContent = `(${state.team.length}/${state.max})`;
  $('#add').disabled = state.team.length >= state.max;
}
let keySeq = 0;
function addAgent(a = {}) {
  const used = new Set(state.team.map((t) => t.color));
  const i = state.team.length;
  state.team.push({ key: ++keySeq, id: a.id, name: a.name ?? NAMES[i] ?? `Agent ${i + 1}`, role: a.role ?? ROLES[i] ?? 'Agent', color: a.color ?? PALETTE.find((c) => !used.has(c)) ?? PALETTE[i % 8], match: a.match ?? [] });
  return state.team.at(-1);
}
function dirty() { state.dirty = true; $('#msg').textContent = ''; $('#msg').className = 'msg'; }

async function save() {
  const btn = $('#save'); btn.disabled = true;
  const lead = state.team.find((a) => a.key === state.leadId) ?? state.team[0];
  const body = { title: $('#title').value.trim(), leadId: idOf(lead), team: state.team.map((a) => ({ id: a.id, name: a.name.trim(), role: a.role.trim(), color: a.color, match: a.match })) };
  try {
    const r = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'could not save');
    load(j); state.dirty = false;
    $('#msg').className = 'msg ok'; $('#msg').textContent = 'Saved. Open offices reload with the new team.';
    $('#welcome').hidden = true;
  } catch (e) { $('#msg').className = 'msg err'; $('#msg').textContent = e.message; }
  btn.disabled = false;
}

function load(t) {
  state.title = t.title; state.team = []; keySeq = 0;
  for (const m of t.team) addAgent(m);
  state.leadId = state.team.find((a) => a.id === t.leadId)?.key ?? state.team[0]?.key;
  $('#title').value = t.title || '';
  renderAgents(); renderIds();
}

// ---------- connect your AI ----------
const TABS = [['skill', 'Any AI (skill)'], ['claude-code', 'Claude Code'], ['mcp', 'MCP apps'], ['http', 'HTTP'], ['file', 'Inbox folder']];
function renderIds() {
  $('#ids').innerHTML = state.team.map((a) => `<code title="${esc(a.name)}">${esc(idOf(a))}</code>`).join('');
  renderHowto();
}
function pre(text) { return `<pre><button class="copy">Copy</button>${esc(text)}</pre>`; }
function renderHowto() {
  const i = state.info; if (!i) return;
  const first = idOf(state.team[0] ?? { name: 'agent' });
  const tok = i.tokenRequired ? ' -H "Authorization: Bearer $OFFICE_TOKEN"' : '';
  const mcpCmd = `node "${i.mcp}"`;
  const T = {
    skill: `<p>The simplest way: give your AI the <b>agent-office skill</b>. It explains when and how to report, for any AI that can run a command, make a web request or write a file.</p>
      <p class="muted">File: <code>${esc(i.skill)}</code></p>
      <p>Claude (claude.ai or the desktop app): upload the <code>skills/agent-office</code> folder as a skill. Other assistants: paste the contents of SKILL.md into their instructions, and tell each one which agent it is, e.g.:</p>
      ${pre(`You are "${state.team[0]?.name ?? 'Ada'}" (agent id: ${first}) in my Agent Office at ${i.url}.\nFollow the agent-office skill to report your status while you work.`)}`,
    'claude-code': `<p>Two parts. The <b>hooks</b> report automatically as Claude Code and its subagents start and stop (matched to agents by the "Recognise" words under Advanced):</p>
      ${pre(`cd "${i.root}"\nnpm run hooks:install`)}
      <p>And the <b>MCP server</b> gives Claude a <code>report_status</code> tool for richer updates:</p>
      ${pre(`claude mcp add agent-office -s user -e OFFICE_URL=${i.url}${i.tokenRequired ? ' -e OFFICE_TOKEN=<your token>' : ''} -- ${mcpCmd}`)}`,
    mcp: `<p>Any app that supports MCP (Claude Desktop, Cursor, and others) can use the office's MCP server. Add this to the app's MCP settings:</p>
      ${pre(JSON.stringify({ mcpServers: { 'agent-office': { command: 'node', args: [i.mcp], env: { OFFICE_URL: i.url, ...(i.tokenRequired ? { OFFICE_TOKEN: '<your token>' } : {}), OFFICE_AGENT: first } } } }, null, 2))}
      <p class="muted"><code>OFFICE_AGENT</code> is optional: set it when one app always plays the same agent. The tools: <code>report_status</code>, <code>list_agents</code>, <code>get_office</code>.</p>`,
    http: `<p>Anything that can make a web request can report. One POST per update:</p>
      ${pre(`curl -s -X POST ${i.url}/api/status${tok} \\\n  -H "Content-Type: application/json" \\\n  -d '{"agent":"${first}","state":"working","text":"Drafting the report"}'`)}
      <p class="muted">States: <code>working</code>, <code>waiting</code> (needs you), <code>handoff</code> (with <code>"to"</code>), <code>meeting</code> (with <code>"with"</code>), <code>error</code>, <code>done</code>, <code>idle</code>. Text: up to 80 characters.</p>`,
    file: `<p>For AIs that can only write files (for example through a shared folder): drop a small JSON file into the inbox. The office reads it within 2 seconds and deletes it.</p>
      <p class="muted">Folder: <code>${esc(i.inbox)}</code></p>
      ${pre(`{"agent":"${first}","state":"working","text":"Researching a question","at":"${new Date().toISOString().slice(0, 19)}Z"}`)}
      <p class="muted">Write it under a temporary name, then rename it to <code>*.json</code>. Updates older than 10 minutes are ignored.</p>`,
  };
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button data-k="${k}" class="${state.tab === k ? 'on' : ''}">${l}</button>`).join('');
  $('#tabs').querySelectorAll('button').forEach((b) => (b.onclick = () => { state.tab = b.dataset.k; renderHowto(); }));
  $('#howto').innerHTML = T[state.tab];
  $('#howto').querySelectorAll('.copy').forEach((b) => (b.onclick = () => { navigator.clipboard?.writeText(b.parentElement.textContent.replace(/^Copy/, '')); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1200); }));
}

$('#add').onclick = () => { addAgent(); dirty(); renderAgents(); renderIds(); };
$('#save').onclick = save;
$('#adv').onchange = (e) => $('#team-card').classList.toggle('adv', e.target.checked);
addEventListener('beforeunload', (e) => { if (state.dirty) e.preventDefault(); });

Promise.all([fetch('/api/team').then((r) => r.json()), fetch('/api/info').then((r) => r.json()).catch(() => null)]).then(([t, info]) => {
  state.max = t.maxAgents || 8; state.info = info;
  if (params.has('welcome') || !t.configured) $('#welcome').hidden = false;
  load(t);
});
