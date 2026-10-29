// Side panel + HUD rendering
import { effectiveState } from './crew.js';

const $ = (s) => document.querySelector(s);
const LABEL = { working: 'Working', waiting: 'Needs you', meeting: 'Meeting', handoff: 'Handoff', error: 'Error', done: 'Done', idle: 'Idle', stale: 'Stale' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = (iso) => {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};
const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export class UI {
  constructor({ title, team, onSelect }) {
    this.team = team;
    this.byId = Object.fromEntries(team.map((m) => [m.id, m]));
    this.onSelect = onSelect;
    $('#office-title').textContent = title;
    document.title = title;
    $('#team-count').textContent = team.length;
    $('#team-list').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]');
      if (li) onSelect(li.dataset.id);
    });
  }

  render(agents, settings, activity, simulated) {
    const now = Date.now();
    const counts = { working: 0, waiting: 0, idle: 0 };
    const rows = this.team.map((m) => {
      const st = agents[m.id];
      const eff = effectiveState(st, settings, now);
      if (eff === 'working' || eff === 'meeting') counts.working++;
      else if (eff === 'waiting' || eff === 'error') counts.waiting++;
      else counts.idle++;
      const text = eff === 'stale' ? 'No update for over ' + (settings?.staleWorkingMinutes ?? 10) + ' min' : st?.text || '—';
      const withTxt = st?.with && eff === 'meeting' ? ` · with ${this.byId[st.with]?.name}` : st?.to && eff === 'handoff' ? ` → ${this.byId[st.to]?.name}` : '';
      return `<li data-id="${m.id}" class="${this.selected === m.id ? 'hl' : ''}">
        <span class="avatar" style="background:${m.color}"></span>
        <span class="tname">${esc(m.name)}<small>${esc(m.role)}</small></span>
        <span class="pill s-${eff}">${LABEL[eff] || eff}</span>
        <span class="ttext" title="${esc(text)}">${esc(text)}${esc(withTxt)}${st?.updatedAt && eff !== 'idle' ? ` <span class="muted">· ${ago(st.updatedAt)}</span>` : ''}</span>
      </li>`;
    });
    $('#team-list').innerHTML = rows.join('');
    $('#counts').innerHTML = `
      <span><i style="background:var(--ok)"></i>${counts.working} working</span>
      <span><i style="background:var(--warn)"></i>${counts.waiting} need you</span>
      <span><i style="background:var(--idle)"></i>${counts.idle} idle</span>`;

    const items = activity.slice(-40).reverse();
    $('#activity-count').textContent = simulated ? 'simulated' : items.length ? `${activity.length} updates` : '';
    $('#activity').innerHTML = items.length
      ? items.map((a) => {
        const m = this.byId[a.agent];
        const extra = a.to ? ` → ${this.byId[a.to]?.name || a.to}` : a.with ? ` · with ${this.byId[a.with]?.name || a.with}` : '';
        return `<li><time>${time(a.t)}</time><span><b style="color:${m?.color}">${esc(m?.name || a.agent)}</b> <span class="muted">${LABEL[a.state] || a.state}</span> ${esc(a.text)}${esc(extra)}${a.sim ? '<span class="sim">sim</span>' : ''}</span></li>`;
      }).join('')
      : `<li class="empty">No activity yet. Agents report in with <code>npm run status</code>, or press Simulate Work.</li>`;
  }

  select(id) {
    this.selected = this.selected === id ? null : id;
    document.querySelectorAll('#team-list li').forEach((li) => li.classList.toggle('hl', li.dataset.id === this.selected));
    return this.selected;
  }

  usage(u) {
    const body = $('#usage-body');
    $('#usage-src').textContent = u?.source || '';
    if (!u) { body.innerHTML = '<span class="muted">No reading yet. It fills from Claude Code logs on this computer, or a usage push.</span>'; return; }
    const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
    const reset = u.resetsAt ? (() => {
      const ms = Date.parse(u.resetsAt) - Date.now();
      return ms > 0 ? `resets in ${Math.floor(ms / 864e5)}d ${Math.floor((ms % 864e5) / 36e5)}h` : 'resetting';
    })() : '';
    if (u.limitTokens) {
      const left = Math.max(0, 1 - u.usedTokens / u.limitTokens);
      body.innerHTML = `<div class="usage-big">${Math.round(left * 100)}% left</div>
        <div class="usage-bar"><i style="width:${(1 - left) * 100}%"></i></div>
        ${fmt(u.usedTokens)} of ${fmt(u.limitTokens)} tokens · ${reset}`;
    } else {
      body.innerHTML = `<div class="usage-big">${fmt(u.usedTokens)} tokens</div>used this week · ${reset}`;
    }
  }

  live(state, text) {
    const el = $('#live-pill');
    el.className = 'live-pill ' + (state === 'live' ? 'live' : state === 'bad' ? 'bad' : '');
    el.textContent = text;
  }

  warning(text) {
    const el = $('#feed-warning');
    el.hidden = !text;
    el.textContent = text || '';
  }

  simulating(on) {
    $('#sim-badge').hidden = !on;
    const b = $('#sim-btn');
    b.textContent = on ? 'Stop Simulation' : 'Simulate Work';
    b.classList.toggle('on', on);
  }
}
