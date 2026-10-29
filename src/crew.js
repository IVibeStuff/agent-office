// Turns status data into where each bot should be and what it should do.
import { Bot } from './bot.js';
import * as L from './layout.js';

const DESK_STATES = new Set(['working', 'waiting', 'error']);
const FRESH_HANDOFF_MS = 120_000;

export function effectiveState(st, settings, now = Date.now()) {
  if (!st || !st.state) return 'idle';
  if (st.state === 'working' && st.updatedAt && now - Date.parse(st.updatedAt) > (settings?.staleWorkingMinutes ?? 10) * 60_000) return 'stale';
  return st.state;
}

export class Crew {
  constructor({ team, leadId, world, scene, desks }) {
    this.desks = desks;
    this.deskMap = world.layout?.desks || L.DESKS;
    const seats = world.layout?.loungeSeats || L.LOUNGE_SEATS;
    this.team = team;
    this.leadId = leadId;
    this.world = world;
    this.bots = {};
    this.played = new Set();
    this.inHandoff = new Set();
    this.monitorOn = {};
    team.forEach((m, i) => {
      const b = new Bot(m, world.nav);
      b.loungeSeat = seats[i % seats.length];
      b.heightAt = world.heightAt || null;
      world.dressBot?.(b, m, m.id === leadId);
      this.bots[m.id] = b;
      scene.add(b.group);
    });
    this.first = true;
  }

  // Called whenever the shown status changes (live or simulated)
  apply(agents, settings, { simulated = false } = {}) {
    this.agents = agents; this.settings = settings; this.simulated = simulated;
    const now = Date.now();
    for (const m of this.team) {
      const bot = this.bots[m.id];
      const st = agents[m.id];
      const eff = effectiveState(st, settings, now);
      bot.setTag(eff === 'stale' ? 'idle' : eff, m.name, m.role, eff === 'stale' ? 'No update for a while' : st?.text || '');

      if (this.inHandoff.has(m.id)) continue; // finish walking the paperwork over first

      // Fresh handoff: carry it over in person
      if (eff === 'handoff' && st.eventId && !this.played.has(st.eventId)) {
        const fresh = simulated || (st.updatedAt && now - Date.parse(st.updatedAt) < FRESH_HANDOFF_MS);
        this.played.add(st.eventId);
        if (fresh && !this.first) { this.startHandoff(bot, st); continue; }
      }
      this.placeOrGo(bot, this.targetFor(m.id, eff, st, now));
    }
    this.first = false;
    this.world.onAgents?.(agents, (st) => effectiveState(st, settings, now));
  }

  targetFor(id, eff, st) {
    if (DESK_STATES.has(eff) && this.desks[id]) return { key: 'desk', spot: L.deskSeat(this.desks[id], this.deskMap), pose: eff === 'working' ? 'type' : 'rest' };
    if (eff === 'meeting' && st?.with && st.with !== id) {
      const other = effectiveState(this.agents?.[st.with], this.settings);
      if ((DESK_STATES.has(other) || other === 'meeting') && this.desks[st.with]) {
        return { key: `visit:${st.with}`, spot: L.deskVisitor(this.desks[st.with], 1, this.deskMap), pose: 'rest' };
      }
      // the other one is in the lounge: meet them there
      return { key: 'lounge', spot: this.bots[id].loungeSeat, pose: 'rest' };
    }
    return { key: 'lounge', spot: this.bots[id].loungeSeat, pose: 'rest' };
  }

  placeOrGo(bot, t) {
    bot.setPose(t.pose);
    if (this.first) { bot.goalKey = t.key; bot.place(t.spot); return; }
    bot.goTo(t.key, t.spot);
  }

  startHandoff(bot, st) {
    const to = st.to && this.bots[st.to] ? st.to : this.leadId;
    const toEff = effectiveState(this.agents?.[to], this.settings);
    const spot = DESK_STATES.has(toEff) && this.desks[to]
      ? L.deskVisitor(this.desks[to], 0, this.deskMap)
      : { ...this.bots[to].loungeSeat.approach, rot: 0, sit: false };
    this.inHandoff.add(bot.id);
    bot.setPose('rest');
    bot.carry(true);
    bot.goTo(`handoff:${st.eventId}`, spot, () => {
      // face the recipient, hand it over, then carry on
      const r = this.bots[to].group.position;
      bot.targetRot = Math.atan2(r.x - bot.group.position.x, r.z - bot.group.position.z);
      setTimeout(() => {
        bot.carry(false);
        this.inHandoff.delete(bot.id);
        const cur = this.agents?.[bot.id];
        const eff = effectiveState(cur, this.settings);
        this.placeOrGo(bot, this.targetFor(bot.id, eff === 'handoff' ? 'idle' : eff, cur));
      }, 1600);
    });
  }

  update(dt) {
    for (const b of Object.values(this.bots)) b.update(dt);
    // desk monitors light up only while someone is actually working there
    for (const m of this.team) {
      const b = this.bots[m.id];
      const on = b.goalKey === 'desk' && b.seated && effectiveState(this.agents?.[m.id], this.settings) === 'working';
      if (this.monitorOn[m.id] !== on) { this.monitorOn[m.id] = on; this.world.monitors[this.desks[m.id]]?.(on); }
    }
  }

  // re-evaluate time-based rules (stale working) without new data
  tick() { if (this.agents) this.apply(this.agents, this.settings, { simulated: this.simulated }); }

  reset() { this.first = true; this.inHandoff.clear(); for (const b of Object.values(this.bots)) { b.carry(false); b.goalKey = null; } }
}
