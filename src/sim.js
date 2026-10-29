// "Simulate Work": runs the team through busy build cycles, in the browser
// only. It never writes to the status feed.
//
// If the team has a builder and a reviewer (by role) the lead runs them through
// brief → build → review → go-ahead → deploy. Everyone else works through their
// own tasks, sometimes asks you something, and hands finished work to the lead.
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const between = (a, b) => a + Math.random() * (b - a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Simulation {
  constructor(team, leadId, onChange) {
    this.team = team; this.leadId = leadId; this.onChange = onChange;
    this.running = false;
    const find = (re) => team.find((m) => m.id !== leadId && re.test(`${m.role} ${m.department}`))?.id;
    this.builder = find(/build|engineer|develop/i);
    this.reviewer = find(/review|qa/i);
  }
  set(id, state, text, extra = {}) {
    if (!this.running) return;
    const now = new Date().toISOString();
    const eventId = `sim-${Math.random().toString(36).slice(2)}`;
    this.agents[id] = { state, text, updatedAt: now, eventId, to: extra.to || null, with: extra.with || null };
    this.onChange({ ...this.agents }, { id: eventId, t: now, agent: id, state, text, to: extra.to || null, with: extra.with || null, sim: true });
  }
  async wait(a, b = a) {
    await sleep(between(a, b));
    if (!this.running) throw new Error('stopped');
  }
  start() {
    this.running = true;
    this.run = (this.run || 0) + 1;
    this.agents = Object.fromEntries(this.team.map((m) => [m.id, { state: 'idle', text: '', updatedAt: new Date().toISOString() }]));
    this.onChange({ ...this.agents }, null);
    const pipeline = this.builder && this.reviewer;
    const loops = [pipeline ? () => this.buildCycle() : () => this.leadDay()];
    // everyone outside the build pipeline works on their own tasks
    for (const m of this.team) {
      if (m.id === this.leadId || (pipeline && [this.builder, this.reviewer].includes(m.id))) continue;
      loops.push(() => this.soloJob(m.id));
    }
    const run = this.run;
    loops.forEach((loop, i) => (async () => {
      try { await this.wait(800 + i * 4000); while (this.running && run === this.run) await loop(); } catch { /* stopped */ }
    })());
  }
  stop() { this.running = false; }

  async buildCycle() {
    const A = this.leadId, B = this.builder, R = this.reviewer;
    const step = (this.step = (this.step || 0) + 1);
    this.set(A, 'working', `Scoping step ${step}`);
    await this.wait(5000, 7000);
    this.set(A, 'working', `Writing brief for step ${step}`);
    await this.wait(4000, 6000);
    this.set(A, 'handoff', `Brief for step ${step}`, { to: B });
    await this.wait(9000, 11000);
    this.set(A, 'idle', 'Waiting on the build');
    this.set(B, 'working', `Building step ${step}`);
    await this.wait(6000, 8000);
    if (Math.random() < 0.3) {
      this.set(B, 'meeting', 'Clarifying the brief', { with: A });
      this.set(A, 'working', `Answering ${this.name(B)}`);
      await this.wait(7000, 9000);
      this.set(A, 'idle', 'Waiting on the build');
    }
    this.set(B, 'working', pick(['Tests passing', 'Halfway there', 'Writing review request']));
    await this.wait(6000, 8000);
    let rounds = 0;
    for (;;) {
      this.set(B, 'handoff', `Step ${step} ready for review`, { to: A });
      await this.wait(9000, 11000);
      this.set(B, 'idle', 'Waiting on review');
      this.set(A, 'handoff', `Review request for step ${step}`, { to: R });
      await this.wait(9000, 11000);
      this.set(A, 'idle', 'Waiting on review');
      this.set(R, 'working', `Reviewing step ${step}`);
      await this.wait(9000, 12000);
      const mustFix = rounds === 0 && Math.random() < 0.4;
      this.set(R, 'handoff', mustFix ? 'Must-fix items found' : `Step ${step} is clear`, { to: A });
      await this.wait(9000, 11000);
      this.set(R, 'idle', 'Review done');
      if (!mustFix) break;
      rounds++;
      this.set(A, 'handoff', 'Review feedback', { to: B });
      await this.wait(9000, 11000);
      this.set(A, 'idle', 'Waiting on the fix');
      this.set(B, 'working', 'Fixing review notes');
      await this.wait(7000, 9000);
    }
    this.set(A, 'waiting', 'Needs your go-ahead to deploy');
    await this.wait(5000, 6500);
    this.set(A, 'working', `Deploying step ${step}`);
    await this.wait(5000, 7000);
    this.set(A, 'done', `Step ${step} deployed`);
    await this.wait(6000, 9000);
  }

  name(id) { return this.team.find((m) => m.id === id)?.name || id; }

  async soloJob(id) {
    const job = pick([
      ['Researching a question', 'Comparing sources', 'Writing up findings'],
      ['Drafting a document', 'Editing the draft', 'Polishing the final copy'],
      ['Analysing a spreadsheet', 'Building a chart', 'Summarising the numbers'],
      ['Planning a trip', 'Checking options', 'Putting the plan together'],
    ]);
    this.set(id, 'working', job[0]);
    await this.wait(7000, 10000);
    if (Math.random() < 0.3) {
      this.set(id, 'waiting', 'Needs your answer');
      await this.wait(5000, 7000);
    }
    this.set(id, 'working', job[1]);
    await this.wait(7000, 10000);
    this.set(id, 'working', job[2]);
    await this.wait(6000, 9000);
    if (this.leadId && id !== this.leadId && Math.random() < 0.4) {
      this.set(id, 'handoff', 'Ready for a look', { to: this.leadId });
      await this.wait(8000, 10000);
    }
    this.set(id, 'done', 'Delivered');
    await this.wait(12000, 20000);
  }

  // a lead without a build pipeline: plans, checks in, signs things off
  async leadDay() {
    const A = this.leadId;
    this.set(A, 'working', pick(['Planning the day', 'Splitting up the work', 'Reading the latest updates']));
    await this.wait(8000, 12000);
    if (Math.random() < 0.35) { this.set(A, 'waiting', 'Needs your go-ahead'); await this.wait(5000, 7000); }
    this.set(A, 'working', pick(['Reviewing a delivery', 'Answering questions', 'Updating the plan']));
    await this.wait(8000, 12000);
    this.set(A, 'idle', '');
    await this.wait(8000, 14000);
  }
}
